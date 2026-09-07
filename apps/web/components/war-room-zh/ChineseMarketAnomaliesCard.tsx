import type { MarketAnomaly, MarketDataMode } from "@/types/market";
import type { AnomalyOverview } from "@/lib/anomalies/types";
import { Empty, Loading, Status } from "./ChineseMarketPulse";

export function ChineseMarketAnomaliesCard({
  mode,
  status,
  anomalies,
  overview,
}: {
  mode: MarketDataMode;
  status: "loading" | "ready" | "error";
  anomalies: MarketAnomaly[] | null;
  overview: AnomalyOverview | null;
}) {
  if (status === "loading")
    return (
      <section id="market-anomalies" aria-labelledby="market-anomalies-heading">
        <Loading label="正在加载市场异常" />
      </section>
    );
  if (status === "error" || (mode === "live" && !overview))
    return (
      <section id="market-anomalies" aria-labelledby="market-anomalies-heading">
        <h2 id="market-anomalies-heading" className="text-lg font-semibold text-ink">
          市场异常
        </h2>
        <Status text="市场异常暂不可用" />
      </section>
    );
  const items =
    mode === "live"
      ? (overview?.topOverall ?? []).map((item) => ({
          symbol: item.ticker,
          score: item.displayScore,
          move: item.dailyMovePct,
          detail: item.primaryTrigger,
        }))
      : (anomalies ?? []);
  if (items.length === 0)
    return (
      <section id="market-anomalies" aria-labelledby="market-anomalies-heading">
        <h2 id="market-anomalies-heading" className="text-lg font-semibold text-ink">
          市场异常
        </h2>
        <Empty text="暂无市场异常" />
      </section>
    );
  return (
    <section
      id="market-anomalies"
      aria-labelledby="market-anomalies-heading"
      className="rounded-[20px] border border-line bg-surface p-5 shadow-card"
    >
      <p className="text-[11px] font-semibold tracking-[0.14em] text-ink-muted">
        价格异动 · 成交量异动
      </p>
      <h2 id="market-anomalies-heading" className="text-lg font-semibold text-ink">
        市场异常
      </h2>
      <ul className="mt-4 space-y-2">
        {items.map((item) => (
          <li
            key={item.symbol}
            className="flex items-center justify-between gap-3 rounded-xl border border-line p-3"
          >
            <span className="font-semibold text-ink">{item.symbol}</span>
            <span className="min-w-0 break-words text-xs text-ink-secondary">
              {"detail" in item ? item.detail : `变动 ${item.movePct.toFixed(1)}%`}
            </span>
            <span className="shrink-0 rounded-full bg-sakura-100 px-2 py-0.5 text-xs font-semibold tabular-nums text-brand-deep">
              <span>{item.score >= 90 ? "极端异常" : "高度异常"}</span> <span>{item.score}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
