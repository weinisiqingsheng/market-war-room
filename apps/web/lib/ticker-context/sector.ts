/**
 * Canonical sector classification for an on-demand ticker.
 *
 * Reuses the two verified, versioned offline universes (GICS sectors captured
 * during offline generation) — no runtime sector guessing, no SIC/ICB
 * reclassification. A symbol absent from both universes has NO sector evidence;
 * sector-relative claims are then omitted entirely.
 */
import { sp500Universe } from "@/lib/breadth/universe/sp500";
import { nasdaq100AnomalyUniverse } from "@/lib/anomalies/universe/nasdaq100";
import { sectorEtfFor } from "@/lib/anomalies/sector-map";

export interface TickerSectorContext {
  sector: string;
  benchmarkEtf: string;
  classificationSource: "sp500-v1" | "nasdaq100-v1";
}

const sectorBySymbol = new Map<string, TickerSectorContext>();
for (const member of sp500Universe.members) {
  sectorBySymbol.set(member.ticker.toUpperCase(), {
    sector: member.sector,
    benchmarkEtf: sectorEtfFor(member.sector) ?? "",
    classificationSource: "sp500-v1",
  });
}
for (const member of nasdaq100AnomalyUniverse.members) {
  const symbol = member.ticker.toUpperCase();
  if (!member.sector || sectorBySymbol.has(symbol)) continue;
  const etf = sectorEtfFor(member.sector);
  if (!etf) continue;
  sectorBySymbol.set(symbol, {
    sector: member.sector,
    benchmarkEtf: etf,
    classificationSource: "nasdaq100-v1",
  });
}

/** Verified sector context for a canonical symbol, or null when unavailable. */
export function resolveTickerSector(symbol: string): TickerSectorContext | null {
  const context = sectorBySymbol.get(symbol.trim().toUpperCase());
  if (!context || context.benchmarkEtf.length === 0) return null;
  return context;
}
