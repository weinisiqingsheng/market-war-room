import { describe, expect, it } from "vitest";
import { buildDemoBriefContext } from "@/lib/ai-brief/demo-context";
import { validateAskSakuraAnswer } from "@/lib/ask-sakura/grounding-validator";
import { composeTickerAskEvidence } from "@/lib/ask-sakura/ticker-evidence";
import { selectEvidenceForQuestion } from "@/lib/ask-sakura/select-evidence";
import type { AskSakuraAnswer } from "@/lib/ask-sakura/types";
import type { AskEvidenceFact } from "@/lib/ask-sakura/evidence-fact";
import { tickerContextFixture } from "./helpers/ticker-ask-fixtures";

const globalContext = buildDemoBriefContext();

const selection = composeTickerAskEvidence({
  globalContext,
  ticker: tickerContextFixture(),
}).selection;

function answer(text: string, refs: string[]): AskSakuraAnswer {
  return {
    version: "ask-sakura-v1",
    status: "answered",
    answer: { text, evidenceRefs: refs },
    supportingPoints: [],
    limitations: [],
  };
}

function codes(result: ReturnType<typeof validateAskSakuraAnswer>): string[] {
  return result.valid ? [] : result.issues.map((issue) => issue.code);
}

describe("grounding with on-demand ticker evidence (V1.2B)", () => {
  it("accepts a ticker price claim supported by the selected ticker fact", () => {
    const result = validateAskSakuraAnswer(
      answer(
        "NVDA's regular-session reference price was 222.27, up 1.34% on session 2026-09-18 ET (delayed SIP).",
        ["ticker.NVDA.price"],
      ),
      selection.facts,
      selection,
    );
    expect(result).toEqual({ valid: true, issues: [] });
  });

  it("rejects an unsupported ticker price or percentage", () => {
    const result = validateAskSakuraAnswer(
      answer("NVDA traded at 999.99, up 12.34% today.", ["ticker.NVDA.price"]),
      selection.facts,
      selection,
    );
    expect(codes(result)).toContain("UNSUPPORTED_NUMBER");
  });

  it("rejects a reference to a ticker fact that was not selected", () => {
    const result = validateAskSakuraAnswer(
      answer("TSLA traded at 364.27.", ["ticker.TSLA.price"]),
      selection.facts,
      selection,
    );
    expect(codes(result)).toContain("UNKNOWN_EVIDENCE_REF");
  });

  it("rejects another ticker's catalyst for an NVDA answer", () => {
    const facts: AskEvidenceFact[] = [
      selection.facts.find((fact) => fact.id === "ticker.NVDA.price")!,
      {
        id: "catalyst.FICO.primary",
        domain: "catalyst",
        text: "FICO's strongest matched catalyst is REGULATORY / LEGAL.",
        data: { ticker: "FICO", evidenceStrength: "strong" },
        asOf: null,
        freshness: "delayed",
        confidence: null,
        sourceVersion: "catalyst-match-v1",
      },
    ];
    const result = validateAskSakuraAnswer(
      answer("NVDA moved while FICO had a regulatory catalyst.", [
        "ticker.NVDA.price",
        "catalyst.FICO.primary",
      ]),
      facts,
      { detectedTickers: ["NVDA"], selectionMode: "ticker_scoped" },
    );
    expect(codes(result)).toContain("CROSS_TICKER_CATALYST_REF");
  });

  it("does not let contextual news be promoted into a proven cause", () => {
    const promoted = validateAskSakuraAnswer(
      answer("The crypto-rail headline explains NVDA's move.", ["ticker.NVDA.news.1"]),
      selection.facts,
      selection,
    );
    expect(codes(promoted)).toContain("CONTEXT_ONLY_CATALYST_PROMOTION");

    const acceptable = validateAskSakuraAnswer(
      answer(
        "NVDA rose alongside available company news, but the evidence does not establish causation.",
        ["ticker.NVDA.price", "ticker.NVDA.news.1"],
      ),
      selection.facts,
      selection,
    );
    expect(acceptable).toEqual({ valid: true, issues: [] });
  });

  it("rejects event attribution when no clear company-specific catalyst was found", () => {
    const result = validateAskSakuraAnswer(
      answer("NVDA rose because of an earnings beat.", ["ticker.NVDA.price"]),
      selection.facts,
      selection,
    );
    expect(codes(result)).toContain("NO_CLEAR_CATALYST_CONTRADICTION");
  });

  it("rejects an unsupported forecast but allows an explicit non-forecast limitation", () => {
    const forecast = validateAskSakuraAnswer(
      answer("NVDA will rise next week.", ["ticker.NVDA.price"]),
      selection.facts,
      selection,
    );
    expect(codes(forecast)).toContain("UNSUPPORTED_FORECAST");

    const nonForecast = validateAskSakuraAnswer(
      answer("Current NVDA conditions are summarised above.", ["ticker.NVDA.price"]),
      selection.facts,
      selection,
    );
    expect(nonForecast).toEqual({ valid: true, issues: [] });

    const limitation: AskSakuraAnswer = {
      ...answer("Current NVDA conditions are summarised above.", ["ticker.NVDA.price"]),
      limitations: [
        {
          text: "The evidence does not establish whether NVDA will rise next week.",
          evidenceRefs: [],
        },
      ],
    };
    expect(validateAskSakuraAnswer(limitation, selection.facts, selection).valid).toBe(true);
  });

  it("accepts thousands-separated restatements of an exact evidence number", () => {
    const result = validateAskSakuraAnswer(
      answer("Completed-session volume was 191,619,629 vs a 130,670,732 average.", [
        "ticker.NVDA.volume",
      ]),
      selection.facts,
      selection,
    );
    expect(result).toEqual({ valid: true, issues: [] });
  });

  it("still rejects a number that is not in the referenced evidence", () => {
    const result = validateAskSakuraAnswer(
      answer("Completed-session volume was 999,999,999.", ["ticker.NVDA.volume"]),
      selection.facts,
      selection,
    );
    expect(codes(result)).toContain("UNSUPPORTED_NUMBER");
  });

  it("rejects a ticker claim grounded only in global backdrop evidence", () => {
    const result = validateAskSakuraAnswer(
      answer("NVDA is up today with the broad market.", ["market.spy"]),
      selection.facts,
      selection,
    );
    expect(codes(result)).toContain("TICKER_EVIDENCE_MISMATCH");
  });

  it("keeps the original global grounding behaviour intact", () => {
    const globalSelection = selectEvidenceForQuestion(globalContext, "Why is FICO down so much?");
    const valid = validateAskSakuraAnswer(
      answer("FICO fell 16.7% with a matched regulatory catalyst.", [
        "anomaly.FICO",
        "catalyst.FICO.primary",
      ]),
      globalSelection.facts,
      globalSelection,
    );
    expect(valid).toEqual({ valid: true, issues: [] });

    const invalid = validateAskSakuraAnswer(
      answer("FICO fell 99.9% today.", ["anomaly.FICO"]),
      globalSelection.facts,
      globalSelection,
    );
    expect(codes(invalid)).toContain("UNSUPPORTED_NUMBER");
  });
});
