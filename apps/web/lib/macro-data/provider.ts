import "server-only";
import type { MacroProviderId } from "@war-room/types";
import type { MacroDataConfig } from "./config";
import { getAlpacaCryptoSignals } from "./providers/alpaca-crypto";
import { getFredSignals } from "./providers/fred";
import { getTwelveSignals } from "./providers/twelve-data";
import type { MacroProviderResult } from "./types";

/**
 * Macro provider factory. Providers never touch React components — they return
 * normalized snapshots that the overview layer interprets into domain signals.
 */
export function getMacroProvider(
  config: MacroDataConfig,
  provider: MacroProviderId,
  fetchImpl?: typeof fetch,
): () => Promise<MacroProviderResult> {
  switch (provider) {
    case "fred":
      return () => getFredSignals(config, fetchImpl);
    case "twelve":
      return () => getTwelveSignals(config, fetchImpl);
    case "alpaca-crypto":
      return () => getAlpacaCryptoSignals(config, fetchImpl);
  }
}
