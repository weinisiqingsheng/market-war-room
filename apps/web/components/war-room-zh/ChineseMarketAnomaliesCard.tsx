import type { MarketAnomaly, MarketDataMode } from "@/types/market";
import type { AnomalyCandidate, AnomalyOverview } from "@/lib/anomalies/types";
import { formatSignedPct } from "@/lib/format";
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
      {mode === "live" ? (
        <ul className="mt-4 space-y-2">
          {(items as AnomalyCandidate[]).map((item) => (
            <LiveAnomalyRow key={item.ticker} item={item} />
          ))}
        </ul>
      ) : (
        <DemoAnomalyTable items={items as MarketAnomaly[]} />
      )}
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

function DemoAnomalyTable({ items }: { items: MarketAnomaly[] }) {
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full min-w-[520px] text-sm">
        <caption className="sr-only">演示市场异动数据</caption>
        <thead>
          <tr className="border-b border-line text-left text-[10px] uppercase tracking-wider text-ink-muted">
            <th scope="col" className="py-2 pr-3 font-semibold">
              标的
            </th>
            <th scope="col" className="px-2 py-2 font-semibold">
              变动
            </th>
            <th scope="col" className="px-2 py-2 font-semibold">
              相对成交量
            </th>
            <th scope="col" className="px-2 py-2 font-semibold">
              距日高
            </th>
            <th scope="col" className="px-2 py-2 font-semibold">
              相对强度
            </th>
            <th scope="col" className="px-2 py-2 text-right font-semibold">
              评分
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const severity = item.score >= 90 ? "极端异常" : "高度异常";
            return (
              <tr key={item.symbol} className="border-b border-line/60 last:border-0">
                <td className="py-2.5 pr-3 font-semibold text-ink">{item.symbol}</td>
                <td className="px-2 py-2.5 tabular-nums text-ink-secondary">
                  {formatSignedPct(item.movePct)}
                </td>
                <td className="px-2 py-2.5 tabular-nums text-ink-secondary">
                  {item.relativeVolume.toFixed(1)}×
                </td>
                <td className="px-2 py-2.5 tabular-nums text-ink-secondary">
                  {item.hodDistancePct.toFixed(1)}%
                </td>
                <td className="px-2 py-2.5 text-ink-secondary">
                  {"+".repeat(item.relativeStrength)}
                </td>
                <td className="px-2 py-2.5 text-right">
                  <span className="inline-flex items-center gap-2">
                    <span
                      role="meter"
                      aria-label={`${item.symbol} 异常评分`}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={item.score}
                      className="font-semibold tabular-nums text-ink"
                    >
                      {item.score}
                    </span>
                    <span className="rounded-full bg-sakura-100 px-2 py-0.5 text-[10px] font-semibold text-brand-deep">
                      {severity}
                    </span>
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
