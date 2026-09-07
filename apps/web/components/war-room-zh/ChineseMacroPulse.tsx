import type { MacroDataMeta, MacroSignal, MarketDataMode } from "@war-room/types";
import type { ProvenanceStatus } from "@/components/ui/ProvenanceTag";
import { formatMacroChange, formatMacroValue } from "@/lib/format";
import { Empty, Loading, Status } from "./ChineseMarketPulse";

export function ChineseMacroPulse({
  signals,
  status,
}: {
  signals: MacroSignal[] | null;
  status: ProvenanceStatus;
  mode: MarketDataMode;
  meta: MacroDataMeta | null;
}) {
  return (
    <section id="macro-pulse" aria-labelledby="macro-pulse-heading">
      <header>
        <p className="text-[11px] font-semibold tracking-[0.14em] text-ink-muted">宏观信号</p>
        <h2 id="macro-pulse-heading" className="text-lg font-semibold text-ink">
          宏观脉搏
        </h2>
      </header>
      {status === "error" ? (
        <Status text="宏观数据暂不可用" />
      ) : status === "loading" || signals === null ? (
        <Loading label="正在加载宏观数据" />
      ) : signals.length === 0 ? (
        <Empty text="暂无宏观数据" />
      ) : (
        <ul className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {signals.map((signal) => (
            <li key={signal.id} className="min-w-0 rounded-2xl border border-line bg-surface p-3.5">
              <h3 className="text-[11px] font-semibold text-ink-muted">{signal.label}</h3>
              <p className="mt-2 text-xl font-semibold tabular-nums text-ink">
                {formatMacroValue(signal)}
              </p>
              <p className="mt-2 text-xs tabular-nums text-ink-secondary">
                {signal.change === null ? "—" : formatMacroChange(signal)}
              </p>
              <p className="mt-2 break-words text-[11px] leading-relaxed text-ink-muted">
                {signal.interpretation ?? "暂无解读"}
              </p>
              <p className="mt-2 text-[10px] text-ink-muted">{signal.source}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
