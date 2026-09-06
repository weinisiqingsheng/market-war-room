/** Phase 7B.1 — ai-brief-v1 structured output contract (no generation yet). */
export const AI_BRIEF_VERSION = "ai-brief-v1";

export interface BriefSection {
  text: string;
  evidenceRefs: string[];
}

export interface GroundedMarketBrief {
  version: "ai-brief-v1";
  headline: string;
  stance: {
    label: string;
    summary: string;
    evidenceRefs: string[];
  };
  overview: BriefSection[];
  keyDrivers: Array<BriefSection & { title: string; impact: "positive" | "negative" | "mixed" }>;
  marketInternals: BriefSection;
  macro: BriefSection;
  notableMoves: Array<BriefSection & { ticker: string }>;
  watchNext: BriefSection[];
  dataQuality: BriefSection & { confidence: "high" | "medium" | "low" };
}
