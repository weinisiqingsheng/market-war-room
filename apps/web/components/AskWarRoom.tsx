"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import type { SuggestedQuestion } from "@/types/market";
import { SakuraLogo } from "./SakuraLogo";
import { SectionHeader } from "./SectionHeader";
import { useAskSakura, type AskTickerResearchInfo } from "@/features/ask-sakura/useAskSakura";

interface AskWarRoomProps {
  suggestions: SuggestedQuestion[];
}

const MAX_LENGTH = 500;

/** Human-readable, safe explanation for ticker-specific limitations (V1.2B). */
function tickerLimitationFor(
  reason: string | null,
  research: AskTickerResearchInfo | null,
): string | null {
  if (reason === "unknown_symbol") {
    return `${research?.requestedSymbol ?? "That symbol"} could not be verified in the supported security directory, so no ticker-specific evidence was used.`;
  }
  if (reason === "unsupported_security_type") {
    return `${research?.requestedSymbol ?? "That symbol"} is not a supported active US equity, so no ticker-specific evidence was used.`;
  }
  if (reason === "ambiguous_ticker") {
    return "More than one ticker was mentioned. Ask about one symbol at a time so the evidence stays attributable.";
  }
  if (reason === "ticker_insufficient_evidence") {
    return "On-demand research for that symbol returned insufficient price or history evidence to answer safely.";
  }
  return null;
}

function badgeFor(status: string): string {
  if (status === "insufficient_evidence") return "Limited Evidence";
  if (status === "out_of_scope") return "Out of Scope";
  return "";
}

function TrustBadge() {
  return (
    <span className="rounded-full border border-line bg-white/80 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-ink-secondary">
      Grounded · ask-sakura-v1
    </span>
  );
}

/**
 * Ask Sakura — grounded, stateless question panel (V1.1D).
 * One question at a time against POST /api/ai/ask-sakura; answers are shown
 * only after deterministic grounding completes. No chat memory, no streaming.
 */
export function AskWarRoom({ suggestions }: AskWarRoomProps) {
  const { status, data, errorKind, lastQuestion, research, insufficientReason, submit, retry } =
    useAskSakura();
  const [value, setValue] = useState("");
  const [asked, setAsked] = useState<string | null>(null);

  const trimmed = value.trim();
  const canSubmit = trimmed.length >= 2 && trimmed.length <= MAX_LENGTH && status !== "submitting";

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;
    setAsked(trimmed);
    submit(trimmed);
  }

  const success = data?.answer;

  return (
    <section id="ask-sakura" aria-labelledby="ask-sakura-heading">
      <div className="relative overflow-hidden rounded-3xl border border-line bg-gradient-to-br from-sakura-50 via-sakura-100 to-surface p-6 shadow-card lg:p-10">
        <SakuraLogo
          size={130}
          className="pointer-events-none absolute -right-8 -bottom-10 opacity-[0.07]"
        />

        <div className="mx-auto max-w-2xl">
          <SectionHeader
            id="ask-sakura-heading"
            align="center"
            kicker="Sakura AI"
            title="Ask Sakura"
            subtitle="Ask questions about the market evidence currently available in the War Room."
            meta={<TrustBadge />}
          />
          <p className="mx-auto mt-1 max-w-xl text-center text-xs text-ink-muted">
            Answers are generated from grounded market evidence, not outside market knowledge.
          </p>

          <form onSubmit={handleSubmit} className="mt-6" aria-label="Ask Sakura a market question">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <label htmlFor="ask-sakura-input" className="sr-only">
                Ask a market question about current evidence
              </label>
              <textarea
                id="ask-sakura-input"
                value={value}
                onChange={(event) => setValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    const form = event.currentTarget.form;
                    if (form) form.requestSubmit();
                  }
                }}
                placeholder="Ask about today's market, a ticker, breadth, regime, or catalysts…"
                autoComplete="off"
                rows={2}
                className="min-w-0 flex-1 resize-y rounded-2xl border border-line bg-surface px-4 py-2.5 text-sm text-ink placeholder:text-ink-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2"
              />
              <button
                type="submit"
                disabled={!canSubmit}
                className="h-11 shrink-0 rounded-full bg-brand-deep px-5 text-sm font-semibold text-surface transition-colors hover:brightness-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {status === "submitting" ? "Checking evidence…" : "Ask Sakura"}
              </button>
            </div>
            <div className="mt-1 flex min-h-4 items-start justify-between gap-2 text-[11px] text-ink-muted">
              <span aria-live="polite">
                {value.length > 440 && `Character limit ${MAX_LENGTH}`}
              </span>
              <span className="sr-only">Press Enter to ask, Shift + Enter for a new line.</span>
            </div>
          </form>

          {status === "submitting" && (
            <p
              role="status"
              aria-label="Checking current grounded evidence"
              className="mx-auto mt-4 flex w-fit items-center gap-2 rounded-full border border-line bg-white/80 px-4 py-2 text-xs text-ink-secondary"
            >
              Checking current evidence…
            </p>
          )}

          <div aria-live="polite">
            {status === "success" && success ? (
              <article className="mt-5 rounded-2xl border border-line bg-white/80 p-4 shadow-soft">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-semibold text-ink">Answer</h3>
                  {success.status === "answered" ? <TrustBadge /> : null}
                  {success.status === "insufficient_evidence" && (
                    <span className="rounded-full border border-line bg-white/80 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-ink-secondary">
                      {badgeFor(success.status)}
                    </span>
                  )}
                  {success.status === "out_of_scope" && (
                    <span className="rounded-full border border-line bg-white/80 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-ink-muted">
                      {badgeFor(success.status)}
                    </span>
                  )}
                </div>
                {asked && (
                  <p className="mt-2 text-xs font-medium text-ink-muted">
                    Question: <span className="text-ink-secondary">{asked}</span>
                  </p>
                )}
                <p className="mt-3 text-sm leading-relaxed text-ink">{success.answer.text}</p>

                {success.supportingPoints.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-[10px] font-bold uppercase tracking-[0.18em] text-accent">
                      Supporting Evidence
                    </h4>
                    <ul className="mt-1.5 flex flex-col gap-1.5 text-xs leading-relaxed text-ink-secondary">
                      {success.supportingPoints.map((point, index) => (
                        <li key={index}>· {point.text}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {success.limitations.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-[10px] font-bold uppercase tracking-[0.18em] text-ink-muted">
                      Limitations
                    </h4>
                    <ul className="mt-1.5 flex flex-col gap-1.5 text-xs leading-relaxed text-ink-muted">
                      {success.limitations.map((limitation, index) => (
                        <li key={index}>· {limitation.text}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <footer className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line pt-3 text-[11px] text-ink-muted">
                  {data.selectedFactCount > 0 && (
                    <span>Grounded in {data.selectedFactCount} selected facts</span>
                  )}
                  {data.contextFingerprint && (
                    <span>· Current evidence · fp {data.contextFingerprint.slice(0, 8)}…</span>
                  )}
                  {data.research?.symbol && (
                    <span>
                      · On-demand ticker research · {data.research.symbol}
                      {data.research.status !== "ok" ? " · partial evidence" : ""}
                      {data.research.marketSessionAsOf
                        ? ` · session ${data.research.marketSessionAsOf} ET`
                        : ""}
                    </span>
                  )}
                  <Link
                    href="/intelligence"
                    className="ml-auto rounded-full border border-line bg-white/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-accent hover:bg-sakura-100 hover:text-brand-deep"
                  >
                    View evidence
                  </Link>
                </footer>
              </article>
            ) : null}

            {status === "api_insufficient" && (
              <div className="mt-5 rounded-2xl border border-line bg-white/80 p-4">
                <h3 className="text-sm font-semibold text-ink">Current Data Insufficient</h3>
                <p className="mt-2 text-sm text-ink-secondary">
                  Ask Sakura doesn&apos;t currently have enough reliable grounded market data to
                  answer.
                </p>
                {tickerLimitationFor(insufficientReason, research) && (
                  <p className="mt-2 text-xs text-ink-muted">
                    {tickerLimitationFor(insufficientReason, research)}
                  </p>
                )}
              </div>
            )}

            {status === "unavailable" && (
              <div className="mt-5 rounded-2xl border border-line bg-white/80 p-4">
                <h3 className="text-sm font-semibold text-ink">
                  Ask Sakura temporarily unavailable.
                </h3>
                <p className="mt-1 text-xs text-ink-secondary">
                  {errorKind === "invalid_request"
                    ? "That question is outside the allowed format."
                    : "The grounded answer service could not be reached."}
                </p>
                <button
                  type="button"
                  onClick={retry}
                  disabled={!lastQuestion}
                  className="mt-3 rounded-full bg-sakura-300 px-3 py-1.5 text-xs font-semibold text-brand-deep hover:brightness-95 disabled:opacity-50"
                >
                  Retry
                </button>
              </div>
            )}
          </div>

          <div className="mt-6">
            <p className="text-center text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
              Suggested questions
            </p>
            <ul className="mt-2 flex flex-wrap justify-center gap-2">
              {suggestions.map((question) => (
                <li key={question.id}>
                  <button
                    type="button"
                    onClick={() => setValue(question.label)}
                    className="rounded-full border border-line bg-white/80 px-3 py-1.5 text-xs text-ink-secondary transition-colors hover:border-accent/50 hover:text-brand-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2"
                  >
                    {question.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
