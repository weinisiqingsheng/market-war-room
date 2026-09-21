import "server-only";
import { JevAdapterError } from "./errors";
import type {
  JevChoiceQuestion,
  JevQuestionMap,
  JevProviderAnswer,
  JevProviderResponse,
  JevScoreQuestion,
} from "./types";
import { JEV_MODEL } from "./types";

function invalid(message: string): never {
  throw new JevAdapterError("RESPONSE_INVALID", message);
}

function finiteUnit(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}

function validateProbabilities(
  probabilities: unknown,
  expectedKeys: string[],
): Record<string, number> {
  if (!probabilities || typeof probabilities !== "object" || Array.isArray(probabilities))
    invalid("Probability map is malformed.");
  const entries = Object.entries(probabilities as Record<string, unknown>);
  if (
    entries
      .map(([key]) => key)
      .sort()
      .join("\u0000") !== [...expectedKeys].sort().join("\u0000")
  )
    invalid("Probability options do not match the question rubric.");
  const normalized = Object.fromEntries(
    entries.map(([key, value]) => {
      if (!finiteUnit(value)) invalid("Probability must be a finite number between 0 and 1.");
      return [key, value];
    }),
  );
  const total = Object.values(normalized).reduce((sum, value) => sum + value, 0);
  if (Math.abs(total - 1) > 1e-6) invalid("Probabilities must sum to 1.");
  return normalized;
}

function validateChoice(answer: JevProviderAnswer, question: JevChoiceQuestion): JevProviderAnswer {
  if (answer.type !== "choice") invalid("Answer type does not match Choice question.");
  const options = Object.keys(question.criteria);
  if (!options.includes(answer.choice)) invalid("Choice answer is not in the question rubric.");
  const probabilities = validateProbabilities(answer.probabilities, options);
  const confidence = finiteUnit(answer.confidence)
    ? answer.confidence
    : invalid("Choice confidence is invalid.");
  return {
    type: "choice",
    choice: answer.choice,
    probabilities,
    confidence,
  };
}

function validateScore(answer: JevProviderAnswer, question: JevScoreQuestion): JevProviderAnswer {
  if (answer.type !== "score") invalid("Answer type does not match Score question.");
  const expectedKeys = question.criteria.map((_, index) => String(index));
  const probabilities = validateProbabilities(answer.probabilities, expectedKeys);
  const legendKeys = Object.keys(answer.legend).sort().join("\u0000");
  if (legendKeys !== expectedKeys.slice().sort().join("\u0000"))
    invalid("Score legend does not match the question rubric.");
  if (Object.values(answer.legend).some((value) => typeof value !== "string"))
    invalid("Score legend is invalid.");
  if (typeof answer.score !== "number" || !Number.isFinite(answer.score))
    invalid("Score value is invalid.");
  const confidence = finiteUnit(answer.confidence)
    ? answer.confidence
    : invalid("Score confidence is invalid.");
  return {
    type: "score",
    score: answer.score,
    legend: { ...answer.legend },
    probabilities,
    confidence,
  };
}

export function validateJevProviderResponse(
  response: JevProviderResponse,
  questions: JevQuestionMap,
  _requestFingerprint?: string,
): JevProviderResponse {
  void _requestFingerprint;
  if (!response || typeof response !== "object") invalid("Provider response is malformed.");
  if (response.model !== JEV_MODEL) invalid("Provider model is not the pinned Jev version.");
  if (!response.answers || typeof response.answers !== "object" || Array.isArray(response.answers))
    invalid("Provider answers are malformed.");
  const expectedIds = Object.keys(questions).sort();
  const actualIds = Object.keys(response.answers).sort();
  if (expectedIds.join("\u0000") !== actualIds.join("\u0000"))
    invalid("Provider answer IDs do not match the question registry.");
  const answers: Record<string, JevProviderAnswer> = {};
  for (const id of expectedIds) {
    const answer = response.answers[id];
    const question = questions[id];
    if (!answer || !question) invalid("Provider answer is missing.");
    if (question.type === "noul") {
      if (answer.type !== "noul" || !finiteUnit(answer.noul)) invalid("Noul answer is invalid.");
      answers[id] = { type: "noul", noul: answer.noul };
    } else if (question.type === "choice") {
      answers[id] = validateChoice(answer, question);
    } else {
      answers[id] = validateScore(answer, question);
    }
  }
  if (
    !response.usage ||
    !Number.isInteger(response.usage.input_tokens) ||
    response.usage.input_tokens < 0 ||
    !Number.isInteger(response.usage.output_tokens) ||
    response.usage.output_tokens < 0
  ) {
    invalid("Provider token usage is invalid.");
  }
  return { model: response.model, answers, usage: response.usage };
}

export function validateTransportFingerprint(actual: string, expected: string): void {
  if (actual !== expected)
    invalid("Provider response request fingerprint does not match the submitted request.");
}
