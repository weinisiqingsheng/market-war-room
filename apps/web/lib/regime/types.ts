/**
 * Canonical regime input/transport types (Next.js side).
 *
 * These are the *payload contract* between the Next.js orchestration layer and
 * the Python engine. Scoring itself lives only in the Python analytics service.
 */
import type { MacroFrequency, MacroSignalId } from "@war-room/types";

export interface RegimeIndexInput {
  ticker: string;
  changePct: number | null;
  available: boolean;
  stale: boolean;
}

export interface RegimeSectorInput {
  ticker: string;
  changePct: number | null;
  available: boolean;
  stale: boolean;
}

export interface RegimeMacroSignalInput {
  value: number | null;
  change: number | null;
  changePct: number | null;
  available: boolean;
  stale: boolean;
  frequency: MacroFrequency;
}

export interface RegimeMacroInput {
  vix: RegimeMacroSignalInput | null;
  us10y: RegimeMacroSignalInput | null;
  usd_broad: RegimeMacroSignalInput | null;
  wti: RegimeMacroSignalInput | null;
  gold: RegimeMacroSignalInput | null;
  btc: RegimeMacroSignalInput | null;
}

/** The exact JSON payload posted to POST /v1/regime/evaluate (snake_case). */
export interface RegimeInputPayload {
  as_of: string | null;
  indices: RegimeIndexInput[];
  sectors: RegimeSectorInput[];
  macro: RegimeMacroInput | null;
}

/** Signal lookup convenience used across pillars. */
export type MacroSignalByKey = Record<MacroSignalId, RegimeMacroSignalInput>;
