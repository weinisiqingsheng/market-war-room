import { NextResponse } from "next/server";
import { MarketDataError } from "@/lib/market-data/errors";
import { logProviderIssue } from "@/lib/market-data/log";
import { buildDemoAnomaliesOverview } from "@/lib/anomalies/demo";
import { buildLiveAnomaliesOverview } from "@/lib/anomalies/overview";
import {
  ANOMALY_UNIVERSE_IDS,
  DEFAULT_ANOMALY_UNIVERSE_ID,
  resolveAnomalyUniverse,
} from "@/lib/anomalies/universe/registry";
import type { AnomalyUniverseId } from "@/lib/anomalies/universe/types";

/**
 * GET /api/anomalies/overview?universe=sp500|nasdaq100
 *
 * Canonical anomaly-v1 scanner over a versioned universe from Alpaca
 * delayed-SIP data (15-minute delayed; never labeled real-time and never
 * full-US-market). Missing `universe` → `sp500` (default). An explicit
 * unsupported value is rejected with a safe 400 — never silently mapped.
 *
 * Universe selection changes candidate membership only; scoring, severity and
 * ranking stay canonically anomaly-v1.
 *
 * Demo mode → deterministic demo fixture for the selected universe. Live mode
 * requires Alpaca market configuration. On failure only Market Anomalies
 * becomes unavailable — Market Pulse / Macro / Regime / Breadth keep working,
 * with no demo fallback.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" } as const;

function readUniverse(
  url: string | undefined,
): { ok: true; universeId: AnomalyUniverseId } | { ok: false } {
  let raw: string | null = null;
  if (url) {
    try {
      raw = new URL(url).searchParams.get("universe");
    } catch {
      raw = null;
    }
  }
  if (raw === null) return { ok: true, universeId: DEFAULT_ANOMALY_UNIVERSE_ID };
  const universe = resolveAnomalyUniverse(raw);
  return universe ? { ok: true, universeId: universe.id } : { ok: false };
}

export async function GET(request: Request) {
  const parsed = readUniverse(request.url);
  if (!parsed.ok) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_UNIVERSE",
          message: `Unsupported anomaly universe. Supported values: ${ANOMALY_UNIVERSE_IDS.join(", ")}.`,
        },
      },
      { status: 400, headers: noStore },
    );
  }

  if (process.env.ANOMALIES_MODE !== "live") {
    return NextResponse.json(buildDemoAnomaliesOverview(parsed.universeId), {
      headers: noStore,
    });
  }

  try {
    const overview = await buildLiveAnomaliesOverview(parsed.universeId);
    return NextResponse.json(overview, { headers: noStore });
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
      { status, headers: noStore },
    );
  }
}
