/**
 * Phase 7A.2 — deterministic EvidenceFact builder.
 *
 * Read-only downstream adaptation of already-normalized Phase 0–6 domain
 * outputs. Pure function: no fetch, no Date.now(), no env, no orchestration.
 * Ordering is fixed by domain then canonical ticker order; facts are bounded
 * (hard max 50) and duplicate IDs throw instead of silently overwriting.
 */
import type {
  EvidenceBuilderInput,
  EvidenceDomain,
  EvidenceFact,
  EvidenceFreshness,
  JSONObject,
} from "./types";

const MARKET_ORDER = ["SPY", "QQQ", "IWM", "DIA"];
const SECTOR_ORDER = ["XLK", "XLF", "XLE", "XLV", "XLI", "XLP", "XLY", "XLU", "XLB", "XLRE", "XLC"];
const MACRO_ORDER = ["vix", "us10y", "usdBroad", "wti", "gold", "btc"];
const HARD_MAX_FACTS = 50;
const MAX_ANOMALIES = 8;

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** "rose 1.1%" / "fell 0.4%" / "was unchanged" — no market interpretation. */
function pctPhrase(changePct: number | null): string {
  if (changePct === null || !Number.isFinite(changePct)) return "";
  if (changePct > 0.05) return `rose ${Math.abs(round1(changePct)).toFixed(1)}%`;
  if (changePct < -0.05) return `fell ${Math.abs(round1(changePct)).toFixed(1)}%`;
  return "was unchanged";
}

function makeFact(
  id: string,
  domain: EvidenceDomain,
  text: string,
  data: JSONObject,
  asOf: string | null,
  freshness: EvidenceFreshness,
  confidence: EvidenceFact["confidence"],
  sourceVersion: string | null,
): EvidenceFact {
  return { id, domain, text, data, asOf, freshness, confidence, sourceVersion };
}

function uniqueKeepFirst<I>(items: I[], key: (item: I) => string): I[] {
  const out: I[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const k = key(item);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(item);
  }
  return out;
}

export function buildEvidenceFacts(input: EvidenceBuilderInput): EvidenceFact[] {
  const facts: EvidenceFact[] = [];

  /* 1 · Market (fixed SPY/QQQ/IWM/DIA order). */
  if (input.market?.indices.length) {
    const indices = uniqueKeepFirst(input.market.indices, (index) => index.ticker.toUpperCase());
    for (const ticker of MARKET_ORDER) {
      const index = indices.find((item) => item.ticker.toUpperCase() === ticker);
      if (!index) continue;
      facts.push(
        makeFact(
          `market.${ticker.toLowerCase()}`,
          "market",
          `${ticker} ${pctPhrase(index.changePct)} in the latest market observation.`,
          { ticker, name: ticker, changePct: round1(index.changePct) },
          input.market.asOf,
          input.market.freshness,
          null,
          "market",
        ),
      );
    }

    /* 2 · Sector facts ride on the market domain's normalized sector source. */
    if (input.market.sectors?.length) {
      const sectors = uniqueKeepFirst(input.market.sectors, (item) => item.ticker.toUpperCase());
      for (const ticker of SECTOR_ORDER) {
        const sector = sectors.find((item) => item.ticker.toUpperCase() === ticker);
        if (!sector) continue;
        facts.push(
          makeFact(
            `sector.${ticker.toLowerCase()}`,
            "sector",
            `${ticker} ${pctPhrase(sector.changePct)}.`,
            { ticker, changePct: round1(sector.changePct) },
            input.market.asOf,
            input.market.freshness,
            null,
            null,
          ),
        );
      }
    }
  }

  /* 3 · Macro (canonical six ids; cadence + freshness preserved). */
  if (input.macro?.signals.length) {
    const signals = uniqueKeepFirst(input.macro.signals, (signal) => signal.id.toLowerCase());
    for (const id of MACRO_ORDER) {
      const signal = signals.find((item) => item.id.toLowerCase() === id.toLowerCase());
      if (!signal) continue;
      if (signal.value === null && signal.changePct === null) continue;
      const label = signal.label ?? id.toUpperCase();
      const noun = signal.cadence.toLowerCase().includes("daily")
        ? "in the latest available daily observation"
        : "in the latest available observation";
      let text: string;
      if (signal.value !== null && Number.isFinite(signal.value)) {
        text = `${label} was ${round1(signal.value).toFixed(1)} ${noun}.`;
      } else {
        text = `${label} ${pctPhrase(signal.changePct)} ${noun}.`;
      }
      facts.push(
        makeFact(
          `macro.${id}`,
          "macro",
          text,
          { id, value: signal.value ?? null, changePct: signal.changePct ?? null, cadence: signal.cadence },
          signal.asOf ?? input.macro.asOf,
          signal.freshness ?? input.macro.freshness,
          null,
          null,
        ),
      );
    }
  }

  /* 4 · Regime overall + up to 3 positive / 3 negative ranked drivers. */
  if (input.regime && input.regime.score !== null) {
    const regime = input.regime;
    const display = regime.displayScore ?? (regime.score === null ? 0 : Math.round(regime.score));
    facts.push(
      makeFact(
        "regime.overall",
        "regime",
        `Market regime is ${regime.label ?? "UNKNOWN"} at ${display}/100.`,
        {
          score: regime.score,
          displayScore: display,
          label: regime.label,
          coverage: regime.coverage,
          confidence: regime.confidence,
          engineVersion: "regime-v1",
        },
        regime.asOf,
        regime.freshness,
        regime.confidence,
        "regime-v1",
      ),
    );
    const pushDrivers = (texts: string[], direction: "positive" | "negative") => {
      texts.slice(0, 3).forEach((driverText, i) => {
        const rank = i + 1;
        facts.push(
          makeFact(
            `regime.driver.${direction}.${rank}`,
            "regime",
            driverText,
            { rank, direction, driver: driverText },
            regime.asOf,
            regime.freshness,
            regime.confidence,
            "regime-v1",
          ),
        );
      });
    };
    pushDrivers(regime.positiveDrivers, "positive");
    pushDrivers(regime.negativeDrivers, "negative");
  }

  /* 5 · Breadth — five canonical ids, delayed-SIP semantics preserved. */
  if (input.breadth?.score !== undefined && input.breadth.score !== null) {
    const b = input.breadth;
    const score = b.score ?? 0;
    facts.push(
      makeFact(
        "breadth.summary",
        "breadth",
        `S&P 500 breadth score is ${Math.round(score)}/100${b.participation ? ` with ${b.participation} participation.` : "."}`,
        { score, participation: b.participation, coverage: b.coverage, confidence: b.confidence, engineVersion: "breadth-v1" },
        b.asOf,
        b.freshness,
        b.confidence,
        "breadth-v1",
      ),
    );
    if (b.advanceRatioPct !== null) {
      facts.push(makeFact("breadth.advanceRatio", "breadth", `${round1(b.advanceRatioPct).toFixed(1)}% of eligible S&P 500 members advanced.`, { advanceRatioPct: b.advanceRatioPct }, b.asOf, b.freshness, b.confidence, "breadth-v1"));
    }
    if (b.pctAbove20 !== null) {
      facts.push(makeFact("breadth.above20", "breadth", `${round1(b.pctAbove20).toFixed(1)}% of constituents were above their 20-day moving average.`, { pctAbove20: b.pctAbove20 }, b.asOf, b.freshness, b.confidence, "breadth-v1"));
    }
    if (b.pctAbove50 !== null) {
      facts.push(makeFact("breadth.above50", "breadth", `${round1(b.pctAbove50).toFixed(1)}% of constituents were above their 50-day moving average.`, { pctAbove50: b.pctAbove50 }, b.asOf, b.freshness, b.confidence, "breadth-v1"));
    }
    if (b.newHighs20 !== null && b.newLows20 !== null) {
      facts.push(makeFact("breadth.highLow", "breadth", `There were ${b.newHighs20} new 20-day highs and ${b.newLows20} new 20-day lows.`, { newHighs20: b.newHighs20, newLows20: b.newLows20 }, b.asOf, b.freshness, b.confidence, "breadth-v1"));
    }
  }


  /* 6 · Anomalies — top 8 only, original anomaly-v1 ranking preserved. */
  const anomalyItems = (input.anomalies?.items ?? []).slice(0, MAX_ANOMALIES);
  const anomalyAsof = input.anomalies?.asOf ?? null;
  const anomalyFreshness = input.anomalies?.freshness ?? "unavailable";
  const anomalyConfidence = input.anomalies?.confidence ?? null;
  for (const item of anomalyItems) {
    const direction = pctPhrase(item.movePct);
    const sigma =
      item.returnSigma !== null && item.returnSigma !== undefined && Number.isFinite(item.returnSigma)
        ? `a ${Math.abs(round1(item.returnSigma)).toFixed(1)}× 20D-volatility return shock, `
        : "";
    facts.push(
      makeFact(
        `anomaly.${item.ticker.toUpperCase()}`,
        "anomaly",
        `${item.ticker.toUpperCase()} ${direction}, ${sigma}with anomaly score ${item.displayScore ?? Math.round(item.anomalyScore)}.`,
        {
          ticker: item.ticker.toUpperCase(),
          name: item.name,
          movePct: item.movePct,
          anomalyScore: item.anomalyScore,
          displayScore: item.displayScore ?? Math.round(item.anomalyScore),
          severity: item.severity,
          returnSigma: item.returnSigma,
          sectorRelativePct: item.sectorRelativePct,
          primaryTrigger: item.primaryTrigger,
          breakout20: item.breakout20,
          breakdown20: item.breakdown20,
          effectiveAsOf: input.anomalies?.effectiveAsOf ?? null,
        },
        item.priceAsOf ?? anomalyAsof,
        anomalyFreshness,
        anomalyConfidence,
        "anomaly-v1",
      ),
    );
  }

  /* 7 · Catalysts — only for anomaly tickers included in the Evidence Pack. */
  const catalystItems = uniqueKeepFirst(input.catalysts?.items ?? [], (item) => item.ticker.toUpperCase());
  for (const anomaly of anomalyItems) {
    const item = catalystItems.find((c) => c.ticker.toUpperCase() === anomaly.ticker.toUpperCase());
    if (!item) continue;
    const ticker = anomaly.ticker.toUpperCase();
    const matched = item.status === "MATCHED" && item.primaryCatalyst;
    if (!matched) {
      facts.push(
        makeFact(
          `catalyst.${ticker}.none`,
          "catalyst",
          `No sufficiently strong company-specific catalyst was identified for ${ticker}.`,
          { ticker, status: item.status, catalystCutoff: item.catalystCutoff },
          item.catalystCutoff ?? input.catalysts?.cutoff ?? null,
          input.catalysts?.freshness ?? "delayed",
          null,
          "catalyst-match-v1",
        ),
      );
      continue;
    }
    const primary = item.primaryCatalyst!;
    const strength = primary.evidenceStrength?.toLowerCase() ?? "";
    const suffix =
      strength === "strong" ? ", with strong evidence" : strength === "moderate" ? ", with moderate evidence" : strength === "weak" ? ", with weak evidence" : "";
    facts.push(
      makeFact(
        `catalyst.${ticker}.primary`,
        "catalyst",
        `${ticker}'s strongest matched catalyst is ${primary.category}${suffix}.`,
        {
          ticker,
          category: primary.category,
          headline: primary.headline,
          relevanceScore: primary.relevanceScore,
          evidenceStrength: primary.evidenceStrength,
          eventPolarity: primary.eventPolarity,
          alignment: primary.alignment,
          publishedAt: primary.publishedAt,
          catalystCutoff: item.catalystCutoff ?? input.catalysts?.cutoff ?? null,
          source: primary.source,
        },
        primary.publishedAt ?? item.catalystCutoff ?? input.catalysts?.cutoff ?? null,
        input.catalysts?.freshness ?? "delayed",
        null,
        "catalyst-match-v1",
      ),
    );
  }

  /* Guards: unique ids + bounded size. */
  const ids = new Set<string>();
  for (const fact of facts) {
    if (ids.has(fact.id)) {
      throw new Error(`Duplicate evidence fact id: ${fact.id}`);
    }
    ids.add(fact.id);
  }
  if (facts.length > HARD_MAX_FACTS) {
    throw new Error(`Evidence pack exceeds hard maximum of ${HARD_MAX_FACTS} facts (got ${facts.length})`);
  }
  return facts;
}

