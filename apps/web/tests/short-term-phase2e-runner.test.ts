import { describe, expect, it } from "vitest";
import { runForwardFixturePilot } from "@/lib/short-term/forward/runner";

describe("Phase 2E fixture runner", () => {
  it("runs three isolated fixture predictions with no real-provider requests", async () => {
    const report = await runForwardFixturePilot();
    expect(report.status).toBe("fixture_dry_run");
    expect(report.realJevRequests).toBe(0);
    expect(report.realMarketRequests).toBe(0);
    expect(report.predictions).toHaveLength(3);
    expect(
      report.predictions.every(
        (prediction) => prediction.modelOutputStatus === "fixture_model_output",
      ),
    ).toBe(true);
    expect(
      report.predictions.every((prediction) => prediction.horizon === "next_session_close"),
    ).toBe(true);
    expect(report.predictions.every((prediction) => Object.isFrozen(prediction))).toBe(true);
    expect(report.evaluation.sampleSize).toBe(3);
    expect(report.evaluation.forwardMetricStatus).toBe("applicable");
  });

  it("never exposes a real execution mode", async () => {
    const report = await runForwardFixturePilot(["NVDA"]);
    expect(report.predictions).toHaveLength(1);
    expect(report.realJevRequests).toBe(0);
  });
});
