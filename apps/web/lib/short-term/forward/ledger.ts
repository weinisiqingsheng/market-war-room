import { FORWARD_DIRECTION_CLASSES, type ForwardDirection } from "./contract";
import { evaluateForwardBatch } from "./evaluate";
import type {
  ForwardExperimentAttempt as ForwardExperimentAttemptEvent,
  ForwardAttemptLifecycleStatus,
} from "./attempt";
import type { ForwardDirectionPredictionRecord, ForwardObservedOutcome } from "./types";

export const FORWARD_LEDGER_SCHEMA_VERSION = "short-term-forward-ledger-v1" as const;

export type ForwardExperimentAttemptStatus =
  | "completed"
  | "pending"
  | "invalid"
  | "validation_failure"
  | "market_input_unavailable"
  | "outcome_unavailable"
  | "provider_failure";

export interface LegacyForwardExperimentAttempt {
  attemptId: string;
  ticker: string;
  taskId: string;
  taskVersion: string;
  questionSetVersion: string;
  marketDataPolicyVersion: string;
  model: string;
  status: ForwardExperimentAttemptStatus;
  predictionId?: string;
}

export type ForwardExperimentAttempt =
  ForwardExperimentAttemptEvent | LegacyForwardExperimentAttempt;

type Metric = number | "NOT_ENOUGH_DATA" | "NOT_COMBINED";
type Matrix = Record<ForwardDirection, Record<ForwardDirection, number>>;
type ClassMetric = {
  predictedSupport: number;
  actualSupport: number;
  precision: Metric;
  recall: Metric;
  f1: Metric;
};

interface VersionIdentity {
  model: string;
  taskId: string;
  taskVersion: string;
  questionSetVersion: string;
  marketDataPolicyVersion: string;
}

interface ForwardLedgerBreakdown {
  version: VersionIdentity;
  observationCount: number;
  completedCount: number;
  pendingCount: number;
  accuracy: Metric;
  confusionMatrix: Matrix;
  perClass: Record<ForwardDirection, ClassMetric>;
  macroF1: Metric;
  baselines: {
    alwaysFlat: { label: "FLAT"; accuracy: Metric };
    frozenMomentum: { accuracy: Metric };
    historicalMajority: {
      status: "AVAILABLE" | "NOT_AVAILABLE";
      label?: ForwardDirection;
      accuracy?: Metric;
    };
  };
  pairedJevVsBaseline: {
    alwaysFlat: { wins: number; losses: number; ties: number };
    frozenMomentum: { wins: number; losses: number; ties: number };
  };
}

export interface ForwardExperimentLedgerSummary {
  schemaVersion: typeof FORWARD_LEDGER_SCHEMA_VERSION;
  observationCount: number;
  completedCount: number;
  pendingCount: number;
  invalidCount: number;
  failureCounts: {
    validationFailure: number;
    marketInputUnavailable: number;
    outcomeUnavailable: number;
    providerFailure: number;
  };
  attemptCount: number;
  successfulPredictionCount: number;
  failedAttemptCount: number;
  blockedAttemptCount: number;
  validationFailureCount: number;
  providerFailureCount: number;
  budgetFailureCount: number;
  storageFailureCount: number;
  predictionReconciliation: {
    attemptPredictions: number;
    predictionRecords: number;
    unmatchedAttemptPredictions: number;
    unmatchedPredictionRecords: number;
  };
  untrackedAttemptCount: number;
  untrackedPredictionCount: number;
  untrackedOutcomeCount: number;
  accuracy: Metric;
  confusionMatrix: Matrix | null;
  perClass: Record<ForwardDirection, ClassMetric> | null;
  macroF1: Metric;
  baselines: ForwardLedgerBreakdown["baselines"] | null;
  pairedJevVsBaseline: ForwardLedgerBreakdown["pairedJevVsBaseline"] | null;
  modelVersions: string[];
  taskVersions: string[];
  questionSetVersions: string[];
  marketDataPolicyVersions: string[];
  breakdowns: ForwardLedgerBreakdown[];
  sourceRecordsMutated: false;
}

function isLifecycleAttempt(
  value: ForwardExperimentAttempt,
): value is ForwardExperimentAttemptEvent {
  return "lifecycleStatus" in value;
}

function attemptIdOf(value: ForwardExperimentAttempt): string {
  return value.attemptId;
}

function terminalEvents(input: readonly ForwardExperimentAttempt[]) {
  const grouped = new Map<string, ForwardExperimentAttempt[]>();
  for (const attempt of input) {
    const group = grouped.get(attemptIdOf(attempt)) ?? [];
    group.push(attempt);
    grouped.set(attemptIdOf(attempt), group);
  }
  return [...grouped.values()].map((events) => {
    if (events.every(isLifecycleAttempt))
      return [...events].sort((a, b) => a.sequence - b.sequence).at(-1)!;
    return events[events.length - 1];
  });
}

function lifecycleStatus(value: ForwardExperimentAttempt): ForwardAttemptLifecycleStatus | null {
  if (isLifecycleAttempt(value)) return value.lifecycleStatus;
  if (value.status === "completed") return "PREDICTION_CREATED";
  if (value.status === "validation_failure") return "JEV_VALIDATION_FAILED";
  if (value.status === "provider_failure") return "JEV_TRANSPORT_FAILED";
  if (value.status === "market_input_unavailable") return "MARKET_INPUT_UNAVAILABLE";
  return null;
}

function linkedRunId(value: ForwardExperimentAttempt): string | undefined {
  if (isLifecycleAttempt(value)) return value.linkedPredictionRunId;
  return undefined;
}

function emptyMatrix(): Matrix {
  return Object.fromEntries(
    FORWARD_DIRECTION_CLASSES.map((row) => [
      row,
      Object.fromEntries(FORWARD_DIRECTION_CLASSES.map((column) => [column, 0])),
    ]),
  ) as Matrix;
}

function versionOf(record: ForwardDirectionPredictionRecord): VersionIdentity {
  return {
    model: record.model,
    taskId: record.taskId,
    taskVersion: record.taskVersion,
    questionSetVersion: record.questionSetVersion,
    marketDataPolicyVersion: record.marketDataPolicyVersion,
  };
}

function versionKey(version: VersionIdentity): string {
  return [
    version.model,
    version.taskId,
    version.taskVersion,
    version.questionSetVersion,
    version.marketDataPolicyVersion,
  ].join("\u0000");
}

function metric(value: number, denominator: number): Metric {
  return denominator > 0 ? value / denominator : "NOT_ENOUGH_DATA";
}

function pairCounts(
  predictions: readonly ForwardDirectionPredictionRecord[],
  outcomes: readonly ForwardObservedOutcome[],
  baseline: (prediction: ForwardDirectionPredictionRecord) => ForwardDirection,
) {
  const outcomesById = new Map(outcomes.map((outcome) => [outcome.originalDecisionRunId, outcome]));
  return predictions.reduce(
    (counts, prediction) => {
      const outcome = outcomesById.get(prediction.originalDecisionRunId);
      if (!outcome) return counts;
      const jevCorrect = prediction.predictedClass === outcome.label;
      const baselineCorrect = baseline(prediction) === outcome.label;
      if (jevCorrect && !baselineCorrect) counts.wins += 1;
      else if (!jevCorrect && baselineCorrect) counts.losses += 1;
      else counts.ties += 1;
      return counts;
    },
    { wins: 0, losses: 0, ties: 0 },
  );
}

function classMetrics(matrix: Matrix): Record<ForwardDirection, ClassMetric> {
  return Object.fromEntries(
    FORWARD_DIRECTION_CLASSES.map((label) => {
      const predictedSupport = FORWARD_DIRECTION_CLASSES.reduce(
        (sum, actual) => sum + matrix[label][actual],
        0,
      );
      const actualSupport = FORWARD_DIRECTION_CLASSES.reduce(
        (sum, predicted) => sum + matrix[predicted][label],
        0,
      );
      const truePositive = matrix[label][label];
      const precision = metric(truePositive, predictedSupport);
      const recall = metric(truePositive, actualSupport);
      const f1 =
        typeof precision === "number" && typeof recall === "number" && precision + recall > 0
          ? (2 * precision * recall) / (precision + recall)
          : "NOT_ENOUGH_DATA";
      return [label, { predictedSupport, actualSupport, precision, recall, f1 }];
    }),
  ) as Record<ForwardDirection, ClassMetric>;
}

function buildBreakdown(
  version: VersionIdentity,
  predictions: ForwardDirectionPredictionRecord[],
  outcomes: ForwardObservedOutcome[],
): ForwardLedgerBreakdown {
  const outcomesById = new Map(outcomes.map((outcome) => [outcome.originalDecisionRunId, outcome]));
  const linkedPredictions = predictions.filter((prediction) =>
    outcomesById.has(prediction.originalDecisionRunId),
  );
  const linkedOutcomes = linkedPredictions.map((prediction) =>
    outcomesById.get(prediction.originalDecisionRunId)!,
  );
  const pendingCount = predictions.length - linkedPredictions.length;
  const matrix = emptyMatrix();
  for (const [index, prediction] of linkedPredictions.entries()) {
    const outcome = linkedOutcomes[index];
    matrix[prediction.predictedClass][outcome.label] += 1;
  }
  const perClass = classMetrics(matrix);
  const allClassesSupported = FORWARD_DIRECTION_CLASSES.every(
    (label) =>
      perClass[label].predictedSupport > 0 &&
      perClass[label].actualSupport > 0 &&
      typeof perClass[label].f1 === "number",
  );
  const historicalLabels = predictions.map((prediction) => prediction.baselines.historicalMajority);
  const historicalAvailable =
    predictions.length > 0 &&
    predictions.every(
      (prediction) =>
        prediction.baselines.historicalMajorityStatus === "available" &&
        prediction.baselines.historicalMajority,
    );
  const historicalLabel =
    historicalAvailable && new Set(historicalLabels).size === 1 ? historicalLabels[0]! : undefined;
  const baselineAccuracy = (label: ForwardDirection): Metric =>
    metric(
      linkedOutcomes.filter((outcome) => outcome.label === label).length,
      linkedOutcomes.length,
    );
  const evaluation = linkedPredictions.length
    ? evaluateForwardBatch(linkedPredictions, linkedOutcomes, { historicalCounts: {} })
    : null;
  return {
    version,
    observationCount: linkedOutcomes.length,
    completedCount: linkedOutcomes.length,
    pendingCount,
    accuracy: evaluation ? evaluation.accuracy : "NOT_ENOUGH_DATA",
    confusionMatrix: matrix,
    perClass,
    macroF1: allClassesSupported
      ? FORWARD_DIRECTION_CLASSES.reduce((sum, label) => sum + Number(perClass[label].f1), 0) /
        FORWARD_DIRECTION_CLASSES.length
      : "NOT_ENOUGH_DATA",
    baselines: {
      alwaysFlat: { label: "FLAT", accuracy: baselineAccuracy("FLAT") },
      frozenMomentum: {
        accuracy: metric(
          linkedPredictions.filter(
            (prediction, index) =>
              prediction.baselines.frozenMomentum === linkedOutcomes[index].label,
          ).length,
          linkedPredictions.length,
        ),
      },
      historicalMajority: historicalLabel
        ? {
            status: "AVAILABLE",
            label: historicalLabel,
            accuracy: baselineAccuracy(historicalLabel),
          }
        : { status: "NOT_AVAILABLE" },
    },
    pairedJevVsBaseline: {
      alwaysFlat: pairCounts(linkedPredictions, linkedOutcomes, () => "FLAT"),
      frozenMomentum: pairCounts(
        linkedPredictions,
        linkedOutcomes,
        (prediction) => prediction.baselines.frozenMomentum,
      ),
    },
  };
}

export function summarizeForwardExperiment(input: {
  predictions: readonly ForwardDirectionPredictionRecord[];
  outcomes: readonly ForwardObservedOutcome[];
  attempts: readonly ForwardExperimentAttempt[];
}): ForwardExperimentLedgerSummary {
  const predictionById = new Map(
    input.predictions.map((prediction) => [prediction.predictionId, prediction]),
  );
  if (predictionById.size !== input.predictions.length)
    throw new Error("Duplicate prediction identity");
  const outcomeById = new Map(
    input.outcomes.map((outcome) => [outcome.originalDecisionRunId, outcome]),
  );
  if (outcomeById.size !== input.outcomes.length) throw new Error("Duplicate outcome identity");
  const predictionRunIds = new Set(
    input.predictions.map((prediction) => prediction.originalDecisionRunId),
  );
  const untrackedOutcomeCount = input.outcomes.filter(
    (outcome) => !predictionRunIds.has(outcome.originalDecisionRunId),
  ).length;
  const terminal = terminalEvents(input.attempts);
  const attemptIds = new Set(input.attempts.map(attemptIdOf));
  const lifecycleEvents = input.attempts.filter(isLifecycleAttempt);
  if (lifecycleEvents.some((event) => !event.attemptId || !event.eventId))
    throw new Error("Malformed attempt identity");
  const successfulAttempts = terminal.filter(
    (attempt) => lifecycleStatus(attempt) === "PREDICTION_CREATED",
  );
  const failedAttempts = terminal.filter((attempt) => {
    const status = lifecycleStatus(attempt);
    return status !== null && status !== "PREDICTION_CREATED" && status !== "ATTEMPT_STARTED";
  });
  const blockedAttempts = terminal.filter((attempt) => {
    const status = lifecycleStatus(attempt);
    return status !== null && status !== "PREDICTION_CREATED";
  });
  const untrackedAttemptCount = terminal.filter((attempt) => {
    const status = lifecycleStatus(attempt);
    const runId = linkedRunId(attempt);
    return status === "ATTEMPT_STARTED" || (runId !== undefined && !predictionRunIds.has(runId));
  }).length;
  const referencedPredictionRunIds = new Set(
    successfulAttempts.flatMap((attempt) => {
      const runId = linkedRunId(attempt);
      return runId ? [runId] : [];
    }),
  );
  const untrackedPredictionCount = input.predictions.filter((prediction) =>
    successfulAttempts.length > 0
      ? !referencedPredictionRunIds.has(prediction.originalDecisionRunId)
      : false,
  ).length;
  const failureCounts = {
    validationFailure: terminal.filter(
      (attempt) => lifecycleStatus(attempt) === "JEV_VALIDATION_FAILED",
    ).length,
    marketInputUnavailable: terminal.filter(
      (attempt) => lifecycleStatus(attempt) === "MARKET_INPUT_UNAVAILABLE",
    ).length,
    outcomeUnavailable: input.attempts.filter(
      (attempt) => !isLifecycleAttempt(attempt) && attempt.status === "outcome_unavailable",
    ).length,
    providerFailure: terminal.filter(
      (attempt) => lifecycleStatus(attempt) === "JEV_TRANSPORT_FAILED",
    ).length,
  };
  const invalidCount = input.attempts.filter(
    (attempt) => lifecycleStatus(attempt) === "JEV_VALIDATION_FAILED",
  ).length;
  const pendingCount = input.predictions.filter(
    (prediction) => !outcomeById.has(prediction.originalDecisionRunId),
  ).length;

  const grouped = new Map<
    string,
    { version: VersionIdentity; predictions: ForwardDirectionPredictionRecord[] }
  >();
  for (const prediction of input.predictions) {
    const version = versionOf(prediction);
    const key = versionKey(version);
    const group = grouped.get(key) ?? { version, predictions: [] };
    group.predictions.push(prediction);
    grouped.set(key, group);
  }
  const breakdowns = [...grouped.values()].map(({ version, predictions }) =>
    buildBreakdown(
      version,
      predictions,
      predictions.flatMap((prediction) => {
        const outcome = outcomeById.get(prediction.originalDecisionRunId);
        return outcome ? [outcome] : [];
      }),
    ),
  );
  const homogeneous = breakdowns.length === 1;
  const first = homogeneous ? breakdowns[0] : null;
  const countStatus = (status: ForwardAttemptLifecycleStatus) =>
    terminal.filter((attempt) => lifecycleStatus(attempt) === status).length;
  const attemptPredictions = successfulAttempts.filter((attempt) => linkedRunId(attempt)).length;
  const unmatchedAttemptPredictions = successfulAttempts.filter((attempt) => {
    const runId = linkedRunId(attempt);
    return !runId || !predictionRunIds.has(runId);
  }).length;
  const unmatchedPredictionRecords = input.predictions.filter(
    (prediction) => !referencedPredictionRunIds.has(prediction.originalDecisionRunId),
  ).length;
  return {
    schemaVersion: FORWARD_LEDGER_SCHEMA_VERSION,
    observationCount: input.outcomes.length,
    completedCount: input.outcomes.length,
    pendingCount,
    invalidCount,
    failureCounts,
    attemptCount: attemptIds.size,
    successfulPredictionCount: successfulAttempts.filter((attempt) => {
      const runId = linkedRunId(attempt);
      return runId !== undefined && predictionRunIds.has(runId);
    }).length,
    failedAttemptCount: failedAttempts.length,
    blockedAttemptCount: blockedAttempts.length,
    validationFailureCount: countStatus("JEV_VALIDATION_FAILED"),
    providerFailureCount: countStatus("JEV_TRANSPORT_FAILED"),
    budgetFailureCount: countStatus("BUDGET_BLOCKED"),
    storageFailureCount: countStatus("STORAGE_FAILED"),
    predictionReconciliation: {
      attemptPredictions,
      predictionRecords: input.predictions.length,
      unmatchedAttemptPredictions,
      unmatchedPredictionRecords,
    },
    untrackedAttemptCount,
    untrackedPredictionCount,
    untrackedOutcomeCount,
    accuracy: first?.accuracy ?? "NOT_COMBINED",
    confusionMatrix: first?.confusionMatrix ?? null,
    perClass: first?.perClass ?? null,
    macroF1: first?.macroF1 ?? "NOT_COMBINED",
    baselines: first?.baselines ?? null,
    pairedJevVsBaseline: first?.pairedJevVsBaseline ?? null,
    modelVersions: [...new Set(input.predictions.map((prediction) => prediction.model))].sort(),
    taskVersions: [
      ...new Set(input.predictions.map((prediction) => prediction.taskVersion)),
    ].sort(),
    questionSetVersions: [
      ...new Set(input.predictions.map((prediction) => prediction.questionSetVersion)),
    ].sort(),
    marketDataPolicyVersions: [
      ...new Set(input.predictions.map((prediction) => prediction.marketDataPolicyVersion)),
    ].sort(),
    breakdowns,
    sourceRecordsMutated: false,
  };
}
