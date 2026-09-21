import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { normalizeSubmittedSymbol, useTickerResearch } from "@/features/markets/useTickerResearch";
import type { TickerResearchApiOk } from "@/lib/ticker-context/api-types";

/**
 * Client-hook contract (V1.2C): submit-only fetching, one request per submit,
 * race-safe ordering, abort on unmount and honest failure states.
 */
function okPayload(
  symbol: string,
  status: "ok" | "partial" | "insufficient_data" = "ok",
): TickerResearchApiOk {
  return {
    mode: "live",
    status,
    symbol,
    context: {
      version: "ticker-context-v1",
      status,
      requestedSymbol: symbol,
      symbol,
      identity: {
        symbol,
        name: `${symbol} Inc`,
        exchange: "NASDAQ",
        assetClass: "us_equity",
        status: "active",
        tradable: true,
      },
      requestedAt: "2026-09-18T21:00:00.000Z",
      generatedAt: "2026-09-18T21:00:01.000Z",
      providerAsOf: null,
      marketSessionAsOf: "2026-09-18",
      effectiveAsOf: null,
      session: { marketOpen: false, phase: "closed", sessionDate: "2026-09-18" },
      sources: {} as never,
      availability: {} as never,
      confidence: { score: 0.9, label: "high" },
      factCount: 0,
      facts: [],
      summary: {} as never,
      fingerprint: "f".repeat(64),
    },
  };
}

function failurePayload(status: number, code: string, bodyStatus = "unsupported_symbol") {
  return {
    status,
    body: {
      mode: "live",
      status: bodyStatus,
      symbol: "ZZZZ",
      reason: code === "UNKNOWN_SYMBOL" ? "unknown_symbol" : "unsupported_security_type",
      error: { code, message: `${code} message` },
    },
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

type Deferred = {
  promise: Promise<Response>;
  resolve: (value: Response) => void;
  reject: (reason?: unknown) => void;
};
function deferred(): Deferred {
  let resolve!: (value: Response) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<Response>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("normalizeSubmittedSymbol", () => {
  it("trims, normalizes case and mirrors the API symbol rule", () => {
    expect(normalizeSubmittedSymbol("  nvda ")).toBe("NVDA");
    expect(normalizeSubmittedSymbol("brk.b")).toBe("BRK.B");
    expect(normalizeSubmittedSymbol("1ABC")).toBeNull();
    expect(normalizeSubmittedSymbol("TOOLONGSYMBOL")).toBeNull();
    expect(normalizeSubmittedSymbol("NV DA")).toBeNull();
    expect(normalizeSubmittedSymbol("")).toBeNull();
  });
});

describe("useTickerResearch", () => {
  it("starts idle and never fetches before a submit", async () => {
    const { result } = renderHook(() => useTickerResearch());
    expect(result.current.status).toBe("idle");
    expect(result.current.data).toBeNull();
    await act(async () => {
      await Promise.resolve();
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("submits the exact API path once, trims and uppercases the symbol", async () => {
    fetchMock.mockResolvedValue(jsonResponse(okPayload("NVDA")));
    const { result } = renderHook(() => useTickerResearch());

    await act(async () => {
      result.current.research("  nvda ");
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/intelligence/ticker?symbol=NVDA");
    await waitFor(() => expect(result.current.status).toBe("ok"));
    expect(result.current.symbol).toBe("NVDA");
    expect(result.current.data?.context.symbol).toBe("NVDA");
    expect(result.current.error).toBeNull();
  });

  it("shows a loading state while the request is in flight", async () => {
    const pending = deferred();
    fetchMock.mockReturnValue(pending.promise);
    const { result } = renderHook(() => useTickerResearch());

    act(() => {
      result.current.research("NVDA");
    });
    expect(result.current.status).toBe("loading");
    expect(result.current.symbol).toBe("NVDA");

    await act(async () => {
      pending.resolve(jsonResponse(okPayload("NVDA")));
    });
    await waitFor(() => expect(result.current.status).toBe("ok"));
  });

  it("rejects an invalid symbol locally without calling the API", async () => {
    const { result } = renderHook(() => useTickerResearch());
    await act(async () => {
      result.current.research("1NVALID");
    });
    expect(result.current.status).toBe("invalid_symbol");
    expect(result.current.error?.code).toBe("INVALID_SYMBOL");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("maps ok, partial and insufficient_data payloads to distinct states", async () => {
    for (const status of ["ok", "partial", "insufficient_data"] as const) {
      fetchMock.mockResolvedValue(jsonResponse(okPayload("NVDA", status)));
      const { result, unmount } = renderHook(() => useTickerResearch());
      await act(async () => {
        result.current.research("NVDA");
      });
      await waitFor(() => expect(result.current.status).toBe(status));
      expect(result.current.data?.status).toBe(status);
      unmount();
    }
  });

  it("maps 404 UNKNOWN_SYMBOL and 422 UNSUPPORTED_SECURITY_TYPE to their own states", async () => {
    const unknown = failurePayload(404, "UNKNOWN_SYMBOL");
    fetchMock.mockResolvedValue(jsonResponse(unknown.body, unknown.status));
    const { result, unmount } = renderHook(() => useTickerResearch());
    await act(async () => {
      result.current.research("ZZZZ");
    });
    await waitFor(() => expect(result.current.status).toBe("unknown_symbol"));
    expect(result.current.data).toBeNull();
    unmount();

    const unsupported = failurePayload(422, "UNSUPPORTED_SECURITY_TYPE");
    fetchMock.mockResolvedValue(jsonResponse(unsupported.body, unsupported.status));
    const second = renderHook(() => useTickerResearch());
    await act(async () => {
      second.result.current.research("BTCUSD");
    });
    await waitFor(() => expect(second.result.current.status).toBe("unsupported_security_type"));
  });

  it("marks provider failures unavailable and retries the same symbol only on demand", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        {
          mode: "live",
          status: "unavailable",
          symbol: "NVDA",
          reason: "provider_unavailable",
          error: { code: "PROVIDER_UNAVAILABLE", message: "temporarily unavailable" },
        },
        503,
      ),
    );
    const { result } = renderHook(() => useTickerResearch());
    await act(async () => {
      result.current.research("NVDA");
    });
    await waitFor(() => expect(result.current.status).toBe("unavailable"));
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fetchMock.mockResolvedValue(jsonResponse(okPayload("NVDA")));
    await act(async () => {
      result.current.retry();
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]?.[0]).toBe("/api/intelligence/ticker?symbol=NVDA");
    await waitFor(() => expect(result.current.status).toBe("ok"));
  });

  it("treats a network failure as unavailable without inventing a result", async () => {
    fetchMock.mockRejectedValue(new Error("socket closed"));
    const { result } = renderHook(() => useTickerResearch());
    await act(async () => {
      result.current.research("NVDA");
    });
    await waitFor(() => expect(result.current.status).toBe("unavailable"));
    expect(result.current.data).toBeNull();
    expect(result.current.error?.code).toBe("REQUEST_FAILED");
  });

  it("never lets a slower earlier response overwrite a newer symbol", async () => {
    const slowNvda = deferred();
    const fastTsla = deferred();
    fetchMock
      .mockImplementationOnce(() => slowNvda.promise)
      .mockImplementationOnce(() => fastTsla.promise);

    const { result } = renderHook(() => useTickerResearch());
    act(() => {
      result.current.research("NVDA");
    });
    act(() => {
      result.current.research("TSLA");
    });

    await act(async () => {
      fastTsla.resolve(jsonResponse(okPayload("TSLA")));
    });
    await waitFor(() => expect(result.current.status).toBe("ok"));
    expect(result.current.data?.context.symbol).toBe("TSLA");

    // The earlier NVDA response arrives afterwards and must be ignored.
    await act(async () => {
      slowNvda.resolve(jsonResponse(okPayload("NVDA")));
    });
    expect(result.current.data?.context.symbol).toBe("TSLA");
    expect(result.current.symbol).toBe("TSLA");
  });

  it("aborts the in-flight request on unmount", async () => {
    const pending = deferred();
    fetchMock.mockReturnValue(pending.promise);
    const { result, unmount } = renderHook(() => useTickerResearch());
    act(() => {
      result.current.research("NVDA");
    });
    const signal = (fetchMock.mock.calls[0]?.[1] as RequestInit | undefined)?.signal as AbortSignal;
    expect(signal.aborted).toBe(false);
    unmount();
    expect(signal.aborted).toBe(true);
  });

  it("does not poll: no further requests without another explicit submit", async () => {
    vi.useFakeTimers();
    try {
      fetchMock.mockResolvedValue(jsonResponse(okPayload("NVDA")));
      const { result } = renderHook(() => useTickerResearch());
      await act(async () => {
        result.current.research("NVDA");
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10 * 60_000);
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("imports no provider or LLM code into the browser bundle", () => {
    const source = readFileSync(
      path.join(process.cwd(), "features/markets/useTickerResearch.ts"),
      "utf8",
    );
    for (const forbidden of [
      "lib/breadth/provider",
      "catalysts/providers",
      "alpaca",
      "deepseek",
      "lib/llm",
      "apiKey",
      "Authorization",
      "server-only",
    ]) {
      expect(source.toLowerCase()).not.toContain(forbidden.toLowerCase());
    }
  });
});
