// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createJevConfig } from "@/lib/short-term/jev/config";
import {
  estimateForwardConservativeCostUsd,
  estimateForwardConservativeInputTokens,
} from "@/lib/short-term/forward/cost";

describe("Phase 2E.3 forward cost reserve", () => {
  const config = createJevConfig({
    mode: "http",
    allowRealProvider: true,
    maxRetries: 0,
    maxRequestsPerShadowBatch: 3,
    maxEstimatedBatchCostUsd: 0.1,
    maxConcurrentRequests: 1,
  });

  it("reserves at least the configured input-token ceiling", () => {
    const request = { model: "jev-1.13.0", state: { market: "x" }, questions: {} };
    expect(estimateForwardConservativeInputTokens(request, config)).toBe(
      config.maxInputTokensPerRequest,
    );
    expect(estimateForwardConservativeCostUsd(request, config)).toBeCloseTo(
      (config.maxInputTokensPerRequest / 1_000_000) * config.inputUsdPerMillionTokens,
    );
  });

  it.each([1, 2_365, 7_999, 8_000])(
    "cannot reserve less than a successful response usage estimate (%s input tokens)",
    (inputTokens) => {
      const request = { model: "jev-1.13.0", state: { market: "x" }, questions: {} };
      const reserve = estimateForwardConservativeCostUsd(request, config);
      const reportedUsageEstimate = (inputTokens / 1_000_000) * config.inputUsdPerMillionTokens;
      expect(reserve).toBeGreaterThanOrEqual(reportedUsageEstimate);
    },
  );

  it("preserves the configured pricing model and does not price output tokens", () => {
    const request = { model: "jev-1.13.0", state: { market: "x" }, questions: {} };
    const reserve = estimateForwardConservativeCostUsd(request, config);
    expect(reserve).toBe(
      (config.maxInputTokensPerRequest / 1_000_000) * config.inputUsdPerMillionTokens,
    );
  });
});
