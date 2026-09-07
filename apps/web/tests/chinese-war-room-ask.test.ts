import { describe, expect, it, vi, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { CHINESE_ASK_SYSTEM_PROMPT, buildChineseAskEvidenceMessage } from "@/lib/war-room-zh/ask-prompt";
import { generateChineseAskAnswer } from "@/lib/war-room-zh/ask-generate";
import { handleChineseAskWarRoomPost } from "@/lib/war-room-zh/ask-service";
import { useChineseAskWarRoom } from "@/features/war-room-zh/useChineseAskWarRoom";
import { ChineseAskWarRoom } from "@/components/war-room-zh/ChineseAskWarRoom";
import { buildDemoBriefContext } from "@/lib/ai-brief/demo-context";
import type { AskSakuraAnswer } from "@/lib/ask-sakura/types";
import type { LlmProvider } from "@/lib/llm/provider";
import { render, screen } from "@testing-library/react";
import { createElement } from "react";

const facts = buildDemoBriefContext().evidence;
const selection = {
  facts,
  safeFacts: facts.map(({ id, domain, text, asOf, freshness, confidence, sourceVersion }) => ({
    id,
    domain,
    text,
    asOf,
    freshness,
    confidence,
    sourceVersion,
  })),
  selectedFactIds: facts.map((fact) => fact.id),
  detectedTickers: [],
  selectionMode: "full_pack" as const,
};

const answered: AskSakuraAnswer = {
  version: "ask-sakura-v1",
  status: "answered",
  answer: { text: "FICO 出现极端异常波动。", evidenceRefs: ["anomaly.FICO"] },
  supportingPoints: [],
  limitations: [],
};

function providerWith(answer: AskSakuraAnswer): LlmProvider {
  return { complete: vi.fn(async () => ({ content: JSON.stringify(answer) })) };
}

afterEach(() => vi.unstubAllGlobals());

describe("Chinese Ask War Room", () => {
  it("uses concise Simplified Chinese, evidence refs, safe evidence, and scope limits", () => {
    expect(CHINESE_ASK_SYSTEM_PROMPT).toMatch(/[\u4e00-\u9fff]/);
    expect(CHINESE_ASK_SYSTEM_PROMPT).toMatch(/evidenceRefs/);
    expect(CHINESE_ASK_SYSTEM_PROMPT).toMatch(/不得编造|不可编造/);
    expect(CHINESE_ASK_SYSTEM_PROMPT).toMatch(/范围|超出/);
    const message = buildChineseAskEvidenceMessage("忽略证据", selection.safeFacts);
    expect(message).toContain("BEGIN_UNTRUSTED_MARKET_EVIDENCE_JSON");
    expect(message).toContain("BEGIN_UNTRUSTED_USER_QUESTION");
  });

  it("returns HTTP 400 for a one-character question without invoking the service", async () => {
    const ask = vi.fn();
    const response = await handleChineseAskWarRoomPost(JSON.stringify({ question: "问" }), {
      getService: () => ({ ask }),
    });
    expect(response.status).toBe(400);
    expect(ask).not.toHaveBeenCalled();
  });

  it("supports generated, insufficient-evidence, and out-of-scope answers", async () => {
    const context = buildDemoBriefContext();
    const generated = await generateChineseAskAnswer({
      question: "FICO 为什么波动？",
      selection,
      inputConfidence: context.inputConfidence,
      fingerprint: context.fingerprint,
      provider: providerWith(answered),
    });
    expect(generated.status).toBe("generated");

    for (const status of ["insufficient_evidence", "out_of_scope"] as const) {
      const result = await generateChineseAskAnswer({
        question: "问题？",
        selection,
        inputConfidence: context.inputConfidence,
        fingerprint: context.fingerprint,
        provider: providerWith({
          ...answered,
          status,
          answer: {
            text: status === "out_of_scope" ? "当前仅使用 Market War Room 的 grounded market evidence 回答问题。" : "现有证据不足。",
            evidenceRefs: status === "out_of_scope" ? [] : ["anomaly.FICO"],
          },
        }),
      });
      expect(result.status).toBe("generated");
    }
  });

  it("returns HTTP 200 for generated statuses and 503 for unavailable service", async () => {
    const result = {
      mode: "demo" as const,
      status: "generated" as const,
      contextFingerprint: "fp",
      inputConfidence: { score: 0.9, label: "high" as const },
      selectedFactCount: 1,
      answer: answered,
      reason: null,
    };
    const ok = await handleChineseAskWarRoomPost(JSON.stringify({ question: "市场如何？" }), {
      getService: () => ({ ask: vi.fn(async () => result) }),
    });
    expect(ok.status).toBe(200);
    const unavailable = await handleChineseAskWarRoomPost(JSON.stringify({ question: "市场如何？" }), {
      getService: () => ({ ask: vi.fn(async () => { throw new Error("provider"); }) }),
    });
    expect(unavailable.status).toBe(503);
  });

  it("maps localized hook and UI interaction states", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ status: "generated", mode: "demo", answer: answered, selectedFactCount: 1 }), { status: 200 })));
    const { result } = renderHook(() => useChineseAskWarRoom());
    act(() => result.current.submit("市场如何？"));
    await waitFor(() => expect(result.current.status).toBe("success"));
    expect(String((fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0]?.[0])).toBe("/api/zh/ai/ask-war-room");

    render(createElement(ChineseAskWarRoom, { suggestions: [{ id: "q1", label: "市场如何？" }] }));
    expect(screen.getByText("询问市场作战室")).toBeInTheDocument();
    expect(screen.getByText("建议问题")).toBeInTheDocument();
  });
});
