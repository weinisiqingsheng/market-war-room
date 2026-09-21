import { describe, expect, it } from "vitest";
import { buildJevQuestions } from "@/lib/short-term/jev/questions";
import { validateJevProviderResponse } from "@/lib/short-term/jev/validate";
import type { JevProviderResponse } from "@/lib/short-term/jev/types";

const valid: JevProviderResponse = {
  model: "jev-1.13.0",
  answers: {
    evidence_sufficiency: { type: "noul", noul: 0.8 },
    market_condition: {
      type: "choice",
      choice: "mixed",
      probabilities: { bullish: 0.2, mixed: 0.6, defensive: 0.2 },
      confidence: 0.4,
    },
    downside_concern: {
      type: "score",
      score: 1.2,
      legend: { "0": "Low", "1": "Moderate", "2": "High" },
      probabilities: { "0": 0.2, "1": 0.6, "2": 0.2 },
      confidence: 0.4,
    },
    manual_review: { type: "noul", noul: 0.7 },
  },
  usage: { input_tokens: 120, output_tokens: 40 },
};

describe("Jev provider response validation", () => {
  it("accepts the exact pinned model and typed answer set", () => {
    expect(validateJevProviderResponse(valid, buildJevQuestions(), "fingerprint")).toMatchObject({
      model: "jev-1.13.0",
    });
  });

  it.each([
    ["wrong model", { ...valid, model: "jev-latest" }],
    ["missing answer", { ...valid, answers: { ...valid.answers, manual_review: undefined } }],
    [
      "extra answer",
      { ...valid, answers: { ...valid.answers, extra: { type: "noul", noul: 0.5 } } },
    ],
    [
      "invalid probability",
      {
        ...valid,
        answers: {
          ...valid.answers,
          market_condition: {
            ...valid.answers.market_condition,
            probabilities: { bullish: 2, mixed: -1, defensive: 0 },
          },
        },
      },
    ],
  ] as const)("rejects %s", (_label, value) => {
    expect(() =>
      validateJevProviderResponse(value as JevProviderResponse, buildJevQuestions(), "fingerprint"),
    ).toThrow();
  });

  it("rejects score levels that do not match the declared rubric", () => {
    const value = {
      ...valid,
      answers: {
        ...valid.answers,
        downside_concern: {
          ...valid.answers.downside_concern,
          legend: { "0": "Low", "1": "Moderate" },
        },
      },
    };
    expect(() =>
      validateJevProviderResponse(value as JevProviderResponse, buildJevQuestions(), "fingerprint"),
    ).toThrow("legend");
  });
});
