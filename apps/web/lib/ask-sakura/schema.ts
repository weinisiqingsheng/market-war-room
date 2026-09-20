/** Strict no-dependency runtime schema for ask-sakura-v1. */
import { ASK_SAKURA_VERSION } from "./types";
import type { AskSakuraAnswer, AskTextUnit } from "./types";

export type AskSchemaResult =
  { ok: true; answer: AskSakuraAnswer } | { ok: false; errors: string[] };

export const ASK_BOUNDS = {
  answerRefsMax: 8,
  supportingMin: 0,
  supportingMax: 5,
  limitationsMin: 0,
  limitationsMax: 3,
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function refsOk(value: unknown, max: number): boolean {
  if (!Array.isArray(value)) return false;
  if (value.length > max) return false;
  return value.every((ref) => typeof ref === "string" && ref.trim().length > 0);
}

function unitOk(value: unknown, maxRefs: number): value is AskTextUnit {
  if (!isRecord(value)) return false;
  return isNonEmptyString(value.text) && refsOk(value.evidenceRefs, maxRefs);
}

function unitsOk(value: unknown, min: number, max: number, maxRefs: number): boolean {
  if (!Array.isArray(value) || value.length < min || value.length > max) return false;
  return value.every((item) => unitOk(item, maxRefs));
}

export function parseAskSakuraAnswer(value: unknown): AskSchemaResult {
  const errors: string[] = [];
  if (!isRecord(value)) return { ok: false, errors: ["payload must be an object."] };
  if (value.version !== ASK_SAKURA_VERSION) errors.push(`version must be ${ASK_SAKURA_VERSION}.`);
  if (!["answered", "insufficient_evidence", "out_of_scope"].includes(String(value.status))) {
    errors.push("status must be answered|insufficient_evidence|out_of_scope.");
  }

  if (!isRecord(value.answer) || !isNonEmptyString(value.answer.text)) {
    errors.push("answer.text must be a non-empty string.");
  } else if (!refsOk(value.answer.evidenceRefs, ASK_BOUNDS.answerRefsMax)) {
    errors.push(`answer.evidenceRefs must contain 0-${ASK_BOUNDS.answerRefsMax} strings.`);
  }

  if (
    !unitsOk(
      value.supportingPoints,
      ASK_BOUNDS.supportingMin,
      ASK_BOUNDS.supportingMax,
      ASK_BOUNDS.answerRefsMax,
    )
  ) {
    errors.push(
      `supportingPoints must contain 0-${ASK_BOUNDS.supportingMax} items with text and 0-${ASK_BOUNDS.answerRefsMax} evidence refs.`,
    );
  }

  if (
    !unitsOk(
      value.limitations,
      ASK_BOUNDS.limitationsMin,
      ASK_BOUNDS.limitationsMax,
      ASK_BOUNDS.answerRefsMax,
    )
  ) {
    errors.push(
      `limitations must contain 0-${ASK_BOUNDS.limitationsMax} items with text and 0-${ASK_BOUNDS.answerRefsMax} evidence refs.`,
    );
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, answer: value as unknown as AskSakuraAnswer };
}
