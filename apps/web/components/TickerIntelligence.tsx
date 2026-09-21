"use client";

import { useState } from "react";
import { SectionHeader } from "@/components/SectionHeader";
import {
  TickerCompanyEvidence,
  TickerEvidencePanel,
} from "@/components/TickerIntelligenceEvidence";
import { TickerMetricGrid } from "@/components/TickerIntelligenceMetrics";
import { useTickerResearch } from "@/features/markets/useTickerResearch";
import type { TickerResearchApiOk } from "@/lib/ticker-context/api-types";
import { formatEtTime } from "@/lib/format";

/**
 * Ticker Intelligence workspace (V1.2C) — Markets-only, exactly one section.
 *
 * On-demand research for any supported US equity (never limited to the anomaly
 * Top 8 or to a watchlist): the browser calls GET /api/intelligence/ticker,
 * which returns ticker-context-v1 evidence plus the additive ticker-summary-v1
 * numbers. The UI renders only those values — no prose parsing, no client-side
 * metric math, no provider calls and no LLM.
 */
const SUGGESTIONS = ["NVDA", "TSLA", "AAPL", "AMD"] as const;

const SOURCE_LABEL: Record<string, string> = {
  market: "Market data",
  identity: "Security identity",
  sector: "Sector classification",
  news: "Company news",
  sec: "SEC filings",
};

const FRESHNESS_LABEL: Record<string, string> = {
  fresh: "Fresh",
  delayed: "Delayed",
  stale: "Stale",
  unavailable: "Unavailable",
};

function Chip({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "brand" | "warn";
}) {
  const toneClass =
    tone === "brand"
      ? "border-brand-deep/30 bg-sakura-100 text-brand-deep"
      : tone === "warn"
        ? "border-warn/30 bg-warn-bg text-warn"
        : "border-line bg-white/70 text-ink-secondary";
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${toneClass}`}
    >
      {children}
    </span>
  );
}

function IdentityHeader({ data }: { data: TickerResearchApiOk }) {
  const { identity, symbol, status } = data.context;
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-xl font-semibold tracking-tight text-ink">{identity.symbol}</h3>
          <Chip tone={status === "ok" ? "brand" : "warn"}>
            {status === "ok"
              ? "Verified"
              : status === "partial"
                ? "Partial data"
                : "Insufficient data"}
          </Chip>
          {identity.exchange ? <Chip>{identity.exchange}</Chip> : null}
          <Chip>{identity.assetClass === "us_equity" ? "US equity" : identity.assetClass}</Chip>
          <Chip>{identity.status}</Chip>
        </div>
        <p className="mt-1 break-words text-sm text-ink-secondary">
          {identity.name}
          {identity.symbol !== symbol ? ` · canonical ${symbol}` : ""}
        </p>
      </div>
      <p className="text-[10px] leading-relaxed text-ink-muted">
        Identity verified against the provider security directory (alpaca-assets-v1).
      </p>
    </div>
  );
}

function ProvenanceStrip({ data }: { data: TickerResearchApiOk }) {
  const {
    session,
    sources,
    confidence,
    effectiveAsOf,
    marketSessionAsOf,
    requestedAt,
    generatedAt,
  } = data.context;
  const delayMinutes = data.context.summary.price?.delayMinutes ?? null;
  const sessionLabel = session.sessionDate ?? marketSessionAsOf ?? "unknown session";
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-1.5 text-[11px] sm:grid-cols-2 xl:grid-cols-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-2">
        <dt className="text-ink-muted">Session</dt>
        <dd className="tabular-nums font-semibold text-ink-secondary">
          {sessionLabel} ET · {session.phase === "regular" ? "in progress" : "completed session"}
        </dd>
      </div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-2">
        <dt className="text-ink-muted">Price evidence as of</dt>
        <dd className="tabular-nums font-semibold text-ink-secondary">
          {effectiveAsOf ? `${formatEtTime(effectiveAsOf)} ET` : "—"}
        </dd>
      </div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-2">
        <dt className="text-ink-muted">Feed</dt>
        <dd className="font-semibold text-ink-secondary">
          Delayed SIP{delayMinutes ? ` ${delayMinutes}m behind` : ""}
        </dd>
      </div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-2">
        <dt className="text-ink-muted">Market freshness</dt>
        <dd className="font-semibold text-ink-secondary">
          {FRESHNESS_LABEL[sources.market.freshness] ?? sources.market.freshness}
        </dd>
      </div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-2">
        <dt className="text-ink-muted">Confidence</dt>
        <dd className="font-semibold text-ink-secondary">
          <span className="capitalize">{confidence.label}</span>{" "}
          <span className="tabular-nums text-ink-muted">({confidence.score.toFixed(2)})</span>
        </dd>
      </div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-2">
        <dt className="text-ink-muted">Research requested</dt>
        <dd className="tabular-nums font-semibold text-ink-secondary">
          {requestedAt ? `${formatEtTime(requestedAt)} ET` : "—"}
        </dd>
      </div>
      <div className="sm:col-span-2 xl:col-span-3">
        <dd className="text-[10px] leading-relaxed text-ink-muted">
          Request time and generation time ({generatedAt ? `${formatEtTime(generatedAt)} ET` : "—"})
          are orchestration instants — neither is the market price timestamp.
        </dd>
      </div>
    </dl>
  );
}

function CoverageNotices({ data }: { data: TickerResearchApiOk }) {
  const { status, sources, availability } = data.context;
  const missing = Object.keys(SOURCE_LABEL).filter((key) => !sources[key]?.available);
  const unavailableMetrics = [
    !availability.history ? "historical range/volatility" : null,
    !availability.volume ? "volume history" : null,
    !availability.sector ? "sector classification" : null,
    !availability.news ? "company news" : null,
    !availability.sec ? "SEC filings" : null,
  ].filter((value): value is string => value !== null);

  if (status === "ok" && missing.length === 0 && unavailableMetrics.length === 0) return null;

  return (
    <div className="space-y-2">
      {status === "insufficient_data" ? (
        <p className="rounded-xl border border-warn/30 bg-warn-bg/70 px-3 py-2 text-xs leading-relaxed text-ink-secondary">
          <strong className="font-semibold text-warn">Insufficient grounded data.</strong> The
          providers returned neither a usable reference price nor history for this symbol, so
          metrics are shown as unavailable instead of being estimated.
        </p>
      ) : null}
      {missing.length > 0 ? (
        <p className="rounded-xl border border-line bg-white/60 px-3 py-2 text-xs leading-relaxed text-ink-secondary">
          <strong className="font-semibold text-ink">Partial data.</strong> Unavailable in this
          snapshot: {missing.map((key) => SOURCE_LABEL[key]).join(", ")}. Missing values are
          reported as unavailable — nothing is substituted.
        </p>
      ) : null}
      {status !== "insufficient_data" && unavailableMetrics.length > 0 ? (
        <p className="text-[11px] text-ink-muted">
          Not provided for this symbol: {unavailableMetrics.join(", ")}.
        </p>
      ) : null}
    </div>
  );
}

function StatusPanel({
  tone,
  title,
  children,
}: {
  tone: "info" | "warn" | "error";
  title: string;
  children?: React.ReactNode;
}) {
  const toneClass =
    tone === "error"
      ? "border-neg/30 bg-neg-bg/60"
      : tone === "warn"
        ? "border-warn/30 bg-warn-bg/60"
        : "border-line bg-white/60";
  const titleClass = tone === "error" ? "text-neg" : tone === "warn" ? "text-warn" : "text-ink";
  return (
    <div
      role={tone === "info" ? "status" : "alert"}
      className={`rounded-2xl border px-4 py-3 ${toneClass}`}
    >
      <p className={`text-sm font-semibold ${titleClass}`}>{title}</p>
      {children ? (
        <div className="mt-1 text-xs leading-relaxed text-ink-secondary">{children}</div>
      ) : null}
    </div>
  );
}

export function TickerIntelligence() {
  const [input, setInput] = useState("");
  const { status, symbol, data, error, lastSubmitted, research, retry } = useTickerResearch();
  const showResult =
    (status === "ok" || status === "partial" || status === "insufficient_data") && data !== null;

  return (
    <section
      id="ticker-intelligence"
      aria-labelledby="ticker-intelligence-heading"
      className="space-y-4"
    >
      <SectionHeader
        id="ticker-intelligence-heading"
        kicker="On-demand research"
        title="Ticker Intelligence"
        subtitle="Verified research for one supported US equity: identity, price, volume, volatility, range, sector and company evidence."
      />

      <p className="text-[11px] leading-relaxed text-ink-secondary">
        Scope: active, tradable US equities known to the provider security directory — not limited
        to the anomaly Top 8 and not a fixed watchlist. Evidence is fetched on demand; delayed-SIP
        modules are never labeled live, and nothing is estimated when a provider is unavailable.
      </p>

      <form
        aria-label="Ticker research"
        aria-busy={status === "loading"}
        className="flex flex-col gap-2 sm:flex-row sm:items-center"
        onSubmit={(event) => {
          event.preventDefault();
          research(input);
        }}
      >
        <label htmlFor="ticker-research-input" className="sr-only">
          US stock ticker symbol
        </label>
        <input
          id="ticker-research-input"
          name="symbol"
          type="text"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={16}
          placeholder="Enter a US stock ticker, e.g. NVDA"
          className="min-w-0 flex-1 rounded-full border border-line bg-white/80 px-4 py-2 text-sm uppercase text-ink placeholder:text-ink-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2"
        />
        <button
          type="submit"
          disabled={status === "loading"}
          className="rounded-full bg-brand-deep px-4 py-2 text-sm font-semibold text-surface transition-colors hover:bg-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 disabled:opacity-60"
        >
          {status === "loading" ? "Researching…" : "Research"}
        </button>
      </form>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
          Examples
        </span>
        {SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            onClick={() => {
              setInput(suggestion);
              research(suggestion);
            }}
            className="rounded-full border border-line bg-white/70 px-2.5 py-1 text-xs font-semibold text-ink-secondary transition-colors hover:bg-sakura-100 hover:text-brand-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
          >
            {suggestion}
          </button>
        ))}
        <span className="text-[10px] text-ink-muted">
          Shortcuts only — any supported ticker works.
        </span>
      </div>

      {status === "idle" ? (
        <StatusPanel tone="info" title="No ticker selected">
          Enter a symbol and press Research (or Enter) to load its verified research. Nothing is
          fetched until you submit, and no demo data is substituted on failure.
        </StatusPanel>
      ) : null}

      {status === "loading" ? (
        <StatusPanel tone="info" title={`Researching ${symbol ?? "symbol"}…`}>
          <span aria-live="polite">
            Querying the supported providers for identity, prices, history, sector and company
            evidence. A cold cache can take a few seconds.
          </span>
        </StatusPanel>
      ) : null}

      {status === "invalid_symbol" ? (
        <StatusPanel tone="error" title="That symbol cannot be researched">
          {error?.message ?? "Symbol must start with a letter (max 10 characters)."}
        </StatusPanel>
      ) : null}

      {status === "unknown_symbol" ? (
        <StatusPanel tone="error" title="No supported equity found for this symbol.">
          {symbol ? <strong className="font-semibold">{symbol} </strong> : null}
          was not recognised by the provider security directory. Check the ticker and try again.
        </StatusPanel>
      ) : null}

      {status === "unsupported_security_type" ? (
        <StatusPanel
          tone="warn"
          title="This security type is not supported by Ticker Intelligence."
        >
          Only active, tradable US equities are supported. ETFs, crypto, options and OTC listings
          are out of scope.
        </StatusPanel>
      ) : null}

      {status === "unavailable" ? (
        <StatusPanel tone="warn" title="Ticker research temporarily unavailable.">
          <p>
            {error?.message ?? "The research providers did not return usable data for this symbol."}{" "}
            No cached or demo values are substituted.
          </p>
          <button
            type="button"
            onClick={retry}
            disabled={!lastSubmitted}
            className="mt-2 rounded-full border border-line bg-white/80 px-3 py-1.5 text-xs font-semibold text-ink-secondary transition-colors hover:bg-sakura-100 hover:text-brand-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:opacity-60"
          >
            Retry
          </button>
        </StatusPanel>
      ) : null}

      {showResult && data ? (
        <div className="space-y-4 rounded-2xl border border-line bg-white/60 p-4 shadow-card">
          <IdentityHeader data={data} />
          <CoverageNotices data={data} />
          <TickerMetricGrid data={data} />
          <ProvenanceStrip data={data} />
          <div className="grid grid-cols-1 gap-6 border-t border-line pt-4 xl:grid-cols-2">
            <TickerCompanyEvidence data={data} />
            <TickerEvidencePanel data={data} />
          </div>
        </div>
      ) : null}
    </section>
  );
}
