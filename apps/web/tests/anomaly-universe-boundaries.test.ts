import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (rel: string) => readFileSync(resolve(rel), "utf8");

const home = read("features/home/HomeDashboard.tsx");
const intelligence = read("features/intelligence/IntelligenceDashboard.tsx");
const chineseDashboard = read("features/war-room-zh/ChineseWarRoomDashboard.tsx");
const chineseAnomalies = read("components/war-room-zh/ChineseMarketAnomaliesCard.tsx");
const catalysts = read("lib/catalysts/overview.ts");
const liveContext = read("lib/ai-brief/live-context.ts");
const marketsDashboard = read("features/markets/MarketsDashboard.tsx");
const workspace = read("features/markets/MarketsWorkspace.tsx");
const selector = read("components/AnomalyUniverseSelector.tsx");
const route = read("app/api/anomalies/overview/route.ts");
const askRoute = read("app/api/ai/ask-sakura/route.ts");
const evidenceRoute = read("app/api/ai/evidence/route.ts");

describe("V1.1E product boundaries", () => {
  it("keeps Overview, Intelligence and the Chinese route on the canonical S&P 500 universe", () => {
    for (const source of [home, intelligence, chineseDashboard]) {
      expect(source).toContain("useAnomaliesOverview(anomaliesMode)");
      expect(source).not.toContain("nasdaq100");
      expect(source).not.toContain("anomaliesUniverse");
    }
  });

  it("keeps Catalysts and the AI brief context on the default scanner call", () => {
    expect(catalysts).toContain("buildLiveAnomaliesOverview()");
    expect(liveContext).toContain("buildLiveAnomaliesOverview()");
    expect(catalysts).not.toContain("nasdaq100");
    expect(liveContext).not.toContain("nasdaq100");
  });

  it("makes Markets the only English consumer with universe state", () => {
    expect(marketsDashboard).toContain("DEFAULT_ANOMALY_UNIVERSE_ID");
    expect(marketsDashboard).toContain("useAnomaliesOverview(anomaliesMode, anomaliesUniverse)");
    expect(marketsDashboard).toContain("useState<AnomalyUniverseId>");
    for (const source of [home, intelligence]) {
      expect(source).not.toContain("DEFAULT_ANOMALY_UNIVERSE_ID");
      expect(source).not.toContain("AnomalyUniverseId");
    }
  });

  it("stores no global universe state (no storage, cookies or sessions)", () => {
    for (const source of [marketsDashboard, workspace, selector]) {
      expect(source).not.toContain("localStorage");
      expect(source).not.toContain("sessionStorage");
      expect(source).not.toContain("document.cookie");
      expect(source).not.toContain("cookies(");
    }
  });

  it("does not rerank or rescore anomalies in the Markets client", () => {
    for (const source of [workspace, selector]) {
      expect(source).not.toMatch(/\.sort\(/);
      expect(source).not.toContain("anomalyScore");
      expect(source).not.toContain("SCORE_WEIGHTS");
      expect(source).not.toMatch(
        /from "@\/lib\/anomalies\/(score|constants|overview|metrics|history-metrics)/,
      );
    }
  });

  it("extends the canonical anomaly endpoint instead of adding a second API", () => {
    expect(route).toContain("universe");
    expect(readdirSync(resolve("app/api/anomalies"))).toEqual(["overview"]);
    expect(existsSync(resolve("app/api/anomalies/overview/route.ts"))).toBe(true);
    expect(askRoute).not.toContain("universe");
    expect(evidenceRoute).not.toContain("universe");
  });

  it("leaves Chinese anomaly files untouched by the universe selector", () => {
    for (const source of [chineseDashboard, chineseAnomalies]) {
      expect(source).not.toContain("Nasdaq");
      expect(source).not.toContain("universe");
    }
  });
});
