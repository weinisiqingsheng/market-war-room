import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import type { RegimeResult } from "@war-room/types";
import {
  demoAnomalies,
  demoBreadth,
  demoCatalysts,
  demoIndices,
  demoMacro,
  demoRegime,
  demoRegimeDrivers,
  demoSectors,
} from "@/data/demo-market";
import { ChineseCatalystIntelligence } from "@/components/war-room-zh/ChineseCatalystIntelligence";
import { ChineseMacroPulse } from "@/components/war-room-zh/ChineseMacroPulse";
import { ChineseMarketAnomaliesCard } from "@/components/war-room-zh/ChineseMarketAnomaliesCard";
import { ChineseMarketBreadthCard } from "@/components/war-room-zh/ChineseMarketBreadthCard";
import { ChineseMarketPulse } from "@/components/war-room-zh/ChineseMarketPulse";
import { ChineseMarketRegimeCard } from "@/components/war-room-zh/ChineseMarketRegimeCard";
import { ChineseSectorRotation } from "@/components/war-room-zh/ChineseSectorRotation";

describe("Chinese Market War Room cards", () => {
  it("preserves a live regime driver reason and safely renders missing sector returns", () => {
    const result: RegimeResult = {
      score: 42,
      displayScore: 42,
      label: "CAUTIOUS / NEUTRAL",
      coverage: 1,
      confidence: "high",
      components: [],
      positiveDrivers: [
        { id: "vix", name: "VIX", direction: "positive", impact: 2.4, reason: "VIX fell" },
      ],
      negativeDrivers: [],
      staleInputs: [],
      missingInputs: [],
      asOf: null,
      engineVersion: "regime-v1",
    };
    const { rerender } = render(
      <ChineseMarketRegimeCard
        mode="live"
        status="ready"
        regime={null}
        regimeDrivers={null}
        result={result}
      />,
    );
    expect(screen.getByText(/VIX fell/)).toBeInTheDocument();

    rerender(
      <ChineseSectorRotation
        sectors={[{ ...demoSectors[0], relativeReturnPct: null }]}
        status="ready"
        mode="live"
        feed={null}
        benchmark={{ ticker: "SPY", dailyReturnPct: null }}
      />,
    );
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("preserves a supplied SPY price with Chinese market-pulse copy", () => {
    render(
      <ChineseMarketPulse
        indices={[{ ...demoIndices[0], price: 534.12 }]}
        status="ready"
        mode="demo"
        feed={null}
      />,
    );

    expect(screen.getByText("SPY")).toBeInTheDocument();
    expect(screen.getByText("534.12")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "市场脉搏" })).toBeInTheDocument();
    expect(screen.queryByText("Market Pulse")).not.toBeInTheDocument();
  });

  it("does not show stale index values after a live market-pulse error", () => {
    render(
      <ChineseMarketPulse
        indices={[{ ...demoIndices[0], price: 534.12 }]}
        status="error"
        mode="live"
        feed={null}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("市场数据暂不可用");
    expect(screen.queryByText("534.12")).not.toBeInTheDocument();
  });

  it("distinguishes ready, loading, error, and empty regime states", () => {
    const { rerender } = render(
      <ChineseMarketRegimeCard
        mode="demo"
        status="ready"
        regime={demoRegime}
        regimeDrivers={demoRegimeDrivers}
        result={null}
      />,
    );
    expect(screen.getByText(String(demoRegime.score))).toBeInTheDocument();

    rerender(
      <ChineseMarketRegimeCard
        mode="live"
        status="loading"
        regime={null}
        regimeDrivers={null}
        result={null}
      />,
    );
    expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");

    rerender(
      <ChineseMarketRegimeCard
        mode="live"
        status="error"
        regime={null}
        regimeDrivers={null}
        result={null}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("市场环境暂不可用");

    rerender(
      <ChineseMarketRegimeCard
        mode="demo"
        status="ready"
        regime={null}
        regimeDrivers={null}
        result={null}
      />,
    );
    expect(screen.getByText("暂无市场环境数据")).toBeInTheDocument();
  });

  it("distinguishes ready, loading, error, and empty macro states", () => {
    const { rerender } = render(
      <ChineseMacroPulse signals={demoMacro} status="ready" mode="demo" meta={null} />,
    );
    expect(screen.getByText("VIX")).toBeInTheDocument();

    rerender(<ChineseMacroPulse signals={null} status="loading" mode="live" meta={null} />);
    expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");

    rerender(<ChineseMacroPulse signals={demoMacro} status="error" mode="live" meta={null} />);
    expect(screen.getByText("宏观数据暂不可用")).toBeInTheDocument();

    rerender(<ChineseMacroPulse signals={[]} status="ready" mode="demo" meta={null} />);
    expect(screen.getByText("暂无宏观数据")).toBeInTheDocument();
  });

  it("distinguishes sector and breadth states without substituting data", () => {
    const { rerender } = render(
      <ChineseSectorRotation
        sectors={demoSectors}
        status="ready"
        mode="demo"
        feed={null}
        benchmark={{ ticker: "SPY", dailyReturnPct: 0 }}
      />,
    );
    expect(screen.getByText("板块轮动")).toBeInTheDocument();

    rerender(
      <ChineseSectorRotation
        sectors={null}
        status="loading"
        mode="live"
        feed={null}
        benchmark={{ ticker: "SPY", dailyReturnPct: null }}
      />,
    );
    expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");

    rerender(
      <ChineseSectorRotation
        sectors={demoSectors}
        status="error"
        mode="live"
        feed={null}
        benchmark={{ ticker: "SPY", dailyReturnPct: 0 }}
      />,
    );
    expect(screen.getByText("市场数据暂不可用")).toBeInTheDocument();

    rerender(
      <ChineseSectorRotation
        sectors={[]}
        status="ready"
        mode="demo"
        feed={null}
        benchmark={{ ticker: "SPY", dailyReturnPct: 0 }}
      />,
    );
    expect(screen.getByText("暂无板块数据")).toBeInTheDocument();

    rerender(
      <ChineseMarketBreadthCard mode="demo" status="ready" breadth={demoBreadth} overview={null} />,
    );
    expect(screen.getByText("市场广度")).toBeInTheDocument();

    rerender(
      <ChineseMarketBreadthCard mode="live" status="loading" breadth={null} overview={null} />,
    );
    expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");

    rerender(
      <ChineseMarketBreadthCard mode="live" status="error" breadth={null} overview={null} />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("市场广度暂不可用");

    rerender(
      <ChineseMarketBreadthCard mode="demo" status="ready" breadth={null} overview={null} />,
    );
    expect(screen.getByText("暂无市场广度数据")).toBeInTheDocument();
  });

  it("distinguishes ready, loading, error, and empty anomaly and catalyst states", () => {
    const { rerender } = render(
      <ChineseMarketAnomaliesCard
        mode="demo"
        status="ready"
        anomalies={demoAnomalies}
        overview={null}
      />,
    );
    expect(screen.getByText("极端异常")).toBeInTheDocument();

    rerender(
      <ChineseMarketAnomaliesCard mode="live" status="loading" anomalies={null} overview={null} />,
    );
    expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");

    rerender(
      <ChineseMarketAnomaliesCard mode="live" status="error" anomalies={null} overview={null} />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("市场异常暂不可用");

    rerender(
      <ChineseMarketAnomaliesCard mode="demo" status="ready" anomalies={[]} overview={null} />,
    );
    expect(screen.getByText("暂无市场异常")).toBeInTheDocument();

    rerender(<ChineseCatalystIntelligence events={demoCatalysts} status="ready" />);
    expect(screen.getByText("催化事件")).toBeInTheDocument();

    rerender(<ChineseCatalystIntelligence events={[]} status="loading" />);
    expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");

    rerender(<ChineseCatalystIntelligence events={demoCatalysts} status="error" />);
    expect(screen.getByRole("status")).toHaveTextContent("催化事件暂不可用");

    rerender(<ChineseCatalystIntelligence events={[]} status="ready" />);
    expect(screen.getByText("暂无催化事件")).toBeInTheDocument();
  });
});
