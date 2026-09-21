import "server-only";
import { createJevConfig, type JevConfig } from "./config";
import { classifyJevError, JevAdapterError, shouldRetryJevStatus } from "./errors";
import type {
  JevProviderRequest,
  JevProviderResponse,
  JevTransport,
  JevTransportEnvelope,
} from "./types";

export interface HttpTransportDeps {
  fetch?: typeof fetch;
  apiKey?: string;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}

export function createHttpTransport(
  config: JevConfig = createJevConfig({ mode: "fixture" }),
  deps: HttpTransportDeps = {},
): JevTransport {
  const fetchImpl = deps.fetch ?? fetch;
  const sleep = deps.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  const now = deps.now ?? Date.now;
  return {
    async evaluate(
      request: JevProviderRequest,
      requestFingerprint: string,
    ): Promise<JevTransportEnvelope> {
      if (config.mode !== "http" || !config.allowRealProvider) {
        throw new JevAdapterError(
          "REAL_PROVIDER_DISABLED",
          "Real Jev provider execution is disabled.",
        );
      }
      const apiKey = deps.apiKey?.trim();
      if (!apiKey)
        throw new JevAdapterError("INVALID_CREDENTIALS", "A server-side Jev API key is required.");
      const started = now();
      let lastError: JevAdapterError | null = null;
      for (let attempt = 0; attempt <= config.maxRetries; attempt += 1) {
        const elapsed = now() - started;
        const remaining = config.timeoutMs - elapsed;
        if (remaining <= 0)
          throw new JevAdapterError(
            "PROVIDER_TIMEOUT",
            "Jev request exceeded its total deadline.",
            { retryable: false },
          );
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), remaining);
        try {
          const response = await fetchImpl(config.endpoint, {
            method: "POST",
            headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify(request),
            signal: controller.signal,
          });
          if (response.ok) {
            let body: JevProviderResponse;
            try {
              body = (await response.json()) as JevProviderResponse;
            } catch {
              throw new JevAdapterError("RESPONSE_INVALID", "Jev returned malformed JSON.");
            }
            return {
              transport: "http",
              response: body,
              requestFingerprint,
              latencyMs: now() - started,
            };
          }
          lastError = classifyJevError(response.status);
          if (!shouldRetryJevStatus(response.status) || attempt >= config.maxRetries)
            throw lastError;
          const retryAfterMs = Number(response.headers.get("retry-after-ms") ?? "");
          const retryAfterSeconds = Number(response.headers.get("retry-after") ?? "");
          const retryAfter = Number.isFinite(retryAfterMs)
            ? retryAfterMs
            : Number.isFinite(retryAfterSeconds)
              ? retryAfterSeconds * 1_000
              : Number.NaN;
          const delay =
            Number.isFinite(retryAfter) && retryAfter >= 0
              ? Math.min(retryAfter, Math.max(0, remaining - 1))
              : Math.min(250 * 2 ** attempt, Math.max(0, remaining - 1));
          if (delay > 0) await sleep(delay);
        } catch (error) {
          if (error instanceof JevAdapterError) {
            lastError = error;
            if (!error.retryable || attempt >= config.maxRetries) throw error;
          } else if (
            (typeof DOMException !== "undefined" &&
              error instanceof DOMException &&
              error.name === "AbortError") ||
            (error instanceof Error && error.name === "AbortError")
          ) {
            lastError = new JevAdapterError(
              "PROVIDER_TIMEOUT",
              "Jev request exceeded its total deadline.",
              { retryable: attempt < config.maxRetries },
            );
            if (attempt >= config.maxRetries) throw lastError;
          } else {
            lastError = new JevAdapterError(
              "PROVIDER_UNAVAILABLE",
              "Jev provider request failed.",
              { retryable: attempt < config.maxRetries },
            );
            if (attempt >= config.maxRetries) throw lastError;
          }
        } finally {
          clearTimeout(timer);
        }
      }
      throw (
        lastError ?? new JevAdapterError("RETRY_EXHAUSTED", "Jev request retries were exhausted.")
      );
    },
  };
}
