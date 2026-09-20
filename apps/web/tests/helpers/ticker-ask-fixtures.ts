/**
 * Shared ticker-context fixtures for the V1.2B Ask integration tests.
 * Values mirror the real V1.2A acceptance output shape (NVDA, 2026-09-18).
 */
import type {
  TickerEvidenceFact,
  TickerResearchContext,
  TickerResearchResult,
} from "@/lib/ticker-context/types";
import { TICKER_CONTEXT_VERSION } from "@/lib/ticker-context/types";

export function tickerFactsFixture(): TickerEvidenceFact[] {
  return [
    {
      id: "ticker.NVDA.identity",
      domain: "identity",
      text: "NVDA — NVIDIA Corporation Common Stock (NASDAQ). Provider security directory: class us_equity, status active, tradable yes.",
      data: { symbol: "NVDA", name: "NVIDIA Corporation Common Stock", exchange: "NASDAQ" },
      asOf: null,
      freshness: "fresh",
      confidence: "high",
      sourceVersion: "alpaca-assets-v1",
    },
    {
      id: "ticker.NVDA.price",
      domain: "price",
      text: "NVDA regular-session reference price 222.27 vs previous close 219.34 — up 1.34% on session 2026-09-18 ET. Feed: delayed SIP 15 minutes behind; after-hours prints are never used for this reference price.",
      data: { symbol: "NVDA", price: 222.27, previousClose: 219.34, changePct: 1.34 },
      asOf: "2026-09-18T20:00:00.000Z",
      freshness: "delayed",
      confidence: "high",
      sourceVersion: "alpaca-delayed-sip-v1",
    },
    {
      id: "ticker.NVDA.volume",
      domain: "volume",
      text: "NVDA completed-session volume 191619629 vs 20-session average full-day volume 130670732 — 1.47× (session 2026-09-18 ET).",
      data: { symbol: "NVDA", relativeVolume: 1.47 },
      asOf: "2026-09-18T20:00:00.000Z",
      freshness: "delayed",
      confidence: "high",
      sourceVersion: "ticker-metrics-v1",
    },
    {
      id: "ticker.NVDA.volatility",
      domain: "volatility",
      text: "NVDA 20-session realized daily-return volatility is 2.92% (sample σ of split-adjusted close-to-close returns over completed sessions; 110 completed sessions available). The latest move is 0.46× that realized volatility. Statistical magnitude only — not an anomaly-v1 score.",
      data: { symbol: "NVDA", returnVol20Pct: 2.92 },
      asOf: "2026-09-18T20:00:00.000Z",
      freshness: "delayed",
      confidence: null,
      sourceVersion: "alpaca-sip-daily-v1",
    },
    {
      id: "ticker.NVDA.sector",
      domain: "sector",
      text: "NVDA is classified Information Technology (sp500-v1); XLK is up 0.82% in the same delayed-SIP observation.",
      data: { symbol: "NVDA", benchmarkEtf: "XLK" },
      asOf: "2026-09-18T20:00:00.000Z",
      freshness: "delayed",
      confidence: null,
      sourceVersion: "sp500-v1",
    },
    {
      id: "ticker.NVDA.news.1",
      domain: "news",
      text: 'NVDA company-specific news: "QUICK SPARK: Want Nvidia on Crypto Rails?" (benzinga, published 2026-09-18T19:18:59Z, category OTHER). Contextual evidence only — not a proven cause of the price move.',
      data: {
        symbol: "NVDA",
        headline: "QUICK SPARK: Want Nvidia on Crypto Rails?",
        source: "benzinga",
      },
      asOf: "2026-09-18T19:18:59Z",
      freshness: "delayed",
      confidence: null,
      sourceVersion: "alpaca-news-v1",
    },
    {
      id: "ticker.NVDA.catalyst",
      domain: "catalyst",
      text: "No clear company-specific catalyst identified for NVDA in the evidence window 2026-09-17T20:00:00.000Z → 2026-09-18T20:00:00.000Z.",
      data: { symbol: "NVDA", status: "none", newsCount: 1, secCount: 0, corporateActionCount: 0 },
      asOf: "2026-09-18T20:00:00.000Z",
      freshness: "delayed",
      confidence: null,
      sourceVersion: "ticker-event-window-v1",
    },
  ];
}

export function tickerContextFixture(
  overrides: Partial<TickerResearchContext> = {},
): TickerResearchContext {
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
    generatedAt: "2026-09-18T21:00:00.000Z",
    providerAsOf: "2026-09-18T20:00:00.000Z",
    marketSessionAsOf: "2026-09-18",
    effectiveAsOf: "2026-09-18T20:00:00.000Z",
    session: { marketOpen: false, phase: "closed", sessionDate: "2026-09-18" },
    sources: {
      market: {
        available: true,
        asOf: "2026-09-18T20:00:00.000Z",
        freshness: "delayed",
        confidence: null,
        version: "alpaca-delayed-sip-v1",
      },
      identity: {
        available: true,
        asOf: null,
        freshness: "fresh",
        confidence: "high",
        version: "alpaca-assets-v1",
      },
      sector: {
        available: true,
        asOf: "2026-09-18T20:00:00.000Z",
        freshness: "delayed",
        confidence: null,
        version: "sp500-v1",
      },
      news: {
        available: true,
        asOf: "2026-09-18T19:18:59Z",
        freshness: "delayed",
        confidence: null,
        version: "alpaca-news-v1",
      },
      sec: {
        available: true,
        asOf: null,
        freshness: "delayed",
        confidence: null,
        version: "sec-edgar-submissions-v1",
      },
    },
    availability: {
      price: true,
      history: true,
      volume: true,
      volatility: true,
      sector: true,
      news: true,
      sec: true,
      corporateActions: false,
    },
    facts: tickerFactsFixture(),
    confidence: { score: 0.95, label: "high" },
    fingerprint: "f".repeat(64),
    ...overrides,
  };
}

export function tickerOkResult(
  overrides: Partial<TickerResearchContext> = {},
): TickerResearchResult {
  return { status: "ok", context: tickerContextFixture(overrides) };
}

export function tickerPartialResult(): TickerResearchResult {
  const base = tickerContextFixture();
  return {
    status: "partial",
    context: tickerContextFixture({
      status: "partial",
      availability: { ...base.availability, history: false, volatility: false },
      facts: tickerFactsFixture().filter((fact) => !fact.id.endsWith(".volatility")),
    }),
  };
}

export function tickerUnknownResult(symbol = "ZZZZ"): TickerResearchResult {
  return {
    status: "unsupported_symbol",
    requestedSymbol: symbol,
    symbol: null,
    reason: "unknown_symbol",
  };
}

export function tickerUnsupportedResult(symbol = "BTCUSD"): TickerResearchResult {
  return {
    status: "unsupported_symbol",
    requestedSymbol: symbol,
    symbol: null,
    reason: "unsupported_security_type",
  };
}

export function tickerUnavailableResult(symbol = "NVDA"): TickerResearchResult {
  return {
    status: "unavailable",
    requestedSymbol: symbol,
    symbol: null,
    reason: "provider_unavailable",
    mode: "live",
  };
}

export function tickerInsufficientResult(symbol = "NVDA"): TickerResearchResult {
  const base = tickerContextFixture();
  return {
    status: "insufficient_data",
    context: tickerContextFixture({
      status: "insufficient_data",
      symbol,
      requestedSymbol: symbol,
      availability: { ...base.availability, price: false, history: false },
      facts: tickerFactsFixture().filter((fact) => fact.id.endsWith(".identity")),
    }),
  };
}
