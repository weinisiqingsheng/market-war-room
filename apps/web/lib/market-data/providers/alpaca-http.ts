import "server-only";
import { MarketDataError } from "../errors";

/**
 * Shared Alpaca REST fetch with credentials + timeout + safe error mapping.
 * Used by the equities snapshot provider (Phase 1) and the crypto macro
 * provider (Phase 2) so both share one auth/error/timeout implementation.
 */
export interface AlpacaHttpOptions {
  baseUrl: string;
  path: string;
  apiKeyId: string;
  apiSecretKey: string;
  timeoutMs: number;
  /** Injectable fetch for tests; defaults to the global fetch. */
  fetchImpl?: typeof fetch;
}

export async function alpacaFetch(options: AlpacaHttpOptions): Promise<unknown> {
  const { fetchImpl } = options;
  const doFetch = fetchImpl ?? ((...args: Parameters<typeof fetch>) => fetch(...args));

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs);

  let response: Response;
  try {
    response = await doFetch(`${options.baseUrl}${options.path}`, {
      headers: {
        "APCA-API-KEY-ID": options.apiKeyId,
        "APCA-API-SECRET-KEY": options.apiSecretKey,
      },
      signal: controller.signal,
      cache: "no-store",
    });
  } catch (error) {
    const category = error instanceof Error && error.name === "AbortError" ? "timeout" : "network";
    throw new MarketDataError(category, `${category} while reaching Alpaca`, undefined);
  } finally {
    clearTimeout(timer);
  }

  if (response.status === 401 || response.status === 403) {
    throw new MarketDataError(
      "auth",
      `Alpaca rejected credentials (${response.status})`,
      response.status,
    );
  }
  if (response.status === 429) {
    throw new MarketDataError("rate_limit", "Alpaca rate limit exceeded", response.status);
  }
  if (response.status >= 500) {
    throw new MarketDataError(
      "server",
      `Alpaca upstream error (${response.status})`,
      response.status,
    );
  }
  if (!response.ok) {
    throw new MarketDataError("unknown", `Alpaca returned ${response.status}`, response.status);
  }

  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new MarketDataError("malformed", "Alpaca returned malformed JSON", response.status);
  }
}
