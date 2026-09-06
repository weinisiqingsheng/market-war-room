import { NextResponse } from "next/server";
import { MarketDataError } from "@/lib/market-data/errors";
import { logProviderIssue } from "@/lib/market-data/log";
import { getBreadthDataConfig } from "@/lib/breadth/config";
import { demoBreadthOverview } from "@/lib/breadth/demo";
import { buildLiveBreadthOverview } from "@/lib/breadth/overview";

/**
 * GET /api/breadth/overview
 *
 * S&P 500 breadth from Alpaca delayed-SIP data (15-minute delayed, never
 * mislabeled as full-market real-time breadth).
 *
 * Demo mode → deterministic demo fixture.
 * Live mode → requires Alpaca credentials. On failure only Market Breadth is
 * unavailable — Market Pulse / Macro / Regime keep working, and there is never
 * a silent fallback to the demo score.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const config = getBreadthDataConfig();

  if (config.mode === "demo") {
    return NextResponse.json(demoBreadthOverview, {
      headers: { "Cache-Control": "no-store" },
    });
  }

  try {
    const overview = await buildLiveBreadthOverview();
    return NextResponse.json(overview, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const isConfig = error instanceof MarketDataError && error.category === "config";
    const status = isConfig ? 503 : 502;

    logProviderIssue(
      isConfig ? "config" : "unknown",
      status,
      "breadth",
      error instanceof Error ? error.message : "unknown error",
    );

    return NextResponse.json(
      {
        error: {
          code: isConfig ? "CONFIG" : "UPSTREAM",
          message: isConfig
            ? "Market Breadth requires Alpaca credentials."
            : "Market Breadth is temporarily unavailable.",
        },
      },
      { status, headers: { "Cache-Control": "no-store" } },
    );
  }
}
