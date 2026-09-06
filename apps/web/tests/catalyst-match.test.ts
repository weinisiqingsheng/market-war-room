import { describe, expect, it } from "vitest";
import { classifyNews, classifyPolarity, secFormLabel } from "@/lib/catalysts/taxonomy";
import { computeCatalystWindow, inCatalystWindow, previousWeekdayDateKey } from "@/lib/catalysts/time-window";
import { alignPolarity, buildCatalystItem, dedupeArticles, evidenceStrength, relevanceScore, symbolSpecificity, temporalScore } from "@/lib/catalysts/match";
import type { NewsArticle } from "@/lib/catalysts/types";

function news(partial: Partial<NewsArticle> & { id: string; headline: string }): NewsArticle {
  return {
    summary: "",
    source: "Reuters",
    author: null,
    createdAt: null,
    updatedAt: null,
    publishedAt: "2026-06-08T14:00:00-04:00",
    symbols: ["AAA"],
    url: "https://example.com/x",
    ...partial,
  };
}

describe("catalyst time window", () => {
  // Friday 2026-09-04 regular-session anomaly (query ran Saturday/Sunday).
  // effectiveAsOf = Friday 4:00 PM ET = 2026-09-04T20:00:00.000Z
  const window = computeCatalystWindow("2026-09-04T20:00:00.000Z");

  it("starts at the Thursday close for a completed Friday session", () => {
    expect(window.startIso).toBe("2026-09-03T20:00:00.000Z");
    expect(window.cutoffIso).toBe("2026-09-04T20:00:00.000Z");
    expect(window.currentSessionDate).toBe("2026-09-04");
  });

  it("included evidence: Thursday after-close, Friday premarket, Friday intraday", () => {
    expect(inCatalystWindow("2026-09-03T20:05:00.000Z", window)).toBe(true); // Thu after-close earnings
    expect(inCatalystWindow("2026-09-04T12:28:00.000Z", window)).toBe(true); // Fri 8:28 AM ET
    expect(inCatalystWindow("2026-09-04T16:19:00.000Z", window)).toBe(true); // Fri 12:19 PM ET
    expect(inCatalystWindow("2026-09-04T19:47:00.000Z", window)).toBe(true); // Fri 3:47 PM ET
  });

  it("excluded evidence: after-the-move recaps, Saturday, one second past cutoff", () => {
    expect(inCatalystWindow("2026-09-05T02:40:00.000Z", window)).toBe(false); // Fri 10:40 PM ET recap
    expect(inCatalystWindow("2026-09-05T17:00:00.000Z", window)).toBe(false); // Saturday
    expect(inCatalystWindow("2026-09-04T20:00:01.000Z", window)).toBe(false); // 1s after
  });

  it("is inclusive exactly at the effective close boundary", () => {
    expect(inCatalystWindow("2026-09-04T20:00:00.000Z", window)).toBe(true);
  });


  it("real-case regressions keep post-move recaps out but allow same-day company evidence", () => {
    // LULU Friday −17%: a 10:40 PM recap must never qualify for the Friday move.
    expect(inCatalystWindow("2026-09-05T02:40:00.000Z", window)).toBe(false);
    // FICO: Friday 12:19 PM company-specific article may qualify.
    expect(inCatalystWindow("2026-09-04T16:19:00.000Z", window)).toBe(true);
    // SNDK: Friday 8:28 AM company evidence qualifies; Saturday evidence does not.
    expect(inCatalystWindow("2026-09-04T12:28:00.000Z", window)).toBe(true);
    expect(inCatalystWindow("2026-09-05T14:00:00.000Z", window)).toBe(false);
  });

  it("exposes the weekday-walk helper for weekend/holiday fallback", () => {
    expect(previousWeekdayDateKey("2026-09-04")).toBe("2026-09-03");
    expect(previousWeekdayDateKey("2026-09-07")).toBe("2026-09-04");
  });
});

describe("catalyst classification", () => {
  it("classifies core categories deterministically", () => {
    expect(classifyNews("reports Q2 earnings, revenue up")).toBe("EARNINGS");
    expect(classifyNews("raises guidance for the year")).toBe("GUIDANCE");
    expect(classifyNews("analyst downgrades, cuts price target")).toBe("ANALYST ACTION");
    expect(classifyNews("announces acquisition of rival")).toBe("M&A / STRATEGIC");
    expect(classifyNews("FDA approval for new drug")).toBe("REGULATORY / LEGAL");
    expect(classifyNews("$1B convertible offering")).toBe("FINANCING / OFFERING");
    expect(classifyNews("buyback and dividend")).toBe("CAPITAL RETURN");
    expect(classifyNews("wins multi-year contract")).toBe("PRODUCT / CONTRACT");
    expect(classifyNews("CEO steps down")).toBe("MANAGEMENT");
    expect(classifyNews("hosts investor day")).toBe("OTHER");
  });
  it("applies precedence and labels SEC forms", () => {
    expect(classifyNews("analyst downgrades after product launch")).toBe("ANALYST ACTION");
    expect(secFormLabel("8-K")).toBe("MATERIAL FILING");
    expect(secFormLabel("10-Q")).toBe("PERIODIC REPORT");
    expect(secFormLabel("424B5")).toBe("FINANCING / OFFERING");
    expect(secFormLabel("4")).toBe("INSIDER FILING");
  });
});

describe("catalyst polarity", () => {
  it("assigns polarity only for explicit language", () => {
    expect(classifyPolarity("upgraded shares")).toBe("positive");
    expect(classifyPolarity("downgraded shares")).toBe("negative");
    expect(classifyPolarity("raises guidance")).toBe("positive");
    expect(classifyPolarity("cuts outlook")).toBe("negative");
    expect(classifyPolarity("FDA approves")).toBe("positive");
    expect(classifyPolarity("FDA rejects")).toBe("negative");
    expect(classifyPolarity("hosts a launch")).toBe("unknown");
  });
});


describe("catalyst matching", () => {
  const window = computeCatalystWindow("2026-06-08T15:00:00-04:00");

  it("dedupes by id and normalized headline fallback", () => {
    const items = dedupeArticles([
      news({ id: "1", headline: "Same story" }),
      news({ id: "1", headline: "Same story revised" }),
      news({ id: "2", headline: "  Another   Story! " }),
      news({ id: "", headline: "Another Story", url: "https://x.test/dup" }),
    ]);
    expect(items).toHaveLength(3);
  });

  it("scores symbol specificity and caps temporal windows", () => {
    expect(symbolSpecificity(["AAA"], "AAA")).toBe(100);
    expect(symbolSpecificity(["AAA", "BBB", "CCC"], "AAA")).toBe(75);
    expect(temporalScore("2026-06-08T13:30:00-04:00", window)).toBe(100);
    expect(temporalScore("2026-06-05T22:00:00Z", window)).toBe(55);
  });

  it("maps evidence-strength thresholds and dimension weights", () => {
    expect(evidenceStrength(90)).toBe("strong");
    expect(evidenceStrength(70)).toBe("moderate");
    expect(evidenceStrength(55)).toBe("weak");
    expect(relevanceScore({ specificity: 100, temporal: 100, materiality: 100, corroboration: 80 })).toBe(96);
  });

  it("builds a strong aligned MATCHED item for a specific earnings story", () => {
    const item = buildCatalystItem({
      ticker: "AAA",
      name: "A Corp",
      movePct: -12.4,
      anomalyScore: 90,
      anomalySeverity: "EXTREME",
      directionUp: false,
      news: [news({ id: "n1", headline: "AAA misses earnings badly", summary: "EPS miss", symbols: ["AAA"], publishedAt: "2026-06-08T13:30:00-04:00" })],
      filings: [],
      actions: [],
      window,
    });
    expect(item.status).toBe("MATCHED");
    expect(item.primaryCatalyst?.category).toBe("EARNINGS");
    expect(item.primaryCatalyst?.evidenceStrength).toBe("strong");
    // No explicit polarity in the headline → directional alignment stays unknown.
    expect(item.alignment).toBe("unknown");
  });

  it("returns NO CLEAR CATALYST when evidence is weak", () => {
    const item = buildCatalystItem({
      ticker: "AAA",
      name: "A Corp",
      movePct: 5.1,
      anomalyScore: 62,
      anomalySeverity: "ELEVATED",
      directionUp: true,
      news: [news({ id: "w1", headline: "AAA hosts a boring event", summary: "", symbols: ["AAA", "BBB", "CCC", "DDD", "EEE"], publishedAt: "2026-06-05T23:00:00Z" })],
      filings: [],
      actions: [],
      window,
    });
    expect(item.status).toBe("NO CLEAR CATALYST FOUND");
    expect(item.primaryCatalyst).toBeNull();
  });

  it("aligns explicit polarity with price direction informationally", () => {
    expect(alignPolarity(true, "positive")).toBe("aligned");
    expect(alignPolarity(true, "negative")).toBe("divergent");
    expect(alignPolarity(false, "negative")).toBe("aligned");
    expect(alignPolarity(false, "unknown")).toBe("unknown");
  });

  it("five copies of one source do not fabricate corroboration", () => {
    const copies = Array.from({ length: 5 }, (_, i) =>
      news({ id: `c${i}`, headline: "AAA guides lower", source: "Reuters", publishedAt: "2026-06-08T13:00:00-04:00" }),
    );
    const item = buildCatalystItem({
      ticker: "AAA",
      name: "A Corp",
      movePct: -6,
      anomalyScore: 78,
      anomalySeverity: "HIGH",
      directionUp: false,
      news: copies,
      filings: [],
      actions: [],
      window,
    });
    expect(item.evidence.newsCount).toBe(5);
    expect(item.primaryCatalyst?.sourceType).toBe("news");
  });
});
