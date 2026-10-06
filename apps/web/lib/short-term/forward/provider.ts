import "server-only";
import { JEV_MODEL, type JevProviderRequest, type JevProviderResponse } from "../jev/types";
import { FORWARD_HORIZON, FORWARD_TASK_ID, FORWARD_TASK_VERSION } from "./contract";
import { FORWARD_QUESTION_SET_VERSION, buildForwardDirectionQuestion } from "./questions";
import type {
  ForwardDecisionContext,
  ForwardJevProviderResponse,
  ForwardQuestion,
  ValidatedForwardAssessment,
} from "./types";
import { validateForwardResponse } from "./validate";

const expectedAnswerIds = [
  "evidence_sufficiency",
  "manual_review",
  "next_session_direction",
] as const;

export function buildForwardProviderRequest(
  decision: ForwardDecisionContext,
  marketState: unknown,
): JevProviderRequest {
  const question = buildForwardDirectionQuestion(decision);
  return {
    model: JEV_MODEL,
    state: { market: marketState, forward: decision } as unknown as JevProviderRequest["state"],
    questions: {
      evidence_sufficiency: {
        type: "noul",
        instructions:
          "Is the supplied decision-time evidence complete and fresh enough for this forward research task?",
        criteria: {
          true: "Required decision-time facts have usable provenance.",
          false: "Facts are missing, stale, or unavailable.",
        },
      },
      manual_review: {
        type: "noul",
        instructions:
          "Does this decision-time forward assessment require manual review before research use?",
        criteria: {
          true: "Evidence is incomplete, conflicting, or risky.",
          false: "Evidence is sufficient for non-executing research.",
        },
      },
      next_session_direction: {
        type: "choice",
        instructions: question.prompt,
        criteria: {
          UP: "Next eligible regular NYSE session close return is greater than +0.10%.",
          FLAT: "Next eligible regular NYSE session close return is between -0.10% and +0.10%, inclusive.",
          DOWN: "Next eligible regular NYSE session close return is less than -0.10%.",
        },
      },
    },
  };
}

function finiteUnit(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}

export function mapForwardProviderResponse(
  response: JevProviderResponse,
  decision: ForwardDecisionContext,
  question: ForwardQuestion,
  metadata: { latencyMs: number; estimatedCostUsd: number },
): ValidatedForwardAssessment {
  if (!response || response.model !== JEV_MODEL || !response.answers)
    throw new Error("Forward response model or answers invalid");
  const ids = Object.keys(response.answers).sort();
  if (ids.join("\u0000") !== [...expectedAnswerIds].sort().join("\u0000"))
    throw new Error("Forward response answer IDs invalid");
  const direction = response.answers.next_session_direction;
  const evidence = response.answers.evidence_sufficiency;
  const review = response.answers.manual_review;
  if (direction?.type !== "choice" || evidence?.type !== "noul" || review?.type !== "noul")
    throw new Error("Forward response answer types invalid");
  if (!finiteUnit(evidence.noul) || !finiteUnit(review.noul))
    throw new Error("Forward response noul values invalid");
  const normalized: ForwardJevProviderResponse = {
    taskId: FORWARD_TASK_ID,
    taskVersion: FORWARD_TASK_VERSION,
    horizon: FORWARD_HORIZON,
    targetSessionDate: decision.targetSessionDate,
    targetCloseAt: decision.targetCloseAt,
    model: response.model,
    questionSetVersion: FORWARD_QUESTION_SET_VERSION,
    answer: {
      predictedClass: direction.choice,
      classDistribution: direction.probabilities,
      confidence: direction.confidence,
      evidenceSufficiency: evidence.noul,
      manualReview: review.noul >= 0.5,
    },
    usage: { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens },
  };
  const assessment = validateForwardResponse(normalized, question);
  return {
    ...assessment,
    latencyMs: metadata.latencyMs,
    estimatedCostUsd: metadata.estimatedCostUsd,
  };
}
