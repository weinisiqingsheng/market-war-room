import { describe, expect, it } from "vitest";
import { computeBriefInputConfidence, computeBriefInputConfidenceDetailed, DOMAIN_WEIGHTS, confidenceLabel } from "@/lib/ai-brief/confidence";
import type { BriefConfidenceInput, BriefDomainQualityInput, BriefSourceMeta, EvidenceConfidence } from "@/lib/ai-brief/types";

type DomainOverride = Partial<Omit<BriefDomainQualityInput, "meta">> & { meta?: Partial<BriefSourceMeta> };

function quality(overrides: DomainOverride = {}): BriefDomainQualityInput {
  const { meta: partialMeta, ...rest } = overrides;
  return {
    meta: { available: true, asOf: "2026-09-04T20:00:00Z", freshness: "fresh", confidence: "high", version: "x", ...(partialMeta ?? {}) } as BriefSourceMeta,
    ...rest,
  };
}

function stack(overrides: Partial<Record<keyof BriefConfidenceInput, DomainOverride>> = {}): BriefConfidenceInput {
  return {
    market: quality(overrides.market),
    macro: quality(overrides.macro),
    regime: quality(overrides.regime),
    breadth: quality(overrides.breadth),
    anomalies: quality(overrides.anomalies),
    catalysts: quality(overrides.catalysts),
  };
}

describe("input confidence — factor mappings and stacks", () => {
  it("all healthy → 1.0 / high", () => {
    expect(computeBriefInputConfidence(stack()).score).toBe(1.0);
  });
  it("delayed breadth/anomalies keep 0.95 freshness quality", () => {
    const result = computeBriefInputConfidenceDetailed(stack({ breadth: { meta: { freshness: "delayed" } }, anomalies: { meta: { freshness: "delayed" } } }));
    expect(result.domains.breadth.quality).toBe(0.95);
    expect(result.domains.anomalies.quality).toBe(0.95);
  });
  it("catalyst reliability 0.85 degrades without zeroing; delayed stack stays high", () => {
    const input = stack({
      breadth: { meta: { freshness: "delayed" } },
      anomalies: { meta: { freshness: "delayed" } },
      catalysts: { meta: { freshness: "delayed" }, reliabilityFactor: 0.85 },
    });
    expect(computeBriefInputConfidence(input).label).toBe("high");
    expect(computeBriefInputConfidenceDetailed(input).domains.catalysts.contribution).toBeCloseTo(0.15 * 0.95 * 0.85, 6);
  });
  it("stale macro reduces total score", () => {
    const healthy = computeBriefInputConfidence(stack()).score;
    const stale = computeBriefInputConfidence(stack({ macro: { meta: { freshness: "stale" } } })).score;
    expect(healthy - stale).toBeCloseTo(0.15 * 0.25, 6);
  });
  it("unavailable macro contributes exactly zero, weight not renormalized", () => {
    const result = computeBriefInputConfidenceDetailed(stack({ macro: { meta: { available: false, freshness: "unavailable", confidence: "high" } } }));
    expect(result.domains.macro.contribution).toBe(0);
    expect(result.score).toBeCloseTo(0.85, 6);
  });
  it("maps medium/low/insufficient/null confidence factors", () => {
    const conf = (confidence: EvidenceConfidence) => stack({ regime: { meta: { confidence } } });
    expect(computeBriefInputConfidenceDetailed(conf("medium")).domains.regime.quality).toBe(0.85);
    expect(computeBriefInputConfidenceDetailed(conf("low")).domains.regime.quality).toBe(0.65);
    expect(computeBriefInputConfidenceDetailed(conf("insufficient")).domains.regime.quality).toBe(0);
    expect(computeBriefInputConfidenceDetailed(stack({ market: { meta: { confidence: null } } })).domains.market.quality).toBe(1);
  });
  it("partial coverage reduces contribution proportionally", () => {
    expect(computeBriefInputConfidenceDetailed(stack({ anomalies: { coverage: 0.5 } })).domains.anomalies.contribution).toBeCloseTo(0.15 * 0.5, 6);
  });
  it("unavailable freshness / available=false override healthy metadata", () => {
    expect(computeBriefInputConfidenceDetailed(stack({ macro: { meta: { freshness: "unavailable", confidence: "high" } } })).domains.macro.quality).toBe(0);
    expect(computeBriefInputConfidenceDetailed(stack({ macro: { meta: { available: false, freshness: "fresh", confidence: "high" } } })).domains.macro.quality).toBe(0);
  });
  it("domain weights sum to 1.0", () => {
    expect(Object.values(DOMAIN_WEIGHTS).reduce((sum, weight) => sum + weight, 0)).toBeCloseTo(1.0, 10);
  });
});

describe("input confidence — boundaries, validation, determinism", () => {
  it("exact label boundaries", () => {
    expect(confidenceLabel(0.9)).toBe("high");
    expect(confidenceLabel(0.75)).toBe("medium");
    expect(confidenceLabel(0.6)).toBe("low");
    expect(confidenceLabel(0.5999)).toBe("insufficient");
  });
  it("invalid coverage and reliability values throw deterministically", () => {
    expect(() => computeBriefInputConfidence(stack({ market: { coverage: -0.2 } }))).toThrow(/market.coverage/);
    expect(() => computeBriefInputConfidence(stack({ regime: { coverage: 1.4 } }))).toThrow(/regime.coverage/);
    expect(() => computeBriefInputConfidence(stack({ macro: { coverage: Number.NaN } }))).toThrow(/macro.coverage/);
    expect(() => computeBriefInputConfidence(stack({ catalysts: { reliabilityFactor: 1.4 } }))).toThrow(/catalysts.reliabilityFactor/);
    expect(() => computeBriefInputConfidence(stack({ breadth: { reliabilityFactor: Number.POSITIVE_INFINITY } }))).toThrow(/breadth.reliabilityFactor/);
  });
  it("identical input yields identical detailed breakdown", () => {
    expect(computeBriefInputConfidenceDetailed(stack())).toEqual(computeBriefInputConfidenceDetailed(stack()));
  });
  it("score always stays within 0..1 for valid inputs", () => {
    const inputs = [
      stack(),
      stack({ macro: { meta: { available: false, freshness: "unavailable" } } }),
      stack({ catalysts: { reliabilityFactor: 0.1 }, breadth: { coverage: 0.2 }, anomalies: { meta: { freshness: "stale" } } }),
    ];
    for (const input of inputs) {
      const score = computeBriefInputConfidence(input).score;
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    }
  });
});

