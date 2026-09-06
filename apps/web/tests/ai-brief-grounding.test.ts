import { describe, expect, it } from "vitest";
import { buildBriefContext } from "@/lib/ai-brief/context";
import { buildDemoBriefContext, DEMO_GENERATED_AT, demoContextInputs } from "@/lib/ai-brief/demo-context";
import { validateGroundedMarketBrief } from "@/lib/ai-brief/grounding-validator";
import type { GroundedMarketBrief } from "@/lib/ai-brief/brief-types";

const section = (text: string, ...evidenceRefs: string[]) => ({ text, evidenceRefs });

function validBrief(): GroundedMarketBrief {
  return {
    version: "ai-brief-v1",
    headline: "Weak breadth offsets calm volatility",
    stance: { label: "CAUTIOUS / NEUTRAL", summary: "Cautious regime with weak participation.", evidenceRefs: ["regime.overall", "breadth.summary"] },
    overview: [section("The regime is CAUTIOUS / NEUTRAL at 49/100.", "regime.overall")],
    keyDrivers: [
      { title: "Breadth", text: "Only 34.9% of members advanced.", impact: "negative", evidenceRefs: ["breadth.advanceRatio"] },
      { title: "Oil", text: "WTI rose 5.1%.", impact: "negative", evidenceRefs: ["macro.wti"] },
    ],
    marketInternals: section("35.0% of constituents were above their 20-day moving average.", "breadth.above20"),
    macro: section("VIX was 14.3 in the latest available daily observation.", "macro.vix"),
    notableMoves: [
      { ticker: "LULU", text: "LULU fell 17.4%; the selloff followed weak guidance, the strongest matched catalyst in the evidence set.", evidenceRefs: ["anomaly.LULU", "catalyst.LULU.primary"] },
      { ticker: "FICO", text: "FICO fell 16.7% alongside a regulatory/legal match tied to FHFA and VantageScore.", evidenceRefs: ["anomaly.FICO", "catalyst.FICO.primary"] },
      { ticker: "KLAC", text: "KLAC rallied 7.3%, but no sufficiently strong company-specific catalyst was identified.", evidenceRefs: ["anomaly.KLAC", "catalyst.KLAC.none"] },
    ],
    watchNext: [section("Watch whether weak breadth improves.", "breadth.summary")],
    dataQuality: { confidence: "high", text: "All primary domains available.", evidenceRefs: ["breadth.summary"] },
  };
}
const codes = (brief: GroundedMarketBrief, context: ReturnType<typeof buildDemoBriefContext>) => validateGroundedMarketBrief(brief, context).valid ? [] : (validateGroundedMarketBrief(brief, context) as { issues: Array<{ code: string }> }).issues.map((i) => i.code);

describe("grounding validator", () => {
  const demo = buildDemoBriefContext();
  it("fully grounded brief validates; deterministic, non-mutating", () => {
    expect(codes(validBrief(), demo)).toEqual([]);
    expect(codes(validBrief(), demo)).toEqual(codes(validBrief(), demo));
    expect(demo.evidence.length).toBe(49);
  });
  it("unknown refs / stance / section alignment", () => {
    const a = validBrief(); a.overview[0].evidenceRefs = ["breadth.nope"];
    expect(codes(a, demo)).toContain("UNKNOWN_EVIDENCE_REF");
    const b = validBrief(); b.stance.evidenceRefs = ["breadth.summary"];
    expect(codes(b, demo)).toContain("STANCE_MISSING_REGIME_REF");
    const c = validBrief(); c.macro.evidenceRefs = ["breadth.summary"];
    expect(codes(c, demo)).toContain("SECTION_DOMAIN_MISMATCH");
    const d = validBrief(); d.marketInternals.evidenceRefs = ["macro.vix"];
    expect(codes(d, demo)).toContain("SECTION_DOMAIN_MISMATCH");
  });
  it("notable-move alignment and catalyst rules", () => {
    const a = validBrief(); a.notableMoves[0].ticker = "TSLA";
    expect(codes(a, demo)).toContain("UNKNOWN_NOTABLE_TICKER");
    const b = validBrief(); b.notableMoves[1].evidenceRefs = ["anomaly.FICO", "catalyst.EFX.primary"];
    expect(codes(b, demo)).toContain("CROSS_TICKER_CATALYST_REF");
    const c = validBrief(); c.notableMoves[2].text = "KLAC rallied after earnings.";
    expect(codes(c, demo)).toContain("NO_CLEAR_CATALYST_CONTRADICTION");
    const d = validBrief(); d.notableMoves[0].text = "Guidance caused LULU's decline.";
    expect(codes(d, demo)).toContain("ABSOLUTE_CAUSALITY");
  });
  it("numbers and future events", () => {
    const a = validBrief(); a.notableMoves[0].text = "LULU fell 17% after weak guidance.";
    expect(codes(a, demo)).toContain("UNSUPPORTED_NUMBER");
    const b = validBrief(); b.headline = "Breadth falls to 24/100";
    expect(codes(b, demo)).toContain("UNSUPPORTED_NUMBER");
    const c = validBrief(); c.watchNext[0].text = "Watch CPI tomorrow.";
    expect(codes(c, demo)).toContain("UNSUPPORTED_FUTURE_EVENT");
    const fine = validBrief(); fine.notableMoves[0].text = "LULU fell 17.4% (a 6.6x shock) after weak guidance, the strongest matched catalyst.";
    expect(codes(fine, demo)).toEqual([]);
  });
  it("confidence consistency and insufficient context", () => {
    const a = validBrief(); a.dataQuality.confidence = "medium";
    expect(codes(a, demo)).toContain("DATA_QUALITY_CONFIDENCE_MISMATCH");
    const inputs = demoContextInputs();
    for (const key of Object.keys(inputs.sources) as Array<keyof typeof inputs.sources>) {
      const meta = { available: false, asOf: null, freshness: "unavailable" as const, confidence: null, version: null };
      inputs.sources[key] = meta;
      inputs.confidenceInput[key].meta = meta;
    }
    const insufficient = buildBriefContext({ generatedAt: DEMO_GENERATED_AT, evidenceInput: inputs.evidenceInput, sources: inputs.sources, confidenceInput: inputs.confidenceInput });
    const result = validateGroundedMarketBrief(validBrief(), insufficient);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.issues[0].code).toBe("INSUFFICIENT_CONTEXT");
  });
});
