/**
 * Safe bridge from ticker-context-v1 results to the Ask service (V1.2B).
 *
 * Only safe metadata and the fact list cross this boundary: no provider
 * payloads, no credentials, no raw HTTP responses.
 */
import type { TickerEvidenceFact, TickerResearchResult } from "@/lib/ticker-context/types";
import { TICKER_CONTEXT_VERSION } from "@/lib/ticker-context/types";

export type AskTickerReason =
  "unknown_symbol" | "unsupported_security_type" | "ticker_research_unavailable";

export interface AskTickerResearchMeta {
  requestedSymbol: string;
  symbol: string | null;
  status: "ok" | "partial" | "insufficient_data" | "unsupported_symbol" | "unavailable";
  reason: AskTickerReason | null;
  effectiveAsOf: string | null;
  marketSessionAsOf: string | null;
  freshness: string | null;
  confidence: string | null;
  factCount: number;
  researchVersion: string;
}

export interface AskTickerEvidence {
  symbol: string;
  facts: TickerEvidenceFact[];
  meta: AskTickerResearchMeta;
}
/** Safe reason code for a failed/limited research result. */
export function askTickerReasonFor(result: TickerResearchResult): AskTickerReason | null {
  if (
    result.status === "ok" ||
    result.status === "partial" ||
    result.status === "insufficient_data"
  ) {
    return null;
  }
  if (result.status === "unsupported_symbol") {
    return result.reason === "unsupported_security_type"
      ? "unsupported_security_type"
      : "unknown_symbol";
  }
  return "ticker_research_unavailable";
}

export function toAskTickerResearchMeta(result: TickerResearchResult): AskTickerResearchMeta {
  if (result.status === "unsupported_symbol" || result.status === "unavailable") {
    return {
      requestedSymbol: result.requestedSymbol,
      symbol: result.symbol,
      status: result.status,
      reason: askTickerReasonFor(result),
      effectiveAsOf: null,
      marketSessionAsOf: null,
      freshness: null,
      confidence: null,
      factCount: 0,
      researchVersion: TICKER_CONTEXT_VERSION,
    };
  }
  const context = result.context;
  return {
    requestedSymbol: context.requestedSymbol,
    symbol: context.symbol,
    status: context.status,
    reason: null,
    effectiveAsOf: context.effectiveAsOf,
    marketSessionAsOf: context.marketSessionAsOf,
    freshness: context.sources.market.freshness,
    confidence: context.confidence.label,
    factCount: context.facts.length,
    researchVersion: TICKER_CONTEXT_VERSION,
  };
}
