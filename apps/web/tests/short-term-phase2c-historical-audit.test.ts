import { describe, expect, it } from "vitest";
import { auditHistoricalScoreRecord } from "@/lib/short-term/evaluation/historical-score-audit";

const tsla = {
  ticker: "TSLA",
  runId: "short-term-1981f035e3c261a384354a87",
  stateFingerprint: "1981f035e3c261a384354a87fdd3f3a5ac887951cb56bd979cebdcf39e73e007",
  score: 0.93,
  probabilities: { "0": 0.18, "1": 0.7, "2": 0.12 },
};

describe("Phase 2C.1 historical Score audit", () => {
  it("marks only the exact stored TSLA identity as weighted-consistency-unverified", () => {
    expect(auditHistoricalScoreRecord(tsla)).toMatchObject({
      status: "weighted_consistency_unverified",
      ticker: "TSLA",
      runId: tsla.runId,
      stateFingerprint: tsla.stateFingerprint,
      reason: expect.stringContaining("0.93"),
    });
  });

  it("does not generalize the exception to another run or fingerprint", () => {
    expect(auditHistoricalScoreRecord({ ...tsla, runId: "other-run" }).status).toBe(
      "not_applicable",
    );
    expect(auditHistoricalScoreRecord({ ...tsla, stateFingerprint: "f".repeat(64) }).status).toBe(
      "not_applicable",
    );
  });

  it("does not mark a consistent historical Score as unverified", () => {
    expect(
      auditHistoricalScoreRecord({
        ticker: "AAPL",
        runId: "other-run",
        stateFingerprint: "a".repeat(64),
        score: 1.01,
        probabilities: { "0": 0.22, "1": 0.55, "2": 0.23 },
      }).status,
    ).toBe("not_applicable");
  });
});
