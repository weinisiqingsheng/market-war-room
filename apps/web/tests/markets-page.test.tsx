import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { MarketsWorkspace } from "@/features/markets/MarketsWorkspace";
import type { MarketOverviewState } from "@/features/home/useMarketOverview";
import type { MacroOverviewState } from "@/features/home/useMacroOverview";
import type { BreadthOverview } from "@/lib/breadth/types";
import type { AnomalyOverview } from "@/lib/anomalies/types";

const read = (rel: string) => readFileSync(resolve(rel), "utf8");
const workspaceSource = read("features/markets/MarketsWorkspace.tsx");
const dashboardSource = read("features/markets/MarketsDashboard.tsx");
const pageSource = read("app/markets/page.tsx");

const breadthOverview: BreadthOverview = {
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

const anomalyOverview: AnomalyOverview = {
  mode: "live",
  engineVersion: "anomaly-v1",
  universe: { name: "S&P 500", version: "sp500-v1", asOf: "2026-09-05", count: 503 },
  meta: {
    provider: "alpaca",
    feed: "delayed_sip",
    delayMinutes: 15,
    asOf: "2026-09-05T13:00:00Z",
    marketOpen: true,
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
      reasons: ["+4.2% move equals 2.8× its 20D daily volatility"],
      dataCoverage: 1,
    },
  ],
  topPositive: [],
  topNegative: [],
  asOf: "2026-09-05T13:00:00Z",
};

const marketState: MarketOverviewState = {
  mode: "live",
  status: "ready",
  meta: {
    mode: "live",
    provider: "alpaca",
    feed: "iex",
    asOf: "2026-09-05T13:00:00Z",
    marketOpen: true,
    nextOpen: "2026-09-06T13:30:00Z",
    nextClose: "2026-09-05T20:00:00Z",
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

const macroState: MacroOverviewState = {
  mode: "live",
  status: "ready",
  meta: { mode: "live", asOf: "2026-09-05T12:00:00Z", stale: false, providers: ["fred"] },
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
      asOf: "2026-09-04T00:00:00Z",
      stale: false,
      available: true,
    },
  ],
};

const liveWorkspace = () => (
  <MarketsWorkspace
    market={marketState}
    macro={macroState}
    breadth={{
      mode: "live",
      status: "ready",
      demo: null,
      overview: breadthOverview,
      asOf: "2026-09-05T13:00:00Z",
    }}
    anomalies={{
      mode: "live",
      status: "ready",
      demo: null,
      overview: anomalyOverview,
      asOf: "2026-09-05T13:00:00Z",
    }}
  />
);

describe("Markets workspace sections", () => {
  it("renders the Markets title and all data modules in workspace order", () => {
    render(liveWorkspace());
    const headings = screen
      .getAllByRole("heading", { level: 2 })
      .map((heading) => heading.textContent);
    expect(headings).toEqual([
      "Markets",
      "Major Indexes",
      "Sector Rotation",
      "Macro Dashboard",
      "Market Breadth",
      "Market Anomalies",
    ]);
  });

  it("renders index prices and sector data from the canonical market state", () => {
    render(liveWorkspace());
    expect(screen.getByText("999.99")).toBeInTheDocument(); // SPY price
    expect(screen.getByText("Energy")).toBeInTheDocument();
    expect(screen.getByText(/2.34%/)).toBeInTheDocument(); // vs SPY
    expect(screen.getAllByText(/Live · IEX/).length).toBeGreaterThan(0);
  });

  it("renders macro cells with their own provenance", () => {
    render(liveWorkspace());
    expect(screen.getByText("VIX")).toBeInTheDocument();
    expect(screen.getByText("15.21")).toBeInTheDocument();
    expect(screen.getByText(/FRED · Daily/)).toBeInTheDocument();
  });

  it("renders breadth-v1 score, advance ratio and delayed-SIP label", () => {
    render(liveWorkspace());
    expect(screen.getByText("62")).toBeInTheDocument(); // displayScore
    expect(screen.getByText(/61% Advancing/)).toBeInTheDocument();
    expect(screen.getByText(/97% coverage · High confidence/i)).toBeInTheDocument();
    expect(screen.getAllByText(/15M Delayed SIP/i).length).toBeGreaterThan(0);
  });

  it("labels the anomaly universe as S&P 500 from data and renders ranked rows", () => {
    render(liveWorkspace());
    expect(screen.getByRole("note")).toHaveTextContent(/S&P 500/i);
    expect(screen.getByRole("note")).toHaveTextContent(/503 securities/i);
    expect(screen.getAllByText(/NVDA/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/NVIDIA/).length).toBeGreaterThan(0);
    expect(screen.getByText(/EXTREME/)).toBeInTheDocument();
    expect(screen.getByText(/RETURN SHOCK/)).toBeInTheDocument();
  });

  it("keeps index, sector and macro modules visible when breadth or anomalies fail", () => {
    render(
      <MarketsWorkspace
        market={marketState}
        macro={macroState}
        breadth={{ mode: "live", status: "error", demo: null, overview: null, asOf: null }}
        anomalies={{ mode: "live", status: "error", demo: null, overview: null, asOf: null }}
      />,
    );
    expect(screen.getByText("999.99")).toBeInTheDocument();
    expect(screen.getByText("VIX")).toBeInTheDocument();
    expect(screen.getByText(/Breadth unavailable/i)).toBeInTheDocument();
    expect(screen.getByText(/Anomalies unavailable/i)).toBeInTheDocument();
  });
});

describe("Markets page boundaries", () => {
  it("requires no AI brief endpoint and no AI/Ask modules on Markets", () => {
    for (const source of [workspaceSource, dashboardSource, pageSource]) {
      expect(source).not.toContain("/api/ai/market-brief");
    }
    expect(workspaceSource).not.toMatch(/AiMarketBrief|AskWarRoom|useAiMarketBrief/);
    expect(dashboardSource).not.toMatch(/AiMarketBrief|AskWarRoom|useAiMarketBrief/);
  });

  it("derives anomaly rows from data — no hard-coded ticker watchlist in Markets source", () => {
    for (const hardCoded of ['"LULU"', '"FICO"', '"ADBE"', '"NEOV"', '"NVDA"']) {
      expect(workspaceSource).not.toContain(hardCoded);
    }
    expect(workspaceSource).not.toMatch(/topOverall\s*=\s*\[/);
  });

  it("does not create a new scoring engine or rerank on the client", () => {
    expect(workspaceSource).not.toMatch(/\.sort\(|Math\.max|Math\.min|advanceRatio/);
    expect(workspaceSource).not.toContain("useBreadthOverview(");
    expect(workspaceSource).not.toMatch(
      /from "@\/lib\/(breadth|anomalies)\/(score|engine|history)/,
    );
    expect(dashboardSource).not.toMatch(
      /from "@\/lib\/(breadth|anomalies)\/(score|engine|history)/,
    );
    expect(dashboardSource).not.toMatch(/\.sort\(/);
  });

  it("keeps credentials and direct fetches out of the Markets client", () => {
    for (const source of [workspaceSource, dashboardSource]) {
      expect(source).not.toMatch(
        /LLM_API_KEY|ALPACA_API_KEY|ALPACA_API_SECRET|FRED_API_KEY|SEC_USER_AGENT/,
      );
      expect(source).not.toContain("fetch(");
      expect(source).not.toContain("process.env");
    }
  });

  it("reuses responsive grid/stack classes without fixed-width overflow", () => {
    expect(read("components/MarketPulse.tsx")).toContain("sm:grid-cols-2 xl:grid-cols-4");
    expect(read("components/SectorRow.tsx")).toContain("md:grid-cols");
    expect(read("components/MacroPulse.tsx")).toContain("md:grid-cols-3 xl:grid-cols-6");
    expect(read("components/LiveBreadthView.tsx")).toContain("grid-cols-1 gap-3 sm:grid-cols-2");
    expect(read("components/LiveAnomaliesView.tsx")).toContain("flex flex-wrap");
    expect(dashboardSource).toContain("sm:px-6");
    expect(dashboardSource).not.toContain("min-w-[1200px]");
  });
});
