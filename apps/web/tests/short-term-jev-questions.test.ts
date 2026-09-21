import { describe, expect, it } from "vitest";
import { JEV_QUESTION_SET, buildJevQuestions } from "@/lib/short-term/jev/questions";

describe("short-term Jev question registry", () => {
  it("has stable atomic IDs and explicit rubrics", () => {
    const questions = buildJevQuestions();
    expect(JEV_QUESTION_SET).toBe("short-term-jev-questions-v1");
    expect(Object.keys(questions)).toEqual([
      "evidence_sufficiency",
      "market_condition",
      "downside_concern",
      "manual_review",
    ]);
    expect(questions.market_condition.type).toBe("choice");
    expect(questions.downside_concern.type).toBe("score");
    expect(JSON.stringify(questions)).not.toMatch(/target price|trade instruction|buy|sell/i);
  });
});
