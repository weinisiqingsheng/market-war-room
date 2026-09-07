import type { MarketAnomaly, MarketDataMode } from "@/types/market";
import type { AnomalyCandidate, AnomalyOverview } from "@/lib/anomalies/types";
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
  const items = mode === "live" ? overview!.topOverall : (anomalies ?? []);
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
        {mode === "live"
          ? (items as AnomalyCandidate[]).map((item) => (
              <LiveAnomalyRow key={item.ticker} item={item} />
            ))
          : (items as MarketAnomaly[]).map((item) => (
              <DemoAnomalyRow key={item.symbol} item={item} />
            ))}
      </ul>
      {mode === "live" && overview && (
        <p className="mt-3 text-[10px] text-ink-muted">
          {Math.round(overview.coveragePct * 100)}% 覆盖率 · {overview.confidence} ·{" "}
          {overview.engineVersion} · {overview.meta.feed.replace("_", " ")}
        </p>
      )}
    </section>
  );
}

function LiveAnomalyRow({ item }: { item: AnomalyCandidate }) {
  return (
    <li className="rounded-xl border border-line p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="font-semibold text-ink">
          {item.ticker} · {item.name}
        </span>
        <span className="text-xs font-semibold tabular-nums text-ink-secondary">
          {item.dailyMovePct > 0 ? "+" : ""}
          {item.dailyMovePct.toFixed(1)}%
        </span>
        <span className="rounded-full bg-sakura-100 px-2 py-0.5 text-xs font-semibold tabular-nums text-brand-deep">
          {item.displayScore} · {item.severity}
        </span>
      </div>
      <p className="mt-2 text-xs text-ink-secondary">{item.primaryTrigger}</p>
      {item.reasons[0] && (
        <p className="mt-1 text-[11px] leading-relaxed text-ink-muted">{item.reasons[0]}</p>
      )}
    </li>
  );
}

function DemoAnomalyRow({ item }: { item: MarketAnomaly }) {
  const severity = item.score >= 90 ? "极端异常" : "高度异常";
  return (
    <li className="flex items-center justify-between gap-3 rounded-xl border border-line p-3">
      <span className="font-semibold text-ink">{item.symbol}</span>
      <span className="min-w-0 break-words text-xs text-ink-secondary">
        变动 {item.movePct.toFixed(1)}%
      </span>
      <span className="shrink-0 rounded-full bg-sakura-100 px-2 py-0.5 text-xs font-semibold tabular-nums text-brand-deep">
        {severity} {item.score}
      </span>
    </li>
  );
}
