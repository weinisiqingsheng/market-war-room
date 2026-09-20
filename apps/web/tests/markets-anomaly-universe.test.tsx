import { describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach } from "vitest";
import { MarketsWorkspace } from "@/features/markets/MarketsWorkspace";
import { buildDemoAnomaliesOverview } from "@/lib/anomalies/demo";
import type { AnomalyUniverseId } from "@/lib/anomalies/universe/types";
import type { MarketOverviewState } from "@/features/home/useMarketOverview";
import type { MacroOverviewState } from "@/features/home/useMacroOverview";
import type { AnomaliesOverviewState } from "@/features/home/useAnomaliesOverview";
import type { MarketAnomaly } from "@war-room/types";

const market: MarketOverviewState = {
  mode: "demo",
  status: "ready",
  meta: null,
  indices: [],
  sectors: [],
};
const macro: MacroOverviewState = { mode: "demo", status: "ready", meta: null, signals: [] };
const breadth = {
  mode: "demo" as const,
  status: "ready" as const,
  demo: null,
  overview: null,
  asOf: null,
};

const demoRow = (symbol: string): MarketAnomaly => ({
  symbol,
  movePct: -4.2,
  relativeVolume: 9.5,
  hodDistancePct: 2.1,
  relativeStrength: 3,
  score: 92,
});

function anomaliesState(
  universeId: AnomalyUniverseId,
  overrides: Partial<AnomaliesOverviewState> = {},
): AnomaliesOverviewState {
  const symbols = universeId === "sp500" ? ["NEOV", "NVDA"] : ["NVDA"];
  return {
    mode: "demo",
    status: "ready",
    demo: symbols.map(demoRow),
    overview: buildDemoAnomaliesOverview(universeId),
    asOf: null,
    universeId,
    ...overrides,
  };
}

function renderWorkspace(
  anomalies: AnomaliesOverviewState,
  universeId: AnomalyUniverseId,
  onChange = vi.fn(),
) {
  return render(
    <MarketsWorkspace
      market={market}
      macro={macro}
      breadth={breadth}
      anomalies={anomalies}
      anomaliesUniverse={universeId}
      onAnomaliesUniverseChange={onChange}
    />,
  );
}

afterEach(() => cleanup());

describe("Markets anomaly universe selector (V1.1E)", () => {
  it("defaults to S&P 500 and labels the selected universe count", () => {
    renderWorkspace(anomaliesState("sp500"), "sp500");
    const sp500 = screen.getByRole("button", { name: "S&P 500" });
    const nasdaq = screen.getByRole("button", { name: "Nasdaq 100" });
    expect(sp500).toHaveAttribute("aria-pressed", "true");
    expect(nasdaq).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("note")).toHaveTextContent(/S&P 500/);
    expect(screen.getByRole("note")).toHaveTextContent(/503 securities/);
    expect(screen.getByRole("note")).toHaveTextContent(/Demo universe preview/);
  });

  it("reports the Nasdaq 100 selection and never reranks rows on the client", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = renderWorkspace(anomaliesState("sp500"), "sp500", onChange);
    expect(screen.getByText("NEOV")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Nasdaq 100" }));
    expect(onChange).toHaveBeenCalledWith("nasdaq100");

    rerender(
      <MarketsWorkspace
        market={market}
        macro={macro}
        breadth={breadth}
        anomalies={anomaliesState("nasdaq100")}
        anomaliesUniverse="nasdaq100"
        onAnomaliesUniverseChange={onChange}
      />,
    );
    expect(screen.getByRole("button", { name: "Nasdaq 100" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("note")).toHaveTextContent(/Nasdaq 100/);
    expect(screen.getByRole("note")).toHaveTextContent(/101 securities/);
    // API-provided rows are rendered as-is: the S&P-only demo row disappears.
    expect(screen.queryByText("NEOV")).not.toBeInTheDocument();
    expect(screen.getByText("NVDA")).toBeInTheDocument();
  });

  it("does not refetch when the already-selected universe is clicked again", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWorkspace(anomaliesState("sp500"), "sp500", onChange);
    await user.click(screen.getByRole("button", { name: "S&P 500" }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("keeps the selector and other Markets modules intact during local loading and error", () => {
    const { rerender } = renderWorkspace(
      anomaliesState("nasdaq100", { mode: "live", status: "loading", demo: null, overview: null }),
      "nasdaq100",
    );
    expect(screen.getByRole("group", { name: "Anomaly universe" })).toHaveAttribute(
      "aria-busy",
      "true",
    );
    expect(screen.getByRole("button", { name: "Nasdaq 100" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.queryByRole("note")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Markets" })).toBeInTheDocument();

    rerender(
      <MarketsWorkspace
        market={market}
        macro={macro}
        breadth={breadth}
        anomalies={anomaliesState("nasdaq100", {
          mode: "live",
          status: "error",
          demo: null,
          overview: null,
        })}
        anomaliesUniverse="nasdaq100"
        onAnomaliesUniverseChange={vi.fn()}
      />,
    );
    expect(screen.getByRole("group", { name: "Anomaly universe" })).toBeInTheDocument();
    expect(screen.getByText(/Anomalies unavailable/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Markets" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Major Indexes" })).toBeInTheDocument();
  });
});
