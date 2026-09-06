import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeMacroConfig } from "./fred.test";
import { resetMacroProviderCacheForTests } from "@/lib/macro-data/cache";
import { getMacroProvider } from "@/lib/macro-data/provider";
import { buildMacroOverview, buildDemoMacroOverview } from "@/lib/macro-data/overview";
import type { MacroProviderResult, NormalizedMacroSnapshot } from "@/lib/macro-data/types";

vi.mock("@/lib/macro-data/provider", () => ({
  getMacroProvider: vi.fn(),
}));

function snapshot(id: string, value: number, change: number): NormalizedMacroSnapshot {
  return {
    id: id as NormalizedMacroSnapshot["id"],
    value,
    change,
    changePct: change !== 0 ? (change / 100) * 100 : 0,
    frequency:
      id === "btc" ? "realtime" : id === "gold" || id === "wti-as-twelve" ? "intraday" : "daily",
    asOf: new Date(Date.now() - 30_000).toISOString(),
    available: true,
  };
}

function setProviderOutcomes(outcomes: {
  fred?: () => Promise<MacroProviderResult>;
  twelve?: () => Promise<MacroProviderResult>;
  "alpaca-crypto"?: () => Promise<MacroProviderResult>;
}) {
  vi.mocked(getMacroProvider).mockImplementation((_config, provider) => {
    return async () => {
      const outcome = outcomes[provider];
      if (!outcome) throw new Error("unexpected provider");
      return outcome();
    };
  });
}

beforeEach(() => {
  resetMacroProviderCacheForTests();
  vi.clearAllMocks();
});

describe("buildMacroOverview", () => {
  it("composes all providers into six signals with interpretation + provenance", async () => {
    setProviderOutcomes({
      fred: async () => ({
        provider: "fred",
        signals: [
          snapshot("vix", 15.21, -0.5),
          snapshot("us10y", 4.76, 0.08),
          snapshot("usd_broad", 118.75, -0.28),
          snapshot("wti", 85.51, 2.1),
        ],
        degraded: false,
      }),
      twelve: async () => ({
        provider: "twelve",
        signals: [snapshot("gold", 2438.1, 21.75)],
        degraded: false,
      }),
      "alpaca-crypto": async () => ({
        provider: "alpaca-crypto",
        signals: [snapshot("btc", 62150, 857)],
        degraded: false,
      }),
    });

    const overview = await buildMacroOverview(makeMacroConfig());
    expect(overview.signals).toHaveLength(6);
    expect(overview.signals.every((s) => s.available)).toBe(true);

    const wti = overview.signals.find((s) => s.id === "wti");
    expect(wti?.value).toBe(85.51);
    expect(wti?.interpretation).toBe("Inflation Risk"); // up price, negative tone
    expect(wti?.tone).toBe("negative");
    expect(wti?.source).toBe("FRED"); // WTI moved to FRED (DCOILWTICO), daily
    expect(wti?.frequency).toBe("daily");

    const vix = overview.signals.find((s) => s.id === "vix");
    expect(vix?.source).toBe("FRED");
    expect(vix?.frequency).toBe("daily");

    const usdBroad = overview.signals.find((s) => s.id === "usd_broad");
    expect(usdBroad?.label).toBe("US Dollar");
    expect(usdBroad?.instrument).toBe("Broad USD Index");
    expect(usdBroad?.source).toBe("FRED");
    expect(usdBroad?.frequency).toBe("daily");
    expect(usdBroad?.interpretation).toBe("Dollar Softening");

    const gold = overview.signals.find((s) => s.id === "gold");
    expect(gold?.source).toBe("Twelve Data"); // Gold stays on Twelve Data
    expect(gold?.frequency).toBe("intraday");

    const btc = overview.signals.find((s) => s.id === "btc");
    expect(btc?.source).toBe("Alpaca");
    expect(btc?.frequency).toBe("realtime");

    expect(overview.meta.providers).toEqual(
      expect.arrayContaining(["fred", "twelve", "alpaca-crypto"]),
    );
  });

  it("keeps other providers available when one provider fails (partial failure)", async () => {
    setProviderOutcomes({
      fred: async () => ({
        provider: "fred",
        signals: [
          snapshot("vix", 15.21, -0.5),
          snapshot("us10y", 4.76, 0.08),
          snapshot("usd_broad", 118.75, -0.28),
          snapshot("wti", 85.51, 2.1),
        ],
        degraded: false,
      }),
      twelve: async () => {
        throw new Error("Twelve Data rate-limited");
      },
      "alpaca-crypto": async () => ({
        provider: "alpaca-crypto",
        signals: [snapshot("btc", 62150, 857)],
        degraded: false,
      }),
    });

    const overview = await buildMacroOverview(makeMacroConfig());
    const byId = Object.fromEntries(overview.signals.map((s) => [s.id, s]));

    expect(byId.vix?.available).toBe(true);
    expect(byId.us10y?.available).toBe(true);
    expect(byId.usd_broad?.available).toBe(true);
    expect(byId.wti?.available).toBe(true); // WTI works through FRED while Twelve fails
    expect(byId.wti?.value).toBe(85.51);
    expect(byId.gold?.available).toBe(false); // only Gold is hit by the Twelve failure
    expect(byId.gold?.value).toBeNull(); // no demo Gold substitution
    expect(byId.btc?.available).toBe(true);
  });

  it("marks a provider's signals unavailable when it returns unavailable snapshots", async () => {
    setProviderOutcomes({
      fred: async () => ({
        provider: "fred",
        signals: [
          { ...snapshot("vix", 15.21, -0.5), available: false, value: null, change: null },
          { ...snapshot("us10y", 4.76, 0.08), available: false, value: null, change: null },
          { ...snapshot("usd_broad", 118.75, -0.28), available: false, value: null, change: null },
          { ...snapshot("wti", 85.51, 2.1), available: false, value: null, change: null },
        ],
        degraded: false,
      }),
      twelve: async () => ({
        provider: "twelve",
        signals: [snapshot("gold", 2438.1, 21.75)],
        degraded: false,
      }),
      "alpaca-crypto": async () => ({
        provider: "alpaca-crypto",
        signals: [snapshot("btc", 62150, 857)],
        degraded: false,
      }),
    });

    const overview = await buildMacroOverview(makeMacroConfig());
    const vix = overview.signals.find((s) => s.id === "vix");
    expect(vix?.available).toBe(false);
    expect(vix?.interpretation).toBeNull();
    // WTI is owned by FRED now, so a FRED outage blanks WTI too…
    expect(overview.signals.find((s) => s.id === "wti")?.available).toBe(false);
    // …while Gold (Twelve Data) and BTC (Alpaca) stay available.
    expect(overview.signals.find((s) => s.id === "gold")?.available).toBe(true);
    expect(overview.signals.find((s) => s.id === "btc")?.available).toBe(true);
  });

  it("demo mode returns demo signals with a demo meta", () => {
    const overview = buildDemoMacroOverview();
    expect(overview.meta.mode).toBe("demo");
    expect(overview.signals).toHaveLength(6);
    expect(overview.signals[0]?.source).toBe("Demo");
  });
});
