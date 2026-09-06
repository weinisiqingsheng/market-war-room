"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import type { MarketDataMeta, MarketDataMode } from "@war-room/types";
import type { HeaderNavItem, MarketSession } from "@/types/market";
import { formatEtTime } from "@/lib/format";
import { SakuraLogo } from "./SakuraLogo";

/** Live ET clock, using the external-store pattern (no setState-in-effect). */
const CLOCK_INTERVAL_MS = 30_000;

let cachedClock: string | null = null;
let lastTick = 0;

function formatEtNow(): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date());
}

function getClockSnapshot(): string | null {
  const now = Date.now();
  if (!cachedClock || now - lastTick >= CLOCK_INTERVAL_MS) {
    cachedClock = formatEtNow();
    lastTick = now;
  }
  return cachedClock;
}

function subscribeClock(onChange: () => void): () => void {
  const id = window.setInterval(onChange, CLOCK_INTERVAL_MS);
  return () => window.clearInterval(id);
}

function useEtClock(): string | null {
  return useSyncExternalStore(subscribeClock, getClockSnapshot, () => null);
}

interface HeaderProps {
  nav: HeaderNavItem[];
  session: MarketSession;
  mode: MarketDataMode;
  meta: MarketDataMeta | null;
}

export function Header({ nav, session, mode, meta }: HeaderProps) {
  const clock = useEtClock();
  const isLive = mode === "live";

  let sessionDot: React.ReactNode;
  let sessionText: string;
  let sessionTitle: string;

  if (!isLive) {
    sessionDot = <span className="h-2 w-2 rounded-full bg-ink-muted/60" aria-hidden="true" />;
    sessionText = `${session.label} · ${session.status}`;
    sessionTitle = "Demo session — no live data";
  } else if (meta?.marketOpen === true) {
    sessionDot = (
      <span className="relative flex h-2 w-2" aria-hidden="true">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-pos opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-pos" />
      </span>
    );
    sessionText = "US Markets · Open";
    sessionTitle = `Next close: ${formatEtTime(meta.nextClose)} ET`;
  } else if (meta?.marketOpen === false) {
    sessionDot = <span className="h-2 w-2 rounded-full bg-ink-muted/60" aria-hidden="true" />;
    sessionText = "US Markets · Closed";
    sessionTitle = `Next open: ${formatEtTime(meta.nextOpen)} ET`;
  } else {
    sessionDot = <span className="h-2 w-2 rounded-full bg-warn" aria-hidden="true" />;
    sessionText = "Market status unavailable";
    sessionTitle = "The market clock could not be reached. We do not guess.";
  }

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-page/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-[1360px] items-center justify-between gap-4 px-4 sm:px-6">
        {/* Brand lockup */}
        <div className="flex min-w-0 items-center gap-2">
          <Link
            href="/"
            aria-label="Market War Room — home"
            className="group flex min-w-0 items-center gap-3 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2"
          >
            <SakuraLogo size={30} className="shrink-0 transition-transform group-hover:scale-105" />
            <span className="min-w-0">
              <h1 className="block truncate text-sm font-bold leading-tight tracking-tight text-ink">
                Market War Room
              </h1>
              <span className="block truncate text-[11px] leading-tight text-ink-secondary">
                Sakura Market Intelligence
              </span>
            </span>
          </Link>
          <span className="ml-1 hidden rounded-full border border-brand/25 bg-sakura-50 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.14em] text-brand-deep lg:inline-flex">
            Sakura Edition
          </span>
        </div>

        {/* Navigation — only Overview is implemented in Phase 0A */}
        <nav aria-label="Primary" className="hidden md:block">
          <ul className="flex items-center gap-1 rounded-full border border-line bg-white/60 p-1 shadow-soft">
            {nav.map((item) =>
              item.disabled ? (
                <li key={item.id}>
                  <span
                    aria-disabled="true"
                    title="Available in a future phase"
                    className="cursor-not-allowed rounded-full px-3.5 py-1.5 text-sm text-ink-muted"
                  >
                    {item.label}
                  </span>
                </li>
              ) : (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    aria-current="page"
                    className="rounded-full bg-brand-deep px-3.5 py-1.5 text-sm font-medium text-surface transition-colors hover:brightness-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-1"
                  >
                    {item.label}
                  </Link>
                </li>
              ),
            )}
          </ul>
        </nav>

        {/* Session + freshness */}
        <div className="flex shrink-0 items-center gap-3">
          <div
            className="hidden items-center gap-2 rounded-full border border-line bg-white/70 px-3 py-1.5 sm:flex"
            title={sessionTitle}
          >
            {sessionDot}
            <span className="text-xs text-ink-secondary">
              <span className="font-medium text-ink">{sessionText}</span>
            </span>
            {isLive && meta?.stale && (
              <span className="rounded-full bg-warn px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-surface">
                Stale
              </span>
            )}
          </div>
          <div className="hidden text-right lg:block">
            {isLive ? (
              <>
                <p className="text-xs font-medium tabular-nums text-ink">
                  Last updated {formatEtTime(meta?.asOf)}
                </p>
                <p className="text-[10px] uppercase tracking-wide text-ink-muted">
                  Live · {meta?.feed?.toUpperCase() ?? "IEX"}
                </p>
              </>
            ) : (
              <>
                <p className="text-xs font-medium tabular-nums text-ink">{clock ?? "—"}</p>
                <p className="text-[10px] uppercase tracking-wide text-ink-muted">ET · demo</p>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
