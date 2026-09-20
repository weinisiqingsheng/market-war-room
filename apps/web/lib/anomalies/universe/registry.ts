/**
 * Anomaly universe registry — the single place that maps a universe id to its
 * versioned definition. Default is `sp500` so every existing consumer keeps its
 * canonical behavior; `nasdaq100` is opt-in from the Markets workspace only.
 */
import { sp500AnomalyUniverse } from "./sp500";
import { nasdaq100AnomalyUniverse } from "./nasdaq100";
import type { AnomalyUniverseDefinition, AnomalyUniverseId } from "./types";

export const DEFAULT_ANOMALY_UNIVERSE_ID: AnomalyUniverseId = "sp500";

export const ANOMALY_UNIVERSES: Readonly<Record<AnomalyUniverseId, AnomalyUniverseDefinition>> = {
  sp500: sp500AnomalyUniverse,
  nasdaq100: nasdaq100AnomalyUniverse,
};

/** Selector order shown in the Markets workspace. */
export const ANOMALY_UNIVERSE_IDS: readonly AnomalyUniverseId[] = ["sp500", "nasdaq100"];

export function isAnomalyUniverseId(value: unknown): value is AnomalyUniverseId {
  return (
    typeof value === "string" && Object.prototype.hasOwnProperty.call(ANOMALY_UNIVERSES, value)
  );
}

/** Resolve an id to its definition, or null for an unsupported value. */
export function resolveAnomalyUniverse(value: unknown): AnomalyUniverseDefinition | null {
  return isAnomalyUniverseId(value) ? ANOMALY_UNIVERSES[value] : null;
}

/** Resolve with the documented default (sp500) for missing values ONLY. */
export function anomalyUniverseOrDefault(value?: unknown): AnomalyUniverseDefinition {
  return resolveAnomalyUniverse(value) ?? ANOMALY_UNIVERSES[DEFAULT_ANOMALY_UNIVERSE_ID];
}

export type { AnomalyUniverseDefinition, AnomalyUniverseId, AnomalyUniverseMember } from "./types";
