import "server-only";
import { MarketDataError } from "@/lib/market-data/errors";
import { logProviderIssue } from "@/lib/market-data/log";
import type { MacroDataConfig } from "../config";
import { normalizeFredSeries, type FredResponse } from "../normalize";
import { MACRO_SIGNALS } from "../symbols";
import {
  unavailableMacroSnapshot,
  type MacroProviderResult,
  type NormalizedMacroSnapshot,
} from "../types";

const FRED_SIGNAL_IDS = ["vix", "us10y", "usd_broad", "wti"] as const;

/**
 * FRED provider — daily observations only (VIXCLS, DGS10, DTWEXBGS, DCOILWTICO).
 * Never advertised as real-time; freshness uses daily-cadence stale logic.
 */
export async function getFredSignals(
  config: MacroDataConfig,
  fetchImpl?: typeof fetch,
): Promise<MacroProviderResult> {
  const signals: NormalizedMacroSnapshot[] = [];

  for (const id of FRED_SIGNAL_IDS) {
    const definition = MACRO_SIGNALS[id];
    const seriesId = definition.fredSeriesId;
    if (!config.fredApiKey || !seriesId) {
      signals.push(unavailableMacroSnapshot(id, definition.frequency));
      continue;
    }
    try {
      const payload = await fetchFredObservations(config, seriesId, fetchImpl);
      signals.push(normalizeFredSeries(id, payload));
    } catch (error) {
      // One failed series must not blank the other FRED signal.
      logProviderIssue(
        error instanceof MarketDataError ? error.category : "unknown",
        error instanceof MarketDataError ? error.status : undefined,
        "fred",
        `${seriesId}: ${error instanceof Error ? error.message : "unknown error"}`,
      );
      signals.push(unavailableMacroSnapshot(id, definition.frequency));
    }
  }

  return { provider: "fred", signals, degraded: false };
}

async function fetchFredObservations(
  config: MacroDataConfig,
  seriesId: string,
  fetchImpl?: typeof fetch,
): Promise<FredResponse> {
  const doFetch = fetchImpl ?? ((...args: Parameters<typeof fetch>) => fetch(...args));
  const url =
    `${config.fredBaseUrl}/series/observations` +
    `?series_id=${encodeURIComponent(seriesId)}` +
    `&api_key=${encodeURIComponent(config.fredApiKey ?? "")}` +
    `&file_type=json&sort_order=desc&limit=10`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);

  let response: Response;
  try {
    response = await doFetch(url, { signal: controller.signal, cache: "no-store" });
  } catch (error) {
    const category = error instanceof Error && error.name === "AbortError" ? "timeout" : "network";
    throw new MarketDataError(category, `${category} while reaching FRED`);
  } finally {
    clearTimeout(timer);
  }

  if (response.status === 401 || response.status === 403) {
    throw new MarketDataError(
      "auth",
      `FRED rejected API key (${response.status})`,
      response.status,
    );
  }
  if (response.status === 429) {
    throw new MarketDataError("rate_limit", "FRED rate limit exceeded", response.status);
  }
  if (response.status >= 500) {
    throw new MarketDataError(
      "server",
      `FRED upstream error (${response.status})`,
      response.status,
    );
  }
  if (!response.ok) {
    throw new MarketDataError("unknown", `FRED returned ${response.status}`, response.status);
  }

  const text = await response.text();
  try {
    return JSON.parse(text) as FredResponse;
  } catch {
    throw new MarketDataError("malformed", "FRED returned malformed JSON");
  }
}
