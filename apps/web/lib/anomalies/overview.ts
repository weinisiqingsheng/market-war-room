import "server-only";
import { MarketDataError } from "@/lib/market-data/errors";
import { getMarketDataConfig } from "@/lib/market-data/config";
import { DELAY_MINUTES, HISTORY_BATCH_SIZE } from "@/lib/breadth/constants";
import { withBreadthCache } from "@/lib/breadth/cache";
import {
  fetchAllDailyBars,
  fetchAllSnapshots,
  fetchMarketClock,
  type BreadthCredentials,
} from "@/lib/breadth/provider";
import {
  normalizeBreadthSymbol,
  type AlpacaBreadthSnapshot,
  type BreadthSymbolState,
} from "@/lib/breadth/normalize";
import { sp500Universe } from "@/lib/breadth/universe/sp500";
import {
  ANOMALY_CACHE_TTL_CLOCK_MS,
  ANOMALY_CACHE_TTL_HISTORY_MS,
  ANOMALY_CACHE_TTL_SNAPSHOTS_MS,
  HISTORY_ADJUSTMENT,
  HISTORY_CALENDAR_BUFFER_DAYS,
  TOP_DIRECTION_LIMIT,
  TOP_OVERALL_LIMIT,
} from "./constants";
import { anomalyHistoryEligible, computeAnomalyHistory } from "./history-metrics";
import { computeAnomalyMetrics, type AnomalyMetricDraft } from "./metrics";
import { ALL_SECTOR_ETFS, sectorEtfFor } from "./sector-map";
import { resolveEffectiveTime, snapshotPriceTimestamp } from "./effective-time";
import { barSessionDate } from "@/lib/breadth/dates";
import {
  anomalyConfidence,
  anomalySeverity,
  buildReasons,
  compareAnomalies,
  componentScores,
  dataCoverageOf,
  overallAnomalyScore,
  primaryTrigger,
} from "./score";
import type { AnomalyCandidate, AnomalyMeta, AnomalyOverview } from "./types";

const DAY_MS = 24 * 60 * 60_000;

function credentials(): BreadthCredentials {
  const market = getMarketDataConfig();
  if (market.mode !== "live" || !market.apiKeyId || !market.apiSecretKey) {
    throw new MarketDataError(
      "config",
      "ANOMALIES_MODE=live requires live market data + Alpaca credentials",
      503,
      "anomalies",
    );
  }
  return {
    apiKeyId: market.apiKeyId,
    apiSecretKey: market.apiSecretKey,
    dataBaseUrl: market.dataBaseUrl,
    tradingBaseUrl: market.tradingBaseUrl,
    timeoutMs: market.timeoutMs,
  };
}

function parseMs(iso: string): number | null {
  const parsed = Date.parse(iso);
  return Number.isNaN(parsed) ? null : parsed;
}

function buildCandidate(input: {
  member: (typeof sp500Universe.members)[number];
  state: BreadthSymbolState;
  snapshot: AlpacaBreadthSnapshot | undefined;
  sectorState: BreadthSymbolState | null;
  history: ReturnType<typeof computeAnomalyHistory>;
}): AnomalyCandidate | null {
  const { member, state, snapshot, sectorState, history } = input;
  if (!state.available || state.refPrice === null || !anomalyHistoryEligible(history)) return null;

  const sectorEtf = sectorEtfFor(member.sector) ?? "";
  const draft: AnomalyMetricDraft = computeAnomalyMetrics(state, snapshot, sectorState, history);
  const components = componentScores(draft);
  const overall = overallAnomalyScore(components);
  if (overall === null) return null;

  return {
    ticker: member.ticker,
    name: member.name,
    sector: member.sector,
    sectorEtf,
    price: state.refPrice,
    dailyMovePct: draft.dailyMovePct,
    direction: draft.direction,
    anomalyScore: overall,
    displayScore: Math.floor(overall + 0.5),
    severity: anomalySeverity(overall),
    primaryTrigger: primaryTrigger(components, draft) ?? "RETURN SHOCK",
    metrics: {
      returnSigma: draft.returnSigma ?? 0,
      sectorRelativePct: draft.sectorRelativePct,
      sectorRelativeSigma: draft.sectorRelativeSigma,
      gapPct: draft.gapPct,
      gapAtrRatio: draft.gapAtrRatio,
      rangeExpansionRatio: draft.rangeExpansionRatio,
      volumeParticipation: draft.volumeParticipation,
      breakout20: draft.breakout20,
      breakdown20: draft.breakdown20,
    },
    componentScores: components,
    reasons: buildReasons(draft, sectorEtf),
    dataCoverage: dataCoverageOf(components),
  };
}

export async function buildLiveAnomaliesOverview(): Promise<AnomalyOverview> {
  const creds = credentials();
  const now = Date.now();

  const clock = await withBreadthCache("anomalies:clock", ANOMALY_CACHE_TTL_CLOCK_MS, () =>
    fetchMarketClock(creds),
  );

  const requestSymbols = [
    ...sp500Universe.members.map((member) => member.ticker),
    ...ALL_SECTOR_ETFS,
  ];
  const snapshots = await withBreadthCache(
    "anomalies:snapshots:delayed_sip",
    ANOMALY_CACHE_TTL_SNAPSHOTS_MS,
    () => fetchAllSnapshots(creds, requestSymbols, 200),
  );

  const startIso = new Date(now - HISTORY_CALENDAR_BUFFER_DAYS * DAY_MS).toISOString();
  const endIso = new Date(now - (DELAY_MINUTES + 1) * 60_000).toISOString();
  const bars = await withBreadthCache(
    `anomalies:history:${HISTORY_ADJUSTMENT}:${startIso.slice(0, 10)}:${endIso.slice(0, 10)}`,
    ANOMALY_CACHE_TTL_HISTORY_MS,
    () =>
      fetchAllDailyBars(
        creds,
        requestSymbols,
        startIso,
        endIso,
        HISTORY_BATCH_SIZE,
        6,
        HISTORY_ADJUSTMENT,
      ),
  );

  const candidates: AnomalyCandidate[] = [];
  const sessionKeys: Array<string | null> = [];
  const providerTimestamps: Array<string | null> = [];
  for (const member of sp500Universe.members) {
    const snapshot = snapshots[member.ticker] as AlpacaBreadthSnapshot | undefined;
    const state = normalizeBreadthSymbol(member.ticker, snapshot, clock.isOpen, now);
    const sectorEtf = sectorEtfFor(member.sector);
    const sectorState = sectorEtf
      ? normalizeBreadthSymbol(
          sectorEtf,
          snapshots[sectorEtf] as AlpacaBreadthSnapshot | undefined,
          clock.isOpen,
          now,
        )
      : null;
    const history = computeAnomalyHistory(bars.get(member.ticker), state.sessionDate);
    const candidate = buildCandidate({ member, state, snapshot, sectorState, history });
    if (candidate) {
      candidates.push(candidate);
      const priceAsOf = snapshotPriceTimestamp(snapshot, clock.isOpen);
      if (priceAsOf) {
        candidate.priceAsOf = priceAsOf;
        providerTimestamps.push(priceAsOf);
        const session = barSessionDate(priceAsOf);
        if (session) sessionKeys.push(session);
      }
    }
  }

  const universeCount = sp500Universe.count;
  const coveragePct = universeCount > 0 ? candidates.length / universeCount : 0;
  const confidence = anomalyConfidence(coveragePct);
  const { generatedAt, effectiveAsOf, sessionDate } = resolveEffectiveTime({
    isOpen: clock.isOpen,
    sessionKeys,
    providerTimestamps,
    generatedAtMs: now,
  });
  const meta: AnomalyMeta = {
    provider: "alpaca",
    feed: "delayed_sip",
    delayMinutes: DELAY_MINUTES,
    asOf: effectiveAsOf ?? generatedAt,
    marketOpen: clock.isOpen,
    stale: staleFrom(snapshots, clock.isOpen, now),
    generatedAt,
    effectiveAsOf,
    sessionDate,
  };

  const sorted = [...candidates].sort(compareAnomalies);
  const publishable = confidence !== "insufficient";

  return {
    mode: "live",
    engineVersion: "anomaly-v1",
    universe: {
      name: sp500Universe.name,
      version: sp500Universe.version,
      asOf: sp500Universe.asOf,
      count: sp500Universe.count,
    },
    meta,
    universeCount,
    eligibleCount: candidates.length,
    scoredCount: candidates.length,
    coveragePct,
    confidence,
    topOverall: publishable ? sorted.slice(0, TOP_OVERALL_LIMIT) : [],
    topPositive: publishable
      ? sorted.filter((candidate) => candidate.direction === "up").slice(0, TOP_DIRECTION_LIMIT)
      : [],
    topNegative: publishable
      ? sorted.filter((candidate) => candidate.direction === "down").slice(0, TOP_DIRECTION_LIMIT)
      : [],
    asOf: effectiveAsOf ?? generatedAt,
  };
}

function staleFrom(
  snapshots: Record<string, AlpacaBreadthSnapshot | undefined>,
  marketOpen: boolean | null,
  now: number,
): boolean {
  if (marketOpen !== true) return false;
  let newest = 0;
  for (const value of Object.values(snapshots)) {
    const ts = value?.latestTrade?.t;
    if (ts) {
      const ms = parseMs(ts);
      if (ms !== null && ms > newest) newest = ms;
    }
  }
  if (newest === 0) return true;
  return now - newest > (DELAY_MINUTES + 5) * 60_000;
}
