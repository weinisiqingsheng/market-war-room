import "server-only";
import { JevAdapterError } from "./errors";
import type { JevConfig } from "./config";

export function estimateJevInputTokens(payload: unknown): number {
  return Math.max(1, Math.ceil(JSON.stringify(payload).length / 4));
}

export function estimateJevCostUsd(inputTokens: number, config: JevConfig): number {
  return (inputTokens / 1_000_000) * config.inputUsdPerMillionTokens;
}

export function assertJevRequestBudget(inputTokens: number, config: JevConfig): void {
  if (inputTokens > config.maxInputTokensPerRequest) {
    throw new JevAdapterError(
      "BUDGET_EXCEEDED",
      "Jev request exceeds the configured input-token budget.",
    );
  }
  if (estimateJevCostUsd(inputTokens, config) > config.maxEstimatedBatchCostUsd) {
    throw new JevAdapterError("BUDGET_EXCEEDED", "Jev request exceeds the configured cost budget.");
  }
}

export function assertJevBatchBudget(
  requestCount: number,
  estimatedCostUsd: number,
  config: JevConfig,
): void {
  if (
    !Number.isInteger(requestCount) ||
    requestCount < 0 ||
    requestCount > config.maxRequestsPerShadowBatch
  ) {
    throw new JevAdapterError(
      "BUDGET_EXCEEDED",
      "Shadow batch exceeds the configured request-count budget.",
    );
  }
  if (!Number.isFinite(estimatedCostUsd) || estimatedCostUsd > config.maxEstimatedBatchCostUsd) {
    throw new JevAdapterError(
      "BUDGET_EXCEEDED",
      "Shadow batch exceeds the configured cost budget.",
    );
  }
}
