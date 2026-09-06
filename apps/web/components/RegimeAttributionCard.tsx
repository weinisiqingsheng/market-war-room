import type { RegimeDriverAttribution } from "@/types/market";

/**
 * One explainable regime driver card: name, signed contribution, and the
 * deterministic reason produced by the Python engine. Keeps the Sakura styling
 * language of the existing driver cards.
 */
export function RegimeAttributionCard({ driver }: { driver: RegimeDriverAttribution }) {
  const positive = driver.direction === "positive";
  const impactText = `${driver.impact > 0 ? "+" : ""}${driver.impact.toFixed(1)}`;

  return (
    <li className="rounded-xl border border-line bg-white/80 p-3 shadow-soft">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-ink-secondary">{driver.name}</span>
        <span
          className={`text-sm font-semibold tabular-nums ${positive ? "text-pos" : "text-neg"}`}
        >
          {impactText}
        </span>
      </div>
      <p className="mt-1.5 text-[11px] leading-snug text-ink-muted">{driver.reason}</p>
    </li>
  );
}
