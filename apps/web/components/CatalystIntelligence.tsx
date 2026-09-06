import type { CatalystEvent } from "@/types/market";
import { SectionHeader } from "./SectionHeader";
import { CatalystCard } from "./CatalystCard";
import { DemoTag } from "./ui/DemoTag";

export function CatalystIntelligence({ events, status }: { events: CatalystEvent[]; status?: string }) {
  return (
    <section id="catalyst-intelligence" aria-labelledby="catalyst-intelligence-heading">
      <div className="flex h-full flex-col rounded-[20px] border border-line bg-surface p-5 shadow-card">
        <SectionHeader
          id="catalyst-intelligence-heading"
          kicker="Catalyst → Impact"
          title="Catalyst Intelligence"
          subtitle="News events mapped to market impact — not a news feed"
          meta={<DemoTag label="DEMO" />}
        />
        {status === "error" && (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
            Catalyst Intelligence is temporarily unavailable. Other modules are unaffected.
          </p>
        )}
        <ul className="mt-4 flex flex-col gap-3">
          {events.map((event) => (
            <CatalystCard key={event.id} event={event} />
          ))}
        </ul>
        <p className="mt-4 border-t border-line pt-3 text-[11px] text-ink-muted">
          Design fixtures — a live catalyst engine arrives in a later phase.
        </p>
      </div>
    </section>
  );
}
