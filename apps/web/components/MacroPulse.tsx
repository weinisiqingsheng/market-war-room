import type { MacroDataMeta, MacroSignal, MarketDataMode } from "@war-room/types";
import { SectionHeader } from "./SectionHeader";
import { MacroSignalCard } from "./MacroSignalCard";
import { DemoTag } from "./ui/DemoTag";
import { ProvenanceStatus } from "./ui/ProvenanceTag";

interface MacroPulseProps {
  signals: MacroSignal[] | null;
  status: ProvenanceStatus;
  mode: MarketDataMode;
  meta: MacroDataMeta | null;
  /** Markets workspace labels this section "Macro Dashboard"; Overview keeps "Macro Pulse". */
  title?: string;
}

const SKELETON_LABELS = ["VIX", "US 10Y", "WTI", "US Dollar", "Gold", "BTC"];

/**
 * Macro Pulse. Each cell discloses its own source + frequency provenance
 * ("FRED · Daily", "Twelve Data · Live", "Alpaca · Live"). The section tag is
 * deliberately safe language ("MACRO DATA") rather than "LIVE MACRO DATA",
 * because FRED cells are daily observations, not real-time.
 */
export function MacroPulse({
  signals,
  status,
  mode,
  meta,
  title = "Macro Pulse",
}: MacroPulseProps) {
  const isLive = mode === "live";

  return (
    <section id="macro-pulse" aria-labelledby="macro-pulse-heading">
      <SectionHeader
        id="macro-pulse-heading"
        kicker="Macro Signals"
        title={title}
        subtitle="Raw price direction and market interpretation are separate signals"
        meta={
          isLive ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white/70 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-ink-secondary">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
              Macro Data · Multi-source
            </span>
          ) : (
            <DemoTag label="DEMO" />
          )
        }
      />

      {status === "error" ? (
        <div
          role="status"
          className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6"
          aria-label="Macro data unavailable"
        >
          {SKELETON_LABELS.map((label) => (
            <div
              key={label}
              className="flex h-full flex-col rounded-2xl border border-line bg-surface p-3.5"
            >
              <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                {label}
              </span>
              <p className="mt-2 text-xl font-semibold tabular-nums text-ink">—</p>
              <div className="mt-2 text-xs text-ink-muted">Unavailable</div>
              <p className="mt-auto pt-2 text-[10px] text-ink-muted">Provider unreachable</p>
            </div>
          ))}
        </div>
      ) : status === "loading" || signals === null ? (
        <div
          className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6"
          role="status"
          aria-label="Loading macro data"
        >
          {SKELETON_LABELS.map((label) => (
            <div
              key={label}
              className="flex h-full animate-pulse flex-col rounded-2xl border border-line bg-surface p-3.5"
            >
              <div className="h-3 w-10 rounded bg-line" />
              <div className="mt-3 h-6 w-16 rounded bg-line" />
              <div className="mt-3 h-4 w-20 rounded bg-line" />
            </div>
          ))}
        </div>
      ) : (
        <ul className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {signals.map((signal) => (
            <li key={signal.id} className="h-full">
              <MacroSignalCard signal={signal} />
            </li>
          ))}
        </ul>
      )}

      {isLive && meta && (
        <p className="mt-3 text-[10px] text-ink-muted">
          Sources refresh at different cadences — FRED daily, Twelve Data intraday, BTC real-time.
          Individual cells disclose their own freshness.
        </p>
      )}
    </section>
  );
}
