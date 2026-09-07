import { NextRequest, NextResponse } from "next/server";
import { resolveAiBriefMode } from "@/lib/ai-brief/production-service";
import { buildDemoBriefContext } from "@/lib/ai-brief/demo-context";
import { buildLiveBriefContext } from "@/lib/ai-brief/live-context";
import { resolveLlmConfig } from "@/lib/llm/config";
import { createOpenAiCompatibleProvider } from "@/lib/llm/provider";
import { createChineseAskService, handleChineseAskWarRoomPost } from "@/lib/war-room-zh/ask-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let production: ReturnType<typeof createChineseAskService> | null = null;
function getProductionChineseAskService() {
  if (production) return production;
  const mode = resolveAiBriefMode();
  const config = resolveLlmConfig();
  production = createChineseAskService({
    mode: mode === "demo" ? "demo" : "live",
    contextBuilder: mode === "demo" ? () => buildDemoBriefContext() : () => buildLiveBriefContext(),
    provider: createOpenAiCompatibleProvider({ baseUrl: config.baseUrl, apiKey: config.apiKey, model: config.model, timeoutMs: config.timeoutMs, temperature: config.temperature, structuredOutput: config.structuredOutput, thinkingMode: config.thinkingMode }),
  });
  return production;
}

export async function GET() { return new NextResponse(null, { status: 405, headers: { Allow: "POST", "Cache-Control": "no-store" } }); }
export async function POST(request: NextRequest) { return handleChineseAskWarRoomPost(await request.text(), { getService: getProductionChineseAskService }); }
