/**
 * Phase 7A.4 — deterministic BriefContext assembly (brief-context-v1).
 *
 * Pure assembler: EvidenceFact builder → input confidence → fingerprint over a
 * projection that EXCLUDES generatedAt and the fingerprint value itself.
 * No Date.now, no fetch, no env, no cache, no network.
 */
import { buildEvidenceFacts } from "./evidence";
import { computeBriefInputConfidence } from "./confidence";
import { fingerprintBriefEvidence } from "./fingerprint";
import type {
  BriefConfidenceInput,
  BriefContext,
  EvidenceBuilderInput,
  EvidenceFact,
} from "./types";

export interface BuildBriefContextInput {
  generatedAt: string;
  evidenceInput: EvidenceBuilderInput;
  sources: BriefContext["sources"];
  confidenceInput: BriefConfidenceInput;
}

function assertInvariants(input: BuildBriefContextInput, facts: EvidenceFact[], score: number): void {
  if (typeof input.generatedAt !== "string" || input.generatedAt.length === 0) {
    throw new Error("generatedAt must be a non-empty ISO string supplied by the caller.");
  }
  if (facts.length > 50) {
    throw new Error(`BriefContext exceeds 50 evidence facts (got ${facts.length}).`);
  }
  if (!Number.isFinite(score) || score < 0 || score > 1) {
    throw new Error(`input confidence must be within 0..1 (got ${score}).`);
  }
}

export function buildBriefContext(input: BuildBriefContextInput): BriefContext {
  const facts = buildEvidenceFacts(input.evidenceInput);
  const inputConfidence = computeBriefInputConfidence(input.confidenceInput);
  assertInvariants(input, facts, inputConfidence.score);

  // Fingerprint is computed over a projection WITHOUT generatedAt and WITHOUT
  // the final fingerprint value (see fingerprint.ts — it already omits
  // generatedAt, so an empty placeholder is safe and non-circular).
  const contextWithPlaceholder: BriefContext = {
    version: "brief-context-v1",
    generatedAt: input.generatedAt,
    sources: input.sources,
    evidence: facts,
    inputConfidence,
    fingerprint: "",
  };
  const fingerprint = fingerprintBriefEvidence(contextWithPlaceholder);
  return { ...contextWithPlaceholder, fingerprint };
}
