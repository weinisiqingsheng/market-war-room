import { describe, expect, it, vi } from "vitest";
import { buildDemoBriefContext } from "@/lib/ai-brief/demo-context";
import type { BriefContext } from "@/lib/ai-brief/types";
import { createAskSakuraService } from "@/lib/ask-sakura/service";
import { EVIDENCE_DELIMITER_END, EVIDENCE_DELIMITER_START } from "@/lib/ask-sakura/prompt";
import type { AskSakuraAnswer } from "@/lib/ask-sakura/types";
import type { LlmProvider } from "@/lib/llm/provider";
import type { TickerResearchResult } from "@/lib/ticker-context/types";
import {
  tickerOkResult,
  tickerPartialResult,
  tickerUnavailableResult,
  tickerUnknownResult,
  tickerUnsupportedResult,
} from "./helpers/ticker-ask-fixtures";

const context = buildDemoBriefContext();

const validAnswer: AskSakuraAnswer = {
  version: "ask-sakura-v1",
  status: "answered",
  answer: {
    text: "NVDA's reference price was 222.27 on session 2026-09-18 ET.",
    evidenceRefs: ["ticker.NVDA.price"],
  },
  supportingPoints: [],
  limitations: [],
};

function providerWith(...responses: string[]): LlmProvider {
  const queue = [...responses];
  const complete = vi.fn(async () => ({
    content: queue.shift() ?? JSON.stringify(validAnswer),
  }));
  return { complete } as unknown as LlmProvider;
}

function evidenceBlockOf(messages: Array<{ content: string }>): string {
  const user = messages.find((message) => message.content.includes(EVIDENCE_DELIMITER_START));
  const content = user?.content ?? "";
  const start = content.indexOf(EVIDENCE_DELIMITER_START) + EVIDENCE_DELIMITER_START.length;
  const end = content.indexOf(EVIDENCE_DELIMITER_END);
  return content.slice(start, end).trim();
}

function serviceWith(input: {
  tickerResearch?: (symbol: string) => Promise<TickerResearchResult>;
  provider: LlmProvider;
  contextOverride?: BriefContext;
}) {
  return createAskSakuraService({
    mode: "live",
    contextBuilder: () => input.contextOverride ?? context,
    provider: input.provider,
    tickerResearch: input.tickerResearch,
  });
}

describe("Ask Sakura ticker integration service (V1.2B)", () => {
  it("researches the routed ticker once and grounds on its evidence", async () => {
    const provider = providerWith();
    const tickerResearch = vi.fn(async () => tickerOkResult());
    const service = serviceWith({ provider, tickerResearch });

    const result = await service.ask("What is happening with NVDA today?");

    expect(tickerResearch).toHaveBeenCalledTimes(1);
    expect(tickerResearch).toHaveBeenCalledWith("NVDA");
    expect(result.status).toBe("generated");
    expect(result.route).toBe("TICKER_RESEARCH");
    expect(result.research).toMatchObject({
      requestedSymbol: "NVDA",
      symbol: "NVDA",
      status: "ok",
      reason: null,
      marketSessionAsOf: "2026-09-18",
      researchVersion: "ticker-context-v1",
    });
    expect(result.selectedFactCount).toBeGreaterThan(0);

    const messages = vi.mocked(provider.complete).mock.calls[0]?.[0].messages ?? [];
    const evidence = evidenceBlockOf(messages);
    expect(evidence).toContain("ticker.NVDA.price");
    expect(evidence).toContain("ticker.NVDA.identity");
    expect(evidence).not.toContain("catalyst.LULU");
    expect(evidence).not.toContain("anomaly.LULU");
    expect(evidence).not.toContain("previousClose");
  });

  it("does not research a ticker for global market questions", async () => {
    const provider = providerWith(
      JSON.stringify({
        ...validAnswer,
        answer: { text: "Breadth is mixed.", evidenceRefs: ["breadth.summary"] },
      }),
    );
    const tickerResearch = vi.fn(async () => tickerOkResult());
    const service = serviceWith({ provider, tickerResearch });

    const result = await service.ask("Is market breadth weak?");

    expect(tickerResearch).not.toHaveBeenCalled();
    expect(result.route).toBe("GLOBAL_MARKET");
    expect(result.status).toBe("generated");
    expect(result.research).toBeNull();
  });

  it("performs exactly one ticker lookup even when a repair call happens", async () => {
    const provider = providerWith("not json", JSON.stringify(validAnswer));
    const tickerResearch = vi.fn(async () => tickerOkResult());
    const service = serviceWith({ provider, tickerResearch });

    const result = await service.ask("Why is NVDA moving?");

    expect(result.status).toBe("generated");
    expect(tickerResearch).toHaveBeenCalledTimes(1);
    expect(vi.mocked(provider.complete)).toHaveBeenCalledTimes(2);
  });

  it("reuses identical evidence for the repair attempt", async () => {
    const provider = providerWith("not json", JSON.stringify(validAnswer));
    const service = serviceWith({ provider, tickerResearch: async () => tickerOkResult() });

    await service.ask("Why is NVDA moving?");

    const calls = vi.mocked(provider.complete).mock.calls;
    const first = evidenceBlockOf(calls[0]?.[0].messages ?? []);
    const second = evidenceBlockOf(calls[1]?.[0].messages ?? []);
    expect(second).toBe(first);
  });

  it("stops after two provider calls when grounding keeps failing", async () => {
    const provider = providerWith("{}", "{}");
    const service = serviceWith({ provider, tickerResearch: async () => tickerOkResult() });

    const result = await service.ask("Why is NVDA moving?");

    expect(vi.mocked(provider.complete)).toHaveBeenCalledTimes(2);
    expect(result.status).toBe("unavailable");
    expect(result.reason).toBe("schema_validation_failed");
  });

  it("handles partial ticker evidence without fabricating the missing parts", async () => {
    const provider = providerWith(JSON.stringify(validAnswer));
    const service = serviceWith({ provider, tickerResearch: async () => tickerPartialResult() });

    const result = await service.ask("Is NVDA showing unusual volume?");

    expect(result.status).toBe("generated");
    expect(result.research).toMatchObject({ status: "partial", symbol: "NVDA" });
    const evidence = evidenceBlockOf(
      vi.mocked(provider.complete).mock.calls[0]?.[0].messages ?? [],
    );
    expect(evidence).not.toContain("ticker.NVDA.volatility");
  });

  it("never falls back to global evidence for an unknown or unsupported ticker", async () => {
    for (const [symbol, fixture, expected] of [
      ["ZZZZ", tickerUnknownResult("ZZZZ"), "unknown_symbol"],
      ["BTCUSD", tickerUnsupportedResult("BTCUSD"), "unsupported_security_type"],
    ] as const) {
      const provider = providerWith();
      const service = serviceWith({ provider, tickerResearch: async () => fixture });
      const result = await service.ask(`What is happening with ${symbol}?`);
      expect(result.status).toBe("insufficient_grounded_data");
      expect(result.reason).toBe(expected);
      expect(result.answer).toBeNull();
      expect(result.selectedFactCount).toBe(0);
      expect(result.research?.symbol).toBeNull();
      expect(vi.mocked(provider.complete)).not.toHaveBeenCalled();
    }
  });

  it("returns unavailable when ticker research fails or throws", async () => {
    const provider = providerWith();
    const failed = serviceWith({ provider, tickerResearch: async () => tickerUnavailableResult() });
    const failedResult = await failed.ask("What is happening with NVDA?");
    expect(failedResult.status).toBe("unavailable");
    expect(failedResult.reason).toBe("ticker_research_unavailable");
    expect(vi.mocked(provider.complete)).not.toHaveBeenCalled();

    const throwing = serviceWith({
      provider,
      tickerResearch: async () => {
        throw new Error("provider exploded");
      },
    });
    const thrownResult = await throwing.ask("What is happening with NVDA?");
    expect(thrownResult.status).toBe("unavailable");
    expect(thrownResult.reason).toBe("ticker_research_unavailable");
  });

  it("asks for clarification instead of silently choosing between two tickers", async () => {
    const provider = providerWith();
    const tickerResearch = vi.fn(async () => tickerOkResult());
    const service = serviceWith({ provider, tickerResearch });

    const result = await service.ask("Compare NVDA and TSLA today");

    expect(result.status).toBe("insufficient_grounded_data");
    expect(result.reason).toBe("ambiguous_ticker");
    expect(tickerResearch).not.toHaveBeenCalled();
    expect(vi.mocked(provider.complete)).not.toHaveBeenCalled();
  });

  it("keeps the global confidence gate for global questions", async () => {
    const provider = providerWith();
    const service = serviceWith({
      provider,
      contextOverride: { ...context, inputConfidence: { score: 0.2, label: "insufficient" } },
    });

    const result = await service.ask("Is market breadth weak?");

    expect(result.status).toBe("insufficient_grounded_data");
    expect(result.reason).toBeNull();
    expect(vi.mocked(provider.complete)).not.toHaveBeenCalled();
  });

  it("still answers a verified ticker question when the global backdrop is thin", async () => {
    const provider = providerWith(JSON.stringify(validAnswer));
    const service = serviceWith({
      provider,
      contextOverride: { ...context, inputConfidence: { score: 0.2, label: "insufficient" } },
      tickerResearch: async () => tickerOkResult(),
    });

    const result = await service.ask("What is happening with NVDA today?");

    expect(result.status).toBe("generated");
    expect(result.research?.symbol).toBe("NVDA");
  });

  it("returns an honest limitation when ticker research is not wired (demo mode)", async () => {
    const provider = providerWith();
    const service = serviceWith({ provider });

    const result = await service.ask("What is happening with NVDA today?");

    expect(result.status).toBe("unavailable");
    expect(result.reason).toBe("ticker_research_unavailable");
    expect(vi.mocked(provider.complete)).not.toHaveBeenCalled();
  });
});
