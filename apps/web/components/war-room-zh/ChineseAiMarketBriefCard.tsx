"use client";
import { ChineseAiMarketBriefContent } from "./ChineseAiMarketBriefContent";
import { useChineseAiMarketBrief } from "@/features/war-room-zh/useChineseAiMarketBrief";

export function ChineseAiMarketBriefCard({
  onShowEvidence,
}: {
  onShowEvidence?: (refs: string[]) => void;
}) {
  const { status, response, refetch } = useChineseAiMarketBrief();
  return (
    <section
      aria-label="中文 AI 市场简报"
      className="rounded-[20px] border border-line bg-surface p-5 shadow-card"
    >
      <header className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold text-ink">AI 市场简报</h2>
        <span className="rounded-full border border-line bg-white/80 px-2 py-0.5 text-[10px] font-bold text-ink-secondary">
          GROUNDED · ai-brief-v1
        </span>
        {response?.mode === "demo" && (
          <span className="rounded-full bg-sakura-300 px-2 py-0.5 text-[10px] font-bold text-brand-deep">
            演示
          </span>
        )}
        {response?.status === "cached" && (
          <span className="text-[10px] text-ink-muted">已缓存</span>
        )}
      </header>
      {status === "loading" && <p className="mt-4 text-sm text-ink-muted">正在加载中文市场简报…</p>}
      {status === "error" && <Unavailable onRetry={refetch} />}
      {status === "ready" && response?.status === "insufficient_grounded_data" && (
        <p className="mt-3 text-sm leading-relaxed text-ink-secondary">
          当前没有足够的可验证市场数据来生成可靠简报。
        </p>
      )}
      {status === "ready" && response?.status === "unavailable" && (
        <Unavailable onRetry={refetch} />
      )}
      {status === "ready" &&
        response?.brief &&
        (response.status === "generated" || response.status === "cached") && (
          <ChineseAiMarketBriefContent brief={response.brief} onShowEvidence={onShowEvidence} />
        )}
    </section>
  );
}
function Unavailable({ onRetry }: { onRetry: () => void }) {
  return (
    <div>
      <p className="mt-3 text-sm text-ink-secondary">中文 AI 市场简报暂时不可用。</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 rounded-full bg-sakura-300 px-3 py-1.5 text-xs font-semibold text-brand-deep"
      >
        重试
      </button>
    </div>
  );
}
