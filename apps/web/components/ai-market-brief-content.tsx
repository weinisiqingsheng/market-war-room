"use client";

import type { GroundedMarketBrief } from "@/lib/ai-brief/brief-types";

const impactTone: Record<string, string> = {
  positive: "bg-green-100 text-green-800",
  negative: "bg-rose-100 text-rose-700",
  mixed: "bg-amber-100 text-amber-800",
};
const impactGlyph: Record<string, string> = { positive: "▲", negative: "▼", mixed: "◆" };

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h4 className="text-[10px] font-bold uppercase tracking-[0.18em] text-accent">{children}</h4>;
}

export function AiMarketBriefContent({ brief }: { brief: GroundedMarketBrief }) {
  return (
    <>
      <h3 className="mt-4 text-xl font-bold leading-snug text-ink">{brief.headline}</h3>
      <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-ink-secondary">
        <span className="rounded-full bg-ink/5 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-ink-muted">{brief.stance.label}</span>
        <span>{brief.stance.summary}</span>
      </p>

      <div className="mt-4 flex flex-col gap-2.5">
        {brief.overview.map((item, i) => (
          <p key={`overview-${i}`} className="text-sm leading-relaxed text-ink-secondary">{item.text}</p>
        ))}
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <section aria-label="Key drivers">
          <SectionTitle>Key Drivers</SectionTitle>
          <ul className="mt-2 flex flex-col gap-2">
            {brief.keyDrivers.map((driver, i) => (
              <li key={`driver-${i}`} className="rounded-xl border border-line bg-sakura-50/70 p-3">
                <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                  <span aria-hidden className={`rounded px-1.5 py-0.5 text-[10px] ${impactTone[driver.impact] ?? "bg-ink/10 text-ink-muted"}`}>{impactGlyph[driver.impact] ?? "•"}</span>
                  <span className="sr-only">{driver.impact}</span>
                  {driver.title}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-ink-secondary">{driver.text}</p>
              </li>
            ))}
          </ul>
        </section>
        <div className="flex flex-col gap-4">
          <section>
            <SectionTitle>Market Internals</SectionTitle>
            <p className="mt-2 text-xs leading-relaxed text-ink-secondary">{brief.marketInternals.text}</p>
          </section>
          <section>
            <SectionTitle>Macro</SectionTitle>
            <p className="mt-2 text-xs leading-relaxed text-ink-secondary">{brief.macro.text}</p>
          </section>
        </div>
      </div>

      {brief.notableMoves.length > 0 && (
        <section className="mt-5" aria-label="Notable moves">
          <SectionTitle>Notable Moves</SectionTitle>
          <ul className="mt-2 flex flex-col gap-2">
            {brief.notableMoves.map((move, i) => (
              <li key={`move-${i}`} className="rounded-xl border border-line bg-white/60 p-3">
                <span className="rounded-full bg-sakura-300 px-2 py-0.5 text-[10px] font-bold text-brand-deep">{move.ticker}</span>
                <p className="mt-1.5 text-xs leading-relaxed text-ink-secondary">{move.text}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-5" aria-label="Watch next">
        <SectionTitle>Watch Next</SectionTitle>
        <ul className="mt-2 flex flex-col gap-1.5 text-xs text-ink-secondary">
          {brief.watchNext.map((item, i) => <li key={`watch-${i}`}>· {item.text}</li>)}
        </ul>
      </section>

      <footer className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line pt-3 text-[11px] text-ink-muted">
        <span className="font-semibold uppercase tracking-wider">{brief.dataQuality.confidence} confidence</span>
        <span className="min-w-0 break-words">{brief.dataQuality.text}</span>
      </footer>
    </>
  );
}
