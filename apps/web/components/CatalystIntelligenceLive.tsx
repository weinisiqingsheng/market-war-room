"use client";

import type { CatalystItem, CatalystMatch, CatalystOverview } from "@/lib/catalysts/types";

function formatTime(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

const STRENGTH_LABEL: Record<string, string> = { strong: "STRONG MATCH", moderate: "MODERATE MATCH", weak: "WEAK MATCH" };
const STRENGTH_STYLE: Record<string, string> = {
  strong: "bg-green-100 text-green-800",
  moderate: "bg-amber-100 text-amber-800",
  weak: "bg-ink/10 text-ink-muted",
};

function EvidenceRow({ match, label }: { match: CatalystMatch; label: string }) {
  return (
    <li className="rounded-xl border border-line bg-sakura-50/70 p-3.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-sakura-300 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-deep">{match.category}</span>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${STRENGTH_STYLE[match.evidenceStrength]}`}>{STRENGTH_LABEL[match.evidenceStrength]}</span>
        <span className="ml-auto text-[11px] tabular-nums text-ink-secondary">{Math.round(match.relevanceScore)}/100</span>
      </div>
      <p className="mt-2 text-sm font-semibold text-ink">{match.headline}</p>
      <p className="mt-1 text-[11px] text-ink-muted">
        {label} · {match.source} · {formatTime(match.publishedAt)}
        {match.eventPolarity !== "unknown" && <span className="ml-2 capitalize text-ink-secondary">{match.eventPolarity}</span>}
      </p>
      {match.supportingEvidence.length > 0 && (
        <p className="mt-1.5 line-clamp-2 text-[11px] text-ink-secondary">{match.supportingEvidence.join(" ")}</p>
      )}
      {match.url && (
        <a href={match.url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs font-medium text-accent underline-offset-2 hover:underline">
          View source ↗
        </a>
      )}
    </li>
  );
}


function CatalystRow({ item }: { item: CatalystItem }) {
  const matched = item.status === "MATCHED";
  return (
    <article className="rounded-xl border border-line bg-surface p-4">
      <header className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <h3 className="text-base font-bold text-ink">{item.ticker}</h3>
        <span className="text-xs tabular-nums text-ink-secondary">
          {item.name} · {item.movePct >= 0 ? "+" : ""}
          {item.movePct.toFixed(1)}% · Anomaly {Math.round(item.anomalyScore)}
        </span>
        <span className={`ml-auto rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${matched ? "bg-sakura-300 text-brand-deep" : "bg-ink/10 text-ink-muted"}`}>
          {matched ? "LIKELY CATALYST" : "NO CLEAR CATALYST"}
        </span>
      </header>
      {matched && item.primaryCatalyst ? (
        <ul className="mt-3 flex flex-col gap-2.5">
          <EvidenceRow match={item.primaryCatalyst} label="Primary evidence" />
          {item.secondaryCatalysts.slice(0, 2).map((match) => (
            <EvidenceRow key={`${match.sourceType}-${match.headline}`} match={match} label="Related evidence" />
          ))}
        </ul>
      ) : (
        <p className="mt-2.5 text-xs text-ink-muted">
          Abnormal price behavior detected, but no sufficiently strong catalyst was found in the selected sources.
        </p>
      )}
      <footer className="mt-3 flex flex-wrap gap-1.5 border-t border-line pt-2.5 text-[11px] text-ink-muted">
        <span>{item.evidence.newsCount} news</span>
        <span>·</span>
        <span>{item.evidence.filingCount} SEC filing{item.evidence.filingCount === 1 ? "" : "s"}</span>
        <span>·</span>
        <span>{item.evidence.corporateActionCount} corp action{item.evidence.corporateActionCount === 1 ? "" : "s"}</span>
        {matched && (<><span>·</span><span className="capitalize">direction: {item.alignment}</span></>)}
      </footer>
    </article>
  );
}

export function CatalystIntelligenceLive({ overview }: { overview: CatalystOverview }) {
  const { meta } = overview;
  const degraded = meta.providers.news !== "ok" || meta.providers.sec !== "ok" || meta.providers.corporateActions !== "ok";
  return (
    <section id="catalyst-intelligence" aria-labelledby="catalyst-intelligence-heading" className="rounded-[20px] border border-line bg-surface p-5 shadow-card">
      <header>
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-accent">Anomaly → Catalyst</p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h2 id="catalyst-intelligence-heading" className="text-lg font-semibold text-ink">Catalyst Intelligence</h2>
          <span className="rounded-full border border-line bg-white/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-ink-secondary">{meta.engineVersion} · LIVE</span>
        </div>
        <p className="mt-1 text-xs text-ink-muted">
          Grounded matches of evidence observed before the delayed-SIP snapshot — never a claim of cause. Evidence through {formatTime(meta.effectiveAsOf ?? meta.catalystCutoff)}.
        </p>
      </header>
      {degraded && (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
          Provider degradation — news {meta.providers.news} · SEC {meta.providers.sec} · corporate actions {meta.providers.corporateActions}. Matching continues with available evidence.
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-1.5 text-[11px] text-ink-muted">
        <span>{meta.candidateCount} candidates</span><span>·</span>
        <span>{meta.matchedCount} matched</span><span>·</span>
        <span>{meta.unmatchedCount} unmatched</span>
      </div>
      <div className="mt-4 flex flex-col gap-3">
        {overview.items.length === 0 && <p className="text-xs text-ink-muted">No anomaly candidates in the current snapshot.</p>}
        {overview.items.map((item) => <CatalystRow key={item.ticker} item={item} />)}
      </div>
    </section>
  );
}
