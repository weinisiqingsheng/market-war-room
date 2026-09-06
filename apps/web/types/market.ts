/**
 * App-level market domain types.
 *
 * Canonical contracts live in `@war-room/types` (shared across the workspace).
 * This file re-exports them so app code imports a stable local module path;
 * Phase 1+ data loaders implement the same contracts without touching callers.
 */
export type {
  CatalystEvent,
  DemoMarketData,
  HeaderNavItem,
  IndexSurface,
  MacroDataMeta,
  MacroDisplayUnit,
  MacroFrequency,
  MacroOverview,
  MacroProviderId,
  MacroSignal,
  MacroSignalId,
  MarketAnomaly,
  MarketBreadth,
  MarketBrief,
  MarketDataMeta,
  MarketDataMode,
  MarketDataProviderName,
  MarketFeed,
  MarketIndex,
  MarketOverview,
  MarketRegime,
  MarketSession,
  MarketSnapshotMap,
  NormalizedMarketSnapshot,
  PriceSource,
  RegimeComponentId,
  RegimeComponentScore,
  RegimeConfidence,
  RegimeDriver,
  RegimeDriverAttribution,
  RegimeDriverDirection,
  RegimeOverview,
  RegimeOverviewMeta,
  RegimeResult,
  RelativeStrength,
  SectorPerformance,
  SuggestedQuestion,
  Tone,
  TrendDirection,
} from "@war-room/types";
