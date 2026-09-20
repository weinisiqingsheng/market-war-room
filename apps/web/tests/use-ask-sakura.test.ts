import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useAskSakura } from "@/features/ask-sakura/useAskSakura";
import type { AskSakuraAnswer } from "@/lib/ask-sakura/types";

const answer: AskSakuraAnswer = {
  version: "ask-sakura-v1",
  status: "answered",
  answer: { text: "FICO fell 16.7% amid an extreme anomaly.", evidenceRefs: ["anomaly.FICO"] },
  supportingPoints: [],
  limitations: [],
};

function payload(answerText: string) {
  return {
    mode: "live",
    status: "generated",
    contextFingerprint: "abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdef",
    inputConfidence: { score: 0.9, label: "high" },
    selectedFactCount: 35,
    answer: { ...answer, answer: { ...answer.answer, text: answerText } },
  };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

afterEach(() => vi.unstubAllGlobals());

describe("useAskSakura", () => {
  it("POSTs a trimmed question with no privileged fields", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(payload("ok")));
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useAskSakura());
    act(() => result.current.submit("   Why is FICO down?   "));
    await waitFor(() => expect(result.current.status).toBe("success"));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const calls = fetchMock.mock.calls as unknown as Array<[RequestInfo | URL, RequestInit?]>;
    expect(String(calls[0]![0])).toBe("/api/ai/ask-sakura");
    expect(JSON.parse(String(calls[0]![1]?.body))).toEqual({ question: "Why is FICO down?" });
  });

  it("reports answered, insufficient, out-of-scope and api_insufficient states", async () => {
    for (const [status, expected] of [
      ["answered", "success"],
      ["insufficient_evidence", "success"],
      ["out_of_scope", "success"],
    ] as const) {
      const current: AskSakuraAnswer = { ...answer, status };
      vi.stubGlobal(
        "fetch",
        vi.fn(async () =>
          jsonResponse({
            mode: "live",
            status: "generated",
            selectedFactCount: 1,
            contextFingerprint: "x",
            answer: current,
          }),
        ),
      );
      const { result } = renderHook(() => useAskSakura());
      act(() => result.current.submit("Question?"));
      await waitFor(() => expect(result.current.status).toBe(expected));
      expect(result.current.data?.answer.status).toBe(status);
      vi.unstubAllGlobals();
    }

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({ mode: "live", status: "insufficient_grounded_data", selectedFactCount: 0 }),
      ),
    );
    const { result } = renderHook(() => useAskSakura());
    act(() => result.current.submit("Question?"));
    await waitFor(() => expect(result.current.status).toBe("api_insufficient"));
    vi.unstubAllGlobals();
  });

  it("marks unavailable for HTTP failures", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("nope", { status: 503 })),
    );
    const { result } = renderHook(() => useAskSakura());
    act(() => result.current.submit("Why is FICO down?"));
    await waitFor(() => expect(result.current.status).toBe("unavailable"));
    expect(result.current.errorKind).toBe("unavailable");
  });

  it("Retry reuses the same trimmed question", async () => {
    const calls: Array<string | null> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: unknown, init: RequestInit | undefined) => {
        calls.push(String(init?.body ?? ""));
        return new Response("nope", { status: 503 });
      }),
    );
    const { result } = renderHook(() => useAskSakura());
    act(() => result.current.submit("  Why is FICO down?  "));
    await waitFor(() => expect(result.current.status).toBe("unavailable"));
    act(() => result.current.retry());
    await waitFor(() => expect(calls.length).toBe(2));
    expect(calls[0]).toEqual(JSON.stringify({ question: "Why is FICO down?" }));
    expect(calls[1]).toEqual(calls[0]);
  });

  it("aborts on unmount and does not poll", async () => {
    const fetchMock = vi.fn(() => new Promise<Response>(() => {}));
    vi.stubGlobal("fetch", fetchMock);
    const { result, unmount } = renderHook(() => useAskSakura());
    act(() => result.current.submit("Why is FICO down?"));
    unmount();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("a stale response cannot overwrite a newer request", async () => {
    let resolveFirst: (value: Response) => void = () => {};
    const first = new Promise<Response>((resolve) => (resolveFirst = resolve));
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: unknown, init: RequestInit | undefined) => {
        const body = JSON.parse(String(init?.body ?? ""));
        const q = (body as { question: string }).question;
        return q === "old?" ? first : jsonResponse(payload("new answer"));
      }),
    );
    const { result } = renderHook(() => useAskSakura());
    act(() => result.current.submit("old?"));
    act(() => result.current.submit("new?"));
    await waitFor(() => expect(result.current.status).toBe("success"));
    expect(result.current.data?.answer.answer.text).toBe("new answer");
    await act(async () => {
      resolveFirst(jsonResponse(payload("old answer")));
    });
    expect(result.current.data?.answer.answer.text).toBe("new answer");
  });
});
