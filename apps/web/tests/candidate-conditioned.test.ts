import { describe, expect, it } from "vitest";
import { buildCatalystItem, matchNews } from "@/lib/catalysts/match";
import { computeCatalystWindow, inCatalystWindow } from "@/lib/catalysts/time-window";
import { extractCandidateEvidence } from "@/lib/catalysts/candidate-evidence";
import type { NewsArticle } from "@/lib/catalysts/types";

const WINDOW = computeCatalystWindow("2026-09-04T20:00:00.000Z");

function art(partial: Partial<NewsArticle> & { headline: string }): NewsArticle {
  return {
    id: "x1",
    summary: "",
    source: "Reuters",
    author: null,
    createdAt: null,
    updatedAt: null,
    publishedAt: "2026-09-04T14:00:00-04:00",
    symbols: ["AAA"],
    url: "https://example.com/x",
    ...partial,
  };
}

function itemFor(ticker: string, name: string, article: NewsArticle) {
  return buildCatalystItem({
    ticker,
    name,
    movePct: -6,
    anomalyScore: 80,
    anomalySeverity: "HIGH",
    directionUp: false,
    news: [article],
    filings: [],
    actions: [],
    window: WINDOW,
  });
}

describe("candidate-conditioned catalyst classification", () => {
  it("1/6 — KLAC in a movers roundup never inherits Quanex EARNINGS", () => {
    const article = art({
      headline: "Quanex beats earnings estimates",
      summary: "KLAC was among several stocks moving higher",
      symbols: ["QUAN", "KLAC", "AAA", "BBB", "CCC", "DDD", "EEE", "FFF"],
    });
    const item = itemFor("KLAC", "KLA Corporation", article);
    expect(item.primaryCatalyst).toBeNull();
    expect(item.status).toBe("NO CLEAR CATALYST FOUND");
    const match = matchNews("KLAC", "KLA Corporation", article, WINDOW, 1);
    expect(match.category).toBe("OTHER");
    expect(match.supportingEvidence).toEqual([]);
  });

  it("2 — the same article still classifies Quanex as EARNINGS", () => {
    const article = art({
      headline: "Quanex beats earnings estimates, shares jump",
      summary: "KLAC was among several stocks moving higher",
      symbols: ["QUAN", "KLAC", "AAA", "BBB", "CCC"],
    });
    const item = itemFor("QUAN", "Quanex Building Products", article);
    expect(item.primaryCatalyst?.category).toBe("EARNINGS");
    expect(item.status).toBe("MATCHED");
  });

  it("3 — a later candidate-specific sentence drives that candidate's category", () => {
    const article = art({
      headline: "Samsara beats quarterly earnings",
      summary: "XYZ Corp wins a new multi-year defense contract",
      symbols: ["AAA", "BBB"],
    });
    const forB = itemFor("BBB", "XYZ Corp", article);
    expect(forB.primaryCatalyst?.category).toBe("PRODUCT / CONTRACT");
    const forA = itemFor("AAA", "Samsara", article);
    expect(forA.primaryCatalyst?.category).toBe("EARNINGS");
  });

  it("4 — ADBE CEO appointment classifies MANAGEMENT, not GUIDANCE", () => {
    const article = art({
      headline: "Adobe names Anil Chakravarthy as new CEO",
      summary: "Longtime CFO steps down as part of the transition",
      symbols: ["ADBE"],
    });
    const item = itemFor("ADBE", "Adobe Inc.", article);
    expect(item.primaryCatalyst?.category).toBe("MANAGEMENT");
  });

  it("5 — FICO FHFA/VantageScore regulatory story classifies REGULATORY / LEGAL", () => {
    const article = art({
      headline: "FICO jumps on FHFA plan to allow VantageScore",
      summary: "Regulator seeks comments on the new approval framework",
      symbols: ["FICO"],
    });
    const item = itemFor("FICO", "Fair Isaac", article);
    expect(item.primaryCatalyst?.category).toBe("REGULATORY / LEGAL");
  });

  it("7 — supporting evidence excludes unrelated-company sentences", () => {
    const article = art({
      headline: "Quanex beats earnings estimates",
      summary: "SNDK rises on memory demand while KLAC traded higher",
      symbols: ["QUAN", "SNDK", "KLAC"],
    });
    const evidence = extractCandidateEvidence({
      ticker: "KLAC",
      companyName: "KLA Corporation",
      headline: article.headline,
      summary: article.summary,
      symbols: article.symbols,
    });
    expect(evidence.contextOnly).toBe(true);
    expect(evidence.text.toLowerCase()).not.toContain("quanex");
  });

  it("9/10 — temporal semantics and cutoffs remain untouched", () => {
    expect(inCatalystWindow("2026-09-05T02:40:00.000Z", WINDOW)).toBe(false);
    expect(inCatalystWindow("2026-09-04T20:00:00.000Z", WINDOW)).toBe(true);
  });
});
