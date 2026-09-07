import type { MarketDataMode, MarketFeed, MarketIndex } from "@war-room/types";
import { formatPrice, formatSignedPct } from "@/lib/format";
import type { ProvenanceStatus } from "@/components/ui/ProvenanceTag";
import { Sparkline } from "@/components/Sparkline";

interface ChineseMarketPulseProps {
  indices: MarketIndex[] | null;
  status: ProvenanceStatus;
  mode: MarketDataMode;
  feed: MarketFeed | null;
  stale?: boolean;
}

export function ChineseMarketPulse({ indices, status, mode, feed, stale = false }: ChineseMarketPulseProps) {
  return (
    <section id="market-pulse" aria-labelledby="market-pulse-heading">
      <header>
        <p className="text-[11px] font-semibold tracking-[0.14em] text-ink-muted">指数快照</p>
        <h2 id="market-pulse-heading" className="text-lg font-semibold text-ink">
          市场脉搏
        </h2>
      </header>
      {status === "error" ? (
        <Status text="市场数据暂不可用" />
      ) : status === "loading" || indices === null ? (
        <Loading label="正在加载市场数据" />
      ) : indices.length === 0 ? (
        <Empty text="暂无市场数据" />
      ) : (
        <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {indices.map((index) => (
            <ChineseIndexCard key={index.ticker} index={index} mode={mode} feed={feed} stale={stale} />
          ))}
        </ul>
      )}
    </section>
  );
}

function ChineseIndexCard({
  index,
  mode,
  feed,
  stale,
}: {
  index: MarketIndex;
  mode: MarketDataMode;
  feed: MarketFeed | null;
  stale: boolean;
}) {
  const dayPositionPct = (() => {
    if (index.price === null || index.high === null || index.low === null) return null;
    const dayRange = Math.max(0, index.high - index.low);
    return dayRange > 0
      ? Math.min(100, Math.max(0, ((index.price - index.low) / dayRange) * 100))
      : null;
  })();
  const hasSparkline = Array.isArray(index.sparkline) && index.sparkline.length > 0;
  const trend =
    index.changePct === null || index.changePct === 0
      ? "flat"
      : index.changePct > 0
        ? "up"
        : "down";
  const trendLabel = trend === "up" ? "上行" : trend === "down" ? "下行" : "持平";

  return (
    <li className="flex min-w-0 flex-col rounded-[20px] border border-line bg-surface p-4 shadow-soft">
      <h3 className="font-semibold text-ink">{index.ticker}</h3>
      <p className="break-words text-xs leading-relaxed text-ink-secondary">{index.name}</p>
      <p className="mt-3 text-3xl font-semibold tabular-nums text-ink">
        {index.price === null ? "—" : formatPrice(index.price)}
      </p>
      <p className="mt-2 text-xs tabular-nums text-ink-secondary">
        {index.changePct === null ? "—" : formatSignedPct(index.changePct)}
      </p>
      <dl className="mt-3 grid grid-cols-3 gap-2 text-[11px] text-ink-secondary">
        <div>
          <dt>开盘</dt>
          <dd>{index.open === null ? "—" : formatPrice(index.open)}</dd>
        </div>
        <div>
          <dt>最高</dt>
          <dd>{index.high === null ? "—" : formatPrice(index.high)}</dd>
        </div>
        <div>
          <dt>最低</dt>
          <dd>{index.low === null ? "—" : formatPrice(index.low)}</dd>
        </div>
      </dl>
      {dayPositionPct === null ? (
        <p className="mt-3 text-[11px] text-ink-muted">日内区间不可用</p>
      ) : (
        <div
          role="img"
          aria-label={`${index.ticker} 今日区间位置 ${Math.round(dayPositionPct)}%`}
          className="mt-3"
        >
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-ink-muted">低</span>
            <div className="relative h-1.5 flex-1 rounded-full bg-line">
              <span
                className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand"
                style={{ left: `${dayPositionPct}%` }}
              />
            </div>
            <span className="text-[10px] text-ink-muted">高</span>
          </div>
        </div>
      )}
      {hasSparkline ? (
        <Sparkline
          data={index.sparkline!}
          tone={trend}
          label={`${index.ticker} 日内趋势，${trendLabel}`}
          className="mt-auto pt-3"
        />
      ) : (
        <p className="mt-auto pt-3 text-right text-[10px] text-ink-muted">日内图表即将推出</p>
      )}
      {mode === "live" && (
        <p className="mt-3 text-[10px] text-ink-muted">
          {stale ? "陈旧数据" : feedLabel(feed)}
        </p>
      )}
    </li>
  );
}

function feedLabel(feed: MarketFeed | null): string {
  const labels: Partial<Record<MarketFeed, string>> = {
    iex: "IEX 实时",
    sip: "SIP 实时",
    delayed_sip: "延迟 SIP",
  };
  return (feed && labels[feed]) ?? "数据源不可用";
}

export function Loading({ label }: { label: string }) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={label}
      className="mt-4 h-32 animate-pulse rounded-2xl border border-line bg-surface"
    />
  );
}
export function Status({ text }: { text: string }) {
  return (
    <div
      role="status"
      className="mt-4 rounded-2xl border border-line bg-surface p-5 text-sm font-semibold text-ink"
    >
      {text}
      <p className="mt-1 text-xs font-normal leading-relaxed text-ink-secondary">
        实时数据无法取得，演示数据不会替代显示。
      </p>
    </div>
  );
}
export function Empty({ text }: { text: string }) {
  return (
    <p className="mt-4 rounded-2xl border border-line bg-surface p-5 text-sm text-ink-secondary">
      {text}
    </p>
  );
}
