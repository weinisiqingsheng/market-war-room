import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeMacroConfig } from "./fred.test";
import {
  completedDailyClose,
  normalizeTwelveGold,
  type TwelveTimeSeries,
} from "@/lib/macro-data/normalize";
import {
  getTwelveSignals,
  resetTwelveUpstreamCacheForTests,
} from "@/lib/macro-data/providers/twelve-data";
import { MACRO_SIGNALS, TWELVE_DATA_SYMBOLS } from "@/lib/macro-data/symbols";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/** YYYY-MM-DD key for `now + offsetDays` in the provider's exchange timezone. */
function nyDateKey(offsetDays: number): string {
  const ms = Date.now() + offsetDays * 86_400_000;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(ms));
}

/** Real-shape /time_series payload: today (forming) + two completed days. */
function goldTimeSeries(): unknown {
  return {
    meta: {
      symbol: "XAU/USD",
      interval: "1day",
      currency: "USD",
      exchange_timezone: "America/New_York",
    },
    values: [
      { datetime: nyDateKey(0), open: "2435.00", close: "2440.05" }, // forming today
      { datetime: nyDateKey(-1), open: "2400.00", close: "2416.35" }, // completed
      { datetime: nyDateKey(-2), open: "2395.00", close: "2401.11" }, // completed
    ],
    status: "ok",
  };
}

/** URL-aware fetch stub that serves /price and /time_series for XAU/USD. */
function stubTwelveUpstream(fetchSpy = vi.fn()): ReturnType<typeof vi.fn> {
  fetchSpy.mockImplementation(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/price")) {
      return url.includes("apikey=twelve-key")
        ? jsonResponse({ price: "2438.10" })
        : jsonResponse({ status: "error", code: 401, message: "Missing api key" });
    }
    if (url.includes("/time_series")) {
      return url.includes("apikey=twelve-key")
        ? jsonResponse(goldTimeSeries())
        : jsonResponse({ status: "error", code: 401, message: "Missing api key" });
    }
    return jsonResponse({ status: "error", code: 404, message: "unknown path" }, 404);
  });
  return fetchSpy;
}

beforeEach(() => {
  resetTwelveUpstreamCacheForTests();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("Twelve Data symbol ownership — Gold XAU/USD only, WTI never", () => {
  it("maps WTI to FRED and Gold to Twelve Data XAU/USD", () => {
    expect(MACRO_SIGNALS.wti.provider).toBe("fred");
    expect(MACRO_SIGNALS.wti.fredSeriesId).toBe("DCOILWTICO");
    expect(MACRO_SIGNALS.wti.frequency).toBe("daily");
    expect(MACRO_SIGNALS.wti.twelveSymbol).toBeUndefined();
    expect(MACRO_SIGNALS.gold.provider).toBe("twelve");
    expect(MACRO_SIGNALS.gold.twelveSymbol).toBe("XAU/USD");
  });

  it("never lists WTI or WTI/USD as a Twelve Data symbol", () => {
    expect(TWELVE_DATA_SYMBOLS).toEqual(["XAU/USD"]);
    expect(TWELVE_DATA_SYMBOLS.some((symbol) => /wti/i.test(symbol))).toBe(false);
  });
});

describe("completedDailyClose — completed bar selection + forming-bar exclusion", () => {
  const now = Date.parse("2026-09-01T15:00:00Z"); // 11:00 Tue America/New_York

  it("returns the last COMPLETED daily close, never today's forming bar", () => {
    const close = completedDailyClose(
      {
        meta: { symbol: "XAU/USD", interval: "1day", exchange_timezone: "America/New_York" },
        values: [
          { datetime: "2026-09-01", close: "2440.05" }, // forming today NY
          { datetime: "2026-08-31", close: "2416.35" },
          { datetime: "2026-08-28", close: "2401.11" },
        ],
      },
      now,
    );
    expect(close).toBe(2416.35);
  });

  it("treats a Friday bar as completed when viewed on the weekend (exchange timezone)", () => {
    const saturday = Date.parse("2026-08-29T14:00:00Z");
    const close = completedDailyClose(
      {
        meta: { exchange_timezone: "America/New_York" },
        values: [
          { datetime: "2026-08-28", close: "2416.35" },
          { datetime: "2026-08-27", close: "2401.11" },
        ],
      },
      saturday,
    );
    expect(close).toBe(2416.35);
  });

  it("skips non-numeric closes and rows without a parseable date", () => {
    const close = completedDailyClose(
      {
        meta: { exchange_timezone: "America/New_York" },
        values: [
          { datetime: "2026-08-31", close: "." },
          { datetime: "not-a-date", close: "2500.00" },
          { datetime: "2026-08-28", close: "2401.11" },
        ],
      },
      now,
    );
    expect(close).toBe(2401.11);
  });

  it("returns null when no completed bar exists (only a forming bar present)", () => {
    const close = completedDailyClose(
      {
        meta: { exchange_timezone: "America/New_York" },
        values: [{ datetime: "2026-09-01", close: "2440.05" }],
      },
      now,
    );
    expect(close).toBeNull();
  });

  it("is conservative without timezone metadata — never fabricates a comparison", () => {
    // Missing meta.exchange_timezone at 2026-09-01T20:00Z: the 08-31 and 09-01
    // rows are ambiguous, so no completed close is trusted (change stays null).
    const close = completedDailyClose(
      {
        values: [
          { datetime: "2026-09-01", close: "2440.05" },
          { datetime: "2026-08-31", close: "2416.35" },
        ],
      },
      Date.parse("2026-09-01T20:00:00Z"),
    );
    expect(close).toBeNull();
  });
});

describe("normalizeTwelveGold", () => {
  const now = Date.parse("2026-09-01T15:00:00Z"); // Tue 11:00 America/New_York
  const history: TwelveTimeSeries = {
    meta: { symbol: "XAU/USD", interval: "1day", exchange_timezone: "America/New_York" },
    values: [
      { datetime: "2026-09-01", close: "2440.05" }, // forming — excluded
      { datetime: "2026-08-31", close: "2416.35" },
      { datetime: "2026-08-28", close: "2401.11" },
    ],
  };

  it("parses /price numeric strings and compares to the last completed daily close", () => {
    const result = normalizeTwelveGold("gold", { price: "2438.10" }, history, now);
    expect(result.available).toBe(true);
    expect(result.value).toBe(2438.1);
    expect(result.change).toBeCloseTo(2438.1 - 2416.35, 5);
    expect(result.changePct).toBeCloseTo(((2438.1 - 2416.35) / 2416.35) * 100, 5);
    expect(result.frequency).toBe("intraday"); // price stays intraday freshness
    expect(result.asOf).toBe("2026-09-01T15:00:00.000Z");
  });

  it("keeps Gold available with null change when history is missing or empty", () => {
    const noHistory = normalizeTwelveGold("gold", { price: "2438.10" }, null, now);
    expect(noHistory.available).toBe(true);
    expect(noHistory.value).toBe(2438.1);
    expect(noHistory.change).toBeNull();
    expect(noHistory.changePct).toBeNull();

    const emptyHistory = normalizeTwelveGold("gold", { price: "2438.10" }, { values: [] }, now);
    expect(emptyHistory.available).toBe(true);
    expect(emptyHistory.change).toBeNull();
  });

  it("marks Gold unavailable when /price carries no usable number", () => {
    expect(normalizeTwelveGold("gold", undefined, history, now).available).toBe(false);
    expect(normalizeTwelveGold("gold", { price: "." }, history, now).available).toBe(false);
    expect(normalizeTwelveGold("gold", { price: undefined }, history, now).available).toBe(false);
  });
});

describe("getTwelveSignals — Gold endpoints and failure isolation", () => {
  it("returns an unavailable Gold signal when the API key is missing (no fetch)", async () => {
    const fetchSpy = vi.fn();
    const result = await getTwelveSignals(makeMacroConfig({ twelveDataApiKey: null }), fetchSpy);
    expect(result.signals).toHaveLength(1);
    expect(result.signals[0]?.available).toBe(false);
    expect(result.signals[0]?.id).toBe("gold");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("fetches /price and /time_series once each with server-side apikey auth", async () => {
    const fetchSpy = stubTwelveUpstream();
    const result = await getTwelveSignals(makeMacroConfig(), fetchSpy);
    expect(fetchSpy).toHaveBeenCalledTimes(2);

    const urls = fetchSpy.mock.calls.map(([input]) => String(input));
    const priceUrl = urls.find((url) => url.includes("/price"));
    const seriesUrl = urls.find((url) => url.includes("/time_series"));
    expect(priceUrl).toContain("symbol=XAU%2FUSD");
    expect(seriesUrl).toContain("symbol=XAU%2FUSD");
    expect(seriesUrl).toContain("interval=1day");
    expect(seriesUrl).toContain("outputsize=3");
    // WTI is never requested from Twelve Data in any form.
    for (const url of urls) expect(url).not.toContain("WTI");
    // The key travels server-side as a query param only.
    for (const url of urls) expect(url).toContain("apikey=twelve-key");

    const gold = result.signals[0];
    expect(gold?.available).toBe(true);
    expect(gold?.value).toBe(2438.1);
    // Change compares today's /price to yesterday's COMPLETED close (2416.35),
    // not today's forming bar.
    expect(gold?.change).toBeCloseTo(2438.1 - 2416.35, 5);
  });

  it("dedupes concurrent calls into one upstream request pair", async () => {
    const fetchSpy = stubTwelveUpstream();
    const [a, b] = await Promise.all([
      getTwelveSignals(makeMacroConfig(), fetchSpy),
      getTwelveSignals(makeMacroConfig(), fetchSpy),
    ]);
    expect(fetchSpy).toHaveBeenCalledTimes(2); // one /price + one /time_series
    expect(a.signals[0]?.available).toBe(true);
    expect(b.signals[0]?.available).toBe(true);
  });

  it("caches /price ~60s and /time_series ~15 min independently", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-01T12:00:00Z"));
    const fetchSpy = stubTwelveUpstream();

    await getTwelveSignals(makeMacroConfig(), fetchSpy);
    let priceCalls = fetchSpy.mock.calls.filter(([i]) => String(i).includes("/price")).length;
    let seriesCalls = fetchSpy.mock.calls.filter(([i]) =>
      String(i).includes("/time_series"),
    ).length;
    expect(priceCalls).toBe(1);
    expect(seriesCalls).toBe(1);

    await vi.advanceTimersByTimeAsync(61_000); // price TTL (60s) expired
    await getTwelveSignals(makeMacroConfig(), fetchSpy);
    priceCalls = fetchSpy.mock.calls.filter(([i]) => String(i).includes("/price")).length;
    seriesCalls = fetchSpy.mock.calls.filter(([i]) => String(i).includes("/time_series")).length;
    expect(priceCalls).toBe(2); // price refetched every ~60s
    expect(seriesCalls).toBe(1); // daily history still cached

    await vi.advanceTimersByTimeAsync(15 * 60_000); // history TTL (15 min) expired
    await getTwelveSignals(makeMacroConfig(), fetchSpy);
    seriesCalls = fetchSpy.mock.calls.filter(([i]) => String(i).includes("/time_series")).length;
    expect(seriesCalls).toBe(2);
  });
});

describe("getTwelveSignals — HTTP failure behavior", () => {
  it.each([401, 403, 429, 500])("maps a %i /price response to Gold unavailable", async (status) => {
    const fetchSpy = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes("/price")) {
        return jsonResponse({ status: "error", code: status }, status);
      }
      return jsonResponse(goldTimeSeries());
    });
    const result = await getTwelveSignals(makeMacroConfig(), fetchSpy);
    expect(result.signals[0]?.available).toBe(false);
    expect(result.signals[0]?.value).toBeNull();
  });

  it("keeps Gold available with null change when /time_series fails", async () => {
    const fetchSpy = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes("/price")) return jsonResponse({ price: "2438.10" });
      return jsonResponse({ status: "error", code: 500 }, 500);
    });
    const result = await getTwelveSignals(makeMacroConfig(), fetchSpy);
    expect(result.signals[0]?.available).toBe(true);
    expect(result.signals[0]?.value).toBe(2438.1);
    expect(result.signals[0]?.change).toBeNull();
    expect(result.signals[0]?.changePct).toBeNull();
  });

  it("maps a 429 /time_series response to a null change (never throws)", async () => {
    const fetchSpy = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes("/price")) return jsonResponse({ price: "2438.10" });
      return jsonResponse({ status: "error", code: 429 }, 429);
    });
    const result = await getTwelveSignals(makeMacroConfig(), fetchSpy);
    expect(result.signals[0]?.available).toBe(true);
    expect(result.signals[0]?.change).toBeNull();
  });

  it("treats a provider 'symbol not found' error payload as unavailable", async () => {
    const fetchSpy = vi.fn(async () =>
      jsonResponse({ status: "error", code: 404, message: "symbol not found", symbol: "XAU/USD" }),
    );
    const result = await getTwelveSignals(makeMacroConfig(), fetchSpy);
    expect(result.signals[0]?.available).toBe(false);
  });

  it("maps a /price timeout to Gold unavailable without throwing", async () => {
    const result = await getTwelveSignals(makeMacroConfig({ timeoutMs: 30 }), (_url, init) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
        });
      });
    });
    expect(result.signals[0]?.available).toBe(false);
  });

  it("maps a malformed JSON response to Gold unavailable", async () => {
    const result = await getTwelveSignals(
      makeMacroConfig(),
      async () => new Response("<html>not json</html>", { status: 200 }),
    );
    expect(result.signals[0]?.available).toBe(false);
  });
});
