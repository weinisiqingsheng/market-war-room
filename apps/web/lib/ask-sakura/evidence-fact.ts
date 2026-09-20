/**
 * Ask-only evidence fact shape (V1.2B).
 *
 * Structurally identical to `EvidenceFact` except `domain` is a string, so the
 * composed pack can carry either brief-context-v1 domains or ticker-context-v1
 * domains (identity/price/volume/volatility/sector/news/sec/catalyst) without
 * mutating brief-context-v1 or its types. Fact IDs, text and metadata are
 * preserved verbatim from their source contract.
 */
import type { EvidenceConfidence, EvidenceFreshness, JSONObject } from "@/lib/ai-brief/types";

export interface AskEvidenceFact {
  id: string;
  domain: string;
  text: string;
  data: JSONObject;
  asOf: string | null;
  freshness: EvidenceFreshness;
  confidence: EvidenceConfidence | null;
  sourceVersion: string | null;
}

/** Composition bookkeeping (deterministic; never sent to the model). */
export interface AskEvidenceComposition {
  tickerFactCount: number;
  backdropFactCount: number;
  /** True when the global backdrop had to be omitted because ticker facts filled the budget. */
  backdropOmitted: boolean;
}
