/**
 * Phase 7A.1 — stable fingerprinting for brief-context-v1.
 *
 * Fingerprint semantics:
 * - Input = evidence fact IDs/domains/text/data, per-fact asOf/freshness/
 *   confidence/sourceVersion, and per-source metadata (version/asOf/…).
 * - `generatedAt` is EXCLUDED: orchestration time alone must not invalidate an
 *   otherwise identical evidence pack.
 * - Evidence arrays are canonicalized by sorting on the stable evidence `id`
 *   BEFORE hashing, so accidental array-order differences cannot produce a new
 *   fingerprint. Nested arrays INSIDE fact.data keep their semantic order
 *   (they are meaningfully ordered, e.g. ranked driver lists).
 * - Object keys are recursively sorted; the digest is a lowercase SHA-256 hex.
 *
 * Pure functions: no I/O, no cache, no network.
 */
import { createHash } from "node:crypto";
import type { BriefContext, JSONValue } from "./types";

/** Recursively serialize any JSON-safe value with sorted object keys. */
export function canonicalizeJson(value: JSONValue): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalizeJson(item)).join(",")}]`;
  }
  const keys = Object.keys(value).sort();
  return `{${keys.map((key) => `${canonicalizeJson(key)}:${canonicalizeJson(value[key])}`).join(",")}}`;
}

/** Normalize an EvidenceFact to its fingerprint-relevant fields. */
export function canonicalizeEvidenceForFingerprint(fact: {
  id: string;
  domain: string;
  text: string;
  data: JSONValue;
  asOf: string | null;
  freshness: string;
  confidence: string | null;
  sourceVersion: string | null;
}): string {
  return canonicalizeJson({
    id: fact.id,
    domain: fact.domain,
    text: fact.text,
    data: fact.data,
    asOf: fact.asOf,
    freshness: fact.freshness,
    confidence: fact.confidence,
    sourceVersion: fact.sourceVersion,
  });
}

/** SHA-256 (lowercase hex) over a canonicalized BriefContext, sans generatedAt. */
export function fingerprintBriefEvidence(context: BriefContext): string {
  const evidence = [...context.evidence].sort((a, b) => a.id.localeCompare(b.id));
  const payload: JSONValue = {
    version: context.version,
    sources: {
      market: toPlainSource(context.sources.market),
      macro: toPlainSource(context.sources.macro),
      regime: toPlainSource(context.sources.regime),
      breadth: toPlainSource(context.sources.breadth),
      anomalies: toPlainSource(context.sources.anomalies),
      catalysts: toPlainSource(context.sources.catalysts),
    },
    evidence: evidence.map((fact) => canonicalizeFact(fact)),
    inputConfidence: { score: context.inputConfidence.score, label: context.inputConfidence.label },
  };
  return createHash("sha256").update(canonicalizeJson(payload), "utf8").digest("hex");
}

function toPlainSource(source: BriefContext["sources"]["market"]): JSONValue {
  return {
    available: source.available,
    asOf: source.asOf,
    freshness: source.freshness,
    confidence: source.confidence,
    version: source.version,
  };
}

function canonicalizeFact(fact: BriefContext["evidence"][number]): JSONValue {
  return {
    id: fact.id,
    domain: fact.domain,
    text: fact.text,
    data: fact.data,
    asOf: fact.asOf,
    freshness: fact.freshness,
    confidence: fact.confidence,
    sourceVersion: fact.sourceVersion,
  };
}
