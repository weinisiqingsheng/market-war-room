"use client";

import { useEffect, useState } from "react";
import type { MarketDataMode } from "@war-room/types";
import type { CatalystOverview } from "@/lib/catalysts/types";

export type CatalystsOverviewStatus = "loading" | "ready" | "error";

export interface CatalystsOverviewState {
  status: CatalystsOverviewStatus;
  overview: CatalystOverview | null;
}

const POLL_INTERVAL_MS = 60_000;
const FETCH_TIMEOUT_MS = 25_000;

/**
 * Catalyst Intelligence hook (Phase 6).
 *
 * Demo → demo fixtures handled by the UI, never fetched. Live (requires
 * ANOMALIES_MODE=live server-side) → polls GET /api/catalysts/overview.
 * A failure degrades only Catalyst Intelligence — other modules survive.
 */
export function useCatalystsOverview(mode: MarketDataMode): CatalystsOverviewState {
  const [overview, setOverview] = useState<CatalystOverview | null>(null);
  const [status, setStatus] = useState<CatalystsOverviewStatus>(mode === "demo" ? "ready" : "loading");

  useEffect(() => {
    if (mode === "demo") return;
    let disposed = false;
    const load = async () => {
      try {
        const response = await fetch("/api/catalysts/overview", {
          cache: "no-store",
          signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        });
        if (disposed) return;
        if (!response.ok) throw new Error(`catalysts ${response.status}`);
        const json = (await response.json()) as CatalystOverview;
        if (disposed) return;
        if (!json.items || !Array.isArray(json.items)) throw new Error("bad payload");
        setOverview(json);
        setStatus("ready");
      } catch {
        if (disposed) return;
        setStatus("error");
      }
    };
    const refresh = () => {
      if (document.hidden) return;
      void load();
    };
    void load();
    const interval = setInterval(refresh, POLL_INTERVAL_MS);
    const onVisibility = () => {
      if (!document.hidden) void load();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      disposed = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [mode]);

  return { status, overview };
}
