import { Fragment } from "react";
import type { CatalystEvent } from "@/types/market";

export function CatalystCard({ event }: { event: CatalystEvent }) {
  return (
    <li className="rounded-xl border border-line bg-sakura-50/70 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-sakura-300 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-deep">
          {event.category}
        </span>
        <span className="ml-auto text-xs text-ink-secondary">
          Impact Score{" "}
          <span className="tabular-nums font-semibold text-ink">{event.impactScore} / 100</span>
        </span>
        <span className="hidden h-1.5 w-24 rounded-full bg-line sm:block" aria-hidden="true">
          <span
            className="block h-full rounded-full bg-gradient-to-r from-softpink to-accent"
            style={{ width: `${event.impactScore}%` }}
          />
        </span>
      </div>

      <h3 className="mt-2.5 text-sm font-semibold text-ink">{event.headline}</h3>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {event.chain.map((step, i) => (
          <Fragment key={step}>
            {i > 0 && (
              <span aria-hidden="true" className="text-softpink">
                →
              </span>
            )}
            <span className="rounded-full border border-line bg-white/80 px-2.5 py-1 text-xs text-ink-secondary">
              {step}
            </span>
          </Fragment>
        ))}
      </div>
    </li>
  );
}
