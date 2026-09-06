/**
 * Market Breadth domain types (S&P 500 delayed-SIP breadth engine).
 *
 * Breadth is a domain-data transformation that lives in Next.js. Scoring is
 * deterministic and engine-versioned (`breadth-v1`) — it does not touch the
 * regime-v1 engine (a future regime-v2 integration is documented, not built).
 */
import type { MarketDataMode } from "@war-room/types";

export const BREADTH_ENGINE_VERSION = "breadth-v1";

export type BreadthConfidence = "high" | "medium" | "low" | "insufficient";

export type BreadthFeedLabel = "delayed_sip";

/** Deterministic participation-state keys produced by score.ts rules. */
export type BreadthStateKey =
  "BROAD_RALLY" | "NARROW_RALLY" | "BROAD_SELLOFF" | "INTERNAL_RESILIENCE" | "MIXED_PARTICIPATION";

export interface BreadthState {
  key: BreadthStateKey;
  label: string;
}

export interface BreadthUniverseInfo {
  name: "S&P 500";
  version: string;
  asOf: string;
  count: number;
}

export interface BreadthMeta {
  provider: "alpaca";
  feed: BreadthFeedLabel;
  /** Delayed-SIP entitlement delay in minutes (Alpaca Basic). */
  delayMinutes: number;
  asOf: string | null;
  marketOpen: boolean | null;
}

export interface BreadthMetrics {
  universeCount: number;
  currentCoverageCount: number;
  historical20CoverageCount: number;
  historical50CoverageCount: number;
  coveragePct: number;
  advancers: number;
  decliners: number;
  unchanged: number;
  /** advancers / (advancers + decliners); 0–1. Null when no valid movers. */
  advanceRatio: number | null;
  above20Pct: number | null;
  above50Pct: number | null;
  newHighs20: number;
  newLows20: number;
}

export interface BreadthOverview {
  mode: MarketDataMode;
  score: number | null;
  displayScore: number | null;
  engineVersion: string;
  state: BreadthState;
  metrics: BreadthMetrics;
  universe: BreadthUniverseInfo;
  meta: BreadthMeta;
  confidence: BreadthConfidence;
}
