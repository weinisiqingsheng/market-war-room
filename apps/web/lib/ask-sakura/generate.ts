/**
 * ask-sakura-v1 controlled generation orchestrator.
 * Exactly two provider calls maximum: initial + ONE schema/grounding repair.
 * Same question, same selected evidence, same facts between attempts.
 */
import { parseAskSakuraAnswer } from "./schema";
import { validateAskSakuraAnswer } from "./grounding-validator";
import { ASK_SAKURA_SYSTEM_PROMPT, buildAskEvidenceMessage } from "./prompt";
import type { AskEvidenceSelection } from "./select-evidence";
import type { AskSakuraAnswer } from "./types";
import type { SafeAskIssue, AskGenerationResult } from "./generation-types";
import type { BriefInputConfidence } from "@/lib/ai-brief/types";
import type { LlmMessage } from "@/lib/llm/types";
import type { LlmProvider } from "@/lib/llm/provider";

export interface GenerateAskSakuraInput {
  question: string;
  selection: AskEvidenceSelection;
  inputConfidence: BriefInputConfidence;
  fingerprint: string;
  provider: LlmProvider;
  /**
   * V1.2B: on-demand ticker packs carry their own verified evidence confidence
   * (per-fact freshness + research metadata). When true, the *global* brief
   * input-confidence gate is not applied to this question. Default false keeps
   * V1.1C behavior byte-for-byte.
   */
  skipInputConfidenceGate?: boolean;
}

const SCHEMA_INVALID: SafeAskIssue = {
  code: "SCHEMA_INVALID",
  path: "answer",
  message: "Structured JSON failed ask-sakura-v1 runtime schema validation.",
};

function safeIssues(issues: SafeAskIssue[]): SafeAskIssue[] {
  return issues.map((item) => ({
    code: item.code,
    path: item.path,
    message: item.message.slice(0, 160),
  }));
}

function evaluate(
  content: string,
  input: GenerateAskSakuraInput,
): {
  answer?: AskSakuraAnswer;
  schemaIssues?: SafeAskIssue[];
  groundingIssues?: SafeAskIssue[];
} {
  let json: unknown;
  try {
    json = JSON.parse(content);
  } catch {
    return { schemaIssues: [SCHEMA_INVALID] };
  }
  const parsed = parseAskSakuraAnswer(json);
  if (!parsed.ok) {
    return {
      schemaIssues: [
        SCHEMA_INVALID,
        ...parsed.errors.slice(0, 5).map((message) => ({
          code: "SCHEMA_INVALID",
          path: "answer",
          message: message.slice(0, 160),
        })),
      ],
    };
  }
  const grounded = validateAskSakuraAnswer(parsed.answer, input.selection.facts, input.selection);
  if (!grounded.valid) {
    return { schemaIssues: [], groundingIssues: safeIssues(grounded.issues) };
  }
  return { answer: parsed.answer };
}

function repairInstruction(issues: SafeAskIssue[]): string {
  const lines = issues.map((item) => `${item.code} at ${item.path}`).join("\n");
  return `Your previous response failed deterministic validation.
Correct the response using ONLY the same supplied evidence.
Do not add facts.
Do not calculate numbers.
Do not change evidence IDs.
Return the complete ask-sakura-v1 JSON object.
Validation issues:
${lines}`;
}

export async function generateAskSakuraAnswer(
  input: GenerateAskSakuraInput,
): Promise<AskGenerationResult> {
  const { question, selection, inputConfidence, fingerprint, provider } = input;
  if (!input.skipInputConfidenceGate && inputConfidence.label === "insufficient") {
    return {
      status: "insufficient_grounded_data",
      answer: null,
      attempts: 0,
      contextFingerprint: fingerprint,
      inputConfidence,
    };
  }

  const evidenceMessage = buildAskEvidenceMessage(question, selection.safeFacts);
  const baseMessages: LlmMessage[] = [
    { role: "system", content: ASK_SAKURA_SYSTEM_PROMPT },
    { role: "user", content: evidenceMessage },
  ];

  const attemptCall = async (
    messages: LlmMessage[],
  ): Promise<{ ok: true; content: string } | { ok: false; category: string }> => {
    try {
      const response = await provider.complete({
        messages,
        temperature: 0.2,
        structuredOutput: "json_object",
      });
      return { ok: true, content: response.content };
    } catch (error) {
      const category =
        error instanceof Error && "category" in error
          ? String((error as { category: unknown }).category)
          : "unknown";
      return { ok: false, category };
    }
  };

  const first = await attemptCall(baseMessages);
  if (!first.ok) {
    return {
      status: "unavailable",
      answer: null,
      attempts: 1,
      contextFingerprint: fingerprint,
      inputConfidence,
      reason: "provider_error",
      providerErrorCategory: first.category,
    };
  }
  const firstEval = evaluate(first.content, input);
  if (firstEval.answer) {
    return {
      status: "generated",
      answer: firstEval.answer,
      attempts: 1,
      contextFingerprint: fingerprint,
      inputConfidence,
    };
  }

  const repairIssues = firstEval.schemaIssues?.length
    ? firstEval.schemaIssues
    : (firstEval.groundingIssues ?? []);
  const repairMessages: LlmMessage[] = [
    ...baseMessages,
    { role: "assistant", content: first.content },
    { role: "user", content: repairInstruction(repairIssues) },
  ];
  const second = await attemptCall(repairMessages);
  if (!second.ok) {
    return {
      status: "unavailable",
      answer: null,
      attempts: 2,
      contextFingerprint: fingerprint,
      inputConfidence,
      reason: "provider_error",
      providerErrorCategory: second.category,
    };
  }
  const secondEval = evaluate(second.content, input);
  if (secondEval.answer) {
    return {
      status: "generated",
      answer: secondEval.answer,
      attempts: 2,
      contextFingerprint: fingerprint,
      inputConfidence,
    };
  }
  const finalIssues = secondEval.schemaIssues?.length
    ? secondEval.schemaIssues
    : (secondEval.groundingIssues ?? []);
  return {
    status: "unavailable",
    answer: null,
    attempts: 2,
    contextFingerprint: fingerprint,
    inputConfidence,
    reason:
      (secondEval.schemaIssues?.length ?? 0) > 0
        ? "schema_validation_failed"
        : "grounding_validation_failed",
    validationIssues: finalIssues,
  };
}
