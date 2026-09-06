import "server-only";
import type {
  MarketDataMeta,
  MarketIndex,
  MarketOverview,
  MarketSnapshotMap,
  SectorPerformance,
} from "@war-room/types";
import { demoIndices, demoSectors } from "@/data/demo-market";
import type { MarketDataConfig } from "./config";
import {
  classifySectorSignal,
  computeRelativeReturn,
  computeSectorStrength,
  computeStale,
} from "./normalize";
import { getMarketDataProvider } from "./provider";
import {
  ALL_PHASE_1_SYMBOLS,
  BENCHMARK_SYMBOL,
  MARKET_PULSE_UNIVERSE,
  SECTOR_UNIVERSE,
} from "./symbols";

/** Builds the normalized domain overview from live provider data. */
export async function buildLiveOverview(config: MarketDataConfig): Promise<MarketOverview> {
  const provider = getMarketDataProvider(config);
  const [snapshots, clock] = await Promise.all([
    provider.getSnapshots(ALL_PHASE_1_SYMBOLS),
    provider.getMarketClock(),
  ]);

  const now = Date.now();

  // Mark per-snapshot staleness using the shared market-aware rule.
  for (const snapshot of Object.values(snapshots)) {
    snapshot.stale = computeStale({
      maxTimestamp: snapshot.timestamp,
      marketOpen: clock.marketOpen,
      now,
      thresholdMs: config.staleThresholdMs,
    });
  }

  return {
    meta: buildMeta(snapshots, clock, config, now),
    indices: buildIndices(snapshots),
    sectors: buildSectors(snapshots),
  };
}

/** Demo-mode overview — used by the API in demo mode. */
export function buildDemoOverview(): MarketOverview {
  return {
    meta: {
      mode: "demo",
      provider: "demo",
      feed: "demo",
      asOf: null,
      marketOpen: null,
      nextOpen: null,
      nextClose: null,
      stale: false,
    },
    indices: demoIndices,
    sectors: demoSectors,
  };
}

function buildMeta(
  snapshots: MarketSnapshotMap,
  clock: { marketOpen: boolean | null; nextOpen: string | null; nextClose: string | null },
  config: MarketDataConfig,
  now: number,
): MarketDataMeta {
  const timestamps = Object.values(snapshots)
    .map((snapshot) => snapshot.timestamp)
    .filter((value): value is string => value !== null);
  timestamps.sort((a, b) => Date.parse(b) - Date.parse(a));
  const newest = timestamps[0] ?? null;

  return {
    mode: config.mode,
    provider: "alpaca",
    feed: config.feed,
    asOf: newest ?? null,
    marketOpen: clock.marketOpen,
    nextOpen: clock.nextOpen,
    nextClose: clock.nextClose,
    stale: computeStale({
      maxTimestamp: newest,
      marketOpen: clock.marketOpen,
      now,
      thresholdMs: config.staleThresholdMs,
    }),
  };
}

function buildIndices(snapshots: MarketSnapshotMap): MarketIndex[] {
  return MARKET_PULSE_UNIVERSE.map((entry) => {
    const snapshot = snapshots[entry.symbol];
    return {
      ticker: entry.symbol,
      name: entry.name,
      price: snapshot?.price ?? null,
      changePct: snapshot?.changePct ?? null,
      open: snapshot?.open ?? null,
      high: snapshot?.high ?? null,
      low: snapshot?.low ?? null,
      surface: entry.surface,
      // Live sparklines are intentionally omitted (Phase 1): no manufactured
      // lines from unrelated snapshot values. Real series arrive later.
    };
  });
}

function buildSectors(snapshots: MarketSnapshotMap): SectorPerformance[] {
  const benchmarkChangePct = snapshots[BENCHMARK_SYMBOL]?.changePct ?? null;

  return SECTOR_UNIVERSE.map((entry) => {
    const snapshot = snapshots[entry.symbol];
    const relativeReturnPct = computeRelativeReturn(
      snapshot?.changePct ?? null,
      benchmarkChangePct,
    );
    const { signal, tone } = classifySectorSignal(relativeReturnPct);

    return {
      id: entry.symbol,
      sector: entry.sector,
      etf: entry.symbol,
      dailyReturnPct: snapshot?.changePct ?? null,
      relativeReturnPct,
      signal,
      tone,
      strength: computeSectorStrength(relativeReturnPct),
    };
  }).sort((a, b) => (b.relativeReturnPct ?? -Infinity) - (a.relativeReturnPct ?? -Infinity));
}
