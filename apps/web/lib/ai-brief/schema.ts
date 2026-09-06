/**
 * Phase 7B.1 — strict runtime schema for ai-brief-v1 (no Zod dependency).
 * Rejects missing fields, wrong version/enums, empty required evidenceRefs,
 * malformed tickers, out-of-bounds array sizes, and unexpected types.
 * No coercion; malformed model output fails explicitly.
 */
import { AI_BRIEF_VERSION } from "./brief-types";
import type { GroundedMarketBrief } from "./brief-types";

export const BRIEF_BOUNDS = {
  headlineMin: 1,
  overviewMin: 1,
  overviewMax: 3,
  driversMin: 2,
  driversMax: 5,
  notableMovesMax: 6,
  watchNextMin: 1,
  watchNextMax: 4,
} as const;

export type SchemaResult =
  | { ok: true; brief: GroundedMarketBrief }
  | { ok: false; errors: string[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function requireSection(value: unknown, path: string): BriefSectionResult {
  if (!isRecord(value) || !isNonEmptyString(value.text)) {
    return { ok: false, error: `${path} must be an object with non-empty text.` };
  }
  return requireRefs(value.evidenceRefs, `${path}.evidenceRefs`);
}

type BriefSectionResult = { ok: true } | { ok: false; error: string };

function requireRefs(value: unknown, path: string): BriefSectionResult {
  if (!Array.isArray(value) || value.length === 0) {
    return { ok: false, error: `${path} must be a non-empty array.` };
  }
  if (!value.every((ref) => typeof ref === "string" && ref.length > 0)) {
    return { ok: false, error: `${path} entries must be non-empty strings.` };
  }
  return { ok: true };
}

function within(value: unknown, min: number, max: number): value is unknown[] {
  return Array.isArray(value) && value.length >= min && value.length <= max;
}

export function parseGroundedMarketBrief(value: unknown): SchemaResult {
  const errors: string[] = [];
  if (!isRecord(value)) return { ok: false, errors: ["payload must be an object."] };
  if (value.version !== AI_BRIEF_VERSION) errors.push(`version must be ${AI_BRIEF_VERSION}.`);
  if (!isNonEmptyString(value.headline)) errors.push("headline must be a non-empty string.");

  const stance = value.stance as Record<string, unknown> | undefined;
  if (!isRecord(stance)) {
    errors.push("stance is required.");
  } else {
    if (!isNonEmptyString(stance.label)) errors.push("stance.label must be a non-empty string.");
    if (!isNonEmptyString(stance.summary)) errors.push("stance.summary must be a non-empty string.");
    if (!Array.isArray(stance.evidenceRefs) || stance.evidenceRefs.length === 0) errors.push("stance.evidenceRefs must be a non-empty array.");
  }

  if (!within(value.overview, BRIEF_BOUNDS.overviewMin, BRIEF_BOUNDS.overviewMax)) errors.push("overview must contain 1-3 items.");
  else if (Array.isArray(value.overview)) {
    for (const item of value.overview) {
      const check = requireSection(item, "overview[]");
      if (!check.ok) errors.push(check.error);
    }
  }

  if (!within(value.keyDrivers, BRIEF_BOUNDS.driversMin, BRIEF_BOUNDS.driversMax)) errors.push("keyDrivers must contain 2-5 items.");
  else if (Array.isArray(value.keyDrivers)) {
    const impacts = new Set(["positive", "negative", "mixed"]);
    for (const item of value.keyDrivers) {
      if (!isRecord(item) || !isNonEmptyString(item.title)) errors.push("keyDrivers[] title required.");
      if (!isRecord(item) || typeof item.impact !== "string" || !impacts.has(item.impact)) errors.push("keyDrivers[] impact must be positive|negative|mixed.");
      const check = requireSection(item, "keyDrivers[]");
      if (!check.ok) errors.push(check.error);
    }
  }

  for (const sectionName of ["marketInternals", "macro"] as const) {
    const section = value[sectionName] as unknown;
    const check = requireSection(section, sectionName);
    if (!check.ok) errors.push(check.error);
  }

  if (!within(value.notableMoves, 0, BRIEF_BOUNDS.notableMovesMax)) errors.push("notableMoves must contain 0-6 items.");
  else if (Array.isArray(value.notableMoves)) {
    for (const item of value.notableMoves) {
      if (!isRecord(item) || !/^[A-Z][A-Z0-9.\-]{0,9}$/.test(String(item.ticker ?? ""))) errors.push("notableMoves[] ticker must be an uppercase ticker-like string.");
      const check = requireSection(item, "notableMoves[]");
      if (!check.ok) errors.push(check.error);
    }
  }

  if (!within(value.watchNext, BRIEF_BOUNDS.watchNextMin, BRIEF_BOUNDS.watchNextMax)) errors.push("watchNext must contain 1-4 items.");
  else if (Array.isArray(value.watchNext)) {
    for (const item of value.watchNext) {
      const check = requireSection(item, "watchNext[]");
      if (!check.ok) errors.push(check.error);
    }
  }

  const dq = value.dataQuality as Record<string, unknown> | undefined;
  if (!isRecord(dq)) {
    errors.push("dataQuality is required.");
  } else {
    if (!["high", "medium", "low"].includes(String(dq.confidence))) errors.push("dataQuality.confidence must be high|medium|low.");
    const check = requireSection(dq, "dataQuality");
    if (!check.ok) errors.push(check.error);
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, brief: value as unknown as GroundedMarketBrief };
}
