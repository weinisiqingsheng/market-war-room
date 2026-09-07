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
  const score = mode === "live" ? overview?.displayScore : breadth?.score;
  const advancing = mode === "live" ? overview?.metrics.advancers : breadth?.advancingPct;
  const declining = mode === "live" ? overview?.metrics.decliners : breadth?.decliningPct;
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
      <div className="mt-4 grid grid-cols-2 gap-3">
        <p className="rounded-xl border border-line p-3 text-sm text-ink-secondary">
          上涨 <strong className="ml-1 tabular-nums text-ink">{advancing ?? "—"}</strong>
        </p>
        <p className="rounded-xl border border-line p-3 text-sm text-ink-secondary">
          下跌 <strong className="ml-1 tabular-nums text-ink">{declining ?? "—"}</strong>
        </p>
      </div>
      <p className="mt-4 text-2xl font-semibold tabular-nums text-ink">
        {score ?? "—"} <span className="text-sm text-ink-muted">/ 100</span>
      </p>
    </section>
  );
}
