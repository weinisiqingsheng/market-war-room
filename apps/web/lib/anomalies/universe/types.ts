/**
 * Versioned anomaly universe contract (V1.1E).
 *
 * A universe definition only changes *candidate membership*; anomaly-v1
 * scoring, severity, ranking and missing-data semantics are identical for
 * every universe. Definitions are static, offline-generated snapshots — no
 * runtime scraping, no per-request regeneration.
 */
export type AnomalyUniverseId = "sp500" | "nasdaq100";

export interface AnomalyUniverseMember {
  ticker: string;
  name: string;
  /** GICS sector used for sector-relative comparisons (sector-map.ts). */
  sector: string;
  /**
   * Where the sector value came from:
   * - `sp500` — reused canonical S&P 500 snapshot sector (overlapping symbols;
   *   guarantees identical sector-relative math across universes)
   * - `icb` — normalized from the snapshot source's own ICB industry column
   */
  sectorSource?: "sp500" | "icb";
}

export interface AnomalyUniverseDefinition {
  id: AnomalyUniverseId;
  /** Human label shown in the Markets universe selector. */
  label: string;
  version: string;
  asOf: string;
  /** Derived from `members`, never hard-coded. */
  count: number;
  /** Derived from `members`, never hard-coded. */
  symbols: string[];
  members: AnomalyUniverseMember[];
  /** Offline provenance of the membership snapshot. */
  source: string;
}
