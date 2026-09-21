import type { JSONValue, JSONObject } from "@/lib/ai-brief/types";

export const SHORT_TERM_MARKET_STATE_VERSION = "short-term-market-state-v1" as const;

export type ShortTermMarketFreshness = "fresh" | "delayed" | "stale" | "unavailable";
export type ShortTermMarketSessionStatus = "regular" | "closed" | "unknown";

export interface ShortTermMarketFact {
  id: string;
  domain: "price" | "volume" | "volatility" | "sector" | "history";
  values: JSONObject;
  asOf: string | null;
  freshness: ShortTermMarketFreshness;
  sourceVersion: string | null;
}

export interface ShortTermMarketState {
  version: typeof SHORT_TERM_MARKET_STATE_VERSION;
  symbol: string;
  security: {
    name: string | null;
    exchange: string | null;
    assetClass: string | null;
    status: string | null;
    tradable: boolean | null;
  };
  effectiveAsOf: string | null;
  marketSessionAsOf: string | null;
  marketSessionStatus: ShortTermMarketSessionStatus;
  feed: string | null;
  delayMinutes: number | null;
  availability: {
    price: boolean;
    volume: boolean;
    history: boolean;
    volatility: boolean;
    sector: boolean;
  };
  freshness: ShortTermMarketFreshness;
  facts: ShortTermMarketFact[];
  provenance: {
    source: string;
    sourceFingerprint: string;
  };
}

export interface ShortTermMarketStateInput {
  state: ShortTermMarketState;
  requestContext: JSONObject;
}

export type ShortTermMarketStateValue = JSONValue;
