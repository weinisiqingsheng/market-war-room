"use client";

import { useEffect, useState } from "react";
import type { MarketDataMode, MarketRegime, RegimeDriver, RegimeResult } from "@war-room/types";
import { demoMarketData } from "@/data/demo-market";

export type RegimeOverviewStatus = "loading" | "ready" | "error";

export interface RegimeOverviewState {
  mode: MarketDataMode;
  status: RegimeOverviewStatus;
  /** Demo fixture regime (mode=demo). Null in live mode. */
  regime: MarketRegime | null;
  /** Demo driver cards (mode=demo). Null in live mode. */
  regimeDrivers: RegimeDriver[] | null;
  /** Engine result (mode=live after a successful fetch). Null otherwise. */
  result: RegimeResult | null;
  asOf: string | null;
}

const POLL_INTERVAL_MS = 60_000;
const FETCH_TIMEOUT_MS = 8_000;

/**
 * Market Regime data hook.
 *
 * Demo mode → typed demo fixtures immediately; never fetches; never LIVE.
 * Live mode → polls GET /api/regime/overview (server-side orchestration + the
 * Python engine). A failure marks the section "unavailable" — the demo score is
 * never substituted and Market/Macro Pulse are unaffected.
 */
export function useRegimeOverview(mode: MarketDataMode): RegimeOverviewState {
  const [overview, setOverview] = useState<RegimeResult | null>(null);
  const [asOf, setAsOf] = useState<string | null>(null);
  const [status, setStatus] = useState<RegimeOverviewStatus>(mode === "demo" ? "ready" : "loading");

  useEffect(() => {
    if (mode === "demo") return;

    let disposed = false;
    let controller: AbortController | null = null;
    let loadSeq = 0;

    const load = async () => {
      // Superseded requests are cancelled, and unmounting aborts the in-flight
      // fetch so the browser connection is released for the next navigation.
      controller?.abort();
      const current = new AbortController();
      controller = current;
      const myLoad = ++loadSeq;
      const timer = window.setTimeout(() => current.abort(), FETCH_TIMEOUT_MS);
      const stale = () => disposed || myLoad !== loadSeq;
      try {
        const response = await fetch("/api/regime/overview", {
          cache: "no-store",
          signal: current.signal,
        });
        if (stale()) return;
        if (!response.ok) throw new Error(`regime overview ${response.status}`);
        const json = (await response.json()) as {
          result: RegimeResult | null;
          meta: { asOf: string | null };
        };
        if (stale()) return;
        if (!json.result) throw new Error("regime result missing");
        setOverview(json.result);
        setAsOf(json.result.asOf ?? json.meta.asOf ?? null);
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
    return {
      mode,
      status: "ready",
      regime: demoMarketData.regime,
      regimeDrivers: demoMarketData.regimeDrivers,
      result: null,
      asOf: null,
    };
  }

  return {
    mode,
    status,
    regime: null,
    regimeDrivers: null,
    result: overview,
    asOf,
  };
}
