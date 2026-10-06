import {
  FORWARD_DIRECTION_CLASSES,
  FORWARD_HORIZON,
  FORWARD_TASK_ID,
  FORWARD_TASK_VERSION,
} from "./contract";
import type { ForwardDecisionContext, ForwardQuestion } from "./types";

export const FORWARD_QUESTION_SET_VERSION = "short-term-forward-questions-v1" as const;

export function buildForwardDirectionQuestion(decision: ForwardDecisionContext): ForwardQuestion {
  return {
    id: "next_session_direction",
    taskId: FORWARD_TASK_ID,
    taskVersion: FORWARD_TASK_VERSION,
    horizon: FORWARD_HORIZON,
    targetSessionDate: decision.targetSessionDate,
    targetCloseAt: decision.targetCloseAt,
    classes: FORWARD_DIRECTION_CLASSES,
    prompt: [
      `At ${decision.requestedAt}, using the current market state effective as of ${decision.effectiveAsOf}, with frozen reference price ${decision.referencePrice}, classify ${decision.ticker}'s next-session close direction for ${decision.targetSessionDate} at ${decision.targetCloseAt}.`,
      "Use only decision-time evidence; do not use any future price, outcome, or post-decision observation.",
      "Return the next-session close direction as exactly one of UP, FLAT, or DOWN.",
    ].join(" "),
  };
}
