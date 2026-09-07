import type { CatalystEvent } from "@/types/market";
import type { CatalystOverview } from "@/lib/catalysts/types";
import { Empty, Loading, Status } from "./ChineseMarketPulse";

export function ChineseCatalystIntelligence({
  events,
  status = "ready",
  overview,
}: {
  events: CatalystEvent[];
  status?: "loading" | "ready" | "error";
  overview?: CatalystOverview | null;
}) {
  const liveItems = overview?.items ?? [];
  const hasLiveItems = overview !== null && overview !== undefined;
  return (
    <section
      id="catalyst-intelligence"
      aria-labelledby="catalyst-intelligence-heading"
      className="rounded-[20px] border border-line bg-surface p-5 shadow-card"
    >
      <header>
        <p className="text-[11px] font-semibold tracking-[0.14em] text-ink-muted">
          异常 → 催化事件
        </p>
        <h2 id="catalyst-intelligence-heading" className="text-lg font-semibold text-ink">
          催化事件
        </h2>
        <p className="text-xs leading-relaxed text-ink-secondary">
          将已观察的证据映射为市场影响，而非新闻流。
        </p>
      </header>
      {status === "loading" ? (
        <Loading label="正在加载催化事件" />
      ) : status === "error" ? (
        <Status text="催化事件暂不可用" />
      ) : hasLiveItems ? (
        liveItems.length === 0 ? (
          <Empty text="暂无催化事件" />
        ) : (
          <ul className="mt-4 space-y-3">
            {liveItems.map((item) => (
              <li key={item.ticker} className="rounded-xl border border-line bg-sakura-50/70 p-4">
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full bg-sakura-300 px-2 py-0.5 text-[10px] font-bold text-brand-deep">
                    {item.status === "MATCHED" ? "催化事件" : "暂无明确催化事件"}
                  </span>
                  <span className="text-xs text-ink-secondary">
                    异常评分{" "}
                    <strong className="tabular-nums text-ink">
                      {Math.round(item.anomalyScore)} / 100
                    </strong>
                  </span>
                </div>
                <h3 className="mt-2 break-words font-semibold leading-relaxed text-ink">
                  {item.ticker} · {item.name}
                </h3>
                <p className="mt-2 break-words text-xs leading-relaxed text-ink-secondary">
                  {item.primaryCatalyst?.headline ??
                    "已检测到异常价格行为，但在所选来源中没有足够强的催化证据。"}
                </p>
                <p className="mt-2 text-[11px] text-ink-muted">分析证据</p>
              </li>
            ))}
          </ul>
        )
      ) : events.length === 0 ? (
        <Empty text="暂无催化事件" />
      ) : (
        <ul className="mt-4 space-y-3">
          {events.map((event) => (
            <li key={event.id} className="rounded-xl border border-line bg-sakura-50/70 p-4">
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-sakura-300 px-2 py-0.5 text-[10px] font-bold text-brand-deep">
                  {event.category}
                </span>
                <span className="text-xs text-ink-secondary">
                  影响评分{" "}
                  <strong className="tabular-nums text-ink">{event.impactScore} / 100</strong>
                </span>
              </div>
              <h3 className="mt-2 break-words font-semibold leading-relaxed text-ink">
                {event.headline}
              </h3>
              <p className="mt-2 break-words text-xs leading-relaxed text-ink-secondary">
                {event.chain.join(" → ")}
              </p>
              <p className="mt-2 text-[11px] text-ink-muted">分析证据</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
