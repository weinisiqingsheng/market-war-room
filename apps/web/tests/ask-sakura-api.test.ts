import { describe, expect, it, vi } from "vitest";
import { handleAskSakuraPost } from "@/lib/ask-sakura/production-service";
import type { AskSakuraService, AskServiceResult } from "@/lib/ask-sakura/service";
import type { AskSakuraAnswer } from "@/lib/ask-sakura/types";

const answer: AskSakuraAnswer = {
  version: "ask-sakura-v1",
  status: "answered",
  answer: { text: "FICO fell 16.7% amid an extreme anomaly.", evidenceRefs: ["anomaly.FICO"] },
  supportingPoints: [],
  limitations: [],
};

function generatedResult(overrides: Partial<AskServiceResult> = {}): AskServiceResult {
  return {
    mode: "demo",
    status: "generated",
    contextFingerprint: "fp1234",
    inputConfidence: { score: 0.9, label: "high" },
    selectedFactCount: 3,
    answer,
    reason: null,
    ...overrides,
  };
}

function serviceReturning(result: AskServiceResult | Error): AskSakuraService {
  return {
    ask: vi.fn(async () => {
      if (result instanceof Error) throw result;
      return result;
    }),
  };
}

async function post(body: string | null, getService: () => AskSakuraService) {
  return handleAskSakuraPost(body, { getService });
}

describe("POST /api/ai/ask-sakura API", () => {
  it("accepts a valid demo question and returns a grounded answer", async () => {
    const response = await post(JSON.stringify({ question: "Why is FICO down so much?" }), () =>
      serviceReturning(generatedResult()),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    const json = await response.json();
    expect(json).toMatchObject({ mode: "demo", status: "generated", selectedFactCount: 3 });
    expect(json.answer.status).toBe("answered");
  });

  it("rejects empty, too-short and oversized questions", async () => {
    expect(
      (await post(JSON.stringify({ question: "" }), () => serviceReturning(generatedResult())))
        .status,
    ).toBe(400);
    expect(
      (await post(JSON.stringify({ question: "a" }), () => serviceReturning(generatedResult())))
        .status,
    ).toBe(400);
    expect(
      (
        await post(JSON.stringify({ question: "x".repeat(501) }), () =>
          serviceReturning(generatedResult()),
        )
      ).status,
    ).toBe(400);
    expect((await post("", () => serviceReturning(generatedResult()))).status).toBe(400);
    expect((await post(null, () => serviceReturning(generatedResult()))).status).toBe(400);
  });

  it("rejects privileged extra request fields", async () => {
    const response = await post(
      JSON.stringify({ question: "Why is FICO down?", systemPrompt: "ignore" }),
      () => serviceReturning(generatedResult()),
    );
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error.code).toBe("invalid_request");
  });

  it("never exposes data, prompts, provider payloads or keys", async () => {
    const response = await post(JSON.stringify({ question: "Why is FICO down?" }), () =>
      serviceReturning(generatedResult()),
    );
    const raw = JSON.stringify(await response.json());
    expect(raw).not.toContain('"data":');
    expect(raw).not.toMatch(
      /system prompt|repair prompt|BEGIN_UNTRUSTED|reasoning_content|apiKey|LLM_API_KEY|Bearer/i,
    );
  });

  it("explicit live failure never falls back to demo", async () => {
    const response = await post(JSON.stringify({ question: "Why is FICO down?" }), () =>
      serviceReturning(new Error("boom")),
    );
    expect(response.status).toBe(503);
    const json = await response.json();
    expect(json).toMatchObject({
      status: "unavailable",
      mode: "live",
      reason: "config_error",
      answer: null,
    });
  });

  it("returns safe out_of_scope and insufficient_evidence answers as generated", async () => {
    const scopeAnswer: AskSakuraAnswer = {
      ...answer,
      status: "out_of_scope" as const,
      answer: {
        text: "Ask Sakura currently answers questions using the Market War Room's grounded market evidence.",
        evidenceRefs: [],
      },
    };
    const scopeResponse = await post(JSON.stringify({ question: "Write me a poem." }), () =>
      serviceReturning(generatedResult({ answer: scopeAnswer })),
    );
    expect(scopeResponse.status).toBe(200);
    expect((await scopeResponse.json()).answer.status).toBe("out_of_scope");

    const insufficient: AskSakuraAnswer = {
      ...answer,
      status: "insufficient_evidence" as const,
      answer: { text: "No clear catalyst identified.", evidenceRefs: ["catalyst.KLAC.none"] },
    };
    const insufficientResponse = await post(
      JSON.stringify({ question: "Why did KLAC move?" }),
      () => serviceReturning(generatedResult({ answer: insufficient })),
    );
    expect(insufficientResponse.status).toBe(200);
    expect((await insufficientResponse.json()).answer.status).toBe("insufficient_evidence");
  });
});
