/**
 * Canonical S&P 500 anomaly universe.
 *
 * Thin adapter over the existing canonical breadth universe — membership is
 * reused, never copied or regenerated here (V1.1E keeps one source of truth).
 */
import { sp500Universe } from "@/lib/breadth/universe/sp500";
import type { AnomalyUniverseDefinition } from "./types";

export const sp500AnomalyUniverse: AnomalyUniverseDefinition = {
  id: "sp500",
  label: sp500Universe.name,
  version: sp500Universe.version,
  asOf: sp500Universe.asOf,
  count: sp500Universe.count,
  symbols: sp500Universe.members.map((member) => member.ticker),
  members: sp500Universe.members.map((member) => ({
    ticker: member.ticker,
    name: member.name,
    sector: member.sector,
    sectorSource: "sp500",
  })),
  source: "canonical lib/breadth/universe/sp500.ts (sp500-v1, reuse — not copied)",
};
