"use client";

import { useEffect, useState } from "react";
import type { MacroDataMeta, MacroOverview, MacroSignal, MarketDataMode } from "@war-room/types";
import { demoMarketData } from "@/data/demo-market";

export type MacroOverviewStatus = "loading" | "ready" | "error";

export interface MacroOverviewState {
  mode: MarketDataMode;
  status: MacroOverviewStatus;
  meta: MacroDataMeta | null;
  signals: MacroSignal[] | null;
}

/**
 * Macro Pulse data hook.
 *
 * Demo mode → typed demo fixtures immediately; never fetches.
 * Live mode → polls GET /api/macro/overview (server caches per source) every
 * ~60s, paused while the tab is hidden. A failed fetch leaves signals null so
 * the section renders unavailable cells — demo values are never substituted.
 */
const POLL_INTERVAL_MS = 60_000;
const FETCH_TIMEOUT_MS = 15_000;

export function useMacroOverview(mode: MarketDataMode): MacroOverviewState {
  const [overview, setOverview] = useState<MacroOverview | null>(null);
  const [status, setStatus] = useState<MacroOverviewStatus>(mode === "demo" ? "ready" : "loading");

  useEffect(() => {
    if (mode === "demo") return;

    let disposed = false;

    const load = async () => {
      try {
        const response = await fetch("/api/macro/overview", {
          cache: "no-store",
          signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        });
        if (disposed) return;
        if (!response.ok) throw new Error(`macro overview ${response.status}`);
        const json = (await response.json()) as MacroOverview;
        if (disposed) return;
        if (!Array.isArray(json.signals)) throw new Error("unexpected macro payload");
        setOverview(json);
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
    return {
      mode,
      status: "ready",
      meta: null,
      signals: demoMarketData.macro,
    };
  }

  return {
    mode,
    status,
    meta: overview?.meta ?? null,
    signals: overview?.signals ?? null,
  };
}
