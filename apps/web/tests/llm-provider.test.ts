import { describe, expect, it, vi } from "vitest";
import { createOpenAiCompatibleProvider, type LlmProviderOptions } from "@/lib/llm/provider";
import { resolveLlmConfig, DEFAULT_LLM_TEMPERATURE, DEFAULT_LLM_TIMEOUT_MS } from "@/lib/llm/config";
import { LlmProviderError, type LlmRequest } from "@/lib/llm/types";
import { parseGroundedMarketBrief } from "@/lib/ai-brief/schema";

function makeOptions(overrides: Partial<LlmProviderOptions> = {}): LlmProviderOptions {
  return { baseUrl: "https://llm.test/v1", apiKey: "sk-secret123", model: "test-model", ...overrides };
}
function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
function chatBody(content: string) {
  return { choices: [{ message: { content } }], model: "test-model", usage: { prompt_tokens: 1, completion_tokens: 2 } };
}
const request: LlmRequest = { model: "test-model", messages: [{ role: "system", content: "s" }, { role: "user", content: "u" }] };
const minimalBrief = JSON.stringify({
  version: "ai-brief-v1",
  headline: "h",
  stance: { label: "L", summary: "s", evidenceRefs: ["r"] },
  overview: [{ text: "o", evidenceRefs: ["r"] }],
  keyDrivers: [
    { title: "t", text: "d", impact: "negative", evidenceRefs: ["r"] },
    { title: "t2", text: "d2", impact: "positive", evidenceRefs: ["r"] },
  ],
  marketInternals: { text: "mi", evidenceRefs: ["r"] },
  macro: { text: "ma", evidenceRefs: ["r"] },
  notableMoves: [],
  watchNext: [{ text: "w", evidenceRefs: ["r"] }],
  dataQuality: { confidence: "high", text: "dq", evidenceRefs: ["r"] },
});

describe("llm provider", () => {
  it("sends model/temperature/response_format; API key only in Authorization", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(chatBody(minimalBrief)));
    const provider = createOpenAiCompatibleProvider(makeOptions({ fetchImpl }));
    await provider.complete({ ...request, temperature: 0.25, structuredOutput: "json_object" });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(String(url)).toContain("/chat/completions");
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(body.model).toBe("test-model");
    expect(body.temperature).toBe(0.25);
    expect((body.response_format as { type: string }).type).toBe("json_object");
    const headers = new Headers(init.headers);
    expect(headers.get("Authorization")).toBe("Bearer sk-secret123");
    expect(String(init.body)).not.toContain("sk-secret123");
  });
  it("valid JSON content passes the ai-brief schema end-to-end", async () => {
    const provider = createOpenAiCompatibleProvider(makeOptions({ fetchImpl: async () => jsonResponse(chatBody(minimalBrief)) }));
    const response = await provider.complete(request);
    expect(parseGroundedMarketBrief(JSON.parse(response.content)).ok).toBe(true);
  });
  it("maps 401/403 auth, 429 rate_limit, 5xx server_error", async () => {
    for (const [status, category] of [[401, "auth"], [403, "auth"], [429, "rate_limit"], [500, "server_error"]] as const) {
      const provider = createOpenAiCompatibleProvider(makeOptions({ fetchImpl: async () => new Response("{}", { status }) }));
      await expect(provider.complete(request)).rejects.toMatchObject({ category });
    }
  });
});

describe("llm provider failures", () => {
  it("network failure → network; abort → timeout", async () => {
    const network = createOpenAiCompatibleProvider(makeOptions({ fetchImpl: async () => { throw new Error("ECONNREFUSED"); } }));
    await expect(network.complete(request)).rejects.toMatchObject({ category: "network" });
    const abort = createOpenAiCompatibleProvider(makeOptions({ timeoutMs: 20, fetchImpl: (_url, init) => new Promise((_resolve, reject) => { const error = new Error("Aborted"); error.name = "AbortError"; init?.signal?.addEventListener("abort", () => reject(error)); }) }));
    await expect(abort.complete(request)).rejects.toMatchObject({ category: "timeout" });
  });
  it("malformed body JSON → invalid_response; schema-invalid content fails schema", async () => {
    const malformed = createOpenAiCompatibleProvider(makeOptions({ fetchImpl: async () => new Response("<html>", { status: 200 }) }));
    await expect(malformed.complete(request)).rejects.toMatchObject({ category: "invalid_response" });
    const provider = createOpenAiCompatibleProvider(makeOptions({ fetchImpl: async () => jsonResponse(chatBody('{"version":"ai-brief-v2"}')) }));
    const response = await provider.complete(request);
    expect(parseGroundedMarketBrief(JSON.parse(response.content)).ok).toBe(false);
  });
  it("errors never leak keys and no retry occurs", async () => {
    let calls = 0;
    const provider = createOpenAiCompatibleProvider(makeOptions({ fetchImpl: async () => { calls += 1; throw new Error("sk-secret123 leaked"); } }));
    try {
      await provider.complete(request);
    } catch (error) {
      expect(String(error)).not.toContain("sk-secret123");
    }
    expect(calls).toBe(1);
  });
});

describe("config and types", () => {
  it("requires live env values and resolves deterministic defaults", () => {
    expect(() => resolveLlmConfig({})).toThrow(/LLM_BASE_URL/);
    const config = resolveLlmConfig({ LLM_BASE_URL: "https://x", LLM_API_KEY: "k", LLM_MODEL: "m" });
    expect(config.timeoutMs).toBe(DEFAULT_LLM_TIMEOUT_MS);
    expect(config.temperature).toBe(DEFAULT_LLM_TEMPERATURE);
    expect(config.apiKey).toBe("k");
  });
  it("provider creation rejects missing required options with config category", () => {
    expect(() => createOpenAiCompatibleProvider({ baseUrl: "https://x", apiKey: "", model: "m" })).toThrow(LlmProviderError);
    expect(() => createOpenAiCompatibleProvider({ baseUrl: "", apiKey: "k", model: "m" })).toThrow(LlmProviderError);
  });
  it("LlmProviderError preserves category/status and never carries keys", () => {
    const error = new LlmProviderError("rate_limit", "slow down", 429);
    expect(error.category).toBe("rate_limit");
    expect(error.status).toBe(429);
    expect(error.message).not.toContain("sk-");
  });
});

