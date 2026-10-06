import { describe, expect, it } from "vitest";
import { runProspectiveFixtureDryRun } from "@/lib/short-term/prospective/pilot";

describe("Phase 2D fixture-first pilot", () => {
  it("runs NVDA, TSLA, and AAPL through fixture Jev and separate outcome records", async () => {
    const report = await runProspectiveFixtureDryRun();

    expect(report.status).toBe("fixture_dry_run");
    expect(report.results.map((result) => result.symbol)).toEqual(["NVDA", "TSLA", "AAPL"]);
    for (const result of report.results) {
      expect(result.decision.marketInputStatus).toBe("fixture_market_input");
      expect(result.decision.assessment.modelOutputStatus).toBe("fixture_model_output");
      expect(result.outcome.runId).toBe(result.decision.runId);
      expect(result.outcome.stateFingerprint).toBe(result.decision.stateFingerprint);
      expect(result.outcome.label).not.toBe("not_observable");
      expect(result.evaluation.forward.status).toBe("not_applicable");
      expect(result.evaluation.baseline.label).toBe("flat");
    }
  });

  it("does not expose or enable a real provider path", async () => {
    const report = await runProspectiveFixtureDryRun(["NVDA"]);
    expect(report.realProviderRequests).toBe(0);
    expect(report.results[0]?.decision.marketInputStatus).toBe("fixture_market_input");
  });
});
