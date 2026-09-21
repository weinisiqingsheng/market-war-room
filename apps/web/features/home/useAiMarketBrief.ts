"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GroundedMarketBrief } from "@/lib/ai-brief/brief-types";
import type { BriefInputConfidence } from "@/lib/ai-brief/types";

/** Client-safe serializable shape of GET /api/ai/market-brief. */
export interface AiMarketBriefApiResponse {
  mode: "demo" | "live";
  status: "generated" | "cached" | "demo" | "insufficient_grounded_data" | "unavailable";
  brief: GroundedMarketBrief | null;
  contextFingerprint?: string;
  inputConfidence?: BriefInputConfidence;
  cache?: { hit: boolean };
  reason?: string;
}

export type AiMarketBriefStatus = "loading" | "ready" | "error";

const REFRESH_MS = 180_000;

export interface UseAiMarketBriefResult {
  status: AiMarketBriefStatus;
  response: AiMarketBriefApiResponse | null;
  refetch: () => void;
}

export function useAiMarketBrief(): UseAiMarketBriefResult {
  const [status, setStatus] = useState<AiMarketBriefStatus>("loading");
  const [response, setResponse] = useState<AiMarketBriefApiResponse | null>(null);
  const requestId = useRef(0);

  const load = useCallback(async (controller: AbortController): Promise<void> => {
    // The controller is created and registered by the caller BEFORE awaiting, so
    // unmounting can abort an in-flight brief instead of leaving the request
    // (12–18s) holding a browser connection during a soft navigation.
    const id = ++requestId.current;
    try {
      const res = await fetch("/api/ai/market-brief", {
        cache: "no-store",
        signal: controller.signal,
      });
      const json = (await res.json()) as AiMarketBriefApiResponse;
      if (requestId.current !== id) return;
      setResponse(json);
      setStatus("ready");
    } catch {
      if (requestId.current !== id) return;
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    let activeController: AbortController | null = null;
    const run = () => {
      activeController?.abort();
      const controller = new AbortController();
      activeController = controller;
      void load(controller).finally(() => {
        if (activeController === controller) activeController = null;
      });
    };
    run();
    const interval = setInterval(() => {
      if (document.hidden) return;
      run();
    }, REFRESH_MS);
    return () => {
      activeController?.abort();
      clearInterval(interval);
    };
  }, [load]);

  const refetch = useCallback(() => {
    void load(new AbortController());
  }, [load]);

  return { status, response, refetch };
}
