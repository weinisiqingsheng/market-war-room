# Phase 3 — Explainable Market Regime Engine

**This is a deterministic market-regime heuristic. It is not a prediction
model and it does not forecast future returns.**

## What it answers

"What regime is the market trading in right now, and why?" — via a 0–100
score, a label, six pillar scores, coverage, confidence, and explainable
drivers. The engine never produces an unexplained magic number.

## Architecture

```
Alpaca / FRED / Twelve Data
        │  (Next.js providers, credentials, caching, normalization, freshness)
        ▼
Next.js domain overviews (Market + Macro)
        │  lib/regime/build-input.ts  → canonical RegimeInput
        ▼
POST /v1/regime/evaluate  (Python FastAPI — canonical scorer)
        ▼
RegimeResult (snake_case JSON)
        │  lib/regime/client.ts  → normalized RegimeOverview (camelCase)
        ▼
GET /api/regime/overview → Sakura Market Regime UI
```

Python owns scoring/weighting/coverage/confidence/driver attribution/regime
classification. TypeScript only has matching transport types — there is no
second scoring implementation.

## Six pillars (weights sum to 100%)

| Pillar               | Weight | Inputs                                               |
| -------------------- | ------ | ---------------------------------------------------- |
| Equity Tape          | 30%    | SPY 35 · QQQ 30 · IWM 25 · DIA 10                    |
| Sector Participation | 20%    | 11 SPDR sectors (participation 65% · leadership 35%) |
| Volatility           | 15%    | VIX (level 80% · daily change 20%)                   |
| Rates                | 15%    | US 10Y (daily bp move 80% · absolute yield 20%)      |
| Macro Pressure       | 15%    | WTI 8/15 · Broad USD 5/15 · Gold 2/15                |
| Crypto Risk Appetite | 5%     | BTC daily change (confirmation only)                 |

All mapping thresholds and weights are centralized in
`services/analytics/app/regime/constants.py`.

## Mapping thresholds (linear interpolation, flat outside endpoints)

- **Index daily %** → score: −2→0, −1→25, 0→50, +1→75, +2→100
- **Leadership spread** (cyclical avg − defensive avg): −2→0, 0→50, +2→100
- **VIX level**: 12→100, 14→90, 18→70, 22→50, 30→20, 40→0
- **VIX change**: `clamp(50 − changePct·5, 0, 100)`
- **US 10Y bps**: −20→100, −10→75, 0→50, +10→25, +20→0
- **US 10Y yield %**: 3.5→80, 4.0→65, 4.5→50, 5.0→30, 5.5→15
- **WTI %**: −4→100, 0→50, +4→0
- **Broad USD %**: −1→100, 0→50, +1→0
- **Gold %**: `clamp(50 − changePct·5, 35, 65)` — deliberately low weight and
  mild; rising gold is NOT claimed to always mean risk-off.
- **BTC %**: −5→0, 0→50, +5→100

Energy (XLE) is included in broad participation but is deliberately NOT in the
cyclical leadership basket, so oil-driven Energy leadership can coexist with a
risk-off macro environment.

## Missing/stale handling (never neutral-50)

- **fresh available** quality 1.0, **stale available** 0.5, **unavailable** 0.0.
- Scores are computed from available inputs only, with weights renormalized
  among available components.
- Coverage = Σ (pillar weight × pillar quality) over the six pillars — i.e.
  effective expected-weight coverage, returned 0–1 and displayed as a %.
- Confidence: coverage ≥ 0.85 → high; ≥ 0.65 → medium; ≥ 0.50 → low;
  < 0.50 → **insufficient** (score is `null`, label "Insufficient Data").
- Stale data still contributes but halves its coverage weight and is exposed in
  `staleInputs` (the UI shows a subtle "N stale inputs" chip).

## Labels (exact boundaries; upper boundary belongs to the higher bucket)

| Range         | Label              |
| ------------- | ------------------ |
| 70–100        | STRONG RISK-ON     |
| 55–70         | RISK-ON            |
| 40–55         | CAUTIOUS / NEUTRAL |
| 25–40         | RISK-OFF           |
| 0–25          | EXTREME RISK-OFF   |
| coverage < 50 | Insufficient Data  |

## Driver attribution

Each scored input contributes:

```
impact = pillarWeight × normalizedSubWeight × (componentScore − 50)
```

Positive impact = pushes the regime toward risk-on; negative = risk-off.
Drivers are sorted by absolute impact and reported as the top 3 positive and
top 3 negative (deterministic reasons only — no LLM text).

## Engine versioning

Every result returns `engineVersion: "regime-v1"`. Threshold changes in later
phases must bump this version — no silent score behavior changes.

## Known V1 limitations

- VIX and the 10Y are FRED daily observations, not tick-level feeds; the
  engine uses the daily close and its daily change.
- Sector leadership uses equal-weight cyclical/defensive baskets from the 11
  SPDR ETFs; no sub-sector breadth data yet.
- BTC is a 5% confirmation input only and cannot dominate the regime.
- Gold's sign is treated as ambiguous; its contribution is bounded and low.
- Deterministic heuristic — no historical backtesting, no forecast, no ML.
