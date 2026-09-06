import type { LiveBriefDomainBuilders } from "@/lib/ai-brief/live-context";

export interface BuilderLogs {
  market: () => void; macro: () => void; regime: () => void; breadth: () => void; anomalies: () => void; catalysts: () => void;
}
type DomainValue<K extends keyof LiveBriefDomainBuilders> = Awaited<ReturnType<LiveBriefDomainBuilders[K]>>;

function domains() {
  const market = { meta: { asOf: "2026-09-04T19:45:00Z", stale: false }, indices: [{ ticker: "SPY", changePct: -0.8 }, { ticker: "QQQ", changePct: -1.1 }, { ticker: "IWM", changePct: -0.5 }, { ticker: "DIA", changePct: -0.3 }], sectors: [{ etf: "XLK", dailyReturnPct: -1.4 }] };
  const macro = { meta: { asOf: "2026-09-05T12:00:00Z", stale: true }, signals: [{ id: "vix", label: "VIX", value: 14.3, changePct: null, asOf: "x", stale: true, available: true, frequency: "daily" }, { id: "btc", label: "Bitcoin", value: null, changePct: -0.3, asOf: "x", stale: false, available: true, frequency: "realtime" }] };
  const regime = { mode: "live", meta: { mode: "live", asOf: "x" }, result: { score: 49, displayScore: 49, label: "CAUTIOUS / NEUTRAL", coverage: 0.9, confidence: "high", components: [], positiveDrivers: [], negativeDrivers: [], staleInputs: [], missingInputs: [], asOf: "x", engineVersion: "regime-v1" } };
  const breadth = { mode: "live", score: 24, displayScore: 24, engineVersion: "breadth-v1", state: { key: "BROAD_SELLOFF", label: "Broad Selloff" }, meta: { provider: "alpaca", feed: "delayed_sip", delayMinutes: 15, asOf: "x", marketOpen: false }, metrics: { coveragePct: 1, advanceRatio: 0.3, above20Pct: 35, above50Pct: 46, newHighs20: 5, newLows20: 23 }, confidence: "high" };
  const anomalies = { mode: "live", engineVersion: "anomaly-v1", meta: { provider: "alpaca", feed: "delayed_sip", delayMinutes: 15, asOf: "x", marketOpen: false, stale: false }, universeCount: 1, eligibleCount: 1, scoredCount: 1, coveragePct: 1, confidence: "high", topOverall: [
    { ticker: "LULU", name: "Lululemon", sector: "CD", sectorEtf: "XLY", price: 1, dailyMovePct: -17.4, direction: "down", anomalyScore: 100, displayScore: 100, severity: "EXTREME", primaryTrigger: "RETURN SHOCK", metrics: { returnSigma: 6, sectorRelativePct: -10, breakout20: false, breakdown20: true }, componentScores: {}, reasons: [], dataCoverage: 1, priceAsOf: "x" },
    { ticker: "KLAC", name: "KLA", sector: "IT", sectorEtf: "XLK", price: 1, dailyMovePct: 7.3, direction: "up", anomalyScore: 73, displayScore: 73, severity: "HIGH", primaryTrigger: "RETURN SHOCK", metrics: { returnSigma: 3, sectorRelativePct: 5, breakout20: true, breakdown20: false }, componentScores: {}, reasons: [], dataCoverage: 1, priceAsOf: "x" },
  ], topPositive: [], topNegative: [], asOf: "x" };
  const catalysts = { meta: { mode: "live", engineVersion: "catalyst-match-v1", anomalyVersion: "anomaly-v1", candidateCount: 2, matchedCount: 1, unmatchedCount: 1, asOf: "x", generatedAt: null, effectiveAsOf: "x", catalystCutoff: "x", providers: { news: "ok", sec: "ok", corporateActions: "error" } }, items: [
    { ticker: "LULU", name: "Lululemon", movePct: -17.4, anomalyScore: 100, anomalySeverity: "EXTREME", status: "MATCHED", primaryCatalyst: { category: "GUIDANCE", headline: "h", publishedAt: "x", source: "R", sourceType: "news", url: "u", relevanceScore: 90, evidenceStrength: "strong", eventPolarity: "negative", symbols: ["LULU"], supportingEvidence: [] }, secondaryCatalysts: [], alignment: "aligned", catalystCutoff: "x", evidence: { newsCount: 1, filingCount: 0, corporateActionCount: 0 } },
    { ticker: "KLAC", name: "KLA", movePct: 7.3, anomalyScore: 73, anomalySeverity: "HIGH", status: "NO CLEAR CATALYST FOUND", catalystCutoff: "x", evidence: { newsCount: 0, filingCount: 0, corporateActionCount: 0 } },
  ] };
  return { market, macro, regime, breadth, anomalies, catalysts } as unknown as {
    market: DomainValue<"market">; macro: DomainValue<"macro">; regime: DomainValue<"regime">; breadth: DomainValue<"breadth">; anomalies: DomainValue<"anomalies">; catalysts: DomainValue<"catalysts">;
  };
}

export const fixtures = domains();
export function makeBuilders(overrides: Partial<Record<keyof LiveBriefDomainBuilders, boolean>> = {}, logs?: Partial<BuilderLogs>): LiveBriefDomainBuilders {
  const fail = () => { throw new Error("boom"); };
  const wrap = <K extends keyof LiveBriefDomainBuilders>(fn: LiveBriefDomainBuilders[K], key: K): LiveBriefDomainBuilders[K] => {
    return (async () => {
      logs?.[key]?.();
      return (await (fn as () => Promise<unknown>)()) as DomainValue<K>;
    }) as LiveBriefDomainBuilders[K];
  };
  const base: LiveBriefDomainBuilders = {
    market: overrides.market ? fail : async () => fixtures.market,
    macro: overrides.macro ? fail : async () => fixtures.macro,
    regime: overrides.regime ? fail : async () => fixtures.regime,
    breadth: overrides.breadth ? fail : async () => fixtures.breadth,
    anomalies: overrides.anomalies ? fail : async () => fixtures.anomalies,
    catalysts: overrides.catalysts ? fail : async () => fixtures.catalysts,
  };
  return { market: wrap(base.market, "market"), macro: wrap(base.macro, "macro"), regime: wrap(base.regime, "regime"), breadth: wrap(base.breadth, "breadth"), anomalies: wrap(base.anomalies, "anomalies"), catalysts: wrap(base.catalysts, "catalysts") };
}
export function countLogs(): ReturnType<typeof makeLogs> { return makeLogs(); }
function makeLogs() {
  const counts = { market: 0, macro: 0, regime: 0, breadth: 0, anomalies: 0, catalysts: 0 };
  const logs = Object.fromEntries(Object.keys(counts).map((key) => [key, () => { counts[key as keyof typeof counts] += 1; }])) as unknown as Record<keyof BuilderLogs, () => void>;
  return Object.assign(logs, { counts });
}

