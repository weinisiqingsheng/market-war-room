import { AI_BRIEF_VERSION } from "./brief-types";
import type { GroundedMarketBrief } from "./brief-types";
import type { BriefContext, BriefInputConfidence } from "./types";
import type { LlmProvider } from "@/lib/llm/provider";
import { generateGroundedMarketBrief } from "./generate";
import { buildDemoGroundedBrief } from "./demo-brief";
import { createAiBriefCache, type AiBriefCache } from "./cache";

export type AiBriefServiceStatus = "generated" | "cached" | "insufficient_grounded_data" | "unavailable";

export interface AiBriefServiceResult {
  mode: "demo" | "live";
  status: AiBriefServiceStatus;
  brief: GroundedMarketBrief | null;
  contextFingerprint?: string;
  inputConfidence?: BriefInputConfidence;
  cache: { hit: boolean };
  reason?: "provider_error" | "schema_validation_failed" | "grounding_validation_failed";
}

export interface CachedArtifact {
  brief: GroundedMarketBrief;
  contextFingerprint: string;
  inputConfidence: BriefInputConfidence;
  generatedAt: string;
  modelIdentity: string;
}

export interface AiBriefServiceDeps {
  mode: "demo" | "live";
  demoContextBuilder?: () => BriefContext;
  liveContextBuilder?: () => Promise<BriefContext>;
  provider: LlmProvider;
  cache?: AiBriefCache<CachedArtifact>;
  modelIdentity?: string;
  now?: () => number;
}

export interface AiBriefService {
  generate(options?: { now?: number }): Promise<AiBriefServiceResult>;
}

/** Cache namespace: prompt/schema version + model identity + evidence fingerprint. */
function cacheKey(modelIdentity: string, fingerprint: string): string {
  return `${AI_BRIEF_VERSION}:${modelIdentity}:${fingerprint}`;
}

export function createAiBriefService(deps: AiBriefServiceDeps): AiBriefService {
  const mode = deps.mode;
  const cache = deps.cache ?? createAiBriefCache<CachedArtifact>();
  const modelIdentity = deps.modelIdentity ?? "default-model";
  const inflight = new Map<string, Promise<AiBriefServiceResult>>();

  return {
    async generate(options = {}) {
      if (mode === "demo") {
        return { mode, status: "generated", brief: buildDemoGroundedBrief(), cache: { hit: false } };
      }
      if (!deps.liveContextBuilder) throw new Error("live mode requires liveContextBuilder");
      const context = await deps.liveContextBuilder();
      const fingerprint = context.fingerprint;
      const key = cacheKey(modelIdentity, fingerprint);
      const now = options.now ?? deps.now?.() ?? Date.now();

      const cached = cache.get(key, now);
      if (cached) {
        return { mode, status: "cached", brief: cached.brief, contextFingerprint: cached.contextFingerprint, inputConfidence: cached.inputConfidence, cache: { hit: true } };
      }
      if (context.inputConfidence.label === "insufficient") {
        return { mode, status: "insufficient_grounded_data", brief: null, contextFingerprint: fingerprint, inputConfidence: context.inputConfidence, cache: { hit: false } };
      }

      const existing = inflight.get(key);
      if (existing) return existing;
      const run = (async (): Promise<AiBriefServiceResult> => {
        const generation = await generateGroundedMarketBrief({ context, provider: deps.provider });
        if (generation.status === "generated") {
          cache.set(key, { brief: generation.brief, contextFingerprint: fingerprint, inputConfidence: context.inputConfidence, generatedAt: context.generatedAt, modelIdentity }, now);
          return { mode, status: "generated", brief: generation.brief, contextFingerprint: fingerprint, inputConfidence: context.inputConfidence, cache: { hit: false } };
        }
        if (generation.status === "insufficient_grounded_data") {
          return { mode, status: "insufficient_grounded_data", brief: null, contextFingerprint: fingerprint, inputConfidence: context.inputConfidence, cache: { hit: false } };
        }
        return { mode, status: "unavailable", brief: null, contextFingerprint: fingerprint, inputConfidence: context.inputConfidence, cache: { hit: false }, reason: generation.reason };
      })();
      inflight.set(key, run);
      try {
        return await run;
      } finally {
        if (inflight.get(key) === run) inflight.delete(key);
      }
    },
  };
}
