import "server-only";
import type {
  MacroDataMeta,
  MacroOverview,
  MacroProviderId,
  MacroSignal,
  MacroSignalId,
  Tone,
} from "@war-room/types";
import { demoMarketData } from "@/data/demo-market";
import { logProviderIssue } from "@/lib/market-data/log";
import type { MacroDataConfig } from "./config";
import { withMacroProviderCache } from "./cache";
import { computeMacroStale, interpretMacroSignal } from "./interpret";
import { parseIsoMs } from "./normalize";
import { getMacroProvider } from "./provider";
import { MACRO_SIGNALS, MACRO_SIGNAL_IDS } from "./symbols";
import {
  unavailableMacroSnapshot,
  type MacroProviderResult,
  type NormalizedMacroSnapshot,
} from "./types";

const ALL_PROVIDERS: MacroProviderId[] = ["fred", "twelve", "alpaca-crypto"];

interface SnapshotWithMeta extends NormalizedMacroSnapshot {
  source: string;
  degraded: boolean;
}

/**
 * Builds the normalized macro overview in live mode.
 * Partial failure is first-class: one provider failing never blanks the whole
 * module — its signals render unavailable, the others keep their real data.
 */
export async function buildMacroOverview(
  config: MacroDataConfig,
  fetchImpl?: typeof fetch,
): Promise<MacroOverview> {
  if (config.mode === "demo") return buildDemoMacroOverview();

  const results: MacroProviderResult[] = await Promise.all(
    ALL_PROVIDERS.map(async (provider) => {
      try {
        const loader = getMacroProvider(config, provider, fetchImpl);
        return await withMacroProviderCache(provider, loader);
      } catch (error) {
        logProviderIssue(
          "unknown",
          undefined,
          provider,
          error instanceof Error ? error.message : "provider fetch failed",
        );
        return {
          provider,
          signals: signalsOwnedBy(provider).map((id) =>
            unavailableMacroSnapshot(id, MACRO_SIGNALS[id].frequency),
          ),
          degraded: false,
        };
      }
    }),
  );

  const byId = new Map<MacroSignalId, SnapshotWithMeta>();
  for (const result of results) {
    for (const snapshot of result.signals) {
      byId.set(snapshot.id, {
        ...snapshot,
        source: MACRO_SIGNALS[snapshot.id].source,
        degraded: result.degraded,
      });
    }
  }

  const now = Date.now();
  const signals: MacroSignal[] = MACRO_SIGNAL_IDS.map((id) =>
    buildMacroSignal(id, byId.get(id), config, now),
  );

  return { meta: buildMacroMeta(signals, config), signals };
}

export function buildDemoMacroOverview(): MacroOverview {
  return {
    meta: { mode: "demo", asOf: null, stale: false, providers: [] },
    signals: demoMarketData.macro,
  };
}

function signalsOwnedBy(provider: MacroProviderId): MacroSignalId[] {
  return MACRO_SIGNAL_IDS.filter((id) => MACRO_SIGNALS[id].provider === provider);
}

function buildMacroSignal(
  id: MacroSignalId,
  snapshot: SnapshotWithMeta | undefined,
  config: MacroDataConfig,
  now: number,
): MacroSignal {
  const definition = MACRO_SIGNALS[id];

  if (!snapshot || !snapshot.available) {
    return {
      id,
      label: definition.label,
      instrument: definition.instrument,
      value: null,
      displayUnit: definition.displayUnit,
      change: null,
      changePct: null,
      interpretation: null,
      tone: "neutral",
      source: definition.source,
      frequency: definition.frequency,
      asOf: null,
      stale: false,
      available: false,
    };
  }

  const interpretation = interpretMacroSignal(
    id,
    snapshot.value,
    snapshot.change,
    snapshot.changePct,
  );

  return {
    id,
    label: definition.label,
    instrument: definition.instrument,
    value: snapshot.value,
    displayUnit: definition.displayUnit,
    change: snapshot.change,
    changePct: snapshot.changePct,
    interpretation: interpretation?.interpretation ?? null,
    tone: (interpretation?.tone ?? "neutral") as Tone,
    source: snapshot.source,
    frequency: snapshot.frequency,
    asOf: snapshot.asOf,
    stale: snapshot.degraded || computeMacroStale(snapshot.frequency, snapshot.asOf, config, now),
    available: true,
  };
}

function buildMacroMeta(signals: MacroSignal[], config: MacroDataConfig): MacroDataMeta {
  const available = signals.filter((signal) => signal.available);
  const asOfs = available
    .map((signal) => signal.asOf)
    .filter((value): value is string => value !== null);
  asOfs.sort((a, b) => (parseIsoMs(b) ?? 0) - (parseIsoMs(a) ?? 0));

  return {
    mode: config.mode,
    asOf: asOfs[0] ?? null,
    stale: signals.some((signal) => signal.stale),
    providers: [...new Set(available.map((signal) => MACRO_SIGNALS[signal.id].provider))],
  };
}
