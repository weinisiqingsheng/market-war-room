import { ANOMALY_UNIVERSE_IDS, anomalyUniverseOrDefault } from "@/lib/anomalies/universe/registry";
import type { AnomalyUniverseId } from "@/lib/anomalies/universe/types";

/**
 * Markets-only anomaly universe selector (V1.1E).
 *
 * Compact Sakura-style pills; default is S&P 500. This is local component
 * state only — nothing is persisted to the browser or sent to a server-side
 * session, and no cookie is written.
 */
export function AnomalyUniverseSelector({
  value,
  onChange,
  busy = false,
}: {
  value: AnomalyUniverseId;
  onChange: (universeId: AnomalyUniverseId) => void;
  busy?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
        Anomaly universe
      </span>
      <div
        role="group"
        aria-label="Anomaly universe"
        aria-busy={busy}
        className="inline-flex rounded-full border border-line bg-white/70 p-0.5"
      >
        {ANOMALY_UNIVERSE_IDS.map((id) => {
          const selected = value === id;
          return (
            <button
              key={id}
              type="button"
              aria-pressed={selected}
              data-universe={id}
              onClick={() => {
                if (!selected) onChange(id);
              }}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 ${
                selected
                  ? "bg-brand-deep text-surface"
                  : "text-ink-secondary hover:bg-sakura-100 hover:text-brand-deep"
              }`}
            >
              {anomalyUniverseOrDefault(id).label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
