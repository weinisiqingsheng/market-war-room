import {
  FORWARD_DIRECTION_CLASSES,
  FORWARD_HORIZON,
  FORWARD_TASK_ID,
  FORWARD_TASK_VERSION,
  type ForwardDirection,
} from "./contract";
import { FORWARD_QUESTION_SET_VERSION } from "./questions";
import type {
  ForwardJevProviderResponse,
  ForwardQuestion,
  ValidatedForwardAssessment,
} from "./types";

const EPSILON = 1e-6;
const answerKeys = [
  "classDistribution",
  "confidence",
  "evidenceSufficiency",
  "manualReview",
  "predictedClass",
];
const responseKeys = [
  "answer",
  "horizon",
  "model",
  "questionSetVersion",
  "targetCloseAt",
  "targetSessionDate",
  "taskId",
  "taskVersion",
  "usage",
];

function fail(message: string): never {
  throw new Error(`Forward response invalid: ${message}`);
}
function exactKeys(value: object, expected: readonly string[], name: string): void {
  const actual = Object.keys(value).sort();
  if (actual.length !== expected.length || actual.some((key, i) => key !== [...expected].sort()[i]))
    fail(`${name} keys`);
}
function finiteUnit(value: unknown, name: string): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1)
    fail(`${name} range`);
}

export function validateForwardResponse(
  response: ForwardJevProviderResponse,
  question: ForwardQuestion,
  metadata: { latencyMs?: number; estimatedCostUsd?: number } = {},
): ValidatedForwardAssessment {
  if (!response || typeof response !== "object") fail("object required");
  exactKeys(response, responseKeys, "response");
  if (response.taskId !== FORWARD_TASK_ID || question.taskId !== FORWARD_TASK_ID) fail("task id");
  if (
    response.taskVersion !== FORWARD_TASK_VERSION ||
    question.taskVersion !== FORWARD_TASK_VERSION
  )
    fail("task version");
  if (response.horizon !== FORWARD_HORIZON || question.horizon !== FORWARD_HORIZON) fail("horizon");
  if (response.questionSetVersion !== FORWARD_QUESTION_SET_VERSION) fail("question set");
  if (
    response.targetSessionDate !== question.targetSessionDate ||
    response.targetCloseAt !== question.targetCloseAt
  )
    fail("target session");
  if (typeof response.model !== "string" || !response.model) fail("model");
  if (!response.answer || typeof response.answer !== "object") fail("answer");
  exactKeys(response.answer, answerKeys, "answer");
  if (!FORWARD_DIRECTION_CLASSES.includes(response.answer.predictedClass as ForwardDirection))
    fail("predicted class");
  if (!response.answer.classDistribution || typeof response.answer.classDistribution !== "object")
    fail("class distribution");
  exactKeys(response.answer.classDistribution, FORWARD_DIRECTION_CLASSES, "class distribution");
  const distribution = Object.fromEntries(
    FORWARD_DIRECTION_CLASSES.map((key) => {
      const value = response.answer.classDistribution[key];
      if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1)
        fail(`${key} probability`);
      return [key, value];
    }),
  ) as Record<ForwardDirection, number>;
  const sum = FORWARD_DIRECTION_CLASSES.reduce((total, key) => total + distribution[key], 0);
  if (Math.abs(sum - 1) > EPSILON) fail("probability normalization");
  finiteUnit(response.answer.confidence, "confidence");
  finiteUnit(response.answer.evidenceSufficiency, "evidence sufficiency");
  if (typeof response.answer.manualReview !== "boolean") fail("manual review");
  if (
    !response.usage ||
    typeof response.usage !== "object" ||
    !Number.isInteger(response.usage.inputTokens) ||
    !Number.isInteger(response.usage.outputTokens) ||
    response.usage.inputTokens < 0 ||
    response.usage.outputTokens < 0
  )
    fail("usage");
  return {
    taskId: FORWARD_TASK_ID,
    taskVersion: FORWARD_TASK_VERSION,
    horizon: FORWARD_HORIZON,
    targetSessionDate: response.targetSessionDate,
    targetCloseAt: response.targetCloseAt,
    model: response.model,
    questionSetVersion: response.questionSetVersion,
    predictedClass: response.answer.predictedClass as ForwardDirection,
    classDistribution: distribution,
    confidence: response.answer.confidence,
    evidenceSufficiency: response.answer.evidenceSufficiency,
    manualReview: response.answer.manualReview,
    usage: { ...response.usage },
    latencyMs: metadata.latencyMs ?? 0,
    estimatedCostUsd: metadata.estimatedCostUsd ?? 0,
  };
}
