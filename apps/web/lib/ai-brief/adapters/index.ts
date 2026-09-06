/**
 * Phase 7C.1B — pure real-domain → Phase 7A adapters.
 * No builder imports, no fetch, no env, no Date.now. Output is typed
 * { evidenceInput, sourceMeta, quality } for later assembly.
 */
import type { MarketOverview, MacroOverview, RegimeOverview } from "@war-room/types";
import type { BreadthOverview } from "@/lib/breadth/types";
import type { AnomalyOverview } from "@/lib/anomalies/types";
import type { CatalystOverview } from "@/lib/catalysts/types";
import type {
  AnomalyEvidenceInput,
  BreadthEvidenceInput,
  BriefDomainQualityInput,
  BriefSourceMeta,
  CatalystItemEvidenceInput,
  CatalystsEvidenceInput,
  EvidenceFreshness,
  MacroEvidenceInput,
  MarketEvidenceInput,
  RegimeEvidenceInput,
} from "../types";

export interface DomainAdapterOutput<T> {
  evidenceInput: T | null;
  sourceMeta: BriefSourceMeta;
  quality: BriefDomainQualityInput;
}
const FRESH: EvidenceFreshness = "fresh";
const DELAYED: EvidenceFreshness = "delayed";
const STALE: EvidenceFreshness = "stale";

function sourceMetaOf(input: { available: boolean; asOf: string | null; freshness: EvidenceFreshness; confidence: BriefSourceMeta["confidence"]; version: string | null }): BriefSourceMeta {
  return input;
}
function unavailableMeta(version: string | null): BriefSourceMeta {
  return { available: false, asOf: null, freshness: "unavailable", confidence: null, version };
}

const INDEX_ORDER = ["SPY", "QQQ", "IWM", "DIA"];
const SECTOR_ORDER = ["XLK", "XLF", "XLE", "XLV", "XLI", "XLP", "XLY", "XLU", "XLB", "XLRE", "XLC"];

/* Market */
export function adaptMarketOverview(market: MarketOverview): DomainAdapterOutput<MarketEvidenceInput> {
  const byTicker = new Map(market.indices.map((index) => [index.ticker, index]));
  const indices = INDEX_ORDER.flatMap((ticker) => {
    const index = byTicker.get(ticker);
    return index && index.changePct !== null ? [{ ticker, changePct: index.changePct }] : [];
  });
  const byEtf = new Map(market.sectors.map((sector) => [sector.etf, sector]));
  const sectors = SECTOR_ORDER.flatMap((etf) => {
    const sector = byEtf.get(etf);
    return sector && sector.dailyReturnPct !== null ? [{ ticker: etf, changePct: sector.dailyReturnPct }] : [];
  });
  const available = indices.length > 0;
  const sourceMeta = sourceMetaOf({ available, asOf: market.meta.asOf, freshness: market.meta.stale ? STALE : FRESH, confidence: null, version: null });
  return {
    evidenceInput: { asOf: market.meta.asOf, freshness: sourceMeta.freshness, indices, sectors: sectors.length ? sectors : undefined },
    sourceMeta,
    quality: { meta: sourceMeta, coverage: indices.length / INDEX_ORDER.length },
  };
}

/* Macro */
const MACRO_REAL_TO_NORMALIZED: Record<string, string> = { vix: "vix", us10y: "us10y", usd_broad: "usdBroad", wti: "wti", gold: "gold", btc: "btc" };
const MACRO_CANONICAL = ["vix", "us10y", "usdBroad", "wti", "gold", "btc"];
function signalFreshness(signal: { stale: boolean; frequency: string }): EvidenceFreshness {
  if (signal.stale) return STALE;
  if (signal.frequency === "realtime") return FRESH;
  return DELAYED;
}
export function adaptMacroOverview(macro: MacroOverview): DomainAdapterOutput<MacroEvidenceInput> {
  const byRealId = new Map<string, (typeof macro.signals)[number]>(macro.signals.map((signal) => [signal.id as string, signal]));
  const signals: MacroEvidenceInput["signals"] = [];
  let anyDaily = false;
  for (const realId of Object.keys(MACRO_REAL_TO_NORMALIZED)) {
    const signal = byRealId.get(realId);
    if (!signal || signal.available !== true || (signal.value === null && signal.changePct === null)) continue;
    if (signal.frequency === "daily") anyDaily = true;
    signals.push({ id: MACRO_REAL_TO_NORMALIZED[realId], label: signal.label, value: signal.value, changePct: signal.changePct, asOf: signal.asOf, cadence: signal.frequency, freshness: signalFreshness(signal) });
  }
  const available = signals.length > 0;
  let domain: EvidenceFreshness = "unavailable";
  if (available) domain = macro.meta.stale ? STALE : anyDaily ? DELAYED : FRESH;
  const sourceMeta = sourceMetaOf({ available, asOf: macro.meta.asOf, freshness: domain, confidence: null, version: null });
  return { evidenceInput: { asOf: macro.meta.asOf, freshness: sourceMeta.freshness, signals }, sourceMeta, quality: { meta: sourceMeta, coverage: signals.length / MACRO_CANONICAL.length } };
}

/* Regime */
export function adaptRegimeOverview(regime: RegimeOverview): DomainAdapterOutput<RegimeEvidenceInput> {
  const result = regime.result;
  if (!result) {
    const sourceMeta = unavailableMeta(null);
    return { evidenceInput: null, sourceMeta, quality: { meta: sourceMeta, coverage: 0 } };
  }
  const asOf = result.asOf ?? regime.meta.asOf;
  const sourceMeta = sourceMetaOf({ available: true, asOf, freshness: result.staleInputs.length > 0 ? STALE : DELAYED, confidence: result.confidence, version: result.engineVersion });
  const evidenceInput: RegimeEvidenceInput = {
    asOf, freshness: sourceMeta.freshness, confidence: result.confidence, coverage: result.coverage,
    score: result.score, displayScore: result.displayScore, label: result.label,
    positiveDrivers: result.positiveDrivers.map((driver) => driver.reason),
    negativeDrivers: result.negativeDrivers.map((driver) => driver.reason),
  };
  return { evidenceInput, sourceMeta, quality: { meta: sourceMeta, coverage: result.coverage } };
}

/* Breadth */
export function adaptBreadthOverview(breadth: BreadthOverview): DomainAdapterOutput<BreadthEvidenceInput> {
  if (breadth.score === null) {
    const sourceMeta = unavailableMeta(breadth.engineVersion);
    return { evidenceInput: null, sourceMeta, quality: { meta: sourceMeta, coverage: 0 } };
  }
  const m = breadth.metrics;
  const sourceMeta = sourceMetaOf({ available: true, asOf: breadth.meta.asOf, freshness: DELAYED, confidence: breadth.confidence, version: breadth.engineVersion });
  const evidenceInput: BreadthEvidenceInput = {
    asOf: breadth.meta.asOf, freshness: DELAYED, confidence: breadth.confidence, coverage: m.coveragePct,
    score: breadth.score, participation: breadth.state.label,
    advanceRatioPct: m.advanceRatio === null ? null : m.advanceRatio * 100,
    pctAbove20: m.above20Pct, pctAbove50: m.above50Pct, newHighs20: m.newHighs20, newLows20: m.newLows20,
  };
  return { evidenceInput, sourceMeta, quality: { meta: sourceMeta, coverage: m.coveragePct } };
}

/* Anomalies */
export function adaptAnomalyOverview(anomalies: AnomalyOverview): DomainAdapterOutput<AnomalyEvidenceInput> {
  const items = anomalies.topOverall.map((candidate) => ({
    ticker: candidate.ticker, name: candidate.name, movePct: candidate.dailyMovePct,
    anomalyScore: candidate.anomalyScore, displayScore: candidate.displayScore, severity: candidate.severity,
    returnSigma: candidate.metrics.returnSigma, sectorRelativePct: candidate.metrics.sectorRelativePct,
    primaryTrigger: candidate.primaryTrigger, breakout20: candidate.metrics.breakout20, breakdown20: candidate.metrics.breakdown20,
    priceAsOf: candidate.priceAsOf ?? null,
  }));
  const available = items.length > 0;
  const effectiveAsOf = anomalies.meta.effectiveAsOf ?? anomalies.meta.asOf;
  const sourceMeta = sourceMetaOf({ available, asOf: effectiveAsOf, freshness: anomalies.meta.stale ? STALE : DELAYED, confidence: anomalies.confidence, version: anomalies.engineVersion });
  const evidenceInput: AnomalyEvidenceInput = { asOf: effectiveAsOf, freshness: sourceMeta.freshness, confidence: anomalies.confidence, coverage: anomalies.coveragePct, effectiveAsOf, items };
  return { evidenceInput, sourceMeta, quality: { meta: sourceMeta, coverage: anomalies.coveragePct } };
}

/* Catalysts */
export function catalystReliability(providers: CatalystOverview["meta"]["providers"]): number {
  const newsBad = providers.news !== "ok";
  const secBad = providers.sec !== "ok";
  const actionsBad = providers.corporateActions !== "ok";
  if (newsBad && secBad) return 0;
  if (newsBad) return 0.7;
  if (secBad) return 0.75;
  return actionsBad ? 0.9 : 1.0;
}
export function adaptCatalystOverview(catalysts: CatalystOverview): DomainAdapterOutput<CatalystsEvidenceInput> {
  const meta = catalysts.meta;
  const items: CatalystItemEvidenceInput[] = catalysts.items.map((item) => ({
    ticker: item.ticker, status: item.status, catalystCutoff: item.catalystCutoff,
    primaryCatalyst: item.primaryCatalyst
      ? { category: item.primaryCatalyst.category, headline: item.primaryCatalyst.headline, evidenceStrength: item.primaryCatalyst.evidenceStrength, relevanceScore: item.primaryCatalyst.relevanceScore, eventPolarity: item.primaryCatalyst.eventPolarity, alignment: null, publishedAt: item.primaryCatalyst.publishedAt, source: item.primaryCatalyst.source }
      : null,
  }));
  const reliability = catalystReliability(meta.providers);
  const available = reliability > 0 && meta.candidateCount > 0 && items.length > 0;
  const sourceMeta = sourceMetaOf({ available, asOf: meta.effectiveAsOf ?? meta.catalystCutoff ?? meta.asOf, freshness: DELAYED, confidence: null, version: meta.engineVersion });
  return {
    evidenceInput: { cutoff: meta.catalystCutoff, freshness: DELAYED, items },
    sourceMeta,
    quality: { meta: sourceMeta, coverage: available ? 1 : 0, reliabilityFactor: reliability },
  };
}

