import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createOpenAiCompatibleProvider } from "@/lib/llm/provider";
import { resolveLlmConfig } from "@/lib/llm/config";

function capturingProvider(options: { thinkingMode?: "disabled" | "enabled" }, bodyCapture: { current: Record<string, unknown> }) {
  return createOpenAiCompatibleProvider({
    baseUrl: "https://api.deepseek.com",
    apiKey: "k",
    model: "deepseek-v4-pro",
    thinkingMode: options.thinkingMode,
    fetchImpl: async (_url, init) => {
      bodyCapture.current = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return new Response(JSON.stringify({ choices: [{ message: { content: "{}" } }] }), { status: 200, headers: { "Content-Type": "application/json" } });
    },
  });
}

describe("thinking mode + timeout taxonomy", () => {
  it("absent config sends no thinking field; disabled/enabled send thinking", async () => {
    const none = { current: {} as Record<string, unknown> };
    await capturingProvider({}, none).complete({ messages: [{ role: "system", content: "s" }], structuredOutput: "json_object" });
    expect(none.current).not.toHaveProperty("thinking");
    const disabled = { current: {} as Record<string, unknown> };
    await capturingProvider({ thinkingMode: "disabled" }, disabled).complete({ messages: [{ role: "system", content: "s" }], structuredOutput: "json_object" });
    expect(disabled.current.thinking).toEqual({ type: "disabled" });
    const enabled = { current: {} as Record<string, unknown> };
    await capturingProvider({ thinkingMode: "enabled" }, enabled).complete({ messages: [{ role: "system", content: "s" }], structuredOutput: "json_object" });
    expect(enabled.current.thinking).toEqual({ type: "enabled" });
  });
  it("per-request thinking override wins", async () => {
    const capture = { current: {} as Record<string, unknown> };
    const provider = capturingProvider({}, capture);
    await provider.complete({ messages: [], structuredOutput: "json_object", thinking: { type: "disabled" } });
    expect(capture.current.thinking).toEqual({ type: "disabled" });
  });
  it("invalid LLM_THINKING_MODE is a deterministic config error", () => {
    expect(() => resolveLlmConfig({ LLM_BASE_URL: "x", LLM_API_KEY: "k", LLM_MODEL: "m", LLM_THINKING_MODE: "auto" })).toThrow(/LLM_THINKING_MODE/);
    expect(resolveLlmConfig({ LLM_BASE_URL: "x", LLM_API_KEY: "k", LLM_MODEL: "m" }).thinkingMode).toBeUndefined();
  });
  it("abort during body read classifies as timeout, not invalid_response", async () => {
    const provider = createOpenAiCompatibleProvider({
      baseUrl: "https://x",
      apiKey: "k",
      model: "m",
      timeoutMs: 20,
      fetchImpl: (_url, init) =>
        new Promise<Response>((resolvePromise) => {
          const response = {
            ok: true,
            status: 200,
            json: () =>
              new Promise((_resolve, reject) => {
                const error = new Error("Aborted");
                error.name = "AbortError";
                init?.signal?.addEventListener("abort", () => reject(error));
              }),
          } as unknown as Response;
          resolvePromise(response);
        }),
    });
    await expect(provider.complete({ messages: [] })).rejects.toMatchObject({ category: "timeout" });
  });
  it("no provider-specific URL/model branching exists", () => {
    for (const file of ["lib/llm/provider.ts", "lib/llm/config.ts"]) {
      const source = readFileSync(resolve(file), "utf8");
      expect(source).not.toContain("baseUrl.includes");
      expect(source).not.toContain("deepseek");
    }
  });
});
