import "server-only";
import type { JevQuestionMap } from "./types";

export const JEV_QUESTION_SET = "short-term-jev-questions-v1" as const;

export function buildJevQuestions(): JevQuestionMap {
  return {
    evidence_sufficiency: {
      type: "noul",
      instructions:
        "Are the supplied market facts sufficiently complete and fresh for a cautious research classification?",
      criteria: {
        true: "Required price, history, volume, volatility, and sector context are available with usable provenance.",
        false: "One or more required facts are unavailable, stale, or missing provenance.",
      },
    },
    market_condition: {
      type: "choice",
      instructions:
        "Which current market-condition category best fits the supplied facts? Do not infer an unobserved future price move.",
      criteria: {
        bullish: "Observed conditions are constructive and internally consistent.",
        mixed: "Observed conditions are mixed, range-bound, or not decisive.",
        defensive: "Observed conditions show elevated downside concern or deteriorating support.",
      },
    },
    downside_concern: {
      type: "score",
      instructions: "How concerning is the downside risk in the supplied, timestamped facts?",
      criteria: [
        "Low: no material downside concern is supported by the supplied facts.",
        "Moderate: some downside concern is present but evidence is mixed or incomplete.",
        "High: multiple supplied facts support caution or a manual review.",
      ],
    },
    manual_review: {
      type: "noul",
      instructions:
        "Should a human review this research snapshot before relying on the classification?",
      criteria: {
        true: "The evidence is incomplete, conflicting, stale, or sufficiently risky to require human review.",
        false: "The supplied evidence is complete enough for a non-executing research display.",
      },
    },
  };
}
