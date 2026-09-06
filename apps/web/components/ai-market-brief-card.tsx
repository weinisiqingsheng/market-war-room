"use client";

import type { AiMarketBriefApiResponse } from "@/features/home/useAiMarketBrief";
import { AiMarketBriefContent } from "./ai-market-brief-content";
import { AiMarketBriefLoading, AiMarketBriefInsufficient, AiMarketBriefUnavailable } from "./ai-market-brief-states";

export interface AiMarketBriefCardProps {
  data: AiMarketBriefApiResponse | null;
  loading: boolean;
  networkError?: boolean;
  onRetry: () => void;
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full border border-line bg-white/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-ink-secondary">{children}</span>;
}

/** One Sakura card for all states. No market reasoning; renders the validated brief verbatim. */
export function AiMarketBriefCard({ data, loading, networkError, onRetry }: AiMarketBriefCardProps) {
  const mode = data?.mode;
  const status = data?.status;
  return (
    <section aria-label="Sakura AI Market Brief" className="rounded-[20px] border border-line bg-surface p-5 shadow-card">
      <header className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold text-ink">Sakura AI Market Brief</h2>
        <Badge>GROUNDED · ai-brief-v1</Badge>
        {mode === "demo" && <span className="rounded-full bg-sakura-300 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-deep">DEMO</span>}
        {status === "cached" && <Badge>CACHED</Badge>}
      </header>

      {loading && <AiMarketBriefLoading />}
      {!loading && networkError && !data && <AiMarketBriefUnavailable onRetry={onRetry} />}
      {!loading && !networkError && data && status === "insufficient_grounded_data" && !data.brief && <AiMarketBriefInsufficient />}
      {!loading && !networkError && data && status === "unavailable" && <AiMarketBriefUnavailable onRetry={onRetry} />}
      {!loading && data?.brief && (status === "generated" || status === "cached" || status === "demo") && <AiMarketBriefContent brief={data.brief} />}
      {!loading && data?.brief && status === "cached" && <p className="mt-3 text-[11px] text-ink-muted">Cached for unchanged evidence</p>}
    </section>
  );
}
