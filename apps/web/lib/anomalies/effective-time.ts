/**
 * Effective anomaly timestamp semantics.
 *
 * anomaly-v1 prices come from delayed-SIP regular-session data. The time that
 * matters for any downstream consumer (catalyst matching) is the PRICE-data
 * time, never orchestration/fetch time.
 *
 *   generatedAt  → when the overview was computed/requested
 *   effectiveAsOf → effective timestamp of the price data used by anomaly-v1
 *
 * Closed market: the prices being scored are the most recent completed regular
 * session, so effectiveAsOf is that session's close (4:00 PM ET). This holds
 * across weekends, market holidays, and long weekends because the session is
 * read from the actual scored daily bars (session date), not from wall clock.
 *
 * Open market: effectiveAsOf is derived from real provider timestamps in the
 * scored snapshots (latest trade/minute bar), and is clamped so it can never be
 * later than the price data actually used.
 */
import { barSessionDate, dateKeyInET, etSessionCloseIso } from "@/lib/breadth/dates";

/** Returns the most common ET session key among the scored daily-bar dates. */
export function dominantSessionDate(keys: Array<string | null | undefined>): string | null {
  const counts = new Map<string, number>();
  for (const key of keys) {
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestCount = 0;
  for (const [key, count] of counts) {
    if (count > bestCount) {
      best = key;
      bestCount = count;
    }
  }
  return best;
}

/** Prefer the latest-trade timestamp used by the scanner during an open session. */
export function snapshotPriceTimestamp(
  raw: { latestTrade?: { t?: string }; dailyBar?: { t?: string } } | undefined,
  marketOpen: boolean | null,
): string | null {
  if (!raw) return null;
  if (marketOpen === true) {
    if (raw.latestTrade?.t) return raw.latestTrade.t;
    if (raw.dailyBar?.t) return raw.dailyBar.t;
    return null;
  }
  // Closed/unknown: daily bar carries the completed regular-session close.
  return raw.dailyBar?.t ?? raw.latestTrade?.t ?? null;
}

export interface EffectiveTimeInput {
  isOpen: boolean | null;
  /** ET session keys derived from scored bars, one per candidate. */
  sessionKeys: Array<string | null | undefined>;
  /** Provider timestamps actually used by the scored snapshots. */
  providerTimestamps: Array<string | null | undefined>;
  /** Orchestration time — used only as fallback, never as price time. */
  generatedAtMs: number;
}

export interface EffectiveTime {
  generatedAt: string;
  effectiveAsOf: string | null;
  sessionDate: string | null;
}

function newestProviderTs(providerTimestamps: Array<string | null | undefined>, generatedAtMs: number): string | null {
  let newestMs = Number.NEGATIVE_INFINITY;
  let newest: string | null = null;
  for (const iso of providerTimestamps) {
    if (!iso) continue;
    const ms = Date.parse(iso);
    if (Number.isNaN(ms) || ms < 0) continue;
    // Never allow provider timestamps in the future relative to generation.
    if (ms > generatedAtMs + 5_000) continue;
    if (ms > newestMs) {
      newestMs = ms;
      newest = iso;
    }
  }
  return newest;
}

/** Last-resort fallback price time: delayed-SIP semantics (~15 min behind clock). */
function delayedFallback(generatedAtMs: number): string {
  return new Date(generatedAtMs - 15 * 60_000).toISOString();
}

export function resolveEffectiveTime(input: EffectiveTimeInput): EffectiveTime {
  const { isOpen, sessionKeys, providerTimestamps, generatedAtMs } = input;
  const generatedAt = new Date(generatedAtMs).toISOString();
  const sessionDate = dominantSessionDate(sessionKeys);
  const providerTs = newestProviderTs(providerTimestamps, generatedAtMs);
  const sessionClose = sessionDate ? etSessionCloseIso(sessionDate) : null;
  const sessionCloseMs = sessionClose ? Date.parse(sessionClose) : Number.NaN;
  // A session-close fallback is only usable when it is not in the future.
  const usableSessionClose = sessionClose && !Number.isNaN(sessionCloseMs) && sessionCloseMs <= generatedAtMs + 5_000 ? sessionClose : null;

  if (isOpen === true) {
    // Open session: prefer real provider timestamps from the scored data.
    const effective = providerTs ?? usableSessionClose ?? delayedFallback(generatedAtMs);
    return { generatedAt, effectiveAsOf: effective, sessionDate };
  }

  // Closed or unknown: the scored prices are the most recent completed regular
  // session — effective time is that session's 4:00 PM ET close, never the
  // wall-clock request time (Saturday/Sunday/holiday-safe).
  const effective = sessionClose ?? providerTs ?? delayedFallback(generatedAtMs);
  return { generatedAt, effectiveAsOf: effective, sessionDate };
}

/** ET date key helpers reused by callers. */
export { barSessionDate, dateKeyInET };
