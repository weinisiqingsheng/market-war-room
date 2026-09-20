/**
 * HTTP DTO for GET /api/intelligence/ticker (V1.2A).
 *
 * The public projection is the model-facing evidence view: fact text and
 * metadata only. Internal `TickerEvidenceFact.data` (raw numbers, provider
 * ids, URLs used internally) is deliberately excluded, exactly like the AI
 * evidence projection, so no provider payload ever reaches the client.
 */
import type {
  TickerDataAvailability,
  TickerEvidenceDomain,
  TickerEvidenceFact,
  TickerFailureReason,
  TickerIdentity,
  TickerResearchConfidence,
  TickerResearchContext,
  TickerResearchStatus,
  TickerSessionInfo,
  TickerSourceMeta,
} from "./types";
import { TICKER_CONTEXT_VERSION } from "./types";

export interface SafeTickerFact {
  id: string;
  domain: TickerEvidenceDomain;
  text: string;
  asOf: string | null;
  freshness: string;
  confidence: string | null;
  sourceVersion: string | null;
}

export interface SafeTickerContext {
  version: typeof TICKER_CONTEXT_VERSION;
  status: "ok" | "partial" | "insufficient_data";
  requestedSymbol: string;
  symbol: string;
  identity: TickerIdentity;
  requestedAt: string;
  generatedAt: string;
  providerAsOf: string | null;
  marketSessionAsOf: string | null;
  effectiveAsOf: string | null;
  session: TickerSessionInfo;
  sources: Record<string, TickerSourceMeta>;
  availability: TickerDataAvailability;
  confidence: TickerResearchConfidence;
  factCount: number;
  facts: SafeTickerFact[];
  fingerprint: string;
}

export interface TickerResearchApiOk {
  mode: "demo" | "live";
  status: "ok" | "partial" | "insufficient_data";
  symbol: string;
  context: SafeTickerContext;
}

export interface TickerResearchApiFailure {
  mode: "demo" | "live";
  status: "unsupported_symbol" | "unavailable";
  symbol: string;
  reason: TickerFailureReason;
  error: { code: string; message: string };
}

export type TickerResearchApiResponse = TickerResearchApiOk | TickerResearchApiFailure;

export function projectTickerFact(fact: TickerEvidenceFact): SafeTickerFact {
  return {
    id: fact.id,
    domain: fact.domain,
    text: fact.text,
    asOf: fact.asOf,
    freshness: fact.freshness,
    confidence: fact.confidence,
    sourceVersion: fact.sourceVersion,
  };
}

/** Client-safe projection: metadata + fact text only (never `fact.data`). */
export function projectTickerContext(context: TickerResearchContext): SafeTickerContext {
  return {
    version: context.version,
    status: context.status,
    requestedSymbol: context.requestedSymbol,
    symbol: context.symbol,
    identity: context.identity,
    requestedAt: context.requestedAt,
    generatedAt: context.generatedAt,
    providerAsOf: context.providerAsOf,
    marketSessionAsOf: context.marketSessionAsOf,
    effectiveAsOf: context.effectiveAsOf,
    session: context.session,
    sources: context.sources,
    availability: context.availability,
    confidence: context.confidence,
    factCount: context.facts.length,
    facts: context.facts.map(projectTickerFact),
    fingerprint: context.fingerprint,
  };
}

export type { TickerResearchStatus };
