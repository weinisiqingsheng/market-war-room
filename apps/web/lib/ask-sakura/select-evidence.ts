import type { ModelEvidenceFact } from "@/lib/ai-brief/serialize-context";
import type { BriefContext } from "@/lib/ai-brief/types";
import type { AskEvidenceComposition, AskEvidenceFact } from "./evidence-fact";
import { globalSymbolsOf } from "./question-routing";

/** ask-sakura-v1 deterministic evidence selection (V1.1C). Pure: no LLM. */

export type AskSelectionMode = "ticker_scoped" | "full_pack";

export interface AskEvidenceSelection {
  /** Full internal facts (for grounding validation) — never sent to the LLM. */
  facts: AskEvidenceFact[];
  /** Exact model-facing projection of the selected facts — this is what the LLM receives. */
  safeFacts: ModelEvidenceFact[];
  selectedFactIds: string[];
  detectedTickers: string[];
  selectionMode: AskSelectionMode;
  /** V1.2B: present for on-demand ticker packs (deterministic bookkeeping). */
  composition?: AskEvidenceComposition;
}

/** Exact equivalent projection fields to projectBriefContext (no data). */
export function toSafeEvidenceFacts(facts: AskEvidenceFact[]): ModelEvidenceFact[] {
  return facts.map((fact) => ({
    id: fact.id,
    domain: fact.domain,
    text: fact.text,
    asOf: fact.asOf,
    freshness: fact.freshness,
    confidence: fact.confidence,
    sourceVersion: fact.sourceVersion,
  }));
}

function tickerOf(id: string, symbol: string): boolean {
  const upper = id.toUpperCase();
  const sym = symbol.toUpperCase();
  return (
    upper === `ANOMALY.${sym}` ||
    upper.startsWith(`CATALYST.${sym}.`) ||
    upper === `SECTOR.${sym}` ||
    upper === `MARKET.${sym}`
  );
}

const GLOBAL_PREFIXES = ["market.", "sector.", "macro.", "regime.", "breadth."];

/**
 * Conservative high-recall policy:
 * - Explicit ticker(s) present in the Evidence Pack → that ticker's facts plus
 *   global market/sector/macro/regime/breadth context (never other tickers'
 *   company-specific catalysts).
 * - Otherwise → full Evidence Pack.
 */
export function selectEvidenceForQuestion(
  context: BriefContext,
  question: string,
): AskEvidenceSelection {
  const symbols = globalSymbolsOf(context);
  const tokens = question
    .toUpperCase()
    .match(/[A-Z][A-Z0-9.-]{0,9}/g)
    ?.map((token) => token.replace(/[.-]+$/, ""))
    .filter((token) => token.length >= 2);
  const detected = Array.from(new Set(tokens?.filter((token) => symbols.has(token)) ?? []));

  const all = context.evidence;
  let selected: AskEvidenceFact[];
  let mode: AskSelectionMode;
  if (detected.length > 0) {
    mode = "ticker_scoped";
    selected = all.filter((fact) => {
      if (detected.some((symbol) => tickerOf(fact.id, symbol))) return true;
      if (fact.id.startsWith("catalyst.") || fact.id.startsWith("anomaly.")) return false;
      return GLOBAL_PREFIXES.some((prefix) => fact.id.startsWith(prefix));
    });
  } else {
    mode = "full_pack";
    selected = all;
  }

  return {
    facts: selected,
    safeFacts: toSafeEvidenceFacts(selected),
    selectedFactIds: selected.map((fact) => fact.id),
    detectedTickers: detected,
    selectionMode: mode,
  };
}
