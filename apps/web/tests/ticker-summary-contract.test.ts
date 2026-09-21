import { describe, expect, it } from "vitest";
import { buildTickerEvidence } from "@/lib/ticker-context/evidence";
import { computeTickerMetrics } from "@/lib/ticker-context/metrics";
import { projectTickerContext } from "@/lib/ticker-context/api-types";
import { projectTickerSummary } from "@/lib/ticker-context/summary";
import { TICKER_CONTEXT_VERSION } from "@/lib/ticker-context/types";
import type { TickerResearchContext } from "@/lib/ticker-context/types";
import type { AnomalyHistory } from "@/lib/anomalies/history-metrics";
import type { BreadthSymbolState } from "@/lib/breadth/normalize";

/**
 * ticker-summary-v1 contract (V1.2C).
 *
 * The fixture goes through the REAL sealed pipeline (metrics → evidence) so the
 * assertions test the actual numbers the backend computes, not hand-written
 * duplicates.
 */
const history: AnomalyHistory = {
  sessionCount: 30,
  returnVol20Pct: 2.92,
  atr20: 6.4,
  avgVolume20: 130_670_732,
  prior20High: 234.76,
  prior20Low: 207.25,
};

const price: BreadthSymbolState = {
  ticker: "NVDA",
  available: true,
  refPrice: 222.27,
  previousClose: 219.34,
  changePct: 1.34,
  move: "advancer",
  sessionDate: "2026-09-18",
};

function contextFixture(): TickerResearchContext {
  const metrics = computeTickerMetrics({
    history,
    price: price.refPrice,
    dailyChangePct: price.changePct,
    sessionVolume: 191_619_629,
    sessionCompleted: true,
  });
  const build = buildTickerEvidence({
    symbol: "NVDA",
    identity: {
      symbol: "NVDA",
      name: "NVIDIA Corporation Common Stock",
      exchange: "NASDAQ",
      assetClass: "us_equity",
      status: "active",
      tradable: true,
    },
    clock: { isOpen: false, nextOpen: null, nextClose: null, timestamp: null } as never,
    price,
    sessionVolume: 191_619_629,
    barTimestamp: "2026-09-18T20:00:00.000Z",
    tradeTimestamp: "2026-09-18T19:58:12.000Z",
    tradePrice: 222.31,
    effectiveAsOf: "2026-09-18T20:00:00.000Z",
    marketSessionAsOf: "2026-09-18",
    metrics,
    sector: {
      sector: "Information Technology",
      benchmarkEtf: "XLK",
      benchmarkChangePct: 0.82,
      classificationSource: "sp500-v1",
    },
    news: [
      {
        id: "provider-news-id-1",
        headline: "Chip demand stays firm into the quarter",
        source: "benzinga",
        publishedAt: "2026-09-18T15:34:31Z",
        url: "https://example.invalid/news/1",
        category: "company",
        contextOnly: false,
      },
    ],
    newsOk: true,
    sec: [
      {
        form: "8-K",
        formLabel: "Current report",
        filingDate: "2026-09-17",
        acceptanceDateTime: "2026-09-17T21:00:00Z",
        filingUrl: "https://example.invalid/sec/1",
      },
    ],
    secOk: true,
    actions: [{ type: "dividend", date: "2026-09-10", description: "quarterly cash dividend" }],
    actionsOk: true,
    eventWindow: { startIso: "2026-09-17T20:00:00.000Z", cutoffIso: "2026-09-18T20:00:00.000Z" },
    stale: false,
    delayMinutes: 15,
  });
  return {
    version: TICKER_CONTEXT_VERSION,
    status: "ok",
    requestedSymbol: "NVDA",
    symbol: "NVDA",
    identity: {
      symbol: "NVDA",
      name: "NVIDIA Corporation Common Stock",
      exchange: "NASDAQ",
      assetClass: "us_equity",
      status: "active",
      tradable: true,
    },
    requestedAt: "2026-09-18T21:00:00.000Z",
    generatedAt: "2026-09-18T21:00:01.000Z",
    providerAsOf: build.providerAsOf,
    marketSessionAsOf: build.marketSessionAsOf,
    effectiveAsOf: build.effectiveAsOf,
    session: build.session,
    sources: build.sources,
    availability: build.availability,
    facts: build.facts,
    confidence: build.confidence,
    fingerprint: build.fingerprint,
  };
}

describe("ticker-summary-v1 public summary (V1.2C)", () => {
  it("copies the exact computed values, with units, from the sealed pipeline", () => {
    const summary = projectTickerSummary(contextFixture());
    expect(summary.version).toBe("ticker-summary-v1");
    expect(summary.price).toEqual({
      value: 222.27,
      previousClose: 219.34,
      changePct: 1.34,
      direction: "advancer",
      sessionDate: "2026-09-18",
      feed: "delayed_sip",
      delayMinutes: 15,
    });
    expect(summary.volume?.sessionVolume).toBe(191_619_629);
    expect(summary.volume?.avgVolume20).toBe(130_670_732);
    expect(summary.volume?.relativeVolume).toBe(1.47);
    expect(summary.volume?.partialSessionVolumePctOfAvg).toBeNull();
    expect(summary.volume?.sessionCompleted).toBe(true);
    expect(summary.volatility?.returnVol20Pct).toBe(2.92);
    expect(summary.volatility?.latestMoveSigma).toBe(0.46);
    expect(summary.volatility?.historySessionCount).toBe(30);
    expect(summary.range?.prior20Low).toBe(207.25);
    expect(summary.range?.prior20High).toBe(234.76);
    expect(summary.range?.rangePositionPct).toBe(54.6);
    expect(summary.sector).toEqual({
      name: "Information Technology",
      benchmarkTicker: "XLK",
      benchmarkChangePct: 0.82,
      classificationSource: "sp500-v1",
    });
    expect(summary.events?.status).toBe("candidates");
    expect(summary.events?.newsCount).toBe(1);
    expect(summary.events?.secCount).toBe(1);
    expect(summary.events?.corporateActionCount).toBe(1);
    expect(summary.events?.news[0]).toEqual({
      headline: "Chip demand stays firm into the quarter",
      source: "benzinga",
      publishedAt: "2026-09-18T15:34:31Z",
      category: "company",
      specificity: "company_specific",
    });
    expect(summary.events?.filings[0]).toEqual({
      form: "8-K",
      formLabel: "Current report",
      filedAt: "2026-09-17",
    });
    expect(summary.events?.corporateActions[0]?.type).toBe("dividend");
  });

  it("never exposes raw fact data, provider ids, URLs or credentials", () => {
    const serialized = JSON.stringify(projectTickerSummary(contextFixture()));
    for (const forbidden of [
      "provider-news-id-1",
      "example.invalid",
      "filingUrl",
      "newsId",
      "barTimestamp",
      "cik",
      "apiKey",
      "Authorization",
      'data":',
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it("keeps the fact text, fact metadata and fingerprint unchanged", () => {
    const context = contextFixture();
    const projected = projectTickerContext(context);
    expect(projected.fingerprint).toBe(context.fingerprint);
    expect(projected.facts.map((fact) => fact.text)).toEqual(
      context.facts.map((fact) => fact.text),
    );
    expect(projected.facts.map((fact) => fact.id)).toEqual(context.facts.map((fact) => fact.id));
    for (const fact of projected.facts) expect(fact).not.toHaveProperty("data");
    // Existing consumers keep their fields.
    expect(Object.keys(projected)).toEqual(
      expect.arrayContaining([
        "version",
        "status",
        "identity",
        "requestedAt",
        "generatedAt",
        "providerAsOf",
        "marketSessionAsOf",
        "effectiveAsOf",
        "session",
        "sources",
        "availability",
        "confidence",
        "factCount",
        "facts",
        "summary",
        "fingerprint",
      ]),
    );
  });

  it("reports honest nulls when evidence is missing (never zeros or substitutes)", () => {
    const context = contextFixture();
    const withoutMetrics: TickerResearchContext = {
      ...context,
      facts: context.facts.filter(
        (fact) =>
          !/\.(volume|volatility|range|sector|catalyst|news\.\d+|sec\.\d+|corporateAction\.\d+)$/.test(
            fact.id,
          ),
      ),
      availability: {
        price: true,
        history: false,
        volume: false,
        volatility: false,
        sector: false,
        news: false,
        sec: false,
        corporateActions: false,
      },
    };
    const summary = projectTickerSummary(withoutMetrics);
    expect(summary.price?.value).toBe(222.27);
    for (const block of ["volume", "volatility", "range", "sector", "events"] as const) {
      expect(summary[block]).toBeNull();
    }
  });

  it("keeps an in-session volume partial and never a comparable multiple", () => {
    const metrics = computeTickerMetrics({
      history,
      price: price.refPrice,
      dailyChangePct: price.changePct,
      sessionVolume: 40_000_000,
      sessionCompleted: false,
    });
    const build = buildTickerEvidence({
      symbol: "NVDA",
      identity: {
        symbol: "NVDA",
        name: "NVIDIA Corporation Common Stock",
        exchange: "NASDAQ",
        assetClass: "us_equity",
        status: "active",
        tradable: true,
      },
      clock: { isOpen: true } as never,
      price,
      sessionVolume: 40_000_000,
      barTimestamp: "2026-09-18T18:00:00.000Z",
      tradeTimestamp: null,
      tradePrice: null,
      effectiveAsOf: "2026-09-18T18:00:00.000Z",
      marketSessionAsOf: "2026-09-18",
      metrics,
      sector: null,
      news: [],
      newsOk: false,
      sec: [],
      secOk: false,
      actions: [],
      actionsOk: false,
      eventWindow: null,
      stale: false,
      delayMinutes: 15,
    });
    const summary = projectTickerSummary({ ...contextFixture(), facts: build.facts });
    expect(summary.volume?.sessionCompleted).toBe(false);
    expect(summary.volume?.relativeVolume).toBeNull();
    expect(summary.volume?.partialSessionVolumePctOfAvg).toBe(30.6);
    expect(summary.events?.status).toBe("none");
    expect(summary.sector).toBeNull();
  });
});
