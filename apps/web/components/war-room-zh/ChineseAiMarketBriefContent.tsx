"use client";
import type { GroundedMarketBrief } from "@/lib/ai-brief/brief-types";

function Evidence({
  refs,
  onShowEvidence,
}: {
  refs: string[];
  onShowEvidence?: (refs: string[]) => void;
}) {
  return onShowEvidence ? (
    <button
      type="button"
      onClick={() => onShowEvidence(refs)}
      className="mt-2 rounded-full bg-white/80 px-2.5 py-1 text-[10px] font-semibold text-accent ring-1 ring-line"
    >
      查看证据
    </button>
  ) : null;
}
export function ChineseAiMarketBriefContent({
  brief,
  onShowEvidence,
}: {
  brief: GroundedMarketBrief;
  onShowEvidence?: (refs: string[]) => void;
}) {
  return (
    <>
      <h3 className="mt-4 text-xl font-bold leading-snug text-ink">{brief.headline}</h3>
      <p className="mt-2 text-sm text-ink-secondary">
        <span className="mr-2 rounded-full bg-ink/5 px-2 py-0.5 text-[11px] font-bold text-ink-muted">
          {brief.stance.label}
        </span>
        {brief.stance.summary}
      </p>
      <div className="mt-4 space-y-2.5">
        {brief.overview.map((item, i) => (
          <p key={i} className="text-sm leading-relaxed text-ink-secondary">
            {item.text}
          </p>
        ))}
      </div>
      <section className="mt-5" aria-label="核心驱动">
        <h4 className="text-[10px] font-bold tracking-[0.18em] text-accent">核心驱动</h4>
        <ul className="mt-2 space-y-2">
          {brief.keyDrivers.map((item, i) => (
            <li key={i} className="rounded-xl border border-line bg-sakura-50/70 p-3">
              <p className="text-sm font-semibold text-ink">{item.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-ink-secondary">{item.text}</p>
              <Evidence refs={item.evidenceRefs} onShowEvidence={onShowEvidence} />
            </li>
          ))}
        </ul>
      </section>
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <section aria-label="市场内部结构">
          <h4 className="text-[10px] font-bold tracking-[0.18em] text-accent">市场内部结构</h4>
          <p className="mt-2 text-xs leading-relaxed text-ink-secondary">
            {brief.marketInternals.text}
          </p>
        </section>
        <section aria-label="宏观">
          <h4 className="text-[10px] font-bold tracking-[0.18em] text-accent">宏观</h4>
          <p className="mt-2 text-xs leading-relaxed text-ink-secondary">{brief.macro.text}</p>
        </section>
      </div>
      {brief.notableMoves.length > 0 && (
        <section className="mt-5" aria-label="值得关注">
          <h4 className="text-[10px] font-bold tracking-[0.18em] text-accent">值得关注</h4>
          <ul className="mt-2 space-y-2">
            {brief.notableMoves.map((item, i) => (
              <li key={i} className="rounded-xl border border-line bg-white/60 p-3">
                <span className="rounded-full bg-sakura-300 px-2 py-0.5 text-[10px] font-bold text-brand-deep">
                  {item.ticker}
                </span>
                <p className="mt-1.5 text-xs text-ink-secondary">{item.text}</p>
                <Evidence refs={item.evidenceRefs} onShowEvidence={onShowEvidence} />
              </li>
            ))}
          </ul>
        </section>
      )}
      <section className="mt-5" aria-label="后续关注">
        <h4 className="text-[10px] font-bold tracking-[0.18em] text-accent">后续关注</h4>
        <ul className="mt-2 space-y-1.5 text-xs text-ink-secondary">
          {brief.watchNext.map((item, i) => (
            <li key={i}>· {item.text}</li>
          ))}
        </ul>
      </section>
      <footer className="mt-5 flex flex-wrap gap-2 border-t border-line pt-3 text-[11px] text-ink-muted">
        <span className="font-semibold">
          数据质量 · {{ high: "高", medium: "中", low: "低" }[brief.dataQuality.confidence]}
        </span>
        <span>{brief.dataQuality.text}</span>
      </footer>
    </>
  );
}
