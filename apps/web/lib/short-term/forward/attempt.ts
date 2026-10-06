import "server-only";
import { createHash } from "node:crypto";

export const ATTEMPT_SCHEMA_VERSION = "short-term-forward-attempt-v1" as const;

export type ForwardAttemptLifecycleStatus =
  | "ATTEMPT_STARTED"
  | "MARKET_INPUT_UNAVAILABLE"
  | "MARKET_INPUT_STALE"
  | "SESSION_NOT_ELIGIBLE"
  | "JEV_TRANSPORT_FAILED"
  | "JEV_VALIDATION_FAILED"
  | "BUDGET_BLOCKED"
  | "STORAGE_FAILED"
  | "PREDICTION_CREATED";

export type ForwardAttemptFailureCategory =
  | "market_input_unavailable"
  | "market_input_stale"
  | "session_not_eligible"
  | "provider_failure"
  | "validation_failure"
  | "budget_failure"
  | "storage_failure";

export interface ForwardExperimentAttempt {
  schemaVersion: typeof ATTEMPT_SCHEMA_VERSION;
  eventId: string;
  attemptId: string;
  sequence: number;
  requestedAt: string;
  ticker: string;
  taskId: string;
  taskVersion: string;
  questionSetVersion: string;
  marketDataPolicyVersion: string;
  intendedTargetSession: string | null;
  lifecycleStatus: ForwardAttemptLifecycleStatus;
  failureCategory?: ForwardAttemptFailureCategory;
  providerRequestCount: number;
  jevRequestCount: number;
  predictionRecordCreated: boolean;
  linkedPredictionRunId?: string;
  safeErrorCategory?: string;
  model?: string;
  inputFingerprint?: string;
  stateFingerprint?: string;
}

const statuses = new Set<ForwardAttemptLifecycleStatus>([
  "ATTEMPT_STARTED",
  "MARKET_INPUT_UNAVAILABLE",
  "MARKET_INPUT_STALE",
  "SESSION_NOT_ELIGIBLE",
  "JEV_TRANSPORT_FAILED",
  "JEV_VALIDATION_FAILED",
  "BUDGET_BLOCKED",
  "STORAGE_FAILED",
  "PREDICTION_CREATED",
]);
const failureCategories = new Set<ForwardAttemptFailureCategory>([
  "market_input_unavailable",
  "market_input_stale",
  "session_not_eligible",
  "provider_failure",
  "validation_failure",
  "budget_failure",
  "storage_failure",
]);

function timestamp(value: string): void {
  if (!Number.isFinite(Date.parse(value))) throw new Error("Invalid attempt requestedAt");
}

function nonNegativeInteger(value: number, name: string): void {
  if (!Number.isInteger(value) || value < 0) throw new Error(`Invalid attempt ${name}`);
}

function optionalFingerprint(value: string | undefined, name: string): void {
  if (value !== undefined && !/^[a-f0-9]{64}$/i.test(value))
    throw new Error(`Invalid attempt ${name} fingerprint`);
}

export function assertForwardExperimentAttempt(
  value: unknown,
): asserts value is ForwardExperimentAttempt {
  if (!value || typeof value !== "object") throw new Error("Malformed forward attempt");
  const record = value as Partial<ForwardExperimentAttempt>;
  const sequence = record.sequence;
  if (
    record.schemaVersion !== ATTEMPT_SCHEMA_VERSION ||
    typeof record.eventId !== "string" ||
    !record.eventId ||
    typeof record.attemptId !== "string" ||
    !record.attemptId ||
    typeof sequence !== "number" ||
    !Number.isInteger(sequence) ||
    sequence < 1 ||
    typeof record.requestedAt !== "string" ||
    typeof record.ticker !== "string" ||
    !record.ticker ||
    typeof record.taskId !== "string" ||
    typeof record.taskVersion !== "string" ||
    typeof record.questionSetVersion !== "string" ||
    typeof record.marketDataPolicyVersion !== "string" ||
    (record.intendedTargetSession !== null && typeof record.intendedTargetSession !== "string") ||
    typeof record.lifecycleStatus !== "string" ||
    !statuses.has(record.lifecycleStatus as ForwardAttemptLifecycleStatus) ||
    typeof record.providerRequestCount !== "number" ||
    typeof record.jevRequestCount !== "number" ||
    typeof record.predictionRecordCreated !== "boolean"
  )
    throw new Error("Malformed forward attempt");
  timestamp(record.requestedAt);
  nonNegativeInteger(record.providerRequestCount, "providerRequestCount");
  nonNegativeInteger(record.jevRequestCount, "jevRequestCount");
  optionalFingerprint(record.inputFingerprint, "input");
  optionalFingerprint(record.stateFingerprint, "state");
  if (
    record.failureCategory !== undefined &&
    (typeof record.failureCategory !== "string" ||
      !failureCategories.has(record.failureCategory as ForwardAttemptFailureCategory))
  )
    throw new Error("Malformed forward attempt failure category");
  const expectedEventId = createHash("sha256")
    .update(`${record.attemptId}:${sequence}:${record.lifecycleStatus}`)
    .digest("hex");
  if (record.eventId !== expectedEventId) throw new Error("Invalid forward attempt event identity");
}

export function buildForwardExperimentAttempt(input: {
  attemptId: string;
  sequence: number;
  requestedAt: string;
  ticker: string;
  taskId: string;
  taskVersion: string;
  questionSetVersion: string;
  marketDataPolicyVersion: string;
  intendedTargetSession: string | null;
  lifecycleStatus: ForwardAttemptLifecycleStatus;
  failureCategory?: ForwardAttemptFailureCategory;
  providerRequestCount: number;
  jevRequestCount: number;
  predictionRecordCreated: boolean;
  linkedPredictionRunId?: string;
  safeErrorCategory?: string;
  model?: string;
  inputFingerprint?: string;
  stateFingerprint?: string;
}): ForwardExperimentAttempt {
  if (!input.attemptId) throw new Error("Attempt ID is required");
  if (!statuses.has(input.lifecycleStatus)) throw new Error("Unknown attempt lifecycle status");
  if (input.lifecycleStatus === "PREDICTION_CREATED" && !input.predictionRecordCreated)
    throw new Error("Prediction-created attempt must link a prediction record");
  const eventId = createHash("sha256")
    .update(`${input.attemptId}:${input.sequence}:${input.lifecycleStatus}`)
    .digest("hex");
  const record: ForwardExperimentAttempt = {
    schemaVersion: ATTEMPT_SCHEMA_VERSION,
    ...input,
    eventId,
  };
  assertForwardExperimentAttempt(record);
  return Object.freeze(record);
}

export function attemptFailureCategory(reason: string): ForwardAttemptFailureCategory | undefined {
  if (/stale|not_fresh/i.test(reason)) return "market_input_stale";
  if (/session|target_session|next_session/i.test(reason)) return "session_not_eligible";
  if (/budget/i.test(reason)) return "budget_failure";
  if (/storage|persist/i.test(reason)) return "storage_failure";
  if (/validation|invalid/i.test(reason)) return "validation_failure";
  if (/provider|unavailable|http/i.test(reason)) return "provider_failure";
  if (/market|price|history|provenance/i.test(reason)) return "market_input_unavailable";
  return undefined;
}

export function attemptLifecycleForReason(reason: string): ForwardAttemptLifecycleStatus {
  if (/stale|not_fresh/i.test(reason)) return "MARKET_INPUT_STALE";
  if (/session|target_session|next_session/i.test(reason)) return "SESSION_NOT_ELIGIBLE";
  if (/budget/i.test(reason)) return "BUDGET_BLOCKED";
  if (/storage|persist/i.test(reason)) return "STORAGE_FAILED";
  if (/validation|invalid/i.test(reason)) return "JEV_VALIDATION_FAILED";
  if (/market|price|history|provenance/i.test(reason)) return "MARKET_INPUT_UNAVAILABLE";
  return "JEV_TRANSPORT_FAILED";
}
