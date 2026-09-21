import "server-only";
import { JEV_ENDPOINT, JEV_MODEL } from "./types";

export type JevTransportMode = "fixture" | "http";

export interface JevConfig {
  endpoint: typeof JEV_ENDPOINT;
  model: typeof JEV_MODEL;
  mode: JevTransportMode;
  allowRealProvider: boolean;
  timeoutMs: number;
  maxRetries: number;
  maxInputTokensPerRequest: number;
  maxRequestsPerShadowBatch: number;
  maxEstimatedBatchCostUsd: number;
  maxConcurrentRequests: number;
  inputUsdPerMillionTokens: number;
}

export const DEFAULT_JEV_CONFIG: JevConfig = {
  endpoint: JEV_ENDPOINT,
  model: JEV_MODEL,
  mode: "fixture",
  allowRealProvider: false,
  timeoutMs: 8_000,
  maxRetries: 1,
  maxInputTokensPerRequest: 8_000,
  maxRequestsPerShadowBatch: 25,
  maxEstimatedBatchCostUsd: 1,
  maxConcurrentRequests: 2,
  inputUsdPerMillionTokens: 0.042,
};

export function createJevConfig(overrides: Partial<JevConfig> = {}): JevConfig {
  const config = { ...DEFAULT_JEV_CONFIG, ...overrides };
  if (config.endpoint !== JEV_ENDPOINT)
    throw new Error("Jev endpoint is fixed and cannot be overridden");
  if (config.model !== JEV_MODEL) throw new Error("Jev model must remain pinned to jev-1.13.0");
  if (config.mode === "http" && !config.allowRealProvider) {
    throw new Error("Real Jev provider execution is disabled");
  }
  return config;
}
