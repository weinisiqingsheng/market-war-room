import { describe, expect, it } from "vitest";
import type { JevScoreAnswer, JevScoreQuestion } from "@/lib/short-term/jev/types";
import { auditScoreAnswer } from "@/lib/short-term/evaluation/score-contract";

const question: JevScoreQuestion = {
  type: "score",
  instructions: "How concerning is the supplied downside risk?",
  criteria: ["Low", "Moderate", "High"],
};

function answer(overrides: Partial<JevScoreAnswer> = {}): JevScoreAnswer {
  return {
    type: "score",
    score: 1.01,
    legend: { "0": "Low", "1": "Moderate", "2": "High" },
    probabilities: { "0": 0.22, "1": 0.55, "2": 0.23 },
    confidence: 0.33,
    ...overrides,
  };
}

describe("Phase 2C Score contract audit", () => {
  it("accepts AAPL's valid fractional weighted score of 1.01", () => {
    const result = auditScoreAnswer(answer(), question);

    expect(result).toMatchObject({
      valid: true,
      weightedScore: 1.01,
      minScore: 0,
      maxScore: 2,
    });
  });

  it.each([0, 2])("accepts an exact rubric boundary of %s", (score) => {
    const probabilities = score === 0 ? { "0": 1, "1": 0, "2": 0 } : { "0": 0, "1": 0, "2": 1 };
    expect(auditScoreAnswer(answer({ score, probabilities }), question).valid).toBe(true);
  });

  it("accepts probability and weighted-score differences within tolerance", () => {
    const result = auditScoreAnswer(
      answer({ score: 1.0100005, probabilities: { "0": 0.2199998, "1": 0.55, "2": 0.2300002 } }),
      question,
    );

    expect(result.valid).toBe(true);
  });

  it.each([-0.001, 2.001])("rejects a score outside the ordered level range: %s", (score) => {
    const result = auditScoreAnswer(answer({ score }), question);

    expect(result.valid).toBe(false);
    if (result.valid) throw new Error("expected invalid score");
    expect(result.issues).toContain("score_out_of_range");
  });

  it("rejects a finite score that disagrees with the probability-weighted result", () => {
    const result = auditScoreAnswer(answer({ score: 1.2 }), question);

    expect(result.valid).toBe(false);
    if (result.valid) throw new Error("expected inconsistent score");
    expect(result.issues).toContain("score_not_probability_weighted");
  });

  it("rejects malformed probability keys, values, and totals", () => {
    expect(
      auditScoreAnswer(
        answer({ probabilities: { "0": 0.5, "1": 0.5, extra: 0 } as Record<string, number> }),
        question,
      ),
    ).toMatchObject({ valid: false });
    expect(
      auditScoreAnswer(answer({ probabilities: { "0": 1.01, "1": -0.01, "2": 0 } }), question),
    ).toMatchObject({ valid: false });
    expect(
      auditScoreAnswer(
        answer({ probabilities: { "0": 0.2, "1": 0.2, "2": 0.2 }, score: 0.6 }),
        question,
      ),
    ).toMatchObject({ valid: false });
  });

  it("rejects a legend that does not describe every ordered level", () => {
    const result = auditScoreAnswer(answer({ legend: { "0": "Low", "1": "Moderate" } }), question);

    expect(result.valid).toBe(false);
    if (result.valid) throw new Error("expected invalid legend");
    expect(result.issues).toContain("legend_keys_mismatch");
  });

  it("rejects confidence outside the provider's unit interval", () => {
    const result = auditScoreAnswer(answer({ confidence: 1.01 }), question);

    expect(result.valid).toBe(false);
    if (result.valid) throw new Error("expected invalid confidence");
    expect(result.issues).toContain("confidence_invalid");
  });
});
