import type { MarketDataMode, MarketFeed, SectorPerformance } from "@war-room/types";
import type { ProvenanceStatus } from "@/components/ui/ProvenanceTag";
import { formatSignedPct } from "@/lib/format";
import { Empty, Loading, Status } from "./ChineseMarketPulse";

export function ChineseSectorRotation({
  sectors,
  status,
  mode,
  feed,
  stale = false,
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
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.14em] text-ink-muted">相对强弱</p>
            <h2 id="sector-rotation-heading" className="text-lg font-semibold text-ink">
              板块轮动
            </h2>
          </div>
          {mode === "live" && feed ? (
            <span className="rounded-full border border-line bg-white/70 px-2.5 py-1 text-[10px] font-semibold tracking-wide text-ink-secondary">
              {stale ? "陈旧" : `实时 · ${feed.toUpperCase()}`}
            </span>
          ) : null}
        </div>
        <p className="text-xs leading-relaxed text-ink-secondary">相对 {benchmark.ticker} 排名</p>
      </header>
      <div className="mt-4 hidden gap-3 px-3 text-[10px] font-semibold text-ink-muted md:grid md:grid-cols-[1.6fr_0.7fr_0.7fr_0.9fr_1.1fr]">
        <span>板块</span>
        <span>日度</span>
        <span>相对 SPY</span>
        <span>信号</span>
        <span>强度</span>
      </div>
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
              className="grid min-w-0 grid-cols-2 items-center gap-x-3 gap-y-2 rounded-xl border border-line px-3 py-2 md:grid-cols-[1.6fr_0.7fr_0.7fr_0.9fr_1.1fr]"
            >
              <span className="min-w-0 break-words text-sm font-medium text-ink">
                {sector.sector} · {sector.etf}
              </span>
              <span className="shrink-0 text-xs tabular-nums text-ink-secondary">
                {sector.dailyReturnPct === null ? "—" : formatSignedPct(sector.dailyReturnPct)}
              </span>
              <span className="shrink-0 text-xs tabular-nums text-ink-secondary">
                {sector.relativeReturnPct === null
                  ? "—"
                  : formatSignedPct(sector.relativeReturnPct)}
              </span>
              <span className="text-xs text-ink-secondary">{sector.signal}</span>
              <span className="text-xs tabular-nums text-ink-secondary">
                {sector.strength === null ? "—" : Math.round(sector.strength)}
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
