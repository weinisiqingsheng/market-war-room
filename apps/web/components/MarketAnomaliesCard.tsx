import type { MarketAnomaly, MarketDataMode } from "@/types/market";
import type { AnomalyOverview } from "@/lib/anomalies/types";
import { MarketAnomalies as MarketAnomaliesLegacy } from "./MarketAnomalies";
import { LiveAnomaliesView } from "./LiveAnomaliesView";

export type AnomaliesCardStatus = "loading" | "ready" | "error";

interface MarketAnomaliesCardProps {
  mode: MarketDataMode;
  status: AnomaliesCardStatus;
  anomalies: MarketAnomaly[] | null;
  overview: AnomalyOverview | null;
  asOf?: string | null;
}

/**
 * Market Anomalies card. Demo mode keeps the legacy demo fixture (DEMO);
 * live mode renders the deterministic S&P 500 delayed-SIP scanner output with
 * the "15M Delayed SIP" provenance (never labeled LIVE).
 */
export function MarketAnomaliesCard({
  mode,
  status,
  anomalies,
  overview,
}: MarketAnomaliesCardProps) {
  if (mode === "demo") {
    if (!anomalies) return null;
    return <MarketAnomaliesLegacy anomalies={anomalies} />;
  }

  if (status === "loading") {
    return (
      <section id="market-anomalies" aria-labelledby="market-anomalies-heading" aria-busy="true">
        <div className="animate-pulse rounded-[20px] border border-line bg-surface p-5 shadow-card">
          <div className="h-3 w-36 rounded bg-line" />
          <div className="mt-6 space-y-3">
            <div className="h-16 rounded-xl bg-line" />
            <div className="h-16 rounded-xl bg-line" />
          </div>
        </div>
      </section>
    );
  }

  if (status === "error" || !overview) {
    return (
      <section id="market-anomalies" aria-labelledby="market-anomalies-heading">
        <div className="flex h-full flex-col rounded-[20px] border border-line bg-surface p-5 shadow-card">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
            Market Anomalies
          </p>
          <p className="mt-4 text-sm leading-relaxed text-ink-secondary">
            Market Anomalies is temporarily unavailable. Other modules keep working and demo figures
            are never substituted.
          </p>
          <span className="mt-4 inline-flex items-center rounded-full bg-warn-bg px-3 py-1 text-xs font-semibold text-warn">
            Anomalies unavailable
          </span>
        </div>
      </section>
    );
  }

  return <LiveAnomaliesView overview={overview} />;
}
