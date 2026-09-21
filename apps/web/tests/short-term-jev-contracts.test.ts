import { describe, expect, it } from "vitest";
import {
  canonicalizeMarketState,
  fingerprintMarketState,
} from "@/lib/short-term/market-data/canonicalize";
import type { ShortTermMarketState } from "@/lib/short-term/market-data/types";
import { normalizeJevAssessmentRequest } from "@/lib/short-term/jev/types";
import { marketStateFromTickerContext } from "@/lib/short-term/market-data/adapter";
import type { TickerResearchContext } from "@/lib/ticker-context/types";

const state: ShortTermMarketState = {
  version: "short-term-market-state-v1",
  symbol: "NVDA",
  security: {
    name: "NVIDIA Corporation",
    exchange: "NASDAQ",
    assetClass: "us_equity",
    status: "active",
    tradable: true,
  },
  effectiveAsOf: "2026-09-18T20:00:00.000Z",
  marketSessionAsOf: "2026-09-18",
  marketSessionStatus: "closed",
  feed: "delayed_sip",
  delayMinutes: 15,
  availability: {
    price: true,
    volume: true,
    history: true,
    volatility: true,
    sector: true,
  },
  freshness: "delayed",
  facts: [
    {
      id: "ticker.NVDA.price",
      domain: "price",
      values: { price: 100, previousClose: 99, changePct: 1.01 },
      asOf: "2026-09-18T20:00:00.000Z",
      freshness: "delayed",
      sourceVersion: "ticker-context-v1",
    },
  ],
  provenance: {
    source: "ticker-context-v1",
    sourceFingerprint: "a".repeat(64),
  },
};

describe("short-term market-state contracts", () => {
  it("normalizes the request and rejects out-of-range risk settings", () => {
    expect(
      normalizeJevAssessmentRequest({
        ticker: " nvda ",
        strategyId: "risk-first",
        horizonHours: 1,
        maxLossPct: 1,
      }),
    ).toMatchObject({ ticker: "NVDA" });
    expect(() =>
      normalizeJevAssessmentRequest({
        ticker: "NVDA",
        strategyId: "risk-first",
        horizonHours: 0,
        maxLossPct: 1,
      }),
    ).toThrow("Horizon");
  });

  it("canonicalizes object key order and preserves null availability", () => {
    const reordered = { ...state, facts: [...state.facts].reverse() };
    expect(canonicalizeMarketState(state)).toBe(canonicalizeMarketState(reordered));
    expect(fingerprintMarketState(state)).toMatch(/^[a-f0-9]{64}$/);
    expect({ ...state, availability: { ...state.availability, volatility: false } }).toMatchObject({
      availability: { volatility: false },
    });
  });

  it("maps typed ticker facts without parsing rendered evidence text", () => {
    const context = {
      version: "ticker-context-v1",
      status: "partial",
      requestedSymbol: "NVDA",
      symbol: "NVDA",
      identity: {
        symbol: "NVDA",
        name: "NVIDIA",
        exchange: "NASDAQ",
        assetClass: "us_equity",
        status: "active",
        tradable: true,
      },
      requestedAt: "2026-09-18T20:00:00.000Z",
      generatedAt: "2026-09-18T20:00:00.000Z",
      providerAsOf: "2026-09-18T19:59:00.000Z",
      marketSessionAsOf: "2026-09-18",
      effectiveAsOf: "2026-09-18T19:59:00.000Z",
      session: { marketOpen: false, phase: "closed", sessionDate: "2026-09-18" },
      sources: {
        market: {
          available: true,
          asOf: "2026-09-18T19:59:00.000Z",
          freshness: "delayed",
          confidence: "high",
          version: "market-v1",
        },
        identity: {
          available: true,
          asOf: null,
          freshness: "fresh",
          confidence: "high",
          version: "identity-v1",
        },
        sector: {
          available: false,
          asOf: null,
          freshness: "unavailable",
          confidence: null,
          version: null,
        },
        news: {
          available: false,
          asOf: null,
          freshness: "unavailable",
          confidence: null,
          version: null,
        },
        sec: {
          available: false,
          asOf: null,
          freshness: "unavailable",
          confidence: null,
          version: null,
        },
      },
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
      facts: [
        {
          id: "ticker.NVDA.price",
          domain: "price",
          text: "not parsed",
          data: { price: 100, feed: "delayed_sip", delayMinutes: 15 },
          asOf: "2026-09-18T19:59:00.000Z",
          freshness: "delayed",
          confidence: "high",
          sourceVersion: "ticker-context-v1",
        },
      ],
      confidence: { score: 0.4, label: "medium" },
      fingerprint: "f".repeat(64),
    } as TickerResearchContext;
    const mapped = marketStateFromTickerContext(context);
    expect(mapped.facts[0]?.values.price).toBe(100);
    expect(mapped.feed).toBe("delayed_sip");
    expect(mapped.delayMinutes).toBe(15);
  });
});
