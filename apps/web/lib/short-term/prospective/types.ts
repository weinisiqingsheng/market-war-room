import type { ShortTermShadowRecord } from "../shadow/types";

export const PROSPECTIVE_DECISION_VERSION = "short-term-prospective-decision-v1" as const;
export const PROSPECTIVE_OUTCOME_VERSION = "short-term-prospective-outcome-v2" as const;
export const PROSPECTIVE_PROTOCOL_VERSION = "short-term-prospective-protocol-v1" as const;

export type ProspectiveHorizon = "one_hour" | "session_close" | "next_session_close";
export type ProspectiveOutcomeLabel = "up" | "flat" | "down" | "not_observable";

export interface FrozenProspectiveDecision {
  schemaVersion: typeof PROSPECTIVE_DECISION_VERSION;
  runId: string;
  ticker: string;
  marketInputStatus: "verified_market_input" | "fixture_market_input";
  identity: ShortTermShadowRecord["sanitizedState"]["security"] & { symbol: string };
  strategyId: string;
  horizon: ProspectiveHorizon;
  requestedAt: string;
  effectiveAsOf: string;
  marketSessionDate: string;
  marketSessionStatus: "regular" | "closed";
  referencePrice: number;
  previousClose: number | null;
  feed: string;
  delayMinutes: number | null;
  freshness: "fresh" | "delayed";
  availability: ShortTermShadowRecord["sanitizedState"]["availability"];
  stateFingerprint: string;
  sourceFingerprint: string;
  inputContractVersion: string;
  questionSetVersion: string;
  pinnedModel: string;
  protocolVersion: typeof PROSPECTIVE_PROTOCOL_VERSION;
  deterministicBaseline: "flat";
  assessment: {
    answers: ShortTermShadowRecord["answers"];
    usage: ShortTermShadowRecord["usage"];
    latencyMs: number;
    resultStatus: string;
    modelOutputStatus: ShortTermShadowRecord["modelOutputStatus"];
  };
}

export interface ProspectiveOutcomeRecord {
  schemaVersion: typeof PROSPECTIVE_OUTCOME_VERSION;
  runId: string;
  ticker: string;
  stateFingerprint: string;
  horizon: ProspectiveHorizon;
  decisionEffectiveAsOf: string;
  referencePrice: number;
  observedPrice: number | null;
  observedAt: string | null;
  sessionDate: string | null;
  provider: string | null;
  feed: string | null;
  delayMinutes: number | null;
  freshness: "fresh" | "delayed" | "stale" | "unavailable";
  availability: "available" | "unavailable";
  priceReferenceType: "daily_bar_close_split_adjusted" | "fixture_close" | "unknown";
  sourceVersion: string | null;
  sourceFingerprint: string | null;
  completeness: "complete" | "partial" | "unavailable";
  returnPct: number | null;
  label: ProspectiveOutcomeLabel;
  reason: string | null;
}

export interface ProspectiveSessionWindow {
  sessionDate: string;
  openAt: string;
  closeAt: string;
  regular: boolean;
  earlyClose: boolean;
}

export interface ProspectiveSessionCalendar {
  sessionFor(date: string): ProspectiveSessionWindow | null;
  nextSessionAfter(date: string): ProspectiveSessionWindow | null;
  containsRegularInstant(window: ProspectiveSessionWindow, instant: string): boolean;
}

export interface ProspectiveObservationCandidate {
  ticker: string;
  stateFingerprint: string;
  observedAt: string;
  sessionDate: string;
  price: number | null;
  provider: string | null;
  feed: string | null;
  freshness: "fresh" | "delayed" | "stale" | "unavailable";
  availability: "available" | "unavailable";
  delayMinutes: number | null;
  priceReferenceType: "daily_bar_close_split_adjusted" | "fixture_close" | "unknown";
  sourceVersion: string | null;
  sourceFingerprint: string | null;
  completeness: "complete" | "partial" | "unavailable";
  regularSession: boolean;
  halted: boolean;
}
