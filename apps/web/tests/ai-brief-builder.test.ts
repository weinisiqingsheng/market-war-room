import { describe, expect, it } from "vitest";
import { buildEvidenceFacts } from "@/lib/ai-brief/evidence";
import type { EvidenceBuilderInput, EvidenceFact } from "@/lib/ai-brief/types";

function fixture(): EvidenceBuilderInput {
  return {
    market: {
      asOf: "2026-09-04T19:45:00Z",
      freshness: "fresh",
      indices: [
        { ticker: "SPY", changePct: -0.4 },
        { ticker: "QQQ", changePct: 0.6 },
        { ticker: "IWM", changePct: 1.2 },
        { ticker: "DIA", changePct: -0.05 },
      ],
      sectors: [
        { ticker: "XLK", changePct: 0.7 },
        { ticker: "XLF", changePct: -0.3 },
      ],
    },
    macro: {
      asOf: "2026-09-04T20:00:00Z",
      freshness: "delayed",
      signals: [
        { id: "vix", label: "VIX", value: 14.3, changePct: null, asOf: "2026-09-04T20:00:00Z", cadence: "daily" },
        { id: "us10y", label: "US 10Y", value: 3.9, changePct: null, asOf: "2026-09-04T20:00:00Z", cadence: "daily" },
        { id: "wti", label: "WTI", value: null, changePct: 5.1, asOf: "2026-09-04T20:00:00Z", cadence: "current" },
        { id: "btc", label: "Bitcoin", value: null, changePct: -0.3, asOf: "2026-09-04T19:00:00Z", cadence: "current" },
      ],
    },
    regime: {
      asOf: "2026-09-04T19:45:00Z",
      freshness: "delayed",
      confidence: "high",
      coverage: 0.92,
      score: 48.98,
      displayScore: 49,
      label: "CAUTIOUS / NEUTRAL",
      positiveDrivers: ["Volatility supportive"],
      negativeDrivers: ["Breadth weak", "Oil pressure", "Weak participation"],
    },
    breadth: {
      asOf: "2026-09-04T19:30:00Z",
      freshness: "delayed",
      confidence: "high",
      coverage: 0.9,
      score: 24,
      participation: "Broad Selloff",
      advanceRatioPct: 34.9,
      pctAbove20: 35.0,
      pctAbove50: 46.9,
      newHighs20: 5,
      newLows20: 23,
    },
    anomalies: {
      asOf: "2026-09-04T19:45:00Z",
      freshness: "delayed",
      confidence: "medium",
      coverage: 0.9,
      effectiveAsOf: "2026-09-04T19:44:00Z",
      items: [
        { ticker: "LULU", name: "Lululemon", movePct: -17.4, anomalyScore: 100, displayScore: 100, severity: "EXTREME", returnSigma: 6.6, sectorRelativePct: -12, primaryTrigger: "RETURN SHOCK", breakout20: false, breakdown20: true, priceAsOf: "2026-09-04T19:44:00Z" },
        { ticker: "FICO", name: "Fair Isaac", movePct: -9.2, anomalyScore: 94, displayScore: 94, severity: "EXTREME", returnSigma: 5.1, sectorRelativePct: -7, primaryTrigger: "RETURN SHOCK", breakout20: false, breakdown20: true, priceAsOf: "2026-09-04T19:44:00Z" },
        { ticker: "KLAC", name: "KLA Corp", movePct: 6.1, anomalyScore: 82, displayScore: 82, severity: "HIGH", returnSigma: 3.4, sectorRelativePct: 5, primaryTrigger: "RETURN SHOCK", breakout20: true, breakdown20: false, priceAsOf: "2026-09-04T19:44:00Z" },
        { ticker: "ADBE", name: "Adobe", movePct: -4.4, anomalyScore: 74, displayScore: 74, severity: "HIGH", returnSigma: 2.9, sectorRelativePct: -3, primaryTrigger: "RETURN SHOCK", breakout20: false, breakdown20: true, priceAsOf: "2026-09-04T19:44:00Z" },
        { ticker: "SNDK", name: "SanDisk", movePct: 11.9, anomalyScore: 59, displayScore: 59, severity: "ELEVATED", returnSigma: 2.3, sectorRelativePct: 9, primaryTrigger: "VOLUME SURGE", breakout20: true, breakdown20: false, priceAsOf: "2026-09-04T19:44:00Z" },
      ],
    },
    catalysts: {
      cutoff: "2026-09-04T19:44:00Z",
      freshness: "delayed",
      items: [
        { ticker: "LULU", status: "MATCHED", catalystCutoff: "2026-09-04T19:44:00Z", primaryCatalyst: { category: "GUIDANCE", headline: "LULU guides lower", evidenceStrength: "strong", relevanceScore: 91, eventPolarity: "negative", alignment: "aligned", publishedAt: "2026-09-04T12:00:00Z", source: "Reuters" } },
        { ticker: "FICO", status: "MATCHED", catalystCutoff: "2026-09-04T19:44:00Z", primaryCatalyst: { category: "REGULATORY / LEGAL", headline: "FHFA VantageScore", evidenceStrength: "strong", relevanceScore: 88, eventPolarity: "negative", alignment: "aligned", publishedAt: "2026-09-04T13:00:00Z", source: "Reuters" } },
        { ticker: "KLAC", status: "NO CLEAR CATALYST FOUND", catalystCutoff: "2026-09-04T19:44:00Z" },
        { ticker: "ADBE", status: "MATCHED", catalystCutoff: "2026-09-04T19:44:00Z", primaryCatalyst: { category: "MANAGEMENT", headline: "Adobe names new CEO", evidenceStrength: "moderate", relevanceScore: 72, eventPolarity: null, alignment: "unknown", publishedAt: "2026-09-04T14:00:00Z", source: "Reuters" } },
        { ticker: "SNDK", status: "MATCHED", catalystCutoff: "2026-09-04T19:44:00Z", primaryCatalyst: { category: "OTHER", headline: "Memory demand context", evidenceStrength: "weak", relevanceScore: 55, eventPolarity: null, alignment: "unknown", publishedAt: "2026-09-04T14:30:00Z", source: "Reuters" } },
      ],
    },
  };
}

const factById = (facts: EvidenceFact[], id: string) => facts.find((fact) => fact.id === id);

describe("evidence builder", () => {
  it("emits domains in fixed order with canonical ids", () => {
    const facts = buildEvidenceFacts(fixture());
    expect([...new Set(facts.map((fact) => fact.domain))]).toEqual(["market", "sector", "macro", "regime", "breadth", "anomaly", "catalyst"]);
    expect(facts.slice(0, 4).map((fact) => fact.id)).toEqual(["market.spy", "market.qqq", "market.iwm", "market.dia"]);
    expect(factById(facts, "macro.vix")?.text).toContain("daily observation");
    expect(factById(facts, "macro.wti")?.text).toContain("rose 5.1%");
  });

  it("uses rose/fell/unchanged semantics with 1-decimal display rounding", () => {
    const facts = buildEvidenceFacts(fixture());
    expect(factById(facts, "market.spy")?.text).toBe("SPY fell 0.4% in the latest market observation.");
    expect(factById(facts, "market.qqq")?.text).toContain("QQQ rose 0.6%");
    expect(factById(facts, "market.dia")?.text).toContain("was unchanged");
  });

  it("omits unavailable indices/macro signals and preserves stale macro", () => {
    const input = fixture();
    input.market!.indices = input.market!.indices.filter((index) => index.ticker !== "QQQ");
    input.macro!.freshness = "stale";
    input.macro!.signals = input.macro!.signals.filter((signal) => signal.id !== "btc");
    const facts = buildEvidenceFacts(input);
    expect(factById(facts, "market.qqq")).toBeUndefined();
    expect(factById(facts, "macro.btc")).toBeUndefined();
    expect(factById(facts, "macro.vix")?.freshness).toBe("stale");
  });

  it("builds regime overall and ranked drivers (fewer tolerated)", () => {
    const facts = buildEvidenceFacts(fixture());
    expect(factById(facts, "regime.overall")?.text).toBe("Market regime is CAUTIOUS / NEUTRAL at 49/100.");
    expect(factById(facts, "regime.overall")?.data.engineVersion).toBe("regime-v1");
    expect(factById(facts, "regime.driver.negative.3")?.text).toBe("Weak participation");
    expect(factById(facts, "regime.driver.positive.2")).toBeUndefined();
  });

  it("builds five canonical breadth facts with delayed freshness", () => {
    const facts = buildEvidenceFacts(fixture());
    expect(factById(facts, "breadth.summary")?.text).toContain("breadth score is 24/100 with Broad Selloff participation");
    expect(factById(facts, "breadth.advanceRatio")?.text).toContain("34.9% of eligible");
    expect(factById(facts, "breadth.highLow")?.text).toContain("5 new 20-day highs and 23 new 20-day lows");
    expect(factById(facts, "breadth.above20")?.freshness).toBe("delayed");
  });

  it("caps anomalies at 8 and preserves anomaly-v1 ranking order", () => {
    const input = fixture();
    for (let i = 0; i < 60; i += 1) {
      input.anomalies!.items.push({ ticker: `Z${i}`, name: `Name ${i}`, movePct: 0.1, anomalyScore: 10, displayScore: 10, severity: "ELEVATED", returnSigma: 1, sectorRelativePct: null, primaryTrigger: null, breakout20: false, breakdown20: false });
    }
    const facts = buildEvidenceFacts(input);
    const anomalyFacts = facts.filter((fact) => fact.domain === "anomaly");
    expect(anomalyFacts).toHaveLength(8);
    expect(anomalyFacts[0].id).toBe("anomaly.LULU");
    expect(factById(facts, "anomaly.LULU")?.text).toContain("LULU fell 17.4%, a 6.6× 20D-volatility return shock, with anomaly score 100.");
    expect(factById(facts, "anomaly.SNDK")?.text).toContain("SNDK rose 11.9%");
    expect(factById(facts, "anomaly.LULU")?.data.effectiveAsOf).toBe("2026-09-04T19:44:00Z");
  });
});



describe("catalyst + safety + determinism", () => {
  it("emits matched and none catalyst facts only for included anomaly tickers", () => {
    const facts = buildEvidenceFacts(fixture());
    expect(factById(facts, "catalyst.LULU.primary")?.text).toBe("LULU's strongest matched catalyst is GUIDANCE, with strong evidence.");
    expect(factById(facts, "catalyst.FICO.primary")?.text).toContain("REGULATORY / LEGAL");
    expect(factById(facts, "catalyst.ADBE.primary")?.text).toContain("MANAGEMENT, with moderate evidence");
    expect(factById(facts, "catalyst.SNDK.primary")?.text).toContain("OTHER, with weak evidence");
    expect(factById(facts, "catalyst.KLAC.none")?.text).toBe("No sufficiently strong company-specific catalyst was identified for KLAC.");
    expect(facts.some((fact) => fact.id === "catalyst.EFX.primary")).toBe(false);
    expect(facts.filter((fact) => fact.domain === "catalyst")).toHaveLength(5);
    expect(facts.some((fact) => /caused|confirmed cause|because/.test(fact.text))).toBe(false);
  });

  it("is deterministic across input key order and stays bounded", () => {
    const base = fixture();
    const a = buildEvidenceFacts(base);
    const shuffled: EvidenceBuilderInput = { catalysts: base.catalysts, anomalies: base.anomalies, breadth: base.breadth, regime: base.regime, macro: base.macro, market: base.market };
    expect(buildEvidenceFacts(shuffled)).toEqual(a);
    const count = a.length;
    expect(count).toBeGreaterThan(20);
    expect(count).toBeLessThanOrEqual(50);
  });

  it("rejects duplicate fact ids deterministically", () => {
    const dup = fixture();
    dup.anomalies!.items.unshift({ ...dup.anomalies!.items[0] });
    expect(() => buildEvidenceFacts(dup)).toThrow(/Duplicate evidence fact id/);
  });
});
