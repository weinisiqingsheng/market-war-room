/**
 * Builds the canonical RegimeInput from the already-normalized market + macro
 * overviews. Pure and deterministic — unit-testable without any fetch layer.
 *
 * The equity/macro overviews are the products of the Phase 1/2 providers, so
 * this layer stays ignorant of Alpaca/FRED/Twelve entirely.
 */
import type { MacroOverview, MacroSignalId, MarketOverview } from "@war-room/types";
import type { RegimeInputPayload } from "./types";

const INDEX_TICKERS = ["SPY", "QQQ", "IWM", "DIA"] as const;
const SECTOR_TICKERS = [
  "XLK",
  "XLY",
  "XLI",
  "XLF",
  "XLP",
  "XLV",
  "XLU",
  "XLE",
  "XLB",
  "XLRE",
  "XLC",
] as const;
const MACRO_KEYS: MacroSignalId[] = ["vix", "us10y", "usd_broad", "wti", "gold", "btc"];

export function buildRegimeInput(market: MarketOverview, macro: MacroOverview): RegimeInputPayload {
  const indexByTicker = new Map(market.indices.map((index) => [index.ticker, index]));
  const sectorByTicker = new Map(market.sectors.map((sector) => [sector.etf, sector]));
  const macroById = new Map(macro.signals.map((signal) => [signal.id, signal]));

  const marketWideStale = market.meta.stale;

  const indices = INDEX_TICKERS.map((ticker) => {
    const index = indexByTicker.get(ticker);
    const available = Boolean(index && index.changePct !== null);
    return {
      ticker,
      changePct: index?.changePct ?? null,
      available,
      stale: available && marketWideStale,
    };
  });

  const sectors = SECTOR_TICKERS.map((ticker) => {
    const sector = sectorByTicker.get(ticker);
    const available = Boolean(sector && sector.dailyReturnPct !== null);
    return {
      ticker,
      changePct: sector?.dailyReturnPct ?? null,
      available,
      stale: available && marketWideStale,
    };
  });

  const macroPayload: RegimeInputPayload["macro"] = {
    vix: null,
    us10y: null,
    usd_broad: null,
    wti: null,
    gold: null,
    btc: null,
  };
  for (const id of MACRO_KEYS) {
    const signal = macroById.get(id);
    macroPayload[id] = signal
      ? {
          value: signal.value,
          change: signal.change,
          changePct: signal.changePct,
          available: signal.available,
          stale: signal.stale,
          frequency: signal.frequency,
        }
      : null;
  }

  return {
    as_of: newestOf(market.meta.asOf, macro.meta.asOf),
    indices,
    sectors,
    macro: macroPayload,
  };
}

function newestOf(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return Date.parse(b) > Date.parse(a) ? b : a;
}
