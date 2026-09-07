import type { MarketBreadth, MarketDataMode } from "@/types/market";
import type { BreadthOverview } from "@/lib/breadth/types";
import { Empty, Loading, Status } from "./ChineseMarketPulse";

export function ChineseMarketBreadthCard({
  mode,
  status,
  breadth,
  overview,
}: {
  mode: MarketDataMode;
  status: "loading" | "ready" | "error";
  breadth: MarketBreadth | null;
  overview: BreadthOverview | null;
}) {
  if (status === "loading")
    return (
      <section id="market-breadth" aria-labelledby="market-breadth-heading">
        <Loading label="正在加载市场广度" />
      </section>
    );
  if (status === "error" || (mode === "live" && !overview))
    return (
      <section id="market-breadth" aria-labelledby="market-breadth-heading">
        <h2 id="market-breadth-heading" className="text-lg font-semibold text-ink">
          市场广度
        </h2>
        <Status text="市场广度暂不可用" />
      </section>
    );
  if (mode === "demo" && !breadth)
    return (
      <section id="market-breadth" aria-labelledby="market-breadth-heading">
        <h2 id="market-breadth-heading" className="text-lg font-semibold text-ink">
          市场广度
        </h2>
        <Empty text="暂无市场广度数据" />
      </section>
    );
  const live = mode === "live" ? overview! : null;
  const score = live ? live.displayScore : breadth?.score;
  return (
    <section
      id="market-breadth"
      aria-labelledby="market-breadth-heading"
      className="rounded-[20px] border border-line bg-surface p-5 shadow-card"
    >
      <p className="text-[11px] font-semibold tracking-[0.14em] text-ink-muted">市场内部结构</p>
      <h2 id="market-breadth-heading" className="text-lg font-semibold text-ink">
        市场广度
      </h2>
      {live ? <LiveBreadth overview={live} /> : <DemoBreadth breadth={breadth!} />}
      <p className="mt-4 text-2xl font-semibold tabular-nums text-ink">
        {score ?? "—"} <span className="text-sm text-ink-muted">/ 100</span>
      </p>
    </section>
  );
}

function LiveBreadth({ overview }: { overview: BreadthOverview }) {
  const metrics = overview.metrics;
  const percent = (value: number | null) => (value === null ? "—" : `${Math.round(value * 100)}%`);
  return (
    <>
      <p className="mt-2 text-sm text-ink-secondary">{overview.state.label}</p>
      <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-ink-secondary">
        <p>
          上涨 <strong className="ml-1 tabular-nums text-ink">{metrics.advancers}</strong>
        </p>
        <p>
          下跌 <strong className="ml-1 tabular-nums text-ink">{metrics.decliners}</strong>
        </p>
        <p>
          平盘 <strong className="ml-1 tabular-nums text-ink">{metrics.unchanged}</strong>
        </p>
        <p>
          上涨比例{" "}
          <strong className="ml-1 tabular-nums text-ink">{percent(metrics.advanceRatio)}</strong>
        </p>
        <p>
          高于 20 日均线{" "}
          <strong className="ml-1 tabular-nums text-ink">{percent(metrics.above20Pct)}</strong>
        </p>
        <p>
          高于 50 日均线{" "}
          <strong className="ml-1 tabular-nums text-ink">{percent(metrics.above50Pct)}</strong>
        </p>
        <p>
          20 日新高 <strong className="ml-1 tabular-nums text-ink">{metrics.newHighs20}</strong>
        </p>
        <p>
          20 日新低 <strong className="ml-1 tabular-nums text-ink">{metrics.newLows20}</strong>
        </p>
      </div>
      <p className="mt-3 text-xs text-ink-muted">
        {Math.round(metrics.coveragePct * 100)}% 覆盖率 · {confidenceLabel(overview.confidence)} ·{" "}
        {overview.engineVersion} · {overview.universe.count} 个成分股 · 15分钟延迟 SIP
      </p>
    </>
  );
}

function DemoBreadth({ breadth }: { breadth: MarketBreadth }) {
  return (
    <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-ink-secondary">
      <p>
        上涨 <strong className="ml-1 text-ink">{breadth.advancingPct}%</strong>
      </p>
      <p>
        下跌 <strong className="ml-1 text-ink">{breadth.decliningPct}%</strong>
      </p>
      <p>
        高于 50 日均线 <strong className="ml-1 text-ink">{breadth.above50DmaPct}%</strong>
      </p>
      <p>
        新高 / 新低{" "}
        <strong className="ml-1 text-ink">
          {breadth.newHighs} / {breadth.newLows}
        </strong>
      </p>
    </div>
  );
}

function confidenceLabel(confidence: BreadthOverview["confidence"]): string {
  return { high: "高置信度", medium: "中等置信度", low: "低置信度", insufficient: "覆盖不足" }[
    confidence
  ];
}
