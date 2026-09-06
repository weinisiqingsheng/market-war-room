import { NextResponse } from "next/server";
import { getMacroDataConfig } from "@/lib/macro-data/config";
import { buildMacroOverview } from "@/lib/macro-data/overview";
import { logProviderIssue } from "@/lib/market-data/log";

/**
 * GET /api/macro/overview
 *
 * Returns normalized Macro Pulse domain data (meta + 6 signals). The route is
 * separate from /api/market/overview because macro assets have independent
 * providers and cache cadence (FRED daily, Twelve intraday, BTC realtime).
 * Raw FRED / Twelve Data / Alpaca payloads never reach this response.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const config = getMacroDataConfig();

  if (config.mode === "demo") {
    return NextResponse.json(await buildMacroOverview(config), {
      headers: { "Cache-Control": "no-store" },
    });
  }

  const hasAnyKey =
    config.fredApiKey !== null ||
    config.twelveDataApiKey !== null ||
    (config.alpaca.apiKeyId !== null && config.alpaca.apiSecretKey !== null);

  if (!hasAnyKey) {
    logProviderIssue("config", 503, "macro", "no macro provider credentials configured");
    return NextResponse.json(
      {
        error: { code: "CONFIG", message: "Macro data providers are not configured." },
        meta: { mode: "live", asOf: null, stale: false, providers: [] },
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const overview = await buildMacroOverview(config);
    return NextResponse.json(overview, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    logProviderIssue(
      "unknown",
      502,
      "macro",
      error instanceof Error ? error.message : "unknown error",
    );
    return NextResponse.json(
      { error: { code: "UPSTREAM", message: "Macro data is temporarily unavailable." } },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
