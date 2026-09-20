"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AskSakuraAnswer } from "@/lib/ask-sakura/types";

/** Client-safe mirror of POST /api/ai/ask-sakura. */
export interface AskTickerResearchInfo {
  requestedSymbol: string;
  symbol: string | null;
  status: string;
  reason: string | null;
  effectiveAsOf: string | null;
  marketSessionAsOf: string | null;
  freshness: string | null;
  confidence: string | null;
  factCount: number;
  researchVersion: string;
}

export interface AskSakuraApiSuccess {
  mode: "demo" | "live";
  status: "generated";
  contextFingerprint: string | null;
  inputConfidence: { score: number; label: string } | null;
  selectedFactCount: number;
  answer: AskSakuraAnswer;
  /** V1.2B: present when on-demand ticker research grounded this answer. */
  research?: AskTickerResearchInfo | null;
}

export type AskSakuraUiStatus =
  "idle" | "submitting" | "success" | "api_insufficient" | "unavailable";

export interface UseAskSakuraResult {
  status: AskSakuraUiStatus;
  data: AskSakuraApiSuccess | null;
  errorKind: "invalid_request" | "unavailable" | null;
  lastQuestion: string | null;
  /** V1.2B: ticker research metadata for the latest answer/limitation. */
  research: AskTickerResearchInfo | null;
  /** V1.2B: safe reason code when the answer was insufficient (e.g. unknown_symbol). */
  insufficientReason: string | null;
  submit: (rawQuestion: string) => void;
  retry: () => void;
  clear: () => void;
}

export function useAskSakura(): UseAskSakuraResult {
  const [status, setStatus] = useState<AskSakuraUiStatus>("idle");
  const [data, setData] = useState<AskSakuraApiSuccess | null>(null);
  const [errorKind, setErrorKind] = useState<"invalid_request" | "unavailable" | null>(null);
  const [lastQuestion, setLastQuestion] = useState<string | null>(null);
  const [research, setResearch] = useState<AskTickerResearchInfo | null>(null);
  const [insufficientReason, setInsufficientReason] = useState<string | null>(null);

  const requestId = useRef(0);
  const controllerRef = useRef<AbortController | null>(null);
  const disposedRef = useRef(false);

  useEffect(() => {
    disposedRef.current = false;
    return () => {
      disposedRef.current = true;
      controllerRef.current?.abort();
    };
  }, []);

  const run = useCallback(async (question: string) => {
    const trimmed = question.trim();
    setLastQuestion(trimmed);
    setResearch(null);
    setInsufficientReason(null);
    if (trimmed.length < 2 || trimmed.length > 500) {
      setErrorKind("invalid_request");
      setStatus("unavailable");
      return;
    }

    controllerRef.current?.abort();
    const id = ++requestId.current;
    const controller = new AbortController();
    controllerRef.current = controller;
    setData(null);
    setErrorKind(null);
    setStatus("submitting");

    try {
      const response = await fetch("/api/ai/ask-sakura", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed }),
        signal: controller.signal,
      });
      if (disposedRef.current || requestId.current !== id) return;
      const json = (await response.json()) as {
        status?: string;
        mode?: "demo" | "live";
        answer?: AskSakuraAnswer;
        contextFingerprint?: string | null;
        inputConfidence?: { score: number; label: string } | null;
        selectedFactCount?: number;
        reason?: string | null;
        research?: AskTickerResearchInfo | null;
      };
      if (disposedRef.current || requestId.current !== id) return;
      if (!response.ok) {
        setErrorKind("unavailable");
        setStatus("unavailable");
        return;
      }
      if (json.status === "insufficient_grounded_data") {
        setInsufficientReason(json.reason ?? null);
        setResearch(json.research ?? null);
        setStatus("api_insufficient");
        return;
      }
      if (json.status === "generated" && json.answer) {
        setResearch(json.research ?? null);
        setData({
          mode: json.mode ?? "demo",
          status: "generated",
          contextFingerprint: json.contextFingerprint ?? null,
          inputConfidence: json.inputConfidence ?? null,
          selectedFactCount: json.selectedFactCount ?? 0,
          answer: json.answer,
          research: json.research ?? null,
        });
        setStatus("success");
        return;
      }
      setErrorKind("unavailable");
      setStatus("unavailable");
    } catch {
      if (disposedRef.current || requestId.current !== id) return;
      setErrorKind("unavailable");
      setStatus("unavailable");
    }
  }, []);

  const submit = useCallback(
    (rawQuestion: string) => {
      void run(rawQuestion);
    },
    [run],
  );

  const retry = useCallback(() => {
    if (lastQuestion) void run(lastQuestion);
  }, [lastQuestion, run]);

  const clear = useCallback(() => {
    setData(null);
    setErrorKind(null);
    setLastQuestion(null);
    setResearch(null);
    setInsufficientReason(null);
    setStatus("idle");
  }, []);

  return {
    status,
    data,
    errorKind,
    lastQuestion,
    research,
    insufficientReason,
    submit,
    retry,
    clear,
  };
}
