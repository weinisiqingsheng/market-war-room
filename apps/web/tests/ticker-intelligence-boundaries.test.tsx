import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import path from "node:path";
import { HomeDashboard } from "@/features/home/HomeDashboard";
import { MarketsWorkspace } from "@/features/markets/MarketsWorkspace";
import { buildDemoAnomaliesOverview } from "@/lib/anomalies/demo";
import type { MarketOverviewState } from "@/features/home/useMarketOverview";
import type { MacroOverviewState } from "@/features/home/useMacroOverview";
import type { AnomaliesOverviewState } from "@/features/home/useAnomaliesOverview";
import type { TickerResearchApiOk } from "@/lib/ticker-context/api-types";
import type { SafeTickerSummary } from "@/lib/ticker-context/summary";

/**
 * V1.2C product boundaries: Ticker Intelligence lives in Markets exactly once,
 * is absent from Overview/Intelligence, never touches the global evidence pack
 * or the AI brief, and never triggers an LLM request. Chinese routes stay
 * untouched by construction (verified structurally below).
 */
function readSource(relative: string): string {
  return readFileSync(path.join(process.cwd(), relative), "utf8");
}

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
const anomalies: AnomaliesOverviewState = {
  mode: "demo",
  status: "ready",
  demo: [],
  overview: buildDemoAnomaliesOverview("sp500"),
  asOf: null,
  universeId: "sp500",
};

function renderMarkets() {
  return render(
    <MarketsWorkspace
      market={market}
      macro={macro}
      breadth={breadth}
      anomalies={anomalies}
      anomaliesUniverse="sp500"
      onAnomaliesUniverseChange={vi.fn()}
    />,
  );
}

function payload(): TickerResearchApiOk {
  const summary = {
    version: "ticker-summary-v1",
    price: null,
    quote: null,
    volume: null,
    volatility: null,
    range: null,
    sector: null,
    events: null,
  } as SafeTickerSummary;
  return {
    mode: "live",
    status: "ok",
    symbol: "NVDA",
    context: {
      version: "ticker-context-v1",
      status: "ok",
      requestedSymbol: "NVDA",
      symbol: "NVDA",
      identity: {
        symbol: "NVDA",
        name: "NVIDIA Corporation Common Stock",
        exchange: "NASDAQ",
        assetClass: "us_equity",
        status: "active",
        tradable: true,
      },
      requestedAt: "2026-09-18T21:05:00.000Z",
      generatedAt: "2026-09-18T21:05:02.000Z",
      providerAsOf: null,
      marketSessionAsOf: "2026-09-18",
      effectiveAsOf: null,
      session: { marketOpen: false, phase: "closed", sessionDate: "2026-09-18" },
      sources: {
        market: {
          available: true,
          asOf: null,
          freshness: "delayed",
          confidence: null,
          version: "alpaca-delayed-sip-v1",
        },
        identity: {
          available: true,
          asOf: null,
          freshness: "fresh",
          confidence: "high",
          version: "alpaca-assets-v1",
        },
        sector: {
          available: false,
          asOf: null,
          freshness: "unavailable",
          confidence: null,
          version: null,
        },
        news: {
          available: false,
          asOf: null,
          freshness: "unavailable",
          confidence: null,
          version: null,
        },
        sec: {
          available: false,
          asOf: null,
          freshness: "unavailable",
          confidence: null,
          version: null,
        },
      } as never,
      availability: {
        price: true,
        history: false,
        volume: false,
        volatility: false,
        sector: false,
        news: false,
        sec: false,
        corporateActions: false,
      },
      confidence: { score: 0.9, label: "high" },
      factCount: 0,
      facts: [],
      summary,
      fingerprint: "f".repeat(64),
    },
  };
}

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  cleanup();
});

describe("V1.2C product boundaries", () => {
  it("renders exactly one Ticker Intelligence workspace in Markets", () => {
    renderMarkets();
    expect(screen.getAllByRole("heading", { name: "Ticker Intelligence" })).toHaveLength(1);
    expect(document.querySelectorAll("#ticker-intelligence")).toHaveLength(1);
    // The existing Markets composition is intact.
    expect(screen.getByRole("heading", { name: "Markets" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Major Indexes" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Sector Rotation" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Anomaly universe" })).toBeInTheDocument();
  });

  it("keeps the anomaly universe selector functional alongside the new section", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <MarketsWorkspace
        market={market}
        macro={macro}
        breadth={breadth}
        anomalies={anomalies}
        anomaliesUniverse="sp500"
        onAnomaliesUniverseChange={onChange}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Nasdaq 100" }));
    expect(onChange).toHaveBeenCalledWith("nasdaq100");
  });

  it("does not duplicate the workspace on Overview", () => {
    render(<HomeDashboard mode="demo" macroMode="demo" />);
    expect(screen.queryByRole("heading", { name: "Ticker Intelligence" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Ask Sakura" })).toBeInTheDocument();
  });

  it("is not imported by the Overview or Intelligence workspaces", () => {
    for (const relative of [
      "features/home/HomeDashboard.tsx",
      "features/intelligence/IntelligenceDashboard.tsx",
      "features/intelligence/components/EvidenceExplorer.tsx",
    ]) {
      expect(readSource(relative)).not.toContain("TickerIntelligence");
    }
  });

  it("never triggers an LLM or global-evidence request from the ticker UI", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => payload(),
    } as unknown as Response);
    renderMarkets();

    await user.type(screen.getByLabelText(/US stock ticker symbol/i), "NVDA{Enter}");
    await screen.findByText("NVIDIA Corporation Common Stock");

    const urls = fetchMock.mock.calls.map((call) => String(call[0]));
    expect(urls).toEqual(["/api/intelligence/ticker?symbol=NVDA"]);
    for (const url of urls) {
      expect(url).not.toContain("/api/ai/");
      expect(url).not.toContain("brief");
      expect(url).not.toContain("sakura");
    }
  });

  it("does not modify the Ask Sakura on-demand ticker workflow", () => {
    const askService = readSource("lib/ask-sakura/production-service.ts");
    expect(askService).toContain("@/lib/ticker-context/service");
    expect(askService).toContain("researchTicker");
    expect(askService).not.toContain("TickerIntelligence");
    expect(askService).not.toContain("features/markets/useTickerResearch");
  });

  it("leaves the Chinese workstream untouched", () => {
    for (const relative of [
      "app/zh/war-room/page.tsx",
      "features/war-room-zh/ChineseWarRoomDashboard.tsx",
      "components/war-room-zh/ChineseAskWarRoom.tsx",
      "lib/war-room-zh/ai-brief-service.ts",
      "app/api/zh/ai/ask-war-room/route.ts",
    ]) {
      const source = readSource(relative);
      expect(source).not.toContain("TickerIntelligence");
      expect(source).not.toContain("ticker-intelligence");
      expect(source).not.toContain("useTickerResearch");
    }
  });
});
