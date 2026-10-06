import type { JevScoreAnswer, JevScoreQuestion } from "../jev/types";

export const SCORE_CONTRACT_TOLERANCE = 1e-6;

export type ScoreAuditResult =
  | {
      valid: true;
      weightedScore: number;
      minScore: number;
      maxScore: number;
      tolerance: number;
    }
  | {
      valid: false;
      issues: string[];
      weightedScore: number | null;
      minScore: number;
      maxScore: number;
      tolerance: number;
    };

function sameKeys(actual: Record<string, unknown>, expected: string[]): boolean {
  return Object.keys(actual).sort().join("\u0000") === [...expected].sort().join("\u0000");
}

export function auditScoreAnswer(
  answer: JevScoreAnswer,
  question: JevScoreQuestion,
  tolerance = SCORE_CONTRACT_TOLERANCE,
): ScoreAuditResult {
  const minScore = 0;
  const maxScore = question.criteria.length - 1;
  const issues: string[] = [];
  const expectedKeys = question.criteria.map((_, index) => String(index));

  if (question.criteria.length < 2 || question.criteria.length > 10)
    issues.push("rubric_length_invalid");

  if (!Number.isFinite(tolerance) || tolerance < 0) {
    throw new Error("Score audit tolerance must be a finite non-negative number.");
  }

  if (!sameKeys(answer.legend, expectedKeys)) issues.push("legend_keys_mismatch");
  if (!sameKeys(answer.probabilities, expectedKeys)) issues.push("probability_keys_mismatch");

  const probabilityValues = expectedKeys.map((key) => answer.probabilities[key]);
  const probabilitiesValid = probabilityValues.every(
    (value) => Number.isFinite(value) && value >= 0 && value <= 1,
  );
  if (!probabilitiesValid) issues.push("probability_value_invalid");

  const probabilityTotal = probabilityValues.reduce(
    (total, value) => (Number.isFinite(value) ? total + value : total),
    0,
  );
  if (!Number.isFinite(probabilityTotal) || Math.abs(probabilityTotal - 1) > tolerance)
    issues.push("probability_total_invalid");

  const weightedScore = probabilitiesValid
    ? probabilityValues.reduce((total, probability, index) => total + index * probability, 0)
    : null;

  if (!Number.isFinite(answer.score)) {
    issues.push("score_invalid");
  } else {
    if (answer.score < minScore - tolerance || answer.score > maxScore + tolerance)
      issues.push("score_out_of_range");
    if (weightedScore !== null && Math.abs(answer.score - weightedScore) > tolerance)
      issues.push("score_not_probability_weighted");
  }
  if (!Number.isFinite(answer.confidence) || answer.confidence < 0 || answer.confidence > 1)
    issues.push("confidence_invalid");

  const valid = issues.length === 0;
  if (valid && weightedScore !== null)
    return { valid: true, weightedScore, minScore, maxScore, tolerance };
  return { valid: false, issues, weightedScore, minScore, maxScore, tolerance };
}
