import { describe, expect, it } from "vitest";
import type { MacroOverview, MacroSignal, MacroSignalId, MarketOverview } from "@war-room/types";
import { parseRegimeResult, toEnginePayload } from "@/lib/regime/client";
import { buildRegimeInput } from "@/lib/regime/build-input";

function marketOverview(overrides: Partial<MarketOverview> = {}): MarketOverview {
  return {
    meta: {
      mode: "live",
      provider: "alpaca",
      feed: "iex",
      asOf: "2026-08-31T14:30:00Z",
      marketOpen: true,
      nextOpen: null,
      nextClose: null,
      stale: false,
    },
    indices: [
      {
        ticker: "SPY",
        name: "S&P 500 ETF",
        price: 560,
        changePct: -0.31,
        open: 562,
        high: 565,
        low: 559,
        surface: "sakura",
      },
      {
        ticker: "QQQ",
        name: "Nasdaq 100 ETF",
        price: 492,
        changePct: 0.4,
        open: 490,
        high: 495,
        low: 488,
        surface: "lavender",
      },
      {
        ticker: "IWM",
        name: "Russell 2000 ETF",
        price: null,
        changePct: null,
        open: null,
        high: null,
        low: null,
        surface: "cream",
      },
      {
        ticker: "DIA",
        name: "Dow 30 ETF",
        price: 410,
        changePct: -0.12,
        open: 411,
        high: 413,
        low: 409,
        surface: "mint",
      },
    ],
    sectors: ["XLK", "XLF", "XLE", "XLV", "XLI", "XLP", "XLY", "XLU", "XLB", "XLRE", "XLC"].map(
      (etf) => ({
        id: etf,
        sector: etf,
        etf,
        dailyReturnPct: etf === "XLK" ? 0.4 : 0.1,
        relativeReturnPct: etf === "XLK" ? 0.72 : 0.4,
        signal: "Neutral",
        tone: "neutral" as const,
        strength: 50,
      }),
    ),
    ...overrides,
  };
}

function macroSignal(
  id: MacroSignalId,
  value: number | null,
  change: number | null,
  changePct: number | null,
  opts: Partial<{ available: boolean; stale: boolean }> = {},
): MacroSignal {
  return {
    id,
    label: id,
    value,
    displayUnit: "index",
    change,
    changePct,
    interpretation: null,
    tone: "neutral",
    source: "FRED",
    frequency: "daily",
    asOf: "2026-08-28T00:00:00Z",
    stale: opts.stale ?? false,
    available: opts.available ?? true,
  };
}

function macroOverview(overrides: Partial<MacroOverview> = {}): MacroOverview {
  return {
    meta: { mode: "live", asOf: "2026-08-28T00:00:00Z", stale: false, providers: ["fred"] },
    signals: [
      macroSignal("vix", 14.3, -0.8, -5.3),
      macroSignal("us10y", 4.77, 0.08, 1.7),
      macroSignal("usd_broad", 118.75, -0.28, -0.24),
      macroSignal("wti", 78.5, 1.9, 2.5),
      macroSignal("gold", 2438.1, 21.75, 0.9),
      macroSignal("btc", 62000, 850, 1.4),
    ],
    ...overrides,
  };
}

describe("buildRegimeInput", () => {
  it("maps every expected index with availability from changePct", () => {
    const input = buildRegimeInput(marketOverview(), macroOverview());
    expect(input.indices.map((i) => i.ticker)).toEqual(["SPY", "QQQ", "IWM", "DIA"]);
    expect(input.indices.find((i) => i.ticker === "SPY")?.changePct).toBe(-0.31);
    expect(input.indices.find((i) => i.ticker === "IWM")?.available).toBe(false);
    expect(input.indices.find((i) => i.ticker === "SPY")?.stale).toBe(false);
  });

  it("maps all 11 sector ETFs with daily returns", () => {
    const input = buildRegimeInput(marketOverview(), macroOverview());
    expect(input.sectors).toHaveLength(11);
    expect(input.sectors.find((s) => s.ticker === "XLK")?.changePct).toBe(0.4);
    expect(input.sectors.every((s) => s.available)).toBe(true);
  });

  it("maps all six macro signals with value/change/changePct/flags", () => {
    const input = buildRegimeInput(marketOverview(), macroOverview());
    expect(input.macro?.wti).toMatchObject({
      value: 78.5,
      change: 1.9,
      changePct: 2.5,
      available: true,
    });
    expect(input.macro?.usd_broad?.value).toBe(118.75);
    expect(input.macro?.gold?.frequency).toBe("daily");
  });

  it("flags inputs stale when the market meta is stale", () => {
    const input = buildRegimeInput(
      marketOverview({ meta: { ...marketOverview().meta, stale: true } }),
      macroOverview(),
    );
    expect(input.indices.find((i) => i.ticker === "SPY")?.stale).toBe(true);
    expect(input.sectors.find((s) => s.ticker === "XLK")?.stale).toBe(true);
  });

  it("carries macro staleness flags from the macro signals", () => {
    const macro = macroOverview();
    macro.signals.find((s) => s.id === "wti")!.stale = true;
    const input = buildRegimeInput(marketOverview(), macro);
    expect(input.macro?.wti?.stale).toBe(true);
  });

  it("uses the newest available asOf", () => {
    const input = buildRegimeInput(marketOverview(), macroOverview());
    expect(input.as_of).toBe("2026-08-31T14:30:00Z");
  });
});

describe("toEnginePayload", () => {
  it("serializes camelCase inputs into the Python snake_case wire contract", () => {
    const input = buildRegimeInput(marketOverview(), macroOverview());
    const wire = toEnginePayload(input);
    expect(wire.as_of).toBe("2026-08-31T14:30:00Z");
    expect((wire.indices as Array<Record<string, unknown>>)[0]).toMatchObject({
      ticker: "SPY",
      change_pct: -0.31,
      available: true,
      stale: false,
    });
    const macro = wire.macro as Record<string, Record<string, unknown>>;
    expect(macro.wti).toMatchObject({ change_pct: 2.5, value: 78.5 });
    expect(macro.usd_broad?.change_pct).toBe(-0.24);
    expect(macro).not.toHaveProperty("changePct");
  });
});

describe("parseRegimeResult", () => {
  it("normalizes the Python snake_case payload into the camelCase contract", () => {
    const result = parseRegimeResult({
      score: 41.8,
      display_score: 42,
      label: "CAUTIOUS / NEUTRAL",
      coverage: 0.87,
      confidence: "high",
      components: [{ id: "equity", name: "Equity Tape", score: 37.2, weight: 0.3 }],
      positive_drivers: [
        { id: "vix", name: "VIX", direction: "positive", impact: 2.4, reason: "VIX fell 5%" },
      ],
      negative_drivers: [
        {
          id: "us10y",
          name: "US 10Y",
          direction: "negative",
          impact: -3.8,
          reason: "US 10Y rose 8 bp",
        },
      ],
      stale_inputs: ["wti"],
      missing_inputs: [],
      as_of: "2026-09-01T12:00:00Z",
      engine_version: "regime-v1",
    });
    expect(result).not.toBeNull();
    expect(result?.score).toBe(41.8);
    expect(result?.displayScore).toBe(42);
    expect(result?.coverage).toBe(0.87);
    expect(result?.components[0]?.id).toBe("equity");
    expect(result?.positiveDrivers[0]?.reason).toContain("VIX");
    expect(result?.staleInputs).toEqual(["wti"]);
    expect(result?.engineVersion).toBe("regime-v1");
  });

  it("returns null for malformed payloads", () => {
    expect(parseRegimeResult(null)).toBeNull();
    expect(parseRegimeResult({ score: 41 })).toBeNull();
    expect(parseRegimeResult({})).toBeNull();
    expect(parseRegimeResult([1, 2, 3])).toBeNull();
  });
});
