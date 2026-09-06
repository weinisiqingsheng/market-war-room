import type { MarketAnomaly, RelativeStrength, TrendDirection } from "@/types/market";
import { formatSignedPct, formatVolume } from "@/lib/format";
import { SectionHeader } from "./SectionHeader";
import { DemoTag } from "./ui/DemoTag";
import { Trend } from "./ui/Trend";

function directionOf(value: number): TrendDirection {
  if (value > 0) return "up";
  if (value < 0) return "down";
  return "flat";
}

const strengthStyle: Record<RelativeStrength, string> = {
  3: "text-pos",
  2: "text-pos/70",
  1: "text-ink-muted",
};

function StrengthMark({ level }: { level: RelativeStrength }) {
  return (
    <span
      className={`tabular-nums font-semibold tracking-tight ${strengthStyle[level]}`}
      aria-label={`Relative strength ${level} of 3`}
    >
      {"+".repeat(level)}
      <span className="sr-only"> ({level} of 3)</span>
    </span>
  );
}

export function MarketAnomalies({ anomalies }: { anomalies: MarketAnomaly[] }) {
  return (
    <section id="market-anomalies" aria-labelledby="market-anomalies-heading">
      <div className="flex h-full flex-col rounded-[20px] border border-line bg-surface p-5 shadow-card">
        <SectionHeader
          id="market-anomalies-heading"
          kicker="Unusual Activity"
          title="Market Anomalies"
          subtitle="Not top gainers — demo rows, not trade recommendations"
          meta={<DemoTag label="DEMO" />}
        />

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <caption className="sr-only">
              Unusual market activity — demo data for the Phase 0A design preview.
            </caption>
            <thead>
              <tr className="border-b border-line text-left text-[10px] uppercase tracking-wider text-ink-muted">
                <th scope="col" className="py-2 pr-3 font-semibold">
                  Symbol
                </th>
                <th scope="col" className="px-2 py-2 font-semibold">
                  Move
                </th>
                <th scope="col" className="px-2 py-2 font-semibold">
                  Rel. Vol
                </th>
                <th scope="col" className="px-2 py-2 font-semibold">
                  HOD Dist
                </th>
                <th scope="col" className="px-2 py-2 font-semibold">
                  Rel. Strength
                </th>
                <th scope="col" className="px-2 py-2 text-right font-semibold">
                  Score
                </th>
              </tr>
            </thead>
            <tbody>
              {anomalies.map((anomaly) => (
                <tr key={anomaly.symbol} className="border-b border-line/60 last:border-0">
                  <td className="py-2.5 pr-3 font-semibold text-ink">{anomaly.symbol}</td>
                  <td className="px-2 py-2.5">
                    <Trend direction={directionOf(anomaly.movePct)} className="text-xs">
                      {formatSignedPct(anomaly.movePct)}
                    </Trend>
                  </td>
                  <td className="px-2 py-2.5 tabular-nums text-ink-secondary">
                    {formatVolume(anomaly.relativeVolume)}
                  </td>
                  <td className="px-2 py-2.5 tabular-nums text-ink-secondary">
                    {anomaly.hodDistancePct.toFixed(1)}%
                  </td>
                  <td className="px-2 py-2.5">
                    <StrengthMark level={anomaly.relativeStrength} />
                  </td>
                  <td className="px-2 py-2.5 text-right">
                    <span className="inline-flex items-center justify-end gap-2">
                      <span className="tabular-nums font-semibold text-ink">{anomaly.score}</span>
                      <span className="h-1 w-10 rounded-full bg-line" aria-hidden="true">
                        <span
                          className="block h-full rounded-full bg-accent"
                          style={{ width: `${anomaly.score}%` }}
                        />
                      </span>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-4 border-t border-line pt-3 text-[11px] text-ink-muted">
          Captured in the design preview. Scores are fixtures, not signals.
        </p>
      </div>
    </section>
  );
}
