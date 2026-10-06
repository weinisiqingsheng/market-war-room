import { describe, expect, it } from "vitest";
import { buildJevQuestions } from "@/lib/short-term/jev/questions";
import { validateJevProviderResponse } from "@/lib/short-term/jev/validate";
import type { JevProviderResponse } from "@/lib/short-term/jev/types";

function response(
  score: number,
  probabilities: Record<string, number>,
  confidence = 0.5,
): JevProviderResponse {
  return {
    model: "jev-1.13.0",
    answers: {
      evidence_sufficiency: { type: "noul", noul: 0.45 },
      market_condition: {
        type: "choice",
        choice: "mixed",
        probabilities: { bullish: 0.2, mixed: 0.6, defensive: 0.2 },
        confidence: 0.4,
      },
      downside_concern: {
        type: "score",
        score,
        legend: { "0": "Low", "1": "Moderate", "2": "High" },
        probabilities,
        confidence,
      },
      manual_review: { type: "noul", noul: 0.8 },
    },
    usage: { input_tokens: 120, output_tokens: 40 },
  };
}

describe("Phase 2C.1 production Score validation", () => {
  it.each([
    ["NVDA", 0.77, { "0": 0.35, "1": 0.53, "2": 0.12 }],
    ["AAPL", 1.01, { "0": 0.22, "1": 0.55, "2": 0.23 }],
  ] as const)("accepts the consistent historical %s Score", (_symbol, score, probabilities) => {
    expect(() =>
      validateJevProviderResponse(response(score, probabilities), buildJevQuestions()),
    ).not.toThrow();
  });

  it("rejects the TSLA weighted inconsistency in the production validator", () => {
    expect(() =>
      validateJevProviderResponse(
        response(0.93, { "0": 0.18, "1": 0.7, "2": 0.12 }),
        buildJevQuestions(),
      ),
    ).toThrow("probability-weighted");
  });

  it.each([0, 2])("accepts exact rubric boundaries: %s", (score) => {
    const probabilities = score === 0 ? { "0": 1, "1": 0, "2": 0 } : { "0": 0, "1": 0, "2": 1 };
    expect(() =>
      validateJevProviderResponse(response(score, probabilities), buildJevQuestions()),
    ).not.toThrow();
  });

  it.each([-0.01, 2.01])("rejects an out-of-range Score: %s", (score) => {
    expect(() =>
      validateJevProviderResponse(response(score, { "0": 0, "1": 0, "2": 1 }), buildJevQuestions()),
    ).toThrow("Score value");
  });

  it("rejects invalid probability maps, inconsistent Scores, and confidence violations", () => {
    expect(() =>
      validateJevProviderResponse(
        response(1, { "0": 0.2, "1": 0.2, "2": 0.2 }),
        buildJevQuestions(),
      ),
    ).toThrow("Probabilities");
    expect(() =>
      validateJevProviderResponse(
        response(1.2, { "0": 0.22, "1": 0.55, "2": 0.23 }),
        buildJevQuestions(),
      ),
    ).toThrow("probability-weighted");
    expect(() =>
      validateJevProviderResponse(
        response(1.01, { "0": 0.22, "1": 0.55, "2": 0.23 }, 1.01),
        buildJevQuestions(),
      ),
    ).toThrow("confidence");
  });
});
