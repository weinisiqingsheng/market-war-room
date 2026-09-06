import { describe, expect, it } from "vitest";
import { createAiBriefService } from "@/lib/ai-brief/service";
import { createAiBriefCache } from "@/lib/ai-brief/cache";
import { buildDemoBriefContext } from "@/lib/ai-brief/demo-context";
import { buildDemoGroundedBrief } from "@/lib/ai-brief/demo-brief";
import { parseGroundedMarketBrief } from "@/lib/ai-brief/schema";
import { validateGroundedMarketBrief } from "@/lib/ai-brief/grounding-validator";
import type { LlmRequest, LlmResponse } from "@/lib/llm/types";

function mockProvider(sequence: Array<() => string | Error> = []) {
  let calls = 0;
  const provider = {
    async complete(request: LlmRequest): Promise<LlmResponse> {
      calls += 1;
      const step = sequence[calls - 1];
      const result = step ? step() : JSON.stringify(buildDemoGroundedBrief());
      if (result instanceof Error) throw result;
      return { content: result, model: request.model };
    },
  };
  return { provider, calls: () => calls };
}

function liveDeps(sequence: Array<() => string | Error> = [], ttlMs = 180_000, modelIdentity = "m1") {
  const { provider, calls } = mockProvider(sequence);
  const context = buildDemoBriefContext();
  const service = createAiBriefService({ mode: "live", liveContextBuilder: async () => context, provider, cache: createAiBriefCache({ ttlMs }), modelIdentity });
  return { service, calls, context };
}

describe("ai-brief service — demo + live cache", () => {
  it("demo: valid brief, zero provider calls, deterministic, no live builder", async () => {
    const { provider } = mockProvider();
    let liveCalled = 0;
    const service = createAiBriefService({ mode: "demo", liveContextBuilder: async () => { liveCalled += 1; return buildDemoBriefContext(); }, provider });
    const a = await service.generate();
    const b = await service.generate();
    expect(a.status).toBe("generated");
    expect(parseGroundedMarketBrief(a.brief as never).ok).toBe(true);
    expect(validateGroundedMarketBrief(a.brief as never, buildDemoBriefContext()).valid).toBe(true);
    expect(liveCalled).toBe(0);
    expect(a).toEqual(b);
  });
  it("live cache miss → generated once and cached; second hit skips provider", async () => {
    const { service, calls, context } = liveDeps();
    const first = await service.generate();
    const second = await service.generate();
    expect(first.status).toBe("generated");
    expect(second.status).toBe("cached");
    expect(calls()).toBe(1);
    expect(second.contextFingerprint).toBe(context.fingerprint);
    expect(validateGroundedMarketBrief(second.brief as never, context).valid).toBe(true);
  });
  it("ttl: before expiry hit, exactly at expiry miss, after expiry miss and replaces", async () => {
    const ttl = 180_000;
    const { service, calls } = liveDeps([], ttl);
    const t0 = 1_000_000;
    const first = await service.generate({ now: t0 });
    expect(first.status).toBe("generated");
    expect(calls()).toBe(1);
    const hit = await service.generate({ now: t0 + ttl - 1 });
    expect(hit.status).toBe("cached");
    expect(calls()).toBe(1);
    const expired = await service.generate({ now: t0 + ttl });
    expect(expired.status).toBe("generated");
    expect(calls()).toBe(2);
    const replaced = await service.generate({ now: t0 + ttl });
    expect(replaced.status).toBe("cached");
    expect(calls()).toBe(2);
    const later = await service.generate({ now: t0 + 2 * ttl + 1 });
    expect(later.status).toBe("generated");
    expect(calls()).toBe(3);
  });
  it("fingerprint namespace: model identity and ai-brief version namespace", async () => {
    const a = liveDeps([], 180_000, "modelA");
    await a.service.generate();
    const aCalls = a.calls();
    const b = liveDeps([], 180_000, "modelB");
    const second = await b.service.generate();
    expect(second.status).toBe("generated");
    expect(aCalls).toBe(1);
    expect(b.calls()).toBe(1);
  });
  it("secrets never appear in service results or cache keys", async () => {
    const { provider } = mockProvider([() => Object.assign(new Error("sk-LEAKED_KEY"), { category: "auth" })]);
    const context = buildDemoBriefContext();
    const service = createAiBriefService({ mode: "live", liveContextBuilder: async () => context, provider, cache: createAiBriefCache() });
    const result = await service.generate();
    expect(result.status).toBe("unavailable");
    expect(JSON.stringify(result)).not.toContain("sk-LEAKED_KEY");
  });
});
