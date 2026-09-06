import type { MarketDataErrorCategory } from "./errors";

/**
 * Structured, credential-free provider error logging.
 * Logs category + status + timestamp + high-level message only.
 * Never logs API keys, secrets, or raw upstream payloads.
 */
export function logProviderIssue(
  category: MarketDataErrorCategory,
  status: number | undefined,
  provider: string,
  message: string,
): void {
  console.error(
    `[market-data] provider=${provider} category=${category} status=${status ?? "n/a"} ` +
      `ts=${new Date().toISOString()} message=${message}`,
  );
}
