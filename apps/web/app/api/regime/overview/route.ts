import { NextResponse } from "next/server";
import { MarketDataError } from "@/lib/market-data/errors";
import { logProviderIssue } from "@/lib/market-data/log";
import { demoRegimeOverview } from "@/lib/regime/demo";
import { getRegimeDataConfig } from "@/lib/regime/config";
import { buildLiveRegimeOverview } from "@/lib/regime/overview";

/**
 * GET /api/regime/overview
 *
 * Returns a normalized RegimeOverview (mode, meta, result) — never credentials,
 * never raw provider payloads, never internal stack traces.
 *
 * Demo mode → deterministic demo fixture (no analytics service required).
 * Live mode → orchestrates live market + macro data into the Python engine.
 * Analytics failure → 502 and the UI shows "Market Regime unavailable" (the
 * Market/Macro Pulse sections keep working — no full-page failure, and never a
 * silent fallback to the demo score).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const config = getRegimeDataConfig();

  if (config.mode === "demo") {
    return NextResponse.json(demoRegimeOverview, {
      headers: { "Cache-Control": "no-store" },
    });
  }

  try {
    const overview = await buildLiveRegimeOverview();
    return NextResponse.json(overview, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const isConfig = error instanceof MarketDataError && error.category === "config";
    const status = isConfig ? 503 : 502;

    logProviderIssue(
      isConfig ? "config" : "unknown",
      status,
      "regime",
      error instanceof Error ? error.message : "unknown error",
    );

    return NextResponse.json(
      {
        error: {
          code: isConfig ? "CONFIG" : "UPSTREAM",
          message: isConfig
            ? "Regime engine requires live market and macro data."
            : "Market Regime is temporarily unavailable.",
        },
      },
      { status, headers: { "Cache-Control": "no-store" } },
    );
  }
}
