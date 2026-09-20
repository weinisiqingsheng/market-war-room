import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useAnomaliesOverview } from "@/features/home/useAnomaliesOverview";
import { nasdaq100AnomalyUniverse } from "@/lib/anomalies/universe/nasdaq100";
import type { AnomalyOverview } from "@/lib/anomalies/types";

type UniverseId = "sp500" | "nasdaq100";

function overview(id: UniverseId, count: number, marker: string): AnomalyOverview {
  const label = id === "sp500" ? "S&P 500" : "Nasdaq 100";
  return {
    mode: "live",
    engineVersion: "anomaly-v1",
    universe: {
      id,
      label,
      name: label,
      version: id === "sp500" ? "sp500-v1" : "nasdaq100-v1",
      asOf: marker,
      count,
    },
    meta: {
      provider: "alpaca",
      feed: "delayed_sip",
      delayMinutes: 15,
      asOf: "2026-09-05T13:00:00Z",
      marketOpen: false,
      stale: false,
    },
    universeCount: count,
    eligibleCount: count - 3,
    scoredCount: count - 3,
    coveragePct: (count - 3) / count,
    confidence: "high",
    topOverall: [],
    topPositive: [],
    topNegative: [],
    asOf: "2026-09-05T13:00:00Z",
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("useAnomaliesOverview universe selection (V1.1E)", () => {
  it("defaults to the canonical S&P 500 universe in demo mode without any fetch", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useAnomaliesOverview("demo"));
    expect(result.current.universeId).toBe("sp500");
    expect(result.current.status).toBe("ready");
    expect(result.current.overview?.universe).toMatchObject({
      id: "sp500",
      label: "S&P 500",
      version: "sp500-v1",
      count: 503,
    });
    expect(result.current.overview?.universeCount).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("serves membership-filtered demo rows for Nasdaq 100", () => {
    const { result } = renderHook(() => useAnomaliesOverview("demo", "nasdaq100"));
    expect(result.current.overview?.universe.id).toBe("nasdaq100");
    expect(result.current.overview?.universeCount).toBe(101);
    expect(result.current.overview?.engineVersion).toBe("anomaly-v1");
    expect(result.current.demo?.length).toBeGreaterThan(0);
    const symbols = new Set(nasdaq100AnomalyUniverse.symbols);
    for (const anomaly of result.current.demo ?? []) expect(symbols.has(anomaly.symbol)).toBe(true);
  });

  it("requests the selected universe and reports a local loading state", async () => {
    let resolve: (response: Response) => void = () => {};
    const fetchMock = vi.fn(
      () =>
        new Promise<Response>((done) => {
          resolve = done;
        }),
    );
    const urls = () => (fetchMock.mock.calls as unknown as Array<[string]>).map(([url]) => url);
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useAnomaliesOverview("live", "sp500"));
    expect(result.current.status).toBe("loading");
    expect(urls()[0]).toBe("/api/anomalies/overview?universe=sp500");
    await act(async () => {
      resolve(new Response(JSON.stringify(overview("sp500", 503, "sp-final"))));
    });
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.overview?.universe.asOf).toBe("sp-final");
  });

  it("switches universes and fails locally without any demo fallback", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(overview("sp500", 503, "sp-ok"))))
      .mockResolvedValueOnce(new Response("nope", { status: 502 }));
    const urls = () => (fetchMock.mock.calls as unknown as Array<[string]>).map(([url]) => url);
    vi.stubGlobal("fetch", fetchMock);
    const { result, rerender } = renderHook(
      ({ id }: { id: UniverseId }) => useAnomaliesOverview("live", id),
      { initialProps: { id: "sp500" as UniverseId } },
    );
    await waitFor(() => expect(result.current.status).toBe("ready"));
    rerender({ id: "nasdaq100" });
    expect(result.current.status).toBe("loading");
    expect(urls()[1]).toBe("/api/anomalies/overview?universe=nasdaq100");
    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.demo).toBeNull();
    expect(result.current.overview).toBeNull();
  });

  it("never lets a late Nasdaq 100 response overwrite the current S&P 500 selection", async () => {
    const pending: Array<{ url: string; resolve: (response: Response) => void }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (url: string) =>
          new Promise<Response>((resolve) => {
            pending.push({ url: String(url), resolve });
          }),
      ),
    );
    const { result, rerender } = renderHook(
      ({ id }: { id: UniverseId }) => useAnomaliesOverview("live", id),
      { initialProps: { id: "sp500" as UniverseId } },
    );
    await waitFor(() => expect(pending.length).toBe(1));
    rerender({ id: "nasdaq100" });
    await waitFor(() => expect(pending.length).toBe(2));
    rerender({ id: "sp500" });
    await waitFor(() => expect(pending.length).toBe(3));
    expect(pending.map((call) => call.url)).toEqual([
      "/api/anomalies/overview?universe=sp500",
      "/api/anomalies/overview?universe=nasdaq100",
      "/api/anomalies/overview?universe=sp500",
    ]);

    await act(async () => {
      pending[2]!.resolve(new Response(JSON.stringify(overview("sp500", 503, "sp-final"))));
    });
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.overview?.universe.asOf).toBe("sp-final");

    // Older Nasdaq 100 + first S&P responses arrive late and must be discarded.
    await act(async () => {
      pending[1]!.resolve(new Response(JSON.stringify(overview("nasdaq100", 101, "ndx-late"))));
      pending[0]!.resolve(new Response(JSON.stringify(overview("sp500", 503, "sp-stale"))));
    });
    expect(result.current.universeId).toBe("sp500");
    expect(result.current.overview?.universe.id).toBe("sp500");
    expect(result.current.overview?.universe.asOf).toBe("sp-final");
  });
});
