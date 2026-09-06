import { describe, expect, it } from "vitest";
import type { MacroDataConfig } from "@/lib/macro-data/config";
import { computeMacroStale } from "@/lib/macro-data/interpret";
import { normalizeFredSeries } from "@/lib/macro-data/normalize";
import { getFredSignals } from "@/lib/macro-data/providers/fred";

export function makeMacroConfig(overrides: Partial<MacroDataConfig> = {}): MacroDataConfig {
  return {
    mode: "live",
    fredApiKey: "fred-key",
    fredBaseUrl: "https://api.stlouisfed.org/fred",
    twelveDataApiKey: "twelve-key",
    twelveDataBaseUrl: "https://api.twelvedata.com",
    timeoutMs: 200,
    staleAfterMs: { realtime: 300_000, intraday: 900_000, daily: 3 * 24 * 60 * 60_000 },
    alpaca: {
      apiKeyId: "key",
      apiSecretKey: "secret",
      dataBaseUrl: "https://data.test",
      timeoutMs: 200,
    },
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("normalizeFredSeries", () => {
  it("parses valid VIX observations newest-first and selects latest + previous", () => {
    const result = normalizeFredSeries("vix", {
      observations: [
        { date: "2026-08-28", value: "14.43" },
        { date: "2026-08-27", value: "14.51" },
        { date: "2026-08-26", value: "15.21" },
      ],
    });
    expect(result.available).toBe(true);
    expect(result.value).toBe(14.43);
    expect(result.change).toBeCloseTo(-0.08, 5);
    expect(result.changePct).toBeCloseTo((-0.08 / 14.51) * 100, 5);
    expect(result.asOf).toBe("2026-08-28T00:00:00Z");
  });

  it("skips '.' observations (FRED missing values)", () => {
    const result = normalizeFredSeries("vix", {
      observations: [
        { date: "2026-08-28", value: "." },
        { date: "2026-08-27", value: "14.51" },
        { date: "2026-08-26", value: "." },
        { date: "2026-08-25", value: "15.45" },
      ],
    });
    expect(result.value).toBe(14.51);
    expect(result.change).toBeCloseTo(14.51 - 15.45, 5);
  });

  it("reports unavailable when no valid observation exists", () => {
    const result = normalizeFredSeries("vix", {
      observations: [
        { date: "2026-08-28", value: "." },
        { date: "2026-08-27", value: "." },
      ],
    });
    expect(result.available).toBe(false);
    expect(result.value).toBeNull();
  });

  it("computes DGS10 yield change in yield points (basis-point display is separate)", () => {
    const result = normalizeFredSeries("us10y", {
      observations: [
        { date: "2026-08-28", value: "4.76" },
        { date: "2026-08-27", value: "4.68" },
      ],
    });
    expect(result.value).toBe(4.76);
    expect(result.change).toBeCloseTo(0.08, 5); // = 8 bp, formatted by the UI layer
  });

  it("computes the broad USD index change from latest − previous valid observation", () => {
    const result = normalizeFredSeries("usd_broad", {
      observations: [
        { date: "2026-08-28", value: "118.7479" },
        { date: "2026-08-27", value: "118.3583" },
        { date: "2026-08-26", value: "." },
      ],
    });
    expect(result.available).toBe(true);
    expect(result.value).toBe(118.7479);
    expect(result.change).toBeCloseTo(0.3896, 5);
    expect(result.changePct).toBeCloseTo((0.3896 / 118.3583) * 100, 5);
    expect(result.asOf).toBe("2026-08-28T00:00:00Z");
  });

  it("normalizes WTI DCOILWTICO (EIA Cushing spot) with latest − previous valid observation", () => {
    const result = normalizeFredSeries("wti", {
      observations: [
        { date: "2026-08-28", value: "78.54" },
        { date: "2026-08-27", value: "76.62" },
        { date: "2026-08-26", value: "75.94" },
      ],
    });
    expect(result.available).toBe(true);
    expect(result.value).toBe(78.54);
    expect(result.change).toBeCloseTo(1.92, 5);
    expect(result.changePct).toBeCloseTo((1.92 / 76.62) * 100, 5);
    expect(result.asOf).toBe("2026-08-28T00:00:00Z");
    expect(result.frequency).toBe("daily");
  });

  it("WTI skips '.' and falls back to the latest two VALID observations", () => {
    const result = normalizeFredSeries("wti", {
      observations: [
        { date: "2026-08-28", value: "." },
        { date: "2026-08-27", value: "78.54" },
        { date: "2026-08-26", value: "." },
        { date: "2026-08-25", value: "76.62" },
      ],
    });
    expect(result.available).toBe(true);
    expect(result.value).toBe(78.54);
    expect(result.change).toBeCloseTo(78.54 - 76.62, 5);
  });
});

describe("WTI freshness is business-day aware (FRED daily, never intraday)", () => {
  it("keeps a Friday DCOILWTICO observation fresh when viewed Monday evening US", () => {
    const snapshot = normalizeFredSeries("wti", {
      observations: [
        { date: "2026-08-28", value: "78.54" },
        { date: "2026-08-27", value: "76.62" },
      ],
    });
    // Compute staleness for the daily snapshot as the overview layer would.
    const stale = computeMacroStale(
      snapshot.frequency,
      snapshot.asOf,
      makeMacroConfig(),
      Date.parse("2026-08-31T23:00:00Z"),
    );
    expect(stale).toBe(false);
  });

  it("does not mark WTI stale after one weekend-elapsed business day", () => {
    const stale = computeMacroStale(
      "daily",
      "2026-08-28T00:00:00Z",
      makeMacroConfig(),
      Date.parse("2026-09-01T12:00:00Z"),
    );
    expect(stale).toBe(false);
  });
});

describe("getFredSignals", () => {
  it("returns unavailable snapshots when the API key is missing (no fetch)", async () => {
    const fetchSpy = {
      calls: 0,
      impl: async () => jsonResponse({}),
    };
    const config = makeMacroConfig({ fredApiKey: null });
    const result = await getFredSignals(config, async () => {
      fetchSpy.calls += 1;
      return fetchSpy.impl();
    });
    expect(result.signals.every((s) => !s.available)).toBe(true);
    expect(fetchSpy.calls).toBe(0);
  });

  it("marks all four series unavailable on a malformed FRED response", async () => {
    const config = makeMacroConfig({ timeoutMs: 1000 });
    const result = await getFredSignals(
      config,
      async () => new Response("<html>not json</html>", { status: 200 }),
    );
    expect(result.signals).toHaveLength(4);
    expect(result.signals.every((s) => !s.available)).toBe(true);
  });

  it("marks all four series unavailable on timeout", async () => {
    const config = makeMacroConfig({ timeoutMs: 30 });
    const result = await getFredSignals(config, (_url, init) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
        });
      });
    });
    expect(result.signals.every((s) => !s.available)).toBe(true);
  });

  it("normalizes real FRED-shaped observations end-to-end", async () => {
    const config = makeMacroConfig();
    const result = await getFredSignals(config, async () =>
      jsonResponse({
        observations: [
          { date: "2026-08-28", value: "14.43" },
          { date: "2026-08-27", value: "14.51" },
          { date: "2026-08-26", value: "." },
        ],
      }),
    );
    const vix = result.signals.find((s) => s.id === "vix");
    expect(vix?.available).toBe(true);
    expect(vix?.value).toBe(14.43);
    const us10y = result.signals.find((s) => s.id === "us10y");
    // Same stub payload for both series — still parses fine.
    expect(us10y?.available).toBe(true);
    expect(us10y?.value).toBe(14.43);
    const usdBroad = result.signals.find((s) => s.id === "usd_broad");
    expect(usdBroad?.available).toBe(true);
    expect(usdBroad?.value).toBe(14.43);
    const wti = result.signals.find((s) => s.id === "wti");
    expect(wti?.available).toBe(true);
    expect(wti?.frequency).toBe("daily");
  });
});
