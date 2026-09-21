import { describe, expect, it, vi } from "vitest";
import { createJevConfig } from "@/lib/short-term/jev/config";
import { createFixtureTransport } from "@/lib/short-term/jev/fixture-transport";
import { createHttpTransport } from "@/lib/short-term/jev/http-transport";
import { classifyJevError, shouldRetryJevStatus } from "@/lib/short-term/jev/errors";
import { validateTransportFingerprint } from "@/lib/short-term/jev/validate";
import type { JevProviderRequest } from "@/lib/short-term/jev/types";

const request: JevProviderRequest = {
  state: { symbol: "NVDA" },
  model: "jev-1.13.0",
  questions: {},
};

describe("short-term Jev transports", () => {
  it("fixture transport is deterministic and explicitly fixture-backed", async () => {
    const transport = createFixtureTransport();
    const first = await transport.evaluate(request, "a".repeat(64));
    const second = await transport.evaluate(request, "a".repeat(64));
    expect(first).toEqual(second);
    expect(first.transport).toBe("fixture");
  });

  it("HTTP transport refuses execution while real mode is disabled", async () => {
    const fetch = vi.fn();
    const transport = createHttpTransport(createJevConfig(), { fetch });
    await expect(transport.evaluate(request, "a".repeat(64))).rejects.toMatchObject({
      code: "REAL_PROVIDER_DISABLED",
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("uses only bounded retryable statuses", () => {
    expect(shouldRetryJevStatus(429)).toBe(true);
    expect(shouldRetryJevStatus(529)).toBe(true);
    expect(shouldRetryJevStatus(401)).toBe(false);
    expect(classifyJevError(422)).toMatchObject({
      code: "INVALID_PROVIDER_REQUEST",
      retryable: false,
    });
  });

  it("retries 429 once, but never retries 401 or 422", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response("", { status: 429 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            model: "jev-1.13.0",
            answers: {},
            usage: { input_tokens: 1, output_tokens: 1 },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
    const transport = createHttpTransport(
      { ...createJevConfig({ mode: "http", allowRealProvider: true }), maxRetries: 1 },
      { fetch, apiKey: "fixture-key", sleep: async () => undefined },
    );
    await expect(transport.evaluate(request, "a".repeat(64))).resolves.toMatchObject({
      transport: "http",
    });
    expect(fetch).toHaveBeenCalledTimes(2);

    const nonRetryable = vi.fn().mockResolvedValue(new Response("", { status: 401 }));
    const noRetryTransport = createHttpTransport(
      { ...createJevConfig({ mode: "http", allowRealProvider: true }), maxRetries: 1 },
      { fetch: nonRetryable, apiKey: "fixture-key", sleep: async () => undefined },
    );
    await expect(noRetryTransport.evaluate(request, "a".repeat(64))).rejects.toMatchObject({
      code: "INVALID_CREDENTIALS",
    });
    expect(nonRetryable).toHaveBeenCalledTimes(1);

    const invalidRequest = vi.fn().mockResolvedValue(new Response("", { status: 422 }));
    const no422RetryTransport = createHttpTransport(
      { ...createJevConfig({ mode: "http", allowRealProvider: true }), maxRetries: 1 },
      { fetch: invalidRequest, apiKey: "fixture-key", sleep: async () => undefined },
    );
    await expect(no422RetryTransport.evaluate(request, "a".repeat(64))).rejects.toMatchObject({
      code: "INVALID_PROVIDER_REQUEST",
    });
    expect(invalidRequest).toHaveBeenCalledTimes(1);
  });

  it("rejects exhausted overload retries and mismatched fingerprints", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response("", { status: 529 }));
    const transport = createHttpTransport(
      { ...createJevConfig({ mode: "http", allowRealProvider: true }), maxRetries: 1 },
      { fetch, apiKey: "fixture-key", sleep: async () => undefined },
    );
    await expect(transport.evaluate(request, "a".repeat(64))).rejects.toMatchObject({
      code: "PROVIDER_OVERLOADED",
    });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(() => validateTransportFingerprint("a", "b")).toThrow("fingerprint");
  });

  it("classifies an aborted provider call as a timeout without retrying when capped", async () => {
    const timeout = Object.assign(new Error("aborted"), { name: "AbortError" });
    const fetch = vi.fn().mockRejectedValue(timeout);
    const transport = createHttpTransport(
      {
        ...createJevConfig({ mode: "http", allowRealProvider: true }),
        maxRetries: 0,
        timeoutMs: 5,
      },
      { fetch, apiKey: "fixture-key" },
    );
    await expect(transport.evaluate(request, "a".repeat(64))).rejects.toMatchObject({
      code: "PROVIDER_TIMEOUT",
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("does not retry malformed successful JSON", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response("not-json", { status: 200 }));
    const transport = createHttpTransport(
      { ...createJevConfig({ mode: "http", allowRealProvider: true }), maxRetries: 1 },
      { fetch, apiKey: "fixture-key" },
    );
    await expect(transport.evaluate(request, "a".repeat(64))).rejects.toMatchObject({
      code: "RESPONSE_INVALID",
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
