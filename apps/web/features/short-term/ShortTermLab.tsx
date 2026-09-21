"use client";

import { FormEvent, useState } from "react";
import {
  STRATEGIES,
  type ShortTermAnalysisRequest,
  type ShortTermAnalysisResult,
  type StrategyId,
} from "@/lib/short-term/types";

const strategyOptions = Object.entries(STRATEGIES) as Array<[StrategyId, (typeof STRATEGIES)[StrategyId]]>;

function toneClass(tone: "positive" | "caution" | "neutral") {
  if (tone === "positive") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (tone === "caution") return "border-amber-200 bg-amber-50 text-amber-900";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

export function ShortTermLab() {
  const [ticker, setTicker] = useState("");
  const [strategyId, setStrategyId] = useState<StrategyId>("momentum-watch");
  const [horizonHours, setHorizonHours] = useState("4");
  const [maxLossPct, setMaxLossPct] = useState("2");
  const [result, setResult] = useState<ShortTermAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const body: ShortTermAnalysisRequest = {
        ticker,
        strategyId,
        horizonHours: Number(horizonHours),
        maxLossPct: Number(maxLossPct),
      };
      const response = await fetch("/api/short-term/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        cache: "no-store",
        body: JSON.stringify(body),
      });
      const payload = (await response.json()) as ShortTermAnalysisResult | { error?: { message?: string } };
      if (!response.ok) throw new Error("error" in payload && payload.error?.message ? payload.error.message : "Analysis failed");
      setResult(payload as ShortTermAnalysisResult);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Analysis failed");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-8 lg:py-12">
      <header className="mb-8 max-w-4xl">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-violet-800">
          <span aria-hidden="true" className="h-2 w-2 rounded-full bg-violet-500" />
          Prototype workspace · isolated route
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">Short-Term Intelligence Lab</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">
          A self-contained research surface for testing ticker inputs, short-term strategy assumptions, market-condition checks, and a typed Jev-shaped assessment.
        </p>
      </header>

      <section className="mb-8 rounded-2xl border border-violet-200 bg-violet-50/80 p-5 shadow-sm" aria-label="simulation notice">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-800">Simulated Jev analysis</p>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-violet-950">
              This lab uses a deterministic local mock. Prices, probabilities, confidence, scenarios, and scores are synthetic fixtures and must not be read as verified market data or trading advice.
            </p>
          </div>
          <span className="shrink-0 rounded-full border border-violet-300 bg-white px-3 py-1 text-xs font-semibold text-violet-800">MOCK ONLY</span>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
        <form onSubmit={submit} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-5">
            <h2 className="text-lg font-semibold text-slate-900">Research inputs</h2>
            <p className="mt-1 text-sm leading-5 text-slate-500">Nothing is queried while you type.</p>
          </div>
          <div className="space-y-5">
            <label className="block text-sm font-medium text-slate-800">
              Ticker
              <input
                aria-label="Ticker"
                value={ticker}
                onChange={(event) => setTicker(event.target.value)}
                placeholder="NVDA"
                autoCapitalize="characters"
                className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-base uppercase outline-none ring-violet-200 transition focus:border-violet-400 focus:ring-4"
              />
            </label>
            <label className="block text-sm font-medium text-slate-800">
              Strategy profile
              <select value={strategyId} onChange={(event) => setStrategyId(event.target.value as StrategyId)} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none ring-violet-200 transition focus:border-violet-400 focus:ring-4">
                {strategyOptions.map(([id, strategy]) => <option key={id} value={id}>{strategy.label}</option>)}
              </select>
              <span className="mt-2 block text-xs leading-5 text-slate-500">{STRATEGIES[strategyId].description}</span>
            </label>
            <label className="block text-sm font-medium text-slate-800">
              Review horizon
              <select value={horizonHours} onChange={(event) => setHorizonHours(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none ring-violet-200 transition focus:border-violet-400 focus:ring-4">
                {["1", "4", "8", "24", "48"].map((hours) => <option key={hours} value={hours}>{hours} hours</option>)}
              </select>
            </label>
            <label className="block text-sm font-medium text-slate-800">
              Maximum loss review threshold (%)
              <input type="number" min="0.25" max="10" step="0.25" value={maxLossPct} onChange={(event) => setMaxLossPct(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 tabular-nums outline-none ring-violet-200 transition focus:border-violet-400 focus:ring-4" />
              <span className="mt-2 block text-xs leading-5 text-slate-500">A scenario-review threshold only. It is not an order, stop, or broker instruction.</span>
            </label>
            <button type="submit" disabled={loading} className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-wait disabled:opacity-60">
              {loading ? "Running simulated analysis…" : "Run simulated analysis"}
            </button>
            {error ? <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p> : null}
          </div>
        </form>

        <div className="min-w-0">
          {!result ? (
            <section className="flex min-h-[420px] items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white/70 p-8 text-center shadow-sm">
              <div className="max-w-md">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">No analysis yet</p>
                <h2 className="mt-3 text-xl font-semibold text-slate-800">Enter a ticker to inspect the prototype flow</h2>
                <p className="mt-3 text-sm leading-6 text-slate-500">The result will keep synthetic market checks, mock Jev output, evidence, scenarios, and limitations visibly separate.</p>
              </div>
            </section>
          ) : (
            <ResultView result={result} />
          )}
        </div>
      </section>
    </main>
  );
}

function ResultView({ result }: { result: ShortTermAnalysisResult }) {
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-violet-200 bg-violet-50/70 p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-800">{result.request.ticker} · {result.strategy.label}</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900">Mock Jev assessment</h2>
          </div>
          <span className="rounded-full border border-violet-300 bg-white px-3 py-1 text-xs font-bold uppercase tracking-[0.12em] text-violet-800">{result.assessment.provider} · simulated</span>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <Metric label="Assessment" value={result.assessment.label} />
          <Metric label="Confidence" value={`${Math.round(result.assessment.confidence * 100)}%`} />
          <Metric label="Model" value={result.assessment.model} />
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {Object.entries(result.assessment.probabilities).map(([label, value]) => <div key={label} className="rounded-xl border border-violet-200 bg-white/80 p-3"><p className="text-xs uppercase tracking-[0.12em] text-slate-500">{label}</p><p className="mt-1 tabular-nums text-lg font-semibold text-slate-900">{Math.round(value * 100)}%</p></div>)}
        </div>
        <ul className="mt-5 space-y-2 text-sm leading-6 text-slate-700">{result.assessment.rationale.map((item) => <li key={item} className="flex gap-2"><span className="text-violet-600">•</span><span>{item}</span></li>)}</ul>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Market-condition checks</p><h2 className="mt-2 text-xl font-semibold text-slate-900">Synthetic fixture inputs</h2></div><span className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-600">{result.marketData.status} · {result.marketData.asOf}</span></div>
        <p className="mt-3 text-sm text-slate-500">Reference price: <span className="tabular-nums font-semibold text-slate-700">${result.marketData.price.value.toFixed(2)}</span> <span className="text-xs">(synthetic, not live)</span></p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">{result.marketData.checks.map((check) => <div key={check.label} className={`rounded-xl border p-4 ${toneClass(check.tone)}`}><p className="text-xs font-bold uppercase tracking-[0.12em]">{check.label}</p><p className="mt-2 font-semibold">{check.value}</p><p className="mt-1 text-xs leading-5 opacity-80">{check.detail}</p></div>)}</div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Supporting evidence</p><h2 className="mt-2 text-xl font-semibold text-slate-900">What the prototype would show</h2><div className="mt-5 grid gap-3 sm:grid-cols-2">{result.evidence.map((item) => <div key={item.label} className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs uppercase tracking-[0.12em] text-slate-500">{item.label}</p><p className="mt-2 tabular-nums font-semibold text-slate-900">{item.value}</p><p className="mt-1 text-xs leading-5 text-slate-500">{item.interpretation}</p></div>)}</div></section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Risk scenarios</p><h2 className="mt-2 text-xl font-semibold text-slate-900">Review cases, not trade instructions</h2><div className="mt-5 grid gap-3">{result.scenarios.map((scenario) => <div key={scenario.label} className="grid gap-2 rounded-xl border border-slate-200 p-4 sm:grid-cols-[120px_160px_1fr]"><p className="font-semibold text-slate-900">{scenario.label}</p><p className="tabular-nums text-sm text-slate-700">{scenario.range}</p><p className="text-sm leading-5 text-slate-500">{scenario.risk} · {scenario.trigger}</p></div>)}</div></section>

      <section className="rounded-2xl border border-amber-200 bg-amber-50/70 p-5 shadow-sm sm:p-6"><p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-800">Limitations and next boundary</p><h2 className="mt-2 text-xl font-semibold text-slate-900">What this prototype cannot validate</h2><ul className="mt-4 space-y-2 text-sm leading-6 text-amber-950">{result.limitations.map((item) => <li key={item} className="flex gap-2"><span>•</span><span>{item}</span></li>)}</ul><p className="mt-5 border-t border-amber-200 pt-4 text-sm leading-6 text-amber-950">A real Jev phase would replace only the mock evaluator behind this isolated route, add server-side credentials, pinned model configuration, strict response validation, cost/latency budgets, and calibration. Existing Market War Room pipelines would remain unchanged unless separately approved.</p></section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-violet-200 bg-white/80 p-4"><p className="text-xs uppercase tracking-[0.12em] text-slate-500">{label}</p><p className="mt-2 break-words text-lg font-semibold text-slate-900">{value}</p></div>;
}

