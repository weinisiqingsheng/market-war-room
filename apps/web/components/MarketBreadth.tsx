import type { MarketBreadth } from "@/types/market";
import { SectionHeader } from "./SectionHeader";
import { DemoTag } from "./ui/DemoTag";
import { TrendArrow } from "./ui/icons";

interface MarketBreadthProps {
  breadth: MarketBreadth;
}

export function MarketBreadth({ breadth }: MarketBreadthProps) {
  return (
    <section id="market-breadth" aria-labelledby="market-breadth-heading">
      <div className="flex h-full flex-col rounded-[20px] border border-line bg-surface p-5 shadow-card">
        <SectionHeader
          id="market-breadth-heading"
          kicker="Market Internals"
          title="Market Breadth"
          subtitle="Tape participation today"
          meta={<DemoTag label="DEMO" />}
        />

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {/* Advancing / Declining */}
          <div className="rounded-xl border border-line bg-white/70 p-3">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="text-ink-secondary">Advancing</span>
              <span className="inline-flex items-center gap-1 font-semibold tabular-nums text-neg">
                <TrendArrow direction="down" className="h-3.5 w-3.5" />
                {breadth.advancingPct}%
              </span>
            </div>
            <div className="mt-1.5 flex items-center justify-between gap-2 text-xs">
              <span className="text-ink-secondary">Declining</span>
              <span className="inline-flex items-center gap-1 font-semibold tabular-nums text-neg">
                <TrendArrow direction="up" className="h-3.5 w-3.5" />
                {breadth.decliningPct}%
              </span>
            </div>
            <div
              className="mt-2 flex h-1.5 w-full overflow-hidden rounded-full bg-line"
              aria-hidden="true"
            >
              <span className="bg-neg" style={{ width: `${breadth.advancingPct}%` }} />
              <span className="bg-ink-muted/25" style={{ width: `${breadth.decliningPct}%` }} />
            </div>
            <p className="mt-2 text-[11px] text-ink-muted">Decliners outnumber advancers.</p>
          </div>

          {/* Movers */}
          <div className="rounded-xl border border-line bg-white/70 p-3">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="text-ink-secondary">Stocks &gt; +2%</span>
              <span className="inline-flex items-center gap-1 font-semibold tabular-nums text-pos">
                <TrendArrow direction="up" className="h-3.5 w-3.5" />
                {breadth.stocksUpOver2Pct}
              </span>
            </div>
            <div className="mt-1.5 flex items-center justify-between gap-2 text-xs">
              <span className="text-ink-secondary">Stocks &lt; -2%</span>
              <span className="inline-flex items-center gap-1 font-semibold tabular-nums text-neg">
                <TrendArrow direction="down" className="h-3.5 w-3.5" />
                {breadth.stocksDownOver2Pct}
              </span>
            </div>
            <div
              className="mt-2 flex h-1.5 w-full overflow-hidden rounded-full bg-line"
              aria-hidden="true"
            >
              <span className="bg-ink-muted/25" style={{ width: `${breadth.stocksUpOver2Pct}%` }} />
              <span className="bg-neg" style={{ width: `${breadth.stocksDownOver2Pct}%` }} />
            </div>
            <p className="mt-2 text-[11px] text-ink-muted">Large negative tails dominate.</p>
          </div>

          {/* Above 50 DMA */}
          <div className="rounded-xl border border-line bg-white/70 p-3">
            <p className="text-xs text-ink-secondary">Above 50 DMA</p>
            <p className="mt-1 inline-flex items-center gap-1 text-lg font-semibold tabular-nums text-neg">
              <TrendArrow direction="down" className="h-4 w-4" />
              {breadth.above50DmaPct}%
            </p>
            <div className="mt-2 h-1.5 w-full rounded-full bg-line" aria-hidden="true">
              <div
                className="h-full rounded-full bg-neg"
                style={{ width: `${breadth.above50DmaPct}%` }}
              />
            </div>
            <p className="mt-2 text-[11px] text-ink-muted">Most of the index is below its trend.</p>
          </div>

          {/* New highs / lows */}
          <div className="rounded-xl border border-line bg-white/70 p-3">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="text-ink-secondary">New Highs</span>
              <span className="inline-flex items-center gap-1 font-semibold tabular-nums text-pos">
                <TrendArrow direction="up" className="h-3.5 w-3.5" />
                {breadth.newHighs}
              </span>
            </div>
            <div className="mt-1.5 flex items-center justify-between gap-2 text-xs">
              <span className="text-ink-secondary">New Lows</span>
              <span className="inline-flex items-center gap-1 font-semibold tabular-nums text-neg">
                <TrendArrow direction="up" className="h-3.5 w-3.5" />
                {breadth.newLows}
              </span>
            </div>
            <div
              className="mt-2 flex h-1.5 w-full overflow-hidden rounded-full bg-line"
              aria-hidden="true"
            >
              <span
                className="bg-pos"
                style={{
                  width: `${(breadth.newHighs / (breadth.newHighs + breadth.newLows)) * 100}%`,
                }}
              />
              <span
                className="bg-neg"
                style={{
                  width: `${(breadth.newLows / (breadth.newHighs + breadth.newLows)) * 100}%`,
                }}
              />
            </div>
            <p className="mt-2 text-[11px] text-ink-muted">New lows outnumber new highs ~3:1.</p>
          </div>
        </div>

        {/* Breadth score */}
        <div className="mt-3 rounded-xl border border-neg-bg bg-neg-bg/50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-neg">
                Breadth Score
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-ink">
                {breadth.score} <span className="text-sm font-medium text-ink-muted">/ 100</span>
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-neg px-3 py-1.5 text-xs font-semibold text-surface">
              <TrendArrow direction="down" className="h-3.5 w-3.5" />
              {breadth.scoreLabel}
            </span>
          </div>
          <div className="mt-3 h-2 w-full rounded-full bg-line" aria-hidden="true">
            <div className="h-full rounded-full bg-neg" style={{ width: `${breadth.score}%` }} />
          </div>
          <p className="mt-2 text-xs leading-relaxed text-ink-secondary">
            Breadth is negative — more stocks declining than advancing, with new lows outpacing new
            highs.
          </p>
        </div>
      </div>
    </section>
  );
}
