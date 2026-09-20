"use client";

import { useEffect, useRef, useState } from "react";
import type { MarketAnomaly, MarketDataMode } from "@war-room/types";
import { demoMarketData } from "@/data/demo-market";
import { buildDemoAnomaliesOverview } from "@/lib/anomalies/demo";
import {
  DEFAULT_ANOMALY_UNIVERSE_ID,
  anomalyUniverseOrDefault,
  type AnomalyUniverseId,
} from "@/lib/anomalies/universe/registry";
import type { AnomalyOverview } from "@/lib/anomalies/types";

export type AnomaliesOverviewStatus = "loading" | "ready" | "error";

export interface AnomaliesOverviewState {
  mode: MarketDataMode;
  status: AnomaliesOverviewStatus;
  demo: MarketAnomaly[] | null;
  overview: AnomalyOverview | null;
  asOf: string | null;
  /** Selected anomaly universe (V1.1E; defaults to sp500). */
  universeId?: AnomalyUniverseId;
}

const POLL_INTERVAL_MS = 60_000;
const FETCH_TIMEOUT_MS = 15_000;

/** Result of the latest settled live request, tagged with its universe. */
interface LiveScanState {
  universeId: AnomalyUniverseId | null;
  overview: AnomalyOverview | null;
  asOf: string | null;
  status: AnomaliesOverviewStatus;
}

const INITIAL_LIVE_SCAN: LiveScanState = {
  universeId: null,
  overview: null,
  asOf: null,
  status: "loading",
};

function demoRowsFor(universeId: AnomalyUniverseId): MarketAnomaly[] {
  if (universeId === DEFAULT_ANOMALY_UNIVERSE_ID) return demoMarketData.anomalies;
  const symbols = new Set(anomalyUniverseOrDefault(universeId).symbols);
  const filtered = demoMarketData.anomalies.filter((anomaly) => symbols.has(anomaly.symbol));
  return filtered.length > 0 ? filtered : demoMarketData.anomalies;
}

/**
 * Market Anomalies hook.
 *
 * Demo mode → deterministic demo fixtures for the selected universe, never
 * LIVE. Live mode → polls `GET /api/anomalies/overview?universe=<id>` every 60s
 * (visibility-aware). A failure marks only Market Anomalies unavailable — no
 * demo fallback, other modules intact.
 *
 * V1.1E: the optional `universeId` (default `sp500`) is Markets-only local
 * state. Rapid switching is race-safe: every response is dropped unless it
 * still belongs to the latest request of the latest universe, so an older
 * Nasdaq 100 response can never overwrite a newer S&P 500 selection. Loading
 * for a newly selected universe is derived (not stored), so the local loading
 * state never affects other modules.
 */
export function useAnomaliesOverview(
  mode: MarketDataMode,
  universeId: AnomalyUniverseId = DEFAULT_ANOMALY_UNIVERSE_ID,
): AnomaliesOverviewState {
  const [live, setLive] = useState<LiveScanState>(INITIAL_LIVE_SCAN);
  const effectSeq = useRef(0);

  useEffect(() => {
    if (mode === "demo") return;

    const myEffect = ++effectSeq.current;
    let disposed = false;
    let controller: AbortController | null = null;
    let loadSeq = 0;

    const load = async () => {
      controller?.abort();
      const current = new AbortController();
      controller = current;
      const myLoad = ++loadSeq;
      const timer = window.setTimeout(() => current.abort(), FETCH_TIMEOUT_MS);
      const stale = () => disposed || effectSeq.current !== myEffect || myLoad !== loadSeq;
      try {
        const response = await fetch(`/api/anomalies/overview?universe=${universeId}`, {
          cache: "no-store",
          signal: current.signal,
        });
        if (stale()) return;
        if (!response.ok) throw new Error(`anomalies ${response.status}`);
        const json = (await response.json()) as AnomalyOverview;
        if (stale()) return;
        if (!json.topOverall || !Array.isArray(json.topOverall)) throw new Error("bad payload");
        setLive({
          universeId,
          overview: json,
          asOf: json.asOf ?? json.meta.asOf ?? null,
          status: "ready",
        });
      } catch {
        if (stale()) return;
        setLive({ universeId, overview: null, asOf: null, status: "error" });
      } finally {
        window.clearTimeout(timer);
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
  }, [mode, universeId]);

  if (mode === "demo") {
    return {
      mode,
      status: "ready",
      demo: demoRowsFor(universeId),
      overview: buildDemoAnomaliesOverview(universeId),
      asOf: null,
      universeId,
    };
  }
  const isCurrent = live.universeId === universeId;
  return {
    mode,
    status: isCurrent ? live.status : "loading",
    demo: null,
    overview: isCurrent ? live.overview : null,
    asOf: isCurrent ? live.asOf : null,
    universeId,
  };
}
