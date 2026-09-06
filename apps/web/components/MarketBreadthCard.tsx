import type { MarketBreadth, MarketDataMode } from "@/types/market";
import type { BreadthOverview } from "@/lib/breadth/types";
import { MarketBreadth as MarketBreadthLegacy } from "./MarketBreadth";
import { SectionHeader } from "./SectionHeader";
import { LiveBreadthView } from "./LiveBreadthView";

export type BreadthCardStatus = "loading" | "ready" | "error";

interface MarketBreadthCardProps {
  mode: MarketDataMode;
  status: BreadthCardStatus;
  /** Demo fixture breadth (mode=demo). */
  breadth: MarketBreadth | null;
  /** Live breadth overview (mode=live). */
  overview: BreadthOverview | null;
}

/**
 * Market Breadth card.
 *
 * Demo mode renders the legacy demo fixture (labeled DEMO). Live mode renders
 * the S&P 500 delayed-SIP breadth engine — always disclosed as
 * "15M DELAYED SIP", never merged with Market Pulse's LIVE · IEX provenance.
 */
export function MarketBreadthCard({ mode, status, breadth, overview }: MarketBreadthCardProps) {
  if (mode === "demo") {
    if (!breadth) return null;
    return <MarketBreadthLegacy breadth={breadth} />;
  }

  if (status === "loading") {
    return (
      <section id="market-breadth" aria-labelledby="market-breadth-heading" aria-busy="true">
        <div className="animate-pulse rounded-[20px] border border-line bg-surface p-5 shadow-card">
          <div className="h-3 w-32 rounded bg-line" />
          <div className="mt-6 h-10 w-40 rounded bg-line" />
          <div className="mt-6 grid grid-cols-2 gap-3">
            <div className="h-20 rounded-xl bg-line" />
            <div className="h-20 rounded-xl bg-line" />
          </div>
        </div>
      </section>
    );
  }

  if (status === "error" || !overview) {
    return (
      <section id="market-breadth" aria-labelledby="market-breadth-heading">
        <div className="flex h-full flex-col rounded-[20px] border border-line bg-surface p-5 shadow-card">
          <SectionHeader
            id="market-breadth-heading"
            kicker="Market Internals"
            title="Market Breadth"
            subtitle="S&P 500 · 15m Delayed SIP"
          />
          <p className="mt-4 text-sm leading-relaxed text-ink-secondary">
            Market Breadth is temporarily unavailable. Other modules keep working and demo figures
            are never substituted.
          </p>
          <div className="mt-4">
            <span className="inline-flex items-center rounded-full bg-warn-bg px-3 py-1 text-xs font-semibold text-warn">
              Breadth unavailable
            </span>
          </div>
        </div>
      </section>
    );
  }

  return <LiveBreadthView overview={overview} />;
}
