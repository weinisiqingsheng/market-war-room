/** Catalyst Intelligence domain types (catalyst-match-v1). */
export const CATALYST_ENGINE_VERSION = "catalyst-match-v1";

export type EvidenceSourceType = "news" | "sec_filing" | "corporate_action";
export type EvidenceStrength = "strong" | "moderate" | "weak";
export type EventPolarity = "positive" | "negative" | "unknown";
export type Alignment = "aligned" | "divergent" | "unknown";

export type CatalystCategory =
  | "EARNINGS"
  | "GUIDANCE"
  | "ANALYST ACTION"
  | "M&A / STRATEGIC"
  | "REGULATORY / LEGAL"
  | "FINANCING / OFFERING"
  | "CAPITAL RETURN"
  | "PRODUCT / CONTRACT"
  | "MANAGEMENT"
  | "CORPORATE ACTION"
  | "SEC FILING"
  | "MACRO / SECTOR"
  | "OTHER";

export interface NewsArticle {
  id: string;
  headline: string;
  summary: string;
  source: string;
  author: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  publishedAt: string;
  symbols: string[];
  url: string;
}

export interface SecFiling {
  cik: string;
  ticker: string;
  form: string;
  filingDate: string | null;
  acceptanceDateTime: string | null;
  accessionNumber: string;
  primaryDocument: string;
  filingUrl: string;
}

export interface CorporateActionEvidence {
  ticker: string;
  type: string;
  date: string | null;
  description: string;
  url: string;
}

export interface CatalystMatch {
  category: CatalystCategory;
  headline: string;
  publishedAt: string | null;
  source: string;
  sourceType: EvidenceSourceType;
  url: string;
  relevanceScore: number;
  evidenceStrength: EvidenceStrength;
  eventPolarity: EventPolarity;
  symbols: string[];
  supportingEvidence: string[];
}

export interface CatalystItem {
  ticker: string;
  name: string;
  movePct: number;
  anomalyScore: number;
  anomalySeverity: string;
  status: "MATCHED" | "NO CLEAR CATALYST FOUND";
  primaryCatalyst: CatalystMatch | null;
  secondaryCatalysts: CatalystMatch[];
  alignment: Alignment;
  /** Candidate-specific evidence cutoff (min of priceAsOf, overview effectiveAsOf). */
  catalystCutoff: string | null;
  evidence: { newsCount: number; filingCount: number; corporateActionCount: number };
}

export interface CatalystOverviewMeta {
  mode: "demo" | "live";
  engineVersion: string;
  anomalyVersion: string;
  candidateCount: number;
  matchedCount: number;
  unmatchedCount: number;
  /** Orchestration time of the underlying anomaly overview. */
  generatedAt: string | null;
  /** Effective market-data time of the anomaly prices (never orchestration time). */
  effectiveAsOf: string | null;
  /** Hard evidence cutoff == anomaly effectiveAsOf. */
  asOf: string | null;
  /** Alias of effectiveAsOf; backward-compatible semantic = price time. */
  catalystCutoff: string | null;
  providers: { news: "ok" | "disabled" | "error"; sec: "ok" | "disabled" | "error"; corporateActions: "ok" | "disabled" | "error" };
}

export interface CatalystOverview {
  meta: CatalystOverviewMeta;
  items: CatalystItem[];
}
