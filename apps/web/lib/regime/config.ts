import "server-only";
import type { MarketDataMode } from "@war-room/types";

/**
 * Server-side regime configuration.
 *
 * REGIME_MODE (demo | live, default demo) decides whether the dashboard calls
 * the real Python analytics engine. ANALYTICS_BASE_URL points at the FastAPI
 * service. Credentials for market/macro providers are handled by their own
 * config modules — never duplicated here, never exposed to the browser.
 */
export interface RegimeDataConfig {
  mode: MarketDataMode;
  analyticsBaseUrl: string;
  /** Short engine timeout — a slow analytics call must not block the page. */
  timeoutMs: number;
}

const DEFAULT_ANALYTICS_BASE_URL = "http://127.0.0.1:8000";
const DEFAULT_TIMEOUT_MS = 4_000;

function toPositiveInt(raw: string | undefined, fallback: number): number {
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : fallback;
}

/** Reads configuration fresh on every call (no module cache) — test friendly. */
export function getRegimeDataConfig(): RegimeDataConfig {
  return {
    mode: process.env.REGIME_MODE === "live" ? "live" : "demo",
    analyticsBaseUrl: process.env.ANALYTICS_BASE_URL ?? DEFAULT_ANALYTICS_BASE_URL,
    timeoutMs: toPositiveInt(process.env.REGIME_TIMEOUT_MS, DEFAULT_TIMEOUT_MS),
  };
}
