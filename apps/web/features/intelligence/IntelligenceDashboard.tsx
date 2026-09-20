"use client";

import { useCallback, useState } from "react";
import type { MarketDataMode } from "@war-room/types";
import { demoHeaderNav, demoSession, demoMarketData } from "@/data/demo-market";
import { Header } from "@/components/Header";
import { MarketRegimeCard } from "@/components/MarketRegimeCard";
import { AiMarketBriefPanel } from "@/features/home/components/ai-market-brief-panel";
import { useMarketOverview } from "@/features/home/useMarketOverview";
import { useRegimeOverview } from "@/features/home/useRegimeOverview";
import { useAnomaliesOverview } from "@/features/home/useAnomaliesOverview";
import { useCatalystsOverview } from "@/features/home/useCatalystsOverview";
import { useEvidenceExplorer } from "./useEvidenceExplorer";
import { EvidenceExplorer } from "./components/EvidenceExplorer";
import { IntelligenceAnomalies } from "./components/IntelligenceAnomalies";
import { IntelligenceCatalysts } from "./components/IntelligenceCatalysts";

/**
 * /intelligence — analyst investigation workspace.
 *
 * Reuses the same regime / anomalies / catalysts / AI Brief / evidence that
 * Overview and Markets already consume; adds a read-only Evidence Explorer that
 * shows the exact model-facing projection (never raw provider data). Ask Sakura
 * is explicitly NOT part of this phase.
 */
export function IntelligenceDashboard({
  marketMode,
  regimeMode,
  anomaliesMode,
  catalystsMode,
}: {
  marketMode: MarketDataMode;
  regimeMode: MarketDataMode;
  anomaliesMode: MarketDataMode;
  catalystsMode: MarketDataMode;
}) {
  const market = useMarketOverview(marketMode);
  const regime = useRegimeOverview(regimeMode);
  const anomalies = useAnomaliesOverview(anomaliesMode);
  const catalysts = useCatalystsOverview(catalystsMode);
  const evidence = useEvidenceExplorer();

  const [aiFingerprint, setAiFingerprint] = useState<string | null>(null);
  const [focusRefs, setFocusRefs] = useState<string[]>([]);

  const handleFingerprint = useCallback((fingerprint: string | null) => {
    setAiFingerprint(fingerprint);
  }, []);

  const handleShowEvidence = useCallback((refs: string[]) => {
    setFocusRefs(refs);
  }, []);

  const handleAnomalyTrace = useCallback((ticker: string) => {
    setFocusRefs([`anomaly.${ticker}`, `catalyst.${ticker}.primary`, `catalyst.${ticker}.none`]);
  }, []);

  const handleClearFocus = useCallback(() => {
    setFocusRefs([]);
  }, []);

  return (
    <div className="flex min-h-dvh flex-col">
      <Header nav={demoHeaderNav} session={demoSession} mode={market.mode} meta={market.meta} />

      <main className="mx-auto w-full max-w-[1360px] flex-1 px-4 pb-16 sm:px-6">
        <div className="mt-6 space-y-10">
          <header className="border-b border-line pb-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-deep">
              Analyst Investigation Workspace
            </p>
            <h2
              id="intelligence-page-title"
              className="mt-1 text-2xl font-semibold tracking-tight text-ink"
            >
              Intelligence
            </h2>
            <p className="mt-1 text-sm text-ink-secondary">
              Grounded market interpretation, abnormal moves, catalysts and evidence.
            </p>
            <p className="mt-2 text-[11px] font-medium uppercase tracking-wider text-ink-muted">
              Deterministic signals · grounded AI · source-linked evidence
            </p>
          </header>

          <MarketRegimeCard
            mode={regime.mode}
            status={regime.status}
            regime={regime.regime}
            regimeDrivers={regime.regimeDrivers}
            result={regime.result}
            asOf={regime.asOf}
          />

          <AiMarketBriefPanel
            onShowEvidence={handleShowEvidence}
            onFingerprintChange={handleFingerprint}
          />

          <div className="grid items-start gap-6 xl:grid-cols-2">
            <div className="flex min-w-0 flex-col gap-10">
              <IntelligenceAnomalies
                mode={anomalies.mode}
                status={anomalies.status}
                demo={anomalies.demo}
                overview={anomalies.overview}
                onSelectTicker={handleAnomalyTrace}
              />
              <IntelligenceCatalysts
                mode={catalystsMode}
                status={catalysts.status}
                overview={catalysts.overview}
                demoEvents={demoMarketData.catalysts}
              />
            </div>

            <EvidenceExplorer
              data={evidence.data?.status === "ok" ? evidence.data : null}
              status={evidence.status}
              onRefresh={evidence.refresh}
              aiFingerprint={aiFingerprint}
              focusRefs={focusRefs}
              onClearFocus={handleClearFocus}
            />
          </div>
        </div>
      </main>

      <footer className="border-t border-line bg-white/50 py-6">
        <div className="mx-auto flex w-full max-w-[1360px] flex-col items-center justify-between gap-3 px-4 text-center text-xs text-ink-muted sm:flex-row sm:px-6 sm:text-left">
          <p>Sakura Market Intelligence · Intelligence workspace</p>
          <p>Evidence Explorer is deterministic and read-only — no new AI generation.</p>
        </div>
      </footer>
    </div>
  );
}
