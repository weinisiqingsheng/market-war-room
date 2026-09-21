import "server-only";
import { createProductionTickerDeps } from "@/lib/ticker-context/production-service";
import { researchTicker, type TickerResearchDeps } from "@/lib/ticker-context/service";
import type { TickerResearchContext, TickerResearchResult } from "@/lib/ticker-context/types";
import { marketStateFromTickerContext } from "./adapter";
import type { ShortTermMarketState } from "./types";

export type VerifiedTickerResearch = Extract<
  TickerResearchResult,
  { status: "ok" | "partial" | "insufficient_data" }
>;

export interface VerifiedMarketSnapshot {
  status: "verified_market_input";
  contextStatus: VerifiedTickerResearch["status"];
  context: TickerResearchContext;
  state: ShortTermMarketState;
}

export type VerifiedMarketSnapshotResult =
  | VerifiedMarketSnapshot
  | {
      status: "unavailable";
      requestedSymbol: string;
      reason: string;
    };

export function bridgeTickerResearchResult(
  result: TickerResearchResult,
): VerifiedMarketSnapshotResult {
  if (!("context" in result)) {
    return {
      status: "unavailable",
      requestedSymbol: result.requestedSymbol,
      reason: result.reason,
    };
  }

  return {
    status: "verified_market_input",
    contextStatus: result.status,
    context: result.context,
    state: marketStateFromTickerContext(result.context),
  };
}

export type TickerResearchCall = (
  rawSymbol: unknown,
  deps: TickerResearchDeps,
) => Promise<TickerResearchResult>;

export async function loadVerifiedTickerState(
  rawSymbol: unknown,
  research: TickerResearchCall = researchTicker,
  deps: TickerResearchDeps = createProductionTickerDeps(),
): Promise<VerifiedMarketSnapshotResult> {
  const requestedSymbol = typeof rawSymbol === "string" ? rawSymbol.trim().toUpperCase() : "";
  try {
    const result = await research(rawSymbol, deps);
    return bridgeTickerResearchResult(result);
  } catch {
    return { status: "unavailable", reason: "provider_unavailable", requestedSymbol };
  }
}
