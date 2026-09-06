import type { MarketDataMode, MarketFeed, SectorPerformance } from "@war-room/types";
import { SectionHeader } from "./SectionHeader";
import { SectorRow } from "./SectorRow";
import { ProvenanceTag, type ProvenanceStatus } from "./ui/ProvenanceTag";
import { formatSignedPct } from "@/lib/format";

interface SectorRotationProps {
  sectors: SectorPerformance[] | null;
  status: ProvenanceStatus;
  mode: MarketDataMode;
  feed: MarketFeed | null;
  stale?: boolean;
  benchmark: {
    ticker: string;
    dailyReturnPct: number | null;
  };
}

const HEADER_COLUMNS = "md:grid-cols-[1.6fr_0.7fr_0.7fr_0.9fr_1.1fr]";

export function SectorRotation({
  sectors,
  status,
  mode,
  feed,
  stale = false,
  benchmark,
}: SectorRotationProps) {
  const benchmarkLabel =
    benchmark.dailyReturnPct === null ? "—" : formatSignedPct(benchmark.dailyReturnPct);

  return (
    <section id="sector-rotation" aria-labelledby="sector-rotation-heading">
      <div className="flex h-full flex-col rounded-[20px] border border-line bg-surface p-5 shadow-card">
        <SectionHeader
          id="sector-rotation-heading"
          kicker="Relative Strength"
          title="Sector Rotation"
          subtitle={`Ranked by strength vs ${benchmark.ticker} (${benchmarkLabel})`}
          meta={<ProvenanceTag mode={mode} feed={feed} status={status} stale={stale} />}
        />

        <div
          className={`mt-4 hidden gap-3 px-3 text-[10px] font-semibold uppercase tracking-wider text-ink-muted md:grid ${HEADER_COLUMNS}`}
        >
          <span>Sector</span>
          <span>Daily</span>
          <span>vs SPY</span>
          <span>Signal</span>
          <span>Strength</span>
        </div>

        {status === "error" ? (
          <div
            role="status"
            className="mt-4 rounded-xl border border-line bg-white/60 px-4 py-8 text-center"
          >
            <p className="text-sm font-semibold text-ink">Market data unavailable</p>
            <p className="mt-1 text-xs text-ink-secondary">
              Sector relative strength requires live data. Demo figures are intentionally not shown
              in live mode.
            </p>
          </div>
        ) : status === "loading" || sectors === null ? (
          <div className="mt-3 flex flex-col gap-2" role="status" aria-label="Loading sector data">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-10 animate-pulse rounded-xl border border-line/70 bg-white/60"
              />
            ))}
          </div>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {sectors.map((sector) => (
              <SectorRow key={sector.id} sector={sector} />
            ))}
          </ul>
        )}

        <p className="mt-4 border-t border-line pt-3 text-[11px] text-ink-muted">
          Relative return = daily return vs {benchmark.ticker}. Relative strength matters more than
          raw return.
          {mode === "demo"
            ? " Demo fixtures."
            : ` Sorted by relative return (${benchmark.ticker} feed).`}
        </p>
      </div>
    </section>
  );
}
