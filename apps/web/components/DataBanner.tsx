import type { MarketDataMode, MarketFeed } from "@war-room/types";
import { SparkleIcon } from "./ui/icons";

/**
 * Subtle global provenance banner. Demo mode labels everything as fixtures;
 * live mode states exactly what is live (Market Pulse + Sector Rotation via
 * Alpaca IEX) and that the remaining modules stay demo. Never visually dominant.
 */
export function DataBanner({ mode, feed }: { mode: MarketDataMode; feed: MarketFeed | null }) {
  const content =
    mode === "demo" ? (
      <p className="text-[11px] font-medium tracking-wide text-ink-muted">
        <span className="font-semibold text-brand-deep">DESIGN PREVIEW</span> — demo fixtures · not
        live market data
      </p>
    ) : (
      <p className="text-[11px] font-medium tracking-wide text-ink-muted">
        <span className="font-semibold text-brand-deep">LIVE MARKET DATA</span> — Market Pulse +
        Sector Rotation via Alpaca {feed?.toUpperCase() ?? "IEX"} · other intelligence modules
        remain demo
      </p>
    );

  return (
    <div
      role="note"
      aria-label={mode === "demo" ? "Demo data notice" : "Live data notice"}
      className="mx-auto flex w-fit max-w-full items-center gap-2 rounded-full border border-line bg-white/70 px-4 py-1.5 shadow-soft"
    >
      <SparkleIcon className="h-3.5 w-3.5 shrink-0 text-brand" />
      {content}
    </div>
  );
}
