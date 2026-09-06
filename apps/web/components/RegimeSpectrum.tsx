interface RegimeSpectrumProps {
  score: number;
  label: string;
  labels: {
    riskOff: string;
    neutral: string;
    riskOn: string;
  };
}

/**
 * Horizontal regime spectrum — a gradient track with a marker near the score.
 * Deliberately NOT a circular credit-score gauge (approved direction).
 */
export function RegimeSpectrum({ score, label, labels }: RegimeSpectrumProps) {
  const clamped = Math.min(100, Math.max(0, score));

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
          Regime Spectrum
        </p>
        <p className="text-[11px] text-ink-muted">
          Current: <span className="font-semibold text-ink">{label}</span>
        </p>
      </div>

      <div
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={clamped}
        aria-label={`Market regime score ${clamped} of 100 — ${label}`}
        className="mt-3"
      >
        {/* Track */}
        <div className="relative h-2.5 rounded-full bg-gradient-to-r from-[#F2C3D2] via-[#F3E2C4] to-[#CFE7D7]">
          <span
            className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${clamped}%` }}
          >
            <span className="block h-5 w-5 rounded-full border-[3px] border-surface bg-brand shadow-pop" />
          </span>
        </div>

        {/* Score badge pinned to the marker position */}
        <div className="relative mt-2 h-6">
          <span className="absolute -translate-x-1/2" style={{ left: `${clamped}%` }}>
            <span className="rounded-md bg-brand-deep px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-surface shadow-pop">
              {score}
            </span>
          </span>
        </div>

        {/* Axis labels */}
        <div className="flex justify-between text-[11px] font-medium text-ink-muted">
          <span>{labels.riskOff}</span>
          <span className="text-ink-secondary">{labels.neutral}</span>
          <span>{labels.riskOn}</span>
        </div>
      </div>
    </div>
  );
}
