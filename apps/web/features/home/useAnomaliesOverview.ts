"use client";

import { useEffect, useState } from "react";
import type { MarketAnomaly, MarketDataMode } from "@war-room/types";
import { demoMarketData } from "@/data/demo-market";
import type { AnomalyOverview } from "@/lib/anomalies/types";

export type AnomaliesOverviewStatus = "loading" | "ready" | "error";

export interface AnomaliesOverviewState {
  mode: MarketDataMode;
  status: AnomaliesOverviewStatus;
  demo: MarketAnomaly[] | null;
  overview: AnomalyOverview | null;
  asOf: string | null;
}

const POLL_INTERVAL_MS = 60_000;
const FETCH_TIMEOUT_MS = 15_000;

/**
 * Market Anomalies hook.
 *
 * Demo mode → demo fixtures, never LIVE. Live mode → polls
 * GET /api/anomalies/overview every 60s (visibility-aware). A failure marks
 * only Market Anomalies unavailable — no demo fallback, other modules intact.
 */
export function useAnomaliesOverview(mode: MarketDataMode): AnomaliesOverviewState {
  const [overview, setOverview] = useState<AnomalyOverview | null>(null);
  const [asOf, setAsOf] = useState<string | null>(null);
  const [status, setStatus] = useState<AnomaliesOverviewStatus>(
    mode === "demo" ? "ready" : "loading",
  );

  useEffect(() => {
    if (mode === "demo") return;

    let disposed = false;
    const load = async () => {
      try {
        const response = await fetch("/api/anomalies/overview", {
          cache: "no-store",
          signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        });
        if (disposed) return;
        if (!response.ok) throw new Error(`anomalies ${response.status}`);
        const json = (await response.json()) as AnomalyOverview;
        if (disposed) return;
        if (!json.topOverall || !Array.isArray(json.topOverall)) throw new Error("bad payload");
        setOverview(json);
        setAsOf(json.asOf ?? json.meta.asOf ?? null);
        setStatus("ready");
      } catch {
        if (disposed) return;
        setStatus("error");
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
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [mode]);

  if (mode === "demo") {
    return { mode, status: "ready", demo: demoMarketData.anomalies, overview: null, asOf: null };
  }
  return { mode, status, demo: null, overview, asOf };
}
