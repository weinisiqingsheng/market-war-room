import { describe, expect, it, vi } from "vitest";
import { handleAskSakuraPost } from "@/lib/ask-sakura/production-service";
import type { AskSakuraService, AskServiceResult } from "@/lib/ask-sakura/service";
import type { AskTickerResearchMeta } from "@/lib/ask-sakura/ticker-research";
import type { AskSakuraAnswer } from "@/lib/ask-sakura/types";

const answer: AskSakuraAnswer = {
  version: "ask-sakura-v1",
  status: "answered",
  answer: {
    text: "NVDA's regular-session reference price was 222.27 on session 2026-09-18 ET.",
    evidenceRefs: ["ticker.NVDA.price"],
  },
  supportingPoints: [],
  limitations: [],
};

const research: AskTickerResearchMeta = {
  requestedSymbol: "NVDA",
  symbol: "NVDA",
  status: "ok",
  reason: null,
  effectiveAsOf: "2026-09-18T20:00:00.000Z",
  marketSessionAsOf: "2026-09-18",
  freshness: "delayed",
  confidence: "high",
  factCount: 12,
  researchVersion: "ticker-context-v1",
};

function result(overrides: Partial<AskServiceResult> = {}): AskServiceResult {
  return {
    mode: "live",
    status: "generated",
    contextFingerprint: "fp-ticker",
    inputConfidence: { score: 0.95, label: "high" },
    selectedFactCount: 12,
    answer,
    reason: null,
    research,
    route: "TICKER_RESEARCH",
    ...overrides,
  };
}

function serviceReturning(value: AskServiceResult | Error): AskSakuraService {
  return {
    ask: vi.fn(async () => {
      if (value instanceof Error) throw value;
      return value;
    }),
  };
}

async function post(body: unknown, value: AskServiceResult | Error) {
  return handleAskSakuraPost(JSON.stringify(body), { getService: () => serviceReturning(value) });
}

describe("POST /api/ai/ask-sakura with on-demand ticker evidence (V1.2B)", () => {
  it("keeps the request contract to a single question field", async () => {
    const response = await post({ question: "What is happening with NVDA today?" }, result());
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    const json = await response.json();
    expect(json.answer.status).toBe("answered");
    expect(json.route).toBe("TICKER_RESEARCH");
    expect(json.research).toMatchObject({
      symbol: "NVDA",
      researchVersion: "ticker-context-v1",
      marketSessionAsOf: "2026-09-18",
    });
  });

  it("rejects client attempts to inject ticker/evidence/provider fields", async () => {
    const response = await handleAskSakuraPost(
      JSON.stringify({ question: "What is happening with NVDA?", ticker: "TSLA", evidence: [] }),
      { getService: () => serviceReturning(result()) },
    );
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error.code).toBe("invalid_request");
  });

  it("exposes no raw ticker data, provider payloads or secrets", async () => {
    const response = await post({ question: "What is happening with NVDA today?" }, result());
    const text = JSON.stringify(await response.json());
    for (const forbidden of [
      '"data"',
      "previousClose",
      "APCA",
      "ALPACA",
      "apiKey",
      "systemPrompt",
    ]) {
      expect(text).not.toContain(forbidden);
    }
  });

  it("returns a 200 with a safe reason when the ticker cannot be verified", async () => {
    const response = await post(
      { question: "What is happening with ZZZZ?" },
      result({
        status: "insufficient_grounded_data",
        answer: null,
        selectedFactCount: 0,
        reason: "unknown_symbol",
        research: {
          ...research,
          requestedSymbol: "ZZZZ",
          symbol: null,
          status: "unsupported_symbol",
          reason: "unknown_symbol",
          factCount: 0,
        },
      }),
    );
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json).toMatchObject({ status: "insufficient_grounded_data", reason: "unknown_symbol" });
    expect(json.answer).toBeNull();
  });

  it("returns 503 when ticker research is unavailable and never a demo answer", async () => {
    const response = await post(
      { question: "What is happening with NVDA?" },
      result({
        status: "unavailable",
        answer: null,
        selectedFactCount: 0,
        reason: "ticker_research_unavailable",
        research: null,
      }),
    );
    expect(response.status).toBe(503);
    const json = await response.json();
    expect(json.status).toBe("unavailable");
    expect(json.answer).toBeNull();
    expect(JSON.stringify(json)).not.toContain("ticker.NVDA");
  });
});
