import { describe, expect, it } from "vitest";
import { assembleBriefContext, type AdaptedDomainBundle } from "@/lib/ai-brief/assemble-context";
import { adaptMarketOverview, adaptMacroOverview, adaptRegimeOverview, adaptBreadthOverview, adaptAnomalyOverview, adaptCatalystOverview } from "@/lib/ai-brief/adapters";
import type { MarketOverview, MacroOverview, RegimeOverview } from "@war-room/types";
import type { BreadthOverview } from "@/lib/breadth/types";
import type { AnomalyOverview } from "@/lib/anomalies/types";
import type { CatalystOverview } from "@/lib/catalysts/types";
import type { DomainAdapterOutput } from "@/lib/ai-brief/adapters";

const GENERATED_AT = "2026-09-06T01:30:00.000Z";
const market = { meta: { asOf: "2026-09-04T19:45:00Z", stale: false }, indices: [{ ticker: "SPY", changePct: -0.8 }, { ticker: "QQQ", changePct: -1.1 }, { ticker: "IWM", changePct: -0.5 }, { ticker: "DIA", changePct: -0.3 }], sectors: [{ etf: "XLK", dailyReturnPct: -1.4 }] } as unknown as MarketOverview;
const macro = { meta: { asOf: "2026-09-05T12:00:00Z", stale: true }, signals: [{ id: "vix", label: "VIX", value: 14.3, changePct: null, asOf: "2026-09-05T12:00:00Z", stale: true, available: true, frequency: "daily" }, { id: "wti", label: "WTI", value: null, changePct: 5.1, asOf: "y", stale: false, available: true, frequency: "intraday" }] } as unknown as MacroOverview;

function regime(): RegimeOverview {
  return { mode: "live", meta: { mode: "live", asOf: "x" }, result: { score: 48.98, displayScore: 49, label: "CAUTIOUS / NEUTRAL", coverage: 0.94, confidence: "high", components: [], positiveDrivers: [{ id: "v", name: "V", direction: "positive", impact: 1, reason: "low VIX" }], negativeDrivers: [{ id: "w", name: "W", direction: "negative", impact: -2, reason: "WTI pressure" }], staleInputs: [], missingInputs: [], asOf: "x", engineVersion: "regime-v1" } };
}
function breadth(): BreadthOverview {
  return { mode: "live", score: 24, displayScore: 24, engineVersion: "breadth-v1", state: { key: "BROAD_SELLOFF", label: "Broad Selloff" }, universe: { name: "S&P 500", version: "u", asOf: "x", count: 503 }, meta: { provider: "alpaca", feed: "delayed_sip", delayMinutes: 15, asOf: "2026-09-04T19:30:00Z", marketOpen: false }, metrics: { universeCount: 503, currentCoverageCount: 500, historical20CoverageCount: 500, historical50CoverageCount: 500, coveragePct: 0.99, advancers: 170, decliners: 317, unchanged: 13, advanceRatio: 0.349, above20Pct: 35.0, above50Pct: 46.9, newHighs20: 5, newLows20: 23 }, confidence: "high" };
}
function anomalies(): AnomalyOverview {
  return {
    mode: "live", engineVersion: "anomaly-v1", universe: { name: "S&P 500", version: "u", asOf: "x", count: 503 }, meta: { provider: "alpaca", feed: "delayed_sip", delayMinutes: 15, asOf: "2026-09-04T19:45:00Z", effectiveAsOf: "2026-09-04T19:44:00Z", marketOpen: false, stale: false }, universeCount: 503, eligibleCount: 503, scoredCount: 503, coveragePct: 1, confidence: "high", topOverall: [
      { ticker: "LULU", name: "Lululemon", sector: "CD", sectorEtf: "XLY", price: 1, dailyMovePct: -17.4, direction: "down", anomalyScore: 100, displayScore: 100, severity: "EXTREME", primaryTrigger: "RETURN SHOCK", metrics: { returnSigma: 6.6, sectorRelativePct: -10, breakout20: false, breakdown20: true }, componentScores: {}, reasons: [], dataCoverage: 1, priceAsOf: "x" },
      { ticker: "KLAC", name: "KLA", sector: "IT", sectorEtf: "XLK", price: 1, dailyMovePct: 7.3, direction: "up", anomalyScore: 73, displayScore: 73, severity: "HIGH", primaryTrigger: "RETURN SHOCK", metrics: { returnSigma: 3, sectorRelativePct: 5, breakout20: true, breakdown20: false }, componentScores: {}, reasons: [], dataCoverage: 1, priceAsOf: "x" },
    ], topPositive: [], topNegative: [], asOf: "2026-09-04T19:45:00Z",
  } as unknown as AnomalyOverview;
}
function catalysts(): CatalystOverview {
  return {
    meta: { mode: "live", engineVersion: "catalyst-match-v1", anomalyVersion: "anomaly-v1", candidateCount: 2, matchedCount: 1, unmatchedCount: 1, asOf: "x", generatedAt: null, effectiveAsOf: "2026-09-04T19:44:00Z", catalystCutoff: "2026-09-04T19:44:00Z", providers: { news: "ok", sec: "ok", corporateActions: "error" } },
    items: [
      { ticker: "LULU", name: "Lululemon", movePct: -17.4, anomalyScore: 100, anomalySeverity: "EXTREME", status: "MATCHED", primaryCatalyst: { category: "GUIDANCE", headline: "cut", publishedAt: "x", source: "R", sourceType: "news", url: "u", relevanceScore: 91, evidenceStrength: "strong", eventPolarity: "negative", symbols: ["LULU"], supportingEvidence: [] }, secondaryCatalysts: [], alignment: "aligned", catalystCutoff: "x", evidence: { newsCount: 1, filingCount: 0, corporateActionCount: 0 } },
      { ticker: "KLAC", name: "KLA", movePct: 7.3, anomalyScore: 73, anomalySeverity: "HIGH", status: "NO CLEAR CATALYST FOUND", catalystCutoff: "x", evidence: { newsCount: 0, filingCount: 0, corporateActionCount: 0 } },
    ],
  } as unknown as CatalystOverview;
}
function bundle(): AdaptedDomainBundle {
  return { market: adaptMarketOverview(market), macro: adaptMacroOverview(macro), regime: adaptRegimeOverview(regime()), breadth: adaptBreadthOverview(breadth()), anomalies: adaptAnomalyOverview(anomalies()), catalysts: adaptCatalystOverview(catalysts()) };
}
function unavailable<T>(): DomainAdapterOutput<T> {
  const meta = { available: false, asOf: null, freshness: "unavailable" as const, confidence: null, version: null };
  return { evidenceInput: null, sourceMeta: meta, quality: { meta, coverage: 0 } } as unknown as DomainAdapterOutput<T>;
}

describe("assembleBriefContext", () => {
  it("healthy bundle assembles brief-context-v1 with stable fingerprint and aligned facts", () => {
    const ctx = assembleBriefContext({ generatedAt: GENERATED_AT, ...bundle() });
    expect(ctx.version).toBe("brief-context-v1");
    expect(ctx.generatedAt).toBe(GENERATED_AT);
    expect(ctx.fingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(ctx.evidence.length).toBeLessThanOrEqual(50);
    expect(ctx.evidence.some((fact) => fact.id === "regime.overall")).toBe(true);
    expect(ctx.evidence.some((fact) => fact.id === "catalyst.LULU.primary")).toBe(true);
    expect(ctx.evidence.some((fact) => fact.id === "catalyst.KLAC.none")).toBe(true);
    expect(ctx.sources.market.freshness).toBe("fresh");
    expect(ctx.sources.macro.freshness).toBe("stale");
    expect(ctx.sources.breadth.freshness).toBe("delayed");
  });
  it("generatedAt-only change keeps fingerprint; market evidence change alters it", () => {
    const a = assembleBriefContext({ generatedAt: GENERATED_AT, ...bundle() });
    const b = assembleBriefContext({ generatedAt: "2026-09-06T05:00:00Z", ...bundle() });
    expect(a.fingerprint).toBe(b.fingerprint);
    const changedMarket = adaptMarketOverview({ ...market, indices: market.indices.map((index, i) => (i === 0 ? { ticker: "SPY", changePct: 0.4 } : index)) } as unknown as MarketOverview);
    const c = assembleBriefContext({ generatedAt: GENERATED_AT, ...bundle(), market: changedMarket });
    expect(c.fingerprint).not.toBe(a.fingerprint);
  });
  it("unavailable domains compose without throwing and never fabricate facts", () => {
    const parts = bundle();
    const ctx = assembleBriefContext({ generatedAt: GENERATED_AT, macro: unavailable(), regime: unavailable(), catalysts: unavailable(), market: parts.market, breadth: parts.breadth, anomalies: parts.anomalies });
    expect(ctx.sources.macro.available).toBe(false);
    expect(ctx.sources.catalysts.available).toBe(false);
    expect(ctx.evidence.some((fact) => fact.domain === "macro")).toBe(false);
    expect(ctx.evidence.some((fact) => fact.domain === "regime")).toBe(false);
    expect(ctx.evidence.some((fact) => fact.domain === "catalyst")).toBe(false);
    expect(ctx.evidence.length).toBeGreaterThan(0);
    expect(ctx.inputConfidence.score).toBeLessThan(0.9);
  });
  it("deterministic: identical bundle yields deeply equal contexts", () => {
    expect(assembleBriefContext({ generatedAt: GENERATED_AT, ...bundle() })).toEqual(assembleBriefContext({ generatedAt: GENERATED_AT, ...bundle() }));
  });
});

