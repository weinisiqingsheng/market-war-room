"use client";

import type { TickerResearchApiOk } from "@/lib/ticker-context/api-types";
import type {
  SafeTickerPriceSummary,
  SafeTickerRangeSummary,
  SafeTickerSectorSummary,
  SafeTickerSummary,
  SafeTickerVolatilitySummary,
  SafeTickerVolumeSummary,
} from "@/lib/ticker-context/summary";
import { formatEtTime, formatPrice, formatSignedPct } from "@/lib/format";

/**
 * Ticker Intelligence metric cards (V1.2C).
 *
 * Every number rendered here comes verbatim from `summary` (ticker-summary-v1):
 * the UI never parses fact prose and never recomputes a metric. Missing values
 * render an explicit unavailable state instead of a placeholder number.
 */
const UNAVAILABLE = "Unavailable for this session";

function directionTone(changePct: number | null): string {
  if (changePct === null || changePct === 0) return "text-ink-secondary";
  return changePct > 0 ? "text-pos" : "text-neg";
}

function directionLabel(changePct: number | null): string {
  if (changePct === null || changePct === 0) return "Unchanged";
  return changePct > 0 ? "Advancing" : "Declining";
}

function Card({
  label,
  children,
  note,
}: {
  label: string;
  children: React.ReactNode;
  note?: string;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-line bg-white/70 p-4 shadow-soft">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
        {label}
      </p>
      <div className="mt-2 space-y-1.5">{children}</div>
      {note ? <p className="mt-2 text-[10px] leading-relaxed text-ink-muted">{note}</p> : null}
    </div>
  );
}

function Metric({
  label,
  value,
  tone = "text-ink",
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <p className="flex flex-wrap items-baseline justify-between gap-x-2 text-xs">
      <span className="text-ink-secondary">{label}</span>
      <span className={`tabular-nums font-semibold ${tone}`}>{value}</span>
    </p>
  );
}

function PriceCard({ price, symbol }: { price: SafeTickerPriceSummary | null; symbol: string }) {
  if (!price || price.value === null) {
    return (
      <Card
        label="Price · regular session"
        note="No regular-session reference price was available."
      >
        <p className="text-sm text-ink-secondary">{UNAVAILABLE}</p>
      </Card>
    );
  }
  return (
    <Card
      label="Price · regular session"
      note={`Reference price for the completed ${price.sessionDate ?? "latest"} ET session. Delayed SIP${price.delayMinutes ? ` ${price.delayMinutes}m` : ""} — never presented as live, and after-hours prints are never used as the session close.`}
    >
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className="tabular-nums text-2xl font-semibold text-ink">
          {formatPrice(price.value)}
        </span>
        <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
          {symbol}
        </span>
      </p>
      <Metric
        label="Change"
        value={
          price.changePct === null
            ? UNAVAILABLE
            : `${formatSignedPct(price.changePct)} · ${directionLabel(price.changePct)}`
        }
        tone={directionTone(price.changePct)}
      />
      <Metric
        label="Previous close"
        value={price.previousClose === null ? UNAVAILABLE : formatPrice(price.previousClose)}
      />
    </Card>
  );
}

function VolumeCard({ volume }: { volume: SafeTickerVolumeSummary | null }) {
  if (!volume || volume.sessionVolume === null) {
    return (
      <Card label="Volume" note="Completed-session volume and history were unavailable.">
        <p className="text-sm text-ink-secondary">{UNAVAILABLE}</p>
      </Card>
    );
  }
  return (
    <Card
      label="Volume"
      note={
        volume.sessionCompleted
          ? `Completed-session volume vs the 20-session average full-day volume (${volume.sessionDate ?? "latest session"} ET).`
          : "The session is still in progress: partial volume is shown as participation only and never as a comparable multiple."
      }
    >
      <Metric label="Session volume" value={volume.sessionVolume.toLocaleString("en-US")} />
      <Metric
        label="20-session average"
        value={
          volume.avgVolume20 === null ? UNAVAILABLE : volume.avgVolume20.toLocaleString("en-US")
        }
      />
      {volume.sessionCompleted ? (
        <Metric
          label="Relative volume"
          value={
            volume.relativeVolume === null ? UNAVAILABLE : `${volume.relativeVolume.toFixed(2)}×`
          }
          tone="text-brand-deep"
        />
      ) : (
        <Metric
          label="Participation so far"
          value={
            volume.partialSessionVolumePctOfAvg === null
              ? UNAVAILABLE
              : `${volume.partialSessionVolumePctOfAvg.toFixed(1)}% of average`
          }
          tone="text-warn"
        />
      )}
    </Card>
  );
}

function VolatilityCard({ volatility }: { volatility: SafeTickerVolatilitySummary | null }) {
  if (!volatility || volatility.returnVol20Pct === null) {
    return (
      <Card label="Volatility" note="Fewer than 20 completed sessions were available.">
        <p className="text-sm text-ink-secondary">{UNAVAILABLE}</p>
      </Card>
    );
  }
  return (
    <Card
      label="Volatility"
      note="Statistical magnitude only — not an anomaly-v1 score and not a probability of the next move."
    >
      <Metric label="20-session realized vol" value={`${volatility.returnVol20Pct.toFixed(2)}%`} />
      <Metric
        label="Latest move"
        value={
          volatility.latestMoveSigma === null
            ? UNAVAILABLE
            : `${volatility.latestMoveSigma.toFixed(2)}× that volatility`
        }
      />
      <Metric
        label="Sessions in window"
        value={
          volatility.historySessionCount === null
            ? UNAVAILABLE
            : String(volatility.historySessionCount)
        }
      />
    </Card>
  );
}

function RangeCard({ range }: { range: SafeTickerRangeSummary | null }) {
  if (
    !range ||
    range.rangePositionPct === null ||
    range.prior20Low === null ||
    range.prior20High === null
  ) {
    return (
      <Card
        label="Range position"
        note="Historical range unavailable (flat or insufficient completed sessions)."
      >
        <p className="text-sm text-ink-secondary">{UNAVAILABLE}</p>
      </Card>
    );
  }
  const clamped = Math.min(100, Math.max(0, range.rangePositionPct));
  return (
    <Card
      label="Range position"
      note="Position of the regular-session reference price inside the prior 20-session range."
    >
      <Metric label="Position in range" value={`${range.rangePositionPct.toFixed(1)}%`} />
      <div
        className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-line"
        role="img"
        aria-label={`Range position ${range.rangePositionPct.toFixed(1)} percent`}
      >
        <div className="h-full rounded-full bg-accent" style={{ width: `${clamped}%` }} />
      </div>
      <Metric label="20-session low" value={formatPrice(range.prior20Low)} />
      <Metric label="20-session high" value={formatPrice(range.prior20High)} />
    </Card>
  );
}

function SectorCard({ sector }: { sector: SafeTickerSectorSummary | null }) {
  if (!sector) {
    return (
      <Card label="Sector comparison" note="No validated sector metadata was available.">
        <p className="text-sm text-ink-secondary">Sector comparison unavailable.</p>
      </Card>
    );
  }
  return (
    <Card
      label="Sector comparison"
      note="Classification comes from the verified provider-directory mapping; the benchmark move is the same delayed-SIP observation."
    >
      <p className="text-sm font-semibold text-ink">
        {sector.name} / {sector.benchmarkTicker}
      </p>
      <Metric
        label={`${sector.benchmarkTicker} move`}
        value={
          sector.benchmarkChangePct === null
            ? UNAVAILABLE
            : formatSignedPct(sector.benchmarkChangePct)
        }
        tone={directionTone(sector.benchmarkChangePct)}
      />
      {sector.classificationSource ? (
        <Metric label="Classification source" value={sector.classificationSource} />
      ) : null}
    </Card>
  );
}

export interface TickerMetricGridProps {
  data: TickerResearchApiOk;
}

export function TickerMetricGrid({ data }: TickerMetricGridProps) {
  const summary: SafeTickerSummary = data.context.summary;
  const symbol = data.context.symbol;
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      <PriceCard price={summary.price} symbol={symbol} />
      <VolumeCard volume={summary.volume} />
      <VolatilityCard volatility={summary.volatility} />
      <RangeCard range={summary.range} />
      <SectorCard sector={summary.sector} />
      <Card
        label="Latest trade"
        note="Delayed SIP print that may include extended-hours activity — context only, never the regular-session reference price."
      >
        {summary.quote && summary.quote.tradePrice !== null ? (
          <>
            <Metric label="Last trade" value={formatPrice(summary.quote.tradePrice)} />
            <Metric
              label="Trade time (ET)"
              value={
                summary.quote.tradeTimestamp ? formatEtTime(summary.quote.tradeTimestamp) : "—"
              }
            />
          </>
        ) : (
          <p className="text-sm text-ink-secondary">No in-session trade print was available.</p>
        )}
      </Card>
    </div>
  );
}
