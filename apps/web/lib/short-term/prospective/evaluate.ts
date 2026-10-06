import "server-only";
import { noChangeBaseline } from "../evaluation/baselines";
import { evaluateShadowRecord, type ShadowEvaluationSummary } from "../evaluation/evaluators";
import type { ShortTermShadowRecord } from "../shadow/types";
import type { ProspectiveOutcomeRecord } from "./types";

export interface ProspectivePairEvaluation {
  currentState: ShadowEvaluationSummary;
  baseline: {
    label: "flat";
    outcomeLabel: ProspectiveOutcomeRecord["label"];
    matches: boolean | null;
  };
  forward: {
    status: "not_applicable";
    reason: string;
  };
}

export function evaluateProspectivePair(input: {
  shadowRecord: ShortTermShadowRecord;
  outcome: ProspectiveOutcomeRecord;
}): ProspectivePairEvaluation {
  const { shadowRecord, outcome } = input;
  if (shadowRecord.runId !== outcome.runId || shadowRecord.ticker !== outcome.ticker)
    throw new Error("Prospective outcome identity does not match the Shadow Record.");
  if (shadowRecord.stateFingerprint !== outcome.stateFingerprint)
    throw new Error("Prospective outcome fingerprint does not match the Shadow Record.");

  const currentState = evaluateShadowRecord(shadowRecord);
  const baselineLabel = noChangeBaseline() as "flat";
  return {
    currentState,
    baseline: {
      label: baselineLabel,
      outcomeLabel: outcome.label,
      matches: outcome.label === "not_observable" ? null : baselineLabel === outcome.label,
    },
    forward: {
      status: "not_applicable",
      reason:
        "The existing Jev question registry has no separately versioned future-direction question; current-state judgments and confidence are not future-direction probabilities.",
    },
  };
}
