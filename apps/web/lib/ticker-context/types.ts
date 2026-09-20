/**
 * ticker-context-v1 — on-demand ticker research evidence contract (V1.2A).
 *
 * Independent of brief-context-v1 (market-wide) and of ask-sakura-v1: this
 * contract carries verified, ticker-specific evidence for ONE supported US
 * equity, gathered on demand. It never predicts, recommends, or scores
 * anomalies; `anomaly-v1` remains the only anomaly scorer.
 *
 * Numeric `data` on each fact is internal (fingerprint/render input) and is
 * excluded from the public projection (see api-types.ts).
 */
import type { EvidenceConfidence, EvidenceFreshness, JSONObject } from "@/lib/ai-brief/types";

export const TICKER_CONTEXT_VERSION = "ticker-context-v1";

export type TickerEvidenceDomain =
  "identity" | "price" | "volume" | "volatility" | "sector" | "news" | "sec" | "catalyst";

export type TickerResearchStatus =
  "ok" | "partial" | "insufficient_data" | "unsupported_symbol" | "unavailable";

export type TickerFailureReason =
  "unknown_symbol" | "unsupported_security_type" | "provider_unavailable" | "live_data_required";

export interface TickerIdentity {
  symbol: string;
  name: string;
  exchange: string | null;
  assetClass: string;
  status: string;
  tradable: boolean;
}

export interface TickerSourceMeta {
  available: boolean;
  asOf: string | null;
  freshness: EvidenceFreshness;
  confidence: EvidenceConfidence | null;
  version: string | null;
}

export interface TickerEvidenceFact {
  id: string;
  domain: TickerEvidenceDomain;
  text: string;
  /** Internal numeric/source detail; never part of the public projection. */
  data: JSONObject;
  asOf: string | null;
  freshness: EvidenceFreshness;
  confidence: EvidenceConfidence | null;
  sourceVersion: string | null;
}

export interface TickerSessionInfo {
  /** Alpaca market clock (null when the clock provider is unavailable). */
  marketOpen: boolean | null;
  /** Regular US session phase at the requested instant. */
  phase: "regular" | "closed" | "unknown";
  /** ET session date of the price evidence (YYYY-MM-DD). */
  sessionDate: string | null;
}

export interface TickerDataAvailability {
  price: boolean;
  history: boolean;
  volume: boolean;
  volatility: boolean;
  sector: boolean;
  news: boolean;
  sec: boolean;
  corporateActions: boolean;
}

export interface TickerResearchConfidence {
  score: number;
  label: EvidenceConfidence;
}

export interface TickerResearchContext {
  version: typeof TICKER_CONTEXT_VERSION;
  status: "ok" | "partial" | "insufficient_data";
  requestedSymbol: string;
  /** Canonical symbol, verified by the provider security directory. */
  symbol: string;
  identity: TickerIdentity;
  /** Orchestration instants — intentionally excluded from the fingerprint. */
  requestedAt: string;
  generatedAt: string;
  /** Latest provider observation timestamp (trade or session bar). */
  providerAsOf: string | null;
  /** ET session date the price evidence belongs to. */
  marketSessionAsOf: string | null;
  /** Price-data instant the evidence describes (never orchestration time). */
  effectiveAsOf: string | null;
  session: TickerSessionInfo;
  sources: {
    market: TickerSourceMeta;
    identity: TickerSourceMeta;
    sector: TickerSourceMeta;
    news: TickerSourceMeta;
    sec: TickerSourceMeta;
  };
  availability: TickerDataAvailability;
  facts: TickerEvidenceFact[];
  confidence: TickerResearchConfidence;
  fingerprint: string;
}

export type TickerResearchResult =
  | { status: "ok" | "partial" | "insufficient_data"; context: TickerResearchContext }
  | {
      status: "unsupported_symbol";
      requestedSymbol: string;
      symbol: string | null;
      reason: TickerFailureReason;
    }
  | {
      status: "unavailable";
      requestedSymbol: string;
      symbol: string | null;
      reason: TickerFailureReason;
      mode: "demo" | "live";
    };
