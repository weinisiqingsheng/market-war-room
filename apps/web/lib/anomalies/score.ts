/**
 * anomaly-v1 scoring, severity, triggers, reasons and ranking (deterministic).
 */
import {
  CONFIDENCE_HIGH,
  CONFIDENCE_LOW,
  CONFIDENCE_MEDIUM,
  GAP_ATR_POINTS,
  RANGE_POINTS,
  RETURN_SIGMA_POINTS,
  SCORE_WEIGHTS,
  SECTOR_SIGMA_POINTS,
  SEVERITY_ELEVATED,
  SEVERITY_EXTREME,
  SEVERITY_HIGH,
  VOLUME_POINTS,
} from "./constants";
import type { AnomalyMetricDraft } from "./metrics";
import type {
  AnomalyCandidate,
  AnomalyComponentId,
  AnomalyComponentScores,
  AnomalyConfidence,
  AnomalySeverity,
  AnomalyTrigger,
} from "./types";

export function mapPoints(x: number, points: ReadonlyArray<readonly [number, number]>): number {
  if (x <= points[0][0]) return points[0][1];
  if (x >= points[points.length - 1][0]) return points[points.length - 1][1];
  for (let i = 0; i < points.length - 1; i += 1) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[i + 1];
    if (x0 <= x && x <= x1) {
      const span = x1 - x0;
      return span === 0 ? y0 : y0 + ((y1 - y0) * (x - x0)) / span;
    }
  }
  return points[points.length - 1][1];
}

export function returnShockScore(sigma: number): number {
  return mapPoints(sigma, RETURN_SIGMA_POINTS);
}

export function sectorDivergenceScore(sigma: number): number {
  return mapPoints(sigma, SECTOR_SIGMA_POINTS);
}

export function gapShockScore(atrRatio: number): number {
  return mapPoints(atrRatio, GAP_ATR_POINTS);
}

export function rangeExpansionScore(ratio: number): number {
  return mapPoints(ratio, RANGE_POINTS);
}

export function volumeParticipationScore(multiple: number): number {
  return mapPoints(multiple, VOLUME_POINTS);
}

export function breakoutComponentScore(breakout: boolean, breakdown: boolean): number {
  return breakout || breakdown ? 100 : 0;
}

export function componentScores(metrics: AnomalyMetricDraft): AnomalyComponentScores {
  return {
    returnShock: metrics.returnSigma === null ? null : returnShockScore(metrics.returnSigma),
    sectorDivergence:
      metrics.sectorRelativeSigma === null
        ? null
        : sectorDivergenceScore(metrics.sectorRelativeSigma),
    gapShock: metrics.gapAtrRatio === null ? null : gapShockScore(metrics.gapAtrRatio),
    rangeExpansion:
      metrics.rangeExpansionRatio === null
        ? null
        : rangeExpansionScore(metrics.rangeExpansionRatio),
    volumeParticipation:
      metrics.volumeParticipation === null
        ? null
        : volumeParticipationScore(metrics.volumeParticipation),
    breakout: breakoutComponentScore(metrics.breakout20, metrics.breakdown20),
  };
}

const COMPONENT_ORDER: AnomalyComponentId[] = [
  "returnShock",
  "sectorDivergence",
  "gapShock",
  "rangeExpansion",
  "volumeParticipation",
  "breakout",
];

/** Weighted mean over available components; missing components are never neutral. */
export function overallAnomalyScore(components: AnomalyComponentScores): number | null {
  if (components.returnShock === null) return null;
  let total = 0;
  let weight = 0;
  for (const id of COMPONENT_ORDER) {
    const score = components[id];
    if (score === null) continue;
    total += score * SCORE_WEIGHTS[id];
    weight += SCORE_WEIGHTS[id];
  }
  return weight > 0 ? total / weight : null;
}

export function dataCoverageOf(components: AnomalyComponentScores): number {
  return COMPONENT_ORDER.filter((id) => components[id] !== null).length / COMPONENT_ORDER.length;
}

export function anomalySeverity(score: number): AnomalySeverity {
  if (score >= SEVERITY_EXTREME) return "EXTREME";
  if (score >= SEVERITY_HIGH) return "HIGH";
  if (score >= SEVERITY_ELEVATED) return "ELEVATED";
  return "NORMAL";
}

/** Highest weighted component contribution wins; ties break on component order. */
export function primaryTrigger(
  components: AnomalyComponentScores,
  metrics: AnomalyMetricDraft,
): AnomalyTrigger | null {
  let best: { id: AnomalyComponentId; value: number } | null = null;
  for (const id of COMPONENT_ORDER) {
    const score = components[id];
    if (score === null) continue;
    const contribution = SCORE_WEIGHTS[id] * score;
    if (best === null || contribution > best.value) best = { id, value: contribution };
  }
  if (!best) return null;
  if (best.id === "breakout") {
    return metrics.breakout20 ? "20D BREAKOUT" : "20D BREAKDOWN";
  }
  const LABELS: Record<Exclude<AnomalyComponentId, "breakout">, AnomalyTrigger> = {
    returnShock: "RETURN SHOCK",
    sectorDivergence: "SECTOR DIVERGENCE",
    gapShock: "GAP SHOCK",
    rangeExpansion: "RANGE EXPANSION",
    volumeParticipation: "VOLUME SURGE",
  };
  return LABELS[best.id as Exclude<AnomalyComponentId, "breakout">];
}

/** Deterministic reason strings. No catalyst/news claims. */
export function buildReasons(metrics: AnomalyMetricDraft, sectorEtf: string): string[] {
  const reasons: string[] = [];
  if (metrics.returnSigma !== null) {
    reasons.push(
      `${metrics.dailyMovePct > 0 ? "+" : ""}${metrics.dailyMovePct.toFixed(1)}% move equals ${metrics.returnSigma.toFixed(1)}× its 20D daily volatility`,
    );
  }
  if (metrics.sectorRelativePct !== null && metrics.sectorRelativeSigma !== null) {
    const verb = metrics.sectorRelativePct > 0 ? "Outperforming" : "Underperforming";
    reasons.push(
      `${verb} ${sectorEtf} by ${Math.abs(metrics.sectorRelativePct).toFixed(1)} percentage points`,
    );
  }
  if (metrics.gapPct !== null && metrics.gapAtrRatio !== null) {
    const direction = metrics.gapPct > 0 ? "above" : "below";
    reasons.push(`Opened ${metrics.gapAtrRatio.toFixed(1)} ATR ${direction} the prior close`);
  }
  if (metrics.rangeExpansionRatio !== null) {
    reasons.push(`Today's range is ${metrics.rangeExpansionRatio.toFixed(1)}× 20D ATR`);
  }
  if (metrics.volumeParticipation !== null) {
    reasons.push(
      `${metrics.volumeParticipation.toFixed(1)}× its 20D average full-day volume has traded`,
    );
  }
  if (metrics.breakout20) reasons.push("Trading above its prior 20-day high");
  if (metrics.breakdown20) reasons.push("Trading below its prior 20-day low");
  reasons.push("Statistical anomaly detected — catalyst not evaluated");
  return reasons;
}

export function anomalyConfidence(coveragePct: number): AnomalyConfidence {
  if (coveragePct >= CONFIDENCE_HIGH) return "high";
  if (coveragePct >= CONFIDENCE_MEDIUM) return "medium";
  if (coveragePct >= CONFIDENCE_LOW) return "low";
  return "insufficient";
}

/** Deterministic ranking comparator (score desc → sigma desc → |move| desc → ticker). */
export function compareAnomalies(a: AnomalyCandidate, b: AnomalyCandidate): number {
  if (a.anomalyScore !== b.anomalyScore) return b.anomalyScore - a.anomalyScore;
  if (a.metrics.returnSigma !== b.metrics.returnSigma) {
    return b.metrics.returnSigma - a.metrics.returnSigma;
  }
  if (Math.abs(a.dailyMovePct) !== Math.abs(b.dailyMovePct)) {
    return Math.abs(b.dailyMovePct) - Math.abs(a.dailyMovePct);
  }
  return a.ticker.localeCompare(b.ticker);
}
