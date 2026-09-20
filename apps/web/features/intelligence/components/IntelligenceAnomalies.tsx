import type { MarketDataMode } from "@war-room/types";
import type { MarketAnomaly } from "@/types/market";
import type { AnomalyOverview } from "@/lib/anomalies/types";
import { MarketAnomaliesCard } from "@/components/MarketAnomaliesCard";
import { LiveAnomaliesView } from "@/components/LiveAnomaliesView";

/**
 * Intelligence anomaly panel. Live ready state shows anomaly-v1 Top Overall
 * with an optional "Trace evidence" control; every other state reuses the
 * canonical card (loading skeleton / honest unavailable / labeled demo).
 */
export function IntelligenceAnomalies({
  mode,
  status,
  demo,
  overview,
  onSelectTicker,
}: {
  mode: MarketDataMode;
  status: "loading" | "ready" | "error";
  demo: MarketAnomaly[] | null;
  overview: AnomalyOverview | null;
  onSelectTicker: (ticker: string) => void;
}) {
  if (mode === "live" && status === "ready" && overview) {
    return <LiveAnomaliesView overview={overview} onSelectTicker={onSelectTicker} />;
  }
  return <MarketAnomaliesCard mode={mode} status={status} anomalies={demo} overview={overview} />;
}
