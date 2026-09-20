import { describe, expect, it } from "vitest";
import { buildDemoBriefContext } from "@/lib/ai-brief/demo-context";
import { buildAiEvidenceContext, handleAiEvidenceGet } from "@/lib/ai-brief/evidence-endpoint";
import type { AiEvidenceApiResponse } from "@/lib/ai-brief/evidence-api-types";

function demoContextBuilder() {
  return buildDemoBriefContext();
}

describe("GET /api/ai/evidence safe projection", () => {
  it("demo mode returns the grounded evidence pack", async () => {
    const response = await handleAiEvidenceGet({
      mode: "demo",
      contextBuilder: demoContextBuilder,
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    const body = (await response.json()) as AiEvidenceApiResponse;
    expect(body.status).toBe("ok");
    if (body.status !== "ok") return;
    expect(body.mode).toBe("demo");
    expect(body.context.version).toBe("brief-context-v1");
    expect(body.context.evidence.length).toBe(49);
    expect(body.context.evidence.length).toBeLessThanOrEqual(50);
  });

  it("exposes fingerprint, all six source metas and input confidence", async () => {
    const response = await handleAiEvidenceGet({
      mode: "demo",
      contextBuilder: demoContextBuilder,
    });
    const body = (await response.json()) as AiEvidenceApiResponse;
    if (body.status !== "ok") throw new Error("expected ok");
    expect(body.context.fingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(Object.keys(body.context.sources).sort()).toEqual([
      "anomalies",
      "breadth",
      "catalysts",
      "macro",
      "market",
      "regime",
    ]);
    expect(body.context.inputConfidence.score).toBeGreaterThan(0);
    expect(body.context.inputConfidence.label).toBeTruthy();
  });

  it("returns ONLY the model-facing fact projection — no EvidenceFact.data", async () => {
    const response = await handleAiEvidenceGet({
      mode: "demo",
      contextBuilder: demoContextBuilder,
    });
    const body = (await response.json()) as AiEvidenceApiResponse;
    const raw = JSON.stringify(body);
    expect(raw).not.toContain('"data":');
    expect(raw).not.toMatch(/(alpaca|fred|twelve|sec_submission|news_body|headline|url)/i);
    if (body.status !== "ok") throw new Error("expected ok");
    for (const fact of body.context.evidence) {
      expect(Object.keys(fact).sort()).toEqual([
        "asOf",
        "confidence",
        "domain",
        "freshness",
        "id",
        "sourceVersion",
        "text",
      ]);
      expect(fact).not.toHaveProperty("data");
    }
  });

  it("never exposes prompts, provider bodies, keys or reasoning", async () => {
    const response = await handleAiEvidenceGet({
      mode: "demo",
      contextBuilder: demoContextBuilder,
    });
    const raw = JSON.stringify(await response.json());
    for (const token of [
      "BEGIN_UNTRUSTED",
      "END_UNTRUSTED",
      "system prompt",
      "repair prompt",
      "reasoning_content",
      "LLM_API_KEY",
      "ALPACA_API_SECRET_KEY",
      "FRED_API_KEY",
      "apiKey",
    ]) {
      expect(raw).not.toContain(token);
    }
  });

  it("preserves the sealed stable id ordering for All (no client rerank source)", async () => {
    const context = buildDemoBriefContext();
    const projected = buildAiEvidenceContext(context);
    const sorted = [...projected.evidence].sort((a, b) => a.id.localeCompare(b.id));
    expect(projected.evidence.map((fact) => fact.id)).toEqual(sorted.map((fact) => fact.id));
  });

  it("live failure returns 503 and never falls back to demo", async () => {
    const response = await handleAiEvidenceGet({
      mode: "live",
      contextBuilder: () => Promise.reject(new Error("boom")),
    });
    expect(response.status).toBe(503);
    const body = (await response.json()) as AiEvidenceApiResponse;
    expect(body).toMatchObject({ mode: "live", status: "unavailable" });
    expect(body).not.toHaveProperty("context");
  });
});
