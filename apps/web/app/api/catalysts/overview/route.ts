import { NextResponse } from "next/server";
import { MarketDataError } from "@/lib/market-data/errors";
import { logProviderIssue } from "@/lib/market-data/log";
import { buildLiveCatalystsOverview } from "@/lib/catalysts/overview";
import type { CatalystOverview } from "@/lib/catalysts/types";

/**
 * GET /api/catalysts/overview
 *
 * Catalyst Intelligence (catalyst-match-v1): grounded, deterministic matching
 * of Alpaca News + SEC EDGAR + Alpaca Corporate Actions to the current
 * anomaly-v1 candidates. Evidence never uses information published after the
 * anomaly snapshot's delayed-SIP cutoff, and never claims causal certainty.
 *
 * Demo mode → empty demo overview (the demo panel renders design fixtures).
 * Live requires ANOMALIES_MODE=live plus Alpaca market credentials. SEC is
 * disabled until SEC_USER_AGENT is configured. Provider failures degrade only
 * this module — no demo fallback in live mode.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function demoOverview(): CatalystOverview {
  return {
    meta: {
      mode: "demo",
      engineVersion: "catalyst-match-v1",
      anomalyVersion: "anomaly-v1",
      candidateCount: 0,
      matchedCount: 0,
      unmatchedCount: 0,
      asOf: null,
      generatedAt: null,
      effectiveAsOf: null,
      catalystCutoff: null,
      providers: { news: "disabled", sec: "disabled", corporateActions: "disabled" },
    },
    items: [],
  };
}

export async function GET() {
  if (process.env.CATALYSTS_MODE !== "live") {
    return NextResponse.json(demoOverview(), { headers: { "Cache-Control": "no-store" } });
  }
  if (process.env.ANOMALIES_MODE !== "live") {
    return NextResponse.json(
      {
        error: { code: "CONFIG", message: "Catalyst Intelligence live mode requires ANOMALIES_MODE=live." },
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const overview = await buildLiveCatalystsOverview();
    return NextResponse.json(overview, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const isConfig = error instanceof MarketDataError && error.category === "config";
    const status = isConfig ? 503 : 502;
    logProviderIssue(
      isConfig ? "config" : "unknown",
      status,
      "catalysts",
      error instanceof Error ? error.message : "unknown error",
    );
    return NextResponse.json(
      {
        error: {
          code: isConfig ? "CONFIG" : "UPSTREAM",
          message: isConfig
            ? "Catalyst Intelligence requires live Alpaca market data (ANOMALIES_MODE=live)."
            : "Catalyst Intelligence is temporarily unavailable.",
        },
      },
      { status, headers: { "Cache-Control": "no-store" } },
    );
  }
}
