/** High-level, safe error categories surfaced to the API/UI (never raw payloads). */
export type MarketDataErrorCategory =
  "config" | "auth" | "rate_limit" | "server" | "network" | "timeout" | "malformed" | "unknown";

export class MarketDataError extends Error {
  readonly category: MarketDataErrorCategory;
  readonly status: number | undefined;
  readonly provider: string;

  constructor(
    category: MarketDataErrorCategory,
    message: string,
    status?: number,
    provider = "alpaca",
  ) {
    super(message);
    this.name = "MarketDataError";
    this.category = category;
    this.status = status;
    this.provider = provider;
  }
}
