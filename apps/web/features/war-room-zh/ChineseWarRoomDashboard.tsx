"use client";

import type { MarketDataMode } from "@war-room/types";
import { AskWarRoom } from "@/components/AskWarRoom";
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
import { chineseCopy } from "@/components/war-room-zh/ChineseCopy";
import { demoHeaderNav, demoMarketData, demoSession } from "@/data/demo-market";
import { AiMarketBriefPanel } from "@/features/home/components/ai-market-brief-panel";
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

function ChineseShellSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section aria-label={title}>
      <h2 className="mb-4 text-lg font-semibold text-ink">{title}</h2>
      {children}
    </section>
  );
}

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
              events={data.catalysts}
              status={catalystsStatus}
              overview={catalystsOverview}
            />
          </div>
          <ChineseShellSection title={chineseCopy.aiBrief}>
            <AiMarketBriefPanel />
          </ChineseShellSection>
          <ChineseShellSection title={chineseCopy.askWarRoom}>
            <AskWarRoom suggestions={data.suggestedQuestions} />
          </ChineseShellSection>
        </div>
      </main>
      <ChineseFooter mode={mode} />
    </div>
  );
}
