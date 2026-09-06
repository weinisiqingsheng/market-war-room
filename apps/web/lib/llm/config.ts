import "server-only";
import type { StructuredOutputMode } from "./types";

export type LlmThinkingMode = "disabled" | "enabled";

/**
 * Phase 7B.1 — server-only LLM configuration.
 *
 * Reads env defaults but supports explicit injection for tests. API keys never
 * appear in serialized output (config is never JSON-serialized).
 */
export const DEFAULT_LLM_TIMEOUT_MS = 12_000;
export const DEFAULT_LLM_TEMPERATURE = 0.2;

export interface LlmConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  timeoutMs: number;
  temperature: number;
  structuredOutput: StructuredOutputMode;
  /** Optional provider thinking mode; absent → no thinking field sent. */
  thinkingMode?: LlmThinkingMode;
}

export function resolveLlmConfig(env: Record<string, string | undefined> = process.env): LlmConfig {
  const baseUrl = env.LLM_BASE_URL?.trim() ?? "";
  const apiKey = env.LLM_API_KEY?.trim() ?? "";
  const model = env.LLM_MODEL?.trim() ?? "";
  if (!baseUrl || !apiKey || !model) {
    throw new Error("LLM live mode requires LLM_BASE_URL, LLM_API_KEY, and LLM_MODEL.");
  }
  return {
    baseUrl,
    apiKey,
    model,
    timeoutMs: Number(env.LLM_TIMEOUT_MS ?? DEFAULT_LLM_TIMEOUT_MS),
    temperature: Number(env.LLM_TEMPERATURE ?? DEFAULT_LLM_TEMPERATURE),
    structuredOutput: (env.LLM_STRUCTURED_OUTPUT as StructuredOutputMode | undefined) ?? "json_schema",
    thinkingMode: resolveThinkingMode(env.LLM_THINKING_MODE),
  };
}

function resolveThinkingMode(raw: string | undefined): LlmThinkingMode | undefined {
  if (raw === undefined || raw.trim() === "") return undefined;
  const value = raw.trim().toLowerCase();
  if (value === "disabled" || value === "enabled") return value;
  throw new Error(`Invalid LLM_THINKING_MODE "${value}": expected disabled or enabled.`);
}
