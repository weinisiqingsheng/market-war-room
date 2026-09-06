import { describe, expect, it } from "vitest";
import { buildBriefContext } from "@/lib/ai-brief/context";
import { buildDemoBriefContext, DEMO_GENERATED_AT, demoContextInputs } from "@/lib/ai-brief/demo-context";
import type { BriefContext } from "@/lib/ai-brief/types";

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

function rebuild(inputs: ReturnType<typeof demoContextInputs>, generatedAt = DEMO_GENERATED_AT): BriefContext {
  return buildBriefContext({ generatedAt, evidenceInput: inputs.evidenceInput, sources: inputs.sources, confidenceInput: inputs.confidenceInput });
}

const byId = (ctx: BriefContext, id: string) => ctx.evidence.find((fact) => fact.id === id);

describe("context assembly", () => {
  const demo = buildDemoBriefContext();
  it("version/generatedAt/fingerprint/confidence invariants hold", () => {
    expect(demo.version).toBe("brief-context-v1");
    expect(demo.generatedAt).toBe(DEMO_GENERATED_AT);
    expect(demo.fingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(demo.inputConfidence.label).toBe("high");
    expect(demo.inputConfidence.score).toBeGreaterThanOrEqual(0.9);
    expect(demo.evidence.length).toBeGreaterThanOrEqual(40);
    expect(demo.evidence.length).toBeLessThanOrEqual(49);
  });
  it("six source families are present with honest freshness", () => {
    expect(Object.keys(demo.sources)).toEqual(["market", "macro", "regime", "breadth", "anomalies", "catalysts"]);
    expect(demo.sources.market.freshness).toBe("fresh");
    expect(demo.sources.breadth.freshness).toBe("delayed");
    expect(demo.sources.anomalies.freshness).toBe("delayed");
    expect(demo.sources.macro.freshness).toBe("stale");
  });
  it("fixture content reflects the validated Friday state", () => {
    expect(byId(demo, "regime.overall")?.text).toContain("CAUTIOUS / NEUTRAL at 49/100");
    expect(byId(demo, "breadth.summary")?.text).toContain("24/100 with Broad Selloff");
    expect(byId(demo, "anomaly.LULU")).toBeDefined();
    expect(byId(demo, "catalyst.FICO.primary")?.text).toContain("REGULATORY / LEGAL");
    expect(byId(demo, "catalyst.EFX.primary")?.text).toContain("REGULATORY / LEGAL");
    expect(byId(demo, "catalyst.ADBE.primary")?.text).toContain("MANAGEMENT");
    expect(byId(demo, "catalyst.KLAC.none")?.text).toContain("No sufficiently strong");
    expect(byId(demo, "catalyst.SNDK.primary")).toBeUndefined();
    expect(demo.evidence.length).toBe(49);
  });
});

describe("fingerprint integration", () => {
  it("same fixture + generatedAt-only change → same fingerprint", () => {
    const inputs = demoContextInputs();
    const a = rebuild(inputs);
    const b = rebuild(clone(inputs), "2026-09-06T03:00:00.000Z");
    expect(a.fingerprint).toBe(b.fingerprint);
    expect(a.generatedAt).not.toBe(b.generatedAt);
  });
  it("SPY / breadth / catalyst / confidence / source-version changes → new fingerprints", () => {
    const base = demoContextInputs();
    const spy = clone(base);
    spy.evidenceInput.market!.indices[0].changePct = 0.4;
    const breadth = clone(base);
    breadth.evidenceInput.breadth!.score = 30;
    const catalyst = clone(base);
    catalyst.evidenceInput.catalysts!.items[0].primaryCatalyst!.category = "EARNINGS";
    const confidence = clone(base);
    confidence.confidenceInput.catalysts.reliabilityFactor = 0.5;
    const version = clone(base);
    version.sources.anomalies.version = "anomaly-v2";
    const fpBase = rebuild(base).fingerprint;
    expect(rebuild(spy).fingerprint).not.toBe(fpBase);
    expect(rebuild(breadth).fingerprint).not.toBe(fpBase);
    expect(rebuild(catalyst).fingerprint).not.toBe(fpBase);
    expect(rebuild(confidence).fingerprint).not.toBe(fpBase);
    expect(rebuild(version).fingerprint).not.toBe(fpBase);
  });
});

describe("security and determinism", () => {
  it("no secrets, raw bodies, or provider payloads leak", () => {
    const serialized = JSON.stringify(buildDemoBriefContext());
    expect(serialized).not.toMatch(/api[-_ ]?key|secret|Bearer|PRIVATE KEY/i);
    expect(serialized).not.toMatch(/corporate_actions|acceptanceDateTime|accessionNumber|alpine|alpaca/i);
    expect(serialized).not.toMatch(/system prompt|You are|grounding/i);
  });
  it("builder is deterministic for identical normalized inputs", () => {
    const inputs = demoContextInputs();
    expect(rebuild(inputs)).toEqual(rebuild(clone(inputs)));
    expect(buildDemoBriefContext()).toEqual(buildDemoBriefContext());
  });
});
