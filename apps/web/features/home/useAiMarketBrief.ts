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

  const load = useCallback(async (): Promise<AbortController | null> => {
    const id = ++requestId.current;
    const controller = new AbortController();
    try {
      const res = await fetch("/api/ai/market-brief", { cache: "no-store", signal: controller.signal });
      const json = (await res.json()) as AiMarketBriefApiResponse;
      if (requestId.current !== id) return null;
      setResponse(json);
      setStatus("ready");
    } catch {
      if (requestId.current !== id) return null;
      setStatus("error");
    }
    return controller;
  }, []);

  useEffect(() => {
    let activeController: AbortController | null = null;
    const run = async () => {
      activeController = await load();
    };
    void run();
    const interval = setInterval(() => {
      if (document.hidden) return;
      activeController?.abort();
      void run();
    }, REFRESH_MS);
    return () => {
      activeController?.abort();
      clearInterval(interval);
    };
  }, [load]);

  const refetch = useCallback(() => {
    void load();
  }, [load]);

  return { status, response, refetch };
}
