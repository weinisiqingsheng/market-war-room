"use client";

import type { MarketDataMode } from "@war-room/types";
import { demoHeaderNav, demoMarketData, demoSession } from "@/data/demo-market";
import { AiMarketBriefPanel } from "./components/ai-market-brief-panel";
import { AskWarRoom } from "@/components/AskWarRoom";
import { CatalystIntelligence } from "@/components/CatalystIntelligence";
import { CatalystIntelligenceLive } from "@/components/CatalystIntelligenceLive";
import { DataBanner } from "@/components/DataBanner";
import { Header } from "@/components/Header";
import { MacroPulse } from "@/components/MacroPulse";
import { MarketAnomaliesCard } from "@/components/MarketAnomaliesCard";
import { MarketBreadthCard } from "@/components/MarketBreadthCard";
import { MarketPulse } from "@/components/MarketPulse";
import { MarketRegimeCard } from "@/components/MarketRegimeCard";
import { SakuraLogo } from "@/components/SakuraLogo";
import { SectorRotation } from "@/components/SectorRotation";
import { useMacroOverview } from "./useMacroOverview";
import { useMarketOverview } from "./useMarketOverview";
import { useRegimeOverview } from "./useRegimeOverview";
import { useBreadthOverview } from "./useBreadthOverview";
import { useAnomaliesOverview } from "./useAnomaliesOverview";
import { useCatalystsOverview } from "./useCatalystsOverview";

/**
 * Homepage assembly. Section order is the approved information architecture
 * and must not change:
 *
 *   Header → Market Regime → Market Pulse → Macro Pulse →
 *   Sector Rotation + Market Breadth → Anomalies + Catalysts →
 *   AI Market Brief → Ask War Room
 *
 * Phase 2: Macro Pulse is independently live (MACRO_DATA_MODE) through its own
 * multi-provider pipeline; Market Pulse/Sector/header status follow the
 * existing MARKET_DATA_MODE. Phase 3: Market Regime goes live when
 * REGIME_MODE=live (deterministic Python engine). Everything else remains demo.
 */
export function HomeDashboard({
  mode,
  macroMode,
  regimeMode = "demo",
  breadthMode = "demo",
  anomaliesMode = "demo",
  catalystsMode = "demo",
}: {
  mode: MarketDataMode;
  macroMode: MarketDataMode;
  regimeMode?: MarketDataMode;
  breadthMode?: MarketDataMode;
  anomaliesMode?: MarketDataMode;
  catalystsMode?: MarketDataMode;
}) {
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
  const {
    status: catalystsStatus,
    overview: catalystsOverview,
  } = useCatalystsOverview(catalystsMode);
  const data = demoMarketData;
  const isLive = mode === "live";
  const feed = meta?.feed ?? null;

  const spy = indices?.find((index) => index.ticker === "SPY") ?? null;
  const benchmark = {
    ticker: "SPY",
    dailyReturnPct: spy?.changePct ?? data.benchmark.dailyReturnPct,
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <Header nav={demoHeaderNav} session={demoSession} mode={mode} meta={meta} />

      <main className="mx-auto w-full max-w-[1360px] flex-1 px-4 pb-16 sm:px-6">
        <div className="pt-4">
          <DataBanner mode={mode} feed={feed} />
        </div>

        <div className="mt-6 space-y-10">
          {/* 1 · Market Regime (live engine in regimeMode=live) */}
          <MarketRegimeCard
            mode={regimeMode}
            status={regimeStatus}
            regime={regime}
            regimeDrivers={regimeDrivers}
            result={regimeResult}
            asOf={regimeAsOf}
          />

          {/* 2 · Market Pulse (live in live mode) */}
          <MarketPulse
            indices={indices}
            status={status}
            mode={mode}
            feed={feed}
            stale={meta?.stale ?? false}
          />

          {/* 3 · Macro Pulse (live in macro live mode) */}
          <MacroPulse
            signals={macroSignals}
            status={macroStatus}
            mode={macroMode}
            meta={macroMeta}
          />

          {/* 4 · Sector Rotation (live in live mode) + Market Breadth (demo) */}
          <div className="grid items-stretch gap-6 xl:grid-cols-2 [&>*]:min-w-0">
            <SectorRotation
              sectors={sectors}
              status={status}
              mode={mode}
              feed={feed}
              stale={meta?.stale ?? false}
              benchmark={benchmark}
            />
            <MarketBreadthCard
              mode={breadthMode}
              status={breadthStatus}
              breadth={breadthDemo}
              overview={breadthOverview}
            />
          </div>

          {/* 5 · Market Anomalies (scanner in anomaliesMode=live) + Catalyst Intelligence */}
          <div className="grid items-stretch gap-6 xl:grid-cols-2 [&>*]:min-w-0">
            <MarketAnomaliesCard
              mode={anomaliesMode}
              status={anomaliesStatus}
              anomalies={anomaliesDemo}
              overview={anomaliesOverview}
            />
            {catalystsMode === "live" && catalystsStatus === "ready" && catalystsOverview ? (
              <CatalystIntelligenceLive overview={catalystsOverview} />
            ) : (
              <CatalystIntelligence events={data.catalysts} status={catalystsStatus} />
            )}
          </div>

          {/* 6 · AI Market Brief (grounded API card for demo + live) */}
          <AiMarketBriefPanel />

          {/* 7 · Ask War Room (preview) */}
          <AskWarRoom suggestions={data.suggestedQuestions} />
        </div>
      </main>

      <footer className="border-t border-line bg-white/50 py-6">
        <div className="mx-auto flex w-full max-w-[1360px] flex-col items-center justify-between gap-3 px-4 text-center sm:flex-row sm:px-6 sm:text-left">
          <p className="flex items-center gap-2 text-xs text-ink-muted">
            <SakuraLogo size={16} />
            Market War Room · Sakura Market Intelligence
          </p>
          <p className="text-xs text-ink-muted">
            {isLive
              ? "Live data: Alpaca IEX (not consolidated SIP). Demo modules labeled DEMO."
              : "Phase 2 — design preview. Demo data only; not investment advice."}
          </p>
        </div>
      </footer>
    </div>
  );
}
