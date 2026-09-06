import { NextResponse } from "next/server";
import { MarketDataError } from "@/lib/market-data/errors";
import { logProviderIssue } from "@/lib/market-data/log";
import { demoAnomaliesOverview } from "@/lib/anomalies/demo";
import { buildLiveAnomaliesOverview } from "@/lib/anomalies/overview";

/**
 * GET /api/anomalies/overview
 *
 * S&P 500 statistical anomaly scanner from Alpaca delayed-SIP data
 * (15-minute delayed; never labeled real-time and never full-US-market).
 *
 * Demo mode → deterministic demo fixture. Live mode requires Alpaca market
 * configuration. On failure only Market Anomalies becomes unavailable —
 * Market Pulse / Macro / Regime / Breadth keep working, with no demo fallback.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (process.env.ANOMALIES_MODE !== "live") {
    return NextResponse.json(demoAnomaliesOverview, { headers: { "Cache-Control": "no-store" } });
  }

  try {
    const overview = await buildLiveAnomaliesOverview();
    return NextResponse.json(overview, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const isConfig = error instanceof MarketDataError && error.category === "config";
    const status = isConfig ? 503 : 502;
    logProviderIssue(
      isConfig ? "config" : "unknown",
      status,
      "anomalies",
      error instanceof Error ? error.message : "unknown error",
    );
    return NextResponse.json(
      {
        error: {
          code: isConfig ? "CONFIG" : "UPSTREAM",
          message: isConfig
            ? "Market Anomalies requires live Alpaca market data."
            : "Market Anomalies is temporarily unavailable.",
        },
      },
      { status, headers: { "Cache-Control": "no-store" } },
    );
  }
}
