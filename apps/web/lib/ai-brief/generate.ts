/**
 * Phase 7B.3 — controlled grounded generation orchestrator.
 *
 * Exactly two LLM calls maximum: initial generation + one deterministic
 * repair based only on schema/grounding issues. Transport errors never repair.
 * The BriefContext is never refreshed or altered between attempts.
 */
import { parseGroundedMarketBrief } from "./schema";
import { validateGroundedMarketBrief } from "./grounding-validator";
import { AI_BRIEF_SYSTEM_PROMPT } from "./prompt";
import { serializeModelEvidenceMessage } from "./serialize-context";
import type { GroundedMarketBrief } from "./brief-types";
import type { BriefContext } from "./types";
import type { AiBriefGenerationResult, SafeGenerationIssue } from "./generation-types";
import type { LlmMessage } from "@/lib/llm/types";
import type { LlmProvider } from "@/lib/llm/provider";

export interface GenerateGroundedMarketBriefInput {
  context: BriefContext;
  provider: LlmProvider;
  model?: string;
}

const SCHEMA_INVALID_ISSUE: SafeGenerationIssue = { code: "SCHEMA_INVALID", path: "brief", message: "Structured JSON failed runtime schema validation." };

function safeIssues(result: { issues: SafeGenerationIssue[] }): SafeGenerationIssue[] {
  return result.issues.map((item) => ({ code: item.code, path: item.path, message: item.message.slice(0, 160) }));
}

function repairInstruction(issues: SafeGenerationIssue[]): string {
  const lines = issues.map((item) => `${item.code} at ${item.path}`).join("\n");
  return `Your previous response failed deterministic validation.
Correct the response using ONLY the same supplied evidence.
Do not add facts.
Do not calculate new numbers.
Do not add new evidence IDs.
Return the complete ai-brief-v1 JSON object.
Validation issues:
${lines}`;
}

export async function generateGroundedMarketBrief(input: GenerateGroundedMarketBriefInput): Promise<AiBriefGenerationResult> {
  const { context, provider } = input;
  const fingerprint = context.fingerprint;
  const confidence = context.inputConfidence;
  if (confidence.label === "insufficient") {
    return { status: "insufficient_grounded_data", brief: null, attempts: 0, contextFingerprint: fingerprint, inputConfidence: confidence };
  }

  const evidenceMessage = serializeModelEvidenceMessage(context);
  const baseMessages: LlmMessage[] = [
    { role: "system", content: AI_BRIEF_SYSTEM_PROMPT },
    { role: "user", content: evidenceMessage },
  ];

  const attemptCall = async (messages: LlmMessage[]): Promise<{ ok: true; content: string } | { ok: false; category: string }> => {
    try {
      const request: { model?: string; messages: LlmMessage[]; temperature: number; structuredOutput: "json_object" } = { messages, temperature: 0.2, structuredOutput: "json_object" };
      // Only send an explicit model when a real override was supplied; otherwise the
      // provider's configured options.model is the source of truth (never "model").
      if (input.model) request.model = input.model;
      const response = await provider.complete(request);
      return { ok: true, content: response.content };
    } catch (error) {
      const category = error instanceof Error && "category" in error ? String((error as { category: unknown }).category) : "unknown";
      return { ok: false, category };
    }
  };

  const evaluate = (content: string): { brief?: GroundedMarketBrief; schemaIssues?: SafeGenerationIssue[]; groundingIssues?: SafeGenerationIssue[] } => {
    let json: unknown;
    try {
      json = JSON.parse(content);
    } catch {
      return { schemaIssues: [SCHEMA_INVALID_ISSUE] };
    }
    const parsed = parseGroundedMarketBrief(json);
    if (!parsed.ok) {
      return { schemaIssues: [SCHEMA_INVALID_ISSUE, ...(parsed as { ok: false; errors: string[] }).errors.slice(0, 5).map((message) => ({ code: "SCHEMA_INVALID", path: "brief", message: message.slice(0, 160) }))] };
    }
    const grounded = validateGroundedMarketBrief(parsed.brief, context);
    if (!grounded.valid) return { schemaIssues: [], groundingIssues: safeIssues(grounded) };
    return { brief: parsed.brief };
  };

  // First call.
  const first = await attemptCall(baseMessages);
  if (!first.ok) {
    return { status: "unavailable", brief: null, attempts: 1, contextFingerprint: fingerprint, inputConfidence: confidence, reason: "provider_error", providerErrorCategory: first.category };
  }
  const firstEval = evaluate(first.content);
  if (firstEval.brief) {
    return { status: "generated", brief: firstEval.brief, attempts: 1, contextFingerprint: fingerprint, inputConfidence: confidence };
  }

  // Exactly one repair attempt for schema/grounding issues (never transport).
  const repairIssues = firstEval.schemaIssues?.length ? firstEval.schemaIssues : firstEval.groundingIssues ?? [];
  const repairMessages: LlmMessage[] = [
    ...baseMessages,
    { role: "assistant", content: first.content },
    { role: "user", content: repairInstruction(repairIssues) },
  ];
  const second = await attemptCall(repairMessages);
  if (!second.ok) {
    return { status: "unavailable", brief: null, attempts: 2, contextFingerprint: fingerprint, inputConfidence: confidence, reason: "provider_error", providerErrorCategory: second.category };
  }
  const secondEval = evaluate(second.content);
  if (secondEval.brief) {
    return { status: "generated", brief: secondEval.brief, attempts: 2, contextFingerprint: fingerprint, inputConfidence: confidence };
  }
  const finalIssues = secondEval.schemaIssues?.length ? secondEval.schemaIssues : secondEval.groundingIssues ?? [];
  return {
    status: "unavailable",
    brief: null,
    attempts: 2,
    contextFingerprint: fingerprint,
    inputConfidence: confidence,
    reason: (secondEval.schemaIssues?.length ?? 0) > 0 ? "schema_validation_failed" : "grounding_validation_failed",
    validationIssues: finalIssues,
  };
}
