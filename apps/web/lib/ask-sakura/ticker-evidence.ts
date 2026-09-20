/**
 * Ask-only ticker evidence composition (V1.2B).
 *
 * Pure and deterministic. The ticker-context-v1 facts are preserved EXACTLY
 * (ids, text, timestamps, freshness, sourceVersion, internal data) and are
 * never rewritten into anomaly-v1 evidence. A compact, fixed-priority global
 * backdrop is appended so the model can place the ticker in market context.
 *
 * Budget: ticker facts are never dropped (they are the subject of the
 * question); the backdrop is bounded and omitted entirely if the ticker facts
 * already fill the pack.
 */
import type { BriefContext, EvidenceFact } from "@/lib/ai-brief/types";
import type { TickerEvidenceFact, TickerResearchContext } from "@/lib/ticker-context/types";
import type { AskEvidenceComposition, AskEvidenceFact } from "./evidence-fact";
import { toSafeEvidenceFacts, type AskEvidenceSelection } from "./select-evidence";

export const TICKER_ASK_PACK_LIMITS = {
  /** Ticker facts + global backdrop. */
  totalMax: 28,
  backdropMax: 8,
} as const;

const MARKET_ORDER = ["market.spy", "market.qqq", "market.iwm", "market.dia"];

/** Structural mapping — ticker-context-v1 facts keep every field verbatim. */
export function toAskTickerFacts(facts: TickerEvidenceFact[]): AskEvidenceFact[] {
  return facts.map((fact) => ({
    id: fact.id,
    domain: fact.domain,
    text: fact.text,
    data: fact.data as AskEvidenceFact["data"],
    asOf: fact.asOf,
    freshness: fact.freshness,
    confidence: fact.confidence,
    sourceVersion: fact.sourceVersion,
  }));
}

function sectorEtfOf(tickerContext: TickerResearchContext): string | null {
  const fact = tickerContext.facts.find((item) => item.id.endsWith(".sector"));
  const etf = fact?.data.benchmarkEtf;
  return typeof etf === "string" && etf.length > 0 ? etf.toUpperCase() : null;
}

/**
 * Deterministic compact global backdrop: market indices → the symbol's sector
 * ETF → the symbol's own validated anomaly/catalyst facts (never another
 * ticker's) → macro (≤3) → regime (≤2) → breadth (≤2), source order preserved.
 */
function backdropCandidates(
  context: BriefContext,
  symbol: string,
  sectorEtf: string | null,
): AskEvidenceFact[] {
  const byId = new Map(context.evidence.map((fact) => [fact.id, fact]));
  const picked: AskEvidenceFact[] = [];
  const add = (fact: EvidenceFact | undefined) => {
    if (!fact) return;
    if (picked.some((item) => item.id === fact.id)) return;
    picked.push(fact as AskEvidenceFact);
  };

  for (const id of MARKET_ORDER) add(byId.get(id));
  if (sectorEtf) add(byId.get(`sector.${sectorEtf.toLowerCase()}`));
  add(byId.get(`anomaly.${symbol}`));
  add(byId.get(`catalyst.${symbol}.primary`));
  add(byId.get(`catalyst.${symbol}.none`));

  let macro = 0;
  let regime = 0;
  let breadth = 0;
  for (const fact of context.evidence) {
    if (fact.id.startsWith("macro.") && macro < 3) {
      macro += 1;
      add(fact);
    } else if (fact.id.startsWith("regime.") && regime < 2) {
      regime += 1;
      add(fact);
    } else if (fact.id.startsWith("breadth.") && breadth < 2) {
      breadth += 1;
      add(fact);
    }
  }
  return picked;
}

export interface ComposedTickerEvidence {
  selection: AskEvidenceSelection;
  composition: AskEvidenceComposition;
}

export function composeTickerAskEvidence(input: {
  globalContext: BriefContext;
  ticker: TickerResearchContext;
}): ComposedTickerEvidence {
  const symbol = input.ticker.symbol.toUpperCase();
  const tickerFacts = toAskTickerFacts(input.ticker.facts);
  const candidates = backdropCandidates(input.globalContext, symbol, sectorEtfOf(input.ticker));
  const room = Math.max(0, TICKER_ASK_PACK_LIMITS.totalMax - tickerFacts.length);
  const backdrop = candidates.slice(0, Math.min(TICKER_ASK_PACK_LIMITS.backdropMax, room));
  const facts = [...tickerFacts, ...backdrop];

  return {
    selection: {
      facts,
      safeFacts: toSafeEvidenceFacts(facts),
      selectedFactIds: facts.map((fact) => fact.id),
      detectedTickers: [symbol],
      selectionMode: "ticker_scoped",
    },
    composition: {
      tickerFactCount: tickerFacts.length,
      backdropFactCount: backdrop.length,
      backdropOmitted: backdrop.length === 0 && candidates.length > 0,
    },
  };
}
