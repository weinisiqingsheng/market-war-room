import "server-only";
import { createProductionTickerDeps } from "@/lib/ticker-context/production-service";
import { researchTicker, type TickerResearchDeps } from "@/lib/ticker-context/service";
import { fingerprintMarketState } from "../market-data/canonicalize";
import { loadVerifiedTickerState, type TickerResearchCall } from "../market-data/verified-bridge";
import { assertJevBatchBudget, estimateJevCostUsd } from "../jev/budget";
import { createJevConfig, type JevConfig } from "../jev/config";
import { JevAdapterError } from "../jev/errors";
import { createHttpTransport } from "../jev/http-transport";
import type { JevProviderRequest, JevTransport } from "../jev/types";
import { JEV_MODEL } from "../jev/types";
import { NYSE_REGULAR_SESSION_CALENDAR } from "../prospective/calendar";
import type { ProspectiveSessionCalendar } from "../prospective/types";
import { buildForwardDirectionQuestion } from "./questions";
import { assertForwardDecisionPolicy } from "./market-policy";
import { buildForwardPredictionRecord } from "./record";
import { buildForwardProviderRequest, mapForwardProviderResponse } from "./provider";
import { createForwardPredictionStore, type ForwardPredictionStore } from "./store";
import { estimateForwardConservativeCostUsd } from "./cost";
import {
  attemptFailureCategory,
  attemptLifecycleForReason,
  buildForwardExperimentAttempt,
  type ForwardAttemptLifecycleStatus,
} from "./attempt";
import type { ForwardAttemptStore } from "./attempt-store";
import type { ForwardDecisionContext } from "./types";

export const REAL_FORWARD_CONFIRMATION = "CONFIRM_PHASE_2E_1_REAL_FORWARD_PILOT" as const;
export const REAL_FORWARD_SYMBOLS = ["NVDA", "TSLA", "AAPL"] as const;
export const REAL_FORWARD_MAX_REQUESTS = 3 as const;
export const REAL_FORWARD_MAX_COST_USD = 0.1 as const;

export interface RealForwardPilotOptions {
  confirmation: string;
  apiKey?: string;
  symbols?: readonly string[];
  research?: TickerResearchCall;
  researchDeps?: TickerResearchDeps;
  transport?: JevTransport;
  fetchImpl?: typeof fetch;
  store?: ForwardPredictionStore;
  calendar?: ProspectiveSessionCalendar;
  now?: () => number;
  maxRequests?: number;
  maxEstimatedCostUsd?: number;
  attemptStore?: ForwardAttemptStore;
}

export interface ForwardPilotSymbolReport {
  symbol: string;
  status: "ready" | "blocked";
  reason?: string;
  requestCount: number;
  providerHttpStatus: number | null;
  requestedAt?: string;
  effectiveAsOf?: string | null;
  marketSessionDate?: string;
  targetSessionDate?: string;
  targetCloseAt?: string;
  feed?: string | null;
  delayMinutes?: number | null;
  freshness?: string;
  stateFingerprint?: string;
  sourceFingerprint?: string;
  model?: typeof JEV_MODEL;
  predictionId?: string;
  outputFingerprint?: string;
  latencyMs?: number;
  estimatedCostUsd?: number;
  inputTokens?: number;
  outputTokens?: number;
}

export interface RealForwardPilotReport {
  status: "completed" | "blocked";
  reason?: string;
  requestCount: number;
  estimatedCostUsd: number;
  symbols: ForwardPilotSymbolReport[];
}

function blocked(
  reason: string,
  requestCount = 0,
  estimatedCostUsd = 0,
  symbols: ForwardPilotSymbolReport[] = [],
): RealForwardPilotReport {
  return { status: "blocked", reason, requestCount, estimatedCostUsd, symbols };
}

function validateSymbols(symbols: readonly string[]): string | null {
  if (
    symbols.length !== REAL_FORWARD_SYMBOLS.length ||
    new Set(symbols).size !== symbols.length ||
    symbols.some(
      (symbol) => !REAL_FORWARD_SYMBOLS.includes(symbol as (typeof REAL_FORWARD_SYMBOLS)[number]),
    )
  )
    return "symbols_must_be_exactly_nvda_tsla_aapl_once";
  return null;
}

function config(maxRequests: number, maxEstimatedCostUsd: number): JevConfig {
  return createJevConfig({
    mode: "http",
    allowRealProvider: true,
    maxRetries: 0,
    maxRequestsPerShadowBatch: maxRequests,
    maxEstimatedBatchCostUsd: maxEstimatedCostUsd,
    maxConcurrentRequests: 1,
  });
}

function factNumber(
  snapshot: Awaited<ReturnType<typeof loadVerifiedTickerState>> extends infer S
    ? S extends { state: infer State }
      ? State
      : never
    : never,
  key: string,
): number | null {
  const fact = snapshot.facts.find((item) => item.domain === "price");
  const value = fact?.values[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function buildDecision(
  snapshot: Extract<
    Awaited<ReturnType<typeof loadVerifiedTickerState>>,
    { status: "verified_market_input" }
  >,
  now: number,
  calendar: ProspectiveSessionCalendar,
): ForwardDecisionContext | { reason: string } {
  const state = snapshot.state;
  if (
    !state.effectiveAsOf ||
    !state.marketSessionAsOf ||
    !state.feed ||
    state.delayMinutes === null
  )
    return { reason: "market_provenance_incomplete" };
  if (state.freshness === "stale" || state.freshness === "unavailable")
    return { reason: "market_input_not_fresh" };
  const policy = assertForwardDecisionPolicy({
    feed: state.feed,
    delayMinutes: state.delayMinutes,
    freshness: state.freshness,
  });
  if (!policy.ok) return { reason: policy.reason };
  if (!state.availability.price || !state.availability.history)
    return { reason: "market_price_or_history_unavailable" };
  const referencePrice = factNumber(state, "price");
  const previousClose = factNumber(state, "previousClose");
  if (
    referencePrice === null ||
    previousClose === null ||
    referencePrice <= 0 ||
    previousClose <= 0
  )
    return { reason: "structured_price_missing" };
  const target = calendar.nextSessionAfter(state.marketSessionAsOf);
  if (!target) return { reason: "next_session_unavailable" };
  if (now >= Date.parse(target.closeAt)) return { reason: "target_session_close_passed" };
  if (Date.parse(state.effectiveAsOf) >= Date.parse(target.closeAt))
    return { reason: "effective_timestamp_after_target" };
  const stateFingerprint = fingerprintMarketState(state);
  return {
    originalDecisionRunId: `forward-${state.symbol.toLowerCase()}-${stateFingerprint.slice(0, 20)}`,
    ticker: state.symbol,
    stateFingerprint,
    sourceFingerprint: state.provenance.sourceFingerprint,
    requestedAt: new Date(now).toISOString(),
    effectiveAsOf: state.effectiveAsOf,
    marketSessionDate: state.marketSessionAsOf,
    marketSessionStatus: state.marketSessionStatus === "closed" ? "closed" : "open",
    targetSessionDate: target.sessionDate,
    targetCloseAt: target.closeAt,
    marketDataPolicyVersion: "short-term-forward-market-data-policy-v1",
    referencePrice,
    previousClose,
    feed: state.feed,
    delayMinutes: state.delayMinutes,
    freshness: state.freshness === "fresh" ? "real_time" : "delayed",
    marketInputStatus: "verified_market_input",
  };
}

export async function runRealForwardPilot(
  options: RealForwardPilotOptions,
): Promise<RealForwardPilotReport> {
  if (options.confirmation !== REAL_FORWARD_CONFIRMATION)
    return blocked("explicit_confirmation_required");
  const apiKey = (options.apiKey ?? process.env.TYPESAFE_API_KEY ?? "").trim();
  if (!apiKey) return blocked("missing_typesafe_api_key");
  const symbols = options.symbols ?? REAL_FORWARD_SYMBOLS;
  const symbolError = validateSymbols(symbols);
  if (symbolError) return blocked(symbolError);
  if (!options.store) return blocked("prediction_store_required");
  const maxRequests = options.maxRequests ?? REAL_FORWARD_MAX_REQUESTS;
  const maxEstimatedCostUsd = options.maxEstimatedCostUsd ?? REAL_FORWARD_MAX_COST_USD;
  if (
    maxRequests !== REAL_FORWARD_MAX_REQUESTS ||
    maxEstimatedCostUsd <= 0 ||
    maxEstimatedCostUsd > REAL_FORWARD_MAX_COST_USD
  )
    return blocked("budget_configuration_invalid");

  const jevConfig = config(maxRequests, maxEstimatedCostUsd);
  const now = options.now ?? Date.now;
  const calendar = options.calendar ?? NYSE_REGULAR_SESSION_CALENDAR;
  const research = options.research ?? researchTicker;
  const researchDeps = options.researchDeps ?? createProductionTickerDeps();
  let requestCount = 0;
  let estimatedCostUsd = 0;
  let actualCostUsd = 0;
  let providerHttpStatus: number | null = options.transport ? 200 : null;
  const baseFetch = options.fetchImpl ?? fetch;
  const recordingFetch: typeof fetch = async (...args) => {
    const response = await baseFetch(...args);
    providerHttpStatus = response.status;
    return response;
  };
  const baseTransport =
    options.transport ?? createHttpTransport(jevConfig, { apiKey, fetch: recordingFetch, now });
  const guardedTransport: JevTransport = {
    async evaluate(request: JevProviderRequest, requestFingerprint: string) {
      const conservativeCost = estimateForwardConservativeCostUsd(request, jevConfig);
      if (requestCount >= maxRequests)
        throw new JevAdapterError("BUDGET_EXCEEDED", "Forward Jev request budget exhausted.");
      assertJevBatchBudget(1, estimatedCostUsd + conservativeCost, jevConfig);
      requestCount += 1;
      estimatedCostUsd += conservativeCost;
      const envelope = await baseTransport.evaluate(request, requestFingerprint);
      actualCostUsd += estimateJevCostUsd(envelope.response.usage.input_tokens, jevConfig);
      if (actualCostUsd > maxEstimatedCostUsd)
        throw new JevAdapterError(
          "BUDGET_EXCEEDED",
          "Forward Jev actual usage exceeded the cost budget.",
        );
      return envelope;
    },
  };
  const reports: ForwardPilotSymbolReport[] = [];
  for (const symbol of symbols) {
    const attemptId = `forward-${symbol.toLowerCase()}-${now()}`;
    let attemptSequence = 0;
    const appendAttempt = (
      status: ForwardAttemptLifecycleStatus,
      details: {
        targetSession?: string | null;
        providerRequestCount?: number;
        jevRequestCount?: number;
        predictionRecordCreated?: boolean;
        linkedPredictionRunId?: string;
        safeErrorCategory?: string;
        inputFingerprint?: string;
        stateFingerprint?: string;
      } = {},
    ): boolean => {
      if (!options.attemptStore) return true;
      attemptSequence += 1;
      try {
        options.attemptStore.append(
          buildForwardExperimentAttempt({
            attemptId,
            sequence: attemptSequence,
            requestedAt: new Date(now()).toISOString(),
            ticker: symbol,
            taskId: "next_session_direction_v1",
            taskVersion: "short-term-forward-direction-v1",
            questionSetVersion: "short-term-forward-questions-v1",
            marketDataPolicyVersion: "short-term-forward-market-data-policy-v1",
            intendedTargetSession: details.targetSession ?? null,
            lifecycleStatus: status,
            failureCategory:
              status === "PREDICTION_CREATED"
                ? undefined
                : attemptFailureCategory(details.safeErrorCategory ?? status),
            providerRequestCount: details.providerRequestCount ?? 0,
            jevRequestCount: details.jevRequestCount ?? 0,
            predictionRecordCreated:
              details.predictionRecordCreated ?? status === "PREDICTION_CREATED",
            linkedPredictionRunId: details.linkedPredictionRunId,
            safeErrorCategory: details.safeErrorCategory,
            model: JEV_MODEL,
            inputFingerprint: details.inputFingerprint,
            stateFingerprint: details.stateFingerprint,
          }),
        );
        return true;
      } catch {
        return false;
      }
    };
    if (!appendAttempt("ATTEMPT_STARTED"))
      return blocked("attempt_storage_failed", requestCount, estimatedCostUsd, reports);
    providerHttpStatus = options.transport ? 200 : null;
    const bridged = await loadVerifiedTickerState(symbol, research, researchDeps);
    if (bridged.status !== "verified_market_input") {
      const lifecycle = attemptLifecycleForReason(bridged.reason);
      appendAttempt(lifecycle, {
        safeErrorCategory: bridged.reason,
        providerRequestCount: 1,
      });
      reports.push({
        symbol,
        status: "blocked",
        reason: bridged.reason,
        requestCount,
        providerHttpStatus,
      });
      return blocked(bridged.reason, requestCount, estimatedCostUsd, reports);
    }
    const decision = buildDecision(bridged, now(), calendar);
    if ("reason" in decision) {
      const lifecycle = attemptLifecycleForReason(decision.reason);
      appendAttempt(lifecycle, {
        safeErrorCategory: decision.reason,
        providerRequestCount: 1,
        inputFingerprint: bridged.state.provenance.sourceFingerprint,
        stateFingerprint: fingerprintMarketState(bridged.state),
      });
      reports.push({
        symbol,
        status: "blocked",
        reason: decision.reason,
        requestCount,
        providerHttpStatus,
      });
      return blocked(decision.reason, requestCount, estimatedCostUsd, reports);
    }
    const question = buildForwardDirectionQuestion(decision);
    const request = buildForwardProviderRequest(decision, bridged.state);
    const started = now();
    let envelope;
    try {
      envelope = await guardedTransport.evaluate(request, decision.stateFingerprint);
    } catch (error) {
      const reason =
        error instanceof JevAdapterError ? error.code.toLowerCase() : "provider_unavailable";
      appendAttempt(attemptLifecycleForReason(reason), {
        safeErrorCategory: reason,
        providerRequestCount: 1,
        jevRequestCount: requestCount,
        targetSession: decision.targetSessionDate,
        inputFingerprint: decision.sourceFingerprint,
        stateFingerprint: decision.stateFingerprint,
      });
      reports.push({ symbol, status: "blocked", reason, requestCount, providerHttpStatus });
      return blocked(reason, requestCount, estimatedCostUsd, reports);
    }
    let record: ReturnType<typeof buildForwardPredictionRecord>;
    let assessment: ReturnType<typeof mapForwardProviderResponse>;
    try {
      const usage = envelope.response.usage;
      assessment = mapForwardProviderResponse(envelope.response, decision, question, {
        latencyMs: envelope.latencyMs || Math.max(0, now() - started),
        estimatedCostUsd: estimateJevCostUsd(usage.input_tokens, jevConfig),
      });
      record = buildForwardPredictionRecord({
        decision,
        assessment,
        createdAt: new Date(now()).toISOString(),
        modelOutputStatus: "real_jev_model_output",
      });
    } catch {
      appendAttempt("JEV_VALIDATION_FAILED", {
        safeErrorCategory: "response_invalid_or_store_failed",
        providerRequestCount: 1,
        jevRequestCount: requestCount,
        targetSession: decision.targetSessionDate,
        inputFingerprint: decision.sourceFingerprint,
        stateFingerprint: decision.stateFingerprint,
      });
      reports.push({
        symbol,
        status: "blocked",
        reason: "response_invalid_or_store_failed",
        requestCount,
        providerHttpStatus,
      });
      return blocked("response_invalid_or_store_failed", requestCount, estimatedCostUsd, reports);
    }
    try {
      options.store.append(record);
    } catch {
      appendAttempt("STORAGE_FAILED", {
        safeErrorCategory: "prediction_storage_failed",
        providerRequestCount: 1,
        jevRequestCount: requestCount,
        targetSession: decision.targetSessionDate,
        inputFingerprint: decision.sourceFingerprint,
        stateFingerprint: decision.stateFingerprint,
      });
      reports.push({
        symbol,
        status: "blocked",
        reason: "prediction_storage_failed",
        requestCount,
        providerHttpStatus,
      });
      return blocked("prediction_storage_failed", requestCount, estimatedCostUsd, reports);
    }
    if (
      !appendAttempt("PREDICTION_CREATED", {
        providerRequestCount: 1,
        jevRequestCount: requestCount,
        predictionRecordCreated: true,
        linkedPredictionRunId: record.originalDecisionRunId,
        targetSession: decision.targetSessionDate,
        inputFingerprint: decision.sourceFingerprint,
        stateFingerprint: decision.stateFingerprint,
      })
    ) {
      return blocked("attempt_storage_failed", requestCount, estimatedCostUsd, reports);
    }
    reports.push({
      symbol,
      status: "ready",
      requestCount,
      providerHttpStatus,
      requestedAt: decision.requestedAt,
      effectiveAsOf: decision.effectiveAsOf,
      marketSessionDate: decision.marketSessionDate,
      targetSessionDate: decision.targetSessionDate,
      targetCloseAt: decision.targetCloseAt,
      feed: decision.feed,
      delayMinutes: decision.delayMinutes,
      freshness: decision.freshness,
      stateFingerprint: decision.stateFingerprint,
      sourceFingerprint: decision.sourceFingerprint,
      model: JEV_MODEL,
      predictionId: record.predictionId,
      outputFingerprint: record.outputFingerprint,
      latencyMs: record.latencyMs,
      estimatedCostUsd: record.estimatedCostUsd,
      inputTokens: assessment.usage.inputTokens,
      outputTokens: assessment.usage.outputTokens,
    });
  }
  return { status: "completed", requestCount, estimatedCostUsd, symbols: reports };
}

export function defaultForwardPredictionStore(): ForwardPredictionStore {
  return createForwardPredictionStore({ retentionDays: 90 });
}
