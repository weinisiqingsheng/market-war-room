#!/usr/bin/env node
import "server-only";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createProductionTickerDeps } from "@/lib/ticker-context/production-service";
import { NYSE_REGULAR_SESSION_CALENDAR } from "@/lib/short-term/prospective/calendar";
import { evaluateForwardBatch } from "@/lib/short-term/forward/evaluate";
import { frozenMomentumBaseline } from "@/lib/short-term/forward/baselines";
import { createForwardPredictionStore } from "@/lib/short-term/forward/store";
import { collectApprovedSipOutcomeObservation } from "@/lib/short-term/forward/outcome-provider";
import {
  buildForwardOutcomeRecord,
  toForwardObservedOutcome,
  type ForwardOutcomeRecord,
} from "@/lib/short-term/forward/outcome";
import { createForwardOutcomeStore } from "@/lib/short-term/forward/outcome-store";
import type {
  ForwardDirection,
  ForwardDirectionPredictionRecord,
} from "@/lib/short-term/forward/types";

const EXPECTED_PREDICTION_SHA = "3e527c3221461fd57ad98181f208f14a44e82fde0d3f6398438af9185bba344b";
const SYMBOLS = ["NVDA", "TSLA", "AAPL"] as const;

function sha256(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function assertFrozenPredictions(
  predictions: ForwardDirectionPredictionRecord[],
  filePath: string,
): void {
  if (sha256(filePath) !== EXPECTED_PREDICTION_SHA)
    throw new Error("prediction_file_integrity_mismatch");
  if (predictions.length !== SYMBOLS.length) throw new Error("prediction_count_mismatch");
  for (const symbol of SYMBOLS) {
    const prediction = predictions.find((item) => item.ticker === symbol);
    if (
      !prediction ||
      prediction.taskId !== "next_session_direction_v1" ||
      prediction.taskVersion !== "short-term-forward-direction-v1" ||
      prediction.questionSetVersion !== "short-term-forward-questions-v1" ||
      prediction.marketDataPolicyVersion !== "short-term-forward-market-data-policy-v1" ||
      prediction.horizon !== "next_session_close" ||
      prediction.targetSessionDate !== "2026-09-28" ||
      prediction.targetCloseAt !== "2026-09-28T20:00:00.000Z" ||
      prediction.marketInputStatus !== "verified_market_input" ||
      prediction.modelOutputStatus !== "real_jev_model_output" ||
      !/^[a-f0-9]{64}$/.test(prediction.stateFingerprint) ||
      !/^[a-f0-9]{64}$/.test(prediction.sourceFingerprint) ||
      !/^[a-f0-9]{64}$/.test(prediction.outputFingerprint) ||
      Date.parse(prediction.createdAt) >= Date.parse(prediction.targetCloseAt)
    )
      throw new Error(`prediction_integrity_mismatch:${symbol}`);
  }
}

function metric(value: number, denominator: number): number | "NOT_ENOUGH_DATA" {
  return denominator > 0 ? value / denominator : "NOT_ENOUGH_DATA";
}

function evaluation(
  predictions: ForwardDirectionPredictionRecord[],
  outcomes: ForwardOutcomeRecord[],
) {
  const observed = outcomes.map(toForwardObservedOutcome);
  const base = evaluateForwardBatch(predictions, observed, { historicalCounts: {} });
  const classes: readonly ForwardDirection[] = ["UP", "FLAT", "DOWN"];
  const perClass = Object.fromEntries(
    classes.map((label) => {
      const predicted = predictions.filter(
        (prediction) => prediction.predictedClass === label,
      ).length;
      const actual = outcomes.filter((outcome) => outcome.label === label).length;
      const correct = outcomes.filter(
        (outcome, index) => predictions[index]?.predictedClass === label && outcome.label === label,
      ).length;
      const precision = metric(correct, predicted);
      const recall = metric(correct, actual);
      const f1 =
        typeof precision === "number" && typeof recall === "number" && precision + recall > 0
          ? (2 * precision * recall) / (precision + recall)
          : "NOT_ENOUGH_DATA";
      return [label, { precision, recall, f1, predictedCount: predicted, actualCount: actual }];
    }),
  );
  const allClassesDefined = classes.every(
    (label) =>
      typeof (perClass[label] as { precision: unknown }).precision === "number" &&
      typeof (perClass[label] as { recall: unknown }).recall === "number",
  );
  const momentumCorrect = outcomes.filter((outcome, index) => {
    const prediction = predictions[index];
    return (
      prediction &&
      frozenMomentumBaseline(prediction.referencePrice, prediction.previousClose) === outcome.label
    );
  }).length;
  const alwaysFlatCorrect = outcomes.filter((outcome) => outcome.label === "FLAT").length;
  const paired = outcomes.reduce(
    (result, outcome, index) => {
      const jevCorrect = predictions[index]?.predictedClass === outcome.label;
      const baselineCorrect = outcome.label === "FLAT";
      if (jevCorrect && !baselineCorrect) result.wins += 1;
      else if (!jevCorrect && baselineCorrect) result.losses += 1;
      else result.ties += 1;
      return result;
    },
    { wins: 0, losses: 0, ties: 0 },
  );
  return {
    sampleSize: outcomes.length,
    accuracy: base.accuracy,
    confusionMatrix: base.confusionMatrix,
    perClass,
    macroF1: allClassesDefined
      ? classes.reduce((sum, label) => sum + Number((perClass[label] as { f1: number }).f1), 0) /
        classes.length
      : "NOT_ENOUGH_DATA",
    baselines: {
      alwaysFlat: { label: "FLAT", accuracy: alwaysFlatCorrect / outcomes.length },
      frozenMomentum: { accuracy: momentumCorrect / outcomes.length },
      historicalMajority: { status: "NOT_AVAILABLE" },
    },
    pairedJevVsAlwaysFlat: paired,
    limitations: [
      "Three observations are insufficient for significance, calibration, predictive-superiority, or trading-profitability claims.",
      "Class-level metrics with zero predicted or actual support are NOT_ENOUGH_DATA.",
    ],
  };
}

const now = Date.now;
const predictionStore = createForwardPredictionStore({ retentionDays: 90 });
const predictions = predictionStore.list();
assertFrozenPredictions(predictions, predictionStore.filePath);
const outcomeStore = createForwardOutcomeStore({});
if (outcomeStore.list().length > 0) throw new Error("outcome_store_already_contains_records");
const deps = createProductionTickerDeps();
const collected: ForwardOutcomeRecord[] = [];
for (const symbol of SYMBOLS) {
  const prediction = predictions.find((item) => item.ticker === symbol);
  if (!prediction) throw new Error(`prediction_missing:${symbol}`);
  const observation = await collectApprovedSipOutcomeObservation({
    ticker: prediction.ticker,
    stateFingerprint: prediction.stateFingerprint,
    targetSessionDate: prediction.targetSessionDate,
    now,
    calendar: NYSE_REGULAR_SESSION_CALENDAR,
    fetchBars: deps.fetchBars,
  });
  const record = buildForwardOutcomeRecord({
    prediction,
    observation,
    collectedAt: new Date(now()).toISOString(),
    calendar: NYSE_REGULAR_SESSION_CALENDAR,
  });
  outcomeStore.append(record, prediction);
  collected.push(record);
}
console.log(
  JSON.stringify(
    {
      status: "FORWARD_OUTCOME_COLLECTION_PASS",
      jevRequests: 0,
      predictionsCreated: 0,
      collectionTimestamp: new Date(now()).toISOString(),
      predictionFile: {
        path: predictionStore.filePath,
        sha256: sha256(predictionStore.filePath),
        unchanged: sha256(predictionStore.filePath) === EXPECTED_PREDICTION_SHA,
      },
      outcomeStore: {
        path: outcomeStore.filePath,
        records: outcomeStore.list().length,
      },
      outcomes: collected,
      evaluation: evaluation(predictions, collected),
      costReserveReview: {
        preSendConservativeReserveUsd: 0.00026628,
        reportedUsageEstimateUsd: 0.000297066,
        reviewRequired: true,
      },
    },
    null,
    2,
  ),
);
