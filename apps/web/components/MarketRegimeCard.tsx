import type { MarketDataMode, MarketRegime, RegimeDriver, RegimeResult } from "@/types/market";
import { formatEtTime } from "@/lib/format";
import { RegimeAttributionCard } from "./RegimeAttributionCard";
import { RegimeDriverCard } from "./RegimeDriverCard";
import { RegimeSpectrum } from "./RegimeSpectrum";
import { SakuraLogo } from "./SakuraLogo";
import { DemoTag } from "./ui/DemoTag";
import { ShieldIcon } from "./ui/icons";

export type RegimeCardStatus = "loading" | "ready" | "error";

interface MarketRegimeCardProps {
  mode: MarketDataMode;
  status: RegimeCardStatus;
  /** Demo fixture regime (mode=demo). */
  regime: MarketRegime | null;
  /** Demo driver cards (mode=demo). */
  regimeDrivers: RegimeDriver[] | null;
  /** Live engine result (mode=live). */
  result: RegimeResult | null;
  asOf?: string | null;
}

const SPECTRUM_LABELS = { riskOff: "Risk-Off", neutral: "Neutral", riskOn: "Risk-On" };

const CONFIDENCE_LABEL: Record<string, string> = {
  high: "High confidence",
  medium: "Medium confidence",
  low: "Low confidence",
  insufficient: "Insufficient coverage",
};

/**
 * Market Regime — the visual and information center of the product.
 *
 * Demo mode renders the typed demo fixture (clearly labeled DEMO, never LIVE).
 * Live mode renders the deterministic Python engine result: score, label, LIVE
 * provenance, coverage/confidence metadata, and explainable driver reasons. A
 * live failure renders "Regime unavailable" — never a silent demo score.
 */
export function MarketRegimeCard({
  mode,
  status,
  regime,
  regimeDrivers,
  result,
  asOf,
}: MarketRegimeCardProps) {
  if (mode === "live") {
    return <LiveRegimeCard status={status} result={result} asOf={asOf} />;
  }

  // Demo mode: keep the approved demo presentation intact.
  if (!regime || !regimeDrivers) return null;
  return (
    <section id="market-regime" aria-labelledby="market-regime-heading">
      <div className="relative overflow-hidden rounded-3xl border border-line bg-gradient-to-br from-surface via-sakura-100 to-sakura-50 p-6 shadow-card lg:p-8">
        <SakuraLogo
          size={150}
          className="pointer-events-none absolute -right-8 -top-12 opacity-[0.07]"
        />
        <div className="grid gap-8 lg:grid-cols-[1.05fr_1fr]">
          <div>
            <h2
              id="market-regime-heading"
              className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-deep"
            >
              Market Regime
            </h2>
            <div className="mt-3 flex items-end gap-2">
              <span className="text-6xl font-semibold leading-none tracking-tight tabular-nums text-ink">
                {regime.score}
              </span>
              <span className="pb-1 text-sm font-medium tabular-nums text-ink-muted">/ 100</span>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-neg-bg px-3 py-1 text-xs font-semibold text-neg">
                <ShieldIcon className="h-3.5 w-3.5" />
                {regime.label}
              </span>
              <span className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">
                Risk-Off tilt
              </span>
            </div>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-ink-secondary">
              {regime.explanation}
            </p>
            <div className="mt-5 inline-flex max-w-full flex-wrap items-center gap-2 rounded-full border border-line bg-white/80 py-1 pl-1 pr-3 shadow-soft">
              <span className="rounded-full bg-sakura-300 px-2.5 py-1 text-[11px] font-semibold text-brand-deep">
                {regime.insight.title}
              </span>
              <span className="text-xs font-medium text-ink-secondary">{regime.insight.text}</span>
            </div>
          </div>

          <div className="flex flex-col justify-center">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
                Regime Drivers
              </p>
              <DemoTag label="Demo" />
            </div>
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {regimeDrivers.map((driver) => (
                <RegimeDriverCard key={driver.id} driver={driver} />
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-8">
          <RegimeSpectrum score={regime.score} label={regime.label} labels={regime.spectrum} />
        </div>
      </div>
    </section>
  );
}
function LiveRegimeCard({
  status,
  result,
  asOf,
}: {
  status: RegimeCardStatus;
  result: RegimeResult | null;
  asOf?: string | null;
}) {
  if (status === "loading") {
    return (
      <section id="market-regime" aria-labelledby="market-regime-heading" aria-busy="true">
        <div className="animate-pulse rounded-3xl border border-line bg-surface p-6 shadow-card lg:p-8">
          <div className="h-3 w-28 rounded bg-line" />
          <div className="mt-6 h-14 w-40 rounded bg-line" />
          <div className="mt-6 h-4 w-full max-w-xl rounded bg-line" />
          <div className="mt-10 grid gap-3 sm:grid-cols-2">
            <div className="h-20 rounded-xl bg-line" />
            <div className="h-20 rounded-xl bg-line" />
          </div>
        </div>
      </section>
    );
  }

  if (status === "error" || !result) {
    return (
      <section id="market-regime" aria-labelledby="market-regime-heading">
        <div className="relative overflow-hidden rounded-3xl border border-line bg-gradient-to-br from-surface via-sakura-100 to-sakura-50 p-6 shadow-card lg:p-8">
          <h2
            id="market-regime-heading"
            className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-deep"
          >
            Market Regime
          </h2>
          <p className="mt-6 max-w-xl text-sm leading-relaxed text-ink-secondary">
            Market Regime is temporarily unavailable. The live regime engine could not be reached —
            the demo score is never substituted, and Market Pulse + Macro Pulse keep working
            normally.
          </p>
          <div className="mt-6">
            <span className="inline-flex items-center rounded-full bg-warn-bg px-3 py-1 text-xs font-semibold text-warn">
              Regime unavailable
            </span>
          </div>
        </div>
      </section>
    );
  }

  const score = result.score;
  const insufficient = score === null;
  const coveragePct = Math.round(result.coverage * 100);
  const staleCount = result.staleInputs.length;
  const missingCount = result.missingInputs.length;
  const chip = labelTone(result.label);
  const drivers = [...result.positiveDrivers, ...result.negativeDrivers];

  return (
    <section id="market-regime" aria-labelledby="market-regime-heading">
      <div className="relative overflow-hidden rounded-3xl border border-line bg-gradient-to-br from-surface via-sakura-100 to-sakura-50 p-6 shadow-card lg:p-8">
        <SakuraLogo
          size={150}
          className="pointer-events-none absolute -right-8 -top-12 opacity-[0.07]"
        />
        <div className="grid gap-8 lg:grid-cols-[1.05fr_1fr]">
          {/* Regime identity */}
          <div>
            <h2
              id="market-regime-heading"
              className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-deep"
            >
              Market Regime
            </h2>
            {insufficient ? (
              <div className="mt-3 text-6xl font-semibold leading-none tracking-tight text-ink-muted">
                —
              </div>
            ) : (
              <div className="mt-3 flex items-end gap-2">
                <span className="text-6xl font-semibold leading-none tracking-tight tabular-nums text-ink">
                  {result.displayScore}
                </span>
                <span className="pb-1 text-sm font-medium tabular-nums text-ink-muted">/ 100</span>
              </div>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${chip.bg} ${chip.text}`}
              >
                <ShieldIcon className="h-3.5 w-3.5" />
                {result.label}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-accent bg-accent/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-accent">
                <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
                Live
              </span>
            </div>

            <p className="mt-4 max-w-xl text-sm leading-relaxed text-ink-secondary">
              {insufficient
                ? `Coverage is ${coveragePct}%, below the 50% minimum. A numeric regime score is not published until enough inputs are available.`
                : "Deterministic regime read from the engine — a heuristic, not a prediction of future returns."}
            </p>

            <div className="mt-4 flex max-w-xl flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-muted">
              <span className="font-medium text-ink-secondary">
                {coveragePct}% coverage · {CONFIDENCE_LABEL[result.confidence]}
              </span>
              {staleCount > 0 && (
                <span className="rounded-full bg-warn-bg px-2 py-0.5 text-[10px] font-semibold text-warn">
                  {staleCount} stale input{staleCount === 1 ? "" : "s"}
                </span>
              )}
              {missingCount > 0 && (
                <span className="rounded-full bg-line px-2 py-0.5 text-[10px] font-semibold text-ink-muted">
                  {missingCount} missing input{missingCount === 1 ? "" : "s"}
                </span>
              )}
            </div>
          </div>

          {/* Regime drivers */}
          <div className="flex flex-col justify-center">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
                Regime Drivers
              </p>
              <span className="text-[10px] uppercase tracking-wide text-ink-muted">
                {result.engineVersion}
              </span>
            </div>
            {drivers.length === 0 ? (
              <p className="text-xs text-ink-muted">
                No material drivers — inputs are near neutral.
              </p>
            ) : (
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {drivers.map((driver) => (
                  <RegimeAttributionCard key={driver.id} driver={driver} />
                ))}
              </ul>
            )}
          </div>
        </div>

        {score !== null && (
          <div className="mt-8">
            <RegimeSpectrum score={score} label={result.label} labels={SPECTRUM_LABELS} />
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-2 text-[10px] text-ink-muted">
          <span>
            Six-pillar engine · Equity 30 · Sectors 20 · Vol 15 · Rates 15 · Macro 15 · Crypto 5
          </span>
          {asOf ? <span>as of {formatEtTime(asOf)}</span> : null}
        </div>
      </div>
    </section>
  );
}

function labelTone(label: string): { bg: string; text: string } {
  if (label.startsWith("STRONG RISK-ON") || label.startsWith("RISK-ON")) {
    return { bg: "bg-pos-bg", text: "text-pos" };
  }
  if (label.startsWith("EXTREME RISK-OFF") || label.startsWith("RISK-OFF")) {
    return { bg: "bg-neg-bg", text: "text-neg" };
  }
  if (label === "Insufficient Data") return { bg: "bg-warn-bg", text: "text-warn" };
  return { bg: "bg-sakura-200", text: "text-brand-deep" };
}
