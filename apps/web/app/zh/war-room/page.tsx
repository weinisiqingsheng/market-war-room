import { ChineseWarRoomDashboard } from "@/features/war-room-zh/ChineseWarRoomDashboard";
import { getBreadthDataConfig } from "@/lib/breadth/config";
import { getMacroDataConfig } from "@/lib/macro-data/config";
import { getMarketDataConfig } from "@/lib/market-data/config";
import { getRegimeDataConfig } from "@/lib/regime/config";

export const dynamic = "force-dynamic";

export default function ChineseWarRoomPage() {
  const { mode } = getMarketDataConfig();
  const { mode: macroMode } = getMacroDataConfig();
  const { mode: regimeMode } = getRegimeDataConfig();
  const { mode: breadthMode } = getBreadthDataConfig();
  const anomaliesMode = process.env.ANOMALIES_MODE === "live" ? "live" : "demo";
  const catalystsMode = process.env.CATALYSTS_MODE === "live" ? "live" : "demo";

  return (
    <ChineseWarRoomDashboard
      mode={mode}
      macroMode={macroMode}
      regimeMode={regimeMode}
      breadthMode={breadthMode}
      anomaliesMode={anomaliesMode}
      catalystsMode={catalystsMode}
    />
  );
}
