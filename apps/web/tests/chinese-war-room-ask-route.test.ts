import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const llm = vi.hoisted(() => ({
  resolveConfig: vi.fn(() => {
    throw new Error("demo route must not resolve LLM configuration");
  }),
  createProvider: vi.fn(() => ({ complete: vi.fn() })),
}));

vi.mock("@/lib/llm/config", () => ({ resolveLlmConfig: llm.resolveConfig }));
vi.mock("@/lib/llm/provider", () => ({
  createOpenAiCompatibleProvider: llm.createProvider,
}));

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /api/zh/ai/ask-war-room", () => {
  it("answers a valid demo request through the real route without LLM setup or provider creation", async () => {
    vi.stubEnv("AI_BRIEF_MODE", "demo");
    const { POST } = await import("@/app/api/zh/ai/ask-war-room/route");
    const request = new NextRequest("http://localhost/api/zh/ai/ask-war-room", {
      method: "POST",
      body: JSON.stringify({ question: "FICO 为什么跌这么多？" }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(body).toMatchObject({ mode: "demo", status: "generated" });
    expect(body.answer.answer.text).toMatch(/[\u4e00-\u9fff]/);
    expect(body.answer.answer.evidenceRefs).toContain("anomaly.FICO");
    expect(llm.resolveConfig).not.toHaveBeenCalled();
    expect(llm.createProvider).not.toHaveBeenCalled();
  });
});
