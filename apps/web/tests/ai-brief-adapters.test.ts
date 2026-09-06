import { describe, expect, it } from "vitest";
import { adaptMarketOverview, adaptMacroOverview, adaptRegimeOverview, adaptBreadthOverview, adaptAnomalyOverview, adaptCatalystOverview, catalystReliability } from "@/lib/ai-brief/adapters";
import type { MarketOverview, MacroOverview, RegimeOverview } from "@war-room/types";
import type { BreadthOverview } from "@/lib/breadth/types";
import type { AnomalyOverview } from "@/lib/anomalies/types";
import type { CatalystOverview } from "@/lib/catalysts/types";

const market = {
  meta: { asOf: "2026-09-04T19:45:00Z", stale: false },
  indices: [
    { ticker: "SPY", changePct: -0.8 }, { ticker: "QQQ", changePct: -1.1 }, { ticker: "IWM", changePct: -0.5 },
    { ticker: "DIA", changePct: -0.3 }, { ticker: "FAKE", changePct: null },
  ],
  sectors: [
    { etf: "XLK", dailyReturnPct: -1.4 }, { etf: "XLF", dailyReturnPct: null },
  ],
} as unknown as MarketOverview;

const macro = {
  meta: { asOf: "2026-09-05T12:00:00Z", stale: true },
  signals: [
    { id: "vix", label: "VIX", value: 14.3, changePct: null, asOf: "2026-09-05T12:00:00Z", stale: true, available: true, frequency: "daily" },
    { id: "us10y", label: "US 10Y", value: 3.92, changePct: null, asOf: "x", stale: true, available: true, frequency: "daily" },
    { id: "usd_broad", label: "Broad USD", value: 103.5, changePct: 0.2, asOf: "x", stale: true, available: true, frequency: "daily" },
    { id: "wti", label: "WTI", value: null, changePct: 5.1, asOf: "y", stale: false, available: true, frequency: "intraday" },
    { id: "gold", label: "Gold", value: null, changePct: null, asOf: null, stale: false, available: false, frequency: "daily" },
    { id: "btc", label: "Bitcoin", value: null, changePct: -0.3, asOf: "z", stale: false, available: true, frequency: "realtime" },
  ],
} as unknown as MacroOverview;

function regime(): RegimeOverview {
  return { mode: "live", meta: { mode: "live", asOf: "2026-09-04T19:45:00Z" }, result: { score: 48.98, displayScore: 49, label: "CAUTIOUS / NEUTRAL", coverage: 0.94, confidence: "high", components: [], positiveDrivers: [{ id: "vix", name: "VIX", direction: "positive", impact: 2, reason: "VIX supportive" }], negativeDrivers: [{ id: "wti", name: "WTI", direction: "negative", impact: -3, reason: "Oil pressure" }], staleInputs: [], missingInputs: [], asOf: "2026-09-04T19:45:00Z", engineVersion: "regime-v1" } };
}
function breadth(): BreadthOverview {
  return { mode: "live", score: 24, displayScore: 24, engineVersion: "breadth-v1", state: { key: "BROAD_SELLOFF", label: "Broad Selloff" }, universe: { name: "S&P 500", version: "u", asOf: "x", count: 503 }, meta: { provider: "alpaca", feed: "delayed_sip", delayMinutes: 15, asOf: "2026-09-04T19:30:00Z", marketOpen: false }, metrics: { universeCount: 503, currentCoverageCount: 500, historical20CoverageCount: 500, historical50CoverageCount: 500, coveragePct: 0.99, advancers: 170, decliners: 317, unchanged: 13, advanceRatio: 0.349, above20Pct: 35.0, above50Pct: 46.9, newHighs20: 5, newLows20: 23 }, confidence: "high" };
}
function anomaly(): AnomalyOverview {
  return {
    mode: "live", engineVersion: "anomaly-v1", universe: { name: "S&P 500", version: "u", asOf: "x", count: 503 },
    meta: { provider: "alpaca", feed: "delayed_sip", delayMinutes: 15, asOf: "2026-09-04T19:45:00Z", effectiveAsOf: "2026-09-04T19:44:00Z", marketOpen: false, stale: false },
    universeCount: 503, eligibleCount: 503, scoredCount: 503, coveragePct: 1.0, confidence: "high",
    topOverall: [{ ticker: "LULU", name: "Lululemon", sector: "CD", sectorEtf: "XLY", price: 200, dailyMovePct: -17.4, direction: "down", anomalyScore: 100, displayScore: 100, severity: "EXTREME", primaryTrigger: "RETURN SHOCK", metrics: { returnSigma: 6.6, sectorRelativePct: -13.2, breakout20: false, breakdown20: true }, componentScores: {}, reasons: [], dataCoverage: 1, priceAsOf: "2026-09-04T19:44:00Z" }],
    topPositive: [], topNegative: [], asOf: "2026-09-04T19:45:00Z",
  } as unknown as AnomalyOverview;
}
function catalysts(status: CatalystOverview["meta"]["providers"]): CatalystOverview {
  return { meta: { mode: "live", engineVersion: "catalyst-match-v1", anomalyVersion: "anomaly-v1", candidateCount: 1, matchedCount: 1, unmatchedCount: 0, asOf: "2026-09-04T19:45:00Z", generatedAt: null, effectiveAsOf: "2026-09-04T19:44:00Z", catalystCutoff: "2026-09-04T19:44:00Z", providers: status }, items: [{ ticker: "LULU", name: "Lululemon", movePct: -17.4, anomalyScore: 100, anomalySeverity: "EXTREME", status: "MATCHED", primaryCatalyst: { category: "GUIDANCE", headline: "guides lower", publishedAt: "2026-09-04T12:00:00Z", source: "Reuters", sourceType: "news", url: "u", relevanceScore: 91, evidenceStrength: "strong", eventPolarity: "negative", symbols: ["LULU"], supportingEvidence: [] }, secondaryCatalysts: [], alignment: "aligned", catalystCutoff: "2026-09-04T19:44:00Z", evidence: { newsCount: 2, filingCount: 0, corporateActionCount: 0 } }] };
}

describe("pure domain adapters", () => {
  it("market: canonical order, stale→meta, no invented per-index time", () => {
    const out = adaptMarketOverview(market);
    expect(out.evidenceInput?.indices.map((i) => i.ticker)).toEqual(["SPY", "QQQ", "IWM", "DIA"]);
    expect(out.evidenceInput?.sectors?.map((s) => s.ticker)).toEqual(["XLK"]);
    expect(out.sourceMeta.freshness).toBe("fresh");
    expect(out.sourceMeta.asOf).toBe(market.meta.asOf);
    expect(adaptMarketOverview({ ...market, meta: { asOf: market.meta.asOf, stale: true } } as unknown as MarketOverview).sourceMeta.freshness).toBe("stale");
  });
  it("macro: usd_broad→usdBroad, per-signal + domain stale, gold omitted, coverage 5/6", () => {
    const out = adaptMacroOverview(macro);
    expect(out.evidenceInput?.signals.map((s) => s.id)).toEqual(["vix", "us10y", "usdBroad", "wti", "btc"]);
    expect(out.sourceMeta.freshness).toBe("stale");
    expect(out.evidenceInput?.signals.find((s) => s.id === "btc")?.freshness).toBe("fresh");
    expect(out.quality.coverage).toBeCloseTo(5 / 6, 6);
  });
  it("regime: exact copy, driver reasons in order, engineVersion; null result unavailable", () => {
    const out = adaptRegimeOverview(regime());
    expect(out.evidenceInput?.score).toBe(48.98);
    expect(out.evidenceInput?.positiveDrivers).toEqual(["VIX supportive"]);
    expect(out.evidenceInput?.negativeDrivers).toEqual(["Oil pressure"]);
    expect(out.sourceMeta.version).toBe("regime-v1");
    expect(out.quality.coverage).toBe(0.94);
    const missing = adaptRegimeOverview({ mode: "live", meta: { mode: "live", asOf: null }, result: null });
    expect(missing.sourceMeta.available).toBe(false);
    expect(missing.evidenceInput).toBeNull();
  });
  it("breadth: advanceRatio×100 only, delayed/coverage/version preserved", () => {
    const out = adaptBreadthOverview(breadth());
    expect(out.evidenceInput?.advanceRatioPct).toBeCloseTo(34.9, 6);
    expect(out.evidenceInput?.pctAbove20).toBe(35.0);
    expect(out.evidenceInput?.pctAbove50).toBe(46.9);
    expect(out.sourceMeta.freshness).toBe("delayed");
    expect(out.sourceMeta.version).toBe("breadth-v1");
  });
  it("anomalies: topOverall only, metrics flattened, effectiveAsOf preferred", () => {
    const out = adaptAnomalyOverview(anomaly());
    const item = out.evidenceInput?.items[0];
    expect(item?.returnSigma).toBe(6.6);
    expect(item?.sectorRelativePct).toBe(-13.2);
    expect(item?.breakout20).toBe(false);
    expect(item?.breakdown20).toBe(true);
    expect(item?.priceAsOf).toBe("2026-09-04T19:44:00Z");
    expect(out.sourceMeta.asOf).toBe("2026-09-04T19:44:00Z");
    expect(out.sourceMeta.version).toBe("anomaly-v1");
  });
  it("catalysts: no secondary/supporting leakage, coverage stays 1, reliability policy", () => {
    const out = adaptCatalystOverview(catalysts({ news: "ok", sec: "ok", corporateActions: "error" }));
    expect(out.evidenceInput?.items[0].primaryCatalyst?.category).toBe("GUIDANCE");
    expect(JSON.stringify(out.evidenceInput)).not.toMatch(/secondary|supportingEvidence|sourceType|url/);
    expect(out.quality.coverage).toBe(1);
    expect(catalystReliability({ news: "ok", sec: "ok", corporateActions: "ok" })).toBe(1);
    expect(catalystReliability({ news: "ok", sec: "ok", corporateActions: "error" })).toBe(0.9);
    expect(catalystReliability({ news: "ok", sec: "error", corporateActions: "ok" })).toBe(0.75);
    expect(catalystReliability({ news: "error", sec: "ok", corporateActions: "ok" })).toBe(0.7);
    expect(catalystReliability({ news: "error", sec: "error", corporateActions: "disabled" })).toBe(0);
  });
});

