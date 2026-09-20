"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AiEvidenceApiResponse } from "@/lib/ai-brief/evidence-api-types";

export type EvidenceStatus = "loading" | "ready" | "error";

export interface UseEvidenceExplorerResult {
  status: EvidenceStatus;
  data: AiEvidenceApiResponse | null;
  refresh: () => void;
}

const FETCH_TIMEOUT_MS = 70_000;

/**
 * Loads the read-only grounded Evidence Pack. Fetch-on-mount + manual Refresh
 * only — no polling loop (the AI card owns its own 180s cadence).
 */
export function useEvidenceExplorer(): UseEvidenceExplorerResult {
  const [status, setStatus] = useState<EvidenceStatus>("loading");
  const [data, setData] = useState<AiEvidenceApiResponse | null>(null);
  const requestId = useRef(0);
  const activeController = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    const controller = new AbortController();
    activeController.current = controller;
    const timer = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const response = await fetch("/api/ai/evidence", {
        cache: "no-store",
        signal: controller.signal,
      });
      if (requestId.current !== id) return;
      if (!response.ok) throw new Error(`evidence ${response.status}`);
      const json = (await response.json()) as AiEvidenceApiResponse;
      if (requestId.current !== id) return;
      if (json.status !== "ok") throw new Error("evidence unavailable");
      setData(json);
      setStatus("ready");
    } catch {
      if (requestId.current !== id) return;
      setStatus("error");
    } finally {
      window.clearTimeout(timer);
      if (activeController.current === controller) activeController.current = null;
    }
  }, []);

  useEffect(() => {
    const run = async () => {
      await load();
    };
    void run();
    return () => {
      activeController.current?.abort();
      activeController.current = null;
    };
  }, [load]);

  const refresh = useCallback(() => {
    void load();
  }, [load]);

  return { status, data, refresh };
}
