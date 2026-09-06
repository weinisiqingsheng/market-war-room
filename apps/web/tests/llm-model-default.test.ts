import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createOpenAiCompatibleProvider } from "@/lib/llm/provider";
import { generateGroundedMarketBrief } from "@/lib/ai-brief/generate";
import { buildDemoBriefContext } from "@/lib/ai-brief/demo-context";
import { buildDemoGroundedBrief } from "@/lib/ai-brief/demo-brief";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("provider model default regression (DeepSeek fix)", () => {
  it("provider uses configured options.model when request omits model", async () => {
    let captured: Record<string, unknown> = {};
    const provider = createOpenAiCompatibleProvider({ baseUrl: "https://api.deepseek.com", apiKey: "k", model: "deepseek-v4-pro", fetchImpl: async (_url, init) => { captured = JSON.parse(String(init?.body)); return jsonResponse({ choices: [{ message: { content: "{}" } }] }); } });
    await provider.complete({ messages: [{ role: "system", content: "s" }], temperature: 0.2, structuredOutput: "json_object" });
    expect(captured.model).toBe("deepseek-v4-pro");
    expect(captured.model).not.toBe("model");
  });
  it("generation without input.model uses configured model and never sends the fake string", async () => {
    let captured: Record<string, unknown> = {};
    const provider = createOpenAiCompatibleProvider({ baseUrl: "https://api.deepseek.com", apiKey: "k", model: "deepseek-v4-pro", fetchImpl: async (_url, init) => { captured = JSON.parse(String(init?.body)); return jsonResponse({ choices: [{ message: { content: JSON.stringify(buildDemoGroundedBrief()) } }] }); } });
    const result = await generateGroundedMarketBrief({ context: buildDemoBriefContext(), provider });
    expect(result.status).toBe("generated");
    expect(captured.model).toBe("deepseek-v4-pro");
    expect(captured.model).not.toBe("model");
    expect(captured.response_format).toEqual({ type: "json_object" });
    expect(captured.temperature).toBe(0.2);
  });
  it("explicit input.model override still reaches the provider", async () => {
    let captured: Record<string, unknown> = {};
    const provider = createOpenAiCompatibleProvider({ baseUrl: "https://api.deepseek.com", apiKey: "k", model: "deepseek-v4-pro", fetchImpl: async (_url, init) => { captured = JSON.parse(String(init?.body)); return jsonResponse({ choices: [{ message: { content: JSON.stringify(buildDemoGroundedBrief()) } }] }); } });
    const result = await generateGroundedMarketBrief({ context: buildDemoBriefContext(), provider, model: "override-model" });
    expect(result.status).toBe("generated");
    expect(captured.model).toBe("override-model");
  });
  it("the fake fallback no longer exists in the generation path", () => {
    const source = readFileSync(resolve("lib/ai-brief/generate.ts"), "utf8");
    expect(source).not.toContain('?? "model"');
  });
});
