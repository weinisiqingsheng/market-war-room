import { NextResponse } from "next/server";
import { resolveLlmConfig } from "@/lib/llm/config";
import { createOpenAiCompatibleProvider } from "@/lib/llm/provider";
import { resolveAiBriefMode, type AiBriefProductionMode } from "@/lib/ai-brief/production-service";
import { buildDemoBriefContext } from "@/lib/ai-brief/demo-context";
import { buildLiveBriefContext } from "@/lib/ai-brief/live-context";
import {
  createProductionTickerDeps,
  resolveTickerResearchMode,
} from "@/lib/ticker-context/production-service";
import { researchTicker } from "@/lib/ticker-context/service";
import {
  createAskSakuraService,
  type AskSakuraService,
  type AskServiceResult,
  type AskMode,
} from "./service";
import { parseAskQuestion, ASK_MAX_QUESTION_LENGTH } from "./request";

export function createProductionAskSakuraService(
  mode: AiBriefProductionMode = resolveAiBriefMode(),
): AskSakuraService {
  const config = resolveLlmConfig();
  // V1.2B: on-demand ticker research is server-side and only wired in live mode
  // with TICKER_RESEARCH_MODE=live. Demo never fabricates ticker evidence.
  const tickerDeps =
    mode === "demo" || resolveTickerResearchMode() !== "live" ? null : createProductionTickerDeps();
  return createAskSakuraService({
    mode: mode === "demo" ? "demo" : "live",
    contextBuilder: mode === "demo" ? () => buildDemoBriefContext() : () => buildLiveBriefContext(),
    provider: createOpenAiCompatibleProvider({
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
      model: config.model,
      timeoutMs: config.timeoutMs,
      temperature: config.temperature,
      structuredOutput: config.structuredOutput,
      thinkingMode: config.thinkingMode,
    }),
    tickerResearch: tickerDeps ? (symbol) => researchTicker(symbol, tickerDeps) : undefined,
  });
}

let productionService: AskSakuraService | null = null;
export function getProductionAskSakuraService(): AskSakuraService {
  if (!productionService) productionService = createProductionAskSakuraService();
  return productionService;
}

/** Test-only reset; never exposed over HTTP. */
export function resetProductionAskSakuraServiceForTests(): void {
  productionService = null;
}

export interface AskSakuraHttpDeps {
  getService: () => AskSakuraService | Promise<AskSakuraService>;
}

const noStore = { "Cache-Control": "no-store" };

function safeErrorBody(overrides: Partial<AskServiceResult> = {}): AskServiceResult {
  return {
    mode: "live",
    status: "unavailable",
    contextFingerprint: null,
    inputConfidence: null,
    selectedFactCount: 0,
    answer: null,
    reason: "config_error",
    research: null,
    ...overrides,
  };
}

/** Injectable POST boundary. Body text is supplied by the route (never parsed twice). */
export async function handleAskSakuraPost(
  rawBody: string | null,
  input: AskSakuraHttpDeps,
): Promise<NextResponse> {
  let parsedBody: unknown;
  try {
    parsedBody = rawBody && rawBody.length > 0 ? JSON.parse(rawBody) : null;
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

  const validated = parseAskQuestion(parsedBody);
  if (!validated.ok) {
    const message =
      validated.code === "too_long"
        ? `Question must be at most ${ASK_MAX_QUESTION_LENGTH} characters.`
        : validated.code === "too_short"
          ? "Question must contain at least 2 meaningful characters."
          : "Request body must contain exactly one 'question' string field.";
    return NextResponse.json(
      { error: { code: validated.code, message } },
      { status: 400, headers: noStore },
    );
  }

  try {
    const service = await input.getService();
    const result = await service.ask(validated.question);
    if (result.status === "unavailable") {
      return NextResponse.json(result, { status: 503, headers: noStore });
    }
    return NextResponse.json(result, { status: 200, headers: noStore });
  } catch {
    return NextResponse.json(safeErrorBody(), { status: 503, headers: noStore });
  }
}

export type { AskMode };
