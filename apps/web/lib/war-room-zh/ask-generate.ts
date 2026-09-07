import { parseAskSakuraAnswer } from "@/lib/ask-sakura/schema";
import { validateAskSakuraAnswer } from "@/lib/ask-sakura/grounding-validator";
import type { AskSakuraAnswer } from "@/lib/ask-sakura/types";
import type { AskEvidenceSelection } from "@/lib/ask-sakura/select-evidence";
import type { SafeAskIssue, AskGenerationResult } from "@/lib/ask-sakura/generation-types";
import type { BriefInputConfidence } from "@/lib/ai-brief/types";
import type { LlmMessage } from "@/lib/llm/types";
import type { LlmProvider } from "@/lib/llm/provider";
import { CHINESE_ASK_SYSTEM_PROMPT, buildChineseAskEvidenceMessage } from "./ask-prompt";

export interface GenerateChineseAskInput {
  question: string;
  selection: AskEvidenceSelection;
  inputConfidence: BriefInputConfidence;
  fingerprint: string;
  provider: LlmProvider;
}

const schemaIssue: SafeAskIssue = {
  code: "SCHEMA_INVALID",
  path: "answer",
  message: "Structured JSON failed ask-sakura-v1 runtime schema validation.",
};

function safeIssues(issues: SafeAskIssue[]): SafeAskIssue[] {
  return issues.map((item) => ({ ...item, message: item.message.slice(0, 160) }));
}

type Evaluation = {
  answer?: AskSakuraAnswer;
  schemaIssues?: SafeAskIssue[];
  groundingIssues?: SafeAskIssue[];
};

function evaluate(content: string, input: GenerateChineseAskInput): Evaluation {
  let value: unknown;
  try {
    value = JSON.parse(content);
  } catch {
    return { schemaIssues: [schemaIssue] };
  }
  const parsed = parseAskSakuraAnswer(value);
  if (!parsed.ok) {
    return {
      schemaIssues: [
        schemaIssue,
        ...parsed.errors.slice(0, 5).map((message) => ({ ...schemaIssue, message: message.slice(0, 160) })),
      ],
    };
  }
  const grounded = validateAskSakuraAnswer(parsed.answer, input.selection.facts, input.selection);
  if (!grounded.valid) return { schemaIssues: [], groundingIssues: safeIssues(grounded.issues) };
  return { answer: parsed.answer };
}

function repairInstruction(issues: SafeAskIssue[]): string {
  return `上一次输出未通过确定性校验。只使用同一批证据修复，不得编造事实、不得新增数字或 evidence ID。返回完整的 ${"ask-sakura-v1"} JSON 对象。校验问题：\n${issues.map((issue) => `${issue.code} at ${issue.path}`).join("\n")}`;
}

export async function generateChineseAskAnswer(
  input: GenerateChineseAskInput,
): Promise<AskGenerationResult> {
  const { question, selection, inputConfidence, fingerprint, provider } = input;
  if (inputConfidence.label === "insufficient") {
    return { status: "insufficient_grounded_data", answer: null, attempts: 0, contextFingerprint: fingerprint, inputConfidence };
  }
  const baseMessages: LlmMessage[] = [
    { role: "system", content: CHINESE_ASK_SYSTEM_PROMPT },
    { role: "user", content: buildChineseAskEvidenceMessage(question, selection.safeFacts) },
  ];
  const call = async (messages: LlmMessage[]) => {
    try {
      return { ok: true as const, content: (await provider.complete({ messages, temperature: 0.2, structuredOutput: "json_object" })).content };
    } catch (error) {
      return { ok: false as const, category: error instanceof Error && "category" in error ? String((error as { category: unknown }).category) : "unknown" };
    }
  };
  const first = await call(baseMessages);
  if (!first.ok) return { status: "unavailable", answer: null, attempts: 1, contextFingerprint: fingerprint, inputConfidence, reason: "provider_error", providerErrorCategory: first.category };
  const firstEval = evaluate(first.content, input);
  if (firstEval.answer) return { status: "generated", answer: firstEval.answer, attempts: 1, contextFingerprint: fingerprint, inputConfidence };
  const issues = firstEval.schemaIssues?.length ? firstEval.schemaIssues : (firstEval.groundingIssues ?? []);
  const second = await call([...baseMessages, { role: "assistant", content: first.content }, { role: "user", content: repairInstruction(issues) }]);
  if (!second.ok) return { status: "unavailable", answer: null, attempts: 2, contextFingerprint: fingerprint, inputConfidence, reason: "provider_error", providerErrorCategory: second.category };
  const secondEval = evaluate(second.content, input);
  if (secondEval.answer) return { status: "generated", answer: secondEval.answer, attempts: 2, contextFingerprint: fingerprint, inputConfidence };
  return { status: "unavailable", answer: null, attempts: 2, contextFingerprint: fingerprint, inputConfidence, reason: secondEval.schemaIssues?.length ? "schema_validation_failed" : "grounding_validation_failed", validationIssues: secondEval.schemaIssues ?? secondEval.groundingIssues };
}
