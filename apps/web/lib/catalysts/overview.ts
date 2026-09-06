import "server-only";
import { logProviderIssue } from "@/lib/market-data/log";
import { sp500Universe } from "@/lib/breadth/universe/sp500";
import { canonicalToAlpaca } from "@/lib/breadth/symbols";
import { buildLiveAnomaliesOverview } from "@/lib/anomalies/overview";
import { withCatalystCache } from "./cache";
import { CATALYST_CANDIDATE_CAP, catalystMode, liveCredentials, secUserAgent, TTL } from "./config";
import { dedupeArticles, buildCatalystItem } from "./match";
import { computeCatalystWindow, inCatalystWindow, type CatalystWindow } from "./time-window";
import { applyCandidateWindow, resolveCandidateCutoff } from "./candidate-cutoff";
import {
  fetchAlpacaNews,
  fetchCorporateActions,
  fetchSecSubmissions,
  SEC_MAX_CONCURRENCY,
  type SecClient,
} from "./providers";
import type {
  CatalystItem,
  CatalystOverview,
  CatalystOverviewMeta,
  CorporateActionEvidence,
  NewsArticle,
  SecFiling,
} from "./types";

/** Ranked, unique, capped candidate union (topOverall + topPositive + topNegative). */
export function selectCatalystCandidates<T extends { ticker: string; anomalyScore: number }>(
  topOverall: T[],
  topPositive: T[],
  topNegative: T[],
  cap = CATALYST_CANDIDATE_CAP,
): T[] {
  const best = new Map<string, T>();
  for (const candidate of [...topOverall, ...topPositive, ...topNegative]) {
    const existing = best.get(candidate.ticker);
    if (!existing || candidate.anomalyScore > existing.anomalyScore) best.set(candidate.ticker, candidate);
  }
  return [...best.values()]
    .sort((a, b) => b.anomalyScore - a.anomalyScore)
    .slice(0, cap);
}

export async function buildLiveCatalystsOverview(): Promise<CatalystOverview> {
  const anomalyOverview = await buildLiveAnomaliesOverview();
  const anomalyGeneratedAt = anomalyOverview.meta.generatedAt ?? new Date().toISOString();
  // catalystCutoff MUST be the anomaly's effective price-data time, never
  // orchestration/generated time (Saturday request ≠ Friday price snapshot).
  const effectiveAsOf = anomalyOverview.meta.effectiveAsOf ?? anomalyOverview.asOf ?? anomalyOverview.meta.asOf;
  const catalystCutoff = effectiveAsOf;
  const window = computeCatalystWindow(catalystCutoff);
  const candidates = selectCatalystCandidates(anomalyOverview.topOverall, anomalyOverview.topPositive, anomalyOverview.topNegative);
  const creds = liveCredentials();
  const tickers = candidates.map((candidate) => candidate.ticker);

  const membersByTicker = new Map(sp500Universe.members.map((member) => [member.ticker, member]));

  const newsResult = await withCatalystCache(`catalysts:news:${tickers.join(",")}:${window.startIso}`, TTL.news, () =>
    fetchAlpacaNews(creds, tickers, window),
  ).catch(() => ({ articles: [], ok: false as const }));
  const articles = dedupeArticles(newsResult.articles);

  let corporateActionOk = false;
  let corporateActions: CorporateActionEvidence[] = [];
  try {
    const actionsResult = await withCatalystCache(
      `catalysts:actions:${tickers.join(",")}:${window.startIso}`,
      TTL.corporateActions,
      async () => ({ ok: true, actions: await fetchCorporateActions(creds, tickers, window) }),
    );
    corporateActionOk = actionsResult.ok;
    corporateActions = actionsResult.actions;
  } catch {
    corporateActionOk = false;
  }

  const secClient: SecClient = { enabled: secUserAgent().length > 0, userAgent: secUserAgent() };
  const secEnabled = secClient.enabled;
  const secFilingsByTicker = new Map<string, SecFiling[]>();
  let secOk = secEnabled;
  if (secEnabled) {
    const queue = [...tickers];
    const workers = Array.from({ length: SEC_MAX_CONCURRENCY }, async () => {
      while (queue.length > 0) {
        const ticker = queue.shift()!;
        const cik = membersByTicker.get(ticker)?.cik ?? "";
        if (!cik) continue;
        try {
          const filings = await withCatalystCache(`catalysts:sec:${cik}`, TTL.sec, () =>
            fetchSecSubmissions(secClient, cik, ticker, window, creds.timeoutMs),
          );
          secFilingsByTicker.set(ticker, filings);
        } catch (error) {
          secOk = false;
          logProviderIssue("server", 502, "sec", error instanceof Error ? error.message : "SEC failed");
        }
      }
    });
    await Promise.all(workers);
  }

  const relevantFor = (ticker: string, windowToUse: CatalystWindow) => (article: NewsArticle) =>
    article.symbols.some((symbol) => canonicalToAlpaca(symbol).toUpperCase() === canonicalToAlpaca(ticker).toUpperCase()) &&
    inCatalystWindow(article.publishedAt, windowToUse);

  const filingTimestamp = (filing: SecFiling): string =>
    filing.acceptanceDateTime ?? (filing.filingDate ? `${filing.filingDate}T00:00:00Z` : "");

  const items: CatalystItem[] = candidates.map((candidate) => {
    const name = membersByTicker.get(candidate.ticker)?.name ?? candidate.name;
    const priceAsOf = (candidate as { priceAsOf?: string | null }).priceAsOf ?? null;
    // Candidate-specific cutoff: min(candidate.priceAsOf, overview effectiveAsOf).
    const candidateCutoff = resolveCandidateCutoff({
      priceAsOf,
      overviewEffectiveAsOf: effectiveAsOf,
      marketOpen: anomalyOverview.meta.marketOpen,
    });
    const candidateWindow = applyCandidateWindow(window, candidateCutoff);
    const filings = (secFilingsByTicker.get(candidate.ticker) ?? []).filter((filing) =>
      inCatalystWindow(filingTimestamp(filing), candidateWindow),
    );
    return buildCatalystItem({
      ticker: candidate.ticker,
      name,
      movePct: candidate.dailyMovePct,
      anomalyScore: candidate.anomalyScore,
      anomalySeverity: candidate.severity,
      directionUp: candidate.direction === "up",
      news: articles.filter(relevantFor(candidate.ticker, candidateWindow)),
      filings,
      actions: corporateActions.filter(
        (action) =>
          action.ticker === candidate.ticker &&
          (action.date === null || inCatalystWindow(`${action.date}T00:00:00Z`, candidateWindow)),
      ),
      window: candidateWindow,
    });
  });

  const statusOf = (ok: boolean) => (ok ? "ok" : "error");
  const meta: CatalystOverviewMeta = {
    mode: catalystMode(),
    engineVersion: "catalyst-match-v1",
    anomalyVersion: "anomaly-v1",
    candidateCount: items.length,
    matchedCount: items.filter((item) => item.status === "MATCHED").length,
    unmatchedCount: items.filter((item) => item.status !== "MATCHED").length,
    asOf: effectiveAsOf,
    generatedAt: anomalyGeneratedAt,
    effectiveAsOf,
    catalystCutoff,
    providers: {
      news: statusOf(newsResult.ok),
      sec: secEnabled ? (secOk ? "ok" : "error") : "disabled",
      corporateActions: statusOf(corporateActionOk),
    },
  };

  return { meta, items };
}
