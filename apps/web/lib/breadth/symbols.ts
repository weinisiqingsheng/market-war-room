/**
 * Provider symbol normalization (S&P 500 universe ↔ Alpaca).
 *
 * Canonical tickers are stored dotted where a company has share classes
 * (e.g. "BRK.B"). Alpaca's API uses the same dotted form, but punctuation must
 * never be handled ad hoc in provider/calculation code — all conversions go
 * through these functions (and a few explicit share-class aliases).
 */
import { sp500Universe } from "./universe/sp500";

/** Share-class aliases that are sometimes written with a dash. */
const DASHED_ALIASES: Readonly<Record<string, string>> = {
  "BRK-B": "BRK.B",
  "BF-B": "BF.B",
  "LEN-B": "LEN.B",
};

export function canonicalToAlpaca(canonical: string): string {
  const ticker = canonical.trim().toUpperCase();
  return DASHED_ALIASES[ticker] ?? ticker;
}

export function alpacaToCanonical(alpaca: string): string {
  const ticker = alpaca.trim().toUpperCase();
  return DASHED_ALIASES[ticker] ?? ticker;
}

/** Alpaca request symbols for a canonical-ticker batch. */
export function toAlpacaSymbols(canonical: readonly string[]): string[] {
  return canonical.map(canonicalToAlpaca);
}

export function getUniverseTickers(): string[] {
  return sp500Universe.members.map((member) => member.ticker);
}

export function getUniverseInfo() {
  return {
    name: sp500Universe.name,
    version: sp500Universe.version,
    asOf: sp500Universe.asOf,
    count: sp500Universe.count,
  };
}
