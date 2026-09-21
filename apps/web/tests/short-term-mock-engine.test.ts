import { describe, expect, it } from "vitest";
import {
  evaluateShortTermMock,
  normalizeShortTermRequest,
} from "@/lib/short-term/mock-engine";

describe("short-term mock engine", () => {
  it("normalizes a manual ticker request without implying live data", () => {
    expect(
      normalizeShortTermRequest({
        ticker: " nvda ",
        strategyId: "momentum-watch",
        horizonHours: 4,
        maxLossPct: 2,
      }),
    ).toEqual({
      ticker: "NVDA",
      strategyId: "momentum-watch",
      horizonHours: 4,
      maxLossPct: 2,
    });
  });

  it("returns a deterministic, explicitly simulated assessment", () => {
    const request = normalizeShortTermRequest({
      ticker: "NVDA",
      strategyId: "momentum-watch",
      horizonHours: 4,
      maxLossPct: 2,
    });

    const first = evaluateShortTermMock(request);
    const second = evaluateShortTermMock(request);

    expect(first).toEqual(second);
    expect(first.status).toBe("simulated");
    expect(first.assessment.provider).toBe("mock-jev");
    expect(first.assessment.model).toBe("jev-short-term-mock-v0");
    expect(first.marketData.status).toBe("synthetic_fixture");
    expect(first.marketData.price.isLive).toBe(false);
    expect(first.assessment.confidence).toBeGreaterThanOrEqual(0);
    expect(first.assessment.confidence).toBeLessThanOrEqual(1);
  });

  it("rejects unsupported tickers and unsafe strategy inputs", () => {
    expect(() =>
      normalizeShortTermRequest({
        ticker: "AAPL;DROP",
        strategyId: "momentum-watch",
        horizonHours: 4,
        maxLossPct: 2,
      }),
    ).toThrow(/ticker/i);

    expect(() =>
      normalizeShortTermRequest({
        ticker: "AAPL",
        strategyId: "momentum-watch",
        horizonHours: 0,
        maxLossPct: 2,
      }),
    ).toThrow(/horizon/i);
  });
});
