/**
 * ticker-context-v1 evidence builder (pure, deterministic).
 *
 * Facts are built ONLY from already-normalized provider outputs. Nothing here
 * fetches, reads env, or uses Date.now(). Missing inputs omit facts — they are
 * never replaced by zero or an unrelated benchmark. Company news/filings are
 * unpromoted contextual candidates: they are never labeled as a proven cause
 * of a price move, and "no clear company-specific catalyst identified" is a
 * valid, expected result.
 */
import { createHash } from "node:crypto";
import { canonicalizeJson } from "@/lib/ai-brief/fingerprint";
import { confidenceLabel } from "@/lib/ai-brief/confidence";
import type {
  EvidenceConfidence,
  EvidenceFreshness,
  JSONObject,
  JSONValue,
} from "@/lib/ai-brief/types";
import type { MarketClock } from "@/lib/breadth/provider";
import type { BreadthSymbolState } from "@/lib/breadth/normalize";
import type { TickerMetrics } from "./metrics";
import {
  TICKER_CONTEXT_VERSION,
  type TickerDataAvailability,
  type TickerEvidenceFact,
  type TickerIdentity,
  type TickerResearchConfidence,
  type TickerResearchStatus,
  type TickerSessionInfo,
  type TickerSourceMeta,
} from "./types";

export const VERSIONS = {
  identity: "alpaca-assets-v1",
  snapshot: "alpaca-delayed-sip-v1",
  history: "alpaca-sip-daily-v1",
  metrics: "ticker-metrics-v1",
  news: "alpaca-news-v1",
  sec: "sec-edgar-submissions-v1",
  actions: "alpaca-corporate-actions-v1",
  eventWindow: "ticker-event-window-v1",
} as const;

/** Confidence weights (documented; sum = 1). */
export const TICKER_CONFIDENCE_WEIGHTS = {
  price: 0.3,
  history: 0.2,
  volume: 0.1,
  sector: 0.1,
  news: 0.15,
  sec: 0.15,
} as const;

const FRESHNESS_FACTOR: Record<EvidenceFreshness, number> = {
  fresh: 1,
  delayed: 0.95,
  stale: 0.75,
  unavailable: 0,
};

export interface TickerNewsEvidence {
  id: string;
  headline: string;
  source: string;
  publishedAt: string;
  url: string;
  category: string;
  contextOnly: boolean;
}

export interface TickerSecEvidence {
  form: string;
  formLabel: string;
  filingDate: string | null;
  acceptanceDateTime: string | null;
  filingUrl: string;
}

export interface TickerActionEvidence {
  type: string;
  date: string | null;
  description: string;
}

export interface TickerEvidenceInput {
  symbol: string;
  identity: TickerIdentity;
  clock: MarketClock | null;
  price: BreadthSymbolState | null;
  /** Volume of the session the price belongs to (from the session daily bar). */
  sessionVolume: number | null;
  barTimestamp: string | null;
  tradeTimestamp: string | null;
  tradePrice: number | null;
  /** Sealed effective price instant (session close when closed) — never orchestration time. */
  effectiveAsOf: string | null;
  /** ET session date of the price evidence, resolved by the orchestrator. */
  marketSessionAsOf: string | null;
  metrics: TickerMetrics | null;
  sector: {
    sector: string;
    benchmarkEtf: string;
    benchmarkChangePct: number | null;
    classificationSource: string;
  } | null;
  news: TickerNewsEvidence[];
  newsOk: boolean;
  sec: TickerSecEvidence[];
  secOk: boolean;
  actions: TickerActionEvidence[];
  actionsOk: boolean;
  eventWindow: { startIso: string; cutoffIso: string | null } | null;
  stale: boolean;
  delayMinutes: number;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function pctPhrase(changePct: number): string {
  if (changePct > 0.05) return "up";
  if (changePct < -0.05) return "down";
  return "flat";
}

function fact(
  id: string,
  domain: TickerEvidenceFact["domain"],
  text: string,
  data: JSONObject,
  asOf: string | null,
  freshness: EvidenceFreshness,
  confidence: EvidenceConfidence | null,
  sourceVersion: string | null,
): TickerEvidenceFact {
  return { id, domain, text, data, asOf, freshness, confidence, sourceVersion };
}

export interface TickerEvidenceBuild {
  facts: TickerEvidenceFact[];
  availability: TickerDataAvailability;
  sources: {
    market: TickerSourceMeta;
    identity: TickerSourceMeta;
    sector: TickerSourceMeta;
    news: TickerSourceMeta;
    sec: TickerSourceMeta;
  };
  confidence: TickerResearchConfidence;
  status: TickerResearchStatus & ("ok" | "partial" | "insufficient_data");
  session: TickerSessionInfo;
  providerAsOf: string | null;
  marketSessionAsOf: string | null;
  effectiveAsOf: string | null;
  freshness: EvidenceFreshness;
  /** Deterministic ticker-context-v1 digest over the material evidence. */
  fingerprint: string;
}

export function buildTickerEvidence(input: TickerEvidenceInput): TickerEvidenceBuild {
  const S = input.symbol.toUpperCase();
  const facts: TickerEvidenceFact[] = [];
  const marketFreshness: EvidenceFreshness = input.price
    ? input.stale
      ? "stale"
      : "delayed"
    : "unavailable";
  const metrics = input.metrics;

  facts.push(
    fact(
      `ticker.${S}.identity`,
      "identity",
      `${S} — ${input.identity.name} (${input.identity.exchange ?? "exchange unavailable"}). Provider security directory: class ${input.identity.assetClass}, status ${input.identity.status}, tradable yes.`,
      {
        symbol: S,
        name: input.identity.name,
        exchange: input.identity.exchange,
        assetClass: input.identity.assetClass,
        status: input.identity.status,
        tradable: input.identity.tradable,
      },
      null,
      "fresh",
      "high",
      VERSIONS.identity,
    ),
  );

  let priceAvailable = false;
  if (
    input.price?.available &&
    input.price.refPrice !== null &&
    input.price.previousClose !== null
  ) {
    const price = round2(input.price.refPrice);
    const previousClose = round2(input.price.previousClose);
    const changePct = input.price.changePct === null ? null : round2(input.price.changePct);
    priceAvailable = true;
    facts.push(
      fact(
        `ticker.${S}.price`,
        "price",
        changePct === null
          ? `${S} regular-session reference price ${price} vs previous close ${previousClose} on session ${input.price.sessionDate ?? "unknown"} ET. Feed: delayed SIP ${input.delayMinutes} minutes behind.`
          : `${S} regular-session reference price ${price} vs previous close ${previousClose} — ${pctPhrase(changePct)} ${Math.abs(changePct).toFixed(2)}% on session ${input.price.sessionDate ?? "unknown"} ET. Feed: delayed SIP ${input.delayMinutes} minutes behind; after-hours prints are never used for this reference price.`,
        {
          symbol: S,
          price,
          previousClose,
          changePct,
          direction: input.price.move,
          sessionDate: input.price.sessionDate,
          feed: "delayed_sip",
          delayMinutes: input.delayMinutes,
          barTimestamp: input.barTimestamp,
          tradeTimestamp: input.tradeTimestamp,
        },
        input.barTimestamp ?? input.tradeTimestamp,
        marketFreshness,
        "high",
        VERSIONS.snapshot,
      ),
    );
  }

  if (input.clock?.isOpen === true && input.tradePrice !== null && input.tradeTimestamp !== null) {
    facts.push(
      fact(
        `ticker.${S}.quote`,
        "price",
        `${S} latest trade ${round2(input.tradePrice)} at ${input.tradeTimestamp} (delayed SIP; may include extended-hours prints). The regular-session reference price above remains the conservative price for this session.`,
        {
          symbol: S,
          tradePrice: round2(input.tradePrice),
          tradeTimestamp: input.tradeTimestamp,
          feed: "delayed_sip",
          mayIncludeExtendedHours: true,
        },
        input.tradeTimestamp,
        marketFreshness,
        "medium",
        VERSIONS.snapshot,
      ),
    );
  }

  let volumeAvailable = false;
  if (metrics && metrics.avgVolume20 !== null && input.price?.sessionDate) {
    const avg = Math.round(metrics.avgVolume20);
    const sessionVolume = input.sessionVolume;
    const sessionDate = input.price.sessionDate;
    if (metrics.relativeVolume !== null && sessionVolume !== null) {
      volumeAvailable = true;
      facts.push(
        fact(
          `ticker.${S}.volume`,
          "volume",
          `${S} completed-session volume ${Math.round(sessionVolume)} vs 20-session average full-day volume ${avg} — ${metrics.relativeVolume.toFixed(2)}× (session ${sessionDate} ET).`,
          {
            symbol: S,
            sessionVolume,
            avgVolume20: metrics.avgVolume20,
            relativeVolume: metrics.relativeVolume,
            sessionCompleted: true,
            feed: "delayed_sip",
            sessionDate,
          },
          input.barTimestamp,
          marketFreshness,
          "high",
          VERSIONS.metrics,
        ),
      );
    } else if (metrics.partialSessionVolumePctOfAvg !== null && sessionVolume !== null) {
      volumeAvailable = true;
      facts.push(
        fact(
          `ticker.${S}.volume`,
          "volume",
          `${S} partial in-session volume ${Math.round(sessionVolume)} vs 20-session average full-day volume ${avg} — ${metrics.partialSessionVolumePctOfAvg.toFixed(1)}% of average so far (not time-of-day adjusted, so this is not a comparable multiple).`,
          {
            symbol: S,
            sessionVolume,
            avgVolume20: metrics.avgVolume20,
            partialSessionVolumePctOfAvg: metrics.partialSessionVolumePctOfAvg,
            sessionCompleted: false,
            feed: "delayed_sip",
            sessionDate,
          },
          input.barTimestamp,
          marketFreshness,
          "medium",
          VERSIONS.metrics,
        ),
      );
    }
  }

  const volatilityAvailable = metrics !== null && metrics.returnVol20Pct !== null;
  if (metrics && metrics.returnVol20Pct !== null) {
    const sigma =
      metrics.latestMoveSigma === null
        ? ""
        : ` The latest move is ${metrics.latestMoveSigma.toFixed(2)}× that realized volatility.`;
    facts.push(
      fact(
        `ticker.${S}.volatility`,
        "volatility",
        `${S} 20-session realized daily-return volatility is ${metrics.returnVol20Pct.toFixed(2)}% (sample σ of split-adjusted close-to-close returns over completed sessions; ${metrics.historySessionCount} completed sessions available).${sigma} Statistical magnitude only — not an anomaly-v1 score.`,
        {
          symbol: S,
          returnVol20Pct: metrics.returnVol20Pct,
          latestMoveSigma: metrics.latestMoveSigma,
          historySessionCount: metrics.historySessionCount,
          windowSessions: 20,
          adjustment: "split",
          metricsVersion: VERSIONS.metrics,
        },
        input.barTimestamp,
        marketFreshness,
        null,
        VERSIONS.history,
      ),
    );
  }

  if (metrics && metrics.rangePositionPct !== null) {
    facts.push(
      fact(
        `ticker.${S}.range`,
        "volatility",
        `${S} is at ${metrics.rangePositionPct.toFixed(1)}% of its prior 20-session range (low ${round2(metrics.prior20Low ?? 0)} → high ${round2(metrics.prior20High ?? 0)}).`,
        {
          symbol: S,
          rangePositionPct: metrics.rangePositionPct,
          prior20High: metrics.prior20High,
          prior20Low: metrics.prior20Low,
          price: input.price?.refPrice ?? null,
          windowSessions: 20,
        },
        input.barTimestamp,
        marketFreshness,
        null,
        VERSIONS.history,
      ),
    );
  }

  let sectorAvailable = false;
  if (input.sector) {
    sectorAvailable = true;
    const benchmark = input.sector.benchmarkChangePct;
    const benchmarkText =
      benchmark === null
        ? `benchmark ${input.sector.benchmarkEtf} observation is unavailable, so no sector-relative comparison is made.`
        : `${input.sector.benchmarkEtf} is ${pctPhrase(benchmark)} ${Math.abs(round2(benchmark)).toFixed(2)}% in the same delayed-SIP observation.`;
    facts.push(
      fact(
        `ticker.${S}.sector`,
        "sector",
        `${S} is classified ${input.sector.sector} (${input.sector.classificationSource}); ${benchmarkText}`,
        {
          symbol: S,
          sector: input.sector.sector,
          benchmarkEtf: input.sector.benchmarkEtf,
          benchmarkChangePct: benchmark,
          classificationSource: input.sector.classificationSource,
          feed: "delayed_sip",
        },
        input.barTimestamp,
        marketFreshness,
        null,
        input.sector.classificationSource,
      ),
    );
  }

  const newsFacts = [...input.news]
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || a.id.localeCompare(b.id))
    .slice(0, 5);
  newsFacts.forEach((item, index) => {
    const label = item.contextOnly ? `${S} contextual media mention` : `${S} company-specific news`;
    facts.push(
      fact(
        `ticker.${S}.news.${index + 1}`,
        "news",
        `${label}: "${item.headline}" (${item.source || "source unavailable"}, published ${item.publishedAt}${item.category ? `, category ${item.category}` : ""}). Contextual evidence only — not a proven cause of the price move.`,
        {
          symbol: S,
          newsId: item.id,
          headline: item.headline,
          source: item.source,
          publishedAt: item.publishedAt,
          url: item.url,
          category: item.category,
          specificity: item.contextOnly ? "context_only" : "company_specific",
        },
        item.publishedAt,
        "delayed",
        null,
        VERSIONS.news,
      ),
    );
  });

  const secFacts = [...input.sec]
    .sort(
      (a, b) =>
        (b.filingDate ?? b.acceptanceDateTime ?? "").localeCompare(
          a.filingDate ?? a.acceptanceDateTime ?? "",
        ) || a.form.localeCompare(b.form),
    )
    .slice(0, 5);
  secFacts.forEach((item, index) => {
    facts.push(
      fact(
        `ticker.${S}.sec.${index + 1}`,
        "sec",
        `${S} SEC filing: form ${item.form} (${item.formLabel}) filed ${item.filingDate ?? item.acceptanceDateTime ?? "date unavailable"} — ${item.filingUrl}`,
        {
          symbol: S,
          form: item.form,
          formLabel: item.formLabel,
          filingDate: item.filingDate,
          acceptanceDateTime: item.acceptanceDateTime,
          filingUrl: item.filingUrl,
        },
        item.acceptanceDateTime ?? (item.filingDate ? `${item.filingDate}T00:00:00Z` : null),
        "delayed",
        null,
        VERSIONS.sec,
      ),
    );
  });

  const actionFacts = [...input.actions]
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "") || a.type.localeCompare(b.type))
    .slice(0, 3);
  actionFacts.forEach((item, index) => {
    facts.push(
      fact(
        `ticker.${S}.corporateAction.${index + 1}`,
        "sec",
        `${S} corporate action: ${item.type || "type unavailable"} on ${item.date ?? "date unavailable"}${item.description ? ` — ${item.description}` : ""}.`,
        { symbol: S, type: item.type, date: item.date, description: item.description },
        item.date ? `${item.date}T00:00:00Z` : null,
        "delayed",
        null,
        VERSIONS.actions,
      ),
    );
  });

  const windowText = input.eventWindow
    ? `${input.eventWindow.startIso} → ${input.eventWindow.cutoffIso ?? "latest available"}`
    : "unavailable";
  const eventCounts = {
    newsCount: newsFacts.length,
    secCount: secFacts.length,
    corporateActionCount: actionFacts.length,
  };
  const eventsAvailable = input.newsOk || input.secOk || input.actionsOk;
  facts.push(
    fact(
      `ticker.${S}.catalyst`,
      "catalyst",
      newsFacts.length + secFacts.length + actionFacts.length === 0
        ? `No clear company-specific catalyst identified for ${S} in the evidence window ${windowText}.`
        : `Unpromoted company-specific candidate events for ${S} in ${windowText}: ${eventCounts.newsCount} news, ${eventCounts.secCount} SEC filings, ${eventCounts.corporateActionCount} corporate actions. These are contextual candidates, not a proven cause of the price move.`,
      {
        symbol: S,
        status:
          newsFacts.length + secFacts.length + actionFacts.length === 0 ? "none" : "candidates",
        ...eventCounts,
        window: input.eventWindow,
      },
      input.eventWindow?.cutoffIso ?? null,
      eventsAvailable ? "delayed" : "unavailable",
      null,
      VERSIONS.eventWindow,
    ),
  );

  const historyAvailable = metrics !== null && metrics.historyEligible;
  const availability: TickerDataAvailability = {
    price: priceAvailable,
    history: historyAvailable,
    volume: volumeAvailable,
    volatility: volatilityAvailable,
    sector: sectorAvailable,
    news: input.newsOk,
    sec: input.secOk,
    corporateActions: input.actionsOk,
  };

  const newestTimestamp = (a: string | null, b: string | null): string | null =>
    a === null ? b : b === null ? a : a > b ? a : b;
  const providerAsOf = newestTimestamp(input.barTimestamp, input.tradeTimestamp);
  const marketSessionAsOf = input.marketSessionAsOf ?? input.price?.sessionDate ?? null;
  const effectiveAsOf = input.effectiveAsOf;
  const session: TickerSessionInfo = {
    marketOpen: input.clock?.isOpen ?? null,
    phase:
      input.clock?.isOpen === true
        ? "regular"
        : input.clock?.isOpen === false
          ? "closed"
          : "unknown",
    sessionDate: marketSessionAsOf,
  };

  const latestNewsAt = newsFacts.length > 0 ? newsFacts[0].publishedAt : null;
  const latestSecItem = secFacts[0] ?? null;
  const latestSecAt = latestSecItem
    ? (latestSecItem.acceptanceDateTime ??
      (latestSecItem.filingDate ? `${latestSecItem.filingDate}T00:00:00Z` : null))
    : null;
  const eventsOk = input.newsOk || input.secOk || input.actionsOk;
  const sources: TickerEvidenceBuild["sources"] = {
    market: {
      available: priceAvailable || historyAvailable,
      asOf: effectiveAsOf,
      freshness: marketFreshness,
      confidence: null,
      version: VERSIONS.snapshot,
    },
    identity: {
      available: true,
      asOf: null,
      freshness: "fresh",
      confidence: "high",
      version: VERSIONS.identity,
    },
    sector: {
      available: sectorAvailable,
      asOf: sectorAvailable ? input.barTimestamp : null,
      freshness: sectorAvailable ? marketFreshness : "unavailable",
      confidence: null,
      version: input.sector?.classificationSource ?? null,
    },
    news: {
      available: input.newsOk,
      asOf: latestNewsAt,
      freshness: input.newsOk ? "delayed" : "unavailable",
      confidence: null,
      version: VERSIONS.news,
    },
    sec: {
      available: input.secOk || input.actionsOk,
      asOf: latestSecAt,
      freshness: eventsOk ? "delayed" : "unavailable",
      confidence: null,
      version: VERSIONS.sec,
    },
  };

  const quality = (weight: number, available: boolean, freshness: EvidenceFreshness): number =>
    available ? weight * FRESHNESS_FACTOR[freshness] : 0;
  const score =
    quality(TICKER_CONFIDENCE_WEIGHTS.price, availability.price, marketFreshness) +
    quality(TICKER_CONFIDENCE_WEIGHTS.history, availability.history, marketFreshness) +
    quality(TICKER_CONFIDENCE_WEIGHTS.volume, availability.volume, marketFreshness) +
    quality(TICKER_CONFIDENCE_WEIGHTS.sector, availability.sector, marketFreshness) +
    quality(TICKER_CONFIDENCE_WEIGHTS.news, availability.news, sources.news.freshness) +
    quality(TICKER_CONFIDENCE_WEIGHTS.sec, sources.sec.available, sources.sec.freshness);
  const confidence: TickerResearchConfidence = {
    score: Math.round(score * 10_000) / 10_000,
    label: confidenceLabel(score),
  };

  const required: boolean[] = [
    availability.price,
    availability.history,
    availability.volume,
    availability.sector,
    availability.news,
    availability.sec,
  ];
  const status: TickerEvidenceBuild["status"] =
    !availability.price && !availability.history
      ? "insufficient_data"
      : required.every(Boolean)
        ? "ok"
        : "partial";

  const fingerprint = fingerprintTickerEvidence({
    symbol: S,
    identity: input.identity,
    status,
    providerAsOf,
    marketSessionAsOf,
    effectiveAsOf,
    session,
    sources,
    availability,
    facts,
    confidence,
  });

  return {
    facts,
    availability,
    sources,
    confidence,
    status,
    session,
    providerAsOf,
    marketSessionAsOf,
    effectiveAsOf,
    freshness: marketFreshness,
    fingerprint,
  };
}

export interface TickerFingerprintInput {
  symbol: string;
  identity: TickerIdentity;
  status: string;
  providerAsOf: string | null;
  marketSessionAsOf: string | null;
  effectiveAsOf: string | null;
  session: TickerSessionInfo;
  sources: TickerEvidenceBuild["sources"];
  availability: TickerDataAvailability;
  facts: TickerEvidenceFact[];
  confidence: TickerResearchConfidence;
}

/**
 * Deterministic ticker-context-v1 fingerprint: same canonical evidence ⇒ same
 * digest; material data changes ⇒ new digest. `requestedAt`/`generatedAt` are
 * excluded (orchestration time alone never invalidates evidence). Facts are
 * canonicalized by stable fact id before hashing; object keys are sorted.
 */
export function fingerprintTickerEvidence(input: TickerFingerprintInput): string {
  const facts = [...input.facts]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((item) => ({
      id: item.id,
      domain: item.domain,
      text: item.text,
      data: item.data,
      asOf: item.asOf,
      freshness: item.freshness,
      confidence: item.confidence,
      sourceVersion: item.sourceVersion,
    }));
  return createHash("sha256")
    .update(
      canonicalizeJson({
        version: TICKER_CONTEXT_VERSION,
        symbol: input.symbol,
        // All values below are plain JSON-safe data; the cast only satisfies
        // the index-signature shape of the canonicalizer input.
        identity: {
          symbol: input.identity.symbol,
          name: input.identity.name,
          exchange: input.identity.exchange,
          assetClass: input.identity.assetClass,
          status: input.identity.status,
          tradable: input.identity.tradable,
        },
        status: input.status,
        providerAsOf: input.providerAsOf,
        marketSessionAsOf: input.marketSessionAsOf,
        effectiveAsOf: input.effectiveAsOf,
        session: {
          marketOpen: input.session.marketOpen,
          phase: input.session.phase,
          sessionDate: input.session.sessionDate,
        },
        sources: input.sources as unknown as JSONValue,
        availability: input.availability as unknown as JSONValue,
        facts,
        confidence: { score: input.confidence.score, label: input.confidence.label },
      }),
    )
    .digest("hex");
}
