# Markets Workspace (V1.1A)

## Purpose — Overview vs Markets

- **Overview** (`/`) answers “What is the market trading today?” — regime,
  pulse, catalysts and the grounded Sakura AI Market Brief.
- **Markets** (`/markets`) answers “What are the actual market numbers?” — a
  deterministic, data-first workspace for indexes, sector rotation, macro
  conditions, S&P 500 breadth and abnormal movers.

Markets is deliberately NOT a copy of Overview:

|                                | Overview        | Markets                   |
| ------------------------------ | --------------- | ------------------------- |
| Regime narrative               | ✅              | —                         |
| AI Market Brief                | ✅              | —                         |
| Ask War Room                   | ✅              | —                         |
| Catalyst Intelligence          | ✅              | teaser/deferred only      |
| Major Indexes / Sector / Macro | summary context | dense workspace           |
| Breadth + Anomalies            | context cards   | large standalone sections |

## Routes and navigation

- `Overview` → `/`
- `Markets` → `/markets` (activated in V1.1A; uses real `next/link`)
- `Intelligence` → remains disabled with the existing future-phase tooltip

Active route styling is route-aware (`usePathname`): Overview is the filled
pill on `/`, Markets is the filled pill on `/markets`. A compact mobile nav row
below `md` keeps both routes reachable at ~390px.

## Reused data / engines

The Markets page creates no new domain APIs and no new scoring engines. It
calls the canonical client hooks once per domain and shares the result across
all sections (one fetch per endpoint):

- **Major Indexes** — `useMarketOverview` → `GET /api/market/overview`
  (SPY / QQQ / IWM / DIA), rendered with the existing `MarketPulse`/
  `MarketIndexCard` presentation (`title="Major Indexes"` override only).
- **Sector Rotation** — the same market overview's sector array, rendered with
  the existing `SectorRotation`/`SectorRow` (11 sector ETFs, relative return vs
  SPY). No sector scores are recalculated.
- **Macro Dashboard** — `useMacroOverview` → `GET /api/macro/overview`,
  rendered with `MacroPulse`/`MacroSignalCard` (VIX, US 10Y, Broad USD, WTI,
  Gold, BTC).
- **Market Breadth** — `useBreadthOverview` → `GET /api/breadth/overview`,
  breadth-v1 output shown as-is (score, state, advance ratio, % above 20D/50D,
  new 20D highs/lows, coverage).
- **Market Anomalies** — `useAnomaliesOverview` →
  `GET /api/anomalies/overview`, anomaly-v1 ranking shown as-is (ticker, move,
  score, severity, primary trigger). No client reranking.

## Anomaly universe

- Universe: **S&P 500** — the count shown comes from the API response
  (`overview.universe.count` / `overview.universeCount`), never a hard-coded
  “503”. The section copy makes clear the scanner evaluates the whole S&P 500
  dynamically and is not a fixed LULU/FICO watchlist.
- No Nasdaq-100 / Russell / all-US expansion in V1.1A. A universe selector is
  **explicitly deferred** (planned V1.1E); the label structure only prepares
  the UI for one.

## Feed semantics and freshness

- Equities: `LIVE · IEX` (Alpaca IEX, not consolidated SIP).
- Breadth and Anomalies: `15M DELAYED SIP` — never labeled LIVE.
- Macro: multi-source cadence (FRED daily, Twelve Data intraday, Alpaca
  real-time BTC). FRED daily observations are never presented as realtime.
- Stale is a freshness warning, never a directional market opinion.
- When a domain fails, only its section renders unavailable; indexes, sectors
  and macro continue independently. No live → demo fallback.

## No AI reasoning on Markets

The Markets page never calls `/api/ai/market-brief`, never renders the AI card
and contains no LLM/client reasoning. It is deterministic and data-first; AI
narrative stays on Overview and later Intelligence.

## Files

- `app/markets/page.tsx` — server route (mode reads + `force-dynamic`).
- `features/markets/MarketsDashboard.tsx` — shared page shell/header/nav,
  owns the hooks once.
- `features/markets/MarketsWorkspace.tsx` — pure section assembly.
- `components/Header.tsx` — route-aware active pill + mobile nav.
- `data/demo-market.ts` — shared nav definition (Markets enabled).
