"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { AskSakuraAnswer } from "@/lib/ask-sakura/types";

export interface ChineseAskApiSuccess { mode: "demo" | "live"; status: "generated"; contextFingerprint?: string | null; inputConfidence?: { score: number; label: string } | null; selectedFactCount: number; answer: AskSakuraAnswer; }
export type ChineseAskUiStatus = "idle" | "submitting" | "success" | "api_insufficient" | "unavailable";
export interface ChineseAskResult { status: ChineseAskUiStatus; data: ChineseAskApiSuccess | null; errorKind: "invalid_request" | "unavailable" | null; lastQuestion: string | null; submit: (question: string) => void; retry: () => void; clear: () => void; }

export function useChineseAskWarRoom(): ChineseAskResult {
  const [status, setStatus] = useState<ChineseAskUiStatus>("idle");
  const [data, setData] = useState<ChineseAskApiSuccess | null>(null);
  const [errorKind, setErrorKind] = useState<ChineseAskResult["errorKind"]>(null);
  const [lastQuestion, setLastQuestion] = useState<string | null>(null);
  const id = useRef(0); const controller = useRef<AbortController | null>(null); const disposed = useRef(false);
  useEffect(() => () => { disposed.current = true; controller.current?.abort(); }, []);
  const run = useCallback(async (raw: string) => {
    const question = raw.trim(); setLastQuestion(question);
    if (question.length < 2 || question.length > 500) { setErrorKind("invalid_request"); setStatus("unavailable"); return; }
    controller.current?.abort(); const current = ++id.current; const next = new AbortController(); controller.current = next;
    setData(null); setErrorKind(null); setStatus("submitting");
    try {
      const response = await fetch("/api/zh/ai/ask-war-room", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question }), signal: next.signal });
      if (disposed.current || id.current !== current) return;
      const json = (await response.json()) as {
        status?: string;
        mode?: "demo" | "live";
        answer?: AskSakuraAnswer;
        contextFingerprint?: string | null;
        inputConfidence?: { score: number; label: string } | null;
        selectedFactCount?: number;
      };
      if (!response.ok) { setErrorKind("unavailable"); setStatus("unavailable"); return; }
      if (json.status === "insufficient_grounded_data") { setStatus("api_insufficient"); return; }
      if (json.status === "generated" && json.answer) { setData({ mode: json.mode ?? "demo", status: "generated", contextFingerprint: json.contextFingerprint, inputConfidence: json.inputConfidence, selectedFactCount: json.selectedFactCount ?? 0, answer: json.answer }); setStatus("success"); return; }
      setErrorKind("unavailable"); setStatus("unavailable");
    } catch { if (!disposed.current && id.current === current) { setErrorKind("unavailable"); setStatus("unavailable"); } }
  }, []);
  return { status, data, errorKind, lastQuestion, submit: useCallback((q: string) => { void run(q); }, [run]), retry: useCallback(() => { if (lastQuestion) void run(lastQuestion); }, [lastQuestion, run]), clear: useCallback(() => { setData(null); setErrorKind(null); setLastQuestion(null); setStatus("idle"); }, []) };
}
