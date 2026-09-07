import type { MarketDataMode, MarketFeed, SectorPerformance } from "@war-room/types";
import type { ProvenanceStatus } from "@/components/ui/ProvenanceTag";
import { formatSignedPct } from "@/lib/format";
import { Empty, Loading, Status } from "./ChineseMarketPulse";

export function ChineseSectorRotation({
  sectors,
  status,
  benchmark,
}: {
  sectors: SectorPerformance[] | null;
  status: ProvenanceStatus;
  mode: MarketDataMode;
  feed: MarketFeed | null;
  stale?: boolean;
  benchmark: { ticker: string; dailyReturnPct: number | null };
}) {
  return (
    <section
      id="sector-rotation"
      aria-labelledby="sector-rotation-heading"
      className="rounded-[20px] border border-line bg-surface p-5 shadow-card"
    >
      <header>
        <p className="text-[11px] font-semibold tracking-[0.14em] text-ink-muted">相对强弱</p>
        <h2 id="sector-rotation-heading" className="text-lg font-semibold text-ink">
          板块轮动
        </h2>
        <p className="text-xs leading-relaxed text-ink-secondary">相对 {benchmark.ticker} 排名</p>
      </header>
      {status === "error" ? (
        <Status text="市场数据暂不可用" />
      ) : status === "loading" || sectors === null ? (
        <Loading label="正在加载板块数据" />
      ) : sectors.length === 0 ? (
        <Empty text="暂无板块数据" />
      ) : (
        <ul className="mt-4 space-y-2">
          {sectors.map((sector) => (
            <li
              key={sector.id}
              className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-line px-3 py-2"
            >
              <span className="min-w-0 break-words text-sm font-medium text-ink">
                {sector.sector} · {sector.etf}
              </span>
              <span className="shrink-0 text-xs tabular-nums text-ink-secondary">
                {sector.relativeReturnPct === null
                  ? "—"
                  : formatSignedPct(sector.relativeReturnPct)}
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-4 border-t border-line pt-3 text-[11px] leading-relaxed text-ink-muted">
        相对收益 = 当日收益相对 {benchmark.ticker} 的差值。
      </p>
    </section>
  );
}
