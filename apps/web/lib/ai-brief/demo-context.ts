/**
 * Phase 7A.4 — deterministic Friday-like demo context fixture.
 *
 * Represents the validated Friday-style dataset using the SAME production
 * assembler. No network, no credentials, no Date.now (generatedAt supplied).
 */
import { buildBriefContext } from "./context";
import type { BriefConfidenceInput, BriefContext, EvidenceBuilderInput, EvidenceFreshness } from "./types";

export const DEMO_GENERATED_AT = "2026-09-06T01:30:00.000Z";

function sourceMeta(partial: { available?: boolean; asOf?: string | null; freshness?: EvidenceFreshness; confidence?: BriefConfidenceInput["catalysts"]["meta"]["confidence"]; version?: string | null }) {
  return { available: true, asOf: "2026-09-04T19:45:00Z", freshness: "delayed" as EvidenceFreshness, confidence: "high" as const, version: null as string | null, ...partial };
}

export function demoContextInputs() {
  const evidenceInput: EvidenceBuilderInput = {
    market: {
      asOf: "2026-09-04T19:45:00Z",
      freshness: "fresh",
      indices: [
        { ticker: "SPY", changePct: -0.8 },
        { ticker: "QQQ", changePct: -1.1 },
        { ticker: "IWM", changePct: -0.5 },
        { ticker: "DIA", changePct: -0.3 },
      ],
      sectors: [
        { ticker: "XLK", changePct: -1.4 }, { ticker: "XLF", changePct: -0.2 }, { ticker: "XLE", changePct: 2.1 },
        { ticker: "XLV", changePct: 0.1 }, { ticker: "XLI", changePct: -0.6 }, { ticker: "XLP", changePct: 0.4 },
        { ticker: "XLY", changePct: -1.2 }, { ticker: "XLU", changePct: 0.8 }, { ticker: "XLB", changePct: -0.4 },
        { ticker: "XLRE", changePct: 0.3 }, { ticker: "XLC", changePct: -0.9 },
      ],
    },
    macro: {
      asOf: "2026-09-05T12:00:00Z",
      freshness: "stale",
      signals: [
        { id: "vix", label: "VIX", value: 14.3, changePct: null, asOf: "2026-09-05T12:00:00Z", cadence: "daily", freshness: "stale" },
        { id: "us10y", label: "US 10Y", value: 3.92, changePct: null, asOf: "2026-09-05T12:00:00Z", cadence: "daily", freshness: "stale" },
        { id: "usdBroad", label: "Broad USD", value: 103.5, changePct: 0.2, asOf: "2026-09-05T12:00:00Z", cadence: "daily", freshness: "stale" },
        { id: "wti", label: "WTI", value: null, changePct: 5.1, asOf: "2026-09-04T19:30:00Z", cadence: "current", freshness: "fresh" },
        { id: "gold", label: "Gold", value: 2512.4, changePct: null, asOf: "2026-09-05T00:00:00Z", cadence: "daily", freshness: "delayed" },
        { id: "btc", label: "Bitcoin", value: null, changePct: -0.3, asOf: "2026-09-05T01:00:00Z", cadence: "current", freshness: "fresh" },
      ],
    },
    regime: {
      asOf: "2026-09-04T19:45:00Z",
      freshness: "delayed",
      confidence: "high",
      coverage: 0.94,
      score: 48.98,
      displayScore: 49,
      label: "CAUTIOUS / NEUTRAL",
      positiveDrivers: ["VIX is supportive at low levels", "VIX trending lower supports risk appetite", "Cyclical vs defensive spread supportive"],
      negativeDrivers: ["WTI pressure adds inflation risk", "Sector participation is weak", "SPY weakness pulls regime lower"],
    },
    breadth: {
      asOf: "2026-09-04T19:30:00Z",
      freshness: "delayed",
      confidence: "high",
      coverage: 1.0,
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
      confidence: "high",
      coverage: 1.0,
      effectiveAsOf: "2026-09-04T19:44:00Z",
      items: [
        { ticker: "LULU", name: "Lululemon Athletica", movePct: -17.4, anomalyScore: 100, displayScore: 100, severity: "EXTREME", returnSigma: 6.6, sectorRelativePct: -13.2, primaryTrigger: "RETURN SHOCK", breakout20: false, breakdown20: true, priceAsOf: "2026-09-04T19:44:00Z" },
        { ticker: "FICO", name: "Fair Isaac", movePct: -16.7, anomalyScore: 100, displayScore: 100, severity: "EXTREME", returnSigma: 6.1, sectorRelativePct: -12.1, primaryTrigger: "RETURN SHOCK", breakout20: false, breakdown20: true, priceAsOf: "2026-09-04T19:44:00Z" },
        { ticker: "EFX", name: "Equifax", movePct: -6.4, anomalyScore: 88, displayScore: 88, severity: "EXTREME", returnSigma: 3.2, sectorRelativePct: -4.8, primaryTrigger: "RETURN SHOCK", breakout20: false, breakdown20: true, priceAsOf: "2026-09-04T19:44:00Z" },
        { ticker: "ADSK", name: "Autodesk", movePct: -8.3, anomalyScore: 83, displayScore: 83, severity: "EXTREME", returnSigma: 3.9, sectorRelativePct: -6.2, primaryTrigger: "RETURN SHOCK", breakout20: false, breakdown20: true, priceAsOf: "2026-09-04T19:44:00Z" },
        { ticker: "PTC", name: "PTC Inc.", movePct: -6.0, anomalyScore: 81, displayScore: 81, severity: "EXTREME", returnSigma: 3.0, sectorRelativePct: -4.4, primaryTrigger: "RETURN SHOCK", breakout20: false, breakdown20: true, priceAsOf: "2026-09-04T19:44:00Z" },
        { ticker: "ADBE", name: "Adobe Inc.", movePct: -6.7, anomalyScore: 76, displayScore: 76, severity: "HIGH", returnSigma: 2.8, sectorRelativePct: -4.1, primaryTrigger: "RETURN SHOCK", breakout20: false, breakdown20: true, priceAsOf: "2026-09-04T19:44:00Z" },
        { ticker: "BEN", name: "Franklin Resources", movePct: 3.5, anomalyScore: 75, displayScore: 75, severity: "HIGH", returnSigma: 2.4, sectorRelativePct: 2.6, primaryTrigger: "RETURN SHOCK", breakout20: true, breakdown20: false, priceAsOf: "2026-09-04T19:44:00Z" },
        { ticker: "KLAC", name: "KLA Corporation", movePct: 7.3, anomalyScore: 73, displayScore: 73, severity: "HIGH", returnSigma: 3.6, sectorRelativePct: 6.1, primaryTrigger: "RETURN SHOCK", breakout20: true, breakdown20: false, priceAsOf: "2026-09-04T19:44:00Z" },
      ],
    },

    catalysts: {
      cutoff: "2026-09-04T19:44:00Z",
      freshness: "delayed",
      items: [
        { ticker: "LULU", status: "MATCHED", catalystCutoff: "2026-09-04T19:44:00Z", primaryCatalyst: { category: "GUIDANCE", headline: "Lululemon cuts full-year guidance", evidenceStrength: "strong", relevanceScore: 91, eventPolarity: "negative", alignment: "aligned", publishedAt: "2026-09-04T12:00:00Z", source: "Reuters" } },
        { ticker: "FICO", status: "MATCHED", catalystCutoff: "2026-09-04T19:44:00Z", primaryCatalyst: { category: "REGULATORY / LEGAL", headline: "FHFA opens VantageScore credit-model review", evidenceStrength: "strong", relevanceScore: 88, eventPolarity: "negative", alignment: "aligned", publishedAt: "2026-09-04T13:00:00Z", source: "Reuters" } },
        { ticker: "EFX", status: "MATCHED", catalystCutoff: "2026-09-04T19:44:00Z", primaryCatalyst: { category: "REGULATORY / LEGAL", headline: "FHFA VantageScore decision pressures credit bureaus", evidenceStrength: "strong", relevanceScore: 85, eventPolarity: "negative", alignment: "aligned", publishedAt: "2026-09-04T13:10:00Z", source: "Reuters" } },
        { ticker: "ADBE", status: "MATCHED", catalystCutoff: "2026-09-04T19:44:00Z", primaryCatalyst: { category: "MANAGEMENT", headline: "Adobe names new chief executive", evidenceStrength: "moderate", relevanceScore: 72, eventPolarity: null, alignment: "unknown", publishedAt: "2026-09-04T14:00:00Z", source: "Reuters" } },
        { ticker: "ADSK", status: "NO CLEAR CATALYST FOUND", catalystCutoff: "2026-09-04T19:44:00Z" },
        { ticker: "PTC", status: "NO CLEAR CATALYST FOUND", catalystCutoff: "2026-09-04T19:44:00Z" },
        { ticker: "BEN", status: "NO CLEAR CATALYST FOUND", catalystCutoff: "2026-09-04T19:44:00Z" },
        { ticker: "KLAC", status: "NO CLEAR CATALYST FOUND", catalystCutoff: "2026-09-04T19:44:00Z" },
      ],
    },
  };

  const sources: BriefContext["sources"] = {
    market: sourceMeta({ asOf: "2026-09-04T19:45:00Z", freshness: "fresh", confidence: null, version: "market" }),
    macro: sourceMeta({ asOf: "2026-09-05T12:00:00Z", freshness: "stale", confidence: null, version: "macro" }),
    regime: sourceMeta({ asOf: "2026-09-04T19:45:00Z", freshness: "delayed", confidence: "high", version: "regime-v1" }),
    breadth: sourceMeta({ asOf: "2026-09-04T19:30:00Z", freshness: "delayed", confidence: "high", version: "breadth-v1" }),
    anomalies: sourceMeta({ asOf: "2026-09-04T19:45:00Z", freshness: "delayed", confidence: "high", version: "anomaly-v1" }),
    catalysts: sourceMeta({ asOf: "2026-09-04T19:44:00Z", freshness: "delayed", confidence: null, version: "catalyst-match-v1" }),
  };

  const confidenceInput: BriefConfidenceInput = {
    market: { meta: sources.market, coverage: 1 },
    macro: { meta: sources.macro, coverage: 1 },
    regime: { meta: sources.regime, coverage: 0.94 },
    breadth: { meta: sources.breadth, coverage: 1 },
    anomalies: { meta: sources.anomalies, coverage: 1 },
    catalysts: { meta: sources.catalysts, coverage: 1, reliabilityFactor: 0.9 },
  };

  return { evidenceInput, sources, confidenceInput };
}

export function buildDemoBriefContext(generatedAt: string = DEMO_GENERATED_AT): BriefContext {
  const { evidenceInput, sources, confidenceInput } = demoContextInputs();
  return buildBriefContext({ generatedAt, evidenceInput, sources, confidenceInput });
}

