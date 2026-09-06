/**
 * GICS sector → SPDR ETF mapping (deterministic, centralized).
 *
 * Sector names match the GICS sectors stored on the offline S&P 500 universe.
 * Sector-relative anomaly comparisons use the SAME delayed-SIP feed as the
 * stocks they benchmark against — never live-IEX sector moves.
 */
import type { Sp500Member } from "@/lib/breadth/universe/sp500";

export const GICS_TO_SPDR: Readonly<Record<string, string>> = {
  "Information Technology": "XLK",
  Financials: "XLF",
  Energy: "XLE",
  "Health Care": "XLV",
  Industrials: "XLI",
  "Consumer Staples": "XLP",
  "Consumer Discretionary": "XLY",
  Utilities: "XLU",
  Materials: "XLB",
  "Real Estate": "XLRE",
  "Communication Services": "XLC",
};

export const SPDR_TO_GICS = new Map<string, string>(
  Object.entries(GICS_TO_SPDR).map(([sector, etf]) => [etf, sector]),
);

export const ALL_SECTOR_ETFS: readonly string[] = [...new Set(Object.values(GICS_TO_SPDR))];

export function sectorEtfFor(sector: string): string | null {
  return GICS_TO_SPDR[sector] ?? null;
}

export function sectorEtfForMember(member: Sp500Member): string {
  return sectorEtfFor(member.sector) ?? "";
}
