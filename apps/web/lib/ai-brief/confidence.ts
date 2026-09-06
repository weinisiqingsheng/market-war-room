/**
 * Phase 7A.3 — deterministic INPUT confidence (evidence quality only).
 *
 * Answers "how trustworthy/complete is the input evidence", never bullish/
 * bearish direction, prediction confidence, or catalyst causality.
 *
 * domainQuality = availability × freshness × reportedConfidence × coverage ×
 * reliability. Overall = Σ(weight × domainQuality) over the six fixed domains.
 * Missing/unavailable domains reduce the score — weights are NOT renormalized.
 * Delayed SIP is high-quality evidence (0.95), not poor data.
 */
import type {
  BriefConfidenceInput,
  BriefDomainConfidenceDetail,
  BriefDomainQualityInput,
  BriefInputConfidence,
  BriefInputConfidenceDetailed,
  EvidenceConfidence,
  EvidenceFreshness,
} from "./types";

export const DOMAIN_WEIGHTS = {
  market: 0.2,
  macro: 0.15,
  regime: 0.2,
  breadth: 0.15,
  anomalies: 0.15,
  catalysts: 0.15,
} as const;

const FRESHNESS_FACTOR: Record<EvidenceFreshness, number> = {
  fresh: 1.0,
  delayed: 0.95,
  stale: 0.75,
  unavailable: 0.0,
};

const CONFIDENCE_FACTOR: Record<EvidenceConfidence, number> = {
  high: 1.0,
  medium: 0.85,
  low: 0.65,
  insufficient: 0.0,
};

function assertUnit(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`Invalid ${label} ${value}: must be a finite value in [0, 1].`);
  }
}

function domainQuality(input: BriefDomainQualityInput, label: string): number {
  const coverage = input.coverage ?? 1;
  const reliability = input.reliabilityFactor ?? 1;
  assertUnit(coverage, `${label}.coverage`);
  assertUnit(reliability, `${label}.reliabilityFactor`);

  const available = input.meta.available !== false && input.meta.freshness !== "unavailable";
  const availabilityFactor = available ? 1 : 0;
  const freshnessFactor = FRESHNESS_FACTOR[input.meta.freshness] ?? 0;
  const confidenceFactor = input.meta.confidence === null || input.meta.confidence === undefined ? 1 : CONFIDENCE_FACTOR[input.meta.confidence] ?? 0;

  return availabilityFactor * freshnessFactor * confidenceFactor * coverage * reliability;
}

export function confidenceLabel(score: number): EvidenceConfidence {
  assertUnit(score, "score");
  if (score >= 0.9) return "high";
  if (score >= 0.75) return "medium";
  if (score >= 0.6) return "low";
  return "insufficient";
}

export function computeBriefInputConfidenceDetailed(input: BriefConfidenceInput): BriefInputConfidenceDetailed {
  const entries = Object.keys(DOMAIN_WEIGHTS) as Array<keyof BriefConfidenceInput>;
  const domains = {} as BriefInputConfidenceDetailed["domains"];
  let score = 0;
  for (const key of entries) {
    const weight = DOMAIN_WEIGHTS[key];
    const quality = domainQuality(input[key], key);
    domains[key] = { weight, quality, contribution: weight * quality } as BriefDomainConfidenceDetail;
    score += weight * quality;
  }
  return { score, label: confidenceLabel(score), domains };
}

export function computeBriefInputConfidence(input: BriefConfidenceInput): BriefInputConfidence {
  const detailed = computeBriefInputConfidenceDetailed(input);
  return { score: detailed.score, label: detailed.label };
}
