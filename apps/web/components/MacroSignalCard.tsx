import type { MacroFrequency, MacroSignal, TrendDirection } from "@/types/market";
import { formatMacroChange, formatMacroValue } from "@/lib/format";
import { ToneBadge } from "./ui/ToneBadge";
import { Trend } from "./ui/Trend";

function directionOf(change: number | null): TrendDirection {
  if (change === null) return "flat";
  if (change > 0) return "up";
  if (change < 0) return "down";
  return "flat";
}

const FREQUENCY_LABEL: Record<MacroFrequency, string> = {
  realtime: "Live",
  intraday: "Live",
  daily: "Daily",
};

/**
 * One macro cell. Raw price direction and market interpretation are kept
 * visually distinct (Trend = direction color; ToneBadge = interpretation
 * tone). Each cell discloses its own source + frequency provenance.
 */
export function MacroSignalCard({ signal }: { signal: MacroSignal }) {
  const direction = directionOf(signal.change);
  const provenance =
    signal.source === "Demo"
      ? "Demo fixture"
      : signal.instrument
        ? `${signal.instrument} · ${signal.source} · ${FREQUENCY_LABEL[signal.frequency]}`
        : `${signal.source} · ${FREQUENCY_LABEL[signal.frequency]}`;

  return (
    <div className="flex h-full flex-col rounded-2xl border border-line bg-surface p-3.5">
      <div className="flex items-center justify-between gap-1">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
          {signal.label}
        </span>
        {signal.stale && (
          <span className="rounded-full bg-warn px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-surface">
            Stale
          </span>
        )}
      </div>

      <p className="mt-2 text-xl font-semibold tracking-tight tabular-nums text-ink">
        {formatMacroValue(signal)}
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {signal.change === null ? (
          <span className="text-xs tabular-nums text-ink-muted">—</span>
        ) : (
          <Trend direction={direction} className="text-xs">
            {formatMacroChange(signal)}
          </Trend>
        )}
        <ToneBadge
          tone={signal.tone}
          label={signal.interpretation ?? "Unavailable"}
          className="ml-auto"
        />
      </div>

      <p className="mt-auto pt-2 text-[10px] text-ink-muted">{provenance}</p>
    </div>
  );
}
