import type { ForwardDirection } from "./contract";
import type { ForwardDecisionContext, ForwardJevProviderResponse } from "./types";

export const FORWARD_FIXTURE_SYMBOLS = ["NVDA", "TSLA", "AAPL"] as const;
const classes: ForwardDirection[] = ["UP", "FLAT", "DOWN"];

export function buildForwardFixtureDecision(ticker: string, index: number): ForwardDecisionContext {
  return {
    originalDecisionRunId: `fixture-forward-${ticker.toLowerCase()}`,
    ticker,
    stateFingerprint: "a".repeat(63) + String(index),
    sourceFingerprint: "b".repeat(63) + String(index),
    requestedAt: "2026-09-21T23:29:38.161Z",
    effectiveAsOf: "2026-09-21T20:00:00.000Z",
    marketSessionDate: "2026-09-21",
    marketSessionStatus: "closed",
    targetSessionDate: "2026-09-22",
    targetCloseAt: "2026-09-22T20:00:00.000Z",
    marketDataPolicyVersion: "short-term-forward-market-data-policy-v1",
    referencePrice: [227.38, 375.3, 338.98][index] ?? 100,
    previousClose: [222.27, 375.3, 339.5][index] ?? 100,
    feed: "fixture_delayed_sip",
    delayMinutes: 15,
    freshness: "delayed",
    marketInputStatus: "fixture_market_input",
  };
}

export function buildForwardFixtureResponse(
  decision: ForwardDecisionContext,
  index: number,
): ForwardJevProviderResponse {
  const distributions = [
    { UP: 0.7, FLAT: 0.2, DOWN: 0.1 },
    { UP: 0.2, FLAT: 0.6, DOWN: 0.2 },
    { UP: 0.1, FLAT: 0.2, DOWN: 0.7 },
  ];
  return {
    taskId: "next_session_direction_v1",
    taskVersion: "short-term-forward-direction-v1",
    horizon: "next_session_close",
    targetSessionDate: decision.targetSessionDate,
    targetCloseAt: decision.targetCloseAt,
    model: "fixture-jev-direction",
    questionSetVersion: "short-term-forward-questions-v1",
    answer: {
      predictedClass: classes[index % classes.length],
      classDistribution: distributions[index % distributions.length],
      confidence: 0.6 + index * 0.1,
      evidenceSufficiency: 0.8,
      manualReview: false,
    },
    usage: { inputTokens: 80 + index, outputTokens: 12 },
  };
}
