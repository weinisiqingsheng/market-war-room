import type { MarketDataMode, MarketRegime, RegimeDriver, RegimeResult } from "@/types/market";
import { formatEtTime } from "@/lib/format";
import { Empty, Loading, Status } from "./ChineseMarketPulse";

export type ChineseRegimeCardStatus = "loading" | "ready" | "error";
export function ChineseMarketRegimeCard({
  mode,
  status,
  regime,
  regimeDrivers,
  result,
  asOf,
}: {
  mode: MarketDataMode;
  status: ChineseRegimeCardStatus;
  regime: MarketRegime | null;
  regimeDrivers: RegimeDriver[] | null;
  result: RegimeResult | null;
  asOf?: string | null;
}) {
  if (status === "loading")
    return (
      <section id="market-regime" aria-labelledby="market-regime-heading">
        <Loading label="正在加载市场环境" />
      </section>
    );
  if (status === "error" || (mode === "live" && !result))
    return (
      <section id="market-regime" aria-labelledby="market-regime-heading">
        <header>
          <h2 id="market-regime-heading" className="text-lg font-semibold text-ink">
            市场环境
          </h2>
        </header>
        <Status text="市场环境暂不可用" />
      </section>
    );
  if (mode === "demo" && (!regime || !regimeDrivers))
    return (
      <section id="market-regime" aria-labelledby="market-regime-heading">
        <h2 id="market-regime-heading" className="text-lg font-semibold text-ink">
          市场环境
        </h2>
        <Empty text="暂无市场环境数据" />
      </section>
    );
  const score = mode === "live" ? result?.displayScore : regime?.score;
  const label = mode === "live" ? result?.label : regime?.label;
  const drivers =
    mode === "live"
      ? [...(result?.positiveDrivers ?? []), ...(result?.negativeDrivers ?? [])]
      : (regimeDrivers ?? []);
  const coverage = mode === "live" && result ? Math.round(result.coverage * 100) : null;
  const asOfValue = asOf ?? result?.asOf;
  return (
    <section
      id="market-regime"
      aria-labelledby="market-regime-heading"
      className="rounded-3xl border border-line bg-surface p-6 shadow-card"
    >
      <p className="text-[11px] font-semibold tracking-[0.14em] text-ink-muted">市场环境</p>
      <h2 id="market-regime-heading" className="sr-only">
        市场环境
      </h2>
      <p className="mt-3 text-6xl font-semibold tabular-nums text-ink">
        {score ?? "—"}
        <span className="ml-2 text-sm text-ink-muted">/ 100</span>
      </p>
      <p className="mt-3 inline-flex rounded-full bg-sakura-200 px-3 py-1 text-xs font-semibold text-brand-deep">
        {label}
      </p>
      <p className="mt-4 max-w-xl break-words text-sm leading-relaxed text-ink-secondary">
        {mode === "demo"
          ? regime?.explanation
          : "由确定性引擎生成的市场环境读数，仅供分析，不构成未来收益预测。"}
      </p>
      {mode === "live" && result && (
        <div className="mt-4 flex flex-wrap gap-2 text-xs text-ink-muted">
          <span>
            {coverage}% 覆盖率 · {confidenceLabel(result.confidence)}
          </span>
          {result.staleInputs.length > 0 && <span>{result.staleInputs.length} 个陈旧输入</span>}
          {result.missingInputs.length > 0 && <span>{result.missingInputs.length} 个缺失输入</span>}
        </div>
      )}
      <h3 className="mt-6 text-sm font-semibold text-ink">环境驱动因素</h3>
      <ul className="mt-3 grid gap-3 sm:grid-cols-2">
        {drivers.map((driver) => (
          <li key={driver.id} className="min-w-0 rounded-xl border border-line p-3">
            <p className="font-semibold text-ink">{driver.name}</p>
            <p className="mt-1 text-xs leading-relaxed text-ink-secondary">
              {"signal" in driver
                ? `${driver.signal} · ${driver.value}`
                : `${driver.reason} · ${driver.impact.toFixed(1)}`}
            </p>
          </li>
        ))}
      </ul>
      {mode === "live" && result && (
        <p className="mt-4 text-[10px] text-ink-muted">
          {result.engineVersion}
          {asOfValue ? ` · 截至 ${formatEtTime(asOfValue)}` : ""}
        </p>
      )}
    </section>
  );
}

function confidenceLabel(confidence: RegimeResult["confidence"]): string {
  return { high: "高置信度", medium: "中等置信度", low: "低置信度", insufficient: "覆盖不足" }[
    confidence
  ];
}
