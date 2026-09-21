"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { TickerResearchApiFailure, TickerResearchApiOk } from "@/lib/ticker-context/api-types";

/**
 * UI state for one ticker research request. Mirrors the V1.2A HTTP contract:
 * `ok` / `partial` / `insufficient_data` come from a 200 payload, the failure
 * states from the documented 404 / 422 / 503 codes, and `invalid_symbol` from
 * the same client-side rule the API applies (1–10 chars, starts with a letter,
 * letters/digits/`.`/`-`).
 */
export type TickerResearchStatus =
  | "idle"
  | "loading"
  | "invalid_symbol"
  | "ok"
  | "partial"
  | "insufficient_data"
  | "unknown_symbol"
  | "unsupported_security_type"
  | "unavailable";

export interface TickerResearchError {
  code: string;
  message: string;
}

export interface UseTickerResearchResult {
  status: TickerResearchStatus;
  /** Normalized symbol the current state belongs to (null while idle). */
  symbol: string | null;
  /** Successful (ok/partial/insufficient_data) payload — never a stale one. */
  data: TickerResearchApiOk | null;
  /** Safe API error detail (code + message only, no provider payloads). */
  error: TickerResearchError | null;
  /** Submitted symbol of the last request (used by Retry). */
  lastSubmitted: string | null;
  /** Submit-only: fetches exactly once per call — never on keystroke. */
  research: (raw: string) => void;
  retry: () => void;
}

/** Same rule as `normalizeTickerSymbol` in lib/ticker-context/symbol.ts. */
const SYMBOL_PATTERN = /^[A-Za-z][A-Za-z0-9.\-]{0,9}$/;
const FETCH_TIMEOUT_MS = 30_000;

export function normalizeSubmittedSymbol(raw: string): string | null {
  const trimmed = raw.trim();
  if (!SYMBOL_PATTERN.test(trimmed)) return null;
  return trimmed.toUpperCase();
}

interface RequestState {
  status: TickerResearchStatus;
  symbol: string | null;
  data: TickerResearchApiOk | null;
  error: TickerResearchError | null;
}

/**
 * Owns the ticker research request lifecycle for the Markets workspace.
 *
 * - AbortController + monotonically increasing request id: a slower earlier
 *   response (NVDA) can never overwrite a newer one (TSLA), so the identity
 *   header and the metric cards always belong to the same symbol.
 * - Aborts on unmount; no polling and no timers beyond the request timeout.
 * - No provider or LLM code is imported here: the browser only calls the local
 *   Next.js route.
 */
export function useTickerResearch(): UseTickerResearchResult {
  const [state, setState] = useState<RequestState>(IDLE);
  const [lastSubmitted, setLastSubmitted] = useState<string | null>(null);
  const requestId = useRef(0);
  const activeController = useRef<AbortController | null>(null);

  const run = useCallback(async (symbol: string) => {
    const id = ++requestId.current;
    activeController.current?.abort();
    const controller = new AbortController();
    activeController.current = controller;
    const timer = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    setLastSubmitted(symbol);
    setState({ status: "loading", symbol, data: null, error: null });

    try {
      const response = await fetch(
        `/api/intelligence/ticker?symbol=${encodeURIComponent(symbol)}`,
        { cache: "no-store", signal: controller.signal },
      );
      let body: unknown = null;
      try {
        body = await response.json();
      } catch {
        body = null;
      }
      // Stale check: a later request already took ownership of the UI.
      if (requestId.current !== id) return;

      if (response.ok) {
        const payload = body as TickerResearchApiOk | null;
        if (
          !payload ||
          typeof payload !== "object" ||
          typeof payload.context !== "object" ||
          payload.context === null ||
          !Array.isArray(payload.context.facts)
        ) {
          setState({
            status: "unavailable",
            symbol,
            data: null,
            error: {
              code: "MALFORMED_PAYLOAD",
              message: "Ticker research returned an unexpected payload.",
            },
          });
          return;
        }
        setState({ status: payload.status, symbol, data: payload, error: null });
        return;
      }

      const failure = body as TickerResearchApiFailure | null;
      const code = failure?.error?.code ?? `HTTP_${response.status}`;
      const message = failure?.error?.message ?? "Ticker research temporarily unavailable.";
      const error = { code, message };
      if (response.status === 404 || failure?.status === "unsupported_symbol") {
        setState({
          status: code === "UNKNOWN_SYMBOL" ? "unknown_symbol" : "unsupported_security_type",
          symbol,
          data: null,
          error,
        });
        return;
      }
      if (response.status === 422) {
        setState({ status: "unsupported_security_type", symbol, data: null, error });
        return;
      }
      setState({ status: "unavailable", symbol, data: null, error });
    } catch {
      if (requestId.current !== id) return;
      setState({
        status: "unavailable",
        symbol,
        data: null,
        error: { code: "REQUEST_FAILED", message: "Ticker research temporarily unavailable." },
      });
    } finally {
      window.clearTimeout(timer);
      if (activeController.current === controller) activeController.current = null;
    }
  }, []);

  const research = useCallback(
    (raw: string) => {
      // A new submit always supersedes any in-flight request, including when the
      // new input is rejected locally.
      const normalized = normalizeSubmittedSymbol(raw);
      if (normalized === null) {
        requestId.current += 1;
        activeController.current?.abort();
        activeController.current = null;
        setLastSubmitted(null);
        setState({
          status: "invalid_symbol",
          symbol: raw.trim().toUpperCase() || null,
          data: null,
          error: {
            code: "INVALID_SYMBOL",
            message:
              "Symbol must start with a letter and contain only letters, digits, '.' or '-' (max 10 characters).",
          },
        });
        return;
      }
      void run(normalized);
    },
    [run],
  );

  const retry = useCallback(() => {
    if (lastSubmitted) void run(lastSubmitted);
  }, [lastSubmitted, run]);

  useEffect(
    () => () => {
      activeController.current?.abort();
      activeController.current = null;
    },
    [],
  );

  return { ...state, lastSubmitted, research, retry };
}

const IDLE: RequestState = { status: "idle", symbol: null, data: null, error: null };
