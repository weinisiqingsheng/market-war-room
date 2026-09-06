import type { BreadthOverview } from "@/lib/breadth/types";
import { SectionHeader } from "./SectionHeader";
import { TrendArrow } from "./ui/icons";

const CONFIDENCE_LABEL: Record<string, string> = {
  high: "High confidence",
  medium: "Medium confidence",
  low: "Low confidence",
  insufficient: "Insufficient coverage",
};

/** Live S&P 500 delayed-SIP breadth view (never labeled LIVE without a qualifier). */
export function LiveBreadthView({ overview }: { overview: BreadthOverview }) {
  const m = overview.metrics;
  const advancePct = m.advanceRatio === null ? null : m.advanceRatio * 100;
  const above20Pct = m.above20Pct === null ? null : m.above20Pct * 100;
  const above50Pct = m.above50Pct === null ? null : m.above50Pct * 100;
  const insufficient = overview.score === null;
  const coveragePct = Math.round(m.coveragePct * 100);

  return (
    <section id="market-breadth" aria-labelledby="market-breadth-heading">
      <div className="flex h-full flex-col rounded-[20px] border border-line bg-surface p-5 shadow-card">
        <SectionHeader
          id="market-breadth-heading"
          kicker="Market Internals"
          title="Market Breadth"
          subtitle="S&P 500 · 15m Delayed SIP"
          meta={
            <span className="rounded-full border border-line bg-white/70 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
              15M Delayed SIP
            </span>
          }
        />

        <div className="mt-4 rounded-xl border border-line bg-white/70 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
            Breadth Score
          </p>
          <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
            <p className="text-2xl font-semibold tabular-nums tracking-tight text-ink">
              {insufficient ? "—" : overview.displayScore}{" "}
              <span className="text-sm font-medium text-ink-muted">/ 100</span>
            </p>
            <span className="rounded-full bg-sakura-200 px-3 py-1 text-xs font-semibold text-brand-deep">
              {insufficient ? "Insufficient Data" : overview.state.label}
            </span>
          </div>
          <div className="mt-3 h-2 w-full rounded-full bg-line" aria-hidden="true">
            <div
              className="h-full rounded-full bg-brand"
              style={{
                width: `${insufficient ? 0 : Math.max(0, Math.min(100, overview.score ?? 0))}%`,
              }}
            />
          </div>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-line bg-white/70 p-3">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="text-ink-secondary">Advancing</span>
              <span className="inline-flex items-center gap-1 font-semibold tabular-nums text-pos">
                <TrendArrow direction="up" className="h-3.5 w-3.5" />
                {m.advancers}
              </span>
            </div>
            <div className="mt-1.5 flex items-center justify-between gap-2 text-xs">
              <span className="text-ink-secondary">Declining</span>
              <span className="inline-flex items-center gap-1 font-semibold tabular-nums text-neg">
                <TrendArrow direction="down" className="h-3.5 w-3.5" />
                {m.decliners}
              </span>
            </div>
            <div className="mt-1.5 flex items-center justify-between gap-2 text-xs">
              <span className="text-ink-secondary">Unchanged</span>
              <span className="font-semibold tabular-nums text-ink-muted">{m.unchanged}</span>
            </div>
            <p className="mt-2 text-xs font-medium text-ink-secondary">
              {advancePct === null
                ? "Advancing ratio unavailable"
                : `${Math.round(advancePct)}% Advancing`}
            </p>
          </div>

          <div className="rounded-xl border border-line bg-white/70 p-3">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="text-ink-secondary">Above 20D MA</span>
              <span className="font-semibold tabular-nums text-ink">
                {above20Pct === null ? "—" : `${Math.round(above20Pct)}%`}
              </span>
            </div>
            <div className="mt-1.5 flex items-center justify-between gap-2 text-xs">
              <span className="text-ink-secondary">Above 50D MA</span>
              <span className="font-semibold tabular-nums text-ink">
                {above50Pct === null ? "—" : `${Math.round(above50Pct)}%`}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between gap-2 text-xs">
              <span className="text-ink-secondary">New 20D Highs</span>
              <span className="inline-flex items-center gap-1 font-semibold tabular-nums text-pos">
                <TrendArrow direction="up" className="h-3.5 w-3.5" />
                {m.newHighs20}
              </span>
            </div>
            <div className="mt-1.5 flex items-center justify-between gap-2 text-xs">
              <span className="text-ink-secondary">New 20D Lows</span>
              <span className="inline-flex items-center gap-1 font-semibold tabular-nums text-neg">
                <TrendArrow direction="down" className="h-3.5 w-3.5" />
                {m.newLows20}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-line bg-white/40 px-3 py-2 text-xs text-ink-muted">
          <span className="font-medium text-ink-secondary">
            {coveragePct}% coverage · {CONFIDENCE_LABEL[overview.confidence]}
          </span>
          <span>· {overview.engineVersion}</span>
          <span>· {overview.universe.count} constituents</span>
        </div>
      </div>
    </section>
  );
}
