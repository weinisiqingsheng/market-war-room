import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import type { RegimeResult } from "@war-room/types";
import type { AnomalyOverview } from "@/lib/anomalies/types";
import type { BreadthOverview } from "@/lib/breadth/types";
import type { CatalystOverview } from "@/lib/catalysts/types";
import { formatEtTime } from "@/lib/format";
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
  it("preserves live regime explainability and safely renders missing sector returns", () => {
    const result: RegimeResult = {
      score: 42,
      displayScore: 42,
      label: "CAUTIOUS / NEUTRAL",
      coverage: 0.72,
      confidence: "medium",
      components: [],
      positiveDrivers: [
        { id: "vix", name: "VIX", direction: "positive", impact: 2.4, reason: "VIX fell" },
      ],
      negativeDrivers: [],
      staleInputs: ["VIX"],
      missingInputs: ["BTC", "Gold"],
      asOf: "2026-09-07T16:30:00.000Z",
      engineVersion: "regime-v1",
    };
    const { rerender } = render(
      <ChineseMarketRegimeCard
        mode="live"
        status="ready"
        regime={null}
        regimeDrivers={null}
        result={result}
        asOf={result.asOf}
      />,
    );
    expect(screen.getByText(/VIX fell/)).toBeInTheDocument();
    expect(screen.getByText(/72% 覆盖率/)).toBeInTheDocument();
    expect(screen.getByText(/中等置信度/)).toBeInTheDocument();
    expect(screen.getByText(/1 个陈旧输入/)).toBeInTheDocument();
    expect(screen.getByText(/2 个缺失输入/)).toBeInTheDocument();
    expect(screen.getByText(/regime-v1/)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`截至 ${formatEtTime(result.asOf)}`))).toBeInTheDocument();

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

  it("preserves market, macro, sector, and breadth facts with their provenance", () => {
    const { rerender } = render(
      <ChineseMarketPulse
        indices={[
          {
            ...demoIndices[0],
            price: 525,
            low: 500,
            high: 550,
            changePct: 0.5,
            sparkline: [500, 515, 525],
          },
        ]}
        status="ready"
        mode="live"
        feed="iex"
      />,
    );
    expect(screen.getByRole("img", { name: "SPY 今日区间位置 50%" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "SPY 日内趋势，上行" })).toBeInTheDocument();

    rerender(
      <ChineseMacroPulse
        signals={[
          {
            ...demoMacro[0],
            source: "FRED",
            frequency: "daily",
            stale: true,
            tone: "negative",
            interpretation: "Rate Pressure",
          },
        ]}
        status="ready"
        mode="live"
        meta={{ mode: "live", asOf: null, stale: true, providers: ["fred"] }}
      />,
    );
    expect(screen.getByText("陈旧")).toBeInTheDocument();
    expect(screen.getByText("FRED · 日频")).toBeInTheDocument();
    expect(screen.getByText("看跌 · Rate Pressure")).toBeInTheDocument();

    rerender(
      <ChineseSectorRotation
        sectors={[
          {
            ...demoSectors[0],
            dailyReturnPct: 1.25,
            relativeReturnPct: 0.75,
            signal: "Leader",
            strength: 72,
          },
        ]}
        status="ready"
        mode="live"
        feed="iex"
        benchmark={{ ticker: "SPY", dailyReturnPct: 0.5 }}
      />,
    );
    expect(screen.getByText("+1.25%")).toBeInTheDocument();
    expect(screen.getByText("Leader")).toBeInTheDocument();
    expect(screen.getByText("72")).toBeInTheDocument();

    const breadth: BreadthOverview = {
      mode: "live",
      score: 61,
      displayScore: 61,
      engineVersion: "breadth-v1",
      state: { key: "BROAD_RALLY", label: "Broad Rally" },
      metrics: {
        universeCount: 500,
        currentCoverageCount: 480,
        historical20CoverageCount: 470,
        historical50CoverageCount: 460,
        coveragePct: 0.96,
        advancers: 310,
        decliners: 150,
        unchanged: 20,
        advanceRatio: 0.67,
        above20Pct: 0.64,
        above50Pct: 0.58,
        newHighs20: 45,
        newLows20: 8,
      },
      universe: { name: "S&P 500", version: "sp500-v1", asOf: "2026-09-07", count: 500 },
      meta: {
        provider: "alpaca",
        feed: "delayed_sip",
        delayMinutes: 15,
        asOf: "2026-09-07T16:30:00.000Z",
        marketOpen: true,
      },
      confidence: "high",
    };
    rerender(
      <ChineseMarketBreadthCard mode="live" status="ready" breadth={null} overview={breadth} />,
    );
    expect(screen.getByText("64%")).toBeInTheDocument();
    expect(screen.getByText("45")).toBeInTheDocument();
    expect(screen.getByText(/96% 覆盖率 · 高置信度/)).toBeInTheDocument();
    expect(screen.getByText(/breadth-v1 · 500 个成分股 · 15分钟延迟 SIP/)).toBeInTheDocument();
  });

  it("preserves live anomaly movement and supplied severity", () => {
    const overview: AnomalyOverview = {
      mode: "live",
      engineVersion: "anomaly-v1",
      universe: { name: "S&P 500", version: "sp500-v1", asOf: "2026-09-07", count: 500 },
      meta: {
        provider: "alpaca",
        feed: "delayed_sip",
        delayMinutes: 15,
        asOf: null,
        marketOpen: true,
        stale: false,
      },
      universeCount: 500,
      eligibleCount: 470,
      scoredCount: 460,
      coveragePct: 0.92,
      confidence: "high",
      topPositive: [],
      topNegative: [],
      asOf: "2026-09-07T16:30:00.000Z",
      topOverall: [
        {
          ticker: "TEST",
          name: "Test Holdings",
          sector: "Technology",
          sectorEtf: "XLK",
          price: 100,
          dailyMovePct: 3.4,
          direction: "up",
          anomalyScore: 88,
          displayScore: 88,
          severity: "ELEVATED",
          primaryTrigger: "VOLUME SURGE",
          metrics: {
            returnSigma: 2,
            sectorRelativePct: null,
            sectorRelativeSigma: null,
            gapPct: null,
            gapAtrRatio: null,
            rangeExpansionRatio: null,
            volumeParticipation: null,
            breakout20: false,
            breakdown20: false,
          },
          componentScores: {
            returnShock: null,
            sectorDivergence: null,
            gapShock: null,
            rangeExpansion: null,
            volumeParticipation: null,
            breakout: null,
          },
          reasons: [],
          dataCoverage: 1,
        },
      ],
    };
    render(
      <ChineseMarketAnomaliesCard
        mode="live"
        status="ready"
        anomalies={null}
        overview={overview}
      />,
    );
    expect(screen.getByText("+3.4%")).toBeInTheDocument();
    expect(screen.getByText(/88 · ELEVATED/)).toBeInTheDocument();
    expect(screen.queryByText("高度异常")).not.toBeInTheDocument();
  });

  it("preserves live catalyst evidence and ignores retained live data in demo mode", () => {
    const overview: CatalystOverview = {
      meta: {
        mode: "live",
        engineVersion: "catalyst-match-v1",
        anomalyVersion: "anomaly-v1",
        candidateCount: 1,
        matchedCount: 1,
        unmatchedCount: 0,
        generatedAt: "2026-09-07T16:35:00.000Z",
        effectiveAsOf: "2026-09-07T16:30:00.000Z",
        asOf: "2026-09-07T16:30:00.000Z",
        catalystCutoff: "2026-09-07T16:30:00.000Z",
        providers: { news: "error", sec: "ok", corporateActions: "disabled" },
      },
      items: [
        {
          ticker: "TEST",
          name: "Test Holdings",
          movePct: 3.4,
          anomalyScore: 88,
          anomalySeverity: "ELEVATED",
          status: "MATCHED",
          alignment: "aligned",
          catalystCutoff: "2026-09-07T16:30:00.000Z",
          evidence: { newsCount: 1, filingCount: 2, corporateActionCount: 0 },
          primaryCatalyst: {
            category: "SEC FILING",
            headline: "Live catalyst evidence",
            publishedAt: "2026-09-07T15:30:00.000Z",
            source: "SEC",
            sourceType: "sec_filing",
            url: "https://example.test/filing",
            relevanceScore: 91,
            evidenceStrength: "strong",
            eventPolarity: "positive",
            symbols: ["TEST"],
            supportingEvidence: ["Filed 8-K"],
          },
          secondaryCatalysts: [],
        },
      ],
    };
    const liveProps = { mode: "live" as const, events: [], status: "ready" as const, overview };
    const { rerender } = render(<ChineseCatalystIntelligence {...liveProps} />);
    expect(screen.getByText(/主要证据 · SEC/)).toBeInTheDocument();
    expect(
      screen.getByText(new RegExp(formatEtTime(overview.items[0].primaryCatalyst?.publishedAt))),
    ).toBeInTheDocument();
    expect(screen.getByText(/1 条新闻 · 2 份 SEC 文件 · 0 项公司行动/)).toBeInTheDocument();
    expect(screen.getByText(/数据源降级/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Live catalyst evidence" })).toHaveAttribute(
      "href",
      "https://example.test/filing",
    );

    const demoProps = {
      mode: "demo" as const,
      events: [
        {
          id: "demo",
          category: "演示",
          headline: "Demo catalyst fixture",
          chain: ["A", "B"],
          impactScore: 40,
        },
      ],
      status: "ready" as const,
      overview,
    };
    rerender(<ChineseCatalystIntelligence {...demoProps} />);
    expect(screen.getByText("Demo catalyst fixture")).toBeInTheDocument();
    expect(screen.queryByText("Live catalyst evidence")).not.toBeInTheDocument();
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
    expect(screen.getByText(/极端异常/)).toBeInTheDocument();

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
