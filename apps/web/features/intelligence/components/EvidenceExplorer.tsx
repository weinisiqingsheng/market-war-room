"use client";

import { useState } from "react";
import type { ModelEvidenceFact } from "@/lib/ai-brief/serialize-context";
import type { AiEvidenceApiOk } from "@/lib/ai-brief/evidence-api-types";
import { formatEtTime } from "@/lib/format";

const DOMAIN_ORDER = [
  "market",
  "sector",
  "macro",
  "regime",
  "breadth",
  "anomaly",
  "catalyst",
] as const;

const DOMAIN_STYLE: Record<string, string> = {
  market: "bg-sakura-300 text-brand-deep",
  sector: "bg-lavender text-brand-deep",
  macro: "bg-cream text-amber-900",
  regime: "bg-brand-deep text-surface",
  breadth: "bg-mint text-brand-deep",
  anomaly: "bg-rose-100 text-rose-700",
  catalyst: "bg-purple-100 text-purple-800",
};

const FRESHNESS_LABEL: Record<string, string> = {
  fresh: "Fresh",
  delayed: "Delayed",
  stale: "Stale",
  unavailable: "Unavailable",
};

function freshnessClass(freshness: string): string {
  if (freshness === "stale") return "bg-warn-bg text-warn";
  if (freshness === "unavailable") return "bg-ink/10 text-ink-muted";
  if (freshness === "fresh") return "bg-sakura-200 text-brand-deep";
  return "bg-ink/5 text-ink-secondary";
}

function shortTime(iso: string | null): string {
  if (!iso) return "";
  return formatEtTime(iso);
}

function DomainChip({ domain }: { domain: string }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${DOMAIN_STYLE[domain] ?? "bg-ink/10 text-ink-muted"}`}
    >
      {domain}
    </span>
  );
}

function EvidenceRow({ fact, selected }: { fact: ModelEvidenceFact; selected: boolean }) {
  return (
    <article
      className={`rounded-xl border p-3 transition-colors ${
        selected
          ? "border-accent/60 bg-sakura-100/60 ring-1 ring-accent/40"
          : "border-line bg-white/70"
      }`}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <DomainChip domain={fact.domain} />
        <code className="break-all rounded bg-line/60 px-1.5 py-0.5 font-mono text-[10px] text-ink-muted">
          {fact.id}
        </code>
        {fact.sourceVersion && (
          <span className="rounded bg-ink/5 px-1.5 py-0.5 text-[10px] text-ink-muted">
            {fact.sourceVersion}
          </span>
        )}
      </div>

      <p className="mt-2 text-sm leading-relaxed text-ink-secondary">{fact.text}</p>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-ink-muted">
        {shortTime(fact.asOf) ? (
          <span>
            as of <span className="tabular-nums">{shortTime(fact.asOf)}</span>
          </span>
        ) : null}
        <span
          className={`rounded-full px-1.5 py-0.5 font-semibold uppercase tracking-wide ${freshnessClass(fact.freshness)}`}
        >
          {FRESHNESS_LABEL[fact.freshness] ?? fact.freshness}
        </span>
        {fact.confidence ? <span className="capitalize">{fact.confidence} confidence</span> : null}
      </div>
    </article>
  );
}

export interface EvidenceExplorerProps {
  /** Only the "ok" payload is ever rendered; unavailable becomes an error state. */
  data: AiEvidenceApiOk | null;
  status: "loading" | "ready" | "error";
  onRefresh: () => void;
  /** contextFingerprint of the currently displayed AI Brief (null until known). */
  aiFingerprint: string | null;
  /** External focus refs (AI "Show evidence" or anomaly trace). Empty = normal browse. */
  focusRefs: string[];
  onClearFocus: () => void;
}

type DomainFilter = "all" | string;

function SourceHealth({ sources }: { sources: AiEvidenceApiOk["context"]["sources"] }) {
  const domains = [
    ["market", "Market"],
    ["macro", "Macro"],
    ["regime", "Regime"],
    ["breadth", "Breadth"],
    ["anomalies", "Anomalies"],
    ["catalysts", "Catalysts"],
  ] as const;

  return (
    <section aria-label="Source Health" className="rounded-xl border border-line bg-white/50 p-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink-muted">
        Source Health
      </p>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5">
        {domains.map(([key, label]) => {
          const source = sources[key];
          if (!source) return null;
          const state = source.available
            ? `${FRESHNESS_LABEL[source.freshness] ?? source.freshness}${source.confidence ? ` · ${source.confidence}` : ""}`
            : "Unavailable";
          return (
            <li key={key} className="flex items-center gap-1.5 text-[11px] text-ink-secondary">
              <span
                aria-hidden="true"
                className={`h-1.5 w-1.5 rounded-full ${source.available ? (source.freshness === "stale" ? "bg-warn" : source.freshness === "delayed" ? "bg-ink/40" : "bg-accent") : "bg-ink-muted/50"}`}
              />
              <span className="font-medium text-ink">{label}</span>
              <span className={source.available ? "capitalize" : "text-ink-muted"}>{state}</span>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-[10px] text-ink-muted">
        Freshness is a data-quality state, never a market opinion. Delayed SIP is expected, not
        degraded.
      </p>
    </section>
  );
}

export function EvidenceExplorer({
  data,
  status,
  onRefresh,
  aiFingerprint,
  focusRefs,
  onClearFocus,
}: EvidenceExplorerProps) {
  const [domain, setDomain] = useState<DomainFilter>("all");
  const [query, setQuery] = useState("");
  const [freshness, setFreshness] = useState("all");

  const facts = data?.context.evidence ?? [];

  const aligned =
    aiFingerprint !== null && data !== null && aiFingerprint === data.context.fingerprint;
  const updated = aiFingerprint !== null && data !== null && !aligned;
  const focusSet = focusRefs.length > 0 ? new Set(focusRefs) : null;

  const visible = facts.filter((fact) => {
    if (focusSet && !focusSet.has(fact.id)) return false;
    if (domain !== "all" && fact.domain !== domain) return false;
    if (freshness !== "all" && fact.freshness !== freshness) return false;
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      if (
        !fact.id.toLowerCase().includes(q) &&
        !fact.text.toLowerCase().includes(q) &&
        !(fact.sourceVersion ?? "").toLowerCase().includes(q)
      ) {
        return false;
      }
    }
    return true;
  });

  const focusMatches = focusSet ? facts.some((fact) => focusSet.has(fact.id)) : true;

  return (
    <section
      aria-labelledby="evidence-explorer-title"
      className="rounded-[20px] border border-line bg-surface p-5 shadow-card"
    >
      {/* Header + alignment */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 id="evidence-explorer-title" className="text-lg font-semibold text-ink">
            Evidence Explorer
          </h2>
          {data ? (
            <p className="mt-1 text-xs text-ink-muted">
              {facts.length} grounded evidence facts
              {data.context.fingerprint ? ` · fp ${data.context.fingerprint.slice(0, 8)}…` : ""}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {aligned && (
            <span className="rounded-full bg-pos-bg px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-pos">
              Evidence Aligned
            </span>
          )}
          {updated && (
            <span
              className="rounded-full bg-warn-bg px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-warn"
              title="Market evidence has updated since this brief was generated."
            >
              Evidence Updated
            </span>
          )}
          <button
            type="button"
            onClick={onRefresh}
            disabled={status === "loading"}
            className="rounded-full border border-line bg-white/70 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-ink-secondary transition-colors hover:bg-sakura-100 disabled:cursor-wait disabled:opacity-60"
          >
            Refresh Evidence
          </button>
        </div>
      </div>

      {data ? <SourceHealth sources={data.context.sources} /> : null}

      {focusRefs.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-accent/40 bg-sakura-100/60 px-3 py-2 text-xs text-brand-deep">
          <span>
            Showing{" "}
            {focusMatches
              ? `${visible.length} evidence fact${visible.length === 1 ? "" : "s"}`
              : "no matching evidence"}{" "}
            for the selected claim
          </span>
          <button
            type="button"
            onClick={onClearFocus}
            className="rounded-full bg-white/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-brand-deep hover:bg-white"
          >
            Clear
          </button>
        </div>
      )}

      {status === "loading" && !data ? (
        <div className="mt-4 space-y-2" role="status" aria-label="Loading grounded evidence">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-ink/5" />
          ))}
        </div>
      ) : status === "error" || !data ? (
        <div className="mt-4 flex flex-col items-start gap-2 rounded-xl border border-line bg-white/60 px-4 py-6">
          <p className="text-sm font-semibold text-ink">
            Evidence Explorer temporarily unavailable.
          </p>
          <p className="text-xs text-ink-secondary">Other intelligence modules remain available.</p>
          <button
            type="button"
            onClick={onRefresh}
            className="mt-1 rounded-full bg-sakura-300 px-3 py-1.5 text-xs font-semibold text-brand-deep"
          >
            Retry
          </button>
        </div>
      ) : null}

      {data && facts.length > 0 ? (
        <>
          <div
            className="mt-4 flex flex-wrap items-center gap-1.5"
            aria-label="Evidence domain filters"
          >
            {["all", ...DOMAIN_ORDER].map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={domain === value}
                onClick={() => setDomain(value)}
                className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider transition-colors ${
                  domain === value
                    ? "bg-brand-deep text-surface"
                    : "bg-white/70 text-ink-secondary hover:bg-sakura-100"
                }`}
              >
                {value === "all" ? "All" : value.charAt(0).toUpperCase() + value.slice(1)}
              </button>
            ))}
          </div>

          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
            <label className="flex min-w-0 flex-1 items-center gap-2 rounded-full border border-line bg-white/70 px-3 py-1.5">
              <span className="sr-only">Search evidence — ticker or evidence ID</span>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search FICO, catalyst, anomaly…"
                className="w-full min-w-0 bg-transparent text-xs text-ink outline-none placeholder:text-ink-muted"
              />
            </label>
            <label className="flex items-center gap-1.5 text-[11px] text-ink-muted">
              Freshness
              <select
                value={freshness}
                onChange={(event) => setFreshness(event.target.value)}
                aria-label="Filter by freshness"
                className="rounded-full border border-line bg-white/70 px-2 py-1 text-[11px] text-ink-secondary"
              >
                <option value="all">All</option>
                <option value="fresh">Fresh</option>
                <option value="delayed">Delayed</option>
                <option value="stale">Stale</option>
                <option value="unavailable">Unavailable</option>
              </select>
            </label>
          </div>

          <div className="mt-4 max-h-[68vh] space-y-2 overflow-y-auto pr-1" aria-live="polite">
            {visible.length > 0 ? (
              visible.map((fact) => (
                <EvidenceRow key={fact.id} fact={fact} selected={focusSet?.has(fact.id) ?? false} />
              ))
            ) : (
              <p className="rounded-xl border border-line bg-white/50 px-3 py-6 text-center text-xs text-ink-muted">
                No grounded evidence matches the current filters.
              </p>
            )}
          </div>
        </>
      ) : data && facts.length === 0 ? (
        <p className="mt-6 text-sm text-ink-secondary">
          No grounded evidence is currently available.
        </p>
      ) : null}
    </section>
  );
}
