import { STRATEGIES, type StrategyId } from "@/lib/short-term/types";
import type { JSONObject, JSONValue } from "@/lib/ai-brief/types";
import { SHORT_TERM_MARKET_STATE_VERSION, type ShortTermMarketState } from "../market-data/types";

export const JEV_ASSESSMENT_VERSION = "short-term-jev-assessment-v1" as const;
export const JEV_MODEL = "jev-1.13.0" as const;
export const JEV_ENDPOINT = "https://api.typesafe.ai/v1/systemone" as const;

export type JevInstruction = string | JSONObject | JSONValue[];

export interface JevNoulQuestion {
  type: "noul";
  instructions: JevInstruction;
  criteria?: { true?: JevInstruction; false?: JevInstruction };
}

export interface JevChoiceQuestion {
  type: "choice";
  instructions: JevInstruction;
  criteria: Record<string, JevInstruction | null>;
}

export interface JevScoreQuestion {
  type: "score";
  instructions: JevInstruction;
  criteria: JevInstruction[];
}

export type JevQuestion = JevNoulQuestion | JevChoiceQuestion | JevScoreQuestion;
export type JevQuestionMap = Record<string, JevQuestion>;

export interface JevProviderRequest {
  state: JSONValue;
  model: typeof JEV_MODEL;
  questions: JevQuestionMap;
}

export interface JevNoulAnswer {
  type: "noul";
  noul: number;
}

export interface JevChoiceAnswer {
  type: "choice";
  choice: string;
  probabilities: Record<string, number>;
  confidence: number;
}

export interface JevScoreAnswer {
  type: "score";
  score: number;
  legend: Record<string, string>;
  probabilities: Record<string, number>;
  confidence: number;
}

export type JevProviderAnswer = JevNoulAnswer | JevChoiceAnswer | JevScoreAnswer;

export interface JevProviderResponse {
  model: string;
  answers: Record<string, JevProviderAnswer>;
  usage: { input_tokens: number; output_tokens: number };
}

export interface JevTransportEnvelope {
  transport: "fixture" | "http";
  response: JevProviderResponse;
  requestFingerprint: string;
  latencyMs: number;
}

export interface JevTransport {
  evaluate(request: JevProviderRequest, requestFingerprint: string): Promise<JevTransportEnvelope>;
}

export interface ShortTermJevAssessmentRequest {
  ticker: string;
  strategyId: StrategyId;
  horizonHours: number;
  maxLossPct: number;
}

export function normalizeJevAssessmentRequest(input: unknown): ShortTermJevAssessmentRequest {
  if (!input || typeof input !== "object") throw new Error("Request body is required");
  const body = input as Record<string, unknown>;
  const ticker = typeof body.ticker === "string" ? body.ticker.trim().toUpperCase() : "";
  if (!/^[A-Z][A-Z0-9.-]{0,9}$/.test(ticker)) {
    throw new Error("Ticker must be 1-10 characters using letters, digits, '.' or '-'");
  }
  if (typeof body.strategyId !== "string" || !(body.strategyId in STRATEGIES))
    throw new Error("Strategy is invalid");
  if (
    typeof body.horizonHours !== "number" ||
    !Number.isInteger(body.horizonHours) ||
    body.horizonHours < 1 ||
    body.horizonHours > 48
  ) {
    throw new Error("Horizon must be an integer from 1 to 48 hours");
  }
  if (
    typeof body.maxLossPct !== "number" ||
    !Number.isFinite(body.maxLossPct) ||
    body.maxLossPct <= 0 ||
    body.maxLossPct > 10
  ) {
    throw new Error("Maximum loss must be greater than 0 and no more than 10 percent");
  }
  return {
    ticker,
    strategyId: body.strategyId as StrategyId,
    horizonHours: body.horizonHours,
    maxLossPct: Math.round(body.maxLossPct * 100) / 100,
  };
}

export interface ShortTermJevUsage {
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
}

export interface ShortTermJevAssessment {
  status: "fixture" | "verified" | "unavailable";
  runId: string;
  requestedAt: string;
  model: typeof JEV_MODEL;
  inputContractVersion: typeof JEV_ASSESSMENT_VERSION;
  questionSetVersion: string;
  stateFingerprint: string;
  answers: Record<string, JevProviderAnswer>;
  usage: ShortTermJevUsage;
  latencyMs: number;
  provenance: {
    kind: "fixture" | "verified_market_snapshot";
    source: string;
    sourceFingerprint: string;
  };
  cache: { hit: boolean };
  error?: { code: string; message: string };
}

export interface JevAssessmentInput {
  request: ShortTermJevAssessmentRequest;
  marketState: ShortTermMarketState;
}

export const SHORT_TERM_MARKET_STATE_VERSION_FOR_TYPES = SHORT_TERM_MARKET_STATE_VERSION;
