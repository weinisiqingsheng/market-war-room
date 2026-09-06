import "server-only";
import type { MarketOverview, MacroOverview, RegimeOverview } from "@war-room/types";
import type { BreadthOverview } from "@/lib/breadth/types";
import type { AnomalyOverview } from "@/lib/anomalies/types";
import type { CatalystOverview } from "@/lib/catalysts/types";
import { getMarketDataConfig } from "@/lib/market-data/config";
import { buildLiveOverview } from "@/lib/market-data/overview";
import { getMacroDataConfig } from "@/lib/macro-data/config";
import { buildMacroOverview } from "@/lib/macro-data/overview";
import { buildLiveRegimeOverview } from "@/lib/regime/overview";
import { buildLiveBreadthOverview } from "@/lib/breadth/overview";
import { buildLiveAnomaliesOverview } from "@/lib/anomalies/overview";
import { buildLiveCatalystsOverview } from "@/lib/catalysts/overview";
import { assembleBriefContext } from "./assemble-context";
import { adaptMarketOverview, adaptMacroOverview, adaptRegimeOverview, adaptBreadthOverview, adaptAnomalyOverview, adaptCatalystOverview, type DomainAdapterOutput } from "./adapters";
import type { BriefContext, MarketEvidenceInput, MacroEvidenceInput, RegimeEvidenceInput, BreadthEvidenceInput, AnomalyEvidenceInput, CatalystsEvidenceInput } from "./types";

export interface LiveBriefDomainBuilders {
  market: () => Promise<MarketOverview>;
  macro: () => Promise<MacroOverview>;
  regime: () => Promise<RegimeOverview>;
  breadth: () => Promise<BreadthOverview>;
  anomalies: () => Promise<AnomalyOverview>;
  catalysts: () => Promise<CatalystOverview>;
}

type Settled<T> = { ok: true; value: T } | { ok: false };

async function settle<T>(run: () => Promise<T>): Promise<Settled<T>> {
  try {
    return { ok: true, value: await run() };
  } catch {
    return { ok: false };
  }
}

function unavailable<T>(): DomainAdapterOutput<T> {
  const meta = { available: false, asOf: null, freshness: "unavailable" as const, confidence: null, version: null };
  return { evidenceInput: null, sourceMeta: meta, quality: { meta, coverage: 0 } } as unknown as DomainAdapterOutput<T>;
}

/**
 * Injectable orchestrator. generatedAt is REQUIRED (no Date.now). Two-stage:
 * base domains (market/macro/breadth/anomalies) run concurrently; dependent
 * domains (regime after market+macro, catalysts after anomalies) only run when
 * their required upstream builder succeeded. Catastrophic failures produce
 * deterministic unavailable adapter outputs — never demo data.
 */
export async function buildLiveBriefContextWithBuilders(input: { generatedAt: string; builders: LiveBriefDomainBuilders }): Promise<BriefContext> {
  const { generatedAt, builders } = input;
  const stage1 = await Promise.all([
    settle(builders.market),
    settle(builders.macro),
    settle(builders.breadth),
    settle(builders.anomalies),
  ]);
  const [market, macro, breadth, anomalies] = stage1;

  let regime: Settled<RegimeOverview> = { ok: false };
  if (market.ok && macro.ok) {
    regime = await settle(builders.regime);
  }

  let catalysts: Settled<CatalystOverview> = { ok: false };
  if (anomalies.ok) {
    catalysts = await settle(builders.catalysts);
  }

  const marketOut = market.ok ? adaptMarketOverview(market.value) : unavailable<MarketEvidenceInput>();
  const macroOut = macro.ok ? adaptMacroOverview(macro.value) : unavailable<MacroEvidenceInput>();
  const breadthOut = breadth.ok ? adaptBreadthOverview(breadth.value) : unavailable<BreadthEvidenceInput>();
  const anomaliesOut = anomalies.ok ? adaptAnomalyOverview(anomalies.value) : unavailable<AnomalyEvidenceInput>();
  const regimeOut = regime.ok ? adaptRegimeOverview(regime.value) : unavailable<RegimeEvidenceInput>();
  const catalystsOut = catalysts.ok ? adaptCatalystOverview(catalysts.value) : unavailable<CatalystsEvidenceInput>();

  return assembleBriefContext({ generatedAt, market: marketOut, macro: macroOut, regime: regimeOut, breadth: breadthOut, anomalies: anomaliesOut, catalysts: catalystsOut });
}

/** Production wrapper: wires the real sealed builders + existing config readers. */
export function buildLiveBriefContext(options: { generatedAt?: string } = {}): Promise<BriefContext> {
  const marketConfig = getMarketDataConfig();
  const macroConfig = getMacroDataConfig();
  return buildLiveBriefContextWithBuilders({
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    builders: {
      market: () => buildLiveOverview(marketConfig),
      macro: () => buildMacroOverview(macroConfig),
      regime: () => buildLiveRegimeOverview(),
      breadth: () => buildLiveBreadthOverview(),
      anomalies: () => buildLiveAnomaliesOverview(),
      catalysts: () => buildLiveCatalystsOverview(),
    },
  });
}
