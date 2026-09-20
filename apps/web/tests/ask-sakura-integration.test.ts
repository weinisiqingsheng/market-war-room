import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (rel: string) => readFileSync(resolve(rel), "utf8");
const dashboard = read("features/home/HomeDashboard.tsx");
const marketsDashboard = read("features/markets/MarketsDashboard.tsx");
const panel = read("components/AskWarRoom.tsx");
const hook = read("features/ask-sakura/useAskSakura.ts");
const marketsSource = read("features/markets/MarketsWorkspace.tsx");

describe("Ask Sakura dashboard integration", () => {
  it("upgrades the single existing Overview slot and never duplicates the section", () => {
    expect(dashboard.match(/<AskWarRoom /g)).toHaveLength(1);
    expect(dashboard.match(/import \{ AskWarRoom \}/g)).toHaveLength(1);
    expect(dashboard).not.toMatch(/<AskWarRoom[\s\S]*<AskWarRoom/);
    expect(dashboard).not.toMatch(/AskSakuraPanel|<AskSakura /);
    expect(panel).toContain('id="ask-sakura"');
    expect(panel).toContain("Ask Sakura");
    expect(panel).not.toContain("UI preview");
  });

  it("keeps Markets deterministic and free of Ask Sakura generation UI", () => {
    for (const source of [marketsDashboard, marketsSource]) {
      expect(source).not.toMatch(/AskWarRoom|AskSakura|ask-sakura|useAskSakura/);
    }
  });

  it("only ever POSTs the exact grounded endpoint from the browser", () => {
    expect(hook).toContain('fetch("/api/ai/ask-sakura"');
    expect(hook).not.toMatch(/api\.deepseek|chat\/completions|https?:\/\//);
    expect(hook).toMatch(/method: "POST"/);
  });

  it("sends no history or privileged fields", () => {
    expect(hook).toContain("JSON.stringify({ question: trimmed })");
    expect(hook).not.toMatch(/history|messages|systemPrompt|temperature|model:/);
    expect(hook).not.toMatch(/localStorage|sessionStorage|previous|context:.*json/);
  });

  it("keeps browser code free of provider imports and credentials", () => {
    for (const source of [panel, hook]) {
      expect(source).not.toMatch(
        /LLM_API_KEY|ALPACA_API|FRED_API_KEY|TWELVE_DATA_API_KEY|SEC_USER_AGENT|process\.env/,
      );
      expect(source).not.toMatch(
        /@\/lib\/llm|@\/lib\/ai-brief\/(generate|service|prompt|select-evidence|grounding-validator)/,
      );
    }
  });
});
