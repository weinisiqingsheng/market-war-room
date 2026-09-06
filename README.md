# Market War Room

### Sakura Market Intelligence

An AI-powered market intelligence terminal designed to answer:

> **"What is the market trading today?"**

Market War Room combines market data, macro signals, sector rotation, market
breadth, anomaly detection, catalysts, and grounded AI analysis into one
calm, data-dense dashboard. The approved visual direction — _Sakura Finance_ —
is soft-pink branding on a warm-white canvas: cute, soft, financial,
professional, and information-rich.

---

## Current status

**Phase 2 — Live Macro Pulse** (this release)

Macro Pulse is live through a **multi-provider** pipeline when `MACRO_DATA_MODE=live`
is configured, independently of the equities mode:

| Macro signal | Source                           | Frequency         |
| ------------ | -------------------------------- | ----------------- |
| VIX          | FRED (`VIXCLS`)                  | Daily close       |
| US 10Y       | FRED (`DGS10`)                   | Daily observation |
| US Dollar    | FRED (`DTWEXBGS`, Broad USD)     | Daily observation |
| WTI          | FRED (`DCOILWTICO`, EIA Cushing) | Daily observation |
| Gold         | Twelve Data (`XAU/USD`)          | Intraday          |
| BTC/USD      | Alpaca crypto                    | Real-time (24/7)  |

Source map for Phase 2:

- **VIX** — FRED `VIXCLS` · Daily
- **US 10Y** — FRED `DGS10` · Daily
- **US Dollar** — FRED `DTWEXBGS` · Broad USD Index · Daily (a trade-weighted
  index, deliberately _not_ ICE DXY)
- **WTI** — FRED `DCOILWTICO` · EIA WTI Cushing spot · **Daily**. WTI is a
  daily macro anchor, not an intraday crude feed — the cell discloses
  `FRED · Daily` and is never labeled live.
- **Gold** — Twelve Data `XAU/USD` (`/price` for the current spot + `/time_series`
  for the last completed daily close) · Intraday
- **BTC/USD** — Alpaca crypto · Real-time (24/7)

No ETF proxies (USO/GLD/UUP/UDN) are used anywhere, and Twelve Data never
requests WTI in any form (bare `WTI` resolves to the W&T Offshore stock).

### Market Regime (Phase 3 — live regime engine)

When `REGIME_MODE=live` (requires `MARKET_DATA_MODE=live` and
`MACRO_DATA_MODE=live`), Market Regime is scored by the deterministic Python
engine in `services/analytics` (see [docs/regime-engine.md](docs/regime-engine.md)):

- six explainable pillars — Equity 30% · Sectors 20% · Volatility 15% ·
  Rates 15% · Macro 15% · Crypto 5%
- 0–100 risk-on score, regime label, coverage %, and confidence
- top positive / negative drivers with deterministic reasons
- stale inputs reduce coverage; unavailable inputs are never turned into
  neutral 50; below 50% coverage the engine returns "Insufficient Data"
- every result carries `engineVersion: "regime-v1"`

If the analytics service is unavailable, Market Regime shows **Regime
unavailable** — it never silently falls back to the demo score, and Market
Pulse + Macro Pulse keep working.

### Market Breadth (Phase 4 — live S&P 500 breadth)

When `BREADTH_MODE=live`, Market Breadth is computed in Next.js from Alpaca
**delayed-SIP** data (15-minute delay — see [docs/breadth.md](docs/breadth.md)):

- S&P 500 constituents (503 symbols incl. share classes, static `sp500-v1`)
- advancers/decliners/unchanged, advance ratio, % above 20D/50D MA, 20D new
  highs/lows, a `breadth-v1` score (0–100), and a participation state
- coverage % + confidence; below 70% coverage no score is published
- disclosed as **`15M Delayed SIP`** — never merged with Market Pulse's
  `LIVE · IEX`, and never called full-market breadth

If breadth fails, only Market Breadth becomes unavailable — Market Pulse /
Macro / Regime keep working, and demo figures are never substituted.

### Market Anomalies (Phase 5 — S&P 500 statistical scanner)

When `ANOMALIES_MODE=live`, Market Anomalies is the deterministic
[`anomaly-v1`](docs/anomalies.md) scanner over `sp500-v1`:

- daily move, return shock (20D vol σ), same-feed sector divergence (GICS → SPDR),
  gap vs ATR, range expansion, volume participation (fraction of a normal day —
  not time-adjusted RVOL), and 20D breakout/breakdown
- `adjustment=split` history so stock splits never fabricate anomalies
- ranked top-8 overall / top-5 positive / top-5 negative (severity is
  direction-neutral), with deterministic reasons and NO catalyst claims
- labeled **`15M Delayed SIP`** · `anomaly-v1`; failures only disable this
  module with no demo fallback.

Each cell discloses its own provenance (`FRED · Daily`, `Twelve Data · Live`,
`Alpaca · Live`) — daily FRED observations are never called real-time. The
section tag is the safer **MACRO DATA · Multi-source** rather than "LIVE MACRO
DATA".

Market Pulse, Sector Rotation, and header market status stay live via Alpaca
(Market Pulse + Sector Rotation labeled `LIVE · IEX`). Everything else (Market
Regime, Breadth, Anomalies, Catalysts, AI Brief, Ask War Room) remains demo.
With no configuration the app runs in `demo` mode using typed fixtures.

## Roadmap

| Phase | Scope                                                                              |
| ----- | ---------------------------------------------------------------------------------- |
| 0A    | UI foundation, demo-data layer, analytics service skeleton ✅                      |
| 0B    | Visual fidelity audit + UI polish ✅                                               |
| 1     | Real market data (indices + sectors + market clock via Alpaca) ✅                  |
| **2** | **Live Macro Pulse (FRED + Twelve Data + Alpaca crypto)** ✅                       |
| 3     | Market regime engine — deterministic explainable six-pillar engine (Python) ✅     |
| 4     | Market breadth (S&P 500 delayed SIP, breadth-v1) ✅ · Sector rotation live pending |
| 5     | S&P 500 anomaly scanner (delayed SIP, anomaly-v1) ✅ · catalyst engine pending     |
| 6     | Catalyst engine                                                                    |
| 7     | AI market brief                                                                    |
| 8     | Ask War Room                                                                       |
| 9     | Historical intelligence                                                            |
| 10    | Production polish                                                                  |

## Repository layout

```
market-war-room/
├── apps/
│   └── web/            # Next.js + TypeScript + Tailwind homepage
├── services/
│   └── analytics/      # Python FastAPI (health-only in Phase 0A)
├── packages/
│   ├── types/          # Canonical typed market domain models (@war-room/types)
│   └── config/         # Shared toolchain config (tsconfig base)
├── docs/               # Architecture, roadmap, design notes
├── tests/              # Test strategy notes (tests live beside code)
└── .github/workflows/  # CI
```

### Monorepo decision

A lightweight **npm-workspaces** monorepo is used. There is exactly one JS app
in this phase, so task-runner orchestration (Turborepo) was deliberately
omitted — npm workspaces + one root `package.json` scripts layer is simpler and
fully supports future expansion (new apps/services join `apps/*` and
`packages/*`). Shared TypeScript is consumed directly from workspace packages
via `transpilePackages`. See [docs/architecture.md](docs/architecture.md).

## Getting started

### Web (Next.js)

```bash
npm install
npm run dev          # http://localhost:3000
```

Other scripts:

```bash
npm run build        # production build
npm run lint         # ESLint
npm run typecheck    # TypeScript (strict) — web + shared types
npm test             # Vitest suite (web)
npm run format       # Prettier write
npm run capture      # visual QA screenshots (headless Chrome)
```

### Live market data (Alpaca)

**Provider:** Alpaca Market Data API (multi-symbol `/v2/stocks/snapshots` +
US market clock). Credentials are server-side only — the browser never calls
Alpaca directly.

**Current coverage (live):**

- Market Pulse — `SPY QQQ IWM DIA`
- Sector Rotation — `XLK XLF XLE XLV XLI XLP XLY XLU XLB XLRE XLC`
- Header market status — open/closed state, next open/close, data freshness

**Current feed: `IEX` on Alpaca Basic by default.** IEX is a real-time single
exchange feed, **not** the full consolidated SIP market feed. The UI labels
live modules as `LIVE · IEX` so this provenance is always visible.

Setup:

1. Create a free Alpaca account and generate an API key pair.
2. Copy `.env.example` → `.env.local`:
   ```bash
   cp .env.example .env.local
   ```
3. Fill in the credentials and enable live mode:
   ```bash
   ALPACA_API_KEY_ID=your_key_id
   ALPACA_API_SECRET_KEY=your_secret
   MARKET_DATA_MODE=live
   ```
4. Start the app: `npm run dev`.

To return to demo fixtures, set `MARKET_DATA_MODE=demo` (or remove the value).
Demo mode needs no credentials and never makes network calls.

While live: the dashboard polls `GET /api/market/overview` every ~30s (paused
when the tab is hidden). The server deduplicates concurrent requests and caches
the Alpaca response for ~15s in memory. If the provider fails, modules show
**Market data unavailable** — demo numbers are never substituted for failed
live data.

### Live macro data (FRED + Twelve Data + Alpaca)

Macro Pulse is independent of the equities mode. Setup:

1. Add a **FRED** API key (`https://fred.stlouisfed.org/docs/api/api_key.html`)
   and a **Twelve Data** API key (`https://twelvedata.com`).
2. In `.env.local`:
   ```bash
   FRED_API_KEY=your_fred_key
   TWELVE_DATA_API_KEY=your_twelve_key
   MACRO_DATA_MODE=live
   ```
3. BTC/USD reuses the same `ALPACA_API_KEY_ID` / `ALPACA_API_SECRET_KEY`.
4. Restart the app.

Modes are independent — you can run equities live + macro demo, or both live.

**Freshness differs per source** (the UI never calls it all "real-time"):

- FRED is a **daily** feed — stale is **business-day aware**: a Friday
  observation stays fresh across the weekend and is only stale once more than
  2 expected US business-day observations are missing (weekends and US market
  holidays are not counted as missing days).
- Twelve Data is **intraday** — tighter freshness (default 15 min).
- BTC via Alpaca is **real-time, 24/7** — tight freshness (default 5 min),
  never tied to the US equity open.

The dashboard polls `GET /api/macro/overview` every ~60s; the server caches per
source (FRED 15 min, Twelve 60s, BTC 30s) so upstream call volume stays low.
If one provider fails, only its signals show unavailable — the others keep
live data. Demo values are never substituted for failed live macro signals.

### Analytics (FastAPI)

```bash
cd services/analytics
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn app.main:app --reload --port 8000
```

```bash
curl http://localhost:8000/health
# {"status":"ok","service":"market-war-room-analytics"}
```

## Design language

Soft Sakura Finance — see [docs/design.md](docs/design.md) for the full token
set. Essentials:

- Page `#FFF8FB`, surfaces white, pastel Sakura `#FFF3F7..#FBE8F0`
- Primary ink `#4A3A4C`, brand pink `#C15C82`, accent `#D86E95`
- Inter everywhere; financial figures in **tabular numerals**
- Restrained shadows, hairline pink-gray borders, rounded-but-not-childish cards
- Floral decoration used sparingly (brand, regime, brief, ask, corner accents)

## Data disclosure

- **Demo mode** renders typed fixtures only, labeled with a global
  **DESIGN PREVIEW** banner and per-module `DEMO` tags.
- **Live mode** labels exactly what is live:
  - Market Pulse + Sector Rotation → `LIVE · IEX` (Alpaca, IEX feed — not the
    consolidated SIP feed)
  - Macro Pulse → **MACRO DATA · Multi-source** section tag, with **per-cell
    provenance** (`FRED · Daily`, `Twelve Data · Live`, `Alpaca · Live`). A
    daily FRED observation is never labeled real-time.
  - Header status → from the Alpaca clock.
  - All other modules stay marked `DEMO` / `DESIGN PREVIEW` / `Preview`.
- Numbers are market data, not investment advice.

## Tech stack

Next.js (App Router) · TypeScript (strict) · Tailwind CSS v4 · Vitest +
Testing Library · ESLint 9 (flat config) · Prettier · FastAPI (Python).

## Contributing

See [docs/architecture.md](docs/architecture.md) for data-flow and component
architecture, and [docs/roadmap.md](docs/roadmap.md) for the phase plan.
