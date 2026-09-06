import type { MarketDataMode, MarketFeed, MarketIndex } from "@war-room/types";
import { MarketIndexCard } from "./MarketIndexCard";
import { SectionHeader } from "./SectionHeader";
import { ProvenanceTag, type ProvenanceStatus } from "./ui/ProvenanceTag";

interface MarketPulseProps {
  indices: MarketIndex[] | null;
  status: ProvenanceStatus;
  mode: MarketDataMode;
  feed: MarketFeed | null;
  stale?: boolean;
  /** Markets workspace labels the module "Major Indexes"; Overview keeps "Market Pulse". */
  title?: string;
  kicker?: string;
}

const SURFACES_FOR_SKELETON = ["bg-sakura-300", "bg-lavender", "bg-cream", "bg-mint"];

export function MarketPulse({
  indices,
  status,
  mode,
  feed,
  stale = false,
  title = "Market Pulse",
  kicker = "Index Snapshot",
}: MarketPulseProps) {
  return (
    <section id="market-pulse" aria-labelledby="market-pulse-heading">
      <SectionHeader
        id="market-pulse-heading"
        kicker={kicker}
        title={title}
        subtitle={
          mode === "live"
            ? "Live ETF prices — daily range and day position"
            : "Four pastel surfaces, one tape"
        }
        meta={<ProvenanceTag mode={mode} feed={feed} status={status} stale={stale} />}
      />

      {status === "error" ? (
        <UnavailablePanel />
      ) : status === "loading" || indices === null ? (
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {SURFACES_FOR_SKELETON.map((surface, i) => (
            <div
              key={i}
              className={`flex h-60 flex-col gap-3 rounded-[20px] border border-white/60 p-4 ${surface} animate-pulse`}
              role="status"
              aria-label="Loading live index data"
            >
              <div className="flex items-center justify-between">
                <div className="h-4 w-14 rounded-full bg-white/60" />
                <div className="h-5 w-16 rounded-full bg-white/60" />
              </div>
              <div className="mt-3 h-8 w-24 rounded-lg bg-white/60" />
              <div className="mt-auto h-10 w-full rounded-lg bg-white/50" />
            </div>
          ))}
        </div>
      ) : (
        <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {indices.map((index) => (
            <li key={index.ticker} className="h-full">
              <MarketIndexCard index={index} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function UnavailablePanel() {
  return (
    <div
      role="status"
      className="mt-4 flex flex-col items-center justify-center rounded-[20px] border border-line bg-white/70 px-6 py-10 text-center shadow-soft"
    >
      <p className="text-sm font-semibold text-ink">Market data unavailable</p>
      <p className="mt-1 text-xs text-ink-secondary">
        The market data provider could not be reached. Demo figures are intentionally not shown in
        live mode.
      </p>
    </div>
  );
}
