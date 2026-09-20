/** ask-sakura request contract — accepts ONLY { question }. */
export interface AskQuestionInput {
  question: string;
}

export type AskQuestionValidation =
  | { ok: true; question: string }
  | { ok: false; code: "invalid_request" | "too_long" | "too_short" };

export const ASK_MAX_QUESTION_LENGTH = 500;
const MIN_QUESTION_LENGTH = 2;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseAskQuestion(body: unknown): AskQuestionValidation {
  if (!isRecord(body)) return { ok: false, code: "invalid_request" };
  const keys = Object.keys(body);
  if (keys.length !== 1 || !("question" in body)) return { ok: false, code: "invalid_request" };
  if (typeof body.question !== "string") return { ok: false, code: "invalid_request" };

  const question = body.question.trim();
  if (question.length === 0 || question.length < MIN_QUESTION_LENGTH) {
    return { ok: false, code: "too_short" };
  }
  if (question.length > ASK_MAX_QUESTION_LENGTH) return { ok: false, code: "too_long" };
  return { ok: true, question };
}
