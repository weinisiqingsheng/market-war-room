import type { Metadata } from "next";
import { IntelligenceDashboard } from "@/features/intelligence/IntelligenceDashboard";
import { getMarketDataConfig } from "@/lib/market-data/config";
import { getRegimeDataConfig } from "@/lib/regime/config";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Intelligence — Market War Room",
  description:
    "Market War Room Intelligence workspace: regime read, grounded AI brief, anomalies, catalysts and a source-linked Evidence Explorer.",
};

/**
 * /intelligence — V1.1B.
 * Server-side mode reads mirror Overview/Markets; live data is fetched through
 * the canonical hooks. Ask Sakura is intentionally not implemented here.
 */
export default function IntelligencePage() {
  const { mode: marketMode } = getMarketDataConfig();
  const { mode: regimeMode } = getRegimeDataConfig();
  const anomaliesMode = process.env.ANOMALIES_MODE === "live" ? "live" : "demo";
  const catalystsMode = process.env.CATALYSTS_MODE === "live" ? "live" : "demo";
  return (
    <IntelligenceDashboard
      marketMode={marketMode}
      regimeMode={regimeMode}
      anomaliesMode={anomaliesMode}
      catalystsMode={catalystsMode}
    />
  );
}
