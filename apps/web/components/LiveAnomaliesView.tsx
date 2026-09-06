import type { AnomalyOverview } from "@/lib/anomalies/types";

const CONFIDENCE_LABEL: Record<string, string> = {
  high: "High confidence",
  medium: "Medium confidence",
  low: "Low confidence",
  insufficient: "Insufficient coverage",
};

/** Live S&P 500 delayed-SIP anomaly scanner view (never labeled LIVE). */
export function LiveAnomaliesView({ overview }: { overview: AnomalyOverview }) {
  const coveragePct = Math.round(overview.coveragePct * 100);
  const stale = overview.meta.stale;

  return (
    <section id="market-anomalies" aria-labelledby="market-anomalies-heading">
      <div className="flex h-full flex-col rounded-[20px] border border-line bg-surface p-5 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2
              id="market-anomalies-heading"
              className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted"
            >
              Market Anomalies
            </h2>
            <p className="mt-1 text-xs text-ink-secondary">
              S&P 500 · {overview.engineVersion} · {overview.meta.feed.replace("_", " ")} 15m
            </p>
          </div>
          <span className="rounded-full border border-line bg-white/70 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
            15M Delayed SIP
          </span>
        </div>

        {stale && (
          <p className="mt-3 rounded-lg bg-warn-bg px-2 py-1 text-[11px] font-semibold text-warn">
            Feed older than expected delayed-SIP semantics — data may be stale.
          </p>
        )}

        {overview.topOverall.length === 0 ? (
          <p className="mt-6 text-sm text-ink-secondary">
            No reliable anomaly ranking available right now (coverage{" "}
            {overview.confidence === "insufficient" ? "below 70%" : "limited"}).
          </p>
        ) : (
          <ul className="mt-4 space-y-2">
            {overview.topOverall.map((candidate) => (
              <li key={candidate.ticker} className="rounded-xl border border-line bg-white/70 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink">
                      {candidate.ticker}{" "}
                      <span className="font-normal text-ink-muted">· {candidate.name}</span>
                    </p>
                    <p className="mt-0.5 text-[11px] text-ink-muted">{candidate.sector}</p>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span
                      className={`font-semibold tabular-nums ${
                        candidate.direction === "up"
                          ? "text-pos"
                          : candidate.direction === "down"
                            ? "text-neg"
                            : "text-ink-muted"
                      }`}
                    >
                      {candidate.dailyMovePct > 0 ? "+" : ""}
                      {candidate.dailyMovePct.toFixed(1)}%
                    </span>
                    <span className="rounded-full bg-sakura-200 px-2 py-0.5 font-semibold tabular-nums text-brand-deep">
                      {candidate.displayScore} · {candidate.severity}
                    </span>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-ink-muted">
                  <span className="font-semibold uppercase tracking-wide text-brand-deep">
                    {candidate.primaryTrigger}
                  </span>
                  {candidate.metrics.volumeParticipation !== null && (
                    <span>{candidate.metrics.volumeParticipation.toFixed(1)}× avg day</span>
                  )}
                  {candidate.metrics.sectorRelativePct !== null && (
                    <span>
                      {candidate.metrics.sectorRelativePct > 0 ? "+" : ""}
                      {candidate.metrics.sectorRelativePct.toFixed(1)}% vs {candidate.sectorEtf}
                    </span>
                  )}
                </div>
                {candidate.reasons[0] && (
                  <p className="mt-1.5 text-[11px] leading-snug text-ink-muted">
                    {candidate.reasons[0]}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-line bg-white/40 px-3 py-2 text-xs text-ink-muted">
          <span className="font-medium text-ink-secondary">
            {coveragePct}% coverage · {CONFIDENCE_LABEL[overview.confidence]}
          </span>
          <span>· {overview.universe.count} constituents scanned</span>
          <span>· {overview.meta.feed}</span>
        </div>
      </div>
    </section>
  );
}
