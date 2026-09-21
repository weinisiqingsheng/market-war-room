import "server-only";
import { createProductionTickerDeps } from "@/lib/ticker-context/production-service";
import { researchTicker, type TickerResearchDeps } from "@/lib/ticker-context/service";
import { createFixtureTransport } from "../jev/fixture-transport";
import { createJevService, type JevService } from "../jev/service";
import type { ShortTermJevAssessmentRequest } from "../jev/types";
import {
  loadVerifiedTickerState,
  type TickerResearchCall,
  type VerifiedMarketSnapshot,
} from "../market-data/verified-bridge";
import { buildShadowRecord } from "./record";
import { createInMemoryShadowStore, type ShortTermShadowStore } from "./store";
import type { ShortTermShadowRecord } from "./types";

export interface VerifiedShadowRunDeps {
  research?: TickerResearchCall;
  researchDeps?: TickerResearchDeps;
  jevService?: JevService;
  store?: ShortTermShadowStore;
  outputMode?: "fixture" | "real";
}

export type VerifiedShadowRunResult =
  | {
      status: "ready";
      marketInputStatus: "verified_market_input";
      modelOutputStatus: "fixture_model_output" | "real_jev_model_output";
      contextStatus: VerifiedMarketSnapshot["contextStatus"];
      context: VerifiedMarketSnapshot["context"];
      state: VerifiedMarketSnapshot["state"];
      assessment: Awaited<ReturnType<JevService["assess"]>>;
      shadowRecord: ShortTermShadowRecord;
    }
  | {
      status: "unavailable";
      requestedSymbol: string;
      reason: string;
    };

export async function runVerifiedTickerShadow(
  request: ShortTermJevAssessmentRequest,
  deps: VerifiedShadowRunDeps = {},
): Promise<VerifiedShadowRunResult> {
  const research = deps.research ?? researchTicker;
  const researchDeps = deps.researchDeps ?? createProductionTickerDeps();
  const bridged = await loadVerifiedTickerState(request.ticker, research, researchDeps);
  if (bridged.status !== "verified_market_input") return bridged;

  const jevService = deps.jevService ?? createJevService({ transport: createFixtureTransport() });
  const store = deps.store ?? createInMemoryShadowStore();
  const assessment = await jevService.assess(request, bridged.state);
  const outputMode = deps.outputMode ?? "fixture";
  const expectedStatus = outputMode === "real" ? "verified" : "fixture";
  if (assessment.status !== expectedStatus) {
    return {
      status: "unavailable",
      requestedSymbol: request.ticker,
      reason:
        assessment.error?.code ??
        `${outputMode === "real" ? "real_jev" : "fixture"}_model_output_unavailable`,
    };
  }
  const modelOutputStatus =
    outputMode === "real" ? "real_jev_model_output" : "fixture_model_output";

  const shadowRecord = buildShadowRecord({
    assessment,
    request,
    marketState: bridged.state,
    marketInputStatus: "verified_market_input",
    modelOutputStatus,
  });
  store.append(shadowRecord);
  return {
    status: "ready",
    marketInputStatus: "verified_market_input",
    modelOutputStatus,
    contextStatus: bridged.contextStatus,
    context: bridged.context,
    state: bridged.state,
    assessment,
    shadowRecord,
  };
}
