import "server-only";
import type { ShortTermShadowRecord } from "../shadow/types";
import {
  PROSPECTIVE_DECISION_VERSION,
  PROSPECTIVE_PROTOCOL_VERSION,
  type FrozenProspectiveDecision,
  type ProspectiveHorizon,
} from "./types";

function deepFreeze<T>(value: T): T {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  return value;
}

function numericFact(record: ShortTermShadowRecord, key: string): number | null {
  const fact = record.sanitizedState.facts.find((item) => item.domain === "price");
  const value = fact?.values[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function assertIso(value: string, label: string): void {
  if (!Number.isFinite(Date.parse(value))) throw new Error(`${label} must be a valid timestamp.`);
}

export function freezeProspectiveDecision(
  record: ShortTermShadowRecord,
  horizon: ProspectiveHorizon,
  options: { allowFixtureInput?: boolean } = {},
): FrozenProspectiveDecision {
  if (
    record.marketInputStatus !== "verified_market_input" &&
    !(options.allowFixtureInput && record.marketInputStatus === "fixture_market_input")
  )
    throw new Error("Prospective decision requires verified market input.");
  if (!record.sanitizedState.availability.price)
    throw new Error("Prospective decision requires an available price.");
  if (!record.sanitizedState.effectiveAsOf)
    throw new Error("Prospective decision requires an effective timestamp.");
  if (!record.sanitizedState.marketSessionAsOf)
    throw new Error("Prospective decision requires a market session date.");
  if (!record.sanitizedState.feed)
    throw new Error("Prospective decision requires feed provenance.");
  if (!Number.isFinite(record.sanitizedState.delayMinutes ?? 0))
    throw new Error("Prospective decision delay metadata is invalid.");
  if (record.sanitizedState.freshness !== "fresh" && record.sanitizedState.freshness !== "delayed")
    throw new Error("Prospective decision freshness is invalid.");
  if (
    !record.sanitizedState.marketSessionStatus ||
    record.sanitizedState.marketSessionStatus === "unknown"
  )
    throw new Error("Prospective decision market session is invalid.");

  const referencePrice = numericFact(record, "price");
  if (referencePrice === null || referencePrice <= 0)
    throw new Error("Prospective decision requires a structured reference price.");
  const previousClose = numericFact(record, "previousClose");
  assertIso(record.requestedAt, "requestedAt");
  assertIso(record.sanitizedState.effectiveAsOf, "effectiveAsOf");

  const decision: FrozenProspectiveDecision = {
    schemaVersion: PROSPECTIVE_DECISION_VERSION,
    runId: record.runId,
    ticker: record.ticker,
    marketInputStatus: record.marketInputStatus,
    identity: {
      symbol: record.sanitizedState.symbol,
      ...record.sanitizedState.security,
    },
    strategyId: record.strategyId,
    horizon,
    requestedAt: record.requestedAt,
    effectiveAsOf: record.sanitizedState.effectiveAsOf,
    marketSessionDate: record.sanitizedState.marketSessionAsOf,
    marketSessionStatus: record.sanitizedState.marketSessionStatus,
    referencePrice,
    previousClose,
    feed: record.sanitizedState.feed,
    delayMinutes: record.sanitizedState.delayMinutes,
    freshness: record.sanitizedState.freshness,
    availability: { ...record.sanitizedState.availability },
    stateFingerprint: record.stateFingerprint,
    sourceFingerprint: record.sanitizedState.provenance.sourceFingerprint,
    inputContractVersion: record.inputContractVersion,
    questionSetVersion: record.questionSetVersion,
    pinnedModel: record.pinnedModel,
    protocolVersion: PROSPECTIVE_PROTOCOL_VERSION,
    deterministicBaseline: "flat",
    assessment: {
      answers: record.answers,
      usage: record.usage,
      latencyMs: record.latencyMs,
      resultStatus: record.resultStatus,
      modelOutputStatus: record.modelOutputStatus,
    },
  };
  return deepFreeze(structuredClone(decision));
}
