import Link from "next/link";
import type { MarketDataMeta, MarketDataMode } from "@war-room/types";
import type { HeaderNavItem, MarketSession } from "@/types/market";
import { SakuraLogo } from "@/components/SakuraLogo";

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
  const live = mode === "live";
  const sessionText = live
    ? meta?.marketOpen === true
      ? "美股 · 开盘"
      : meta?.marketOpen === false
        ? "美股 · 收盘"
        : "市场状态不可用"
    : `${session.label} · 演示`;

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-page/85 backdrop-blur-md">
      <div className="mx-auto flex min-h-16 w-full max-w-[1360px] items-center justify-between gap-4 px-4 py-3 sm:px-6">
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
                <Link
                  href={item.href}
                  className="whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium text-ink-secondary transition-colors hover:bg-sakura-100 hover:text-brand-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <p className="shrink-0 rounded-full border border-line bg-white/70 px-3 py-1.5 text-xs text-ink-secondary">
          {sessionText}
        </p>
      </div>
    </header>
  );
}
