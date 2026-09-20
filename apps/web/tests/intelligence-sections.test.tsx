import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { IntelligenceAnomalies } from "@/features/intelligence/components/IntelligenceAnomalies";
import { IntelligenceCatalysts } from "@/features/intelligence/components/IntelligenceCatalysts";
import type { AnomalyOverview } from "@/lib/anomalies/types";
import type { CatalystOverview } from "@/lib/catalysts/types";

const anomalyOverview = {
  mode: "live",
  engineVersion: "anomaly-v1",
  universe: { name: "S&P 500", version: "sp500-v1", asOf: "x", count: 503 },
  meta: {
    provider: "alpaca",
    feed: "delayed_sip",
    delayMinutes: 15,
    asOf: "x",
    marketOpen: false,
    stale: false,
  },
  universeCount: 503,
  eligibleCount: 1,
  scoredCount: 1,
  coveragePct: 1,
  confidence: "high",
  topOverall: [
    {
      ticker: "KLAC",
      name: "KLA",
      sector: "Information Technology",
      sectorEtf: "XLK",
      dailyMovePct: 7.3,
      direction: "up",
      displayScore: 73,
      severity: "HIGH",
      primaryTrigger: "RETURN SHOCK",
      metrics: { volumeParticipation: null, sectorRelativePct: null },
      reasons: ["+7.3% move equals 3× its 20D daily volatility"],
    },
  ],
  topPositive: [],
  topNegative: [],
  asOf: "x",
} as unknown as AnomalyOverview;

const catalystOverview = {
  meta: {
    mode: "live",
    engineVersion: "catalyst-match-v1",
    anomalyVersion: "anomaly-v1",
    candidateCount: 1,
    matchedCount: 0,
    unmatchedCount: 1,
    generatedAt: "x",
    effectiveAsOf: "x",
    asOf: "x",
    catalystCutoff: "x",
    providers: { news: "ok", sec: "ok", corporateActions: "ok" },
  },
  items: [
    {
      ticker: "KLAC",
      name: "KLA",
      movePct: 7.3,
      anomalyScore: 73,
      anomalySeverity: "HIGH",
      status: "NO CLEAR CATALYST FOUND",
      primaryCatalyst: null,
      secondaryCatalysts: [],
      alignment: "unknown",
      catalystCutoff: "x",
      evidence: { newsCount: 0, filingCount: 0, corporateActionCount: 0 },
    },
  ],
} as unknown as CatalystOverview;

describe("Intelligence section controls", () => {
  it("anomaly Trace evidence sends the ticker for explorer focus", () => {
    const onSelectTicker = vi.fn();
    render(
      <IntelligenceAnomalies
        mode="live"
        status="ready"
        demo={null}
        overview={anomalyOverview}
        onSelectTicker={onSelectTicker}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Trace grounded evidence for KLAC/i }));
    expect(onSelectTicker).toHaveBeenCalledWith("KLAC");
  });

  it("makes NO CLEAR CATALYST FOUND explicit without synthesizing a story", () => {
    render(
      <IntelligenceCatalysts
        mode="live"
        status="ready"
        overview={catalystOverview}
        demoEvents={[]}
      />,
    );
    expect(screen.getAllByText(/NO CLEAR CATALYST/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/AI demand|semiconductor strength|earnings/i)).toBeNull();
  });

  it("live loading never renders demo catalyst fixtures", () => {
    render(<IntelligenceCatalysts mode="live" status="loading" overview={null} demoEvents={[]} />);
    expect(screen.getByText("Catalyst Intelligence")).toBeInTheDocument();
    expect(screen.queryByText(/Design fixtures/i)).toBeNull();
  });
});
