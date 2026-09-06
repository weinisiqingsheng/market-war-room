import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import type { MacroSignal } from "@war-room/types";
import { MacroPulse } from "@/components/MacroPulse";
import { MacroSignalCard } from "@/components/MacroSignalCard";

const wtiSignal: MacroSignal = {
  id: "wti",
  label: "WTI",
  value: 85.51,
  displayUnit: "price",
  change: 2.1,
  changePct: 2.5,
  interpretation: "Inflation Risk",
  tone: "negative",
  source: "FRED",
  frequency: "daily",
  asOf: "2026-08-28T00:00:00Z",
  stale: false,
  available: true,
};

const unavailableSignal: MacroSignal = {
  id: "usd_broad",
  label: "US Dollar",
  value: null,
  displayUnit: "index",
  change: null,
  changePct: null,
  interpretation: null,
  tone: "neutral",
  source: "FRED",
  frequency: "daily",
  asOf: null,
  stale: false,
  available: false,
};

describe("MacroPulse", () => {
  it("renders an unavailable signal safely (—, never 0, never a demo value)", () => {
    render(
      <MacroPulse
        signals={[unavailableSignal]}
        status="ready"
        mode="live"
        meta={{ mode: "live", asOf: null, stale: false, providers: [] }}
      />,
    );
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
    expect(screen.getByText("Unavailable")).toBeInTheDocument();
    expect(screen.queryByText("0.00")).not.toBeInTheDocument();
  });

  it("shows a safe MACRO DATA tag in live mode (not LIVE MACRO DATA)", () => {
    render(
      <MacroPulse
        signals={[wtiSignal]}
        status="ready"
        mode="live"
        meta={{ mode: "live", asOf: "2026-08-31T14:29:00Z", stale: false, providers: ["fred"] }}
      />,
    );
    expect(screen.getByText(/MACRO DATA/i)).toBeInTheDocument();
    expect(screen.queryByText(/LIVE MACRO DATA/i)).not.toBeInTheDocument();
  });

  it("shows a DEMO tag in demo mode", () => {
    render(<MacroPulse signals={null} status="ready" mode="demo" meta={null} />);
    expect(screen.getByText("DEMO")).toBeInTheDocument();
  });
});

describe("MacroSignalCard — direction vs interpretation stay separate", () => {
  it("colors raw direction by price move and interpretation by semantic tone", () => {
    const { container } = render(<MacroSignalCard signal={wtiSignal} />);

    expect(screen.getByText("$85.51")).toBeInTheDocument();
    expect(screen.getByText("+2.50%")).toBeInTheDocument(); // raw change

    const change = screen.getByText("+2.50%");
    expect(change.parentElement).toHaveClass("text-pos"); // up price = green

    const interpretation = screen.getByText("Inflation Risk");
    expect(interpretation.parentElement).toHaveClass("text-neg"); // risk = rose

    // WTI is now a FRED daily macro anchor — never "Live".
    expect(container.textContent).toContain("FRED · Daily");
    expect(container.textContent).not.toContain("Live");
  });

  it("renders FRED daily provenance as 'FRED · Daily'", () => {
    const fredSignal: MacroSignal = {
      ...wtiSignal,
      id: "vix",
      label: "VIX",
      value: 15.21,
      displayUnit: "index",
      source: "FRED",
      frequency: "daily",
      interpretation: "Volatility Calm",
      tone: "positive",
    };
    const { container } = render(<MacroSignalCard signal={fredSignal} />);
    expect(container.textContent).toContain("FRED · Daily");
  });

  it("renders the Broad USD provenance and never prints 'DXY'", () => {
    const usdBroadSignal: MacroSignal = {
      ...wtiSignal,
      id: "usd_broad",
      label: "US Dollar",
      instrument: "Broad USD Index",
      value: 118.75,
      displayUnit: "index",
      change: -0.28,
      changePct: -0.24,
      source: "FRED",
      frequency: "daily",
      interpretation: "Dollar Softening",
      tone: "neutral",
    };
    const { container } = render(<MacroSignalCard signal={usdBroadSignal} />);
    expect(container.textContent).toContain("Broad USD Index · FRED · Daily");
    expect(container.textContent).not.toContain("DXY");
  });
});
