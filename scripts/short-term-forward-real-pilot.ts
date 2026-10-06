#!/usr/bin/env node
import "server-only";
import {
  defaultForwardPredictionStore,
  REAL_FORWARD_CONFIRMATION,
  runRealForwardPilot,
} from "@/lib/short-term/forward/real-pilot";
import { defaultForwardAttemptStore } from "@/lib/short-term/forward/attempt-store";

const args = process.argv.slice(2);
if (args.length !== 2 || args[0] !== "--confirm" || args[1] !== REAL_FORWARD_CONFIRMATION) {
  throw new Error(`Real forward execution requires --confirm ${REAL_FORWARD_CONFIRMATION}.`);
}

const report = await runRealForwardPilot({
  confirmation: REAL_FORWARD_CONFIRMATION,
  store: defaultForwardPredictionStore(),
  attemptStore: defaultForwardAttemptStore(),
});
console.log(JSON.stringify(report, null, 2));
