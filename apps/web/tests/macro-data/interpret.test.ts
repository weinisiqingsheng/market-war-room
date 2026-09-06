import { describe, expect, it } from "vitest";
import { makeMacroConfig } from "./fred.test";
import { computeMacroStale, interpretMacroSignal } from "@/lib/macro-data/interpret";
import { formatMacroChange, formatMacroValue } from "@/lib/format";
import type { MacroSignal } from "@war-room/types";

describe("interpretMacroSignal — deterministic display interpretations", () => {
  it("VIX: falling materially → Volatility Calm (positive)", () => {
    expect(interpretMacroSignal("vix", 15.21, -0.5, -3.2)).toEqual({
      interpretation: "Volatility Calm",
      tone: "positive",
    });
  });

  it("VIX: rising materially → Volatility Rising (warning)", () => {
    expect(interpretMacroSignal("vix", 18.0, 1.2, 6.0)).toEqual({
      interpretation: "Volatility Rising",
      tone: "warning",
    });
  });

  it("US 10Y: rising yield → Rate Pressure (warning)", () => {
    expect(interpretMacroSignal("us10y", 4.76, 0.08, 1.71)).toEqual({
      interpretation: "Rate Pressure",
      tone: "warning",
    });
  });

  it("WTI: material rise → Inflation Risk (negative) even though price is UP", () => {
    const result = interpretMacroSignal("wti", 85.51, 2.1, 2.5);
    expect(result).toEqual({ interpretation: "Inflation Risk", tone: "negative" });
  });

  it("WTI: material fall → Inflation Relief (positive)", () => {
    expect(interpretMacroSignal("wti", 74, -2.0, -2.6)).toEqual({
      interpretation: "Inflation Relief",
      tone: "positive",
    });
  });

  it("Broad USD Index: falling → Dollar Softening (neutral)", () => {
    expect(interpretMacroSignal("usd_broad", 118.75, -0.28, -0.24)).toEqual({
      interpretation: "Dollar Softening",
      tone: "neutral",
    });
  });

  it("Broad USD Index: rising → Dollar Strength (neutral)", () => {
    expect(interpretMacroSignal("usd_broad", 118.75, 0.39, 0.33)).toEqual({
      interpretation: "Dollar Strength",
      tone: "neutral",
    });
  });

  it("Broad USD Index: near-zero move → Dollar Neutral (neutral)", () => {
    expect(interpretMacroSignal("usd_broad", 118.75, 0.04, 0.03)).toEqual({
      interpretation: "Dollar Neutral",
      tone: "neutral",
    });
    expect(interpretMacroSignal("usd_broad", 118.75, -0.04, -0.03)).toEqual({
      interpretation: "Dollar Neutral",
      tone: "neutral",
    });
  });

  it("Gold: rising → Safe-Haven Bid (positive)", () => {
    expect(interpretMacroSignal("gold", 2438.1, 21.75, 0.9)).toEqual({
      interpretation: "Safe-Haven Bid",
      tone: "positive",
    });
  });

  it("BTC: rising → Risk Appetite (positive); falling → Risk Sentiment Weak (negative)", () => {
    expect(interpretMacroSignal("btc", 62150, 857, 1.4)).toEqual({
      interpretation: "Risk Appetite",
      tone: "positive",
    });
    expect(interpretMacroSignal("btc", 58000, -800, -1.4)).toEqual({
      interpretation: "Risk Sentiment Weak",
      tone: "negative",
    });
  });

  it("returns null when the value or change is missing", () => {
    expect(interpretMacroSignal("wti", null, 2.1, 2.5)).toBeNull();
    expect(interpretMacroSignal("wti", 85, null, null)).toBeNull();
  });
});

describe("formatMacroValue / formatMacroChange", () => {
  it("formats US 10Y change in basis points, never as a % return", () => {
    const signal: MacroSignal = {
      id: "us10y",
      label: "US 10Y",
      value: 4.76,
      displayUnit: "percent",
      change: 0.08,
      changePct: 1.71,
      interpretation: "Rate Pressure",
      tone: "warning",
      source: "FRED",
      frequency: "daily",
      asOf: null,
      stale: false,
      available: true,
    };
    expect(formatMacroValue(signal)).toBe("4.76%");
    expect(formatMacroChange(signal)).toBe("+8 bp");
  });

  it("formats price and index values with the right units", () => {
    const wti: MacroSignal = {
      id: "wti",
      label: "WTI",
      value: 85.51,
      displayUnit: "price",
      change: 2.1,
      changePct: 2.5,
      interpretation: "Inflation Risk",
      tone: "negative",
      source: "Twelve Data",
      frequency: "intraday",
      asOf: null,
      stale: false,
      available: true,
    };
    const vix: MacroSignal = {
      ...wti,
      id: "vix",
      label: "VIX",
      value: 15.42,
      displayUnit: "index",
    };
    expect(formatMacroValue(wti)).toBe("$85.51");
    expect(formatMacroValue(vix)).toBe("15.42");
    expect(formatMacroChange(wti)).toBe("+2.50%");
  });
});

describe("computeMacroStale — frequency-aware freshness", () => {
  const config = makeMacroConfig();
  const now = Date.now();

  it("does NOT mark a FRED daily observation stale just because it is a day old", () => {
    const yesterday = new Date(now - 24 * 60 * 60_000).toISOString();
    expect(computeMacroStale("daily", yesterday, config, now)).toBe(false);
  });

  it("marks a FRED observation stale only when unusually old", () => {
    const weekAgo = new Date(now - 7 * 24 * 60 * 60_000).toISOString();
    expect(computeMacroStale("daily", weekAgo, config, now)).toBe(true);
  });

  // Business-day aware: a Friday observation stays fresh across the weekend.
  it("keeps a Friday observation fresh when viewed Saturday", () => {
    expect(
      computeMacroStale(
        "daily",
        "2026-08-28T00:00:00Z",
        config,
        Date.parse("2026-08-29T12:00:00Z"),
      ),
    ).toBe(false);
  });

  it("keeps a Friday observation fresh when viewed Sunday", () => {
    expect(
      computeMacroStale(
        "daily",
        "2026-08-28T00:00:00Z",
        config,
        Date.parse("2026-08-30T12:00:00Z"),
      ),
    ).toBe(false);
  });

  it("keeps a Friday observation fresh when viewed Monday", () => {
    // Matches the real validation: Friday 08-28 observed Monday 08-31 evening US
    // (e.g. 2026-08-31T23:00:00Z) must NOT be stale.
    expect(
      computeMacroStale(
        "daily",
        "2026-08-28T00:00:00Z",
        config,
        Date.parse("2026-08-31T23:00:00Z"),
      ),
    ).toBe(false);
  });

  it("keeps a Friday observation fresh (boundary) when viewed Tuesday", () => {
    expect(
      computeMacroStale(
        "daily",
        "2026-08-28T00:00:00Z",
        config,
        Date.parse("2026-09-01T12:00:00Z"),
      ),
    ).toBe(false);
  });

  it("marks a Friday observation stale when viewed Wednesday (3 business days missing)", () => {
    expect(
      computeMacroStale(
        "daily",
        "2026-08-28T00:00:00Z",
        config,
        Date.parse("2026-09-02T12:00:00Z"),
      ),
    ).toBe(true);
  });

  it("does not treat weekend calendar time as missing daily observations", () => {
    // Saturday observation is not a real FRED case, but the underlying rule
    // must not count weekend elapsed time toward staleness.
    expect(
      computeMacroStale(
        "daily",
        "2026-08-29T00:00:00Z",
        config,
        Date.parse("2026-08-31T12:00:00Z"),
      ),
    ).toBe(false);
  });

  it("uses a tight threshold for intraday (Twelve Data)", () => {
    const old = new Date(now - 30 * 60_000).toISOString();
    expect(computeMacroStale("intraday", old, config, now)).toBe(true);
    const recent = new Date(now - 5 * 60_000).toISOString();
    expect(computeMacroStale("intraday", recent, config, now)).toBe(false);
  });
});
