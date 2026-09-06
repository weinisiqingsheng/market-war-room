import { describe, expect, it } from "vitest";
import { buildCatalystItem, matchNews } from "@/lib/catalysts/match";
import { computeCatalystWindow } from "@/lib/catalysts/time-window";
import { extractCandidateEvidence } from "@/lib/catalysts/candidate-evidence";
import type { NewsArticle } from "@/lib/catalysts/types";

const WINDOW = computeCatalystWindow("2026-09-04T20:00:00.000Z");

function art(partial: Partial<NewsArticle> & { headline: string }): NewsArticle {
  return {
    id: "c1",
    summary: "",
    source: "Reuters",
    author: null,
    createdAt: null,
    updatedAt: null,
    publishedAt: "2026-09-04T13:00:00-04:00",
    symbols: ["AAA"],
    url: "https://example.com/c",
    ...partial,
  };
}

function matchFor(ticker: string, name: string, article: NewsArticle) {
  return matchNews(ticker, name, article, WINDOW, 1);
}

describe("linked causal-complement retention", () => {
  it("1 — FICO causal 'after FHFA...' complement is retained and classifies REGULATORY / LEGAL", () => {
    const article = art({
      headline:
        "Fair Isaac is trading lower Friday after the FHFA told Fannie Mae and Freddie Mac to let all lenders use the VantageScore 4.0 credit model",
      symbols: ["FICO"],
    });
    const match = matchFor("FICO", "Fair Isaac", article);
    expect(match.category).toBe("REGULATORY / LEGAL");
    expect(match.supportingEvidence.join(" ")).toContain("FHFA");
    expect(match.supportingEvidence.join(" ")).toContain("after");
  });

  it("2 — Equifax 'as investors weigh FHFA...' complement is retained as REGULATORY / LEGAL", () => {
    const article = art({
      headline:
        "Equifax is sliding Friday as investors weigh FHFA regulatory threats against the expansion of VantageScore",
      symbols: ["EFX"],
    });
    expect(matchFor("EFX", "Equifax", article).category).toBe("REGULATORY / LEGAL");
  });

  it("3 — KLAC must NOT inherit Quanex's 'after beating earnings' complement", () => {
    const article = art({
      headline: "KLAC rose, while Quanex surged after beating earnings",
      symbols: ["KLAC", "QUAN"],
    });
    const item = buildCatalystItem({
      ticker: "KLAC",
      name: "KLA Corporation",
      movePct: 2,
      anomalyScore: 70,
      anomalySeverity: "HIGH",
      directionUp: true,
      news: [article],
      filings: [],
      actions: [],
      window: WINDOW,
    });
    expect(item.primaryCatalyst).toBeNull();
    const evidence = extractCandidateEvidence({
      ticker: "KLAC",
      companyName: "KLA Corporation",
      headline: article.headline,
      summary: article.summary,
      symbols: article.symbols,
    });
    expect(evidence.contextOnly).toBe(true);
  });

  it("4 — the same sentence classifies Quanex as EARNINGS", () => {
    const article = art({
      headline: "KLAC rose, while Quanex surged after beating earnings",
      symbols: ["KLAC", "QUAN"],
    });
    const match = matchFor("QUAN", "Quanex Building Products", article);
    expect(match.category).toBe("EARNINGS");
  });

  it("5 — FICO fell. Samsara rose after earnings: no earnings leak across sentences", () => {
    const article = art({
      headline: "FICO fell. Samsara rose after reporting earnings",
      symbols: ["FICO", "AAA"],
    });
    const match = matchFor("FICO", "Fair Isaac", article);
    expect(match.category).toBe("OTHER");
    expect(match.supportingEvidence.join(" ").toLowerCase()).not.toContain("earnings");
    expect(match.supportingEvidence.join(" ").toLowerCase()).not.toContain("samsara");
  });

  it("6 — because / due to / following / on variants all preserve causal context", () => {
    const variants = [
      "Fair Isaac is trading lower because the FHFA opened a VantageScore review",
      "Fair Isaac is trading lower due to the FHFA VantageScore decision",
      "Fair Isaac is trading lower following the FHFA VantageScore announcement",
      "Fair Isaac is trading lower on FHFA VantageScore news",
    ];
    for (const headline of variants) {
      const match = matchFor("FICO", "Fair Isaac", art({ headline, symbols: ["FICO"] }));
      expect(match.category).toBe("REGULATORY / LEGAL");
      expect(match.supportingEvidence.join(" ")).toContain("FHFA");
    }
  });

  it("7 — supporting evidence contains the linked candidate causal context", () => {
    const article = art({
      headline: "Fair Isaac is trading lower after the FHFA announced the VantageScore change",
      symbols: ["FICO"],
    });
    const evidence = extractCandidateEvidence({
      ticker: "FICO",
      companyName: "Fair Isaac",
      headline: article.headline,
      summary: article.summary,
      symbols: article.symbols,
    });
    expect(evidence.text).toContain("FHFA");
    expect(evidence.text).toContain("after");
    expect(evidence.sentences.join(" ")).toContain("FHFA");
  });
});
