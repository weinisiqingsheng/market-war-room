import { describe, expect, it } from "vitest";
import { makeMacroConfig } from "./fred.test";
import { computeMacroStale } from "@/lib/macro-data/interpret";
import { normalizeBtc, parseIsoMs } from "@/lib/macro-data/normalize";
import { getAlpacaCryptoSignals } from "@/lib/macro-data/providers/alpaca-crypto";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function yesterdayIso(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  d.setUTCHours(12, 0, 0, 0);
  return d.toISOString();
}

function todayIso(): string {
  const d = new Date();
  d.setUTCHours(12, 0, 0, 0);
  return d.toISOString();
}

/** UTC midnight of a day offset from today, with nanosecond precision (Alpaca shape). */
function utcDayIsoWithNanos(offsetDays: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString().replace(/\.(\d{3})Z$/, ".$1000000Z");
}

function nowIsoWithNanos(): string {
  return new Date().toISOString().replace(/\.(\d{3})Z$/, ".$1000000Z");
}

describe("parseIsoMs", () => {
  it("parses the exact nanosecond-precision timestamp from the real validation", () => {
    const parsed = parseIsoMs("2026-09-01T05:50:55.850037494Z");
    expect(parsed).not.toBeNull();
    expect(parsed).toBe(Date.parse("2026-09-01T05:50:55.850Z"));
  });
});

describe("normalizeBtc", () => {
  it("uses the latest trade price and the last COMPLETED daily bar close as previous", () => {
    const result = normalizeBtc("btc", { p: 62000, t: todayIso(), s: 1 }, [
      { t: yesterdayIso(), c: 60000, o: 59500, h: 60500, l: 59400, v: 100 },
      { t: todayIso(), c: 61500, o: 60000, h: 62000, l: 59900, v: 50 }, // today, still forming
    ]);
    expect(result.available).toBe(true);
    expect(result.value).toBe(62000);
    expect(result.change).toBe(2000);
    expect(result.changePct).toBeCloseTo((2000 / 60000) * 100, 5);
  });

  it("returns unavailable when there is no latest trade", () => {
    expect(normalizeBtc("btc", undefined, []).available).toBe(false);
    expect(normalizeBtc("btc", { p: undefined }, []).available).toBe(false);
  });

  it("keeps value but nulls change when no completed daily bar exists", () => {
    const result = normalizeBtc("btc", { p: 62000, t: todayIso() }, []);
    expect(result.value).toBe(62000);
    expect(result.change).toBeNull();
  });

  it("resolves previous close from a completed daily bar with nanosecond timestamps (real Alpaca shape)", () => {
    const result = normalizeBtc("btc", { p: 79105.645, t: nowIsoWithNanos(), s: 3 }, [
      { t: utcDayIsoWithNanos(-2), c: 77000, o: 76500, h: 77500, l: 76400, v: 8000 },
      { t: utcDayIsoWithNanos(-1), c: 78000, o: 77000, h: 78500, l: 76900, v: 9000 },
      { t: utcDayIsoWithNanos(0), c: 79000, o: 78000, h: 79200, l: 77900, v: 500 }, // forming
    ]);
    expect(result.available).toBe(true);
    expect(result.value).toBe(79105.645);
    expect(result.change).toBeCloseTo(79105.645 - 78000, 3);
    expect(result.changePct).toBeCloseTo(((79105.645 - 78000) / 78000) * 100, 5);
  });

  it("never uses the currently forming daily bar as previous close", () => {
    const result = normalizeBtc("btc", { p: 79105.645, t: nowIsoWithNanos() }, [
      { t: utcDayIsoWithNanos(0), c: 79000, o: 78000, h: 79200, l: 77900, v: 500 },
    ]);
    expect(result.value).toBe(79105.645);
    expect(result.change).toBeNull(); // no completed bar → no fabricated change
  });
});

describe("getAlpacaCryptoSignals", () => {
  it("normalizes BTC from Alpaca crypto endpoints (reusing the Alpaca HTTP layer)", async () => {
    const result = await getAlpacaCryptoSignals(makeMacroConfig(), async (input) => {
      const url = String(input);
      if (url.includes("/latest/trades")) {
        return jsonResponse({ trades: { "BTC/USD": { p: 62000, t: todayIso(), s: 3 } } });
      }
      return jsonResponse({
        bars: {
          "BTC/USD": [{ t: yesterdayIso(), c: 60000, o: 59500, h: 60500, l: 59400, v: 100 }],
        },
      });
    });
    const btc = result.signals[0];
    expect(btc?.available).toBe(true);
    expect(btc?.value).toBe(62000);
    expect(btc?.change).toBe(2000);
    expect(btc?.frequency).toBe("realtime");
  });

  it("requests historical bars with an explicit UTC window (real Alpaca contract)", async () => {
    let barsUrl = "";
    const result = await getAlpacaCryptoSignals(makeMacroConfig(), async (input) => {
      const url = String(input);
      if (url.includes("/latest/trades")) {
        return jsonResponse({ trades: { "BTC/USD": { p: 62000, t: nowIsoWithNanos() } } });
      }
      barsUrl = url;
      return jsonResponse({ bars: { "BTC/USD": [] } });
    });
    expect(barsUrl).toContain("timeframe=1Day");
    expect(barsUrl).toContain("start=");
    expect(barsUrl).toContain("end=");
    expect(barsUrl).toContain("sort=desc");
    expect(result.signals[0]?.available).toBe(true);
  });

  it("populates change from the last completed bar in a realistic nanosecond response", async () => {
    const result = await getAlpacaCryptoSignals(makeMacroConfig(), async (input) => {
      const url = String(input);
      if (url.includes("/latest/trades")) {
        return jsonResponse({
          trades: { "BTC/USD": { p: 79105.645, t: nowIsoWithNanos(), s: 3 } },
        });
      }
      return jsonResponse({
        bars: {
          "BTC/USD": [
            { t: utcDayIsoWithNanos(-1), c: 78000, o: 77000, h: 78500, l: 76900, v: 9000 },
            { t: utcDayIsoWithNanos(0), c: 79000, o: 78000, h: 79200, l: 77900, v: 500 },
          ],
        },
      });
    });
    const btc = result.signals[0];
    expect(btc?.available).toBe(true);
    expect(btc?.value).toBe(79105.645);
    expect(btc?.change).toBeCloseTo(79105.645 - 78000, 3);
    expect(btc?.changePct).not.toBeNull();
  });

  it("returns unavailable without calling Alpaca when credentials are missing", async () => {
    const result = await getAlpacaCryptoSignals(
      makeMacroConfig({
        alpaca: {
          apiKeyId: null,
          apiSecretKey: null,
          dataBaseUrl: "https://data.test",
          timeoutMs: 200,
        },
      }),
      async () => {
        throw new Error("should not be called");
      },
    );
    expect(result.signals[0]?.available).toBe(false);
  });

  it("returns unavailable when Alpaca responds with an upstream error", async () => {
    const result = await getAlpacaCryptoSignals(makeMacroConfig(), async () =>
      jsonResponse({ message: "nope" }, 500),
    );
    expect(result.signals[0]?.available).toBe(false);
  });
});

describe("BTC 24/7 freshness (never tied to the US equity open)", () => {
  const config = makeMacroConfig({
    staleAfterMs: { realtime: 300_000, intraday: 900_000, daily: 3 * 24 * 60 * 60_000 },
  });
  const now = Date.now();

  it("is fresh when the latest trade is recent", () => {
    const fresh = new Date(now - 60_000).toISOString();
    expect(computeMacroStale("realtime", fresh, config, now)).toBe(false);
  });

  it("is NOT stale for a current trade timestamp with nanosecond precision (real Alpaca shape)", () => {
    const freshNano = nowIsoWithNanos(); // e.g. "2026-09-01T05:50:55.850037494Z"
    expect(computeMacroStale("realtime", freshNano, config, Date.now())).toBe(false);
  });

  it("is stale when the latest trade is old (24/7 clock, no market-open check)", () => {
    const old = new Date(now - 30 * 60_000).toISOString();
    expect(computeMacroStale("realtime", old, config, now)).toBe(true);
  });

  it("treats missing timestamps as stale", () => {
    expect(computeMacroStale("realtime", null, config, now)).toBe(true);
  });
});
