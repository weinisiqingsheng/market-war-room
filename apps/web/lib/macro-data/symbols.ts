import type {
  MacroDisplayUnit,
  MacroFrequency,
  MacroProviderId,
  MacroSignalId,
} from "@war-room/types";

/**
 * Central macro signal configuration — the single source of truth for the six
 * Macro Pulse signals and their provider ownership.
 *
 * TWELVE DATA: owns ONLY Gold (`XAU/USD`) for Phase 2. WTI moved to FRED
 * (`DCOILWTICO`) — real validation showed plain `WTI` on Twelve Data resolves
 * to the W&T Offshore stock, and Twelve Data is not asked for crude oil in any
 * form. The app deliberately does NOT use ETF proxies (USO/GLD, and no
 * UUP/UDN for the dollar).
 *
 * US DOLLAR SIGNAL: the dollar cell is FRED `DTWEXBGS` (Nominal Broad U.S.
 * Dollar Index) — a FRED daily trade-weighted index. It is deliberately NOT
 * ICE DXY, and is never labeled/provided as "DXY".
 *
 * WTI SIGNAL: FRED `DCOILWTICO` is the EIA spot price for West Texas
 * Intermediate (Cushing, Oklahoma) — a DAILY macro anchor, never an intraday
 * crude feed. The card discloses "FRED · Daily".
 */
export interface MacroSignalDefinition {
  id: MacroSignalId;
  label: string;
  /** Instrument descriptor shown in the provenance line before the source. */
  instrument?: string;
  displayUnit: MacroDisplayUnit;
  provider: MacroProviderId;
  frequency: MacroFrequency;
  /** Human-readable source name shown in the cell provenance line. */
  source: string;
  fredSeriesId?: string;
  twelveSymbol?: string;
  alpacaCryptoPair?: string;
}

export const MACRO_SIGNALS: Record<MacroSignalId, MacroSignalDefinition> = {
  vix: {
    id: "vix",
    label: "VIX",
    displayUnit: "index",
    provider: "fred",
    frequency: "daily",
    source: "FRED",
    fredSeriesId: "VIXCLS", // CBOE Volatility Index, Daily Close (verified on FRED)
  },
  us10y: {
    id: "us10y",
    label: "US 10Y",
    displayUnit: "percent",
    provider: "fred",
    frequency: "daily",
    source: "FRED",
    fredSeriesId: "DGS10", // 10-Year Treasury Constant Maturity, Daily (verified on FRED)
  },
  wti: {
    id: "wti",
    label: "WTI",
    displayUnit: "price",
    provider: "fred",
    frequency: "daily",
    source: "FRED",
    // Crude Oil Prices: WTI (Cushing, Oklahoma) — EIA spot, daily (verified on
    // FRED). WTI is a daily macro anchor, not an intraday crude feed.
    fredSeriesId: "DCOILWTICO",
  },
  usd_broad: {
    id: "usd_broad",
    label: "US Dollar",
    instrument: "Broad USD Index",
    displayUnit: "index",
    provider: "fred",
    frequency: "daily",
    source: "FRED",
    // Nominal Broad U.S. Dollar Index, daily (verified on FRED). Deliberately
    // NOT ICE DXY — this is the trade-weighted broad dollar index.
    fredSeriesId: "DTWEXBGS",
  },
  gold: {
    id: "gold",
    label: "Gold",
    displayUnit: "price",
    provider: "twelve",
    frequency: "intraday",
    source: "Twelve Data",
    twelveSymbol: "XAU/USD", // served via /price (current) + /time_series (daily close)
  },
  btc: {
    id: "btc",
    label: "BTC",
    displayUnit: "price",
    provider: "alpaca-crypto",
    frequency: "realtime",
    source: "Alpaca",
    alpacaCryptoPair: "BTC/USD",
  },
};

export const MACRO_SIGNAL_IDS = Object.keys(MACRO_SIGNALS) as MacroSignalId[];

/** Twelve Data symbol(s) — Gold XAU/USD only. WTI is never requested. */
export const TWELVE_DATA_SYMBOLS = ["XAU/USD"] as const;
