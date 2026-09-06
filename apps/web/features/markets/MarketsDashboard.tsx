"use client";

import type { MarketDataMode } from "@war-room/types";
import { demoHeaderNav, demoSession } from "@/data/demo-market";
import { Header } from "@/components/Header";
import { useMarketOverview } from "@/features/home/useMarketOverview";
import { useMacroOverview } from "@/features/home/useMacroOverview";
import { useBreadthOverview } from "@/features/home/useBreadthOverview";
import { useAnomaliesOverview } from "@/features/home/useAnomaliesOverview";
import { MarketsWorkspace } from "./MarketsWorkspace";

/**
 * /markets shell — same header/nav + page chrome as Overview, deterministic
 * Markets data workspace in the main slot, no AI modules. Hooks are owned here
 * once and shared by both the header meta and the workspace sections.
 */
export function MarketsDashboard({
  mode,
  macroMode,
  breadthMode,
  anomaliesMode,
}: {
  mode: MarketDataMode;
  macroMode: MarketDataMode;
  breadthMode: MarketDataMode;
  anomaliesMode: MarketDataMode;
}) {
  const market = useMarketOverview(mode);
  const macro = useMacroOverview(macroMode);
  const breadth = useBreadthOverview(breadthMode);
  const anomalies = useAnomaliesOverview(anomaliesMode);

  return (
    <div className="flex min-h-dvh flex-col">
      <Header nav={demoHeaderNav} session={demoSession} mode={market.mode} meta={market.meta} />

      <main className="mx-auto w-full max-w-[1360px] flex-1 px-4 pb-16 sm:px-6">
        <MarketsWorkspace market={market} macro={macro} breadth={breadth} anomalies={anomalies} />
      </main>

      <footer className="border-t border-line bg-white/50 py-6">
        <div className="mx-auto flex w-full max-w-[1360px] flex-col items-center justify-between gap-3 px-4 text-center text-xs text-ink-muted sm:flex-row sm:px-6 sm:text-left">
          <p>Sakura Market Intelligence · Markets workspace</p>
          <p>
            {mode === "live"
              ? "Equity feed and delayed-SIP modules disclose their own freshness — never called live without a qualifier."
              : "Phase V1.1A — Markets navigation live; demo modules stay labeled DEMO."}
          </p>
        </div>
      </footer>
    </div>
  );
}
