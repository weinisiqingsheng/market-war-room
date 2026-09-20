import type { MarketDataMode } from "@war-room/types";
import type { CatalystEvent } from "@/types/market";
import type { CatalystItem, CatalystMatch, CatalystOverview } from "@/lib/catalysts/types";
import { formatEtTime } from "@/lib/format";
import { Empty, Loading, Status } from "./ChineseMarketPulse";

export function ChineseCatalystIntelligence({
  mode = "demo",
  events,
  status = "ready",
  overview,
}: {
  mode?: MarketDataMode;
  events: CatalystEvent[];
  status?: "loading" | "ready" | "error";
  overview?: CatalystOverview | null;
}) {
  const live = mode === "live" ? (overview ?? null) : null;
  const degraded =
    status === "ready" &&
    live &&
    Object.values(live.meta.providers).some((provider) => provider !== "ok");
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
        {status === "ready" && live && (
          <p className="mt-2 text-[10px] text-ink-muted">
            {live.meta.engineVersion} · 实时 · 证据截至{" "}
            {formatEtTime(live.meta.effectiveAsOf ?? live.meta.catalystCutoff)}
          </p>
        )}
      </header>
      {status === "loading" ? (
        <Loading label="正在加载催化事件" />
      ) : status === "error" ? (
        <Status text="催化事件暂不可用" />
      ) : live ? (
        live.items.length === 0 ? (
          <Empty text="暂无催化事件" />
        ) : (
          <LiveCatalysts overview={live} />
        )
      ) : events.length === 0 ? (
        <Empty text="暂无催化事件" />
      ) : (
        <DemoCatalysts events={events} />
      )}
      {degraded && (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
          数据源降级：新闻 {live!.meta.providers.news} · SEC {live!.meta.providers.sec} · 公司行动{" "}
          {live!.meta.providers.corporateActions}。将继续使用可用证据匹配。
        </p>
      )}
    </section>
  );
}

function LiveCatalysts({ overview }: { overview: CatalystOverview }) {
  const { meta } = overview;
  return (
    <>
      <p className="mt-3 text-[11px] text-ink-muted">
        {meta.candidateCount} 个候选 · {meta.matchedCount} 个匹配 · {meta.unmatchedCount} 个未匹配
      </p>
      <ul className="mt-4 space-y-3">
        {overview.items.map((item) => (
          <LiveCatalystRow key={item.ticker} item={item} />
        ))}
      </ul>
    </>
  );
}

function LiveCatalystRow({ item }: { item: CatalystItem }) {
  const matched = item.status === "MATCHED" && item.primaryCatalyst;
  return (
    <li className="rounded-xl border border-line bg-sakura-50/70 p-4">
      <div className="flex flex-wrap gap-2 text-xs text-ink-secondary">
        <span className="rounded-full bg-sakura-300 px-2 py-0.5 font-bold text-brand-deep">
          {matched ? "催化事件" : "暂无明确催化事件"}
        </span>
        <span>
          {item.movePct > 0 ? "+" : ""}
          {item.movePct.toFixed(1)}% · {item.anomalySeverity} · 异常评分{" "}
          {Math.round(item.anomalyScore)} / 100
        </span>
      </div>
      <h3 className="mt-2 break-words font-semibold leading-relaxed text-ink">
        {item.ticker} · {item.name}
      </h3>
      {matched ? (
        <ul className="mt-3 space-y-2">
          <EvidenceRow match={item.primaryCatalyst!} label="主要证据" />
          {item.secondaryCatalysts.slice(0, 2).map((match) => (
            <EvidenceRow
              key={`${match.sourceType}-${match.headline}`}
              match={match}
              label="相关证据"
            />
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-xs leading-relaxed text-ink-muted">
          检测到异常价格行为，但所选来源没有足够强的催化证据。
        </p>
      )}
      <p className="mt-3 border-t border-line pt-2 text-[11px] text-ink-muted">
        {item.evidence.newsCount} 条新闻 · {item.evidence.filingCount} 份 SEC 文件 ·{" "}
        {item.evidence.corporateActionCount} 项公司行动{matched ? ` · 方向：${item.alignment}` : ""}
      </p>
    </li>
  );
}

function EvidenceRow({ match, label }: { match: CatalystMatch; label: string }) {
  return (
    <li className="rounded-xl border border-line bg-white/70 p-3">
      <div className="flex flex-wrap items-center gap-2 text-[10px] text-ink-muted">
        <span>{match.category}</span>
        <span>{strengthLabel(match.evidenceStrength)}</span>
        <span>{Math.round(match.relevanceScore)} / 100</span>
      </div>
      <a
        href={match.url}
        className="mt-2 block break-words text-sm font-semibold text-ink underline decoration-line underline-offset-2"
      >
        {match.headline}
      </a>
      <p className="mt-1 text-[11px] text-ink-muted">
        {label} · {match.source} · {formatEtTime(match.publishedAt)}
      </p>
      {match.supportingEvidence.length > 0 && (
        <p className="mt-1 text-[11px] leading-relaxed text-ink-secondary">
          {match.supportingEvidence.join(" · ")}
        </p>
      )}
    </li>
  );
}

function DemoCatalysts({ events }: { events: CatalystEvent[] }) {
  return (
    <ul className="mt-4 space-y-3">
      {events.map((event) => (
        <li key={event.id} className="rounded-xl border border-line bg-sakura-50/70 p-4">
          <span className="rounded-full bg-sakura-300 px-2 py-0.5 text-[10px] font-bold text-brand-deep">
            {event.category}
          </span>
          <h3 className="mt-2 break-words font-semibold leading-relaxed text-ink">
            {event.headline}
          </h3>
          <p className="mt-2 break-words text-xs leading-relaxed text-ink-secondary">
            {event.chain.join(" → ")}
          </p>
          <p className="mt-2 text-[11px] text-ink-muted">影响评分 {event.impactScore} / 100</p>
        </li>
      ))}
    </ul>
  );
}

function strengthLabel(strength: CatalystMatch["evidenceStrength"]): string {
  return { strong: "强匹配", moderate: "中等匹配", weak: "弱匹配" }[strength];
}
