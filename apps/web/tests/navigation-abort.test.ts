import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useAiMarketBrief } from "@/features/home/useAiMarketBrief";
import { useBreadthOverview } from "@/features/home/useBreadthOverview";
import { useCatalystsOverview } from "@/features/home/useCatalystsOverview";
import { useMacroOverview } from "@/features/home/useMacroOverview";
import { useMarketOverview } from "@/features/home/useMarketOverview";
import { useRegimeOverview } from "@/features/home/useRegimeOverview";

/**
 * Navigation-abort contract (Markets "stuck on Rendering" regression).
 *
 * Browsers keep a small per-host connection pool (6 on HTTP/1.1). When the user
 * clicks Markets while the previous page still has provider-backed requests in
 * flight (AI brief up to ~18s, catalysts ~7-11s, breadth ~6s), an RSC request
 * for the new route has to wait for a free socket — which is exactly what the
 * Next dev indicator shows as "Rendering" for many seconds.
 *
 * Every page-level data hook must therefore abort its in-flight request on
 * unmount, so navigating away releases the connection immediately.
 */
const NEVER = new Promise<Response>(() => {
  /* deliberately never settles: the request stays in flight */
});

let calls: Array<{ url: string; signal: AbortSignal | undefined }>;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  calls = [];
  fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({
      url: typeof input === "string" ? input : String(input),
      signal: init?.signal ?? undefined,
    });
    return NEVER;
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

interface Case {
  name: string;
  path: string;
  hook: () => unknown;
}

/**
 * Named wrappers so the ESLint `rules-of-hooks` check recognises these as custom
 * hooks (an inline `() => useX()` inside an object literal is not recognised).
 */
function useCaseMarketOverview() {
  return useMarketOverview("live");
}
function useCaseMacroOverview() {
  return useMacroOverview("live");
}
function useCaseRegimeOverview() {
  return useRegimeOverview("live");
}
function useCaseBreadthOverview() {
  return useBreadthOverview("live");
}
function useCaseCatalystsOverview() {
  return useCatalystsOverview("live");
}
function useCaseAiMarketBrief() {
  return useAiMarketBrief();
}

const CASES: Case[] = [
  { name: "useMarketOverview", path: "/api/market/overview", hook: useCaseMarketOverview },
  { name: "useMacroOverview", path: "/api/macro/overview", hook: useCaseMacroOverview },
  { name: "useRegimeOverview", path: "/api/regime/overview", hook: useCaseRegimeOverview },
  { name: "useBreadthOverview", path: "/api/breadth/overview", hook: useCaseBreadthOverview },
  {
    name: "useCatalystsOverview",
    path: "/api/catalysts/overview",
    hook: useCaseCatalystsOverview,
  },
  { name: "useAiMarketBrief", path: "/api/ai/market-brief", hook: useCaseAiMarketBrief },
];

describe.each(CASES)("$name", ({ path, hook }) => {
  it("requests its endpoint once on mount with an abortable signal", async () => {
    renderHook(hook);
    await act(async () => {
      await Promise.resolve();
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(calls[0]?.url).toBe(path);
    expect(calls[0]?.signal).toBeInstanceOf(AbortSignal);
    expect(calls[0]?.signal?.aborted).toBe(false);
  });

  it("aborts the in-flight request on unmount so the browser socket is released", async () => {
    const { unmount } = renderHook(hook);
    await act(async () => {
      await Promise.resolve();
    });
    const signal = calls[0]?.signal;
    expect(signal?.aborted).toBe(false);
    unmount();
    expect(signal?.aborted).toBe(true);
  });

  it("issues no further requests after unmount", async () => {
    vi.useFakeTimers();
    const { unmount } = renderHook(hook);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    const before = fetchMock.mock.calls.length;
    unmount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5 * 60_000);
    });
    expect(fetchMock.mock.calls.length).toBe(before);
  });
});
