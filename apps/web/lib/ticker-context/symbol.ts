/**
 * Symbol normalization + provider security-directory classification.
 *
 * Validity is decided by the provider's real security directory (Alpaca
 * assets), never by the market-wide Evidence Pack or the S&P/Nasdaq snapshots.
 * No silent substitution: an ambiguous or unknown lookup fails closed.
 */
import { canonicalToAlpaca } from "@/lib/breadth/symbols";
import type { TickerFailureReason, TickerIdentity } from "./types";

/** Symbols: 1–10 chars, start with a letter, letters/digits/dot/dash only. */
const SYMBOL_PATTERN = /^[A-Za-z][A-Za-z0-9.\-]{0,9}$/;

export function normalizeTickerSymbol(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!SYMBOL_PATTERN.test(trimmed)) return null;
  return trimmed.toUpperCase();
}

/** Provider request form of a canonical symbol (share-class aliases reused). */
export function toProviderSymbol(canonical: string): string {
  return canonicalToAlpaca(canonical);
}

export interface ProviderAsset {
  symbol?: unknown;
  name?: unknown;
  exchange?: unknown;
  class?: unknown;
  status?: unknown;
  tradable?: unknown;
}

export type AssetClassification =
  | { kind: "supported"; identity: TickerIdentity }
  | { kind: "not_found" }
  | { kind: "unsupported"; reason: TickerFailureReason; assetClass: string };

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

/**
 * Supported = active, tradable, US equity. Crypto, OTC/unsupported classes and
 * inactive/delisted symbols are rejected explicitly (never resolved to another
 * security).
 */
export function classifyProviderAsset(
  requestedSymbol: string,
  asset: ProviderAsset,
): AssetClassification {
  const assetClass = str(asset.class) ?? "unknown";
  const status = str(asset.status) ?? "unknown";
  const symbol = str(asset.symbol) ?? requestedSymbol;
  const name = str(asset.name);
  if (!name) return { kind: "unsupported", reason: "provider_unavailable", assetClass };
  if (assetClass !== "us_equity") {
    return { kind: "unsupported", reason: "unsupported_security_type", assetClass };
  }
  if (status !== "active" || asset.tradable !== true) {
    return { kind: "unsupported", reason: "unsupported_security_type", assetClass };
  }
  return {
    kind: "supported",
    identity: {
      symbol: symbol.toUpperCase(),
      name,
      exchange: str(asset.exchange),
      assetClass,
      status,
      tradable: true,
    },
  };
}
