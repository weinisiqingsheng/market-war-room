/** Phase 7B.1 — generic OpenAI-compatible LLM types (no vendor logic). */

export type LlmRole = "system" | "user" | "assistant";
export interface LlmMessage {
  role: LlmRole;
  content: string;
}

export type LlmErrorCategory =
  | "config"
  | "auth"
  | "rate_limit"
  | "timeout"
  | "server_error"
  | "invalid_response"
  | "network"
  | "unknown";

export type StructuredOutputMode = "off" | "json_object" | "json_schema";

export type LlmThinkingRequest = { type: "disabled" } | { type: "enabled" };

export interface LlmRequest {
  /** Optional explicit model override; when absent the provider's configured model is used. */
  model?: string;
  messages: LlmMessage[];
  temperature?: number;
  structuredOutput?: StructuredOutputMode;
  /** JSON schema payload for json_schema mode (generic passthrough). */
  jsonSchema?: Record<string, unknown>;
  /** Optional thinking-mode override; when absent the provider's configured value is used (or none). */
  thinking?: LlmThinkingRequest;
}

export interface LlmUsage {
  inputTokens?: number;
  outputTokens?: number;
}

export interface LlmResponse {
  content: string;
  model?: string;
  usage?: LlmUsage;
}

export class LlmProviderError extends Error {
  readonly category: LlmErrorCategory;
  readonly status: number | null;
  constructor(category: LlmErrorCategory, message: string, status: number | null = null) {
    super(message);
    this.name = "LlmProviderError";
    this.category = category;
    this.status = status;
  }
}
