"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GroundedMarketBrief } from "@/lib/ai-brief/brief-types";
import type { BriefInputConfidence } from "@/lib/ai-brief/types";

export interface ChineseAiMarketBriefApiResponse { mode: "demo" | "live"; status: "generated" | "cached" | "insufficient_grounded_data" | "unavailable"; brief: GroundedMarketBrief | null; contextFingerprint?: string; inputConfidence?: BriefInputConfidence; cache?: { hit: boolean }; reason?: string; }
export type ChineseAiMarketBriefStatus = "loading" | "ready" | "error";
export function useChineseAiMarketBrief() {
  const [status, setStatus] = useState<ChineseAiMarketBriefStatus>("loading");
  const [response, setResponse] = useState<ChineseAiMarketBriefApiResponse | null>(null);
  const requestId = useRef(0);
  const load = useCallback(async () => {
    const id = ++requestId.current;
    const controller = new AbortController();
    try { const res = await fetch("/api/zh/ai/market-brief", { cache: "no-store", signal: controller.signal }); const json = (await res.json()) as ChineseAiMarketBriefApiResponse; if (id !== requestId.current) return; setResponse(json); setStatus("ready"); }
    catch { if (id === requestId.current) setStatus("error"); }
    return controller;
  }, []);
  useEffect(() => {
    let active: AbortController | undefined;
    const start = () => { void load().then((controller) => { active = controller ?? undefined; }); };
    queueMicrotask(start);
    const timer = setInterval(() => { if (!document.hidden) { active?.abort(); start(); } }, 180_000);
    return () => { active?.abort(); clearInterval(timer); };
  }, [load]);
  return { status, response, refetch: () => { void load(); } };
}
