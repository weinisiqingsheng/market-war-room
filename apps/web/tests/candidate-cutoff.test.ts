import { describe, expect, it } from "vitest";
import { applyCandidateWindow, resolveCandidateCutoff } from "@/lib/catalysts/candidate-cutoff";
import { computeCatalystWindow, inCatalystWindow } from "@/lib/catalysts/time-window";
import { buildCatalystItem } from "@/lib/catalysts/match";

const OVERVIEW_EFFECTIVE = "2026-09-02T10:44:58.000Z"; // open-session overview time
const baseWindow = computeCatalystWindow(OVERVIEW_EFFECTIVE);

function candidateWindow(priceAsOf: string | null | undefined) {
  const cutoff = resolveCandidateCutoff({
    priceAsOf,
    overviewEffectiveAsOf: OVERVIEW_EFFECTIVE,
    marketOpen: true,
  });
  return applyCandidateWindow(baseWindow, cutoff);
}

describe("candidate-specific catalyst cutoff", () => {
  it("1/2 — Candidate A uses its own priceAsOf (10:44:31) below the overview time", () => {
    const cutoff = resolveCandidateCutoff({ priceAsOf: "2026-09-02T10:44:31.000Z", overviewEffectiveAsOf: OVERVIEW_EFFECTIVE, marketOpen: true });
    expect(cutoff).toBe("2026-09-02T10:44:31.000Z");
  });

  it("3/4/5 — Article 10:44:20 and boundary 10:44:31 included; 10:44:32 excluded for A", () => {
    const aw = candidateWindow("2026-09-02T10:44:31.000Z");
    expect(inCatalystWindow("2026-09-02T10:44:20.000Z", aw)).toBe(true);
    expect(inCatalystWindow("2026-09-02T10:44:31.000Z", aw)).toBe(true); // inclusive boundary
    expect(inCatalystWindow("2026-09-02T10:44:32.000Z", aw)).toBe(false);
  });

  it("6 — the same 10:44:40 article stays eligible for Candidate B (priceAsOf 10:44:50)", () => {
    const bw = candidateWindow("2026-09-02T10:44:50.000Z");
    expect(inCatalystWindow("2026-09-02T10:44:40.000Z", bw)).toBe(true);
  });

  it("7 — missing priceAsOf falls back to the overview effectiveAsOf", () => {
    expect(candidateWindow(undefined).cutoffIso).toBe(OVERVIEW_EFFECTIVE);
    expect(candidateWindow(null).cutoffIso).toBe(OVERVIEW_EFFECTIVE);
  });

  it("8 — priceAsOf later than overview effectiveAsOf is clamped to the overview time", () => {
    const clamped = resolveCandidateCutoff({ priceAsOf: "2026-09-02T10:45:10.000Z", overviewEffectiveAsOf: OVERVIEW_EFFECTIVE, marketOpen: true });
    expect(clamped).toBe(OVERVIEW_EFFECTIVE);
    const cw = applyCandidateWindow(baseWindow, clamped);
    expect(inCatalystWindow("2026-09-02T10:45:05.000Z", cw)).toBe(false);
    expect(inCatalystWindow("2026-09-02T10:44:58.000Z", cw)).toBe(true);
  });

  it("closed market — per-candidate priceAsOf never shifts the Friday session close", () => {
    const cutoff = resolveCandidateCutoff({
      priceAsOf: "2026-09-04T19:59:59.000Z", // bar-second noise
      overviewEffectiveAsOf: "2026-09-04T20:00:00.000Z", // Friday 4:00 PM ET close
      marketOpen: false,
    });
    expect(cutoff).toBe("2026-09-04T20:00:00.000Z");
  });

  it("exposes the candidate cutoff on the built CatalystItem", () => {
    const item = buildCatalystItem({
      ticker: "AAA",
      name: "A Corp",
      movePct: -4,
      anomalyScore: 75,
      anomalySeverity: "HIGH",
      directionUp: false,
      news: [],
      filings: [],
      actions: [],
      window: candidateWindow("2026-09-02T10:44:31.000Z"),
    });
    expect(item.catalystCutoff).toBe("2026-09-02T10:44:31.000Z");
  });
});
