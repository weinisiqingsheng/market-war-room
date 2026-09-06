import type { Metadata } from "next";
import { MarketsDashboard } from "@/features/markets/MarketsDashboard";
import { getBreadthDataConfig } from "@/lib/breadth/config";
import { getMacroDataConfig } from "@/lib/macro-data/config";
import { getMarketDataConfig } from "@/lib/market-data/config";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Markets — Market War Room",
  description:
    "Market War Room Markets workspace: major indexes, sector rotation, macro dashboard, S&P 500 breadth and anomaly scan — deterministic market data.",
};

/**
 * /markets — data-first Markets workspace (V1.1A).
 *
 * Server-side mode reads mirror the Overview page; heavy live data is fetched
 * client-side through the same canonical hooks. The Markets page never calls the
 * AI brief endpoint and contains no AI narrative.
 */
export default function MarketsPage() {
  const { mode } = getMarketDataConfig();
  const { mode: macroMode } = getMacroDataConfig();
  const { mode: breadthMode } = getBreadthDataConfig();
  const anomaliesMode = process.env.ANOMALIES_MODE === "live" ? "live" : "demo";
  return (
    <MarketsDashboard
      mode={mode}
      macroMode={macroMode}
      breadthMode={breadthMode}
      anomaliesMode={anomaliesMode}
    />
  );
}
