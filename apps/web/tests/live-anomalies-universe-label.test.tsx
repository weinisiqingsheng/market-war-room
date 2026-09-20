import { describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach } from "vitest";
import { LiveAnomaliesView } from "@/components/LiveAnomaliesView";
import type { AnomalyOverview } from "@/lib/anomalies/types";

function overview(universe: AnomalyOverview["universe"], count: number): AnomalyOverview {
  return {
    mode: "live",
    engineVersion: "anomaly-v1",
    universe,
    meta: {
      provider: "alpaca",
      feed: "delayed_sip",
      delayMinutes: 15,
      asOf: "2026-09-18T20:00:00.000Z",
      marketOpen: false,
      stale: false,
    },
    universeCount: count,
    eligibleCount: count,
    scoredCount: count,
    coveragePct: 1,
    confidence: "high",
    topOverall: [],
    topPositive: [],
    topNegative: [],
    asOf: "2026-09-18T20:00:00.000Z",
  };
}

afterEach(() => cleanup());

describe("Market Anomalies card universe label", () => {
  it("labels the S&P 500 selection from the API metadata", () => {
    render(
      <LiveAnomaliesView
        overview={overview(
          { id: "sp500", label: "S&P 500", name: "S&P 500", version: "sp500-v1", asOf: "2026-09-06", count: 503 },
          503,
        )}
      />,
    );
    expect(screen.getByText(/S&P 500 · anomaly-v1 · delayed sip 15m/)).toBeInTheDocument();
    expect(screen.getByText(/503 constituents scanned/)).toBeInTheDocument();
    expect(screen.getByText(/15M Delayed SIP/)).toBeInTheDocument();
  });

  it("labels the Nasdaq 100 selection instead of saying S&P 500", () => {
    const { container } = render(
      <LiveAnomaliesView
        overview={overview(
          {
            id: "nasdaq100",
            label: "Nasdaq 100",
            name: "Nasdaq 100",
            version: "nasdaq100-v1",
            asOf: "2026-09-20",
            count: 101,
          },
          101,
        )}
      />,
    );
    expect(screen.getByText(/Nasdaq 100 · anomaly-v1 · delayed sip 15m/)).toBeInTheDocument();
    expect(screen.getByText(/101 constituents scanned/)).toBeInTheDocument();
    expect(screen.getByText(/15M Delayed SIP/)).toBeInTheDocument();
    expect(container.textContent ?? "").not.toContain("S&P 500");
  });

  it("falls back to the legacy universe name when no label is present", () => {
    const { container } = render(
      <LiveAnomaliesView
        overview={overview(
          { name: "S&P 500", version: "sp500-v1", asOf: "2026-09-05", count: 503 },
          503,
        )}
      />,
    );
    expect(screen.getByText(/S&P 500 · anomaly-v1/)).toBeInTheDocument();
    expect(container.textContent ?? "").toContain("503 constituents scanned");
  });
});
