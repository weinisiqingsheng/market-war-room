/**
 * HTTP client for the Python regime engine (POST /v1/regime/evaluate).
 *
 * The Python service is the canonical scorer. This client only transports the
 * RegimeInput and normalizes the snake_case result into the shared camelCase
 * contract. A short timeout keeps an analytics outage from blocking the page.
 */
import type { RegimeResult } from "@war-room/types";
import { MarketDataError } from "@/lib/market-data/errors";
import type { RegimeDataConfig } from "./config";
import type { RegimeInputPayload } from "./types";

export type RegimeFetch = (input: string, init?: RequestInit) => Promise<Response>;

export async function evaluateRegime(
  config: RegimeDataConfig,
  payload: RegimeInputPayload,
  fetchImpl?: RegimeFetch,
): Promise<RegimeResult> {
  const doFetch = fetchImpl ?? ((...args) => fetch(...args));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);

  let response: Response;
  try {
    response = await doFetch(`${config.analyticsBaseUrl}/v1/regime/evaluate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(toEnginePayload(payload)),
      signal: controller.signal,
      cache: "no-store",
    });
  } catch (error) {
    const category = error instanceof Error && error.name === "AbortError" ? "timeout" : "network";
    throw new MarketDataError(
      category,
      `${category} while reaching the regime engine`,
      undefined,
      "regime",
    );
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    throw new MarketDataError(
      "server",
      `Regime engine returned ${response.status}`,
      response.status,
      "regime",
    );
  }

  const text = await response.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new MarketDataError(
      "malformed",
      "Regime engine returned malformed JSON",
      undefined,
      "regime",
    );
  }

  const result = parseRegimeResult(parsed);
  if (!result) {
    throw new MarketDataError(
      "malformed",
      "Regime engine returned an unexpected payload",
      undefined,
      "regime",
    );
  }
  return result;
}

/** Serializes the camelCase RegimeInput into the Python snake_case payload. */
export function toEnginePayload(payload: RegimeInputPayload): Record<string, unknown> {
  const macro = payload.macro
    ? Object.fromEntries(
        Object.entries(payload.macro).map(([key, signal]) => [
          key,
          signal
            ? {
                value: signal.value,
                change: signal.change,
                change_pct: signal.changePct,
                available: signal.available,
                stale: signal.stale,
                frequency: signal.frequency,
              }
            : null,
        ]),
      )
    : null;

  return {
    as_of: payload.as_of,
    indices: payload.indices.map((index) => ({
      ticker: index.ticker,
      change_pct: index.changePct,
      available: index.available,
      stale: index.stale,
    })),
    sectors: payload.sectors.map((sector) => ({
      ticker: sector.ticker,
      change_pct: sector.changePct,
      available: sector.available,
      stale: sector.stale,
    })),
    macro,
  };
}

/** Normalizes the Python snake_case result into the camelCase RegimeResult. */
export function parseRegimeResult(raw: unknown): RegimeResult | null {
  if (!raw || typeof raw !== "object") return null;
  const body = raw as Record<string, unknown>;

  const required =
    "score" in body &&
    "display_score" in body &&
    "label" in body &&
    typeof body["coverage"] === "number" &&
    "confidence" in body &&
    Array.isArray(body["components"]) &&
    Array.isArray(body["positive_drivers"]) &&
    Array.isArray(body["negative_drivers"]) &&
    Array.isArray(body["stale_inputs"]) &&
    Array.isArray(body["missing_inputs"]) &&
    typeof body["engine_version"] === "string";

  if (!required) return null;

  return {
    score: (body["score"] as number | null) ?? null,
    displayScore: (body["display_score"] as number | null) ?? null,
    label: String(body["label"]),
    coverage: body["coverage"] as number,
    confidence: body["confidence"] as RegimeResult["confidence"],
    components: (body["components"] as unknown[]).map((component) => {
      const c = component as Record<string, unknown>;
      return {
        id: c["id"] as RegimeResult["components"][number]["id"],
        name: String(c["name"]),
        score: (c["score"] as number | null) ?? null,
        weight: c["weight"] as number,
      };
    }),
    positiveDrivers: (body["positive_drivers"] as unknown[]).map((driver) => mapDriver(driver)),
    negativeDrivers: (body["negative_drivers"] as unknown[]).map((driver) => mapDriver(driver)),
    staleInputs: (body["stale_inputs"] as unknown[]).map(String),
    missingInputs: (body["missing_inputs"] as unknown[]).map(String),
    asOf: typeof body["as_of"] === "string" ? body["as_of"] : null,
    engineVersion: String(body["engine_version"]),
  };
}

function mapDriver(driver: unknown): RegimeResult["positiveDrivers"][number] {
  const d = driver as Record<string, unknown>;
  return {
    id: String(d["id"]),
    name: String(d["name"]),
    direction: d["direction"] as RegimeResult["positiveDrivers"][number]["direction"],
    impact: d["impact"] as number,
    reason: String(d["reason"]),
  };
}
