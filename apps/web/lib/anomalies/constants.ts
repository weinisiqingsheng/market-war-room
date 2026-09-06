/**
 * anomaly-v1 constants — every threshold/weight/floor is centralized here.
 */
import {
  DELAY_MINUTES,
  HISTORY_CALENDAR_BUFFER_DAYS,
  HISTORY_BATCH_SIZE,
} from "@/lib/breadth/constants";

export const ANOMALY_CACHE_TTL_SNAPSHOTS_MS = 60_000;
export const ANOMALY_CACHE_TTL_HISTORY_MS = 30 * 60_000;
export const ANOMALY_CACHE_TTL_CLOCK_MS = 15_000;

/** Minimum completed sessions for history-based anomaly metrics. */
export const MIN_HISTORY_SESSIONS = 20;
/** History request window (matches breadth buffer for ~65 completed sessions). */
export { HISTORY_CALENDAR_BUFFER_DAYS };
export { HISTORY_BATCH_SIZE };
export { DELAY_MINUTES };

/** Centralized volatility floor (%) used by return-shock and sector-divergence. */
export const VOLATILITY_FLOOR_PCT = 0.5;
/** Centralized floor for ATR-based gap normalization. */
export const ATR_PCT_FLOOR = 0.2;

export const SCORE_WEIGHTS = {
  returnShock: 0.35,
  sectorDivergence: 0.2,
  gapShock: 0.15,
  rangeExpansion: 0.15,
  volumeParticipation: 0.1,
  breakout: 0.05,
} as const;

// (sigma, score) piecewise maps.
export const RETURN_SIGMA_POINTS: ReadonlyArray<readonly [number, number]> = [
  [0, 0],
  [1, 25],
  [2, 60],
  [3, 85],
  [4, 100],
];
export const SECTOR_SIGMA_POINTS: ReadonlyArray<readonly [number, number]> = [
  [0, 0],
  [0.5, 20],
  [1, 40],
  [2, 75],
  [3, 100],
];
export const GAP_ATR_POINTS: ReadonlyArray<readonly [number, number]> = [
  [0, 0],
  [0.5, 30],
  [1, 60],
  [2, 100],
];
export const RANGE_POINTS: ReadonlyArray<readonly [number, number]> = [
  [0, 0],
  [0.5, 10],
  [1, 40],
  [1.5, 70],
  [2, 100],
];
export const VOLUME_POINTS: ReadonlyArray<readonly [number, number]> = [
  [0, 0],
  [0.3, 0],
  [0.6, 20],
  [1, 45],
  [1.5, 70],
  [2.5, 100],
];

/** Severity boundaries (upper bucket owns the boundary). */
export const SEVERITY_EXTREME = 80;
export const SEVERITY_HIGH = 65;
export const SEVERITY_ELEVATED = 50;

/** Confidence bands on eligible/scanner coverage. */
export const CONFIDENCE_HIGH = 0.95;
export const CONFIDENCE_MEDIUM = 0.85;
export const CONFIDENCE_LOW = 0.7;

/** Ranking list limits. */
export const TOP_OVERALL_LIMIT = 8;
export const TOP_DIRECTION_LIMIT = 5;

export const HISTORY_ADJUSTMENT = "split" as const;
