import "server-only";
import { MarketDataError } from "@/lib/market-data/errors";
import { BREADTH_CACHE_TTL_MS, resetBreadthCachesForTests, withBreadthCache } from "./cache";
import {
  DELAY_MINUTES,
  HISTORY_BATCH_SIZE,
  HISTORY_CALENDAR_BUFFER_DAYS,
  SNAPSHOT_BATCH_SIZE,
} from "./constants";
import { computeSymbolHistory, type SymbolHistory } from "./history";
import { aggregateBreadth } from "./metrics";
import {
  normalizeBreadthSymbol,
  type AlpacaBreadthSnapshot,
  type BreadthSymbolState,
} from "./normalize";
import {
  fetchAllDailyBars,
  fetchAllSnapshots,
  fetchMarketClock,
  type BreadthCredentials,
} from "./provider";
import { breadthConfidence, classifyParticipation, computeBreadthScore } from "./score";
import { getBreadthDataConfig, type BreadthDataConfig } from "./config";
import { getUniverseTickers } from "./symbols";
import type { BreadthMeta, BreadthMetrics, BreadthOverview } from "./types";
import { sp500Universe } from "./universe/sp500";

export { resetBreadthCachesForTests };

const DAY_MS = 24 * 60 * 60_000;
const historyBySymbol = new Map<string, SymbolHistory>();

function credentialsFrom(config: BreadthDataConfig): BreadthCredentials {
  if (!config.apiKeyId || !config.apiSecretKey) {
    throw new MarketDataError(
      "config",
      "Breadth live mode requires Alpaca credentials",
      503,
      "breadth",
    );
  }
  return {
    apiKeyId: config.apiKeyId,
    apiSecretKey: config.apiSecretKey,
    dataBaseUrl: config.dataBaseUrl,
    tradingBaseUrl: config.tradingBaseUrl,
    timeoutMs: config.timeoutMs,
  };
}

/**
 * Server-side breadth orchestration (S&P 500, delayed-SIP Alpaca).
 *
 * Provider access stays in Next.js (Alpaca); scoring is a pure domain-data
 * transformation here in `lib/breadth` — no Python dependency for breadth.
 */
export async function buildLiveBreadthOverview(): Promise<BreadthOverview> {
  const config = getBreadthDataConfig();
  const creds = credentialsFrom(config);
  const now = Date.now();

  // 1. Market clock (cached 15s) determines whether today's bar is forming.
  const clock = await withBreadthCache("breadth:clock", BREADTH_CACHE_TTL_MS.clock, () =>
    fetchMarketClock(creds),
  );

  // 2. Current delayed-SIP snapshots (cached ~60s), batched multi-symbol.
  const universeTickers = getUniverseTickers();
  const requestSymbols = [...universeTickers, "SPY"];
  const snapshots = await withBreadthCache(
    "breadth:snapshots:delayed_sip",
    BREADTH_CACHE_TTL_MS.snapshots,
    () => fetchAllSnapshots(creds, requestSymbols, SNAPSHOT_BATCH_SIZE),
  );

  // 3. Historical 1Day bars (cached ~30 min) for SMA20/SMA50 and 20D range.
  //    Basic entitlement: never request history inside the ~15 min restricted
  //    recent-SIP window — `end` is set safely before that boundary.
  const startIso = new Date(now - HISTORY_CALENDAR_BUFFER_DAYS * DAY_MS).toISOString();
  const safeDelayMs = (DELAY_MINUTES + 1) * 60_000;
  const endIso = new Date(now - safeDelayMs).toISOString();
  const bars = await withBreadthCache(
    `breadth:history:${startIso.slice(0, 10)}:${endIso.slice(0, 10)}`,
    BREADTH_CACHE_TTL_MS.history,
    () => fetchAllDailyBars(creds, universeTickers, startIso, endIso, HISTORY_BATCH_SIZE),
  );

  // 4. Normalize current session + completed-history per constituent.
  const states: BreadthSymbolState[] = universeTickers.map((ticker) => {
    const raw = snapshots[ticker];
    const state = normalizeBreadthSymbol(
      ticker,
      raw as AlpacaBreadthSnapshot | undefined,
      clock.isOpen,
      now,
    );
    const history: SymbolHistory = computeSymbolHistory(bars.get(ticker), state.sessionDate);
    historyBySymbol.set(ticker, history);
    return state;
  });

  const spyState = normalizeBreadthSymbol(
    "SPY",
    snapshots["SPY"] as AlpacaBreadthSnapshot | undefined,
    clock.isOpen,
    now,
  );

  // 5. Aggregate metrics.
  const aggregate = aggregateBreadth(states, historyBySymbol, universeTickers.length);

  const metrics: BreadthMetrics = {
    universeCount: aggregate.universeCount,
    currentCoverageCount: aggregate.currentCoverageCount,
    historical20CoverageCount: aggregate.historical20CoverageCount,
    historical50CoverageCount: aggregate.historical50CoverageCount,
    coveragePct: aggregate.coveragePct,
    advancers: aggregate.advancers,
    decliners: aggregate.decliners,
    unchanged: aggregate.unchanged,
    advanceRatio: aggregate.advanceRatio,
    above20Pct: aggregate.above20Pct,
    above50Pct: aggregate.above50Pct,
    newHighs20: aggregate.newHighs20,
    newLows20: aggregate.newLows20,
  };

  const confidence = breadthConfidence(aggregate.coveragePct);
  const sufficient = confidence !== "insufficient";
  const rawScore = computeBreadthScore({
    advanceRatio: aggregate.advanceRatio,
    above20Pct: aggregate.above20Pct,
    above50Pct: aggregate.above50Pct,
    newHighs20: aggregate.newHighs20,
    newLows20: aggregate.newLows20,
  });

  const state = classifyParticipation({
    spyChangePct: spyState.changePct,
    advanceRatio: aggregate.advanceRatio,
    above20Pct: aggregate.above20Pct,
  });

  const score = sufficient && rawScore !== null ? rawScore : null;
  const meta: BreadthMeta = {
    provider: "alpaca",
    feed: "delayed_sip",
    delayMinutes: DELAY_MINUTES,
    asOf: clock.timestamp ?? new Date(now).toISOString(),
    marketOpen: clock.isOpen,
  };

  return {
    mode: "live",
    score,
    displayScore: score === null ? null : Math.floor(score + 0.5),
    engineVersion: "breadth-v1",
    state,
    metrics,
    universe: {
      name: sp500Universe.name,
      version: sp500Universe.version,
      asOf: sp500Universe.asOf,
      count: sp500Universe.count,
    },
    meta,
    confidence,
  };
}
