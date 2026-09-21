/**
 * ticker-summary-v1 — narrow ADDITIVE public summary for
 * GET /api/intelligence/ticker (V1.2C).
 *
 * Why this exists: the V1.2A public projection exposes fact TEXT plus metadata
 * only (`SafeTickerFact` has no numeric payload), so a UI could not render
 * financial metric cards without scraping numbers out of prose. This module
 * copies ALREADY-COMPUTED, deterministic ticker-context-v1 values into a typed
 * allowlisted DTO. Rules:
 *
 * - No new arithmetic: values are copied as-is (already rounded by the sealed
 *   metrics module). The browser never transforms them.
 * - Strict allowlist: every field is copied explicitly by key; nothing else
 *   from `TickerEvidenceFact.data` can ever reach the client (no provider ids,
 *   no news/filing URLs, no raw bodies, no tokens, no CIK, no bar timestamps).
 * - Missing evidence ⇒ `null` block/field, never zero and never a substitute.
 * - Units: USD for prices, percent for `changePct`/`returnVol20Pct`/percentages,
 *   shares for volumes, a plain multiple for `relativeVolume`, and a
 *   volatility-relative magnitude (never an anomaly-v1 score) for
 *   `latestMoveSigma`.
 * - `price.value` is the sealed regular-session reference price; an after-hours
 *   print is never presented as a regular-session closing price.
 * - The fingerprint input is untouched (this DTO is derived from the same
 *   evidence, so the ticker-context-v1 digest does not change).
 */
import type { JSONObject } from "@/lib/ai-brief/types";
import type { TickerResearchContext } from "./types";

export const TICKER_SUMMARY_VERSION = "ticker-summary-v1";

export interface SafeTickerPriceSummary {
  /** Regular-session reference price (USD). */
  value: number | null;
  /** Previous regular-session close (USD). */
  previousClose: number | null;
  /** Percent change of the reference price vs previous close. */
  changePct: number | null;
  direction: "advancer" | "decliner" | "unchanged" | "unavailable" | null;
  /** ET session date (YYYY-MM-DD) the price evidence belongs to. */
  sessionDate: string | null;
  feed: "delayed_sip";
  /** Delayed-SIP entitlement delay in minutes. */
  delayMinutes: number | null;
}

/** Latest trade (may include extended-hours prints) — never the reference price. */
export interface SafeTickerQuoteSummary {
  tradePrice: number | null;
  tradeTimestamp: string | null;
}

export interface SafeTickerVolumeSummary {
  /** Shares in the session the price evidence belongs to. */
  sessionVolume: number | null;
  /** Mean full-day volume of the last 20 completed sessions (shares). */
  avgVolume20: number | null;
  /** Completed-session multiple of avgVolume20, rounded to 2dp. */
  relativeVolume: number | null;
  /** In-session participation as % of avgVolume20 (not a comparable multiple). */
  partialSessionVolumePctOfAvg: number | null;
  sessionCompleted: boolean;
  sessionDate: string | null;
}

export interface SafeTickerVolatilitySummary {
  /** Sample σ (ddof=1) of ≤20 completed close-to-close returns, in percent. */
  returnVol20Pct: number | null;
  /** |changePct| / max(returnVol20Pct, floor) — a magnitude, not a score. */
  latestMoveSigma: number | null;
  historySessionCount: number | null;
  windowSessions: number | null;
}

export interface SafeTickerRangeSummary {
  prior20Low: number | null;
  prior20High: number | null;
  /** (price − low) / (high − low) × 100, as computed by ticker-metrics-v1. */
  rangePositionPct: number | null;
  windowSessions: number | null;
}

export interface SafeTickerSectorSummary {
  name: string;
  benchmarkTicker: string;
  /** Same-observation benchmark ETF percent change, when available. */
  benchmarkChangePct: number | null;
  classificationSource: string;
}

export interface SafeTickerNewsItem {
  headline: string;
  source: string | null;
  publishedAt: string | null;
  category: string | null;
  /** "context_only" marks a media mention that is not company-specific. */
  specificity: "company_specific" | "context_only";
}

export interface SafeTickerFilingItem {
  form: string;
  formLabel: string;
  filedAt: string | null;
}

export interface SafeTickerCorporateActionItem {
  type: string;
  date: string | null;
  description: string | null;
}

export interface SafeTickerEventsSummary {
  /** "none" ⇒ no company-specific candidate event in the window (no clear catalyst). */
  status: "none" | "candidates";
  newsCount: number;
  secCount: number;
  corporateActionCount: number;
  window: { startIso: string; cutoffIso: string | null } | null;
  news: SafeTickerNewsItem[];
  filings: SafeTickerFilingItem[];
  corporateActions: SafeTickerCorporateActionItem[];
}

export interface SafeTickerSummary {
  version: typeof TICKER_SUMMARY_VERSION;
  price: SafeTickerPriceSummary | null;
  quote: SafeTickerQuoteSummary | null;
  volume: SafeTickerVolumeSummary | null;
  volatility: SafeTickerVolatilitySummary | null;
  range: SafeTickerRangeSummary | null;
  sector: SafeTickerSectorSummary | null;
  events: SafeTickerEventsSummary | null;
}

/* ---------------- allowlisted projection helpers ---------------- */

function num(data: JSONObject, key: string): number | null {
  const value = data[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function str(data: JSONObject, key: string): string | null {
  const value = data[key];
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function bool(data: JSONObject, key: string): boolean | null {
  const value = data[key];
  return typeof value === "boolean" ? value : null;
}

function factData(context: TickerResearchContext, id: string): JSONObject | null {
  return context.facts.find((fact) => fact.id === id)?.data ?? null;
}

function directionOf(data: JSONObject): SafeTickerPriceSummary["direction"] {
  const value = str(data, "direction");
  if (
    value === "advancer" ||
    value === "decliner" ||
    value === "unchanged" ||
    value === "unavailable"
  ) {
    return value;
  }
  return null;
}

function eventWindow(data: JSONObject): SafeTickerEventsSummary["window"] {
  const window = data.window;
  if (typeof window !== "object" || window === null || Array.isArray(window)) return null;
  const record = window as JSONObject;
  const startIso = str(record, "startIso");
  if (!startIso) return null;
  return { startIso, cutoffIso: str(record, "cutoffIso") };
}

/**
 * Copies the already-computed ticker-context-v1 values for `symbol` into the
 * public summary shape. Deterministic and side-effect free: the same context
 * always yields the same summary, and a missing fact yields `null` (not zeros).
 */
export function projectTickerSummary(context: TickerResearchContext): SafeTickerSummary {
  const S = context.symbol.toUpperCase();
  const priceData = factData(context, `ticker.${S}.price`);
  const quoteData = factData(context, `ticker.${S}.quote`);
  const volumeData = factData(context, `ticker.${S}.volume`);
  const volatilityData = factData(context, `ticker.${S}.volatility`);
  const rangeData = factData(context, `ticker.${S}.range`);
  const sectorData = factData(context, `ticker.${S}.sector`);
  const catalystData = factData(context, `ticker.${S}.catalyst`);

  const price: SafeTickerPriceSummary | null = priceData
    ? {
        value: num(priceData, "price"),
        previousClose: num(priceData, "previousClose"),
        changePct: num(priceData, "changePct"),
        direction: directionOf(priceData),
        sessionDate: str(priceData, "sessionDate"),
        feed: "delayed_sip",
        delayMinutes: num(priceData, "delayMinutes"),
      }
    : null;

  const quote: SafeTickerQuoteSummary | null = quoteData
    ? {
        tradePrice: num(quoteData, "tradePrice"),
        tradeTimestamp: str(quoteData, "tradeTimestamp"),
      }
    : null;

  const volume: SafeTickerVolumeSummary | null = volumeData
    ? {
        sessionVolume: num(volumeData, "sessionVolume"),
        avgVolume20: num(volumeData, "avgVolume20"),
        relativeVolume: num(volumeData, "relativeVolume"),
        partialSessionVolumePctOfAvg: num(volumeData, "partialSessionVolumePctOfAvg"),
        // Absent flag ⇒ not completed: a partial session must never be shown as
        // a completed-session relative-volume multiple.
        sessionCompleted: bool(volumeData, "sessionCompleted") === true,
        sessionDate: str(volumeData, "sessionDate"),
      }
    : null;

  const volatility: SafeTickerVolatilitySummary | null = volatilityData
    ? {
        returnVol20Pct: num(volatilityData, "returnVol20Pct"),
        latestMoveSigma: num(volatilityData, "latestMoveSigma"),
        historySessionCount: num(volatilityData, "historySessionCount"),
        windowSessions: num(volatilityData, "windowSessions"),
      }
    : null;

  const range: SafeTickerRangeSummary | null = rangeData
    ? {
        prior20Low: num(rangeData, "prior20Low"),
        prior20High: num(rangeData, "prior20High"),
        rangePositionPct: num(rangeData, "rangePositionPct"),
        windowSessions: num(rangeData, "windowSessions"),
      }
    : null;

  const sectorName = sectorData ? str(sectorData, "sector") : null;
  const benchmarkTicker = sectorData ? str(sectorData, "benchmarkEtf") : null;
  const sector: SafeTickerSectorSummary | null =
    sectorData && sectorName && benchmarkTicker
      ? {
          name: sectorName,
          benchmarkTicker,
          benchmarkChangePct: num(sectorData, "benchmarkChangePct"),
          classificationSource: str(sectorData, "classificationSource") ?? "",
        }
      : null;

  const news: SafeTickerNewsItem[] = [];
  const filings: SafeTickerFilingItem[] = [];
  const corporateActions: SafeTickerCorporateActionItem[] = [];
  for (const fact of context.facts) {
    if (fact.id.startsWith(`ticker.${S}.news.`)) {
      const headline = str(fact.data, "headline");
      if (!headline) continue;
      news.push({
        headline,
        source: str(fact.data, "source"),
        publishedAt: str(fact.data, "publishedAt"),
        category: str(fact.data, "category"),
        // Unpromoted media mentions stay labeled as contextual, never as causes.
        specificity:
          str(fact.data, "specificity") === "context_only" ? "context_only" : "company_specific",
      });
      continue;
    }
    if (fact.id.startsWith(`ticker.${S}.sec.`)) {
      const form = str(fact.data, "form");
      if (!form) continue;
      filings.push({
        form,
        formLabel: str(fact.data, "formLabel") ?? form,
        filedAt: str(fact.data, "filingDate") ?? str(fact.data, "acceptanceDateTime"),
      });
      continue;
    }
    if (fact.id.startsWith(`ticker.${S}.corporateAction.`)) {
      corporateActions.push({
        type: str(fact.data, "type") ?? "",
        date: str(fact.data, "date"),
        description: str(fact.data, "description"),
      });
    }
  }

  // Provider news ids, filing URLs and bar timestamps are deliberately NOT
  // copied: only the fields named above can reach the client.
  const events: SafeTickerEventsSummary | null = catalystData
    ? {
        status: str(catalystData, "status") === "none" ? "none" : "candidates",
        newsCount: num(catalystData, "newsCount") ?? news.length,
        secCount: num(catalystData, "secCount") ?? filings.length,
        corporateActionCount: num(catalystData, "corporateActionCount") ?? corporateActions.length,
        window: eventWindow(catalystData),
        news,
        filings,
        corporateActions,
      }
    : null;

  return {
    version: TICKER_SUMMARY_VERSION,
    price,
    quote,
    volume,
    volatility,
    range,
    sector,
    events,
  };
}
