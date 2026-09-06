import { HomeDashboard } from "@/features/home/HomeDashboard";
import { getBreadthDataConfig } from "@/lib/breadth/config";
import { getMacroDataConfig } from "@/lib/macro-data/config";
import { getMarketDataConfig } from "@/lib/market-data/config";
import { getRegimeDataConfig } from "@/lib/regime/config";

/**
 * The homepage shell reads MARKET_DATA_MODE / MACRO_DATA_MODE / REGIME_MODE /
 * BREADTH_MODE at request time (server-side), so it must be server-rendered on
 * demand — never statically prerendered with a stale mode baked in. The heavy
 * live data is still fetched client-side.
 */
export const dynamic = "force-dynamic";

export default function HomePage() {
  // Server-side reads of modes (never credentials). Passed as plain props so
  // the client knows demo vs live without any env exposure.
  const { mode } = getMarketDataConfig();
  const { mode: macroMode } = getMacroDataConfig();
  const { mode: regimeMode } = getRegimeDataConfig();
  const { mode: breadthMode } = getBreadthDataConfig();
  const anomaliesMode = process.env.ANOMALIES_MODE === "live" ? "live" : "demo";
  const catalystsMode = process.env.CATALYSTS_MODE === "live" ? "live" : "demo";
  return (
    <HomeDashboard
      mode={mode}
      macroMode={macroMode}
      regimeMode={regimeMode}
      breadthMode={breadthMode}
      anomaliesMode={anomaliesMode}
      catalystsMode={catalystsMode}
    />
  );
}
