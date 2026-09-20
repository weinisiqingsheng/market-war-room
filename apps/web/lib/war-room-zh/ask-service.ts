import { NextResponse } from "next/server";
import { parseAskQuestion, ASK_MAX_QUESTION_LENGTH } from "@/lib/ask-sakura/request";
import { selectEvidenceForQuestion } from "@/lib/ask-sakura/select-evidence";
import type { AskSakuraAnswer } from "@/lib/ask-sakura/types";
import type { AskGenerationResult } from "@/lib/ask-sakura/generation-types";
import type { BriefContext, BriefInputConfidence } from "@/lib/ai-brief/types";
import type { LlmProvider } from "@/lib/llm/provider";
import { generateChineseAskAnswer } from "./ask-generate";
import { buildChineseDemoAnswer } from "./ask-demo";

export type ChineseAskServiceStatus = "generated" | "insufficient_grounded_data" | "unavailable";
export interface ChineseAskServiceResult {
  mode: "demo" | "live";
  status: ChineseAskServiceStatus;
  contextFingerprint: string | null;
  inputConfidence: BriefInputConfidence | null;
  selectedFactCount: number;
  answer: AskSakuraAnswer | null;
  reason:
    | "provider_error"
    | "schema_validation_failed"
    | "grounding_validation_failed"
    | "config_error"
    | null;
}
export interface ChineseAskService {
  ask(question: string): Promise<ChineseAskServiceResult>;
}
export interface ChineseAskServiceDeps {
  mode: "demo" | "live";
  contextBuilder: () => BriefContext | Promise<BriefContext>;
  provider: LlmProvider;
}

export function createChineseAskService(deps: ChineseAskServiceDeps): ChineseAskService {
  return {
    async ask(question) {
      const context = await deps.contextBuilder();
      if (context.inputConfidence.label === "insufficient")
        return {
          mode: deps.mode,
          status: "insufficient_grounded_data",
          contextFingerprint: context.fingerprint,
          inputConfidence: context.inputConfidence,
          selectedFactCount: 0,
          answer: null,
          reason: null,
        };
      const selection = selectEvidenceForQuestion(context, question);
      if (deps.mode === "demo") {
        const answer = buildChineseDemoAnswer(question, context);
        return {
          mode: "demo",
          status: "generated",
          contextFingerprint: context.fingerprint,
          inputConfidence: context.inputConfidence,
          selectedFactCount: selection.selectedFactIds.length,
          answer,
          reason: null,
        };
      }
      const generated = await generateChineseAskAnswer({
        question,
        selection,
        inputConfidence: context.inputConfidence,
        fingerprint: context.fingerprint,
        provider: deps.provider,
      });
      return {
        mode: deps.mode,
        status: generated.status,
        contextFingerprint: context.fingerprint,
        inputConfidence: context.inputConfidence,
        selectedFactCount: selection.selectedFactIds.length,
        answer: generated.status === "generated" ? generated.answer : null,
        reason: generated.status === "unavailable" ? generated.reason : null,
      };
    },
  };
}

export interface ChineseAskHttpDeps {
  getService: () => ChineseAskService | Promise<ChineseAskService>;
}
const noStore = { "Cache-Control": "no-store" };

export async function handleChineseAskWarRoomPost(
  rawBody: string | null,
  input: ChineseAskHttpDeps,
): Promise<NextResponse> {
  let body: unknown;
  try {
    body = rawBody && rawBody.length > 0 ? JSON.parse(rawBody) : null;
  } catch {
    return NextResponse.json(
      {
        error: {
          code: "invalid_request",
          message: "Request body must be valid JSON with a single 'question' field.",
        },
      },
      { status: 400, headers: noStore },
    );
  }
  const parsed = parseAskQuestion(body);
  if (!parsed.ok) {
    const message =
      parsed.code === "too_long"
        ? `Question must be at most ${ASK_MAX_QUESTION_LENGTH} characters.`
        : parsed.code === "too_short"
          ? "Question must contain at least 2 meaningful characters."
          : "Request body must contain exactly one 'question' string field.";
    return NextResponse.json(
      { error: { code: parsed.code, message } },
      { status: 400, headers: noStore },
    );
  }
  try {
    const result = await (await input.getService()).ask(parsed.question);
    return NextResponse.json(result, {
      status: result.status === "unavailable" ? 503 : 200,
      headers: noStore,
    });
  } catch {
    return NextResponse.json(
      {
        mode: "live",
        status: "unavailable",
        contextFingerprint: null,
        inputConfidence: null,
        selectedFactCount: 0,
        answer: null,
        reason: "config_error",
      },
      { status: 503, headers: noStore },
    );
  }
}

export function resultReason(result: AskGenerationResult): ChineseAskServiceResult["reason"] {
  return result.status === "unavailable" ? result.reason : null;
}
