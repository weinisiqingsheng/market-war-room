/**
 * Current-session normalization for S&P 500 breadth constituents.
 *
 * Conservative price selection (delayed SIP semantics):
 * - during a regular US session → the session daily-bar close (running close);
 * - after the regular session closes → the regular-session daily close;
 *   an after-hours/overnight latest trade is NEVER used as the breadth price;
 * - a missing daily close/previous close makes the name unavailable — a name
 *   with missing data is never classified as "unchanged".
 */
import { CHANGE_EPSILON_PCT } from "./constants";
import { barSessionDate, todayETKey } from "./dates";

export type BreadthMove = "advancer" | "decliner" | "unchanged" | "unavailable";

export interface AlpacaBreadthBar {
  t?: string;
  o?: number;
  h?: number;
  l?: number;
  c?: number;
  v?: number;
}

export interface AlpacaBreadthSnapshot {
  latestTrade?: { t?: string; p?: number; s?: number };
  minuteBar?: AlpacaBreadthBar;
  dailyBar?: AlpacaBreadthBar;
  prevDailyBar?: AlpacaBreadthBar;
}

export interface BreadthSymbolState {
  ticker: string;
  available: boolean;
  /** Conservative regular-session reference price. */
  refPrice: number | null;
  /** Previous regular-session close. */
  previousClose: number | null;
  changePct: number | null;
  move: BreadthMove;
  /** Session date (YYYY-MM-DD, ET) of the current daily bar. */
  sessionDate: string | null;
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function normalizeBreadthSymbol(
  ticker: string,
  raw: AlpacaBreadthSnapshot | null | undefined,
  marketOpen: boolean | null,
  now: number,
): BreadthSymbolState {
  if (!raw || typeof raw !== "object") {
    return unavailableState(ticker);
  }

  const dailyClose = num(raw.dailyBar?.c);
  const tradePrice = num(raw.latestTrade?.p);
  const previousClose = num(raw.prevDailyBar?.c);

  // Conservative reference price (see module docstring).
  let refPrice: number | null = null;
  if (marketOpen === false) {
    refPrice = dailyClose; // regular session only — ignore after-hours trades
  } else if (marketOpen === true) {
    refPrice = dailyClose ?? tradePrice;
  } else {
    refPrice = dailyClose ?? tradePrice;
  }

  if (refPrice === null || previousClose === null || previousClose <= 0) {
    return unavailableState(ticker);
  }

  const changePct = ((refPrice - previousClose) / previousClose) * 100;
  const move: BreadthMove =
    changePct > CHANGE_EPSILON_PCT
      ? "advancer"
      : changePct < -CHANGE_EPSILON_PCT
        ? "decliner"
        : "unchanged";

  return {
    ticker,
    available: true,
    refPrice,
    previousClose,
    changePct,
    move,
    sessionDate: barSessionDate(raw.dailyBar?.t) ?? todayETKey(now),
  };
}

function unavailableState(ticker: string): BreadthSymbolState {
  return {
    ticker,
    available: false,
    refPrice: null,
    previousClose: null,
    changePct: null,
    move: "unavailable",
    sessionDate: null,
  };
}
