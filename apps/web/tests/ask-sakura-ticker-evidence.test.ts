import { describe, expect, it } from "vitest";
import { buildDemoBriefContext } from "@/lib/ai-brief/demo-context";
import {
  TICKER_ASK_PACK_LIMITS,
  composeTickerAskEvidence,
  toAskTickerFacts,
} from "@/lib/ask-sakura/ticker-evidence";
import type { TickerEvidenceFact } from "@/lib/ticker-context/types";
import { tickerContextFixture } from "./helpers/ticker-ask-fixtures";

const globalContext = buildDemoBriefContext();

describe("Ask ticker evidence composition (V1.2B)", () => {
  it("includes every ticker fact with stable ids and preserved metadata", () => {
    const ticker = tickerContextFixture();
    const { selection, composition } = composeTickerAskEvidence({ globalContext, ticker });
    const ids = selection.selectedFactIds;

    expect(ids.slice(0, ticker.facts.length)).toEqual(ticker.facts.map((fact) => fact.id));
    expect(ids).toContain("ticker.NVDA.identity");
    expect(ids).toContain("ticker.NVDA.price");
    expect(ids).toContain("ticker.NVDA.volume");
    expect(ids).toContain("ticker.NVDA.sector");
    expect(ids).toContain("ticker.NVDA.news.1");
    expect(ids).toContain("ticker.NVDA.catalyst");
    expect(composition.tickerFactCount).toBe(ticker.facts.length);
    expect(composition.backdropOmitted).toBe(false);
    expect(selection.selectionMode).toBe("ticker_scoped");
    expect(selection.detectedTickers).toEqual(["NVDA"]);

    const price = selection.facts.find((fact) => fact.id === "ticker.NVDA.price")!;
    const source = ticker.facts.find((fact) => fact.id === "ticker.NVDA.price")!;
    expect(price.asOf).toBe(source.asOf);
    expect(price.freshness).toBe(source.freshness);
    expect(price.confidence).toBe(source.confidence);
    expect(price.sourceVersion).toBe(source.sourceVersion);
    expect(price.text).toBe(source.text);
  });

  it("adds a deterministic compact global backdrop", () => {
    const { selection, composition } = composeTickerAskEvidence({
      globalContext,
      ticker: tickerContextFixture(),
    });
    const ids = selection.selectedFactIds;
    const backdrop = ids.filter((id) => !id.startsWith("ticker."));

    expect(backdrop).toContain("market.spy");
    expect(backdrop).toContain("market.qqq");
    expect(backdrop).toContain("sector.xlk");
    expect(backdrop.length).toBeGreaterThan(0);
    expect(backdrop.length).toBeLessThanOrEqual(TICKER_ASK_PACK_LIMITS.backdropMax);
    expect(composition.backdropFactCount).toBe(backdrop.length);
    expect(ids.length).toBeLessThanOrEqual(TICKER_ASK_PACK_LIMITS.totalMax);
    // Deterministic order: ticker facts first, then the backdrop.
    const firstBackdropIndex = ids.findIndex((id) => !id.startsWith("ticker."));
    expect(firstBackdropIndex).toBe(composition.tickerFactCount);
  });

  it("excludes unrelated tickers' anomalies and catalysts", () => {
    const { selection } = composeTickerAskEvidence({
      globalContext,
      ticker: tickerContextFixture(),
    });
    const ids = selection.selectedFactIds;
    expect(ids.some((id) => id.startsWith("catalyst.LULU"))).toBe(false);
    expect(ids.some((id) => id.startsWith("catalyst.FICO"))).toBe(false);
    expect(ids.some((id) => id === "anomaly.LULU")).toBe(false);
    expect(ids.some((id) => id === "anomaly.KLAC")).toBe(false);
  });

  it("never fabricates an anomaly-v1 fact for the researched ticker", () => {
    const { selection } = composeTickerAskEvidence({
      globalContext,
      ticker: tickerContextFixture(),
    });
    expect(selection.selectedFactIds).not.toContain("anomaly.NVDA");
    expect(selection.selectedFactIds).not.toContain("catalyst.NVDA.primary");
    expect(selection.selectedFactIds).not.toContain("catalyst.NVDA.none");
  });

  it("keeps the model-facing projection free of internal data", () => {
    const { selection } = composeTickerAskEvidence({
      globalContext,
      ticker: tickerContextFixture(),
    });
    for (const fact of selection.safeFacts) {
      expect(Object.keys(fact)).not.toContain("data");
    }
    expect(JSON.stringify(selection.safeFacts)).not.toContain("previousClose");
  });

  it("never drops ticker facts when they fill the budget", () => {
    const manyFacts: TickerEvidenceFact[] = Array.from({ length: 30 }, (_, index) => ({
      id: `ticker.NVDA.news.${index + 1}`,
      domain: "news",
      text: `NVDA news item ${index + 1}.`,
      data: { symbol: "NVDA" },
      asOf: "2026-09-18T19:00:00.000Z",
      freshness: "delayed",
      confidence: null,
      sourceVersion: "alpaca-news-v1",
    }));
    const { selection, composition } = composeTickerAskEvidence({
      globalContext,
      ticker: tickerContextFixture({ facts: manyFacts }),
    });
    expect(composition.tickerFactCount).toBe(30);
    expect(composition.backdropFactCount).toBe(0);
    expect(composition.backdropOmitted).toBe(true);
    expect(selection.selectedFactIds).toHaveLength(30);
  });

  it("maps ticker facts verbatim and is deterministic", () => {
    const facts = tickerContextFixture().facts;
    expect(toAskTickerFacts(facts)[1]).toEqual(facts[1]);
    const first = composeTickerAskEvidence({ globalContext, ticker: tickerContextFixture() });
    const second = composeTickerAskEvidence({ globalContext, ticker: tickerContextFixture() });
    expect(second.selection.selectedFactIds).toEqual(first.selection.selectedFactIds);
    expect(second.selection.safeFacts).toEqual(first.selection.safeFacts);
  });
});
