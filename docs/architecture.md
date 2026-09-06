# Architecture

## Monorepo structure

```
apps/web        Next.js 16 (App Router, TS strict, Tailwind v4) — the homepage
packages/types  @war-room/types — canonical typed market domain models
packages/config @war-room/config — shared tsconfig base
services/analytics — Python FastAPI (Phase 0A: /health only)
```

**Why npm workspaces and no Turborepo:** one JS app today. npm workspaces give
hoisting, workspace deps and a single install without an extra task runner.
When a second buildable package appears (e.g. a worker or CLI), a task runner
can be introduced without restructuring. The analytics service is a separate
Python ecosystem and is only coordinated at the repo level (CI).

## Data flow (Phase 0A)

```
@war-room/types        canonical contracts (MarketRegime, MarketIndex, …)
      │  type-only imports (erased at build)
      ▼
apps/web/types/market.ts   app-level re-export
      │
      ▼
apps/web/data/demo-market.ts   typed fixtures (DESIGN DATA)
      │
      ▼
features/home/HomeDashboard    composes sections, passes data via props
      │
      ▼
components/*          pure, prop-driven UI (no data fetching)
```

All components receive data **through props** and never import the demo file.
Phase 1 swaps `data/demo-market.ts` for API-backed loaders implementing the
same contracts; no component changes are required.

## Component inventory

| Component                                            | Responsibility                                                       |
| ---------------------------------------------------- | -------------------------------------------------------------------- |
| `Header`                                             | Sticky brand lockup, nav (Overview active), session status, ET clock |
| `SakuraLogo`                                         | Inline-SVG editable blossom brand mark                               |
| `SectionHeader`                                      | Kicker + h2 + subtitle + meta slot                                   |
| `DemoDataBanner`                                     | Global "DESIGN PREVIEW — not live market data" notice                |
| `MarketRegimeCard`                                   | Hero module: score, label, explanation, insight chip, drivers        |
| `RegimeSpectrum`                                     | Horizontal risk gradient + marker (not a gauge)                      |
| `RegimeDriverCard`                                   | One compact driver signal card                                       |
| `MarketPulse` / `MarketIndexCard`                    | Four pastel index cards w/ OHLC, day position, sparkline             |
| `Sparkline`                                          | Dependency-free SVG sparkline                                        |
| `MacroPulse` / `MacroSignalCard`                     | Six macro cells; direction ≠ interpretation                          |
| `SectorRotation` / `SectorRow`                       | Ranked relative-strength list with strength bars                     |
| `MarketBreadth`                                      | Advancing/declining, movers, 50-DMA, highs/lows, score               |
| `MarketAnomalies`                                    | Semantic table of unusual activity                                   |
| `CatalystIntelligence` / `CatalystCard`              | Catalyst → impact chains                                             |
| `AIMarketBrief`                                      | Visual brief module (no LLM in Phase 0A)                             |
| `AskWarRoom`                                         | UI-only Q&A box (preventDefault + dev notice)                        |
| `ui/Trend`, `ui/ToneBadge`, `ui/DemoTag`, `ui/icons` | Shared primitives                                                    |

## Conventions

- **Direction vs interpretation.** `change*` fields carry raw direction; `tone`
  carries market meaning. An up move is never automatically shown as positive
  — components render the two as distinct signals (arrows/labels in addition
  to color).
- **Semantics.** Semantic headings (h1 brand, h2 sections, h3 cards), real
  `<table>` markup for anomalies, `role="meter"` for the regime spectrum,
  visible focus states, keyboard-usable controls.
- **Numerals.** Financial figures always use `tabular-nums`.
- **Accessibility.** Color is never the only signal; arrows, glyphs and text
  accompany every tone.

## Responsive behavior

- `≥1200px` (custom `xl` breakpoint): full approved two-column layout.
- `768–1199px`: complex two-column sections collapse to one column.
- `<768px`: everything stacks by information priority (Regime → Pulse → Macro →
  Sector → Breadth → Anomalies → Catalysts → Brief → Ask).

## Phase 1 market-data architecture

```
Browser (HomeDashboard, client)
  │  polls GET /api/market/overview every ~30s (paused when tab hidden)
  ▼
app/api/market/overview/route.ts        (server-only, force-dynamic)
  │  config gate (mode, credentials) → safe 503/502 + safe messages
  ▼
lib/market-data/cache.ts                in-memory TTL (15s) + in-flight dedup;
  │                                     stale-cache serve on upstream failure
  ▼
lib/market-data/overview.ts             buildLiveOverview: one batch snapshots +
  │                                     market clock → domain MarketOverview
  ▼
lib/market-data/provider.ts             factory → Alpaca adapter (or demo)
lib/market-data/providers/alpaca.ts     one multi-symbol /v2/stocks/snapshots
                                        request + /v2/clock; AbortController
                                        timeout; typed upstream guards
  ▼
lib/market-data/normalize.ts            price priority, change/day-position/
                                        relative-return/signal/stale rules
```

- **Provider boundary:** components only ever receive normalized domain data
  (`MarketOverview`) via props. Raw Alpaca shapes stop at `normalize.ts`.
- **Symbol universe:** `lib/market-data/symbols.ts` is the single source of
  truth for the 15 ETFs; demo fixtures derive tickers from it.
- **Security:** credentials are read in `config.ts` (guarded by the
  `server-only` package) and attached as headers in the Alpaca adapter. No
  `NEXT_PUBLIC_`, no credential serialization, no raw payload forwarding.
- **Price selection (documented priority):** latest trade → minute bar close →
  daily bar close → unavailable. `previousClose = 0` disables change math.
- **Stale rule:** stale only while the market is open AND the newest snapshot
  timestamp is older than `MARKET_DATA_STALE_AFTER_MS` (default 120s). Closed
  markets are never "stale" just because the last trade was at the prior close.
- **Refresh/cache decision:** client polls at 30s (native `fetch` + interval,
  no data library); server caches 15s in-process and coalesces concurrent
  requests, so N browser sessions → ≤1 Alpaca call per 15s. In-memory cache is
  correct for single-instance dev/self-host; a shared cache (Redis) is a later
  phase.
- **Failure behavior:** no silent demo substitution. First failure without a
  cache → modules render **Market data unavailable**; later failures serve the
  previous successful payload flagged `stale`.

## Phase 2 macro-data architecture

Macro Pulse runs its own multi-provider pipeline, independent of equities:

```
Browser (HomeDashboard)
  → GET /api/macro/overview (separate route — per-source cache cadence differs)
  → lib/macro-data/overview.ts  buildMacroOverview: Promise.all per provider,
                                 per-provider failure isolation, interpretation
  → lib/macro-data/cache.ts     per-source TTL: FRED 15min, Twelve 60s, BTC 30s
                                 + in-flight dedup + degraded stale serve; the
                                 Twelve Gold provider additionally caches its
                                 /time_series call for 15 min internally
  → lib/macro-data/provider.ts  factory
  → providers/{fred,twelve-data,alpaca-crypto}.ts
  → lib/macro-data/normalize.ts (parse/guard + normalize raw → snapshots)
  → lib/macro-data/interpret.ts (deterministic display interpretations + stale)
```

- **Provider ownership:** VIX + US 10Y + Broad USD + WTI → FRED (daily), Gold →
  Twelve Data (`/price` + `/time_series`, intraday), BTC/USD → Alpaca crypto
  (real-time 24/7, reusing the shared `alpacaFetch` HTTP helper). No ETF
  proxies (no USO/GLD, no UUP/UDN), and no ICE DXY.
- **Symbol config:** `lib/macro-data/symbols.ts` is the single source of truth.
  Twelve Data owns ONLY `XAU/USD` and never requests WTI in any form (bare
  `WTI` resolves to the W&T Offshore stock; WTI lives on FRED `DCOILWTICO`).
  The dollar cell is FRED `DTWEXBGS` (Nominal Broad U.S. Dollar Index) —
  deliberately NOT ICE DXY, so no "DXY" label appears anywhere in the UI/API.
- **Freshness is per-source:** FRED daily observations use business-day-aware
  stale logic (weekends/holidays are not counted as missing; stale at 3+ missed
  US business days), Twelve intraday (15 min), BTC realtime (5 min, 24/7 —
  never tied to the US equity open). Each cell discloses `source · frequency`.
- **Interpretation vs direction:** `interpret.ts` produces display labels
  (e.g. WTI up +2.5% → "Inflation Risk", negative tone) — UI interpretations
  only; Market Regime scoring is a later phase.
- **Partial failure:** one provider failing marks only its signals unavailable;
  no demo values are substituted. Missing keys → per-provider unavailable (or
  503 if nothing is configured).
- **API choice (documented):** a separate `GET /api/macro/overview` rather than
  extending `/api/market/overview`, because macro has independent providers and
  cache cadence. The homepage fetches it on its own 60s poll.

## Phase 3 regime engine

- **Provider integrations stay in Next.js** (Phase 1/2); Python never talks to
  Alpaca/FRED/Twelve.
- **Next.js orchestration:** `lib/regime/build-input.ts` turns the normalized
  Market + Macro overviews into a canonical `RegimeInput`; `lib/regime/client.ts`
  POSTs it to the analytics service and normalizes the snake_case result back to
  the shared camelCase `RegimeResult`. `GET /api/regime/overview` calls the
  existing server builders directly (no internal HTTP round-trips).
- **Python is the canonical scorer:** `services/analytics/app/regime/engine.py`
  is the single scoring implementation. TypeScript only has transport types.
  All thresholds live in `app/regime/constants.py`. Deterministic, engine-versioned.
- **Coverage/confidence:** fresh=1.0, stale=0.5, unavailable=0.0; coverage is
  expected-weight × quality; < 0.50 → "Insufficient Data" (score `null`).
- **Regime result:** six pillar scores, coverage, confidence, top ±3 drivers,
  stale/missing inputs, `engineVersion: "regime-v1"`.
- Full design/limits: `docs/regime-engine.md`.

## Phase 4 breadth engine (Next.js)

- **S&P 500 delayed-SIP breadth** lives entirely in `apps/web/lib/breadth` —
  a domain-data transformation, engine-versioned `breadth-v1`. It deliberately
  does NOT depend on Python and does NOT feed regime-v1.
- Universe: static/versioned `lib/breadth/universe/sp500.ts` (503 symbols,
  `sp500-v1`), generated once by `scripts/generate-sp500-universe.mjs` — never
  scraped at runtime. Provider symbols map centrally (`symbols.ts`).
- Current data: Alpaca multi-symbol `feed=delayed_sip` snapshots (60s cache);
  history: multi-symbol 1Day bars (feed=sip, paginated, 30-min cache) with
  `end` safely outside the restricted recent-15-minute Basic window.
- Score/state/coverage rules: `lib/breadth/{score,metrics,normalize,history}.ts`
  with all thresholds centralized in `constants.ts`. Full design/limits:
  `docs/breadth.md`.

## Phase 5 anomaly scanner (Next.js)

- **`anomaly-v1`** lives in `apps/web/lib/anomalies` and aggressively reuses the
  Phase 4 universe, provider transport, caches and completed-session helpers —
  there is no second Alpaca transport stack and no duplicated 503-symbol
  pipeline (breadth/raw history and anomaly/split history are separate cached
  series by design).
- History uses `adjustment=split` (never mixed with raw breadth series) so
  splits don't create false anomalies.
- Deterministic metric → score → severity → ranking rules, thresholds
  centralized in `lib/anomalies/constants.ts`; sector-relative math always
  compares delayed-SIP stock vs delayed-SIP sector ETF.
- Universe sector metadata (GICS) is generated offline into `sp500-v1`.
- Full formulas/limits: `docs/anomalies.md`. Not a prediction or catalyst
  system; not wired into regime-v1/breadth-v1.

- Index cards: 4 → 2 → 1 columns. Macro cells: 6 → 3 → 2 columns.
