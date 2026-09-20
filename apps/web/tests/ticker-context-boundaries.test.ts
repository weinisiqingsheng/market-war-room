import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const read = (rel: string) => readFileSync(resolve(rel), "utf8");
const tickerFiles = readdirSync(resolve("lib/ticker-context")).filter((file) =>
  file.endsWith(".ts"),
);
const tickerSource = tickerFiles.map((file) => read(`lib/ticker-context/${file}`)).join("\n");
const route = read("app/api/intelligence/ticker/route.ts");
const evidenceProducer = read("lib/ticker-context/evidence.ts");

describe("V1.2A product boundaries", () => {
  it("never imports an LLM, the AI brief pipeline or Ask Sakura", () => {
    expect(tickerSource).not.toMatch(/from "@\/lib\/llm/);
    expect(tickerSource).not.toMatch(/from "@\/lib\/ask-sakura/);
    expect(tickerSource).not.toMatch(
      /from "@\/lib\/ai-brief\/(live-context|prompt|generate|service)/,
    );
    expect(route).not.toMatch(/from "@\/lib\/(llm|ask-sakura|ai-brief)/);
    expect(tickerSource).not.toMatch(/deepseek|openai/i);
  });

  it("reuses the sealed anomaly history module but never the anomaly scorer", () => {
    expect(tickerSource).toContain("computeAnomalyHistory");
    expect(tickerSource).not.toMatch(/from "@\/lib\/anomalies\/score"/);
    expect(tickerSource).not.toContain("overallAnomalyScore");
    expect(tickerSource).not.toContain("anomalySeverity");
    expect(tickerSource).not.toContain("compareAnomalies");
  });

  it("keeps catalyst-match-v1 scoring out of ticker events", () => {
    // Dedupe is a pure helper; scoring/promotion helpers must not be reused.
    expect(tickerSource).not.toMatch(/evidenceStrength\(|alignPolarity\(|relevanceScore\s*[:(]/);
    expect(tickerSource).not.toContain("matchNews(");
    expect(tickerSource).not.toContain("buildCatalystItem(");
    expect(tickerSource).not.toContain("MATCHED");
  });

  it("states its own limits inside the evidence text", () => {
    expect(evidenceProducer).toContain("not an anomaly-v1 score");
    expect(evidenceProducer).toContain("not a proven cause");
    expect(evidenceProducer).toContain("No clear company-specific catalyst identified");
  });

  it("exposes a read-only endpoint on the canonical route only", () => {
    expect(route).toContain("export async function GET");
    expect(route).not.toMatch(/export async function (POST|PUT|PATCH|DELETE)/);
    expect(readdirSync(resolve("app/api/intelligence"))).toEqual(["ticker"]);
    expect(read("app/api/ai/evidence/route.ts")).not.toContain("ticker");
    expect(read("app/api/ai/ask-sakura/route.ts")).not.toContain("ticker");
  });

  it("leaves the existing brief/evidence/ask paths untouched", () => {
    expect(read("lib/ai-brief/live-context.ts")).not.toContain("ticker-context");
    expect(read("lib/ai-brief/evidence-endpoint.ts")).not.toContain("ticker-context");
    expect(read("features/intelligence/IntelligenceDashboard.tsx")).not.toContain("ticker-context");
    expect(read("components/AskWarRoom.tsx")).not.toContain("ticker-context");
    expect(read("lib/ai-brief/types.ts")).toContain('BRIEF_CONTEXT_VERSION = "brief-context-v1"');
    expect(read("lib/ticker-context/types.ts")).toContain(
      'TICKER_CONTEXT_VERSION = "ticker-context-v1"',
    );
  });

  it("keeps credentials server-side and out of responses", () => {
    expect(route).not.toMatch(/API_KEY|API_SECRET|NEXT_PUBLIC/);
    expect(tickerSource).not.toContain("NEXT_PUBLIC");
    expect(read("lib/ticker-context/production-service.ts")).toContain("server-only");
    expect(read("lib/ticker-context/production-service.ts")).toMatch(/ALPACA|getMarketDataConfig/);
  });

  it("introduces no cache/queue infrastructure beyond the existing in-memory TTL cache", () => {
    expect(tickerSource).not.toMatch(/redis|bullmq|rabbit|kafka|setInterval/i);
    expect(tickerSource).toContain("withBreadthCache");
  });
});
