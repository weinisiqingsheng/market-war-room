import "server-only";
import type { TickerResearchContext } from "@/lib/ticker-context/types";
import { DELAY_MINUTES } from "@/lib/breadth/constants";
import type { ShortTermMarketFact, ShortTermMarketState } from "./types";
import { SHORT_TERM_MARKET_STATE_VERSION } from "./types";

function dataString(data: Record<string, unknown>, key: string): string | null {
  return typeof data[key] === "string" ? (data[key] as string) : null;
}

function dataNumber(data: Record<string, unknown>, key: string): number | null {
  return typeof data[key] === "number" && Number.isFinite(data[key]) ? (data[key] as number) : null;
}

export function marketStateFromTickerContext(context: TickerResearchContext): ShortTermMarketState {
  const sourceFacts: ShortTermMarketFact[] = context.facts
    .filter((fact) => ["price", "volume", "volatility", "sector"].includes(fact.domain))
    .map((fact) => ({
      id: fact.id,
      domain:
        fact.domain === "price" ||
        fact.domain === "volume" ||
        fact.domain === "volatility" ||
        fact.domain === "sector"
          ? fact.domain
          : "history",
      values: fact.data,
      asOf: fact.asOf,
      freshness: fact.freshness,
      sourceVersion: fact.sourceVersion,
    }));
  const priceFact = sourceFacts.find((fact) => fact.domain === "price");
  const feed = priceFact ? dataString(priceFact.values, "feed") : null;
  const delayMinutes = priceFact ? dataNumber(priceFact.values, "delayMinutes") : null;
  return {
    version: SHORT_TERM_MARKET_STATE_VERSION,
    symbol: context.symbol,
    security: {
      name: context.identity.name,
      exchange: context.identity.exchange,
      assetClass: context.identity.assetClass,
      status: context.identity.status,
      tradable: context.identity.tradable,
    },
    effectiveAsOf: context.effectiveAsOf,
    marketSessionAsOf: context.marketSessionAsOf,
    marketSessionStatus: context.session.phase,
    feed: feed ?? (priceFact ? "unknown" : null),
    delayMinutes: delayMinutes ?? (feed === "delayed_sip" ? DELAY_MINUTES : null),
    availability: {
      price: context.availability.price,
      volume: context.availability.volume,
      history: context.availability.history,
      volatility: context.availability.volatility,
      sector: context.availability.sector,
    },
    freshness: context.sources.market.freshness,
    facts: sourceFacts,
    provenance: { source: context.version, sourceFingerprint: context.fingerprint },
  };
}
