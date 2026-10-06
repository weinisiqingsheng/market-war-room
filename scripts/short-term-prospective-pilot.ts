#!/usr/bin/env node
import { runProspectiveFixtureDryRun } from "@/lib/short-term/prospective/pilot";

const args = new Set(process.argv.slice(2));
if (!args.has("--dry-run") || args.has("--real")) {
  throw new Error(
    "Phase 2D pilot only supports the explicit --dry-run mode; real execution is separately gated and disabled.",
  );
}

const report = await runProspectiveFixtureDryRun();
console.log(JSON.stringify(report, null, 2));
