import { parseGroundedMarketBrief } from "@/lib/ai-brief/schema";
import { validateGroundedMarketBrief } from "@/lib/ai-brief/grounding-validator";
import type { BriefContext } from "@/lib/ai-brief/types";
import type { AiBriefGenerationResult, SafeGenerationIssue } from "@/lib/ai-brief/generation-types";
import { serializeModelEvidenceMessage } from "@/lib/ai-brief/serialize-context";
import type { LlmProvider } from "@/lib/llm/provider";
import type { LlmMessage } from "@/lib/llm/types";
import { CHINESE_AI_BRIEF_SYSTEM_PROMPT } from "./ai-brief-prompt";

export async function generateChineseGroundedMarketBrief(input: {
  context: BriefContext;
  provider: LlmProvider;
  model?: string;
}): Promise<AiBriefGenerationResult> {
  const { context, provider } = input;
  const confidence = context.inputConfidence;
  if (confidence.label === "insufficient")
    return {
      status: "insufficient_grounded_data",
      brief: null,
      attempts: 0,
      contextFingerprint: context.fingerprint,
      inputConfidence: confidence,
    };
  const baseMessages: LlmMessage[] = [
    { role: "system", content: CHINESE_AI_BRIEF_SYSTEM_PROMPT },
    { role: "user", content: serializeModelEvidenceMessage(context) },
  ];
  const call = async (messages: LlmMessage[]) => {
    try {
      const request: {
        model?: string;
        messages: LlmMessage[];
        temperature: number;
        structuredOutput: "json_object";
      } = { messages, temperature: 0.2, structuredOutput: "json_object" };
      if (input.model) request.model = input.model;
      return { ok: true as const, response: await provider.complete(request) };
    } catch (error) {
      const category =
        error instanceof Error && "category" in error
          ? String((error as { category: unknown }).category)
          : "unknown";
      return { ok: false as const, category };
    }
  };
  const evaluate = (content: string) => {
    let value: unknown;
    try {
      value = JSON.parse(content);
    } catch {
      return {
        schemaIssues: [
          {
            code: "SCHEMA_INVALID",
            path: "brief",
            message: "Structured JSON failed runtime schema validation.",
          },
        ] as SafeGenerationIssue[],
      };
    }
    const parsed = parseGroundedMarketBrief(value);
    if (!parsed.ok)
      return {
        schemaIssues: [
          {
            code: "SCHEMA_INVALID",
            path: "brief",
            message: "Structured JSON failed runtime schema validation.",
          },
        ] as SafeGenerationIssue[],
      };
    const grounded = validateGroundedMarketBrief(parsed.brief, context);
    return grounded.valid
      ? { brief: parsed.brief }
      : {
          groundingIssues: grounded.issues.map((issue) => ({
            code: issue.code,
            path: issue.path,
            message: issue.message.slice(0, 160),
          })),
        };
  };
  const first = await call(baseMessages);
  if (!first.ok)
    return {
      status: "unavailable",
      brief: null,
      attempts: 1,
      contextFingerprint: context.fingerprint,
      inputConfidence: confidence,
      reason: "provider_error",
      providerErrorCategory: first.category,
    };
  const firstEval = evaluate(first.response.content);
  if (firstEval.brief)
    return {
      status: "generated",
      brief: firstEval.brief,
      attempts: 1,
      contextFingerprint: context.fingerprint,
      inputConfidence: confidence,
    };
  const issues = firstEval.schemaIssues ?? firstEval.groundingIssues ?? [];
  const second = await call([
    ...baseMessages,
    { role: "assistant", content: first.response.content },
    {
      role: "user",
      content: `上一次输出未通过确定性校验。只使用同一批证据修复，不得编造事实、不得新增数字或 evidence ID。返回完整的 ai-brief-v1 JSON 对象。校验问题：\n${issues.map((issue) => `${issue.code} at ${issue.path}`).join("\n")}`,
    },
  ]);
  if (!second.ok)
    return {
      status: "unavailable",
      brief: null,
      attempts: 2,
      contextFingerprint: context.fingerprint,
      inputConfidence: confidence,
      reason: "provider_error",
      providerErrorCategory: second.category,
    };
  const secondEval = evaluate(second.response.content);
  if (secondEval.brief)
    return {
      status: "generated",
      brief: secondEval.brief,
      attempts: 2,
      contextFingerprint: context.fingerprint,
      inputConfidence: confidence,
    };
  return {
    status: "unavailable",
    brief: null,
    attempts: 2,
    contextFingerprint: context.fingerprint,
    inputConfidence: confidence,
    reason: secondEval.schemaIssues ? "schema_validation_failed" : "grounding_validation_failed",
    validationIssues: secondEval.schemaIssues ?? secondEval.groundingIssues,
  };
}
