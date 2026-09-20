import { NextResponse } from "next/server";
import { AI_BRIEF_VERSION } from "@/lib/ai-brief/brief-types";
import type { GroundedMarketBrief } from "@/lib/ai-brief/brief-types";
import type { BriefContext, BriefInputConfidence } from "@/lib/ai-brief/types";
import { buildDemoBriefContext } from "@/lib/ai-brief/demo-context";
import { buildLiveBriefContext } from "@/lib/ai-brief/live-context";
import { createAiBriefCache, type AiBriefCache } from "@/lib/ai-brief/cache";
import { resolveLlmConfig } from "@/lib/llm/config";
import { createOpenAiCompatibleProvider, type LlmProvider } from "@/lib/llm/provider";
import { buildChineseDemoGroundedBrief } from "./ai-brief-demo";
import { generateChineseGroundedMarketBrief } from "./ai-brief-generate";

export type ChineseAiBriefServiceStatus =
  "generated" | "cached" | "insufficient_grounded_data" | "unavailable";
export interface ChineseAiBriefServiceResult {
  mode: "demo" | "live";
  status: ChineseAiBriefServiceStatus;
  brief: GroundedMarketBrief | null;
  contextFingerprint?: string;
  inputConfidence?: BriefInputConfidence;
  cache: { hit: boolean };
  reason?: string;
}
interface CachedArtifact {
  brief: GroundedMarketBrief;
  contextFingerprint: string;
  inputConfidence: BriefInputConfidence;
  generatedAt: string;
  modelIdentity: string;
}
interface ChineseServiceDeps {
  mode: "demo" | "live";
  demoContextBuilder?: () => BriefContext;
  liveContextBuilder?: () => Promise<BriefContext>;
  provider: LlmProvider;
  cache?: AiBriefCache<CachedArtifact>;
  modelIdentity?: string;
}

function key(model: string, fingerprint: string) {
  return `zh:${AI_BRIEF_VERSION}:${model}:${fingerprint}`;
}

export function createChineseAiBriefService(deps: ChineseServiceDeps) {
  const cache = deps.cache ?? createAiBriefCache<CachedArtifact>();
  const model = deps.modelIdentity ?? "default-model";
  const inflight = new Map<string, Promise<ChineseAiBriefServiceResult>>();
  return {
    async generate(options: { now?: number } = {}): Promise<ChineseAiBriefServiceResult> {
      if (deps.mode === "demo") {
        deps.demoContextBuilder?.();
        return {
          mode: "demo",
          status: "generated",
          brief: buildChineseDemoGroundedBrief(),
          cache: { hit: false },
        };
      }
      const context = await (deps.liveContextBuilder ?? (() => buildLiveBriefContext()))();
      const cacheKey = key(model, context.fingerprint);
      const cached = cache.get(cacheKey, options.now);
      if (cached)
        return {
          mode: "live",
          status: "cached",
          brief: cached.brief,
          contextFingerprint: cached.contextFingerprint,
          inputConfidence: cached.inputConfidence,
          cache: { hit: true },
        };
      if (context.inputConfidence.label === "insufficient")
        return {
          mode: "live",
          status: "insufficient_grounded_data",
          brief: null,
          contextFingerprint: context.fingerprint,
          inputConfidence: context.inputConfidence,
          cache: { hit: false },
        };
      const existing = inflight.get(cacheKey);
      if (existing) return existing;
      const run = (async (): Promise<ChineseAiBriefServiceResult> => {
        const generated = await generateChineseGroundedMarketBrief({
          context,
          provider: deps.provider,
          model,
        });
        if (generated.status !== "generated")
          return {
            mode: "live",
            status: generated.status,
            brief: null,
            contextFingerprint: context.fingerprint,
            inputConfidence: context.inputConfidence,
            cache: { hit: false },
            reason: generated.status === "unavailable" ? generated.reason : undefined,
          };
        cache.set(
          cacheKey,
          {
            brief: generated.brief,
            contextFingerprint: context.fingerprint,
            inputConfidence: context.inputConfidence,
            generatedAt: context.generatedAt,
            modelIdentity: model,
          },
          options.now,
        );
        return {
          mode: "live",
          status: "generated",
          brief: generated.brief,
          contextFingerprint: context.fingerprint,
          inputConfidence: context.inputConfidence,
          cache: { hit: false },
        };
      })();
      inflight.set(cacheKey, run);
      try {
        return await run;
      } finally {
        if (inflight.get(cacheKey) === run) inflight.delete(cacheKey);
      }
    },
  };
}

let production: ReturnType<typeof createChineseAiBriefService> | null = null;
export type ChineseAiBriefProductionMode = "demo" | "live";
export function resolveChineseAiBriefMode(
  env: Record<string, string | undefined> = process.env,
): ChineseAiBriefProductionMode {
  const value = env.AI_BRIEF_MODE?.trim().toLowerCase();
  if (value === undefined || value === "") return "demo";
  if (value === "demo" || value === "live") return value;
  throw new Error("invalid AI_BRIEF_MODE");
}
function createProductionChineseAiBriefService() {
  const mode = resolveChineseAiBriefMode();
  if (mode === "demo")
    return createChineseAiBriefService({
      mode,
      demoContextBuilder: () => buildDemoBriefContext(),
      provider: {
        complete: async () => {
          throw new Error("demo provider must not be called");
        },
      },
    });
  const config = resolveLlmConfig();
  return createChineseAiBriefService({
    mode,
    liveContextBuilder: () => buildLiveBriefContext(),
    modelIdentity: config.model,
    provider: createOpenAiCompatibleProvider({
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
      model: config.model,
      timeoutMs: config.timeoutMs,
      temperature: config.temperature,
      structuredOutput: config.structuredOutput,
      thinkingMode: config.thinkingMode,
    }),
  });
}
export function getProductionChineseAiBriefService() {
  return production ?? (production = createProductionChineseAiBriefService());
}
export function resetProductionChineseAiBriefServiceForTests() {
  production = null;
}
export async function handleChineseAiMarketBriefGet(): Promise<NextResponse> {
  const headers = { "Cache-Control": "no-store" };
  try {
    const result = await getProductionChineseAiBriefService().generate();
    return NextResponse.json(result, {
      status: result.status === "unavailable" ? 503 : 200,
      headers,
    });
  } catch {
    return NextResponse.json(
      { mode: "live", status: "unavailable", brief: null, reason: "configuration_error" },
      { status: 503, headers },
    );
  }
}
