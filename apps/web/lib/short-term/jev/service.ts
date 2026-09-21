import "server-only";
import { STRATEGIES } from "@/lib/short-term/types";
import { fingerprintShortTermInput, fingerprintMarketState } from "../market-data/canonicalize";
import { createJevConfig, type JevConfig } from "./config";
import {
  assertJevBatchBudget,
  assertJevRequestBudget,
  estimateJevCostUsd,
  estimateJevInputTokens,
} from "./budget";
import { createJevCache, type JevCache } from "./cache";
import { JevAdapterError } from "./errors";
import { buildJevQuestions, JEV_QUESTION_SET } from "./questions";
import type {
  JevProviderRequest,
  JevTransport,
  ShortTermJevAssessment,
  ShortTermJevAssessmentRequest,
} from "./types";
import { JEV_ASSESSMENT_VERSION, JEV_MODEL } from "./types";
import { validateJevProviderResponse, validateTransportFingerprint } from "./validate";
import type { ShortTermMarketState } from "../market-data/types";

export interface JevServiceDeps {
  transport: JevTransport;
  config?: JevConfig;
  cache?: JevCache<ShortTermJevAssessment>;
  now?: () => number;
}

export interface JevService {
  assess(
    request: ShortTermJevAssessmentRequest,
    state: ShortTermMarketState,
  ): Promise<ShortTermJevAssessment>;
}

function cacheKey(
  request: ShortTermJevAssessmentRequest,
  state: ShortTermMarketState,
  config: JevConfig,
): string {
  return [
    JEV_ASSESSMENT_VERSION,
    config.model,
    request.ticker,
    request.strategyId,
    request.horizonHours,
    request.maxLossPct,
    fingerprintMarketState(state),
    JEV_QUESTION_SET,
  ].join(":");
}

function runId(fingerprint: string): string {
  return `short-term-${fingerprint.slice(0, 20)}`;
}

export function createJevService(deps: JevServiceDeps): JevService {
  const config = deps.config ?? createJevConfig();
  const cache = deps.cache ?? createJevCache<ShortTermJevAssessment>();
  const now = deps.now ?? Date.now;
  let activeRequests = 0;
  return {
    async assess(request, state) {
      const requestedAt = new Date(now()).toISOString();
      const questions = buildJevQuestions();
      const providerRequest: JevProviderRequest = {
        model: JEV_MODEL,
        state: {
          market: state,
          review: {
            ticker: request.ticker,
            strategyId: request.strategyId,
            strategyDescription: STRATEGIES[request.strategyId].description,
            horizonHours: request.horizonHours,
            maxLossPct: request.maxLossPct,
          },
        } as unknown as import("@/lib/ai-brief/types").JSONValue,
        questions,
      };
      const stateFingerprint = fingerprintShortTermInput({
        market: state,
        request,
        questionSetVersion: JEV_QUESTION_SET,
      } as unknown as import("@/lib/ai-brief/types").JSONValue);
      const key = cacheKey(request, state, config);
      const cached = cache.get(key, now());
      if (cached) return { ...cached, cache: { hit: true } };
      let acquiredConcurrency = false;
      try {
        if (
          !state.provenance.source ||
          !/^[a-f0-9]{64}$/.test(state.provenance.sourceFingerprint)
        ) {
          throw new JevAdapterError(
            "RESPONSE_INVALID",
            "Market state provenance is missing or malformed.",
          );
        }
        const estimatedInputTokens = estimateJevInputTokens(providerRequest);
        assertJevRequestBudget(estimatedInputTokens, config);
        assertJevBatchBudget(1, estimateJevCostUsd(estimatedInputTokens, config), config);
        if (activeRequests >= config.maxConcurrentRequests) {
          throw new JevAdapterError("BUDGET_EXCEEDED", "Jev concurrency budget is exhausted.");
        }
        activeRequests += 1;
        acquiredConcurrency = true;
        const envelope = await deps.transport.evaluate(providerRequest, stateFingerprint);
        activeRequests -= 1;
        acquiredConcurrency = false;
        validateTransportFingerprint(envelope.requestFingerprint, stateFingerprint);
        const response = validateJevProviderResponse(
          envelope.response,
          questions,
          stateFingerprint,
        );
        const result: ShortTermJevAssessment = {
          status: envelope.transport === "fixture" ? "fixture" : "verified",
          runId: runId(stateFingerprint),
          requestedAt,
          model: JEV_MODEL,
          inputContractVersion: JEV_ASSESSMENT_VERSION,
          questionSetVersion: JEV_QUESTION_SET,
          stateFingerprint,
          answers: response.answers,
          usage: {
            inputTokens: response.usage.input_tokens,
            outputTokens: response.usage.output_tokens,
            estimatedCostUsd: estimateJevCostUsd(response.usage.input_tokens, config),
          },
          latencyMs: envelope.latencyMs,
          provenance: {
            kind: envelope.transport === "fixture" ? "fixture" : "verified_market_snapshot",
            source: state.provenance.source,
            sourceFingerprint: state.provenance.sourceFingerprint,
          },
          cache: { hit: false },
        };
        cache.set(key, result, now());
        return result;
      } catch (error) {
        if (acquiredConcurrency) activeRequests -= 1;
        const safe =
          error instanceof JevAdapterError
            ? error
            : new JevAdapterError("RESPONSE_INVALID", "Jev assessment could not be validated.");
        return {
          status: "unavailable",
          runId: runId(stateFingerprint),
          requestedAt,
          model: JEV_MODEL,
          inputContractVersion: JEV_ASSESSMENT_VERSION,
          questionSetVersion: JEV_QUESTION_SET,
          stateFingerprint,
          answers: {},
          usage: { inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0 },
          latencyMs: 0,
          provenance: {
            kind: "fixture",
            source: state.provenance.source,
            sourceFingerprint: state.provenance.sourceFingerprint,
          },
          cache: { hit: false },
          error: { code: safe.code, message: safe.message },
        };
      }
    },
  };
}
