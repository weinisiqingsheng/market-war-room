import type { IndexSurface, MarketIndex, TrendDirection } from "@/types/market";
import { cn } from "@/lib/cn";
import { formatPrice, formatSignedPct } from "@/lib/format";
import { Sparkline } from "./Sparkline";
import { Trend } from "./ui/Trend";

const surfaces: Record<IndexSurface, string> = {
  sakura: "bg-sakura-300",
  lavender: "bg-lavender",
  cream: "bg-cream",
  mint: "bg-mint",
};

function directionOf(changePct: number | null): TrendDirection {
  if (changePct === null) return "flat";
  if (changePct > 0) return "up";
  if (changePct < 0) return "down";
  return "flat";
}

function priceOrDash(value: number | null): string {
  return value === null ? "—" : formatPrice(value);
}

/**
 * One index card. Fully presentational — receives data via props.
 * Tolerates unavailable symbols (nulls render as "—"); sparkline renders only
 * when a real series is provided (demo/preview), never manufactured for live.
 */
export function MarketIndexCard({ index }: { index: MarketIndex }) {
  const direction = directionOf(index.changePct);

  const price = index.price;
  const low = index.low;
  const high = index.high;
  const hasDayPosition = price !== null && high !== null && low !== null;
  const dayRange = hasDayPosition ? Math.max(0, high - low) : 0;
  const dayPositionPct =
    hasDayPosition && dayRange > 0
      ? Math.min(100, Math.max(0, ((price - low) / dayRange) * 100))
      : null;

  const sparkline = index.sparkline;
  const hasSparkline = Array.isArray(sparkline) && sparkline.length > 0;

  return (
    <article
      className={cn(
        "flex h-full flex-col overflow-hidden rounded-[20px] border border-white/60 p-4 shadow-soft",
        surfaces[index.surface],
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-base font-semibold leading-tight text-ink">{index.ticker}</h3>
          <p className="truncate text-xs text-ink-secondary">{index.name}</p>
        </div>
        {index.changePct === null ? (
          <span className="rounded-full bg-white/60 px-2 py-1 text-xs font-medium tabular-nums text-ink-muted">
            —
          </span>
        ) : (
          <Trend
            direction={direction}
            className="rounded-full bg-white/60 px-2 py-1 text-xs font-semibold"
          >
            {formatSignedPct(index.changePct)}
          </Trend>
        )}
      </div>

      <p className="mt-3 text-3xl font-semibold tracking-tight tabular-nums text-ink">
        {priceOrDash(index.price)}
      </p>

      <dl className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
        <div>
          <dt className="text-ink-muted">Open</dt>
          <dd className="mt-0.5 font-medium tabular-nums text-ink-secondary">
            {priceOrDash(index.open)}
          </dd>
        </div>
        <div>
          <dt className="text-ink-muted">High</dt>
          <dd className="mt-0.5 font-medium tabular-nums text-ink-secondary">
            {priceOrDash(index.high)}
          </dd>
        </div>
        <div>
          <dt className="text-ink-muted">Low</dt>
          <dd className="mt-0.5 font-medium tabular-nums text-ink-secondary">
            {priceOrDash(index.low)}
          </dd>
        </div>
      </dl>

      {hasDayPosition && dayPositionPct !== null ? (
        <div
          role="img"
          aria-label={`${index.ticker} trading ${Math.round(dayPositionPct)} percent through today's range`}
          className="mt-3"
        >
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-medium text-ink-muted">L</span>
            <div className="relative h-1.5 flex-1 rounded-full bg-white/70">
              <span
                className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand ring-2 ring-white/70"
                style={{ left: `${dayPositionPct}%` }}
              />
            </div>
            <span className="text-[10px] font-medium text-ink-muted">H</span>
          </div>
        </div>
      ) : (
        <div className="mt-3 text-[11px] text-ink-muted" aria-hidden="true">
          Day range unavailable
        </div>
      )}

      {hasSparkline ? (
        <div className="mt-auto pt-3">
          <Sparkline
            data={sparkline}
            tone={direction}
            label={`${index.ticker} preview trend, ${index.changePct !== null && index.changePct >= 0 ? "up" : "down"}`}
          />
        </div>
      ) : (
        <div className="mt-auto pt-3 text-right text-[10px] font-normal text-ink-muted/70">
          Intraday chart coming soon
        </div>
      )}
    </article>
  );
}
