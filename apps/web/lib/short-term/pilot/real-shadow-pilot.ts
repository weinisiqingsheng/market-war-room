import "server-only";
import { createProductionTickerDeps } from "@/lib/ticker-context/production-service";
import { researchTicker, type TickerResearchDeps } from "@/lib/ticker-context/service";
import {
  bridgeTickerResearchResult,
  type TickerResearchCall,
} from "../market-data/verified-bridge";
import { createJevConfig, type JevConfig } from "../jev/config";
import { assertJevBatchBudget, estimateJevCostUsd, estimateJevInputTokens } from "../jev/budget";
import { JevAdapterError } from "../jev/errors";
import { createHttpTransport } from "../jev/http-transport";
import { createJevService } from "../jev/service";
import type { JevProviderRequest, JevTransport, ShortTermJevAssessment } from "../jev/types";
import { JEV_MODEL } from "../jev/types";
import { runVerifiedTickerShadow } from "../shadow/runner";
import type { ShortTermShadowStore } from "../shadow/store";

export const REAL_JEV_PILOT_CONFIRMATION = "CONFIRM_REAL_JEV_SHADOW_PILOT" as const;
export const REAL_JEV_PILOT_SYMBOLS = ["NVDA", "TSLA", "AAPL"] as const;
export const REAL_JEV_PILOT_MAX_REQUESTS = 3 as const;
export const REAL_JEV_PILOT_MAX_COST_USD = 0.1 as const;

const CONSERVATIVE_TOKEN_MULTIPLIER = 2;

export interface RealJevShadowPilotOptions {
  /** Must be supplied by an explicit private CLI entrypoint, never inferred from env alone. */
  confirmation: string;
  /** Optional test injection; production reads TYPESAFE_API_KEY server-side. */
  apiKey?: string;
  symbols?: readonly string[];
  research?: TickerResearchCall;
  researchDeps?: TickerResearchDeps;
  transport?: JevTransport;
  fetchImpl?: typeof fetch;
  shadowStore: ShortTermShadowStore;
  maxRequests?: number;
  maxEstimatedCostUsd?: number;
  now?: () => number;
}

export interface RealJevReadySymbol {
  symbol: string;
  status: "ready";
  contextStatus: "ok" | "partial" | "insufficient_data";
  model: typeof JEV_MODEL;
  providerHttpStatus: number | null;
  answerIds: string[];
  answerTypes: Record<string, string>;
  usage: ShortTermJevAssessment["usage"];
  latencyMs: number;
  estimatedCostUsd: number;
  marketInputStatus: "verified_market_input";
  modelOutputStatus: "real_jev_model_output";
  stateFingerprint: string;
  effectiveAsOf: string | null;
  marketSessionAsOf: string | null;
  feed: string | null;
  freshness: string;
}

export interface RealJevBlockedSymbol {
  symbol: string;
  status: "blocked";
  reason: string;
  requestCount: number;
  providerHttpStatus: number | null;
}

export type RealJevSymbolResult = RealJevReadySymbol | RealJevBlockedSymbol;

export type RealJevShadowPilotReport =
  | {
      status: "completed";
      requestCount: number;
      estimatedCostUsd: number;
      actualCostUsd: number;
      symbols: RealJevSymbolResult[];
    }
  | {
      status: "blocked";
      reason: string;
      requestCount: number;
      estimatedCostUsd: number;
      actualCostUsd: number;
      symbols: RealJevSymbolResult[];
    };

function blocked(
  reason: string,
  requestCount = 0,
  estimatedCostUsd = 0,
  actualCostUsd = 0,
  symbols: RealJevSymbolResult[] = [],
): RealJevShadowPilotReport {
  return { status: "blocked", reason, requestCount, estimatedCostUsd, actualCostUsd, symbols };
}

function validateSymbols(symbols: readonly string[]): string | null {
  if (
    symbols.length < 1 ||
    symbols.length > REAL_JEV_PILOT_SYMBOLS.length ||
    new Set(symbols).size !== symbols.length ||
    symbols.some(
      (symbol) =>
        !REAL_JEV_PILOT_SYMBOLS.includes(symbol as (typeof REAL_JEV_PILOT_SYMBOLS)[number]),
    )
  ) {
    return "symbols_must_be_exactly_nvda_tsla_aapl_once";
  }
  return null;
}

function pilotConfig(maxRequests: number, maxEstimatedCostUsd: number): JevConfig {
  return createJevConfig({
    mode: "http",
    allowRealProvider: true,
    maxRetries: 0,
    maxRequestsPerShadowBatch: maxRequests,
    maxEstimatedBatchCostUsd: maxEstimatedCostUsd,
    maxConcurrentRequests: 1,
    inputUsdPerMillionTokens: 0.042,
  });
}

function answerTypes(assessment: ShortTermJevAssessment): Record<string, string> {
  return Object.fromEntries(
    Object.entries(assessment.answers).map(([id, answer]) => [id, answer.type]),
  );
}

export async function runRealJevShadowPilot(
  options: RealJevShadowPilotOptions,
): Promise<RealJevShadowPilotReport> {
  if (options.confirmation !== REAL_JEV_PILOT_CONFIRMATION) {
    return blocked("explicit_confirmation_required");
  }

  const apiKey = (options.apiKey ?? process.env.TYPESAFE_API_KEY ?? "").trim();
  if (!apiKey) return blocked("missing_typesafe_api_key");

  const symbols = options.symbols ?? REAL_JEV_PILOT_SYMBOLS;
  const symbolsError = validateSymbols(symbols);
  if (symbolsError) return blocked(symbolsError);

  const maxRequests = options.maxRequests ?? REAL_JEV_PILOT_MAX_REQUESTS;
  const maxEstimatedCostUsd = options.maxEstimatedCostUsd ?? REAL_JEV_PILOT_MAX_COST_USD;
  if (
    !Number.isInteger(maxRequests) ||
    maxRequests < 1 ||
    maxRequests > REAL_JEV_PILOT_MAX_REQUESTS ||
    !Number.isFinite(maxEstimatedCostUsd) ||
    maxEstimatedCostUsd <= 0 ||
    maxEstimatedCostUsd > REAL_JEV_PILOT_MAX_COST_USD
  ) {
    return blocked("budget_configuration_invalid");
  }

  const config = pilotConfig(maxRequests, maxEstimatedCostUsd);
  const now = options.now ?? Date.now;
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
    options.transport ??
    createHttpTransport(config, {
      apiKey,
      fetch: recordingFetch,
      now,
    });
  const guardedTransport: JevTransport = {
    async evaluate(request: JevProviderRequest, requestFingerprint: string) {
      const conservativeInputTokens = Math.ceil(
        estimateJevInputTokens(request) * CONSERVATIVE_TOKEN_MULTIPLIER,
      );
      const conservativeCostUsd = estimateJevCostUsd(conservativeInputTokens, config);
      if (requestCount >= maxRequests) {
        throw new JevAdapterError("BUDGET_EXCEEDED", "Real Jev request budget is exhausted.");
      }
      assertJevBatchBudget(1, estimatedCostUsd + conservativeCostUsd, config);
      requestCount += 1;
      estimatedCostUsd += conservativeCostUsd;
      const envelope = await baseTransport.evaluate(request, requestFingerprint);
      actualCostUsd += estimateJevCostUsd(envelope.response.usage.input_tokens, config);
      return envelope;
    },
  };
  const jevService = createJevService({
    transport: guardedTransport,
    config,
    now,
  });
  const research = options.research ?? researchTicker;
  const researchDeps = options.researchDeps ?? createProductionTickerDeps();
  const results: RealJevSymbolResult[] = [];

  for (const ticker of symbols) {
    providerHttpStatus = options.transport ? 200 : null;
    const sourceResult = await research(ticker, researchDeps);
    const bridged = bridgeTickerResearchResult(sourceResult);
    if (bridged.status !== "verified_market_input") {
      results.push({
        symbol: ticker,
        status: "blocked",
        reason: bridged.reason,
        requestCount,
        providerHttpStatus,
      });
      return blocked(bridged.reason, requestCount, estimatedCostUsd, actualCostUsd, results);
    }

    const shadow = await runVerifiedTickerShadow(
      { ticker, strategyId: "risk-first", horizonHours: 1, maxLossPct: 1 },
      {
        research: async () => sourceResult,
        researchDeps,
        jevService,
        store: options.shadowStore,
        outputMode: "real",
      },
    );
    if (shadow.status !== "ready") {
      results.push({
        symbol: ticker,
        status: "blocked",
        reason: shadow.reason,
        requestCount,
        providerHttpStatus,
      });
      return blocked(shadow.reason, requestCount, estimatedCostUsd, actualCostUsd, results);
    }
    if (shadow.modelOutputStatus !== "real_jev_model_output") {
      results.push({
        symbol: ticker,
        status: "blocked",
        reason: "unexpected_model_output_status",
        requestCount,
        providerHttpStatus,
      });
      return blocked(
        "unexpected_model_output_status",
        requestCount,
        estimatedCostUsd,
        actualCostUsd,
        results,
      );
    }
    if (actualCostUsd > maxEstimatedCostUsd) {
      results.push({
        symbol: ticker,
        status: "blocked",
        reason: "actual_cost_exceeded",
        requestCount,
        providerHttpStatus,
      });
      return blocked(
        "actual_cost_exceeded",
        requestCount,
        estimatedCostUsd,
        actualCostUsd,
        results,
      );
    }
    if (providerHttpStatus !== 200) {
      results.push({
        symbol: ticker,
        status: "blocked",
        reason: "unexpected_provider_http_status",
        requestCount,
        providerHttpStatus,
      });
      return blocked(
        "unexpected_provider_http_status",
        requestCount,
        estimatedCostUsd,
        actualCostUsd,
        results,
      );
    }
    const assessment = shadow.assessment;
    results.push({
      symbol: ticker,
      status: "ready",
      contextStatus: shadow.contextStatus,
      model: assessment.model,
      providerHttpStatus,
      answerIds: Object.keys(assessment.answers),
      answerTypes: answerTypes(assessment),
      usage: assessment.usage,
      latencyMs: assessment.latencyMs,
      estimatedCostUsd: assessment.usage.estimatedCostUsd,
      marketInputStatus: shadow.marketInputStatus,
      modelOutputStatus: shadow.modelOutputStatus,
      stateFingerprint: assessment.stateFingerprint,
      effectiveAsOf: shadow.state.effectiveAsOf,
      marketSessionAsOf: shadow.state.marketSessionAsOf,
      feed: shadow.state.feed,
      freshness: shadow.state.freshness,
    });
  }

  return { status: "completed", requestCount, estimatedCostUsd, actualCostUsd, symbols: results };
}
