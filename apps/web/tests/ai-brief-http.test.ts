import { describe, expect, it } from "vitest";
import { resolveAiBriefMode, createProductionAiBriefService, getProductionAiBriefService, resetProductionAiBriefServiceForTests, handleAiMarketBriefGet } from "@/lib/ai-brief/production-service";
import type { AiBriefService, AiBriefServiceResult } from "@/lib/ai-brief/service";

function result(status: AiBriefServiceResult["status"]): AiBriefServiceResult {
  return { mode: "live", status, brief: null, cache: { hit: false } } as AiBriefServiceResult;
}
function fakeService(status: AiBriefServiceResult["status"]): AiBriefService {
  return { generate: async () => result(status) } as AiBriefService;
}

describe("production AI brief wiring", () => {
  it("mode resolution: absent/demo → demo, live → live, invalid rejects", () => {
    expect(resolveAiBriefMode({})).toBe("demo");
    expect(resolveAiBriefMode({ AI_BRIEF_MODE: "demo" })).toBe("demo");
    expect(resolveAiBriefMode({ AI_BRIEF_MODE: "live" })).toBe("live");
    expect(() => resolveAiBriefMode({ AI_BRIEF_MODE: "edge" })).toThrow();
  });
  it("demo factory builds without LLM config and demo request returns 200", async () => {
    resetProductionAiBriefServiceForTests();
    const service = createProductionAiBriefService("demo");
    const response = await handleAiMarketBriefGet({ getService: () => service });
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    const body = (await response.json()) as { status: string; brief: { version?: string } | null };
    expect(body.status).toBe("generated");
    expect(body.brief?.version).toBe("ai-brief-v1");
  });
  it("singleton getter returns the same service instance", () => {
    resetProductionAiBriefServiceForTests();
    const a = getProductionAiBriefService();
    const b = getProductionAiBriefService();
    expect(a).toBe(b);
    resetProductionAiBriefServiceForTests();
  });
  it("HTTP status mapping and cache header", async () => {
    for (const status of ["generated", "cached", "insufficient_grounded_data"]) {
      const response = await handleAiMarketBriefGet({ getService: () => fakeService(status as AiBriefServiceResult["status"]) });
      expect(response.status).toBe(200);
    }
    const unavailable = await handleAiMarketBriefGet({ getService: () => fakeService("unavailable") });
    expect(unavailable.status).toBe(503);
  });
  it("throwing factory/secretful error → safe 503 configuration_error", async () => {
    const response = await handleAiMarketBriefGet({ getService: () => { throw new Error("ALPACA_API_SECRET_KEY=SUPER_SECRET_123\nstacktrace"); } });
    expect(response.status).toBe(503);
    const text = await response.text();
    expect(text).not.toContain("SUPER_SECRET_123");
    expect(text).not.toContain("stacktrace");
    expect(text).toContain("configuration_error");
  });
  it("live factory with missing LLM config fails safely via handler", async () => {
    const response = await handleAiMarketBriefGet({ getService: () => createProductionAiBriefService("live") });
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body).toMatchObject({ status: "unavailable", brief: null, reason: "configuration_error" });
  });
});
