import { NextResponse } from "next/server";
import {
  projectTickerContext,
  type TickerResearchApiFailure,
} from "@/lib/ticker-context/api-types";
import {
  createProductionTickerDeps,
  resolveTickerResearchMode,
} from "@/lib/ticker-context/production-service";
import { researchTicker } from "@/lib/ticker-context/service";
import { normalizeTickerSymbol } from "@/lib/ticker-context/symbol";

/**
 * GET /api/intelligence/ticker?symbol=NVDA
 *
 * On-demand ticker research over verified providers (V1.2A). Independent of
 * ask-sakura-v1, brief-context-v1 and the AI brief. Read-only; failures degrade
 * per provider (`partial`) and never substitute demo or another company's data.
 *
 * Cache-Control: `no-store` — evidence is on-demand, session-sensitive and
 * already cached server-side per provider TTL; shared/CDN caching could serve
 * mislabeled freshness to another consumer.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" } as const;

function failure(
  status: number,
  body: TickerResearchApiFailure,
): NextResponse<TickerResearchApiFailure> {
  return NextResponse.json(body, { status, headers: noStore });
}

export async function GET(request: Request) {
  let raw: string | null = null;
  let occurrences = 0;
  try {
    const url = new URL(request.url);
    const values = url.searchParams.getAll("symbol");
    occurrences = values.length;
    raw = values[0] ?? null;
  } catch {
    raw = null;
  }
  if (raw === null || occurrences !== 1) {
    return NextResponse.json(
      {
        error: {
          code: "MALFORMED_QUERY",
          message:
            "Provide exactly one 'symbol' query parameter, e.g. /api/intelligence/ticker?symbol=NVDA.",
        },
      },
      { status: 400, headers: noStore },
    );
  }

  const normalized = normalizeTickerSymbol(raw);
  if (normalized === null) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_SYMBOL",
          message:
            "Symbol must start with a letter and contain only letters, digits, '.' or '-' (max 10 characters).",
        },
      },
      { status: 400, headers: noStore },
    );
  }

  const mode = resolveTickerResearchMode();
  if (mode === "demo") {
    return failure(503, {
      mode: "demo",
      status: "unavailable",
      symbol: normalized,
      reason: "live_data_required",
      error: {
        code: "LIVE_DATA_REQUIRED",
        message:
          "On-demand ticker research requires live market data (TICKER_RESEARCH_MODE=live). No demo values are substituted.",
      },
    });
  }

  try {
    const result = await researchTicker(normalized, createProductionTickerDeps());
    if (result.status === "unsupported_symbol") {
      const unknown = result.reason === "unknown_symbol";
      return failure(unknown ? 404 : 422, {
        mode: "live",
        status: "unsupported_symbol",
        symbol: result.requestedSymbol,
        reason: result.reason,
        error: {
          code: unknown ? "UNKNOWN_SYMBOL" : "UNSUPPORTED_SECURITY_TYPE",
          message: unknown
            ? "Symbol is not recognised by the supported provider security directory."
            : "Symbol exists but is not a supported active US equity.",
        },
      });
    }
    if (result.status === "unavailable") {
      return failure(503, {
        mode: "live",
        status: "unavailable",
        symbol: result.requestedSymbol,
        reason: result.reason,
        error: {
          code: "PROVIDER_UNAVAILABLE",
          message:
            "Ticker research providers are temporarily unavailable. No cached or demo values are substituted.",
        },
      });
    }
    return NextResponse.json(
      {
        mode: "live",
        status: result.status,
        symbol: result.context.symbol,
        context: projectTickerContext(result.context),
      },
      { status: 200, headers: noStore },
    );
  } catch {
    return failure(503, {
      mode: "live",
      status: "unavailable",
      symbol: normalized,
      reason: "provider_unavailable",
      error: {
        code: "PROVIDER_UNAVAILABLE",
        message: "Ticker research failed safely; no provider payload is exposed.",
      },
    });
  }
}
