import "server-only";
import type { RegimeOverview } from "@war-room/types";
import { getCachedOverview } from "@/lib/market-data/cache";
import { getMarketDataConfig } from "@/lib/market-data/config";
import { MarketDataError } from "@/lib/market-data/errors";
import { buildMacroOverview } from "@/lib/macro-data/overview";
import { getMacroDataConfig } from "@/lib/macro-data/config";
import { buildRegimeInput } from "./build-input";
import { evaluateRegime } from "./client";
import { getRegimeDataConfig } from "./config";

/**
 * Server-side regime orchestration: normalize market + macro overviews into a
 * RegimeInput, call the Python engine directly, and return a RegimeOverview.
 *
 * Next.js never HTTP-calls its own internal overview endpoints here — it reuses
 * the existing server builders directly (providers stay in Next.js; scoring
 * stays in Python).
 */
export async function buildLiveRegimeOverview(): Promise<RegimeOverview> {
  const marketConfig = getMarketDataConfig();
  const macroConfig = getMacroDataConfig();
  const regimeConfig = getRegimeDataConfig();

  if (marketConfig.mode !== "live") {
    throw new MarketDataError(
      "config",
      "REGIME_MODE=live requires MARKET_DATA_MODE=live",
      503,
      "regime",
    );
  }
  if (macroConfig.mode !== "live") {
    throw new MarketDataError(
      "config",
      "REGIME_MODE=live requires MACRO_DATA_MODE=live",
      503,
      "regime",
    );
  }

  const [market, macro] = await Promise.all([
    getCachedOverview(marketConfig),
    buildMacroOverview(macroConfig),
  ]);

  const payload = buildRegimeInput(market, macro);
  const result = await evaluateRegime(regimeConfig, payload);

  return {
    mode: "live",
    meta: { mode: "live", asOf: result.asOf },
    result,
  };
}
