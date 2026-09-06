import "server-only";
import { DEFAULT_LLM_TEMPERATURE, DEFAULT_LLM_TIMEOUT_MS, type LlmThinkingMode } from "./config";
import { LlmProviderError, type LlmRequest, type LlmResponse, type LlmThinkingRequest, type StructuredOutputMode } from "./types";

/**
 * Phase 7B.1 — OpenAI-compatible provider primitive.
 *
 * POST <baseUrl>/chat/completions. Single attempt, AbortController timeout,
 * deterministic error categories, no retry loop, no raw provider payloads
 * exposed. The API key travels only in the Authorization header.
 */
export interface LlmProviderOptions {
  baseUrl: string;
  apiKey: string;
  model: string;
  timeoutMs?: number;
  temperature?: number;
  structuredOutput?: StructuredOutputMode;
  /** Optional default thinking mode; only sent when configured. */
  thinkingMode?: LlmThinkingMode;
  fetchImpl?: typeof fetch;
}

export interface LlmProvider {
  complete(request: LlmRequest): Promise<LlmResponse>;
}

function sanitizeMessage(error: string): string {
  return error.replace(/(sk-|Bearer\s+)[A-Za-z0-9._-]+/gi, "$1[redacted]");
}

export function createOpenAiCompatibleProvider(options: LlmProviderOptions): LlmProvider {
  const baseUrl = options.baseUrl.replace(/\/+$/, "");
  const apiKey = options.apiKey;
  if (!baseUrl || !apiKey || !options.model) {
    throw new LlmProviderError("config", "Provider requires baseUrl, apiKey, and model.", null);
  }
  const timeoutMs = options.timeoutMs ?? DEFAULT_LLM_TIMEOUT_MS;
  const temperature = options.temperature ?? DEFAULT_LLM_TEMPERATURE;
  const structuredOutput = options.structuredOutput ?? "json_schema";
  const doFetch = options.fetchImpl ?? ((...args: Parameters<typeof fetch>) => fetch(...args));

  async function complete(request: LlmRequest): Promise<LlmResponse> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), requestStructured(request) === "off" ? timeoutMs : timeoutMs);
    try {
      const body: Record<string, unknown> = {
        model: request.model || options.model,
        messages: request.messages,
        temperature: request.temperature ?? temperature,
      };
      const mode = requestStructured(request);
      if (mode === "json_object") {
        body.response_format = { type: "json_object" };
      } else if (mode === "json_schema") {
        body.response_format = {
          type: "json_schema",
          json_schema: { name: "grounded_market_brief", strict: true, schema: request.jsonSchema ?? {} },
        };
      }
      const thinking = resolveThinking(request);
      if (thinking) body.thinking = thinking;
      const response = await doFetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (response.status === 401 || response.status === 403) {
        throw new LlmProviderError("auth", "LLM provider rejected credentials.", response.status);
      }
      if (response.status === 429) {
        throw new LlmProviderError("rate_limit", "LLM provider rate limit reached.", response.status);
      }
      if (response.status >= 500) {
        throw new LlmProviderError("server_error", "LLM provider server error.", response.status);
      }
      if (!response.ok) {
        throw new LlmProviderError("unknown", `LLM provider returned HTTP ${response.status}.`, response.status);
      }
      let payload: { choices?: Array<{ message?: { content?: unknown } }>; model?: string; usage?: { prompt_tokens?: number; completion_tokens?: number } } | undefined;
      try {
        payload = (await response.json()) as typeof payload;
      } catch {
        // Abort while reading the body is a TIMEOUT, not an invalid response.
        if (controller.signal.aborted) {
          throw new LlmProviderError("timeout", "LLM response body timed out.", null);
        }
        throw new LlmProviderError("invalid_response", "LLM response body was not valid JSON.", response.status);
      }
      const content = payload?.choices?.[0]?.message?.content;
      if (typeof content !== "string") {
        throw new LlmProviderError("invalid_response", "LLM response had no string content.");
      }
      return {
        content,
        model: payload?.model ?? request.model,
        usage: {
          inputTokens: payload?.usage?.prompt_tokens,
          outputTokens: payload?.usage?.completion_tokens,
        },
      };
    } catch (error) {
      if (error instanceof LlmProviderError) throw error;
      if (error instanceof Error && error.name === "AbortError") {
        throw new LlmProviderError("timeout", "LLM request timed out.", null);
      }
      const message = sanitizeMessage(error instanceof Error ? error.message : "LLM network failure");
      throw new LlmProviderError("network", message, null);
    } finally {
      clearTimeout(timer);
    }
  }

  function requestStructured(request: LlmRequest): StructuredOutputMode {
    if (request.structuredOutput === "off") return "off";
    return request.structuredOutput ?? structuredOutput;
  }

  function resolveThinking(request: LlmRequest): LlmThinkingRequest | undefined {
    if (request.thinking) return request.thinking;
    if (options.thinkingMode === "disabled") return { type: "disabled" };
    if (options.thinkingMode === "enabled") return { type: "enabled" };
    return undefined;
  }

  return { complete };
}
