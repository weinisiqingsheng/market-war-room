import type { MacroSignalId } from "@war-room/types";
import { unavailableMacroSnapshot, type NormalizedMacroSnapshot } from "./types";

/* ── Field guards ────────────────────────────────────────────────────────
   Upstream provider fields are untrusted strings/numbers — guard every read. */

/** Parses provider values that may be "." (FRED missing), "" or non-numeric. */
export function parseNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed === "" || trimmed === ".") return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Robust ISO-8601 timestamp parse (milliseconds).
 *
 * Some runtimes reject fractional seconds with more than 3 digits. Alpaca
 * crypto timestamps carry nanosecond precision (e.g.
 * "2026-09-01T05:50:55.850037494Z") — a failed parse must never silently turn
 * fresh data into stale data, so we normalize sub-millisecond digits and retry.
 */
export function parseIsoMs(iso: string | null | undefined): number | null {
  if (typeof iso !== "string" || iso === "") return null;
  const direct = Date.parse(iso);
  if (!Number.isNaN(direct)) return direct;

  const normalized = iso.replace(/(\.\d{3})\d+(Z|[+-]\d{2}:\d{2})$/, "$1$2");
  if (normalized !== iso) {
    const retry = Date.parse(normalized);
    if (!Number.isNaN(retry)) return retry;
  }
  return null;
}

/* ── FRED ───────────────────────────────────────────────────────────────── */

export interface FredObservation {
  date?: string;
  value?: string;
}

export interface FredResponse {
  observations?: FredObservation[];
}

/**
 * Normalizes a FRED observations payload (newest-first).
 * - skips "." and invalid observations
 * - latest = first valid observation, previous = next valid observation
 * - VIX/DGS10 values are already numeric in their own unit (index / percent)
 * - change = latest − previous; changePct = change / previous * 100
 */
export function normalizeFredSeries(
  id: MacroSignalId,
  payload: FredResponse | null | undefined,
): NormalizedMacroSnapshot {
  const observations = Array.isArray(payload?.observations) ? payload.observations : [];
  const valid = observations
    .map((observation) => ({
      date: typeof observation?.date === "string" ? observation.date : null,
      value: parseNumber(observation?.value),
    }))
    .filter(
      (entry): entry is { date: string; value: number } =>
        entry.date !== null && entry.value !== null,
    );

  const latest = valid[0];
  const previous = valid[1];
  if (!latest) return unavailableMacroSnapshot(id, "daily");

  const change = previous ? latest.value - previous.value : null;
  const changePct =
    previous && previous.value !== 0 && change !== null ? (change / previous.value) * 100 : null;

  return {
    id,
    value: latest.value,
    change,
    changePct,
    frequency: "daily",
    asOf: `${latest.date}T00:00:00Z`,
    available: true,
  };
}

/* ── Twelve Data (Gold — XAU/USD via /price + /time_series) ─────────────── */

/** Twelve Data `GET /price` payload — current spot price only. */
export interface TwelvePrice {
  price?: string | number;
  [key: string]: unknown;
}

/** One row of Twelve Data `GET /time_series` (returned newest-first). */
export interface TwelveSeriesValue {
  datetime?: string;
  close?: string | number;
  [key: string]: unknown;
}

export interface TwelveTimeSeries {
  meta?: {
    symbol?: string;
    interval?: string;
    /** Provider-reported timezone for daily bar boundaries. */
    exchange_timezone?: string;
    [key: string]: unknown;
  };
  values?: TwelveSeriesValue[];
  [key: string]: unknown;
}

/** YYYY-MM-DD key for `ms` in `timeZone`; null when the zone is unusable. */
function dateKeyInZone(ms: number, timeZone: string): string | null {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date(ms));
    const byType = new Map(parts.map((part) => [part.type, part.value]));
    const year = byType.get("year");
    const month = byType.get("month");
    const day = byType.get("day");
    return year && month && day ? `${year}-${month}-${day}` : null;
  } catch {
    return null; // invalid/unknown IANA timezone
  }
}

/**
 * Safely decides whether a daily bar dated `datetime` is completed at `nowMs`.
 * - With a valid `exchange_timezone` from the provider metadata, the bar is
 *   completed when its date is before the exchange's current calendar date
 *   (a bar dated today is still forming and must never be the comparison).
 * - Without a trustworthy timezone, completion cannot be established
 *   precisely, so only bars at least a full UTC day old are trusted — the
 *   forming bar can never be misread as completed, at the cost of a null
 *   change when the metadata is absent.
 */
function isCompletedDailyBar(
  datetime: string | undefined,
  nowMs: number,
  timeZone: string | undefined,
): boolean {
  if (typeof datetime !== "string") return false;
  const barDate = datetime.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(barDate)) return false;

  const zone = typeof timeZone === "string" && timeZone.trim() !== "" ? timeZone.trim() : null;
  if (zone !== null) {
    const localToday = dateKeyInZone(nowMs, zone);
    if (localToday !== null) return barDate < localToday;
  }

  // Absent or unusable timezone metadata → completion cannot be established
  // safely, so only bars strictly older than the UTC day that ended ~24h ago
  // are trusted. The forming bar can never be misread as completed, at the
  // cost of a null change when the metadata is missing.
  const safeCutoff = dateKeyInZone(nowMs - 86_400_000, "UTC");
  return safeCutoff !== null && barDate < safeCutoff;
}

/** Most recent COMPLETED daily close from /time_series, or null if none safe. */
export function completedDailyClose(
  history: TwelveTimeSeries | null | undefined,
  nowMs: number,
): number | null {
  const values = Array.isArray(history?.values) ? history.values : [];
  const timeZone = history?.meta?.exchange_timezone;
  for (const value of values) {
    if (!isCompletedDailyBar(value?.datetime, nowMs, timeZone)) continue;
    const close = parseNumber(value?.close);
    if (close !== null) return close;
  }
  return null;
}

/**
 * Normalizes Twelve Data Gold into a signal:
 * - value = latest `GET /price` result (intraday/realtime-style freshness)
 * - change = current price − last COMPLETED daily close from `/time_series`
 * - when the previous completed close cannot be established safely, change and
 *   changePct stay null rather than fabricating a daily comparison.
 */
export function normalizeTwelveGold(
  id: MacroSignalId,
  price: TwelvePrice | null | undefined,
  history: TwelveTimeSeries | null | undefined,
  nowMs: number,
): NormalizedMacroSnapshot {
  const current = parseNumber(price?.price);
  if (current === null) return unavailableMacroSnapshot(id, "intraday");

  const previous = completedDailyClose(history, nowMs);
  const change = previous !== null ? current - previous : null;
  const changePct =
    previous !== null && previous !== 0 && change !== null ? (change / previous) * 100 : null;

  return {
    id,
    value: current,
    change,
    changePct,
    frequency: "intraday",
    asOf: new Date(nowMs).toISOString(),
    available: true,
  };
}

/* ── Alpaca crypto (BTC/USD) ────────────────────────────────────────────── */

export interface CryptoTrade {
  p?: number;
  t?: string;
  s?: number;
}

export interface CryptoBar {
  t?: string;
  o?: number;
  h?: number;
  l?: number;
  c?: number;
  v?: number;
}

/**
 * Normalizes Alpaca crypto latest-trade + daily bars into a BTC signal.
 * - value = latest trade price (BTC trades 24/7)
 * - previous = close of the last COMPLETED daily bar (started before today UTC)
 * - 24/7 freshness is handled by the frequency-based stale rule, never by the
 *   US equity market-open state.
 */
export function normalizeBtc(
  id: MacroSignalId,
  trade: CryptoTrade | null | undefined,
  bars: CryptoBar[] | null | undefined,
): NormalizedMacroSnapshot {
  if (!trade || typeof trade.p !== "number" || !Number.isFinite(trade.p)) {
    return unavailableMacroSnapshot(id, "realtime");
  }
  const price = trade.p;

  const now = new Date();
  const todayStartUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

  // Only bars that STARTED before today's UTC midnight are completed; the bar
  // that started today is still forming and must never be used as previous
  // close. Timestamps are parsed with a fractional-precision-tolerant helper
  // (Alpaca crypto timestamps can carry nanosecond precision).
  const completedBars = (Array.isArray(bars) ? bars : []).filter((bar) => {
    const start = parseIsoMs(bar?.t);
    return start !== null && start < todayStartUtc;
  });

  const lastCompleted = completedBars
    .slice()
    .sort((a, b) => (parseIsoMs(a.t) ?? 0) - (parseIsoMs(b.t) ?? 0))
    .at(-1);

  const previous = lastCompleted && typeof lastCompleted.c === "number" ? lastCompleted.c : null;
  const change = previous !== null ? price - previous : null;
  const changePct =
    previous !== null && previous !== 0 && change !== null ? (change / previous) * 100 : null;

  return {
    id,
    value: price,
    change,
    changePct,
    frequency: "realtime",
    asOf: typeof trade.t === "string" ? trade.t : null,
    available: true,
  };
}
