import "server-only";
import { createProductionTickerDeps } from "@/lib/ticker-context/production-service";
import { researchTicker } from "@/lib/ticker-context/service";
import { createFixtureTransport } from "@/lib/short-term/jev/fixture-transport";
import { createJevService } from "@/lib/short-term/jev/service";
import {
  REAL_JEV_PILOT_CONFIRMATION,
  runRealJevShadowPilot,
} from "@/lib/short-term/pilot/real-shadow-pilot";
import { runVerifiedTickerShadow } from "@/lib/short-term/shadow/runner";
import {
  createInMemoryShadowStore,
  createLocalJsonlShadowStore,
} from "@/lib/short-term/shadow/store";

const args = new Set(process.argv.slice(2));
const symbols = ["NVDA", "TSLA", "AAPL"] as const;

if (args.has("--dry-run")) {
  const researchDeps = createProductionTickerDeps();
  const fixtureService = createJevService({ transport: createFixtureTransport() });
  const results = [];
  for (const ticker of symbols) {
    const sourceResult = await researchTicker(ticker, researchDeps);
    const store = createInMemoryShadowStore();
    const result = await runVerifiedTickerShadow(
      { ticker, strategyId: "risk-first", horizonHours: 1, maxLossPct: 1 },
      {
        research: async () => sourceResult,
        researchDeps,
        jevService: fixtureService,
        store,
      },
    );
    results.push(
      result.status === "ready"
        ? {
            symbol: ticker,
            status: result.status,
            contextStatus: result.contextStatus,
            model: result.assessment.model,
            assessmentStatus: result.assessment.status,
            marketInputStatus: result.marketInputStatus,
            modelOutputStatus: result.modelOutputStatus,
            stateFingerprint: result.assessment.stateFingerprint,
            sourceFingerprint: result.shadowRecord.sanitizedState.provenance.sourceFingerprint,
            storeRecords: store.list().length,
          }
        : { symbol: ticker, status: result.status, reason: result.reason },
    );
  }
  console.log(JSON.stringify({ mode: "fixture_dry_run", results }, null, 2));
  process.exit(0);
}

if (!args.has("--real") || !args.has("--confirm-real-jev-pilot")) {
  throw new Error("Private pilot requires --dry-run, or both --real and --confirm-real-jev-pilot.");
}

const outputPath = `/private/tmp/market-war-room/jev-shadow/real-pilot-${Date.now()}.jsonl`;
const report = await runRealJevShadowPilot({
  confirmation: REAL_JEV_PILOT_CONFIRMATION,
  shadowStore: createLocalJsonlShadowStore(outputPath),
});
console.log(JSON.stringify({ mode: "real_jev_shadow", outputPath, report }, null, 2));
