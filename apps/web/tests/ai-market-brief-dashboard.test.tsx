import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (rel: string) => readFileSync(resolve(rel), "utf8");
const dashboard = read("features/home/HomeDashboard.tsx");
const panel = read("features/home/components/ai-market-brief-panel.tsx");
const card = read("components/ai-market-brief-card.tsx");

const BANNED_IN_DASHBOARD = ["process.env.AI_BRIEF_MODE", "buildDemoGroundedBrief", "buildDemoBriefContext", "createAiBriefService", "buildLiveBriefContext", "generateGroundedMarketBrief", "LLM_API_KEY", "ALPACA_API_SECRET_KEY"];

describe("ai brief dashboard integration", () => {
  it("renders AiMarketBriefPanel once and removed the legacy static brief", () => {
    expect(dashboard).toContain("<AiMarketBriefPanel />");
    expect(dashboard.match(/AiMarketBriefPanel/g)).toHaveLength(2); // import + usage
    expect(dashboard).not.toContain("AIMarketBrief brief={");
    expect(dashboard).not.toContain("AIMarketBrief from");
  });
  it("has no page-level mode branch or banned server imports", () => {
    for (const token of BANNED_IN_DASHBOARD) expect(dashboard).not.toContain(token);
    expect(dashboard).not.toContain("if AI_BRIEF_MODE");
  });
  it("panel owns exactly one hook instance and no duplicate polling", () => {
    expect(panel).toContain("useAiMarketBrief");
    expect(panel.match(/useAiMarketBrief\(\)/g)).toHaveLength(1);
    expect(panel).not.toContain("setInterval");
  });
  it("card/panel contain no credentials or server modules", () => {
    for (const token of ["LLM_API_KEY", "ALPACA_API_SECRET_KEY", "FRED_API_KEY", "TWELVE_DATA_API_KEY", "SEC_USER_AGENT"]) {
      expect(card).not.toContain(token);
      expect(panel).not.toContain(token);
    }
  });
  it("client files import no provider/live-context/config modules", () => {
    expect(card).not.toMatch(/@\/lib\/llm|live-context|production-service|ai-brief\/cache/);
    expect(panel).not.toMatch(/@\/lib\/llm|live-context|production-service|ai-brief\/cache/);
  });
});
