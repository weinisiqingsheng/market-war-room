/**
 * Phase 7A.1 — canonical evidence types (brief-context-v1).
 *
 * The Evidence Pack is a deterministic fact bank that downstream LLM
 * generation (Phase 7B) may consume. These types are public-internal: stable
 * IDs, JSON-safe values, per-domain timestamps and freshness — never
 * orchestration time masquerading as data time.
 */

export const BRIEF_CONTEXT_VERSION = "brief-context-v1";

export type EvidenceDomain = "market" | "sector" | "macro" | "regime" | "breadth" | "anomaly" | "catalyst";
export type EvidenceFreshness = "fresh" | "delayed" | "stale" | "unavailable";
export type EvidenceConfidence = "high" | "medium" | "low" | "insufficient";

/* ── JSON-safe value contract (no any/unknown escape hatch) ─────────────── */
export type JSONPrimitive = string | number | boolean | null;
export type JSONValue = JSONPrimitive | JSONValue[] | { [key: string]: JSONValue };
export type JSONObject = { [key: string]: JSONValue };

export interface EvidenceFact {
  id: string;
  domain: EvidenceDomain;
  text: string;
  data: JSONObject;
  asOf: string | null;
  freshness: EvidenceFreshness;
  confidence: EvidenceConfidence | null;
  sourceVersion: string | null;
}

export interface BriefSourceMeta {
  available: boolean;
  asOf: string | null;
  freshness: EvidenceFreshness;
  confidence: EvidenceConfidence | null;
  version: string | null;
}

export interface BriefInputConfidence {
  score: number;
  label: EvidenceConfidence;
}

export interface BriefContext {
  version: "brief-context-v1";
  /** Orchestration time — intentionally excluded from the fingerprint. */
  generatedAt: string;
  sources: {
    market: BriefSourceMeta;
    macro: BriefSourceMeta;
    regime: BriefSourceMeta;
    breadth: BriefSourceMeta;
    anomalies: BriefSourceMeta;
    catalysts: BriefSourceMeta;
  };
  evidence: EvidenceFact[];
  inputConfidence: BriefInputConfidence;
  fingerprint: string;
}


/* ── Phase 7A.2 — normalized EvidenceBuilder inputs (downstream adapters) ── */
export interface IndexEvidenceInput { ticker: string; changePct: number }
export interface SectorEvidenceInput { ticker: string; changePct: number }
export interface MarketEvidenceInput {
  asOf: string | null;
  freshness: EvidenceFreshness;
  indices: IndexEvidenceInput[];
  sectors?: SectorEvidenceInput[];
}

export interface MacroSignalEvidenceInput {
  id: string; // vix | us10y | usdBroad | wti | gold | btc
  label?: string;
  value: number | null;
  changePct: number | null;
  asOf: string | null;
  cadence: string; // daily | current | intraday
  freshness?: EvidenceFreshness;
}
export interface MacroEvidenceInput {
  asOf: string | null;
  freshness: EvidenceFreshness;
  signals: MacroSignalEvidenceInput[];
}

export interface RegimeEvidenceInput {
  asOf: string | null;
  freshness: EvidenceFreshness;
  confidence: EvidenceConfidence | null;
  coverage: number | null;
  score: number | null;
  displayScore: number | null;
  label: string | null;
  positiveDrivers: string[];
  negativeDrivers: string[];
}

export interface BreadthEvidenceInput {
  asOf: string | null;
  freshness: EvidenceFreshness;
  confidence: EvidenceConfidence | null;
  coverage: number | null;
  score: number | null;
  participation: string | null;
  advanceRatioPct: number | null;
  pctAbove20: number | null;
  pctAbove50: number | null;
  newHighs20: number | null;
  newLows20: number | null;
}

export interface AnomalyEvidenceInput {
  asOf: string | null;
  freshness: EvidenceFreshness;
  confidence: EvidenceConfidence | null;
  coverage: number | null;
  effectiveAsOf: string | null;
  items: Array<{
    ticker: string;
    name: string;
    movePct: number;
    anomalyScore: number;
    displayScore: number | null;
    severity: string;
    returnSigma: number | null;
    sectorRelativePct: number | null;
    primaryTrigger: string | null;
    breakout20: boolean;
    breakdown20: boolean;
    priceAsOf?: string | null;
  }>;
}

export interface CatalystPrimaryEvidenceInput {
  category: string;
  headline: string | null;
  evidenceStrength: string; // strong | moderate | weak
  relevanceScore: number | null;
  eventPolarity: string | null;
  alignment: string | null;
  publishedAt: string | null;
  source: string | null;
}
export interface CatalystItemEvidenceInput {
  ticker: string;
  status: string; // MATCHED | NO CLEAR CATALYST FOUND
  catalystCutoff: string | null;
  primaryCatalyst?: CatalystPrimaryEvidenceInput | null;
}
export interface CatalystsEvidenceInput {
  cutoff: string | null;
  freshness: EvidenceFreshness;
  items: CatalystItemEvidenceInput[];
}

export interface EvidenceBuilderInput {
  market?: MarketEvidenceInput;
  macro?: MacroEvidenceInput;
  regime?: RegimeEvidenceInput;
  breadth?: BreadthEvidenceInput;
  anomalies?: AnomalyEvidenceInput;
  catalysts?: CatalystsEvidenceInput;
}

/* ── Phase 7A.3 — deterministic input-confidence contract ───────────────── */
export interface BriefDomainQualityInput {
  meta: BriefSourceMeta;
  /** Normalized 0..1 coverage (caller computes it; default 1). */
  coverage?: number | null;
  /** Generic 0..1 degradation multiplier (default 1). Provider-agnostic. */
  reliabilityFactor?: number | null;
}

export interface BriefConfidenceInput {
  market: BriefDomainQualityInput;
  macro: BriefDomainQualityInput;
  regime: BriefDomainQualityInput;
  breadth: BriefDomainQualityInput;
  anomalies: BriefDomainQualityInput;
  catalysts: BriefDomainQualityInput;
}

export interface BriefDomainConfidenceDetail {
  weight: number;
  quality: number;
  contribution: number;
}

export interface BriefInputConfidenceDetailed {
  score: number;
  label: EvidenceConfidence;
  domains: {
    market: BriefDomainConfidenceDetail;
    macro: BriefDomainConfidenceDetail;
    regime: BriefDomainConfidenceDetail;
    breadth: BriefDomainConfidenceDetail;
    anomalies: BriefDomainConfidenceDetail;
    catalysts: BriefDomainConfidenceDetail;
  };
}

