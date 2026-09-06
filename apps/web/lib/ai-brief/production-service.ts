import { NextResponse } from "next/server";
import { resolveLlmConfig } from "@/lib/llm/config";
import { createOpenAiCompatibleProvider } from "@/lib/llm/provider";
import { createAiBriefService, type AiBriefService, type AiBriefServiceResult } from "./service";
import { buildDemoBriefContext } from "./demo-context";
import { buildLiveBriefContext } from "./live-context";

export type AiBriefProductionMode = "demo" | "live";

/** AI_BRIEF_MODE resolution. Absent/invalid explicit values never become live→demo. */
export function resolveAiBriefMode(env: Record<string, string | undefined> = process.env): AiBriefProductionMode {
  const value = env.AI_BRIEF_MODE?.trim().toLowerCase();
  if (value === undefined || value === "") return "demo";
  if (value === "demo" || value === "live") return value;
  throw new Error("invalid AI_BRIEF_MODE");
}

/** Demo-only provider: throws if somehow invoked — demo mode never calls an LLM. */
function neverProvider() {
  return {
    async complete(): Promise<never> {
      throw new Error("demo service must never call an LLM provider");
    },
  };
}

export function createProductionAiBriefService(mode: AiBriefProductionMode = resolveAiBriefMode()): AiBriefService {
  if (mode === "demo") {
    return createAiBriefService({ mode: "demo", demoContextBuilder: () => buildDemoBriefContext(), provider: neverProvider() });
  }
  // Live mode: never falls back to demo. Missing LLM config throws here and is
  // caught at the HTTP boundary as configuration_error.
  const config = resolveLlmConfig();
  return createAiBriefService({
    mode: "live",
    liveContextBuilder: () => buildLiveBriefContext(),
    provider: createOpenAiCompatibleProvider({
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
      model: config.model,
      timeoutMs: config.timeoutMs,
      temperature: config.temperature,
      structuredOutput: config.structuredOutput,
      thinkingMode: config.thinkingMode,
    }),
    modelIdentity: config.model,
  });
}

let productionService: AiBriefService | null = null;
export function getProductionAiBriefService(): AiBriefService {
  if (!productionService) productionService = createProductionAiBriefService();
  return productionService;
}
/** Test-only reset; never exposed over HTTP. */
export function resetProductionAiBriefServiceForTests(): void {
  productionService = null;
}

function safeBody(result: AiBriefServiceResult | { mode: "live" | null; status: "unavailable"; brief: null; reason: string }) {
  return result;
}

/** Injectable HTTP boundary so tests avoid env/network. */
export async function handleAiMarketBriefGet(input: { getService: () => AiBriefService | Promise<AiBriefService> }): Promise<NextResponse> {
  const noStore = { "Cache-Control": "no-store" };
  try {
    const service = await input.getService();
    const result = await service.generate();
    if (result.status === "unavailable") {
      return NextResponse.json(safeBody(result), { status: 503, headers: noStore });
    }
    return NextResponse.json(safeBody(result), { status: 200, headers: noStore });
  } catch {
    return NextResponse.json({ mode: "live" as const, status: "unavailable" as const, brief: null, reason: "configuration_error" }, { status: 503, headers: noStore });
  }
}
