import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { HomeDashboard } from "@/features/home/HomeDashboard";
import type { MacroOverview, MarketOverview, RegimeResult } from "@war-room/types";
import type { BreadthOverview } from "@/lib/breadth/types";
import type { AnomalyOverview } from "@/lib/anomalies/types";

const overviewFixture: MarketOverview = {
  meta: {
    mode: "live",
    provider: "alpaca",
    feed: "iex",
    asOf: "2026-08-31T14:30:00Z",
    marketOpen: true,
    nextOpen: "2026-09-01T13:30:00Z",
    nextClose: "2026-08-31T20:00:00Z",
    stale: false,
  },
  indices: [
    {
      ticker: "SPY",
      name: "S&P 500 ETF",
      price: 999.99,
      changePct: 1.25,
      open: 990,
      high: 1001,
      low: 988,
      surface: "sakura",
    },
    {
      ticker: "QQQ",
      name: "Nasdaq 100 ETF",
      price: 888.88,
      changePct: -0.5,
      open: 890,
      high: 895,
      low: 885,
      surface: "lavender",
    },
    {
      ticker: "IWM",
      name: "Russell 2000 ETF",
      price: 777.77,
      changePct: 0.1,
      open: 775,
      high: 780,
      low: 772,
      surface: "cream",
    },
    {
      ticker: "DIA",
      name: "Dow 30 ETF",
      price: 666.66,
      changePct: 0,
      open: 665,
      high: 670,
      low: 663,
      surface: "mint",
    },
  ],
  sectors: [
    {
      id: "XLE",
      sector: "Energy",
      etf: "XLE",
      dailyReturnPct: 2.1,
      relativeReturnPct: 2.34,
      signal: "Leader",
      tone: "positive",
      strength: 73,
    },
  ],
};

const macroOverviewFixture: MacroOverview = {
  meta: { mode: "live", asOf: "2026-08-31T14:30:00Z", stale: false, providers: ["fred"] },
  signals: [
    {
      id: "vix",
      label: "VIX",
      value: 15.21,
      displayUnit: "index",
      change: -0.5,
      changePct: -3.2,
      interpretation: "Volatility Calm",
      tone: "positive",
      source: "FRED",
      frequency: "daily",
      asOf: "2026-08-29T00:00:00Z",
      stale: false,
      available: true,
    },
    {
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
      asOf: "2026-08-29T00:00:00Z",
      stale: false,
      available: true,
    },
    {
      id: "wti",
      label: "WTI",
      value: 78.54,
      displayUnit: "price",
      change: 1.92,
      changePct: 2.5,
      interpretation: "Inflation Risk",
      tone: "negative",
      source: "FRED",
      frequency: "daily",
      asOf: "2026-08-28T00:00:00Z",
      stale: false,
      available: true,
    },
    {
      id: "usd_broad",
      label: "US Dollar",
      instrument: "Broad USD Index",
      value: 118.75,
      displayUnit: "index",
      change: -0.28,
      changePct: -0.24,
      interpretation: "Dollar Softening",
      tone: "neutral",
      source: "FRED",
      frequency: "daily",
      asOf: "2026-08-28T00:00:00Z",
      stale: false,
      available: true,
    },
    {
      id: "gold",
      label: "Gold",
      value: 2438.1,
      displayUnit: "price",
      change: 21.75,
      changePct: 0.9,
      interpretation: "Safe-Haven Bid",
      tone: "positive",
      source: "Twelve Data",
      frequency: "intraday",
      asOf: "2026-08-31T14:29:00Z",
      stale: false,
      available: true,
    },
    {
      id: "btc",
      label: "BTC",
      value: 62150,
      displayUnit: "price",
      change: 857,
      changePct: 1.4,
      interpretation: "Risk Appetite",
      tone: "positive",
      source: "Alpaca",
      frequency: "realtime",
      asOf: "2026-08-31T14:30:00Z",
      stale: false,
      available: true,
    },
  ],
};

/** URL-aware fetch stub: market / macro / regime / breadth routes get bodies. */
function stubFetchWith(options: {
  market: { ok: boolean; body: unknown; status?: number };
  macro: { ok: boolean; body: unknown; status?: number };
  regime?: { ok: boolean; body: unknown; status?: number };
  breadth?: { ok: boolean; body: unknown; status?: number };
  anomalies?: { ok: boolean; body: unknown; status?: number };
}) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      let target = options.market;
      if (url.includes("/api/regime/overview"))
        target = options.regime ?? {
          ok: false,
          body: { error: { code: "UPSTREAM" } },
          status: 502,
        };
      else if (url.includes("/api/breadth/overview"))
        target = options.breadth ?? {
          ok: false,
          body: { error: { code: "UPSTREAM" } },
          status: 502,
        };
      else if (url.includes("/api/anomalies/overview"))
        target = options.anomalies ?? {
          ok: false,
          body: { error: { code: "UPSTREAM" } },
          status: 502,
        };
      else if (url.includes("/api/macro/overview")) target = options.macro;
      return target.ok
        ? new Response(JSON.stringify(target.body), {
            status: 200,
            headers: { "content-type": "application/json" },
          })
        : new Response(JSON.stringify(target.body), { status: target.status ?? 502 });
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("HomeDashboard market data modes", () => {
  it("does not fetch in demo mode and shows demo figures", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    render(<HomeDashboard mode="demo" macroMode="demo" />);

    await waitFor(() => {
      expect(screen.getByText("563.24")).toBeInTheDocument();
    });
    // Market demo mode must not fetch market/macro/regime/etc endpoints; the
    // grounded AI Brief is a separate client feature that may fetch its own API.
    const urls = fetchSpy.mock.calls.map((call) => String(call[0]));
    expect(urls.filter((url) => !url.startsWith("/api/ai/"))).toHaveLength(0);
    expect(screen.getAllByText(/DEMO/).length).toBeGreaterThan(0);
  });

  it("renders live values and LIVE · IEX labels in live mode", async () => {
    stubFetchWith({
      market: { ok: true, body: overviewFixture },
      macro: { ok: true, body: macroOverviewFixture },
    });

    render(<HomeDashboard mode="live" macroMode="live" />);

    expect(await screen.findByText("999.99")).toBeInTheDocument();
    expect(screen.getAllByText(/LIVE · IEX/i).length).toBeGreaterThan(0);
    const fredProvenance = await screen.findAllByText("FRED · Daily");
    expect(fredProvenance.length).toBeGreaterThan(0); // macro per-cell provenance
    expect(screen.getByText("15.21")).toBeInTheDocument(); // live VIX value
  });

  it("shows unavailable instead of demo figures when live data fails", async () => {
    stubFetchWith({
      market: { ok: false, body: { error: { code: "UPSTREAM" } }, status: 502 },
      macro: { ok: false, body: { error: { code: "UPSTREAM" } }, status: 502 },
    });

    render(<HomeDashboard mode="live" macroMode="live" />);

    const panels = await screen.findAllByText(/Market data unavailable/i);
    expect(panels.length).toBeGreaterThan(0);
    expect(screen.queryByText("563.24")).not.toBeInTheDocument();
  });
});

const regimeResultFixture: RegimeResult = {
  score: 55.2,
  displayScore: 55,
  label: "RISK-ON",
  coverage: 0.92,
  confidence: "high",
  components: [
    { id: "equity", name: "Equity Tape", score: 60, weight: 0.3 },
    { id: "sectors", name: "Sector Participation", score: 58, weight: 0.2 },
    { id: "volatility", name: "Volatility", score: 66, weight: 0.15 },
    { id: "rates", name: "Rates", score: 52, weight: 0.15 },
    { id: "macro", name: "Macro Pressure", score: 44, weight: 0.15 },
    { id: "crypto", name: "Crypto Risk Appetite", score: 70, weight: 0.05 },
  ],
  positiveDrivers: [
    { id: "vix", name: "VIX", direction: "positive", impact: 2.5, reason: "VIX fell 5.2% to 14.4" },
  ],
  negativeDrivers: [],
  staleInputs: [],
  missingInputs: [],
  asOf: "2026-09-01T13:00:00Z",
  engineVersion: "regime-v1",
};

describe("HomeDashboard regime engine", () => {
  it("keeps Market Pulse + Macro Pulse live when the regime engine fails", async () => {
    stubFetchWith({
      market: { ok: true, body: overviewFixture },
      macro: { ok: true, body: macroOverviewFixture },
      regime: { ok: false, body: { error: { code: "UPSTREAM" } }, status: 502 },
    });

    render(<HomeDashboard mode="live" macroMode="live" regimeMode="live" />);

    expect(await screen.findByText("999.99")).toBeInTheDocument(); // market live
    expect(await screen.findByText("15.21")).toBeInTheDocument(); // macro live
    expect(screen.getByText(/Regime unavailable/i)).toBeInTheDocument();
    // No demo regime numbers are substituted.
    expect(screen.queryByText("42")).not.toBeInTheDocument();
  });

  it("renders the live regime score and drivers from the engine", async () => {
    stubFetchWith({
      market: { ok: true, body: overviewFixture },
      macro: { ok: true, body: macroOverviewFixture },
      regime: {
        ok: true,
        body: { mode: "live", meta: { mode: "live", asOf: null }, result: regimeResultFixture },
      },
    });

    render(<HomeDashboard mode="live" macroMode="live" regimeMode="live" />);

    await waitFor(() => {
      expect(screen.getAllByText(/RISK-ON/).length).toBeGreaterThan(0);
    });
    expect(screen.getByText(/VIX fell 5.2% to 14.4/)).toBeInTheDocument();
    expect(screen.getAllByText(/92% coverage · High confidence/i).length).toBeGreaterThan(0);
  });
});

const breadthOverviewFixture: BreadthOverview = {
  mode: "live",
  score: 62.4,
  displayScore: 62,
  engineVersion: "breadth-v1",
  state: { key: "BROAD_RALLY", label: "Broad Rally" },
  metrics: {
    universeCount: 503,
    currentCoverageCount: 500,
    historical20CoverageCount: 500,
    historical50CoverageCount: 500,
    coveragePct: 0.97,
    advancers: 302,
    decliners: 190,
    unchanged: 8,
    advanceRatio: 0.614,
    above20Pct: 0.58,
    above50Pct: 0.55,
    newHighs20: 41,
    newLows20: 17,
  },
  universe: { name: "S&P 500", version: "sp500-v1", asOf: "2026-09-05", count: 503 },
  meta: {
    provider: "alpaca",
    feed: "delayed_sip",
    delayMinutes: 15,
    asOf: "2026-09-05T13:00:00Z",
    marketOpen: true,
  },
  confidence: "high",
};

describe("HomeDashboard market breadth", () => {
  it("keeps Market Pulse + Macro Pulse live when breadth fails", async () => {
    stubFetchWith({
      market: { ok: true, body: overviewFixture },
      macro: { ok: true, body: macroOverviewFixture },
      breadth: { ok: false, body: { error: { code: "UPSTREAM" } }, status: 502 },
    });

    render(<HomeDashboard mode="live" macroMode="live" breadthMode="live" />);

    expect(await screen.findByText("999.99")).toBeInTheDocument(); // Market Pulse survives
    expect(await screen.findByText("15.21")).toBeInTheDocument(); // Macro Pulse survives
    expect(screen.getByText(/Breadth unavailable/i)).toBeInTheDocument();
    // No demo breadth values masquerade as live.
    expect(screen.queryByText(/decliners outnumber advancers/i)).not.toBeInTheDocument();
  });

  it("renders the live delayed-SIP breadth engine", async () => {
    stubFetchWith({
      market: { ok: true, body: overviewFixture },
      macro: { ok: true, body: macroOverviewFixture },
      breadth: { ok: true, body: breadthOverviewFixture },
    });

    render(<HomeDashboard mode="live" macroMode="live" breadthMode="live" />);

    await waitFor(() => {
      expect(screen.getAllByText(/15M Delayed SIP/i).length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText("62").length).toBeGreaterThan(0); // Breadth Score
    expect(screen.getAllByText("302").length).toBeGreaterThan(0); // Advancing
    expect(screen.getByText(/61% Advancing/)).toBeInTheDocument();
    expect(screen.getAllByText(/97% coverage · High confidence/i).length).toBeGreaterThan(0);
  });
});

const anomaliesOverviewFixture: AnomalyOverview = {
  mode: "live",
  engineVersion: "anomaly-v1",
  universe: { name: "S&P 500", version: "sp500-v1", asOf: "2026-09-05", count: 503 },
  meta: {
    provider: "alpaca",
    feed: "delayed_sip",
    delayMinutes: 15,
    asOf: "2026-09-05T13:00:00Z",
    marketOpen: false,
    stale: false,
  },
  universeCount: 503,
  eligibleCount: 500,
  scoredCount: 500,
  coveragePct: 500 / 503,
  confidence: "high",
  topOverall: [
    {
      ticker: "NVDA",
      name: "NVIDIA",
      sector: "Information Technology",
      sectorEtf: "XLK",
      price: 512,
      dailyMovePct: 4.2,
      direction: "up",
      anomalyScore: 86.3,
      displayScore: 86,
      severity: "EXTREME",
      primaryTrigger: "RETURN SHOCK",
      metrics: {
        returnSigma: 2.8,
        sectorRelativePct: 3.1,
        sectorRelativeSigma: 2.1,
        gapPct: 1.7,
        gapAtrRatio: 0.9,
        rangeExpansionRatio: 1.8,
        volumeParticipation: 1.6,
        breakout20: true,
        breakdown20: false,
      },
      componentScores: {
        returnShock: 81,
        sectorDivergence: 76,
        gapShock: 55,
        rangeExpansion: 82,
        volumeParticipation: 74,
        breakout: 100,
      },
      reasons: [
        "+4.2% move equals 2.8× its 20D daily volatility",
        "Statistical anomaly detected — catalyst not evaluated",
      ],
      dataCoverage: 1,
    },
  ],
  topPositive: [],
  topNegative: [],
  asOf: "2026-09-05T13:00:00Z",
};

describe("HomeDashboard anomalies scanner", () => {
  it("keeps Market Pulse + Macro Pulse live when the scanner fails", async () => {
    stubFetchWith({
      market: { ok: true, body: overviewFixture },
      macro: { ok: true, body: macroOverviewFixture },
      anomalies: { ok: false, body: { error: { code: "UPSTREAM" } }, status: 502 },
    });

    render(<HomeDashboard mode="live" macroMode="live" anomaliesMode="live" />);

    expect(await screen.findByText("999.99")).toBeInTheDocument();
    expect(await screen.findByText("15.21")).toBeInTheDocument();
    expect(screen.getByText(/Anomalies unavailable/i)).toBeInTheDocument();
  });

  it("renders the live delayed-SIP scanner with its provenance and a reason", async () => {
    stubFetchWith({
      market: { ok: true, body: overviewFixture },
      macro: { ok: true, body: macroOverviewFixture },
      anomalies: { ok: true, body: anomaliesOverviewFixture },
    });

    render(<HomeDashboard mode="live" macroMode="live" anomaliesMode="live" />);

    await waitFor(() => {
      expect(screen.getAllByText(/15M Delayed SIP/i).length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText(/anomaly-v1/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/NVDA/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/its 20D daily volatility/).length).toBeGreaterThan(0);
  });
});
