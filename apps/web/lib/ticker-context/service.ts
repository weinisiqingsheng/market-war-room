/**
 * ticker-context-v1 orchestrator (on-demand ticker research, V1.2A).
 *
 * One supported US equity per request. Reuses the existing sealed provider
 * stack (delayed-SIP snapshots, SIP daily bars, Alpaca news, SEC submissions,
 * corporate actions) — no second transport, no duplicate provider client.
 *
 * Failure isolation: the market clock, snapshots, history, news, SEC and
 * corporate-action providers are each settled independently. A partial outage
 * yields `partial` with the available evidence; only a total loss of price AND
 * history yields `insufficient_data`; a provider-directory outage yields
 * `unavailable`. Demo mode never fabricates ticker data.
 */
import { DELAY_MINUTES, HISTORY_CALENDAR_BUFFER_DAYS } from "@/lib/breadth/constants";
import { barSessionDate, todayETKey } from "@/lib/breadth/dates";
import {
  normalizeBreadthSymbol,
  type AlpacaBreadthBar,
  type AlpacaBreadthSnapshot,
  type BreadthSymbolState,
} from "@/lib/breadth/normalize";
import type { MarketClock } from "@/lib/breadth/provider";
import { toProviderSymbol } from "./symbol";
import { computeAnomalyHistory } from "@/lib/anomalies/history-metrics";
import { resolveEffectiveTime } from "@/lib/anomalies/effective-time";
import { extractCandidateEvidence } from "@/lib/catalysts/candidate-evidence";
import { dedupeArticles } from "@/lib/catalysts/match";
import { classifyNews, secFormLabel } from "@/lib/catalysts/taxonomy";
import {
  computeCatalystWindow,
  inCatalystWindow,
  type CatalystWindow,
} from "@/lib/catalysts/time-window";
import type { CorporateActionEvidence, NewsArticle, SecFiling } from "@/lib/catalysts/types";
import {
  buildTickerEvidence,
  type TickerActionEvidence,
  type TickerNewsEvidence,
  type TickerSecEvidence,
} from "./evidence";
import { computeTickerMetrics } from "./metrics";
import type { TickerSectorContext } from "./sector";
import { classifyProviderAsset, normalizeTickerSymbol, type ProviderAsset } from "./symbol";
import {
  TICKER_CONTEXT_VERSION,
  type TickerIdentity,
  type TickerResearchContext,
  type TickerResearchResult,
} from "./types";

export interface TickerResearchDeps {
  mode: "demo" | "live";
  /** Injected clock (no Date.now inside the orchestrator). */
  now: () => number;
  /** Provider security directory (supported/unsupported/unknown). */
  lookupAsset: (
    providerSymbol: string,
  ) => Promise<{ ok: true; asset: ProviderAsset } | { ok: false; reason: "not_found" | "error" }>;
  fetchClock: () => Promise<MarketClock>;
  fetchSnapshots: (symbols: string[]) => Promise<Record<string, AlpacaBreadthSnapshot | undefined>>;
  fetchBars: (
    providerSymbol: string,
    startIso: string,
    endIso: string,
  ) => Promise<AlpacaBreadthBar[]>;
  resolveSector: (symbol: string) => TickerSectorContext | null;
  fetchNews: (
    symbol: string,
    window: CatalystWindow,
  ) => Promise<{ articles: NewsArticle[]; ok: boolean }>;
  resolveCik: (symbol: string) => Promise<string | null>;
  fetchFilings: (
    symbol: string,
    cik: string,
    window: CatalystWindow,
  ) => Promise<{ filings: SecFiling[]; ok: boolean }>;
  fetchActions: (
    symbol: string,
    window: CatalystWindow,
  ) => Promise<{ actions: CorporateActionEvidence[]; ok: boolean }>;
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function filingTimestamp(filing: SecFiling): string {
  return filing.acceptanceDateTime ?? (filing.filingDate ? `${filing.filingDate}T00:00:00Z` : "");
}

export async function researchTicker(
  rawSymbol: unknown,
  deps: TickerResearchDeps,
): Promise<TickerResearchResult> {
  const requested = typeof rawSymbol === "string" ? rawSymbol.trim() : "";
  const symbol = normalizeTickerSymbol(rawSymbol);
  if (symbol === null) {
    return {
      status: "unsupported_symbol",
      requestedSymbol: requested,
      symbol: null,
      reason: "unknown_symbol",
    };
  }
  if (deps.mode !== "live") {
    return {
      status: "unavailable",
      requestedSymbol: symbol,
      symbol: null,
      reason: "live_data_required",
      mode: "demo",
    };
  }

  const now = deps.now();
  const requestedAt = new Date(now).toISOString();
  const providerSymbol = toProviderSymbol(symbol);

  const lookup = await deps
    .lookupAsset(providerSymbol)
    .catch(() => ({ ok: false as const, reason: "error" as const }));
  if (!lookup.ok) {
    return lookup.reason === "not_found"
      ? {
          status: "unsupported_symbol",
          requestedSymbol: symbol,
          symbol: null,
          reason: "unknown_symbol",
        }
      : {
          status: "unavailable",
          requestedSymbol: symbol,
          symbol: null,
          reason: "provider_unavailable",
          mode: "live",
        };
  }
  const classified = classifyProviderAsset(symbol, lookup.asset);
  if (classified.kind === "not_found") {
    return {
      status: "unsupported_symbol",
      requestedSymbol: symbol,
      symbol: null,
      reason: "unknown_symbol",
    };
  }
  if (classified.kind === "unsupported") {
    return {
      status: "unsupported_symbol",
      requestedSymbol: symbol,
      symbol: null,
      reason: classified.reason,
    };
  }
  const identity: TickerIdentity = classified.identity;
  // No silent substitution: the provider directory must resolve to exactly the
  // requested symbol (share-class aliases are normalized before lookup).
  if (toProviderSymbol(identity.symbol) !== providerSymbol) {
    return {
      status: "unavailable",
      requestedSymbol: symbol,
      symbol: null,
      reason: "provider_unavailable",
      mode: "live",
    };
  }
  const canonical = identity.symbol;

  const sector = deps.resolveSector(canonical);
  const snapshotSymbols = sector ? [providerSymbol, sector.benchmarkEtf] : [providerSymbol];
  const [clock, snapshots] = await Promise.all([
    deps.fetchClock().catch(() => null),
    deps.fetchSnapshots(snapshotSymbols).catch(() => null),
  ]);
  const snapshot = snapshots?.[providerSymbol];
  const benchmarkSnapshot = sector ? snapshots?.[sector.benchmarkEtf] : undefined;

  const endIso = new Date(now - (DELAY_MINUTES + 1) * 60_000).toISOString();
  const startIso = new Date(now - HISTORY_CALENDAR_BUFFER_DAYS * 86_400_000).toISOString();
  const bars = await deps.fetchBars(providerSymbol, startIso, endIso).catch(() => null);

  return assembleContext({
    canonical,
    symbol,
    identity,
    clock,
    snapshot,
    benchmarkSnapshot,
    sector,
    bars,
    now,
    requestedAt,
    deps,
  });
}

async function assembleContext(input: {
  symbol: string;
  canonical: string;
  identity: TickerIdentity;
  clock: MarketClock | null;
  snapshot: AlpacaBreadthSnapshot | undefined;
  benchmarkSnapshot: AlpacaBreadthSnapshot | undefined;
  sector: TickerSectorContext | null;
  bars: AlpacaBreadthBar[] | null;
  now: number;
  requestedAt: string;
  deps: TickerResearchDeps;
}): Promise<TickerResearchResult> {
  const {
    symbol,
    canonical,
    identity,
    clock,
    snapshot,
    benchmarkSnapshot,
    sector,
    bars,
    now,
    requestedAt,
    deps,
  } = input;

  const marketOpen = clock?.isOpen ?? null;
  const barTimestamp = typeof snapshot?.dailyBar?.t === "string" ? snapshot.dailyBar.t : null;
  const tradeTimestamp =
    typeof snapshot?.latestTrade?.t === "string" ? snapshot.latestTrade.t : null;
  const tradePrice = num(snapshot?.latestTrade?.p);
  const sessionVolume = num(snapshot?.dailyBar?.v);
  const barDate = barSessionDate(barTimestamp ?? undefined);
  const today = todayETKey(now);
  // A completed regular session has comparable full-day volume; an open session
  // (or an unknown clock with today's forming bar) does not.
  const sessionCompleted =
    marketOpen === true ? false : marketOpen === false ? true : barDate !== null && barDate < today;

  const priceState: BreadthSymbolState | null = snapshot
    ? normalizeBreadthSymbol(canonical, snapshot, marketOpen, now)
    : null;
  const history = bars ? computeAnomalyHistory(bars, barDate ?? today) : null;
  const metrics = history
    ? computeTickerMetrics({
        history,
        price: priceState?.available ? priceState.refPrice : null,
        dailyChangePct: priceState?.available ? priceState.changePct : null,
        sessionVolume,
        sessionCompleted,
      })
    : null;
  const benchmarkState =
    sector && benchmarkSnapshot
      ? normalizeBreadthSymbol(sector.benchmarkEtf, benchmarkSnapshot, marketOpen, now)
      : null;

  // Effective price time uses the sealed anomaly-v1 semantics: closed/unknown
  // markets resolve to the ET regular-session close of the scored session
  // (Alpaca daily bars are stamped at session start, so the raw bar timestamp
  // must never be used as the price instant), open markets prefer real
  // provider timestamps. Never orchestration time.
  const effective = resolveEffectiveTime({
    isOpen: marketOpen,
    sessionKeys: [barDate],
    providerTimestamps: [tradeTimestamp, barTimestamp],
    generatedAtMs: now,
  });
  const effectiveAsOf = effective.effectiveAsOf ?? requestedAt;
  const window = computeCatalystWindow(effectiveAsOf, now);

  const [newsResult, cik, actionsResult] = await Promise.all([
    deps.fetchNews(canonical, window).catch(() => ({ articles: [] as NewsArticle[], ok: false })),
    deps.resolveCik(canonical).catch(() => null),
    deps
      .fetchActions(canonical, window)
      .catch(() => ({ actions: [] as CorporateActionEvidence[], ok: false })),
  ]);
  const secResult = cik
    ? await deps
        .fetchFilings(canonical, cik, window)
        .catch(() => ({ filings: [] as SecFiling[], ok: false }))
    : { filings: [] as SecFiling[], ok: false };

  const articles = dedupeArticles(newsResult.articles).filter(
    (article) =>
      article.symbols.some((item) => toProviderSymbol(item) === toProviderSymbol(canonical)) &&
      inCatalystWindow(article.publishedAt, window),
  );
  const newsEvidence: TickerNewsEvidence[] = [];
  for (const article of articles) {
    const extraction = extractCandidateEvidence({
      ticker: toProviderSymbol(canonical),
      companyName: identity.name,
      headline: article.headline,
      summary: article.summary,
      symbols: article.symbols.map(toProviderSymbol),
    });
    // Unrelated-company articles are excluded; unpromoted context is kept but
    // never labeled as a proven cause or a strong catalyst.
    if (!extraction.specific) continue;
    newsEvidence.push({
      id: article.id,
      headline: article.headline,
      source: article.source,
      publishedAt: article.publishedAt,
      url: article.url,
      category: classifyNews(`${article.headline} ${extraction.text}`),
      contextOnly: extraction.contextOnly,
    });
  }

  const secEvidence: TickerSecEvidence[] = secResult.filings
    .filter((filing) => inCatalystWindow(filingTimestamp(filing), window))
    .map((filing) => ({
      form: filing.form,
      formLabel: secFormLabel(filing.form),
      filingDate: filing.filingDate,
      acceptanceDateTime: filing.acceptanceDateTime,
      filingUrl: filing.filingUrl,
    }));
  const actionEvidence: TickerActionEvidence[] = actionsResult.actions.map((action) => ({
    type: action.type,
    date: action.date,
    description: action.description,
  }));

  const built = buildTickerEvidence({
    symbol: canonical,
    identity,
    clock,
    price: priceState,
    sessionVolume,
    barTimestamp,
    tradeTimestamp,
    tradePrice,
    effectiveAsOf,
    marketSessionAsOf: effective.sessionDate ?? barDate,
    metrics,
    sector: sector
      ? {
          sector: sector.sector,
          benchmarkEtf: sector.benchmarkEtf,
          benchmarkChangePct: benchmarkState?.available ? benchmarkState.changePct : null,
          classificationSource: sector.classificationSource,
        }
      : null,
    news: newsEvidence,
    newsOk: newsResult.ok,
    sec: secEvidence,
    secOk: secResult.ok,
    actions: actionEvidence,
    actionsOk: actionsResult.ok,
    eventWindow: { startIso: window.startIso, cutoffIso: window.cutoffIso },
    stale: isStale(snapshot, marketOpen, now),
    delayMinutes: DELAY_MINUTES,
  });

  const context: TickerResearchContext = {
    version: TICKER_CONTEXT_VERSION,
    status: built.status,
    requestedSymbol: symbol,
    symbol: canonical,
    identity,
    requestedAt,
    generatedAt: requestedAt,
    providerAsOf: built.providerAsOf,
    marketSessionAsOf: built.marketSessionAsOf,
    effectiveAsOf: built.effectiveAsOf,
    session: built.session,
    sources: built.sources,
    availability: built.availability,
    facts: built.facts,
    confidence: built.confidence,
    fingerprint: built.fingerprint,
  };
  return { status: built.status, context };
}

function isStale(
  snapshot: AlpacaBreadthSnapshot | undefined,
  marketOpen: boolean | null,
  now: number,
): boolean {
  if (marketOpen !== true) return false;
  const timestamp = snapshot?.latestTrade?.t;
  if (!timestamp) return true;
  const ms = Date.parse(timestamp);
  if (Number.isNaN(ms)) return true;
  return now - ms > (DELAY_MINUTES + 5) * 60_000;
}
