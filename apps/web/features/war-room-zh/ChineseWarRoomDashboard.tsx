"use client";

import type { MarketDataMode } from "@war-room/types";
import type { CatalystEvent } from "@/types/market";
import { ChineseAskWarRoom } from "@/components/war-room-zh/ChineseAskWarRoom";
import { ChineseCatalystIntelligence } from "@/components/war-room-zh/ChineseCatalystIntelligence";
import { ChineseDataBanner } from "@/components/war-room-zh/ChineseDataBanner";
import { ChineseFooter } from "@/components/war-room-zh/ChineseFooter";
import { ChineseHeader } from "@/components/war-room-zh/ChineseHeader";
import { ChineseMacroPulse } from "@/components/war-room-zh/ChineseMacroPulse";
import { ChineseMarketAnomaliesCard } from "@/components/war-room-zh/ChineseMarketAnomaliesCard";
import { ChineseMarketBreadthCard } from "@/components/war-room-zh/ChineseMarketBreadthCard";
import { ChineseMarketPulse } from "@/components/war-room-zh/ChineseMarketPulse";
import { ChineseMarketRegimeCard } from "@/components/war-room-zh/ChineseMarketRegimeCard";
import { ChineseSectorRotation } from "@/components/war-room-zh/ChineseSectorRotation";
import { demoHeaderNav, demoMarketData, demoSession } from "@/data/demo-market";
import { ChineseAiMarketBriefCard } from "@/components/war-room-zh/ChineseAiMarketBriefCard";
import { useAnomaliesOverview } from "@/features/home/useAnomaliesOverview";
import { useBreadthOverview } from "@/features/home/useBreadthOverview";
import { useCatalystsOverview } from "@/features/home/useCatalystsOverview";
import { useMacroOverview } from "@/features/home/useMacroOverview";
import { useMarketOverview } from "@/features/home/useMarketOverview";
import { useRegimeOverview } from "@/features/home/useRegimeOverview";

type DashboardProps = {
  mode: MarketDataMode;
  macroMode: MarketDataMode;
  regimeMode?: MarketDataMode;
  breadthMode?: MarketDataMode;
  anomaliesMode?: MarketDataMode;
  catalystsMode?: MarketDataMode;
};

const CHINESE_SUGGESTION_LABELS: Record<string, string> = {
  "fico-anomaly": "为什么 FICO 跌幅这么大？",
  "breadth-weak": "市场广度是否偏弱？",
  "regime-cautious": "为什么市场环境偏谨慎？",
  "unusual-stocks": "今天最异常的股票有哪些？",
};

/** Localized presentation of the approved demo catalyst fixtures (same ids/scores). */
const CHINESE_DEMO_CATALYSTS: CatalystEvent[] = [
  {
    id: "iran-energy",
    category: "伊朗 / 能源",
    headline: "美伊紧张局势升级",
    chain: ["油价 +2.5%", "通胀风险上升", "10Y +8 bp", "增长估值承压"],
    impactScore: 88,
  },
  {
    id: "ma-ai-infra",
    category: "并购 / AI 基建",
    headline: "SLB → Kelvion 收购",
    chain: ["41 亿美元交易", "数据中心敞口上升", "SLB 相对强势"],
    impactScore: 81,
  },
];

/** Chinese route shell. Localized cards are introduced in the following task. */
export function ChineseWarRoomDashboard({
  mode,
  macroMode,
  regimeMode = "demo",
  breadthMode = "demo",
  anomaliesMode = "demo",
  catalystsMode = "demo",
}: DashboardProps) {
  const { meta, indices, sectors, status } = useMarketOverview(mode);
  const {
    meta: macroMeta,
    signals: macroSignals,
    status: macroStatus,
  } = useMacroOverview(macroMode);
  const {
    status: regimeStatus,
    regime,
    regimeDrivers,
    result: regimeResult,
    asOf: regimeAsOf,
  } = useRegimeOverview(regimeMode);
  const {
    status: breadthStatus,
    demo: breadthDemo,
    overview: breadthOverview,
  } = useBreadthOverview(breadthMode);
  const {
    status: anomaliesStatus,
    demo: anomaliesDemo,
    overview: anomaliesOverview,
  } = useAnomaliesOverview(anomaliesMode);
  const { status: catalystsStatus, overview: catalystsOverview } =
    useCatalystsOverview(catalystsMode);
  const data = demoMarketData;
  const feed = meta?.feed ?? null;
  const spy = indices?.find((index) => index.ticker === "SPY") ?? null;
  const benchmark = {
    ticker: "SPY",
    dailyReturnPct: spy?.changePct ?? data.benchmark.dailyReturnPct,
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <ChineseHeader nav={demoHeaderNav} session={demoSession} mode={mode} meta={meta} />
      <main className="mx-auto w-full max-w-[1360px] flex-1 px-4 pb-16 sm:px-6">
        <div className="pt-4">
          <ChineseDataBanner mode={mode} feed={feed} />
        </div>
        <div className="mt-6 space-y-10">
          <ChineseMarketRegimeCard
            mode={regimeMode}
            status={regimeStatus}
            regime={regime}
            regimeDrivers={regimeDrivers}
            result={regimeResult}
            asOf={regimeAsOf}
          />
          <ChineseMarketPulse
            indices={indices}
            status={status}
            mode={mode}
            feed={feed}
            stale={meta?.stale ?? false}
          />
          <ChineseMacroPulse
            signals={macroSignals}
            status={macroStatus}
            mode={macroMode}
            meta={macroMeta}
          />
          <div className="grid items-stretch gap-6 xl:grid-cols-2 [&>*]:min-w-0">
            <ChineseSectorRotation
              sectors={sectors}
              status={status}
              mode={mode}
              feed={feed}
              stale={meta?.stale ?? false}
              benchmark={benchmark}
            />
            <ChineseMarketBreadthCard
              mode={breadthMode}
              status={breadthStatus}
              breadth={breadthDemo}
              overview={breadthOverview}
            />
          </div>
          <div className="grid items-stretch gap-6 xl:grid-cols-2 [&>*]:min-w-0">
            <ChineseMarketAnomaliesCard
              mode={anomaliesMode}
              status={anomaliesStatus}
              anomalies={anomaliesDemo}
              overview={anomaliesOverview}
            />
            <ChineseCatalystIntelligence
              mode={catalystsMode}
              events={CHINESE_DEMO_CATALYSTS}
              status={catalystsStatus}
              overview={catalystsOverview}
            />
          </div>
          <ChineseAiMarketBriefCard />
          <ChineseAskWarRoom
            suggestions={data.suggestedQuestions.map((question) => ({
              ...question,
              label: CHINESE_SUGGESTION_LABELS[question.id] ?? question.label,
            }))}
          />
        </div>
      </main>
      <ChineseFooter mode={mode} />
    </div>
  );
}
