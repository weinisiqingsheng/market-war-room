#!/usr/bin/env node
import "server-only";
import { runForwardFixturePilot } from "@/lib/short-term/forward/runner";

const args = new Set(process.argv.slice(2));
if (!args.has("--dry-run") || args.has("--real") || args.size !== 1) {
  throw new Error("Phase 2E supports fixture-only --dry-run; real execution is disabled.");
}

const report = await runForwardFixturePilot();
console.log(JSON.stringify(report, null, 2));
