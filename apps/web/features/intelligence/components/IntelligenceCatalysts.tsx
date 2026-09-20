import type { MarketDataMode, CatalystEvent } from "@/types/market";
import type { CatalystOverview } from "@/lib/catalysts/types";
import { CatalystIntelligence } from "@/components/CatalystIntelligence";
import { CatalystIntelligenceLive } from "@/components/CatalystIntelligenceLive";

/**
 * Intelligence catalyst panel. Live mode shows catalyst-match-v1 output
 * (including explicit NO CLEAR CATALYST FOUND); loading/error show an honest
 * card-local state — demo fixtures are never substituted for a live failure.
 */
export function IntelligenceCatalysts({
  mode,
  status,
  overview,
  demoEvents,
}: {
  mode: MarketDataMode;
  status: "loading" | "ready" | "error";
  overview: CatalystOverview | null;
  demoEvents: CatalystEvent[];
}) {
  if (mode === "live") {
    if (status === "loading") {
      return (
        <section aria-labelledby="catalyst-intelligence-heading" aria-busy="true">
          <div className="animate-pulse rounded-[20px] border border-line bg-surface p-5 shadow-card">
            <h2
              id="catalyst-intelligence-heading"
              className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent"
            >
              Catalyst Intelligence
            </h2>
            <div className="mt-4 h-24 rounded-xl bg-line" />
            <div className="mt-2 h-24 rounded-xl bg-line" />
          </div>
        </section>
      );
    }
    if (status === "error" || !overview) {
      return (
        <section aria-labelledby="catalyst-intelligence-heading">
          <div className="flex h-full flex-col rounded-[20px] border border-line bg-surface p-5 shadow-card">
            <h2
              id="catalyst-intelligence-heading"
              className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent"
            >
              Catalyst Intelligence
            </h2>
            <p className="mt-4 text-sm text-ink-secondary">
              Catalyst Intelligence is temporarily unavailable. Other intelligence modules remain
              functional and demo fixtures are never substituted.
            </p>
            <span className="mt-4 inline-flex items-center rounded-full bg-warn-bg px-3 py-1 text-xs font-semibold text-warn">
              Catalysts unavailable
            </span>
          </div>
        </section>
      );
    }
    return <CatalystIntelligenceLive overview={overview} />;
  }

  if (!demoEvents.length) return null;
  return <CatalystIntelligence events={demoEvents} status={status} />;
}
