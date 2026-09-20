"use client";

import { useState } from "react";
import Link from "next/link";
import type { MarketDataMeta, MarketDataMode } from "@war-room/types";
import type { HeaderNavItem, MarketSession } from "@/types/market";
import { formatEtTime } from "@/lib/format";
import { SakuraLogo } from "@/components/SakuraLogo";

const NAV_LABELS: Record<string, string> = {
  overview: "概览",
  markets: "市场",
  intelligence: "情报",
};

function navLabel(item: HeaderNavItem): string {
  return NAV_LABELS[item.id] ?? item.label;
}

export function ChineseHeader({
  nav,
  session,
  mode,
  meta,
}: {
  nav: HeaderNavItem[];
  session: MarketSession;
  mode: MarketDataMode;
  meta: MarketDataMeta | null;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const live = mode === "live";
  const sessionLabel = session.label === "US Markets" ? "美股" : session.label;
  const sessionText = !live
    ? `${sessionLabel} · 演示`
    : meta?.marketOpen === true
      ? "美股 · 开盘"
      : meta?.marketOpen === false
        ? "美股 · 收盘"
        : "市场状态不可用";

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-page/85 backdrop-blur-md">
      <div className="mx-auto flex min-h-16 w-full max-w-[1360px] items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link
          href="/zh/war-room"
          aria-label="市场作战室首页"
          className="group flex min-w-0 items-center gap-3 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2"
        >
          <SakuraLogo size={30} className="shrink-0 transition-transform group-hover:scale-105" />
          <span className="min-w-0">
            <span className="block truncate text-sm font-bold leading-tight tracking-tight text-ink">
              市场作战室
            </span>
            <span className="block truncate text-[11px] leading-tight text-ink-secondary">
              Sakura 市场情报
            </span>
          </span>
        </Link>

        <nav aria-label="主要导航" className="hidden md:block">
          <ul className="flex items-center gap-1 rounded-full border border-line bg-white/60 p-1 shadow-soft">
            {nav.map((item) => (
              <li key={item.id}>
                {item.disabled ? (
                  <span
                    aria-disabled="true"
                    title="后续版本提供"
                    className="cursor-not-allowed whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm text-ink-muted"
                  >
                    {navLabel(item)}
                  </span>
                ) : (
                  <Link
                    href={item.href}
                    className="whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium text-ink-secondary transition-colors hover:bg-sakura-100 hover:text-brand-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
                  >
                    {navLabel(item)}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <span className="rounded-full border border-line bg-white/70 px-3 py-1.5 text-xs text-ink-secondary">
            {sessionText}
          </span>
          {live && meta ? (
            <span className="hidden text-right lg:block">
              <span className="block text-xs font-medium tabular-nums text-ink">
                数据截至 {formatEtTime(meta.asOf)}
              </span>
              <span className="block text-[10px] tracking-wide text-ink-muted">
                实时 · {(meta.feed ?? "iex").toUpperCase()}
              </span>
              {meta.stale ? (
                <span className="mt-0.5 inline-flex rounded-full bg-warn-bg px-1.5 py-0.5 text-[10px] font-semibold text-warn">
                  陈旧
                </span>
              ) : null}
            </span>
          ) : null}
          {live && !meta ? (
            <span className="hidden text-[11px] text-ink-muted lg:block">数据来源与时间不可用</span>
          ) : null}
          <button
            type="button"
            aria-expanded={menuOpen}
            aria-label={menuOpen ? "关闭主要导航" : "打开主要导航"}
            onClick={() => setMenuOpen((open) => !open)}
            className="rounded-full border border-line bg-white/70 px-3 py-1.5 text-xs font-semibold text-ink-secondary md:hidden"
          >
            {menuOpen ? "关闭" : "菜单"}
          </button>
        </div>
      </div>

      {menuOpen ? (
        <nav aria-label="移动端主要导航" className="border-t border-line/70 bg-page/90 md:hidden">
          <ul className="flex flex-wrap gap-1 px-4 py-2">
            {nav.map((item) => (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className="inline-flex rounded-full px-3 py-1.5 text-sm text-ink-secondary hover:bg-sakura-100 hover:text-brand-deep"
                >
                  {navLabel(item)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    </header>
  );
}
