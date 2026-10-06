import {
  frozenMomentumBaseline,
  historicalMajorityBaseline,
  alwaysFlatBaseline,
} from "./baselines";
import { FORWARD_DIRECTION_CLASSES, labelForwardReturn, type ForwardDirection } from "./contract";
import type {
  ForwardDirectionPredictionRecord,
  ForwardEvaluationResult,
  ForwardObservedOutcome,
} from "./types";

function emptyMatrix(): Record<ForwardDirection, Record<ForwardDirection, number>> {
  return Object.fromEntries(
    FORWARD_DIRECTION_CLASSES.map((row) => [
      row,
      Object.fromEntries(FORWARD_DIRECTION_CLASSES.map((column) => [column, 0])),
    ]),
  ) as Record<ForwardDirection, Record<ForwardDirection, number>>;
}

export function evaluateForwardBatch(
  predictions: readonly ForwardDirectionPredictionRecord[],
  outcomes: readonly ForwardObservedOutcome[],
  options: { historicalCounts: Partial<Record<ForwardDirection, number>> },
): ForwardEvaluationResult {
  if (predictions.length !== outcomes.length)
    throw new Error("Prediction and outcome counts differ");
  const outcomesById = new Map(outcomes.map((outcome) => [outcome.originalDecisionRunId, outcome]));
  if (outcomesById.size !== outcomes.length) throw new Error("Duplicate outcome identity");
  const matrix = emptyMatrix();
  const linked: Array<{
    prediction: ForwardDirectionPredictionRecord;
    outcome: ForwardObservedOutcome;
  }> = [];
  let correct = 0;
  for (const prediction of predictions) {
    const outcome = outcomesById.get(prediction.originalDecisionRunId);
    if (
      !outcome ||
      outcome.ticker !== prediction.ticker ||
      outcome.stateFingerprint !== prediction.stateFingerprint ||
      outcome.targetSessionDate !== prediction.targetSessionDate
    )
      throw new Error("Outcome identity or fingerprint mismatch");
    if (
      !Number.isFinite(outcome.returnPct) ||
      labelForwardReturn(outcome.returnPct) !== outcome.label
    )
      throw new Error("Outcome label mismatch");
    if (typeof outcome.sourceFingerprint !== "string" || outcome.sourceFingerprint.length < 1)
      throw new Error("Outcome source fingerprint missing");
    linked.push({ prediction, outcome });
    matrix[prediction.predictedClass][outcome.label] += 1;
    if (prediction.predictedClass === outcome.label) correct += 1;
  }
  const sampleSize = predictions.length;
  const accuracy = sampleSize ? correct / sampleSize : 0;
  const perClass = Object.fromEntries(
    FORWARD_DIRECTION_CLASSES.map((label) => {
      const tp = matrix[label][label];
      const predictedTotal = FORWARD_DIRECTION_CLASSES.reduce(
        (sum, actual) => sum + matrix[label][actual],
        0,
      );
      const actualTotal = FORWARD_DIRECTION_CLASSES.reduce(
        (sum, predicted) => sum + matrix[predicted][label],
        0,
      );
      const precision = predictedTotal ? tp / predictedTotal : 0;
      const recall = actualTotal ? tp / actualTotal : 0;
      const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
      return [label, { precision, recall, f1 }];
    }),
  ) as ForwardEvaluationResult["perClass"];
  const macroF1 =
    FORWARD_DIRECTION_CLASSES.reduce((sum, label) => sum + perClass[label].f1, 0) /
    FORWARD_DIRECTION_CLASSES.length;
  const historical = historicalMajorityBaseline(options.historicalCounts);
  const alwaysFlat = alwaysFlatBaseline();
  const momentumCorrect = linked.reduce(
    (sum, { prediction, outcome }) =>
      sum +
      (frozenMomentumBaseline(prediction.referencePrice, prediction.previousClose) === outcome.label
        ? 1
        : 0),
    0,
  );
  const baselineAccuracy = (label: ForwardDirection) =>
    sampleSize ? outcomes.filter((outcome) => outcome.label === label).length / sampleSize : 0;
  const historicalAccuracy = baselineAccuracy(historical);
  const alwaysFlatAccuracy = baselineAccuracy(alwaysFlat);
  const momentumAccuracy = sampleSize ? momentumCorrect / sampleSize : 0;
  const comparison =
    accuracy === alwaysFlatAccuracy
      ? { wins: 0, losses: 0, ties: sampleSize }
      : accuracy > alwaysFlatAccuracy
        ? { wins: sampleSize, losses: 0, ties: 0 }
        : { wins: 0, losses: sampleSize, ties: 0 };
  return {
    forwardMetricStatus: "applicable",
    sampleSize,
    accuracy,
    confusionMatrix: matrix,
    perClass,
    macroF1,
    baselines: {
      alwaysFlat: {
        label: alwaysFlat,
        accuracy: alwaysFlatAccuracy,
        delta: accuracy - alwaysFlatAccuracy,
      },
      historicalMajority: {
        label: historical,
        accuracy: historicalAccuracy,
        delta: accuracy - historicalAccuracy,
      },
      frozenMomentum: { accuracy: momentumAccuracy, delta: accuracy - momentumAccuracy },
    },
    pairedAgainstAlwaysFlat: comparison,
  };
}
