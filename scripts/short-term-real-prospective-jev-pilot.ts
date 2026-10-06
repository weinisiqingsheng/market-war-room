#!/usr/bin/env node
import "server-only";
import {
  createProspectiveStore,
  PROSPECTIVE_RETENTION_DAYS,
} from "@/lib/short-term/prospective/store";
import { freezeProspectiveDecision } from "@/lib/short-term/prospective/freeze";
import { runProspectiveFixtureDryRun } from "@/lib/short-term/prospective/pilot";
import {
  REAL_JEV_PILOT_CONFIRMATION,
  runRealJevShadowPilot,
} from "@/lib/short-term/pilot/real-shadow-pilot";
import { createRealPilotShadowStore } from "@/lib/short-term/pilot/storage";

const args = new Set(process.argv.slice(2));

if (args.has("--dry-run")) {
  if (args.has("--real")) throw new Error("Dry-run cannot be combined with --real.");
  const report = await runProspectiveFixtureDryRun();
  console.log(JSON.stringify(report, null, 2));
  process.exit(0);
}

if (!args.has("--real") || !args.has("--confirm-real-jev-pilot")) {
  throw new Error(
    "Private prospective pilot requires --dry-run, or both --real and --confirm-real-jev-pilot.",
  );
}

const shadowStore = createRealPilotShadowStore();
const prospectiveStore = createProspectiveStore({
  retentionDays: PROSPECTIVE_RETENTION_DAYS,
});
const decisions: Array<{
  symbol: string;
  runId: string;
  stateFingerprint: string;
  sourceFingerprint: string;
  marketInputStatus: string;
  modelOutputStatus: string;
}> = [];

const report = await runRealJevShadowPilot({
  confirmation: REAL_JEV_PILOT_CONFIRMATION,
  shadowStore,
  onReadyShadow(shadow) {
    const decision = freezeProspectiveDecision(shadow.shadowRecord, "next_session_close");
    prospectiveStore.appendDecision(decision);
    decisions.push({
      symbol: decision.ticker,
      runId: decision.runId,
      stateFingerprint: decision.stateFingerprint,
      sourceFingerprint: decision.sourceFingerprint,
      marketInputStatus: decision.marketInputStatus,
      modelOutputStatus: decision.assessment.modelOutputStatus,
    });
  },
});

console.log(
  JSON.stringify(
    {
      mode: "real_prospective_jev_shadow",
      shadowPath: shadowStore.filePath,
      decisionPath: prospectiveStore.decisionFilePath,
      report,
      decisions,
    },
    null,
    2,
  ),
);
