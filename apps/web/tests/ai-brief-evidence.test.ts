import { describe, expect, it } from "vitest";
import { canonicalizeJson, fingerprintBriefEvidence } from "@/lib/ai-brief/fingerprint";
import type { BriefContext, EvidenceFact } from "@/lib/ai-brief/types";

function source(partial: Partial<BriefContext["sources"]["market"]> = {}) {
  return {
    available: true,
    asOf: "2026-09-04T20:00:00.000Z",
    freshness: "delayed" as const,
    confidence: "high" as const,
    version: "market-v0",
    ...partial,
  };
}

function makeContext(evidence: EvidenceFact[], generatedAt = "2026-09-05T20:00:00Z"): BriefContext {
  return {
    version: "brief-context-v1",
    generatedAt,
    sources: { market: source(), macro: source(), regime: source(), breadth: source(), anomalies: source(), catalysts: source() },
    evidence,
    inputConfidence: { score: 0.92, label: "high" },
    fingerprint: "",
  };
}

const baseFact: EvidenceFact = {
  id: "market.spy",
  domain: "market",
  text: "SPY fell 0.4% in the latest market observation.",
  data: { ticker: "SPY", changePct: -0.4, price: 510.2 },
  asOf: "2026-09-04T19:45:00Z",
  freshness: "delayed",
  confidence: "high",
  sourceVersion: "market-v1",
};

function cloneFact(overrides: Partial<EvidenceFact>): EvidenceFact {
  return { ...baseFact, data: { ...baseFact.data }, ...overrides };
}

const hash = (ctx: BriefContext) => fingerprintBriefEvidence(ctx);

describe("fingerprint — stability", () => {
  it("same input → same hash", () => {
    expect(hash(makeContext([baseFact]))).toBe(hash(makeContext([cloneFact({})])));
  });
  it("generatedAt-only change → same hash", () => {
    expect(hash(makeContext([baseFact], "2026-09-05T20:00:00Z"))).toBe(hash(makeContext([baseFact], "2026-09-06T01:00:00Z")));
  });
  it("object key insertion order → same hash", () => {
    const dataA = { ticker: "SPY", changePct: -0.4, price: 510.2 };
    const dataB = { price: 510.2, changePct: -0.4, ticker: "SPY" };
    expect(canonicalizeJson(dataA)).toBe(canonicalizeJson(dataB));
  });
  it("evidence array order → same hash", () => {
    const second = cloneFact({ id: "sector.XLK", domain: "sector" });
    const ctx = makeContext([baseFact, second]);
    const reversed = makeContext([cloneFact({ id: "sector.XLK", domain: "sector" }), cloneFact({})]);
    expect(hash(ctx)).toBe(hash(reversed));
  });
  it("nested object key ordering is stable", () => {
    const factA = cloneFact({ data: { meta: { a: 1, b: 2 }, ticker: "SPY" } });
    const factB = cloneFact({ data: { ticker: "SPY", meta: { b: 2, a: 1 } } });
    expect(hash(makeContext([factA]))).toBe(hash(makeContext([factB])));
  });
  it("nested semantic array order is preserved (different hash)", () => {
    const driversA = cloneFact({ data: { drivers: ["wti", "vix"] } });
    const driversB = cloneFact({ data: { drivers: ["vix", "wti"] } });
    expect(hash(makeContext([driversA]))).not.toBe(hash(makeContext([driversB])));
  });
});

describe("fingerprint — sensitivity", () => {
  it("fact ID change → different hash", () => {
    expect(hash(makeContext([baseFact]))).not.toBe(hash(makeContext([cloneFact({ id: "market.qqq" })])));
  });
  it("SPY numeric value change → different hash", () => {
    expect(hash(makeContext([baseFact]))).not.toBe(hash(makeContext([cloneFact({ data: { ticker: "SPY", changePct: -1.2, price: 510.2 } })])));
  });
  it("sourceVersion change → different hash", () => {
    expect(hash(makeContext([baseFact]))).not.toBe(hash(makeContext([cloneFact({ sourceVersion: "market-v2" })])));
  });
  it("asOf change → different hash", () => {
    expect(hash(makeContext([baseFact]))).not.toBe(hash(makeContext([cloneFact({ asOf: "2026-09-04T20:00:00Z" })])));
  });
  it("freshness change → different hash", () => {
    expect(hash(makeContext([baseFact]))).not.toBe(hash(makeContext([cloneFact({ freshness: "stale" })])));
  });
  it("catalyst category/data change → different hash", () => {
    const catFact = cloneFact({ id: "catalyst.FICO.primary", domain: "catalyst", data: { category: "REGULATORY / LEGAL" } });
    const changed = cloneFact({ id: "catalyst.FICO.primary", domain: "catalyst", data: { category: "EARNINGS" } });
    expect(hash(makeContext([catFact]))).not.toBe(hash(makeContext([changed])));
  });
  it("output is valid lowercase SHA-256 hex", () => {
    const digest = hash(makeContext([baseFact]));
    expect(digest).toMatch(/^[a-f0-9]{64}$/);
  });
});
