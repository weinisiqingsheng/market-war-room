import type { MarketFeed, NormalizedMarketSnapshot, PriceSource, Tone } from "@war-room/types";

/* ── Field guards ────────────────────────────────────────────────────────
   Upstream provider fields are untrusted: guard every value we read.        */

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

/* ── Alpaca raw shapes (only the fields we actually use) ───────────────── */

interface AlpacaBar {
  t?: string;
  o?: number;
  h?: number;
  l?: number;
  c?: number;
  v?: number;
}

interface AlpacaTrade {
  t?: string;
  p?: number;
  s?: number;
}

export interface AlpacaSymbolSnapshot {
  latestTrade?: AlpacaTrade;
  minuteBar?: AlpacaBar;
  dailyBar?: AlpacaBar;
  prevDailyBar?: AlpacaBar;
}

/* ── Snapshot normalization ───────────────────────────────────────────────
   Deterministic price priority:
   1. latestTrade.price
   2. latest minute bar close
   3. daily bar close
   4. unavailable

   Never invent values — anything missing is null and `available: false`.    */

function buildUnavailable(symbol: string, feed: MarketFeed): NormalizedMarketSnapshot {
  return {
    symbol,
    price: null,
    previousClose: null,
    open: null,
    high: null,
    low: null,
    change: null,
    changePct: null,
    volume: null,
    timestamp: null,
    source: "unavailable",
    feed,
    stale: false,
    available: false,
  };
}

export function normalizeAlpacaSnapshot(
  symbol: string,
  raw: AlpacaSymbolSnapshot | null | undefined,
  feed: MarketFeed,
): NormalizedMarketSnapshot {
  if (!raw || typeof raw !== "object") return buildUnavailable(symbol, feed);

  const latestTradePrice = num(raw.latestTrade?.p);
  const minuteClose = num(raw.minuteBar?.c);
  const dailyClose = num(raw.dailyBar?.c);

  let price: number | null;
  let source: PriceSource;
  if (latestTradePrice !== null) {
    price = latestTradePrice;
    source = "latest_trade";
  } else if (minuteClose !== null) {
    price = minuteClose;
    source = "minute_bar";
  } else if (dailyClose !== null) {
    price = dailyClose;
    source = "daily_bar";
  } else {
    return buildUnavailable(symbol, feed);
  }

  const previousClose = num(raw.prevDailyBar?.c);
  // previousClose === 0 is not a meaningful base — guard division and set null.
  const hasBase = previousClose !== null && previousClose !== 0;

  return {
    symbol,
    price,
    previousClose,
    open: num(raw.dailyBar?.o),
    high: num(raw.dailyBar?.h),
    low: num(raw.dailyBar?.l),
    change: hasBase ? price - previousClose : null,
    changePct: hasBase ? ((price - previousClose) / previousClose) * 100 : null,
    volume: num(raw.dailyBar?.v) ?? num(raw.latestTrade?.s),
    timestamp: str(raw.latestTrade?.t) ?? str(raw.minuteBar?.t) ?? str(raw.dailyBar?.t),
    source,
    feed,
    stale: false,
    available: true,
  };
}

/* ── Derived calculations (domain-level, provider-independent) ─────────── */

/** Day position in the session range, clamped 0–1. Null if any input missing. */
export function computeDayPosition(
  price: number | null,
  low: number | null,
  high: number | null,
): number | null {
  if (price === null || low === null || high === null) return null;
  if (high === low) return 0; // degenerate range — no division by zero
  return Math.min(1, Math.max(0, (price - low) / (high - low)));
}

/** Sector relative return vs the market benchmark (SPY). Null if either missing. */
export function computeRelativeReturn(
  sectorChangePct: number | null,
  benchmarkChangePct: number | null,
): number | null {
  if (sectorChangePct === null || benchmarkChangePct === null) return null;
  return sectorChangePct - benchmarkChangePct;
}

/**
 * Deterministic sector signal label + tone from relative return thresholds.
 * Intentionally simple and explainable — no ML.
 */
export function classifySectorSignal(relativeReturnPct: number | null): {
  signal: string;
  tone: Tone;
} {
  if (relativeReturnPct === null) return { signal: "Unavailable", tone: "neutral" };
  if (relativeReturnPct >= 1.0) return { signal: "Leader", tone: "positive" };
  if (relativeReturnPct >= 0.4) return { signal: "Strong", tone: "positive" };
  if (relativeReturnPct >= 0) return { signal: "Firm", tone: "positive" };
  if (relativeReturnPct >= -0.4) return { signal: "Neutral", tone: "neutral" };
  if (relativeReturnPct >= -1.0) return { signal: "Weak", tone: "negative" };
  return { signal: "Laggard", tone: "negative" };
}

/**
 * Strength bar 0–100 from relative return (percent), linear and documented:
 *   strength = clamp(50 + relativeReturn * 10, 5, 95)
 * 10 points per 1% relative outperformance; baseline 50 at parity with SPY.
 */
export function computeSectorStrength(relativeReturnPct: number | null): number | null {
  if (relativeReturnPct === null) return null;
  const raw = 50 + relativeReturnPct * 10;
  return Math.min(95, Math.max(5, raw));
}

/**
 * Stale detection. A snapshot is stale only while the market is OPEN and the
 * newest relevant timestamp is older than the configured threshold. Closed
 * (or unknown) sessions are never marked stale just because the latest trade
 * happened at the prior close.
 */
export function computeStale(params: {
  maxTimestamp: string | null;
  marketOpen: boolean | null;
  now: number;
  thresholdMs: number;
}): boolean {
  const { maxTimestamp, marketOpen, now, thresholdMs } = params;
  if (marketOpen !== true) return false;
  if (maxTimestamp === null) return true; // open but nothing timestamped
  const parsed = Date.parse(maxTimestamp);
  if (Number.isNaN(parsed)) return true;
  return now - parsed > thresholdMs;
}
