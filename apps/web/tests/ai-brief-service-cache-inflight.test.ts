import { describe, expect, it } from "vitest";
import { createAiBriefService } from "@/lib/ai-brief/service";
import { createAiBriefCache } from "@/lib/ai-brief/cache";
import { buildDemoBriefContext, DEMO_GENERATED_AT, demoContextInputs } from "@/lib/ai-brief/demo-context";
import { buildDemoGroundedBrief } from "@/lib/ai-brief/demo-brief";
import { buildBriefContext } from "@/lib/ai-brief/context";
import type { BriefContext } from "@/lib/ai-brief/types";

function makeProvider(sequence: Array<() => string | Error> = []) {
  let calls = 0;
  return {
    provider: {
      async complete(request: { model?: string; messages: unknown[]; temperature?: number; structuredOutput?: string }) {
        calls += 1;
        const step = sequence[calls - 1];
        const result = step ? step() : JSON.stringify(buildDemoGroundedBrief());
        if (result instanceof Error) throw result;
        return { content: result, model: request.model };
      },
    },
    count: () => calls,
  };
}

function insufficientContext(): BriefContext {
  const inputs = demoContextInputs();
  for (const key of Object.keys(inputs.sources) as Array<keyof typeof inputs.sources>) {
    const meta = { available: false, asOf: null, freshness: "unavailable" as const, confidence: null, version: null };
    inputs.sources[key] = meta;
    inputs.confidenceInput[key].meta = meta;
  }
  return buildBriefContext({ generatedAt: DEMO_GENERATED_AT, evidenceInput: inputs.evidenceInput, sources: inputs.sources, confidenceInput: inputs.confidenceInput });
}

describe("ai-brief service — inflight, insufficient, failures", () => {
  it("two concurrent same-fingerprint requests generate once and both get cached-equivalent results", async () => {
    const mock = makeProvider();
    const { provider: llm, count } = mock;
    const context = buildDemoBriefContext();
    const service = createAiBriefService({ mode: "live", liveContextBuilder: async () => context, provider: llm, cache: createAiBriefCache() });
    const [a, b] = await Promise.all([service.generate(), service.generate()]);
    expect(count()).toBe(1);
    expect(a.status).toBe("generated");
    expect(b.status).toBe("generated");
    expect(a).toEqual(b);
    const third = await service.generate();
    expect(third.status).toBe("cached");
    expect(count()).toBe(1);
  });
  it("shared unavailable failure is not cached; later request retries generation", async () => {
    const mk = makeProvider([() => Object.assign(new Error("auth"), { category: "auth" })]);
    const { provider: llm, count } = mk;
    const context = buildDemoBriefContext();
    const service = createAiBriefService({ mode: "live", liveContextBuilder: async () => context, provider: llm, cache: createAiBriefCache() });
    const [a, b] = await Promise.all([service.generate(), service.generate()]);
    expect(count()).toBe(1);
    expect(a.status).toBe("unavailable");
    expect(b.status).toBe("unavailable");
    expect(a).toEqual(b);
    const retry = await service.generate();
    expect(retry.status).toBe("generated");
    expect(count()).toBe(2);
  });
  it("insufficient context → zero provider calls and not cached", async () => {
    const mk = makeProvider(); const { provider: llm, count } = mk;
    const service = createAiBriefService({ mode: "live", liveContextBuilder: async () => insufficientContext(), provider: llm, cache: createAiBriefCache() });
    const result = await service.generate();
    expect(result.status).toBe("insufficient_grounded_data");
    expect(count()).toBe(0);
  });
  it("different fingerprints generate independently", async () => {
    const mk = makeProvider(); const { provider: llm, count } = mk;
    const a = buildDemoBriefContext();
    const bInputs = demoContextInputs();
    bInputs.evidenceInput.market!.indices[0] = { ticker: "SPY", changePct: 0.4 };
    const b = buildBriefContext({ generatedAt: DEMO_GENERATED_AT, evidenceInput: bInputs.evidenceInput, sources: bInputs.sources, confidenceInput: bInputs.confidenceInput });
    const contexts = [a, b];
    let index = 0;
    const service = createAiBriefService({ mode: "live", liveContextBuilder: async () => contexts[index++], provider: llm, cache: createAiBriefCache() });
    const [x, y] = await Promise.all([service.generate(), service.generate()]);
    expect(x.status).toBe("generated");
    expect(y.status).toBe("generated");
    expect(count()).toBe(2);
  });
});
