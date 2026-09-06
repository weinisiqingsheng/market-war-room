import type { IndexSurface } from "@war-room/types";

/**
 * Phase 1 symbol universe — the single source of truth for tickers.
 * Do NOT duplicate ticker arrays elsewhere.
 */

export interface IndexUniverseEntry {
  symbol: string;
  name: string;
  surface: IndexSurface;
}

export interface SectorUniverseEntry {
  symbol: string;
  sector: string;
}

export const MARKET_PULSE_UNIVERSE: IndexUniverseEntry[] = [
  { symbol: "SPY", name: "S&P 500 ETF", surface: "sakura" },
  { symbol: "QQQ", name: "Nasdaq 100 ETF", surface: "lavender" },
  { symbol: "IWM", name: "Russell 2000 ETF", surface: "cream" },
  { symbol: "DIA", name: "Dow 30 ETF", surface: "mint" },
];

export const SECTOR_UNIVERSE: SectorUniverseEntry[] = [
  { symbol: "XLK", sector: "Technology" },
  { symbol: "XLF", sector: "Financials" },
  { symbol: "XLE", sector: "Energy" },
  { symbol: "XLV", sector: "Healthcare" },
  { symbol: "XLI", sector: "Industrials" },
  { symbol: "XLP", sector: "Consumer Staples" },
  { symbol: "XLY", sector: "Consumer Discretionary" },
  { symbol: "XLU", sector: "Utilities" },
  { symbol: "XLB", sector: "Materials" },
  { symbol: "XLRE", sector: "Real Estate" },
  { symbol: "XLC", sector: "Communication Services" },
];

/** Market benchmark used for sector relative strength. */
export const BENCHMARK_SYMBOL = "SPY";

export const ALL_PHASE_1_SYMBOLS: string[] = [
  ...new Set([
    ...MARKET_PULSE_UNIVERSE.map((entry) => entry.symbol),
    ...SECTOR_UNIVERSE.map((entry) => entry.symbol),
  ]),
];

export function getIndexEntry(symbol: string): IndexUniverseEntry | undefined {
  return MARKET_PULSE_UNIVERSE.find((entry) => entry.symbol === symbol);
}

export function getSectorEntry(symbol: string): SectorUniverseEntry | undefined {
  return SECTOR_UNIVERSE.find((entry) => entry.symbol === symbol);
}
