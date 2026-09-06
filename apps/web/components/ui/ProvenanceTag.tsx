import type { MarketDataMode, MarketFeed } from "@war-room/types";
import { cn } from "@/lib/cn";
import { DemoTag } from "./DemoTag";
import { SparkleIcon } from "./icons";

export type ProvenanceStatus = "loading" | "ready" | "error";

interface ProvenanceTagProps {
  mode: MarketDataMode;
  feed: MarketFeed | null;
  status?: ProvenanceStatus;
  stale?: boolean;
}

/**
 * Module-level provenance chip. Demo mode → quiet "DEMO" tag. Live mode →
 * "LIVE · IEX" (feed name), plus an amber STALE marker when freshness fails.
 * Brand pink, not a financial state color.
 */
export function ProvenanceTag({ mode, feed, status = "ready", stale = false }: ProvenanceTagProps) {
  if (mode === "demo") {
    return <DemoTag label="DEMO" />;
  }
  if (status === "loading") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-line bg-white/70 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
        <SparkleIcon className="h-3 w-3 animate-pulse" />
        Loading…
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-brand/25 bg-sakura-300 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-brand-deep">
      <span className="h-1.5 w-1.5 rounded-full bg-brand" aria-hidden="true" />
      Live · {feed?.toUpperCase() ?? "—"}
      {stale && (
        <span
          className={cn(
            "ml-0.5 rounded-full bg-warn px-1.5 py-0.5 text-[9px] font-bold text-surface",
          )}
        >
          Stale
        </span>
      )}
    </span>
  );
}
