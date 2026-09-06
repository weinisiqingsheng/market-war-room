import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import type { RegimeResult } from "@war-room/types";
import { demoRegime, demoRegimeDrivers } from "@/data/demo-market";
import { MarketRegimeCard } from "@/components/MarketRegimeCard";

const liveResult: RegimeResult = {
  score: 41.8,
  displayScore: 42,
  label: "CAUTIOUS / NEUTRAL",
  coverage: 0.87,
  confidence: "high",
  components: [
    { id: "equity", name: "Equity Tape", score: 37.2, weight: 0.3 },
    { id: "sectors", name: "Sector Participation", score: 44.1, weight: 0.2 },
    { id: "volatility", name: "Volatility", score: 61, weight: 0.15 },
    { id: "rates", name: "Rates", score: 28.4, weight: 0.15 },
    { id: "macro", name: "Macro Pressure", score: 31.5, weight: 0.15 },
    { id: "crypto", name: "Crypto Risk Appetite", score: 56, weight: 0.05 },
  ],
  positiveDrivers: [
    { id: "vix", name: "VIX", direction: "positive", impact: 2.4, reason: "VIX fell 5.2% to 14.4" },
  ],
  negativeDrivers: [
    {
      id: "us10y",
      name: "US 10Y",
      direction: "negative",
      impact: -3.8,
      reason: "US 10Y rose 8 bp",
    },
    {
      id: "wti",
      name: "WTI",
      direction: "negative",
      impact: -1.4,
      reason: "WTI rose 5.1%, increasing inflation pressure",
    },
  ],
  staleInputs: ["wti"],
  missingInputs: [],
  asOf: "2026-09-01T12:00:00Z",
  engineVersion: "regime-v1",
};

function renderLive(result: RegimeResult | null, status: "ready" | "loading" | "error" = "ready") {
  return render(
    <MarketRegimeCard
      mode="live"
      status={status}
      regime={null}
      regimeDrivers={null}
      result={result}
      asOf={result?.asOf ?? null}
    />,
  );
}

describe("MarketRegimeCard — demo mode", () => {
  it("renders the demo fixture with a DEMO tag and no LIVE label", () => {
    render(
      <MarketRegimeCard
        mode="demo"
        status="ready"
        regime={demoRegime}
        regimeDrivers={demoRegimeDrivers}
        result={null}
      />,
    );
    expect(screen.getAllByText("42").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Cautious / Risk-Off").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/demo/i).length).toBeGreaterThan(0);
    expect(screen.queryByText("Live")).not.toBeInTheDocument();
  });
});

describe("MarketRegimeCard — live mode", () => {
  it("renders the engine score, label, coverage, confidence and LIVE tag", () => {
    renderLive(liveResult);
    expect(screen.getAllByText("42").length).toBeGreaterThan(0);
    expect(screen.getAllByText("CAUTIOUS / NEUTRAL").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^Live$/).length).toBeGreaterThan(0);
    expect(screen.getByText(/87% coverage · High confidence/i)).toBeInTheDocument();
    expect(screen.getByText(/regime-v1/)).toBeInTheDocument();
    expect(screen.queryByText(/demo/i)).not.toBeInTheDocument();
  });

  it("exposes the live spectrum meter at the engine score position", () => {
    renderLive(liveResult);
    const meter = screen.getByRole("meter");
    expect(meter).toHaveAttribute("aria-valuenow", "41.8");
  });

  it("renders deterministic driver reasons and never prints DXY", () => {
    renderLive(liveResult);
    expect(screen.getByText(/US 10Y rose 8 bp/)).toBeInTheDocument();
    expect(screen.getByText(/VIX fell 5.2% to 14.4/)).toBeInTheDocument();
    expect(screen.getByText(/WTI rose 5.1%, increasing inflation pressure/)).toBeInTheDocument();
  });

  it("discloses stale inputs without overwhelming the score", () => {
    renderLive(liveResult);
    expect(screen.getByText("1 stale input")).toBeInTheDocument();
  });

  it("renders an explicit Insufficient Data state when coverage is too low", () => {
    const insufficient: RegimeResult = {
      ...liveResult,
      score: null,
      displayScore: null,
      label: "Insufficient Data",
      coverage: 0.4,
      confidence: "insufficient",
      staleInputs: [],
      missingInputs: ["macro:wti", "macro:usd_broad"],
    };
    renderLive(insufficient);
    expect(screen.getByText("Insufficient Data")).toBeInTheDocument();
    expect(screen.getByText(/40% coverage · Insufficient coverage/i)).toBeInTheDocument();
    expect(screen.queryByRole("meter")).not.toBeInTheDocument();
  });

  it("renders unavailable state without any demo score when live fails", () => {
    renderLive(null, "error");
    expect(screen.getByText(/Regime unavailable/i)).toBeInTheDocument();
    expect(screen.queryByText("42")).not.toBeInTheDocument();
    expect(screen.queryByText("Cautious / Risk-Off")).not.toBeInTheDocument();
  });

  it("renders a loading skeleton while the engine is pending", () => {
    const { container } = renderLive(null, "loading");
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
  });
});
