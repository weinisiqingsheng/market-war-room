import type { SectorPerformance, TrendDirection } from "@/types/market";
import { formatSignedPct } from "@/lib/format";
import { ToneBadge } from "./ui/ToneBadge";
import { Trend } from "./ui/Trend";

function directionOf(value: number | null): TrendDirection {
  if (value === null) return "flat";
  if (value > 0) return "up";
  if (value < 0) return "down";
  return "flat";
}

function pctOrDash(value: number | null): string {
  return value === null ? "—" : formatSignedPct(value);
}

const ROW_COLUMNS = "md:grid-cols-[1.6fr_0.7fr_0.7fr_0.9fr_1.1fr]";

export function SectorRow({ sector }: { sector: SectorPerformance }) {
  return (
    <li
      className={`grid grid-cols-2 items-center gap-x-3 gap-y-2 rounded-xl border border-line/70 bg-white/60 px-3 py-2.5 ${ROW_COLUMNS}`}
    >
      <div className="col-span-2 md:col-span-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-ink">{sector.sector}</span>
          <span className="rounded bg-line px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-ink-secondary">
            {sector.etf}
          </span>
        </div>
      </div>

      <div className="md:col-span-1">
        <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-muted md:hidden">
          Daily
        </p>
        <Trend direction={directionOf(sector.dailyReturnPct)} className="text-xs">
          {pctOrDash(sector.dailyReturnPct)}
        </Trend>
      </div>

      <div className="md:col-span-1">
        <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-muted md:hidden">
          vs SPY
        </p>
        <Trend direction={directionOf(sector.relativeReturnPct)} className="text-xs">
          {pctOrDash(sector.relativeReturnPct)}
        </Trend>
      </div>

      <div className="md:col-span-1">
        <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-muted md:hidden">
          Signal
        </p>
        <ToneBadge tone={sector.tone} label={sector.signal} />
      </div>

      <div className="col-span-2 md:col-span-1">
        <div className="mb-1 flex items-center justify-between text-[10px] text-ink-muted">
          <span className="uppercase tracking-wide md:hidden">Strength</span>
          <span className="tabular-nums font-medium text-ink-secondary">
            {sector.strength === null ? "—" : Math.round(sector.strength)}
          </span>
        </div>
        {sector.strength !== null ? (
          <div
            role="img"
            aria-label={`${sector.sector} relative strength ${Math.round(sector.strength)} of 100`}
            className="h-1.5 w-full rounded-full bg-line"
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-softpink to-brand"
              style={{ width: `${sector.strength}%` }}
            />
          </div>
        ) : (
          <div className="h-1.5 w-full rounded-full bg-line/60" aria-hidden="true" />
        )}
      </div>
    </li>
  );
}
