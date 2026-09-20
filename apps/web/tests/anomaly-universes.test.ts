import { describe, expect, it } from "vitest";
import { sp500Universe } from "@/lib/breadth/universe/sp500";
import { sp500AnomalyUniverse } from "@/lib/anomalies/universe/sp500";
import {
  NASDAQ100_UNIVERSE_VERSION,
  nasdaq100AnomalyUniverse,
} from "@/lib/anomalies/universe/nasdaq100";
import {
  ANOMALY_UNIVERSES,
  ANOMALY_UNIVERSE_IDS,
  DEFAULT_ANOMALY_UNIVERSE_ID,
  anomalyUniverseOrDefault,
  resolveAnomalyUniverse,
} from "@/lib/anomalies/universe/registry";
import { GICS_TO_SPDR } from "@/lib/anomalies/sector-map";
import { buildDemoAnomaliesOverview } from "@/lib/anomalies/demo";

describe("anomaly universe definitions (V1.1E)", () => {
  it("reuses the canonical S&P 500 snapshot instead of copying or regenerating it", () => {
    expect(sp500AnomalyUniverse.id).toBe("sp500");
    expect(sp500AnomalyUniverse.label).toBe(sp500Universe.name);
    expect(sp500AnomalyUniverse.version).toBe(sp500Universe.version);
    expect(sp500AnomalyUniverse.asOf).toBe(sp500Universe.asOf);
    expect(sp500AnomalyUniverse.count).toBe(sp500Universe.count);
    expect(sp500AnomalyUniverse.symbols).toEqual(
      sp500Universe.members.map((member) => member.ticker),
    );
    expect(sp500AnomalyUniverse.count).toBe(sp500AnomalyUniverse.members.length);
    expect(sp500AnomalyUniverse.source).toContain("lib/breadth/universe/sp500.ts");
  });

  it("ships a versioned, documented Nasdaq 100 snapshot with a derived count", () => {
    expect(NASDAQ100_UNIVERSE_VERSION).toBe("nasdaq100-v1");
    expect(nasdaq100AnomalyUniverse.id).toBe("nasdaq100");
    expect(nasdaq100AnomalyUniverse.label).toBe("Nasdaq 100");
    expect(nasdaq100AnomalyUniverse.version).toBe(NASDAQ100_UNIVERSE_VERSION);
    expect(nasdaq100AnomalyUniverse.asOf).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(nasdaq100AnomalyUniverse.source).toContain("List_of_NASDAQ-100_companies");
    expect(nasdaq100AnomalyUniverse.source).toMatch(/retrieved \d{4}-\d{2}-\d{2}/);
    expect(nasdaq100AnomalyUniverse.source).toMatch(/wikipedia\.org/i);
  });

  it("derives the security count from the snapshot (share classes included, never hard-coded)", () => {
    expect(nasdaq100AnomalyUniverse.count).toBe(nasdaq100AnomalyUniverse.members.length);
    expect(nasdaq100AnomalyUniverse.count).toBe(nasdaq100AnomalyUniverse.symbols.length);
    expect(nasdaq100AnomalyUniverse.count).toBeGreaterThanOrEqual(95);
    expect(nasdaq100AnomalyUniverse.count).toBeLessThanOrEqual(110);
    // 101 securities (100 companies) — Alphabet's two share classes are both kept.
    expect(nasdaq100AnomalyUniverse.symbols).toContain("GOOGL");
    expect(nasdaq100AnomalyUniverse.symbols).toContain("GOOG");
  });

  it("has unique, nonempty symbols and GICS-mappable sectors in every universe", () => {
    for (const universe of Object.values(ANOMALY_UNIVERSES)) {
      const symbols = universe.members.map((member) => member.ticker);
      expect(symbols.length).toBeGreaterThan(0);
      expect(symbols.some((symbol) => symbol.length === 0)).toBe(false);
      expect(new Set(symbols).size).toBe(symbols.length);
      for (const member of universe.members) {
        expect(GICS_TO_SPDR[member.sector]).toBeDefined();
        expect(member.name.length).toBeGreaterThan(0);
      }
    }
  });

  it("reuses canonical S&P sectors for overlapping symbols (score-invariance prerequisite)", () => {
    const spSectors = new Map(
      sp500AnomalyUniverse.members.map((member) => [member.ticker, member.sector]),
    );
    const overlap = nasdaq100AnomalyUniverse.members.filter((member) =>
      spSectors.has(member.ticker),
    );
    expect(overlap.length).toBeGreaterThan(50);
    for (const member of overlap) {
      expect(member.sector).toBe(spSectors.get(member.ticker));
      expect(member.sectorSource).toBe("sp500");
    }
    const nasdaqOnly = nasdaq100AnomalyUniverse.members.filter(
      (member) => !spSectors.has(member.ticker),
    );
    expect(nasdaqOnly.every((member) => member.sectorSource === "icb")).toBe(true);
  });

  it("defaults to sp500 and never resolves an unknown id", () => {
    expect(DEFAULT_ANOMALY_UNIVERSE_ID).toBe("sp500");
    expect(ANOMALY_UNIVERSE_IDS).toEqual(["sp500", "nasdaq100"]);
    expect(ANOMALY_UNIVERSES.sp500.id).toBe("sp500");
    expect(resolveAnomalyUniverse("nasdaq100")?.id).toBe("nasdaq100");
    expect(resolveAnomalyUniverse("russell2000")).toBeNull();
    expect(resolveAnomalyUniverse("")).toBeNull();
    expect(resolveAnomalyUniverse(null)).toBeNull();
    expect(anomalyUniverseOrDefault(undefined).id).toBe("sp500");
    expect(anomalyUniverseOrDefault("bogus").id).toBe("sp500");
  });
});

describe("universe-aware demo overview (V1.1E)", () => {
  it("keeps the canonical S&P 500 demo fixture deterministic and engine-labeled", () => {
    const first = buildDemoAnomaliesOverview("sp500");
    const second = buildDemoAnomaliesOverview("sp500");
    expect(first).toEqual(second);
    expect(first).toMatchObject({
      mode: "demo",
      engineVersion: "anomaly-v1",
      universeCount: 503,
      universe: { id: "sp500", label: "S&P 500", version: "sp500-v1" },
    });
    expect(first.topOverall[0]?.ticker).toBe("NVDA");
  });

  it("re-labels and filters the same demo candidates for Nasdaq 100", () => {
    const nasdaq = buildDemoAnomaliesOverview("nasdaq100");
    expect(nasdaq).toMatchObject({
      mode: "demo",
      engineVersion: "anomaly-v1",
      universeCount: 101,
      universe: { id: "nasdaq100", label: "Nasdaq 100", version: "nasdaq100-v1" },
    });
    const symbols = new Set(nasdaq100AnomalyUniverse.symbols);
    for (const candidate of nasdaq.topOverall) expect(symbols.has(candidate.ticker)).toBe(true);
    expect(nasdaq.coveragePct).toBeGreaterThan(0);
    expect(nasdaq.coveragePct).toBeLessThanOrEqual(1);
    expect(nasdaq.topOverall.length).toBeLessThanOrEqual(
      buildDemoAnomaliesOverview("sp500").topOverall.length,
    );
  });
});
