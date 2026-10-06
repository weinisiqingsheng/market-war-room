import "server-only";
import { estimateJevCostUsd, estimateJevInputTokens } from "../jev/budget";
import type { JevConfig } from "../jev/config";

/**
 * Phase 2E uses the configured input-only pricing contract. The provider's
 * maximum accepted input-token budget is the hard upper bound for a request;
 * reserving at least that amount prevents a character/token heuristic from
 * under-reserving the pre-send batch budget.
 */
export function estimateForwardConservativeInputTokens(
  payload: unknown,
  config: JevConfig,
): number {
  const heuristicTokens = Math.ceil(estimateJevInputTokens(payload) * 2);
  return Math.max(heuristicTokens, config.maxInputTokensPerRequest);
}

export function estimateForwardConservativeCostUsd(payload: unknown, config: JevConfig): number {
  return estimateJevCostUsd(estimateForwardConservativeInputTokens(payload, config), config);
}
