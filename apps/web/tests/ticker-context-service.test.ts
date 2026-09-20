import { describe, expect, it, vi } from "vitest";
import type { AlpacaBreadthBar, AlpacaBreadthSnapshot } from "@/lib/breadth/normalize";
import type { NewsArticle } from "@/lib/catalysts/types";
import { projectTickerContext } from "@/lib/ticker-context/api-types";
import { researchTicker, type TickerResearchDeps } from "@/lib/ticker-context/service";

/** Friday 2026-09-18, 17:00 ET — regular session closed. */
const FRIDAY_CLOSE_MS = Date.parse("2026-09-18T21:00:00.000Z");
/** Saturday 2026-09-19, 08:00 ET — weekend request. */
const SATURDAY_MS = Date.parse("2026-09-19T12:00:00.000Z");
/** Friday 2026-09-18, 10:00 ET — regular session open. */
const FRIDAY_OPEN_MS = Date.parse("2026-09-18T14:00:00.000Z");

const SNAPSHOT: AlpacaBreadthSnapshot = {
  dailyBar: { t: "2026-09-18T20:00:00.000Z", o: 103, h: 105, l: 102, c: 104, v: 12_000_000 },
  prevDailyBar: { t: "2026-09-17T20:00:00.000Z", c: 100, v: 9_000_000 },
  latestTrade: { t: "2026-09-18T20:00:00.000Z", p: 104 },
};

const BENCHMARK: AlpacaBreadthSnapshot = {
  dailyBar: { t: "2026-09-18T20:00:00.000Z", c: 220, v: 40_000_000 },
  prevDailyBar: { t: "2026-09-17T20:00:00.000Z", c: 218, v: 38_000_000 },
  latestTrade: { t: "2026-09-18T20:00:00.000Z", p: 220 },
};

function buildBars(count = 30): AlpacaBreadthBar[] {
  const bars: AlpacaBreadthBar[] = [];
  for (let index = 0; index < count; index += 1) {
    const timestamp = new Date(
      Date.parse("2026-09-17T20:00:00.000Z") - index * 86_400_000,
    ).toISOString();
    const close = 100 + (index % 5);
    bars.push({
      t: timestamp,
      o: close - 0.5,
      h: close + 1,
      l: close - 1.5,
      c: close,
      v: 1_000_000 + index * 10_000,
    });
  }
  return bars;
}

function article(overrides: Partial<NewsArticle>): NewsArticle {
  return {
    id: "news-1",
    headline: "NVIDIA announces a new platform",
    summary: "",
    source: "TestWire",
    author: null,
    createdAt: null,
    updatedAt: null,
    publishedAt: "2026-09-18T19:00:00.000Z",
    symbols: ["NVDA"],
    url: "https://example.test/news-1",
    ...overrides,
  };
}

function makeDeps(overrides: Partial<TickerResearchDeps> = {}): TickerResearchDeps {
  return {
    mode: "live",
    now: () => FRIDAY_CLOSE_MS,
    lookupAsset: async (providerSymbol) =>
      providerSymbol === "NVDA"
        ? {
            ok: true,
            asset: {
              symbol: "NVDA",
              name: "NVIDIA Corporation",
              exchange: "NASDAQ",
              class: "us_equity",
              status: "active",
              tradable: true,
            },
          }
        : { ok: false, reason: "not_found" },
    fetchClock: async () => ({ isOpen: false, timestamp: "2026-09-18T21:00:00.000Z" }),
    fetchSnapshots: async () => ({ NVDA: SNAPSHOT, XLK: BENCHMARK }),
    fetchBars: async () => buildBars(),
    resolveSector: () => ({
      sector: "Information Technology",
      benchmarkEtf: "XLK",
      classificationSource: "sp500-v1",
    }),
    fetchNews: async () => ({ articles: [], ok: true }),
    resolveCik: async () => "0001045810",
    fetchFilings: async () => ({ filings: [], ok: true }),
    fetchActions: async () => ({ actions: [], ok: true }),
    ...overrides,
  };
}

function factIds(result: Awaited<ReturnType<typeof researchTicker>>): string[] {
  if (
    result.status !== "ok" &&
    result.status !== "partial" &&
    result.status !== "insufficient_data"
  ) {
    throw new Error(`unexpected status ${result.status}`);
  }
  return result.context.facts.map((fact) => fact.id);
}

describe("on-demand ticker research service (V1.2A)", () => {
  it("returns complete evidence for a supported symbol outside the anomaly Top 8", async () => {
    const result = await researchTicker("nvda", makeDeps());
    expect(result.status).toBe("ok");
    if (result.status !== "ok") throw new Error("expected ok");
    const context = result.context;
    expect(context.symbol).toBe("NVDA");
    expect(context.requestedSymbol).toBe("NVDA");
    expect(context.identity.name).toBe("NVIDIA Corporation");
    expect(context.session).toEqual({
      marketOpen: false,
      phase: "closed",
      sessionDate: "2026-09-18",
    });
    expect(context.availability).toMatchObject({
      price: true,
      history: true,
      volume: true,
      volatility: true,
      sector: true,
      news: true,
      sec: true,
      corporateActions: true,
    });
    expect(context.confidence.label).toBe("high");
    expect(context.fingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(factIds(result)).toEqual([
      "ticker.NVDA.identity",
      "ticker.NVDA.price",
      "ticker.NVDA.volume",
      "ticker.NVDA.volatility",
      "ticker.NVDA.range",
      "ticker.NVDA.sector",
      "ticker.NVDA.catalyst",
    ]);
    const price = context.facts.find((fact) => fact.id === "ticker.NVDA.price")!;
    expect(price.text).toContain("delayed SIP 15 minutes");
    expect(price.text).toContain("after-hours prints are never used");
    expect(price.freshness).toBe("delayed");
  });

  it("keeps the weekend reference price on the last session instead of calling it today", async () => {
    const result = await researchTicker("NVDA", makeDeps({ now: () => SATURDAY_MS }));
    if (result.status !== "ok") throw new Error("expected ok");
    const price = result.context.facts.find((fact) => fact.id === "ticker.NVDA.price")!;
    expect(price.text).toContain("session 2026-09-18 ET");
    expect(price.text).not.toContain("2026-09-19");
    expect(result.context.marketSessionAsOf).toBe("2026-09-18");
  });

  it("labels a partial in-session volume distinctly from a completed session", async () => {
    const result = await researchTicker(
      "NVDA",
      makeDeps({
        now: () => FRIDAY_OPEN_MS,
        fetchClock: async () => ({ isOpen: true, timestamp: "2026-09-18T14:00:00.000Z" }),
        fetchSnapshots: async () => ({
          NVDA: { ...SNAPSHOT, dailyBar: { ...SNAPSHOT.dailyBar!, v: 4_000_000 } },
          XLK: BENCHMARK,
        }),
      }),
    );
    if (result.status !== "ok") throw new Error("expected ok");
    const volume = result.context.facts.find((fact) => fact.id === "ticker.NVDA.volume")!;
    expect(volume.text).toContain("partial in-session volume");
    expect(volume.text).toContain("not a comparable multiple");
    expect(result.context.session.phase).toBe("regular");
  });

  it("omits price evidence when the previous close is missing — never fabricates a price", async () => {
    const result = await researchTicker(
      "NVDA",
      makeDeps({
        fetchSnapshots: async () => ({
          NVDA: { dailyBar: SNAPSHOT.dailyBar, latestTrade: SNAPSHOT.latestTrade },
          XLK: BENCHMARK,
        }),
      }),
    );
    expect(result.status).toBe("partial");
    expect(factIds(result)).not.toContain("ticker.NVDA.price");
    if (result.status === "partial") expect(result.context.availability.price).toBe(false);
  });

  it("does not invent volatility when historical bars are insufficient", async () => {
    const result = await researchTicker("NVDA", makeDeps({ fetchBars: async () => buildBars(3) }));
    expect(result.status).toBe("partial");
    expect(factIds(result)).not.toContain("ticker.NVDA.volatility");
    if (result.status === "partial") {
      expect(result.context.availability.history).toBe(false);
      expect(result.context.availability.volatility).toBe(false);
    }
  });

  it("fails closed for unknown symbols, unsupported types and malformed input", async () => {
    const unknown = await researchTicker("ZZZZ", makeDeps());
    expect(unknown).toMatchObject({
      status: "unsupported_symbol",
      reason: "unknown_symbol",
      requestedSymbol: "ZZZZ",
    });

    const unsupported = await researchTicker(
      "BTCUSD",
      makeDeps({
        lookupAsset: async () => ({
          ok: true,
          asset: {
            symbol: "BTCUSD",
            name: "Bitcoin",
            class: "crypto",
            status: "active",
            tradable: true,
          },
        }),
      }),
    );
    expect(unsupported).toMatchObject({
      status: "unsupported_symbol",
      reason: "unsupported_security_type",
    });

    const malformed = await researchTicker("NV DA", makeDeps());
    expect(malformed).toMatchObject({ status: "unsupported_symbol", reason: "unknown_symbol" });
  });

  it("never substitutes another company's evidence for an ambiguous directory response", async () => {
    const result = await researchTicker(
      "NVDA",
      makeDeps({
        lookupAsset: async () => ({
          ok: true,
          asset: {
            symbol: "MSFT",
            name: "Microsoft Corporation",
            exchange: "NASDAQ",
            class: "us_equity",
            status: "active",
            tradable: true,
          },
        }),
      }),
    );
    expect(result).toMatchObject({
      status: "unavailable",
      reason: "provider_unavailable",
      requestedSymbol: "NVDA",
    });
  });

  it("reports unavailable when the security directory itself is down", async () => {
    const result = await researchTicker(
      "NVDA",
      makeDeps({
        lookupAsset: async () => {
          throw new Error("network down");
        },
      }),
    );
    expect(result).toMatchObject({ status: "unavailable", reason: "provider_unavailable" });
  });

  it("never fabricates demo values and never calls providers in demo mode", async () => {
    const lookupAsset = vi.fn();
    const fetchSnapshots = vi.fn();
    const result = await researchTicker("NVDA", {
      ...makeDeps(),
      mode: "demo",
      lookupAsset: lookupAsset as unknown as TickerResearchDeps["lookupAsset"],
      fetchSnapshots: fetchSnapshots as unknown as TickerResearchDeps["fetchSnapshots"],
    });
    expect(result).toMatchObject({
      status: "unavailable",
      reason: "live_data_required",
      mode: "demo",
    });
    expect(lookupAsset).not.toHaveBeenCalled();
    expect(fetchSnapshots).not.toHaveBeenCalled();
  });

  it("uses the session-close instant (not the raw bar stamp) for closed markets", async () => {
    // Alpaca daily bars are stamped at session start (04:00Z); the price
    // instant for a closed session is that session's 16:00 ET close.
    const result = await researchTicker(
      "NVDA",
      makeDeps({
        fetchSnapshots: async () => ({
          NVDA: { ...SNAPSHOT, dailyBar: { ...SNAPSHOT.dailyBar!, t: "2026-09-18T04:00:00.000Z" } },
          XLK: BENCHMARK,
        }),
        fetchNews: async () => ({
          ok: true,
          articles: [
            article({
              id: "same-session",
              publishedAt: "2026-09-18T13:00:00.000Z",
              headline: "NVIDIA news during the regular session",
            }),
          ],
        }),
      }),
    );
    if (result.status !== "ok") throw new Error("expected ok");
    expect(result.context.effectiveAsOf).toBe("2026-09-18T20:00:00.000Z");
    expect(result.context.marketSessionAsOf).toBe("2026-09-18");
    // Same-session news is inside the window and therefore usable evidence.
    expect(factIds(result)).toContain("ticker.NVDA.news.1");
  });

  it("excludes unrelated-company news and post-cutoff events from the evidence window", async () => {
    const result = await researchTicker(
      "NVDA",
      makeDeps({
        fetchNews: async () => ({
          ok: true,
          articles: [
            article({ id: "other", symbols: ["AAPL"], headline: "Apple ships a device" }),
            article({
              id: "future",
              publishedAt: "2026-09-18T22:00:00.000Z",
              headline: "NVIDIA news after the price cutoff",
            }),
          ],
        }),
      }),
    );
    if (result.status !== "ok") throw new Error("expected ok");
    expect(factIds(result).some((id) => id.startsWith("ticker.NVDA.news"))).toBe(false);
    const catalyst = result.context.facts.find((fact) => fact.id === "ticker.NVDA.catalyst")!;
    expect(catalyst.text).toContain("No clear company-specific catalyst identified");
    expect(catalyst.data.status).toBe("none");
  });

  it("keeps company-specific news as unpromoted contextual evidence", async () => {
    const result = await researchTicker(
      "NVDA",
      makeDeps({ fetchNews: async () => ({ ok: true, articles: [article({})] }) }),
    );
    if (result.status !== "ok") throw new Error("expected ok");
    const news = result.context.facts.find((fact) => fact.id === "ticker.NVDA.news.1")!;
    expect(news.text).toContain("not a proven cause of the price move");
    expect(news.text).toContain("NVIDIA announces a new platform");
    expect(news.confidence).toBeNull();
    const catalyst = result.context.facts.find((fact) => fact.id === "ticker.NVDA.catalyst")!;
    expect(catalyst.text).toContain("Unpromoted company-specific candidate events");
    expect(catalyst.text).not.toMatch(/strong (catalyst|evidence)/i);
  });

  it("labels multi-symbol roundup mentions as contextual media, not company news", async () => {
    const result = await researchTicker(
      "NVDA",
      makeDeps({
        fetchNews: async () => ({
          ok: true,
          articles: [
            article({
              id: "roundup",
              symbols: ["NVDA", "AAPL"],
              headline: "NVDA, AAPL among the top premarket movers",
              summary: "Both stocks traded higher before the bell.",
            }),
          ],
        }),
      }),
    );
    if (result.status !== "ok") throw new Error("expected ok");
    const news = result.context.facts.find((fact) => fact.id === "ticker.NVDA.news.1")!;
    expect(news.text).toContain("contextual media mention");
    expect(news.text).not.toContain("company-specific news");
    expect(news.text).toContain("not a proven cause of the price move");
  });

  it("degrades safely when SEC filings are unavailable but price data works", async () => {
    const result = await researchTicker(
      "NVDA",
      makeDeps({ fetchFilings: async () => ({ filings: [], ok: false }) }),
    );
    expect(result.status).toBe("partial");
    expect(factIds(result)).not.toContain("ticker.NVDA.sec.1");
    if (result.status === "partial") {
      expect(result.context.availability.sec).toBe(false);
      expect(result.context.availability.price).toBe(true);
    }
  });

  it("is deterministic and changes the fingerprint only with material data", async () => {
    const first = await researchTicker("NVDA", makeDeps());
    const second = await researchTicker("NVDA", makeDeps());
    if (first.status !== "ok" || second.status !== "ok") throw new Error("expected ok");
    expect(second.context.fingerprint).toBe(first.context.fingerprint);

    const changed = await researchTicker(
      "NVDA",
      makeDeps({
        fetchSnapshots: async () => ({
          NVDA: { ...SNAPSHOT, dailyBar: { ...SNAPSHOT.dailyBar!, c: 111 } },
          XLK: BENCHMARK,
        }),
      }),
    );
    if (changed.status !== "ok") throw new Error("expected ok");
    expect(changed.context.fingerprint).not.toBe(first.context.fingerprint);
  });

  it("distinguishes request/generation instants from market-data instants", async () => {
    const result = await researchTicker("NVDA", makeDeps());
    if (result.status !== "ok") throw new Error("expected ok");
    expect(result.context.requestedAt).toBe("2026-09-18T21:00:00.000Z");
    expect(result.context.generatedAt).toBe(result.context.requestedAt);
    expect(result.context.effectiveAsOf).toBe("2026-09-18T20:00:00.000Z");
    expect(result.context.marketSessionAsOf).toBe("2026-09-18");
    expect(result.context.providerAsOf).toBe("2026-09-18T20:00:00.000Z");
  });

  it("exposes no internal fact data or raw provider payload in the public projection", async () => {
    const result = await researchTicker(
      "NVDA",
      makeDeps({ fetchNews: async () => ({ ok: true, articles: [article({})] }) }),
    );
    if (result.status !== "ok") throw new Error("expected ok");
    const projection = projectTickerContext(result.context);
    for (const fact of projection.facts) {
      expect(Object.keys(fact).sort()).toEqual(
        ["asOf", "confidence", "domain", "freshness", "id", "sourceVersion", "text"].sort(),
      );
    }
    const serialized = JSON.stringify(projection);
    expect(serialized).not.toContain("prevDailyBar");
    expect(serialized).not.toContain("APCA");
    expect(serialized).not.toContain('"data"');
    expect(projection.factCount).toBe(projection.facts.length);
  });

  it("produces no prediction, recommendation or trading language in any fact", async () => {
    const result = await researchTicker(
      "NVDA",
      makeDeps({ fetchNews: async () => ({ ok: true, articles: [article({})] }) }),
    );
    if (result.status !== "ok") throw new Error("expected ok");
    const forbidden =
      /\b(buy|sell|short|forecast|price target|recommendation|recommend|will rise|will fall|portfolio)\b/i;
    for (const fact of result.context.facts) expect(fact.text).not.toMatch(forbidden);
    expect(result.context.facts.some((fact) => fact.text.includes("not an anomaly-v1 score"))).toBe(
      true,
    );
    expect(result.context.facts.some((fact) => fact.text.includes("not a proven cause"))).toBe(
      true,
    );
  });
});
