"use client";

import { useEffect, useState } from "react";
import type {
  MarketDataMeta,
  MarketDataMode,
  MarketIndex,
  MarketOverview,
  SectorPerformance,
} from "@war-room/types";
import { demoMarketData } from "@/data/demo-market";

export type OverviewStatus = "loading" | "ready" | "error";

export interface MarketOverviewState {
  mode: MarketDataMode;
  status: OverviewStatus;
  meta: MarketDataMeta | null;
  indices: MarketIndex[] | null;
  sectors: SectorPerformance[] | null;
}

/**
 * Homepage market data hook.
 *
 * Demo mode → returns typed demo fixtures immediately; never fetches.
 * Live mode → polls GET /api/market/overview (server-cached/deduplicated) every
 * ~30s; pauses while the tab is hidden; never substitutes demo figures for
 * failed live data (status becomes "error" and sections render unavailable).
 */
const POLL_INTERVAL_MS = 30_000;
const FETCH_TIMEOUT_MS = 15_000;

export function useMarketOverview(mode: MarketDataMode): MarketOverviewState {
  const [overview, setOverview] = useState<MarketOverview | null>(null);
  const [status, setStatus] = useState<OverviewStatus>(mode === "demo" ? "ready" : "loading");

  useEffect(() => {
    if (mode === "demo") return;

    let disposed = false;
    let controller: AbortController | null = null;
    let loadSeq = 0;

    const load = async () => {
      // Abort a superseded request and keep a handle so navigation away from
      // this page frees the browser connection instead of leaving the request
      // (and its socket) alive until the timeout fires.
      controller?.abort();
      const current = new AbortController();
      controller = current;
      const myLoad = ++loadSeq;
      const timer = window.setTimeout(() => current.abort(), FETCH_TIMEOUT_MS);
      const stale = () => disposed || myLoad !== loadSeq;
      try {
        const response = await fetch("/api/market/overview", {
          cache: "no-store",
          signal: current.signal,
        });
        if (stale()) return;
        if (!response.ok) throw new Error(`overview ${response.status}`);
        const json = (await response.json()) as MarketOverview;
        if (stale()) return;
        setOverview(json);
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
      if (document.hidden) return; // avoid polling an invisible tab
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
    return {
      mode,
      status: "ready",
      meta: null,
      indices: demoMarketData.indices,
      sectors: demoMarketData.sectors,
    };
  }

  return {
    mode,
    status,
    meta: overview?.meta ?? null,
    indices: overview?.indices ?? null,
    sectors: overview?.sectors ?? null,
  };
}
