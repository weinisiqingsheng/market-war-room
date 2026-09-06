import { NextResponse } from "next/server";
import type { MarketDataMeta } from "@war-room/types";
import { getCachedOverview } from "@/lib/market-data/cache";
import { getMarketDataConfig } from "@/lib/market-data/config";
import { MarketDataError } from "@/lib/market-data/errors";
import { logProviderIssue } from "@/lib/market-data/log";
import { buildDemoOverview } from "@/lib/market-data/overview";

/**
 * GET /api/market/overview
 *
 * Returns normalized Market War Room domain data (meta, indices, sectors) —
 * never raw Alpaca JSON and never any credential material. Demo mode returns
 * the typed demo fixtures; live mode fetches through the provider boundary.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const config = getMarketDataConfig();

  if (config.mode === "demo") {
    return NextResponse.json(buildDemoOverview(), {
      headers: { "Cache-Control": "no-store" },
    });
  }

  if (!config.apiKeyId || !config.apiSecretKey) {
    logProviderIssue("config", 503, "alpaca", "ALPACA credentials are not configured");
    return NextResponse.json(
      {
        error: {
          code: "CONFIG",
          message: "Market data provider is not configured.",
        },
        meta: errorMeta(config.feed),
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const overview = await getCachedOverview(config);
    if (!overview) {
      throw new MarketDataError("unknown", "Empty market data response");
    }
    return NextResponse.json(overview, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const isProviderError = error instanceof MarketDataError;
    const category = isProviderError ? error.category : "unknown";
    const status = isProviderError ? error.status : undefined;
    const provider = isProviderError ? error.provider : "alpaca";

    logProviderIssue(
      category,
      status ?? (category === "config" ? 503 : 502),
      provider,
      error instanceof Error ? error.message : "unknown error",
    );

    const isConfigError = category === "config";

    return NextResponse.json(
      {
        error: {
          code: isConfigError ? "CONFIG" : "UPSTREAM",
          message: isConfigError
            ? "Market data provider is not configured."
            : "Market data is temporarily unavailable.",
        },
        meta: errorMeta(config.feed),
      },
      { status: isConfigError ? 503 : 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}

function errorMeta(feed: MarketDataMeta["feed"]): MarketDataMeta {
  return {
    mode: "live",
    provider: "alpaca",
    feed,
    asOf: null,
    marketOpen: null,
    nextOpen: null,
    nextClose: null,
    stale: false,
  };
}
