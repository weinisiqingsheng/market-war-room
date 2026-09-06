"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import type { SuggestedQuestion } from "@/types/market";
import { SakuraLogo } from "./SakuraLogo";
import { SectionHeader } from "./SectionHeader";
import { DemoTag } from "./ui/DemoTag";
import { SparkleIcon } from "./ui/icons";

const DEV_NOTICE =
  "Ask War Room is a UI preview — no AI backend yet. The answer engine arrives in a later phase.";

interface AskWarRoomProps {
  suggestions: SuggestedQuestion[];
}

/**
 * UI-only Ask War Room. Phase 0A intentionally does not produce fake AI
 * answers: submitting is intercepted and a development notice is shown.
 */
export function AskWarRoom({ suggestions }: AskWarRoomProps) {
  const [value, setValue] = useState("");
  const [showNotice, setShowNotice] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setShowNotice(true);
  }

  return (
    <section id="ask-war-room" aria-labelledby="ask-war-room-heading">
      <div className="relative overflow-hidden rounded-3xl border border-line bg-gradient-to-br from-sakura-50 via-sakura-100 to-surface p-6 shadow-card lg:p-10">
        <SakuraLogo
          size={130}
          className="pointer-events-none absolute -right-8 -bottom-10 opacity-[0.07]"
        />

        <div className="mx-auto max-w-2xl">
          <SectionHeader
            id="ask-war-room-heading"
            align="center"
            kicker="Sakura AI"
            title="Ask War Room"
            subtitle="Ask Sakura why the market is moving"
            meta={<DemoTag label="Preview" />}
          />

          <form onSubmit={handleSubmit} className="mt-6" aria-label="Ask a market question">
            <div className="flex flex-col gap-2 sm:flex-row">
              <label htmlFor="ask-input" className="sr-only">
                Ask a market question
              </label>
              <input
                id="ask-input"
                type="text"
                value={value}
                onChange={(event) => {
                  setValue(event.target.value);
                  setShowNotice(false);
                }}
                placeholder="Ask why the market is moving…"
                autoComplete="off"
                className="h-11 min-w-0 flex-1 rounded-full border border-line bg-surface px-4 text-sm text-ink placeholder:text-ink-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2"
              />
              <button
                type="submit"
                className="h-11 shrink-0 rounded-full bg-brand-deep px-5 text-sm font-semibold text-surface transition-colors hover:brightness-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2"
              >
                Ask Sakura
              </button>
            </div>
          </form>

          {showNotice && (
            <p
              role="status"
              className="mx-auto mt-4 flex w-fit max-w-full items-center gap-2 rounded-full border border-line bg-white/80 px-4 py-2 text-xs text-ink-secondary"
            >
              <SparkleIcon className="h-3.5 w-3.5 shrink-0 text-brand" />
              {DEV_NOTICE}
            </p>
          )}

          <div className="mt-6">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
              Suggested questions
            </p>
            <ul className="mt-2 flex flex-wrap justify-center gap-2">
              {suggestions.map((question) => (
                <li key={question.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setValue(question.label);
                      setShowNotice(false);
                    }}
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
