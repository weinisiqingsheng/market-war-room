/**
 * Breadth engine constants — every threshold/weight/cadence is centralized.
 *
 * The S&P 500 universe is version-controlled (`lib/breadth/universe/sp500.ts`)
 * and never scraped at runtime.
 */

/** Data feed semantics (Alpaca Basic). */
export const SNAPSHOT_FEED = "delayed_sip" as const;
export const HISTORY_FEED = "sip" as const;
export const DELAY_MINUTES = 15;

/** Classify a move as flat when |changePct| is at or below this epsilon. */
export const CHANGE_EPSILON_PCT = 0.001;

/** Batch sizes / request boundaries. */
export const SNAPSHOT_BATCH_SIZE = 200;
export const HISTORY_BATCH_SIZE = 100;
/** ~70 trading sessions guarantee ≥50 completed sessions across holidays. */
export const HISTORY_TARGET_SESSIONS = 70;
export const HISTORY_CALENDAR_BUFFER_DAYS = 160;

export const MA20_WINDOW = 20;
export const MA50_WINDOW = 50;
export const NEW_HIGH_LOW_WINDOW = 20;

/** Score weights (breadth-v1). */
export const SCORE_WEIGHTS = {
  advance: 0.35,
  above20: 0.25,
  above50: 0.25,
  highLow: 0.15,
} as const;

/** Advance-ratio mapping points: (ratio, score). */
export const ADVANCE_RATIO_POINTS: ReadonlyArray<readonly [number, number]> = [
  [0.3, 0],
  [0.4, 25],
  [0.5, 50],
  [0.6, 75],
  [0.7, 100],
];

/** Above-MA mapping points (same curve for 20D and 50D). */
export const ABOVE_MA_POINTS: ReadonlyArray<readonly [number, number]> = [
  [0.2, 0],
  [0.35, 25],
  [0.5, 50],
  [0.65, 75],
  [0.8, 100],
];

/** Confidence bands on current coverage. */
export const CONFIDENCE_HIGH = 0.95;
export const CONFIDENCE_MEDIUM = 0.85;
export const CONFIDENCE_LOW = 0.7;
// Below CONFIDENCE_LOW the engine refuses to publish a numeric score.

/** Cache cadences (no Redis in this phase). */
export const SNAPSHOT_CACHE_MS = 60_000; // delayed-SIP current breadth
export const HISTORY_CACHE_MS = 30 * 60_000; // 20D/50D historical metrics
export const MARKET_CLOCK_CACHE_MS = 15_000;

/** SPY is the benchmark used to classify participation direction. */
export const BENCHMARK_TICKER = "SPY";
