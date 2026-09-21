"use client";

import { useEffect, useState } from "react";
import type { MarketBreadth, MarketDataMode } from "@war-room/types";
import { demoMarketData } from "@/data/demo-market";
import type { BreadthOverview } from "@/lib/breadth/types";

export type BreadthOverviewStatus = "loading" | "ready" | "error";

export interface BreadthOverviewState {
  mode: MarketDataMode;
  status: BreadthOverviewStatus;
  /** Demo fixture (mode=demo). */
  demo: MarketBreadth | null;
  /** Live breadth result (mode=live after a successful fetch). */
  overview: BreadthOverview | null;
  asOf: string | null;
}

const POLL_INTERVAL_MS = 60_000;
const FETCH_TIMEOUT_MS = 15_000;

/**
 * Market Breadth data hook.
 *
 * Demo mode → typed demo fixture immediately; never fetches; never LIVE.
 * Live mode → polls GET /api/breadth/overview every 60s (visibility-aware).
 * A failure marks only Market Breadth unavailable — never a demo fallback.
 */
export function useBreadthOverview(mode: MarketDataMode): BreadthOverviewState {
  const [overview, setOverview] = useState<BreadthOverview | null>(null);
  const [asOf, setAsOf] = useState<string | null>(null);
  const [status, setStatus] = useState<BreadthOverviewStatus>(
    mode === "demo" ? "ready" : "loading",
  );

  useEffect(() => {
    if (mode === "demo") return;

    let disposed = false;
    let controller: AbortController | null = null;
    let loadSeq = 0;

    const load = async () => {
      // Cancellation handles the in-flight request so leaving this page frees
      // the browser connection immediately (the shared socket pool is small).
      controller?.abort();
      const current = new AbortController();
      controller = current;
      const myLoad = ++loadSeq;
      const timer = window.setTimeout(() => current.abort(), FETCH_TIMEOUT_MS);
      const stale = () => disposed || myLoad !== loadSeq;
      try {
        const response = await fetch("/api/breadth/overview", {
          cache: "no-store",
          signal: current.signal,
        });
        if (stale()) return;
        if (!response.ok) throw new Error(`breadth overview ${response.status}`);
        const json = (await response.json()) as BreadthOverview;
        if (stale()) return;
        if (typeof json.score !== "number" && json.score !== null) {
          throw new Error("unexpected breadth payload");
        }
        setOverview(json);
        setAsOf(json.meta.asOf ?? null);
        setStatus("ready");
      } catch {
        if (stale()) return;
        setStatus("error");
      } finally {
        window.clearTimeout(timer);
        if (controller === current) controller = null;
      }
    };

    const refresh = () => {
      if (document.hidden) return;
      load();
    };

    const onVisibility = () => {
      if (!document.hidden) load();
    };

    document.addEventListener("visibilitychange", onVisibility);
    load();
    const timer = window.setInterval(refresh, POLL_INTERVAL_MS);

    return () => {
      disposed = true;
      window.clearInterval(timer);
      controller?.abort();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [mode]);

  if (mode === "demo") {
    return { mode, status: "ready", demo: demoMarketData.breadth, overview: null, asOf: null };
  }

  return { mode, status, demo: null, overview, asOf };
}
