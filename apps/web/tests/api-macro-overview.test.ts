import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/macro/overview/route";
import { resetMacroProviderCacheForTests } from "@/lib/macro-data/cache";
import { resetTwelveUpstreamCacheForTests } from "@/lib/macro-data/providers/twelve-data";

const ENV_KEYS = [
  "MACRO_DATA_MODE",
  "FRED_API_KEY",
  "TWELVE_DATA_API_KEY",
  "TWELVE_DATA_BASE_URL",
  "ALPACA_API_KEY_ID",
  "ALPACA_API_SECRET_KEY",
];

function setEnv(overrides: Record<string, string>): void {
  for (const key of ENV_KEYS) delete process.env[key];
  Object.assign(process.env, overrides);
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/** YYYY-MM-DD key for `now + offsetDays` in America/New_York (Gold exchange tz). */
function nyDateKey(offsetDays: number): string {
  const ms = Date.now() + offsetDays * 86_400_000;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(ms));
}

/** Real-shape /time_series payload — today (forming) + two completed days. */
function goldTimeSeries(): unknown {
  return {
    meta: {
      symbol: "XAU/USD",
      interval: "1day",
      currency: "USD",
      exchange_timezone: "America/New_York",
    },
    values: [
      { datetime: nyDateKey(0), close: "2440.05" }, // forming — must be excluded
      { datetime: nyDateKey(-1), close: "2416.35" },
      { datetime: nyDateKey(-2), close: "2401.11" },
    ],
    status: "ok",
  };
}

function stubUpstreamFetch(): ReturnType<typeof vi.fn> {
  const fetchSpy = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/fred/series/observations")) {
      return jsonResponse({
        observations: [
          { date: "2026-08-28", value: "14.43" },
          { date: "2026-08-27", value: "14.51" },
        ],
      });
    }
    if (url.includes("/price")) {
      return jsonResponse({ price: "2438.10" });
    }
    if (url.includes("/time_series")) {
      return jsonResponse(goldTimeSeries());
    }
    if (url.includes("/v1beta3/crypto/us/latest/trades")) {
      return jsonResponse({
        trades: { "BTC/USD": { p: 62000, t: new Date().toISOString(), s: 3 } },
      });
    }
    if (url.includes("/v1beta3/crypto/us/bars")) {
      const yesterday = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
      return jsonResponse({
        bars: { "BTC/USD": [{ t: yesterday, c: 60000, o: 59500, h: 60500, l: 59400, v: 100 }] },
      });
    }
    return jsonResponse({ status: "error", message: "unknown path" }, 404);
  });
  vi.stubGlobal("fetch", fetchSpy);
  return fetchSpy;
}

beforeEach(() => {
  resetMacroProviderCacheForTests();
  resetTwelveUpstreamCacheForTests();
  vi.restoreAllMocks();
});

afterEach(() => {
  setEnv({});
  vi.unstubAllGlobals();
});

describe("GET /api/macro/overview", () => {
  it("returns demo macro overview in demo mode without credentials", async () => {
    setEnv({ MACRO_DATA_MODE: "demo" });
    const response = await GET();
    const raw = await response.text();
    const body = JSON.parse(raw);
    expect(response.status).toBe(200);
    expect(body.meta.mode).toBe("demo");
    expect(body.signals).toHaveLength(6);
    expect(raw).not.toContain("FRED_API_KEY");
  });

  it("returns 503 CONFIG in live mode without any provider credentials", async () => {
    setEnv({ MACRO_DATA_MODE: "live" });
    const response = await GET();
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.error.code).toBe("CONFIG");
  });

  it("returns a live multi-provider overview and never leaks credentials or raw shapes", async () => {
    setEnv({
      MACRO_DATA_MODE: "live",
      FRED_API_KEY: "fred_dummy_key",
      TWELVE_DATA_API_KEY: "twelve_dummy_key",
      ALPACA_API_KEY_ID: "alpaca_dummy_key",
      ALPACA_API_SECRET_KEY: "alpaca_dummy_secret",
    });
    const fetchSpy = stubUpstreamFetch();

    const response = await GET();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.signals).toHaveLength(6);

    // Twelve Data requests must carry the server-side apikey auth as a query
    // param and request ONLY XAU/USD (never WTI in any form).
    const twelveUrls = fetchSpy.mock.calls
      .map(([input]) => String(input))
      .filter((url) => url.includes("/price") || url.includes("/time_series"));
    expect(twelveUrls.length).toBeGreaterThan(0);
    for (const url of twelveUrls) {
      expect(url).toContain("apikey=twelve_dummy_key");
      expect(url).toContain("symbol=XAU%2FUSD");
      expect(url).not.toContain("WTI");
    }

    const text = JSON.stringify(body);
    expect(text).not.toContain("fred_dummy_key");
    expect(text).not.toContain("twelve_dummy_key");
    expect(text).not.toContain("alpaca_dummy_key");
    expect(text).not.toContain("alpaca_dummy_secret");
    expect(text).not.toContain("APCA-API");
    // Raw provider shapes must not leak into the normalized response.
    expect(text).not.toContain("observations");
    expect(text).not.toContain("previous_close");
    expect(text).not.toContain("latestTrade");
    expect(text).not.toContain("exchange_timezone");
    expect(text).not.toContain('"values"'); // /time_series raw rows never leak
    expect(text).not.toContain('"close"'); // raw bar close fields never leak

    const availableIds = body.signals
      .filter((s: { available: boolean }) => s.available)
      .map((s: { id: string }) => s.id);
    expect(availableIds).toEqual(["vix", "us10y", "wti", "usd_broad", "gold", "btc"]);
    expect(body.meta.providers).toEqual(["fred", "twelve", "alpaca-crypto"]);
  });

  it("keeps available signals when one provider fails (partial failure at the route)", async () => {
    setEnv({
      MACRO_DATA_MODE: "live",
      FRED_API_KEY: "fred_dummy_key",
      TWELVE_DATA_API_KEY: "twelve_dummy_key",
      ALPACA_API_KEY_ID: "alpaca_dummy_key",
      ALPACA_API_SECRET_KEY: "alpaca_dummy_secret",
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/fred/series/observations")) {
          return jsonResponse({
            observations: [
              { date: "2026-08-28", value: "14.43" },
              { date: "2026-08-27", value: "14.51" },
            ],
          });
        }
        if (url.includes("/price") || url.includes("/time_series")) {
          return jsonResponse({ status: "error", code: 429 }, 429);
        }
        if (url.includes("/v1beta3/crypto")) {
          return jsonResponse({ trades: { "BTC/USD": { p: 62000, t: new Date().toISOString() } } });
        }
        return jsonResponse({}, 404);
      }),
    );

    const response = await GET();
    expect(response.status).toBe(200);
    const body = await response.json();
    const byId = Object.fromEntries(body.signals.map((s: { id: string }) => [s.id, s]));
    expect(byId.vix.available).toBe(true);
    expect(byId.us10y.available).toBe(true);
    expect(byId.usd_broad.available).toBe(true); // FRED (broad USD) unaffected
    expect(byId.wti.available).toBe(true); // FRED DCOILWTICO unaffected by Twelve outage
    expect(byId.gold.available).toBe(false); // only Gold is hit
    expect(byId.gold.value).toBeNull(); // no demo Gold substitution
    expect(byId.btc.available).toBe(true);
  });
});
