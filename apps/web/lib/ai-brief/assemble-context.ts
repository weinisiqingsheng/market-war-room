/**
 * Phase 7C.1C — pure composition of adapted domains into brief-context-v1.
 *
 * This layer is intentionally boring: adapter outputs → sealed
 * buildBriefContext. No provider knowledge, no market semantics, no AI.
 * Unavailable domains pass through unchanged; no demo fallback.
 */
import { buildBriefContext } from "./context";
import type {
  AnomalyEvidenceInput,
  BreadthEvidenceInput,
  CatalystPrimaryEvidenceInput,
  CatalystItemEvidenceInput,
  CatalystsEvidenceInput,
  EvidenceBuilderInput,
  MacroEvidenceInput,
  MarketEvidenceInput,
  RegimeEvidenceInput,
} from "./types";
import type { BriefContext } from "./types";
import type { DomainAdapterOutput } from "./adapters";

export interface AdaptedDomainBundle {
  market: DomainAdapterOutput<MarketEvidenceInput>;
  macro: DomainAdapterOutput<MacroEvidenceInput>;
  regime: DomainAdapterOutput<RegimeEvidenceInput>;
  breadth: DomainAdapterOutput<BreadthEvidenceInput>;
  anomalies: DomainAdapterOutput<AnomalyEvidenceInput>;
  catalysts: DomainAdapterOutput<CatalystsEvidenceInput>;
}

export interface AssembleBriefContextInput extends AdaptedDomainBundle {
  generatedAt: string;
}

export function assembleBriefContext(input: AssembleBriefContextInput): BriefContext {
  const { generatedAt, market, macro, regime, breadth, anomalies, catalysts } = input;
  const evidenceInput: EvidenceBuilderInput = {
    market: market.evidenceInput ?? undefined,
    macro: macro.evidenceInput ?? undefined,
    regime: regime.evidenceInput ?? undefined,
    breadth: breadth.evidenceInput ?? undefined,
    anomalies: anomalies.evidenceInput ?? undefined,
    catalysts: catalysts.evidenceInput ?? undefined,
  };
  const sources = {
    market: market.sourceMeta,
    macro: macro.sourceMeta,
    regime: regime.sourceMeta,
    breadth: breadth.sourceMeta,
    anomalies: anomalies.sourceMeta,
    catalysts: catalysts.sourceMeta,
  };
  const confidenceInput = {
    market: market.quality,
    macro: macro.quality,
    regime: regime.quality,
    breadth: breadth.quality,
    anomalies: anomalies.quality,
    catalysts: catalysts.quality,
  };
  return buildBriefContext({ generatedAt, evidenceInput, sources, confidenceInput });
}

export type { CatalystPrimaryEvidenceInput, CatalystItemEvidenceInput };
