import { selectEvidenceForQuestion, type AskEvidenceSelection } from "./select-evidence";
import { generateAskSakuraAnswer } from "./generate";
import { routeAskQuestion, type AskRoute } from "./question-routing";
import { composeTickerAskEvidence, type ComposedTickerEvidence } from "./ticker-evidence";
import { toAskTickerResearchMeta, type AskTickerResearchMeta } from "./ticker-research";
import type { AskSakuraAnswer } from "./types";
import type { AskGenerationResult } from "./generation-types";
import type { BriefContext, BriefInputConfidence } from "@/lib/ai-brief/types";
import type { TickerResearchResult } from "@/lib/ticker-context/types";
import type { LlmProvider } from "@/lib/llm/provider";

export type AskMode = "demo" | "live";
export type AskServiceStatus = "generated" | "insufficient_grounded_data" | "unavailable";

export type AskServiceReason =
  | "provider_error"
  | "schema_validation_failed"
  | "grounding_validation_failed"
  | "config_error"
  /* V1.2B on-demand ticker outcomes (safe, user-facing) */
  | "unknown_symbol"
  | "unsupported_security_type"
  | "ambiguous_ticker"
  | "ticker_insufficient_evidence"
  | "ticker_research_unavailable";

export interface AskServiceResult {
  mode: AskMode;
  status: AskServiceStatus;
  contextFingerprint: string | null;
  inputConfidence: BriefInputConfidence | null;
  selectedFactCount: number;
  answer: AskSakuraAnswer | null;
  reason: AskServiceReason | null;
  /** V1.2B optional metadata (backward compatible; never raw provider data). */
  research?: AskTickerResearchMeta | null;
  route?: AskRoute;
}

export interface AskServiceDeps {
  mode: AskMode;
  contextBuilder: () => BriefContext | Promise<BriefContext>;
  provider: LlmProvider;
  /**
   * V1.2B: on-demand ticker research (server-side V1.2A service). Absent in demo
   * mode; a ticker question then receives an honest limitation instead of a
   * generic global answer.
   */
  tickerResearch?: (symbol: string) => Promise<TickerResearchResult>;
}

export interface AskSakuraService {
  ask(question: string): Promise<AskServiceResult>;
}

export function createAskSakuraService(deps: AskServiceDeps): AskSakuraService {
  return {
    async ask(question: string): Promise<AskServiceResult> {
      const context = await deps.contextBuilder();
      const fingerprint = context.fingerprint;
      const confidence = context.inputConfidence;
      const routing = routeAskQuestion(context, question);
      const base = { mode: deps.mode, contextFingerprint: fingerprint, route: routing.route };

      /** Ambiguous questions never silently pick or drop a ticker. */
      if (routing.route === "AMBIGUOUS") {
        return {
          ...base,
          status: "insufficient_grounded_data",
          inputConfidence: confidence,
          selectedFactCount: 0,
          answer: null,
          reason: "ambiguous_ticker",
          research: null,
        };
      }

      if (routing.route === "TICKER_RESEARCH") {
        const requested = routing.tickerSymbols[0] ?? "";
        if (!deps.tickerResearch) {
          return {
            ...base,
            status: "unavailable",
            inputConfidence: confidence,
            selectedFactCount: 0,
            answer: null,
            reason: "ticker_research_unavailable",
            research: null,
          };
        }

        let research: TickerResearchResult;
        try {
          research = await deps.tickerResearch(requested);
        } catch {
          return {
            ...base,
            status: "unavailable",
            inputConfidence: confidence,
            selectedFactCount: 0,
            answer: null,
            reason: "ticker_research_unavailable",
            research: null,
          };
        }

        const researchMeta = toAskTickerResearchMeta(research);
        if (research.status === "unsupported_symbol" || research.status === "unavailable") {
          // Unknown/unsupported symbol or provider outage: never fall back to
          // generic global evidence for a specifically requested ticker.
          const unsupported = research.status === "unsupported_symbol";
          return {
            ...base,
            status: unsupported ? "insufficient_grounded_data" : "unavailable",
            inputConfidence: confidence,
            selectedFactCount: 0,
            answer: null,
            reason: unsupported
              ? research.reason === "unsupported_security_type"
                ? "unsupported_security_type"
                : "unknown_symbol"
              : "ticker_research_unavailable",
            research: researchMeta,
          };
        }

        if (research.status === "insufficient_data") {
          return {
            ...base,
            status: "insufficient_grounded_data",
            inputConfidence: confidence,
            selectedFactCount: research.context.facts.length,
            answer: null,
            reason: "ticker_insufficient_evidence",
            research: researchMeta,
          };
        }

        // The global input-confidence gate intentionally does NOT block a
        // ticker question: that evidence is independently verified and carries
        // its own freshness/limitations in the facts.
        const composed: ComposedTickerEvidence = composeTickerAskEvidence({
          globalContext: context,
          ticker: research.context,
        });
        return runGeneration({
          question,
          selection: composed.selection,
          confidence,
          fingerprint,
          provider: deps.provider,
          base,
          research: researchMeta,
        });
      }

      // GLOBAL_MARKET (and the advisory OUT_OF_SCOPE hint): V1.1C path unchanged.
      if (confidence.label === "insufficient") {
        return {
          ...base,
          status: "insufficient_grounded_data",
          inputConfidence: confidence,
          selectedFactCount: 0,
          answer: null,
          reason: null,
          research: null,
        };
      }
      const selection = selectEvidenceForQuestion(context, question);
      return runGeneration({
        question,
        selection,
        confidence,
        fingerprint,
        provider: deps.provider,
        base,
        research: null,
      });
    },
  };
}

interface RunGenerationInput {
  question: string;
  selection: AskEvidenceSelection;
  confidence: BriefInputConfidence;
  fingerprint: string;
  provider: LlmProvider;
  base: { mode: AskMode; contextFingerprint: string; route: AskRoute };
  research: AskTickerResearchMeta | null;
}

async function runGeneration(input: RunGenerationInput): Promise<AskServiceResult> {
  const generation = await generateAskSakuraAnswer({
    question: input.question,
    selection: input.selection,
    inputConfidence: input.confidence,
    fingerprint: input.fingerprint,
    provider: input.provider,
    // On-demand ticker evidence is independently verified; its own freshness
    // and limitations travel inside the facts (see composeTickerAskEvidence).
    skipInputConfidenceGate: input.research !== null,
  });
  return {
    ...input.base,
    status: generation.status === "generated" ? "generated" : generation.status,
    inputConfidence: input.confidence,
    selectedFactCount: input.selection.selectedFactIds.length,
    answer: generation.status === "generated" ? generation.answer : null,
    reason: reasonFrom(generation),
    research: input.research,
  };
}

function reasonFrom(result: AskGenerationResult): AskServiceReason | null {
  if (result.status !== "unavailable") return null;
  return result.reason;
}
