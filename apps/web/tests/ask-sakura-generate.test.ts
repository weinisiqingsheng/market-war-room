import { describe, expect, it, vi } from "vitest";
import { LlmProviderError, type LlmMessage } from "@/lib/llm/types";
import type { EvidenceFact } from "@/lib/ai-brief/types";
import type { BriefInputConfidence } from "@/lib/ai-brief/types";
import { generateAskSakuraAnswer } from "@/lib/ask-sakura/generate";
import { toSafeEvidenceFacts, type AskEvidenceSelection } from "@/lib/ask-sakura/select-evidence";
import type { AskSakuraAnswer } from "@/lib/ask-sakura/types";

const facts: EvidenceFact[] = [
  {
    id: "anomaly.FICO",
    domain: "anomaly",
    text: "FICO fell 16.7% with an EXTREME anomaly score.",
    data: {},
    asOf: null,
    freshness: "delayed",
    confidence: null,
    sourceVersion: "anomaly-v1",
  },
  {
    id: "catalyst.FICO.primary",
    domain: "catalyst",
    text: "FICO's strongest matched catalyst is REGULATORY / LEGAL with strong evidence.",
    data: { evidenceStrength: "strong" },
    asOf: null,
    freshness: "delayed",
    confidence: null,
    sourceVersion: "catalyst-match-v1",
  },
];

const selection: AskEvidenceSelection = {
  facts,
  safeFacts: toSafeEvidenceFacts(facts),
  selectedFactIds: facts.map((f) => f.id),
  detectedTickers: ["FICO"],
  selectionMode: "ticker_scoped",
};

const confidence: BriefInputConfidence = { score: 0.9, label: "high" };

function validAnswer(): AskSakuraAnswer {
  return {
    version: "ask-sakura-v1",
    status: "answered",
    answer: {
      text: "FICO fell 16.7% amid an extreme anomaly and a matched regulatory catalyst.",
      evidenceRefs: ["anomaly.FICO", "catalyst.FICO.primary"],
    },
    supportingPoints: [
      { text: "The matched catalyst evidence is strong.", evidenceRefs: ["catalyst.FICO.primary"] },
    ],
    limitations: [],
  };
}

function validContent(): string {
  return JSON.stringify(validAnswer());
}

function run(contents: Array<string | Error>) {
  const provider = {
    complete: vi.fn(async () => {
      const next = contents.shift();
      if (next instanceof Error) throw next;
      return { content: next ?? "" };
    }),
  };
  return {
    provider,
    resultPromise: generateAskSakuraAnswer({
      question: "Why is FICO down so much?",
      selection,
      inputConfidence: confidence,
      fingerprint: "fp",
      provider,
    }),
  };
}

describe("ask-sakura orchestration", () => {
  it("accepts a valid first response with one provider call", async () => {
    const { provider, resultPromise } = run([validContent()]);
    const result = await resultPromise;
    expect(provider.complete).toHaveBeenCalledTimes(1);
    expect(result.status).toBe("generated");
  });

  it("repairs a schema-invalid response once", async () => {
    const { provider, resultPromise } = run(["not json", validContent()]);
    const result = await resultPromise;
    expect(provider.complete).toHaveBeenCalledTimes(2);
    expect(result.status).toBe("generated");
  });

  it("repairs a grounding-invalid response once", async () => {
    const groundingBad = JSON.stringify(
      validAnswer().answer
        ? {
            ...validAnswer(),
            answer: { text: "FICO fell 99% today.", evidenceRefs: ["anomaly.FICO"] },
          }
        : null,
    );
    const { provider, resultPromise } = run([groundingBad, validContent()]);
    const result = await resultPromise;
    expect(provider.complete).toHaveBeenCalledTimes(2);
    expect(result.status).toBe("generated");
  });

  it("fails safely when both attempts are invalid", async () => {
    const { provider, resultPromise } = run(["not json", "also not json"]);
    const result = await resultPromise;
    expect(provider.complete).toHaveBeenCalledTimes(2);
    expect(result.status).toBe("unavailable");
    if (result.status === "unavailable") {
      expect(result.reason).toBe("schema_validation_failed");
    } else {
      throw new Error("expected unavailable");
    }
  });

  it("does not repair provider errors", async () => {
    const { provider, resultPromise } = run([new LlmProviderError("auth", "bad key", 401)]);
    const result = await resultPromise;
    expect(provider.complete).toHaveBeenCalledTimes(1);
    expect(result.status).toBe("unavailable");
    if (result.status === "unavailable") expect(result.providerErrorCategory).toBe("auth");
  });

  it("does not repair timeouts or rate limits", async () => {
    const timeout = run([new LlmProviderError("timeout", "slow", null)]);
    const timeoutResult = await timeout.resultPromise;
    expect(timeout.provider.complete).toHaveBeenCalledTimes(1);
    expect(timeoutResult.status).toBe("unavailable");

    const rate = run([new LlmProviderError("rate_limit", "slow down", 429)]);
    const rateResult = await rate.resultPromise;
    expect(rate.provider.complete).toHaveBeenCalledTimes(1);
    expect(rateResult.status).toBe("unavailable");
  });

  it("makes zero provider calls on insufficient context", async () => {
    const provider = { complete: vi.fn(async () => ({ content: "" })) };
    const result = await generateAskSakuraAnswer({
      question: "Why is FICO down?",
      selection,
      inputConfidence: { score: 0.4, label: "insufficient" },
      fingerprint: "fp",
      provider,
    });
    expect(provider.complete).not.toHaveBeenCalled();
    expect(result.status).toBe("insufficient_grounded_data");
  });

  it("keeps repair evidence and question identical to the first attempt", async () => {
    const { provider, resultPromise } = run(["not json", validContent()]);
    await resultPromise;
    const calls = provider.complete.mock.calls as unknown as Array<[{ messages: LlmMessage[] }]>;
    const first = calls[0]![0]!;
    const second = calls[1]![0]!;
    expect(second.messages[0]).toEqual(first.messages[0]);
    expect(second.messages[1]).toEqual(first.messages[1]);
    expect(provider.complete.mock.calls.length).toBeLessThanOrEqual(2);
  });
});
