import { describe, expect, it } from "vitest";
import { adaptBreadthOverview } from "@/lib/ai-brief/adapters";
import { buildEvidenceFacts } from "@/lib/ai-brief/evidence";
import { projectBriefContext } from "@/lib/ai-brief/serialize-context";
import type { BriefContext } from "@/lib/ai-brief/types";
import { selectEvidenceForQuestion } from "@/lib/ask-sakura/select-evidence";
import type { BreadthOverview } from "@/lib/breadth/types";

/** Real breadth-v1 contract: every participation ratio is 0–1. */
function snapshot(metrics: Partial<BreadthOverview["metrics"]>): BreadthOverview {
  return {
    mode: "live",
    score: 42,
    displayScore: 42,
    engineVersion: "breadth-v1",
    state: { key: "MIXED_PARTICIPATION", label: "Mixed Participation" },
    metrics: {
      universeCount: 503,
      currentCoverageCount: 500,
      historical20CoverageCount: 500,
      historical50CoverageCount: 500,
      coveragePct: 0.97,
      advancers: 95,
      decliners: 405,
      unchanged: 3,
      advanceRatio: 0.19,
      above20Pct: 0.349,
      above50Pct: 0.5,
      newHighs20: 3,
      newLows20: 87,
      ...metrics,
    },
    universe: { name: "S&P 500", version: "sp500-v1", asOf: "2026-09-19", count: 503 },
    meta: {
      provider: "alpaca",
      feed: "delayed_sip",
      delayMinutes: 15,
      asOf: "2026-09-19T20:00:00.000Z",
      marketOpen: false,
    },
    confidence: "high",
  };
}

function textFor(id: string, overview: BreadthOverview): string {
  const out = adaptBreadthOverview(overview);
  const facts = buildEvidenceFacts({ breadth: out.evidenceInput! });
  return facts.find((fact) => fact.id === id)?.text ?? "";
}

describe("breadth percentages at the adapter boundary (targeted fix)", () => {
  it("converts each 0–1 ratio to a percentage exactly once", () => {
    const out = adaptBreadthOverview(
      snapshot({ advanceRatio: 0.19, above20Pct: 0.349, above50Pct: 0.5 }),
    );
    expect(out.evidenceInput?.advanceRatioPct).toBeCloseTo(19, 6);
    expect(out.evidenceInput?.pctAbove20).toBeCloseTo(34.9, 6);
    expect(out.evidenceInput?.pctAbove50).toBeCloseTo(50, 6);
    // Never double-converts, and coverage stays a fraction.
    expect(out.evidenceInput?.coverage).toBe(0.97);
  });

  it("handles the 1 → 100% boundary and the null case without inventing values", () => {
    const full = adaptBreadthOverview(snapshot({ advanceRatio: 1, above20Pct: 1, above50Pct: 1 }));
    expect(full.evidenceInput?.advanceRatioPct).toBe(100);
    expect(full.evidenceInput?.pctAbove20).toBe(100);
    expect(full.evidenceInput?.pctAbove50).toBe(100);

    const missing = adaptBreadthOverview(
      snapshot({ advanceRatio: null, above20Pct: null, above50Pct: null }),
    );
    expect(missing.evidenceInput?.advanceRatioPct).toBeNull();
    expect(missing.evidenceInput?.pctAbove20).toBeNull();
    expect(missing.evidenceInput?.pctAbove50).toBeNull();
    const ids = buildEvidenceFacts({ breadth: missing.evidenceInput! }).map((fact) => fact.id);
    expect(ids).not.toContain("breadth.above20");
    expect(ids).not.toContain("breadth.above50");
  });

  it("renders the corrected percentages in EvidenceFact.text", () => {
    const overview = snapshot({});
    expect(textFor("breadth.advanceRatio", overview)).toBe(
      "19.0% of eligible S&P 500 members advanced.",
    );
    expect(textFor("breadth.above20", overview)).toBe(
      "34.9% of constituents were above their 20-day moving average.",
    );
    expect(textFor("breadth.above50", overview)).toBe(
      "50.0% of constituents were above their 50-day moving average.",
    );
    // Counts and score were already correct and must stay untouched.
    expect(textFor("breadth.highLow", overview)).toBe(
      "There were 3 new 20-day highs and 87 new 20-day lows.",
    );
    expect(textFor("breadth.summary", overview)).toContain("42/100");
  });

  it("keeps one snapshot numerically consistent across every surface", () => {
    const overview = snapshot({});
    const out = adaptBreadthOverview(overview);
    const facts = buildEvidenceFacts({ breadth: out.evidenceInput! });
    const byId = new Map(facts.map((fact) => [fact.id, fact]));

    const context: BriefContext = {
      version: "brief-context-v1",
      generatedAt: "2026-09-19T20:05:00.000Z",
      sources: {
        market: { available: false, asOf: null, freshness: "unavailable", confidence: null, version: null },
        macro: { available: false, asOf: null, freshness: "unavailable", confidence: null, version: null },
        regime: { available: false, asOf: null, freshness: "unavailable", confidence: null, version: null },
        breadth: out.sourceMeta,
        anomalies: { available: false, asOf: null, freshness: "unavailable", confidence: null, version: null },
        catalysts: { available: false, asOf: null, freshness: "unavailable", confidence: null, version: null },
      },
      evidence: facts,
      inputConfidence: { score: 0.97, label: "high" },
      fingerprint: "f".repeat(64),
    };

    // Evidence Explorer + AI Brief input: identical model-facing projection.
    const projection = projectBriefContext(context);
    expect(projection.evidence.find((fact) => fact.id === "breadth.above20")?.text).toBe(
      byId.get("breadth.above20")?.text,
    );
    expect(projection.evidence.find((fact) => fact.id === "breadth.advanceRatio")?.text).toBe(
      "19.0% of eligible S&P 500 members advanced.",
    );

    // Ask Sakura: the same fact text reaches the selected evidence.
    const selection = selectEvidenceForQuestion(context, "Is market breadth weak?");
    expect(selection.facts.find((fact) => fact.id === "breadth.above20")?.text).toBe(
      byId.get("breadth.above20")?.text,
    );
    expect(selection.facts.map((fact) => fact.id)).toContain("breadth.above50");

    // Breadth UI convention (ratio × 100) agrees with the evidence values.
    expect(Math.round((overview.metrics.advanceRatio ?? 0) * 100)).toBe(19);
    expect(Math.round((overview.metrics.above20Pct ?? 0) * 100)).toBe(35);
    expect(Math.round((overview.metrics.above50Pct ?? 0) * 100)).toBe(50);
    expect(byId.get("breadth.above20")?.text).toContain("34.9%");
    expect(byId.get("breadth.above50")?.text).toContain("50.0%");
    // Coverage is a fraction in evidence data, never "97%".
    expect(JSON.stringify(byId.get("breadth.summary")?.data)).toContain("0.97");
  });
});
