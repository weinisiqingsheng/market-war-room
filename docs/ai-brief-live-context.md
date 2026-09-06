# AI Brief — Live Domain Adapters (Phase 7C.1B)

Pure adapters convert REAL domain outputs into sealed Phase 7A normalized
inputs. No builders are called here; no fetch/env/Date.now; no LLM.

Mapping rules (per Phase 7C.1A audit):
- Market: indices looked up by ticker (SPY/QQQ/IWM/DIA) and sectors by `etf`
  (11 canonical). Freshness is meta-only (`meta.stale` → stale, else fresh);
  no per-index timestamps are invented. Coverage = available canonical indices / 4.
- Macro: real ids `vix, us10y, usd_broad, wti, gold, btc`; **`usd_broad`
  maps explicitly to normalized `usdBroad`**. Per-signal freshness: stale →
  stale, realtime → fresh, intraday/daily → delayed (daily is never realtime).
  Domain freshness is conservative: `meta.stale` → stale, else any daily
  signal → delayed, else fresh. Coverage = available canonical signals / 6.
- Regime: copies `RegimeResult` score/displayScore/label/coverage/confidence/
  asOf/engineVersion exactly; drivers use `positiveDrivers[].reason` and
  `negativeDrivers[].reason` in original order. `result == null` → unavailable
  (never synthesized).
- Breadth: `metrics.advanceRatio` (0–1) is **×100**; `above20Pct`/`above50Pct`
  are already percentages and are never double-scaled. Freshness delayed
  (15-minute delayed SIP), asOf from `meta.asOf` (no invented effectiveAsOf).
- Anomalies: uses `topOverall` only (topPositive/topNegative ignored, no
  reranking); nested `metrics.returnSigma/sectorRelativePct/breakout20/
  breakdown20` are flattened; `effectiveAsOf ?? meta.asOf` preferred;
  per-candidate `priceAsOf` preserved; confidence/coveragePct/engineVersion
  preserved.
- Catalysts: items map status/primaryCatalyst (category, headline, publishedAt,
  source, relevanceScore, evidenceStrength, eventPolarity, catalystCutoff);
  secondaryCatalysts, supportingEvidence, and raw provider bodies are never
  leaked. `asOf = effectiveAsOf ?? catalystCutoff ?? asOf`; freshness delayed.

Catalyst reliability policy (pure, outside confidence.ts; enum values only
`ok | disabled | error`):
- news ok, sec ok, corporateActions ok → 1.00
- news ok, sec ok, corporateActions error/disabled → 0.90
- news ok, sec error/disabled → 0.75
- news error/disabled, sec ok → 0.70
- news error + sec error → 0.00 (domain unavailable)

Coverage semantics: `NO CLEAR CATALYST FOUND` is a valid outcome, NOT missing
data. When a candidate set was evaluated successfully, catalyst coverage is 1.0
(matched/candidate ratio is never used as confidence coverage); provider
degradation is carried by `reliabilityFactor`.

No live→demo fallback exists in this layer; demo mode belongs to future
service/API selection. The next phase (7C.1C) assembles adapter outputs into
`buildBriefContext`.

## Composition boundary (Phase 7C.1C)
Composition pipeline:
real domain output → pure adapter (7C.1B) → `assembleBriefContext` (7C.1C)
→ sealed `buildBriefContext` → `brief-context-v1`.

`assembleBriefContext({ generatedAt, market, macro, regime, breadth,
anomalies, catalysts })` copies each adapter's `evidenceInput`, `sourceMeta`,
and `quality` into the sealed builder untouched — no reinterpretation, no
timestamp merging, no cross-domain logic, no recalculation of confidence, no
demo fallback. Unavailable adapter outputs pass through as unavailable (never
fabricated facts). Live builder calls and per-domain try/catch orchestration
are NOT owned by 7C.1C; they belong to 7C.1D.

