"use client";

import type { TickerResearchApiOk } from "@/lib/ticker-context/api-types";
import type { SafeTickerEventsSummary } from "@/lib/ticker-context/summary";
import type { SafeTickerFact } from "@/lib/ticker-context/api-types";
import { formatEtTime } from "@/lib/format";

/**
 * Company Evidence + ticker evidence panel (V1.2C).
 *
 * Presentation mirrors the global Evidence Explorer row language (domain chip,
 * monospace evidence id, freshness chip), but the facts rendered here belong to
 * ONE ticker research result and are never merged into the global BriefContext.
 *
 * Causality wording is deliberately fixed: unpromoted news/filings are
 * contextual candidates, never labeled as the cause of a price move.
 */
const DOMAIN_STYLE: Record<string, string> = {
  identity: "bg-brand-deep text-surface",
  price: "bg-sakura-300 text-brand-deep",
  volume: "bg-mint text-brand-deep",
  volatility: "bg-lavender text-brand-deep",
  sector: "bg-cream text-amber-900",
  news: "bg-rose-100 text-rose-700",
  sec: "bg-purple-100 text-purple-800",
  catalyst: "bg-warn-bg text-warn",
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

function EvidenceRow({ fact }: { fact: SafeTickerFact }) {
  return (
    <article className="rounded-xl border border-line bg-white/70 p-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${DOMAIN_STYLE[fact.domain] ?? "bg-ink/10 text-ink-muted"}`}
        >
          {fact.domain}
        </span>
        <code className="break-all rounded bg-line/60 px-1.5 py-0.5 font-mono text-[10px] text-ink-muted">
          {fact.id}
        </code>
        {fact.sourceVersion ? (
          <span className="break-all rounded bg-ink/5 px-1.5 py-0.5 text-[10px] text-ink-muted">
            {fact.sourceVersion}
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-sm leading-relaxed text-ink-secondary">{fact.text}</p>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-ink-muted">
        {fact.asOf ? (
          <span>
            as of <span className="tabular-nums">{formatEtTime(fact.asOf)} ET</span>
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

function eventWindowLabel(events: SafeTickerEventsSummary): string {
  if (!events.window) return "the latest available window";
  return `${events.window.startIso} → ${events.window.cutoffIso ?? "latest available"}`;
}

function EventList({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
        {title}
      </p>
      <div className="mt-2 space-y-2">{children}</div>
    </div>
  );
}

function CompanyEvidenceList({
  events,
  symbol,
}: {
  events: SafeTickerEventsSummary;
  symbol: string;
}) {
  const total = events.news.length + events.filings.length + events.corporateActions.length;
  return (
    <div className="space-y-3">
      <p className="rounded-xl border border-line bg-white/60 px-3 py-2 text-xs leading-relaxed text-ink-secondary">
        {events.status === "none" || total === 0
          ? `No clear company-specific catalyst identified for ${symbol} in the evidence window ${eventWindowLabel(events)}.`
          : `Unpromoted company-specific candidate events for ${symbol} in ${eventWindowLabel(events)}: ${events.newsCount} news, ${events.secCount} SEC filings, ${events.corporateActionCount} corporate actions. These are contextual candidates, not a proven cause of the price move.`}
      </p>

      {events.news.length > 0 ? (
        <EventList title="Related company news">
          {events.news.map((item, index) => (
            <article
              key={`${item.headline}-${index}`}
              className="rounded-xl border border-line bg-white/70 p-3"
            >
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="rounded-full bg-sakura-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-deep">
                  {item.specificity === "context_only" ? "Contextual mention" : "Company-specific"}
                </span>
                {item.category ? (
                  <span className="rounded bg-ink/5 px-1.5 py-0.5 text-[10px] text-ink-muted">
                    {item.category}
                  </span>
                ) : null}
              </div>
              <p className="mt-2 text-sm leading-relaxed text-ink">{item.headline}</p>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-ink-muted">
                <span>{item.source ?? "source unavailable"}</span>
                {item.publishedAt ? (
                  <span>
                    published{" "}
                    <span className="tabular-nums">
                      {item.publishedAt.slice(0, 10)} {formatEtTime(item.publishedAt)} ET
                    </span>
                  </span>
                ) : null}
              </p>
              <p className="mt-1 text-[10px] text-ink-muted">
                Contextual evidence only — not a proven cause of the price move.
              </p>
            </article>
          ))}
        </EventList>
      ) : null}

      {events.filings.length > 0 ? (
        <EventList title="SEC filings">
          {events.filings.map((filing, index) => (
            <article
              key={`${filing.form}-${index}`}
              className="rounded-xl border border-line bg-white/70 p-3 text-xs"
            >
              <p className="font-semibold text-ink">
                Form {filing.form}
                {filing.formLabel && filing.formLabel !== filing.form
                  ? ` · ${filing.formLabel}`
                  : ""}
              </p>
              <p className="mt-1 text-[10px] text-ink-muted">
                filed <span className="tabular-nums">{filing.filedAt ?? "date unavailable"}</span> ·
                source sec-edgar-submissions-v1
              </p>
            </article>
          ))}
        </EventList>
      ) : null}

      {events.corporateActions.length > 0 ? (
        <EventList title="Corporate actions">
          {events.corporateActions.map((action, index) => (
            <article
              key={`${action.type}-${index}`}
              className="rounded-xl border border-line bg-white/70 p-3 text-xs"
            >
              <p className="font-semibold text-ink">{action.type || "Corporate action"}</p>
              <p className="mt-1 text-[10px] text-ink-muted">
                <span className="tabular-nums">{action.date ?? "date unavailable"}</span>
                {action.description ? ` · ${action.description}` : ""}
              </p>
            </article>
          ))}
        </EventList>
      ) : null}

      {events.news.length === 0 &&
      events.filings.length === 0 &&
      events.corporateActions.length === 0 ? (
        <p className="rounded-xl border border-line bg-white/50 px-3 py-4 text-xs text-ink-muted">
          No company-specific news, SEC filings or corporate actions were present in the current
          evidence window for {symbol}.
        </p>
      ) : null}
    </div>
  );
}

export interface TickerEvidencePanelProps {
  data: TickerResearchApiOk;
}

/**
 * Ticker-scoped evidence panel: the exact safe fact text from this research
 * result, with evidence id, domain, asOf, freshness, confidence and source
 * version. Scoped to the current ticker only — never merged into the global
 * Evidence Explorer / BriefContext.
 */
export function TickerEvidencePanel({ data }: TickerEvidencePanelProps) {
  const { facts, symbol, factCount } = data.context;
  return (
    <section aria-labelledby="ticker-evidence-heading" className="min-w-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 id="ticker-evidence-heading" className="text-sm font-semibold text-ink">
          {symbol} evidence
        </h3>
        <p className="text-[11px] text-ink-muted">
          <span className="tabular-nums font-semibold text-ink-secondary">{factCount}</span>{" "}
          grounded facts · ticker-context-v1
        </p>
      </div>
      <p className="mt-1 text-[11px] leading-relaxed text-ink-secondary">
        Original evidence text for this lookup, kept verbatim. These facts are scoped to {symbol}{" "}
        and are never added to the global evidence pack.
      </p>
      {facts.length > 0 ? (
        <div className="mt-3 max-h-[60vh] space-y-2 overflow-y-auto pr-1">
          {facts.map((fact) => (
            <EvidenceRow key={fact.id} fact={fact} />
          ))}
        </div>
      ) : (
        <p className="mt-3 rounded-xl border border-line bg-white/50 px-3 py-4 text-xs text-ink-muted">
          No evidence facts were returned for this symbol.
        </p>
      )}
    </section>
  );
}

export interface TickerCompanyEvidenceProps {
  data: TickerResearchApiOk;
}

/** Company Evidence — contextual events plus the source-coverage disclaimer. */
export function TickerCompanyEvidence({ data }: TickerCompanyEvidenceProps) {
  const events = data.context.summary.events;
  const symbol = data.context.symbol;
  return (
    <section aria-labelledby="ticker-company-evidence-heading" className="min-w-0">
      <h3 id="ticker-company-evidence-heading" className="text-sm font-semibold text-ink">
        Company Evidence
      </h3>
      <p className="mt-1 text-[11px] leading-relaxed text-ink-secondary">
        Available company evidence for {symbol}. News and filings are unpromoted contextual
        candidates and never establish causation.
      </p>
      <div className="mt-3 space-y-3">
        {events ? (
          <CompanyEvidenceList events={events} symbol={symbol} />
        ) : (
          <p className="rounded-xl border border-line bg-white/60 px-3 py-3 text-xs text-ink-secondary">
            Company evidence is unavailable for this symbol.
          </p>
        )}
      </div>
    </section>
  );
}
