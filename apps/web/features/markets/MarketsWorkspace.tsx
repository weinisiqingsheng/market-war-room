"use client";

import { MarketPulse } from "@/components/MarketPulse";
import { SectorRotation } from "@/components/SectorRotation";
import { MacroPulse } from "@/components/MacroPulse";
import { MarketBreadthCard } from "@/components/MarketBreadthCard";
import { MarketAnomaliesCard } from "@/components/MarketAnomaliesCard";
import type { MarketOverviewState } from "@/features/home/useMarketOverview";
import type { MacroOverviewState } from "@/features/home/useMacroOverview";
import type { BreadthOverviewState } from "@/features/home/useBreadthOverview";
import type { AnomaliesOverviewState } from "@/features/home/useAnomaliesOverview";

/**
 * /markets data workspace (V1.1A) — pure section assembly.
 *
 * Overview asks "what is the market doing today?"; Markets answers "what are
 * the actual numbers?" — indexes, sector rotation, macro conditions, breadth
 * and S&P 500 anomalies. Deterministic data only: no AI brief, no Ask War Room.
 * State is owned once by MarketsDashboard, so no endpoint is fetched twice.
 */
export interface MarketsWorkspaceProps {
  market: MarketOverviewState;
  macro: MacroOverviewState;
  breadth: BreadthOverviewState;
  anomalies: AnomaliesOverviewState;
}

export function MarketsWorkspace({ market, macro, breadth, anomalies }: MarketsWorkspaceProps) {
  const spy = market.indices?.find((index) => index.ticker === "SPY") ?? null;
  const benchmark = {
    ticker: "SPY",
    dailyReturnPct: spy?.changePct ?? null,
  };

  const anyLive = [market.mode, macro.mode, breadth.mode, anomalies.mode].some((m) => m === "live");
  return (
    <div className="mt-6 space-y-10">
      {/* Markets page header — workspace intent + safe feed semantics. */}
      <header className="border-b border-line pb-5">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-deep">
              Market Data Workspace
            </p>
            <h2
              id="markets-page-title"
              className="mt-1 text-2xl font-semibold tracking-tight text-ink"
            >
              Markets
            </h2>
            <p className="mt-1 text-sm text-ink-secondary">
              Live market structure, rotation, breadth and abnormal moves.
            </p>
          </div>

          {anyLive ? (
            <ul aria-label="Data feed semantics" className="flex flex-wrap items-center gap-2">
              {market.mode === "live" && market.status === "ready" && market.meta?.feed ? (
                <FeedChip>{`Equities · Live · ${market.meta.feed.toUpperCase()}`}</FeedChip>
              ) : null}
              {macro.mode === "live" && macro.status === "ready" ? (
                <FeedChip>Macro · Multi-source</FeedChip>
              ) : null}
              {breadth.mode === "live" && breadth.status === "ready" ? (
                <FeedChip>Breadth · 15M Delayed SIP</FeedChip>
              ) : null}
              {anomalies.mode === "live" && anomalies.status === "ready" ? (
                <FeedChip>Anomalies · 15M Delayed SIP</FeedChip>
              ) : null}
            </ul>
          ) : (
            <span className="rounded-full border border-line bg-white/70 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
              Demo · Design Preview
            </span>
          )}
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-ink-muted">
          Feed semantics are labeled per module. Delayed-SIP modules (breadth, anomalies) are never
          called LIVE, and FRED macro observations are daily — not realtime.
        </p>
      </header>

      {/* 1 · Major Indexes */}
      <MarketPulse
        indices={market.indices}
        status={market.status}
        mode={market.mode}
        feed={market.meta?.feed ?? null}
        stale={market.meta?.stale ?? false}
        title="Major Indexes"
        kicker="Major Indexes"
      />

      {/* 2 · Sector Rotation — full-width, all 11 sector ETFs. */}
      <SectorRotation
        sectors={market.sectors}
        status={market.status}
        mode={market.mode}
        feed={market.meta?.feed ?? null}
        stale={market.meta?.stale ?? false}
        benchmark={benchmark}
      />

      {/* 3 · Macro Dashboard — six cells, per-source cadence. */}
      <MacroPulse
        signals={macro.signals}
        status={macro.status}
        mode={macro.mode}
        meta={macro.meta}
        title="Macro Dashboard"
      />

      {/* 4 · S&P 500 breadth — breadth-v1 output as-is. */}
      <MarketBreadthCard
        mode={breadth.mode}
        status={breadth.status}
        breadth={breadth.demo}
        overview={breadth.overview}
      />

      {/* 5 · S&P 500 anomalies — anomaly-v1 output as-is, dynamically scanned. */}
      {anomalies.mode === "live" && anomalies.overview ? (
        <p
          role="note"
          className="rounded-xl border border-line bg-white/60 px-3 py-2 text-xs leading-relaxed text-ink-secondary"
        >
          Scanning the S&amp;P 500 universe dynamically for statistically unusual daily moves — this
          is not a fixed watchlist. Universe: {anomalies.overview.universe.name} ·{" "}
          {anomalies.overview.universeCount} securities in the current snapshot · anomaly-v1.
        </p>
      ) : null}
      <MarketAnomaliesCard
        mode={anomalies.mode}
        status={anomalies.status}
        anomalies={anomalies.demo}
        overview={anomalies.overview}
      />
    </div>
  );
}

function FeedChip({ children }: { children: React.ReactNode }) {
  return (
    <li className="rounded-full border border-line bg-white/70 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-ink-secondary">
      {children}
    </li>
  );
}
