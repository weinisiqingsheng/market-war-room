import type { MacroFrequency, MacroProviderId, MacroSignalId } from "@war-room/types";

/**
 * Provider-normalized macro snapshot — the neutral shape each provider returns
 * BEFORE display interpretation is applied. Raw FRED / Twelve Data / Alpaca
 * shapes never cross this boundary.
 */
export interface NormalizedMacroSnapshot {
  id: MacroSignalId;
  value: number | null;
  change: number | null;
  changePct: number | null;
  frequency: MacroFrequency;
  asOf: string | null;
  available: boolean;
}

export interface MacroProviderResult {
  provider: MacroProviderId;
  signals: NormalizedMacroSnapshot[];
  /** True when serving previously-fetched data after an upstream failure. */
  degraded: boolean;
}

export function unavailableMacroSnapshot(
  id: MacroSignalId,
  frequency: MacroFrequency,
): NormalizedMacroSnapshot {
  return {
    id,
    value: null,
    change: null,
    changePct: null,
    frequency,
    asOf: null,
    available: false,
  };
}
