/** Shared date helpers for the breadth engine (US/Eastern session dates). */

/** Tolerant ISO parse (accepts >3 fractional-second digits). */
function parseMs(iso: string): number | null {
  const direct = Date.parse(iso);
  if (!Number.isNaN(direct)) return direct;
  const normalized = iso.replace(/(\.\d{3})\d+(Z|[+-]\d{2}:\d{2})$/, "$1$2");
  if (normalized !== iso) {
    const retry = Date.parse(normalized);
    if (!Number.isNaN(retry)) return retry;
  }
  return null;
}

/** YYYY-MM-DD key for `ms` in the US/Eastern timezone. */
export function dateKeyInET(ms: number): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(ms));
  const byType = new Map(parts.map((part) => [part.type, part.value]));
  const year = byType.get("year");
  const month = byType.get("month");
  const day = byType.get("day");
  return year && month && day ? `${year}-${month}-${day}` : "";
}

/** Current ET session key at `nowMs`. */
export function todayETKey(nowMs: number): string {
  return dateKeyInET(nowMs);
}

/** Session date key of a daily bar timestamp (exchange close timestamp). */
export function barSessionDate(timestamp: string | undefined): string | null {
  if (!timestamp) return null;
  const ms = parseMs(timestamp);
  if (ms === null) return null;
  return dateKeyInET(ms);
}

/** Lexical comparison of two YYYY-MM-DD keys (valid ISO date keys sort lexically). */
export function dateKeyLt(a: string | null, b: string | null): boolean {
  if (!a || !b) return false;
  return a < b;
}

/**
 * ISO instant of the US regular-session close (4:00 PM ET = 20:00 UTC) for an
 * ET session date key. All breadth/anomaly/catalyst regular-session boundaries
 * use this single definition so no module mixes generated time with price time.
 */
export function etSessionCloseIso(dateKey: string): string {
  return `${dateKey}T20:00:00.000Z`;
}

/** Walk back from an ET date key to the previous US weekday (Mon-Fri). */
export function previousETWeekday(dateKey: string): string {
  const dayIndex = new Date(`${dateKey}T12:00:00Z`).getUTCDay();
  let offset = 1;
  if (dayIndex === 1) offset = 3; // Monday → Friday
  if (dayIndex === 0) offset = 2; // Sunday → Friday
  const ms = Date.parse(`${dateKey}T12:00:00Z`) - offset * 86_400_000;
  return new Date(ms).toISOString().slice(0, 10);
}
