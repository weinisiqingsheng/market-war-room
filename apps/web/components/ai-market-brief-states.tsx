"use client";

export function AiMarketBriefLoading() {
  return (
    <div aria-live="polite" aria-label="Loading grounded market brief">
      <p className="mt-3 h-4 w-3/4 animate-pulse rounded bg-ink/10" />
      <p className="mt-2 h-4 w-1/2 animate-pulse rounded bg-ink/10" />
      <p className="mt-4 h-24 animate-pulse rounded-xl bg-ink/5" />
      <p className="mt-3 text-xs text-ink-muted">Loading grounded market brief…</p>
    </div>
  );
}

export function AiMarketBriefInsufficient() {
  return (
    <div>
      <p className="mt-2 text-sm leading-relaxed text-ink-secondary">Not enough grounded market data is currently available to generate a reliable brief.</p>
      <p className="mt-1 text-xs text-ink-muted">Individual market modules remain available.</p>
    </div>
  );
}

export function AiMarketBriefUnavailable({ onRetry }: { onRetry: () => void }) {
  return (
    <div>
      <p className="mt-2 text-sm leading-relaxed text-ink-secondary">AI Market Brief temporarily unavailable.</p>
      <p className="mt-1 text-xs text-ink-muted">Live market modules remain available.</p>
      <button onClick={onRetry} className="mt-3 rounded-full bg-sakura-300 px-3 py-1.5 text-xs font-semibold text-brand-deep">
        Retry
      </button>
    </div>
  );
}
