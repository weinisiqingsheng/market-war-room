import { fingerprintMarketState } from "./canonicalize";
import { SHORT_TERM_MARKET_STATE_VERSION, type ShortTermMarketState } from "./types";

export function createFixtureMarketState(symbol: string): ShortTermMarketState {
  const base: ShortTermMarketState = {
    version: SHORT_TERM_MARKET_STATE_VERSION,
    symbol,
    security: { name: null, exchange: null, assetClass: null, status: null, tradable: null },
    effectiveAsOf: null,
    marketSessionAsOf: null,
    marketSessionStatus: "unknown",
    feed: "fixture",
    delayMinutes: null,
    availability: { price: false, volume: false, history: false, volatility: false, sector: false },
    freshness: "unavailable",
    facts: [],
    provenance: { source: "phase-2a-fixture", sourceFingerprint: "" },
  };
  return {
    ...base,
    provenance: { ...base.provenance, sourceFingerprint: fingerprintMarketState(base) },
  };
}
