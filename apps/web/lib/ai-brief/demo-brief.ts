import type { GroundedMarketBrief } from "./brief-types";

const section = (text: string, ...evidenceRefs: string[]) => ({ text, evidenceRefs });

/** Deterministic ai-brief-v1 demo fixture. Validates against buildDemoBriefContext(). */
export function buildDemoGroundedBrief(): GroundedMarketBrief {
  return {
    version: "ai-brief-v1",
    headline: "Weak breadth offsets calm volatility",
    stance: { label: "CAUTIOUS / NEUTRAL", summary: "Cautious regime with weak participation and calm volatility.", evidenceRefs: ["regime.overall", "breadth.summary", "macro.vix"] },
    overview: [
      section("The regime is CAUTIOUS / NEUTRAL at 49/100.", "regime.overall"),
      section("Breadth is weak at 24/100 with Broad Selloff participation.", "breadth.summary"),
    ],
    keyDrivers: [
      { title: "Weak breadth", text: "Only 34.9% of members advanced.", impact: "negative", evidenceRefs: ["breadth.advanceRatio"] },
      { title: "Oil pressure", text: "WTI rose 5.1%.", impact: "negative", evidenceRefs: ["macro.wti"] },
    ],
    marketInternals: section("35.0% of constituents were above their 20-day moving average.", "breadth.above20"),
    macro: section("VIX was 14.3 in the latest available daily observation.", "macro.vix"),
    notableMoves: [
      { ticker: "LULU", text: "LULU fell 17.4%; the selloff followed weak guidance, the strongest matched catalyst in the evidence set.", evidenceRefs: ["anomaly.LULU", "catalyst.LULU.primary"] },
      { ticker: "KLAC", text: "KLAC rallied 7.3%, but no sufficiently strong company-specific catalyst was identified.", evidenceRefs: ["anomaly.KLAC", "catalyst.KLAC.none"] },
    ],
    watchNext: [section("Watch whether weak breadth improves.", "breadth.summary")],
    dataQuality: { confidence: "high", text: "All primary domains available; catalysts partially degraded but usable.", evidenceRefs: ["breadth.summary", "catalyst.LULU.primary"] },
  };
}
