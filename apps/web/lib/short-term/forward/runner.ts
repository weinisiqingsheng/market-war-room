import { buildForwardDirectionQuestion } from "./questions";
import { buildForwardPredictionRecord } from "./record";
import { validateForwardResponse } from "./validate";
import { evaluateForwardBatch } from "./evaluate";
import { labelForwardReturn } from "./contract";
import {
  buildForwardFixtureDecision,
  buildForwardFixtureResponse,
  FORWARD_FIXTURE_SYMBOLS,
} from "./fixture";
import type { ForwardObservedOutcome } from "./types";

export async function runForwardFixturePilot(
  requestedSymbols: readonly string[] = FORWARD_FIXTURE_SYMBOLS,
): Promise<{
  status: "fixture_dry_run";
  realJevRequests: 0;
  realMarketRequests: 0;
  predictions: Awaited<ReturnType<typeof buildOne>>[];
  outcomes: ForwardObservedOutcome[];
  evaluation: ReturnType<typeof evaluateForwardBatch>;
}> {
  const chosen = requestedSymbols
    .map((symbol) => symbol.toUpperCase())
    .filter((symbol): symbol is (typeof FORWARD_FIXTURE_SYMBOLS)[number] =>
      FORWARD_FIXTURE_SYMBOLS.includes(symbol as (typeof FORWARD_FIXTURE_SYMBOLS)[number]),
    );
  if (!chosen.length) throw new Error("No supported fixture symbols");
  const predictions = await Promise.all(chosen.map((symbol, index) => buildOne(symbol, index)));
  const outcomes = predictions.map((prediction, index) => {
    const returnPct = [0.25, -0.05, -0.25][index] ?? 0;
    return {
      originalDecisionRunId: prediction.originalDecisionRunId,
      ticker: prediction.ticker,
      stateFingerprint: prediction.stateFingerprint,
      targetSessionDate: prediction.targetSessionDate,
      observedAt: prediction.targetCloseAt,
      sourceFingerprint: `${prediction.ticker}fixtureoutcome`
        .toLowerCase()
        .padEnd(64, "c")
        .slice(0, 64),
      returnPct,
      label: labelForwardReturn(returnPct),
    };
  });
  return {
    status: "fixture_dry_run",
    realJevRequests: 0,
    realMarketRequests: 0,
    predictions,
    outcomes,
    evaluation: evaluateForwardBatch(predictions, outcomes, {
      historicalCounts: { UP: 1, FLAT: 1, DOWN: 1 },
    }),
  };
}

async function buildOne(ticker: (typeof FORWARD_FIXTURE_SYMBOLS)[number], index: number) {
  const decision = buildForwardFixtureDecision(ticker, index);
  const question = buildForwardDirectionQuestion(decision);
  const assessment = validateForwardResponse(
    buildForwardFixtureResponse(decision, index),
    question,
  );
  return buildForwardPredictionRecord({
    decision,
    assessment,
    createdAt: "2026-09-21T23:29:39.000Z",
    modelOutputStatus: "fixture_model_output",
  });
}
