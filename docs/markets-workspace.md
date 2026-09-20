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
- `Intelligence` → `/intelligence` (activated in V1.1B)

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
  `GET /api/anomalies/overview?universe=<id>`, anomaly-v1 ranking shown as-is
  (ticker, move, score, severity, primary trigger). No client reranking.

## Anomaly universe selector (V1.1E)

The Markets anomaly section scans one of two versioned universes:

| Selector              | API query             | Definition                                           |
| --------------------- | --------------------- | ---------------------------------------------------- |
| **S&P 500** (default) | `?universe=sp500`     | canonical `sp500-v1` snapshot (reused, never copied) |
| **Nasdaq 100**        | `?universe=nasdaq100` | `nasdaq100-v1` offline snapshot (101 securities)     |

- **Markets-only scope.** The selection lives in `MarketsDashboard` local React
  state. It is not global, not persisted (no browser storage, no cookie, no
  server session) and never reaches Overview, Intelligence, Catalyst
  Intelligence, BriefContext, the AI Market Brief, the Evidence Explorer or
  Ask Sakura — those stay on the canonical S&P 500 universe.
- **Membership only, not scoring.** Universe selection changes the candidate
  set. `anomaly-v1` keeps identical weights (Return Shock 35% · Sector
  Divergence 20% · Gap Shock 15% · Range Expansion 15% · Volume Participation
  10% · Breakout/Breakdown 5%), severity thresholds, ranking and missing-data
  handling for both universes. One engine, no second scanner.
- **Score invariance for overlapping symbols.** A symbol in both universes
  reuses the canonical S&P 500 GICS sector, so identical market-data inputs
  produce identical metrics, components and score in either universe. Only its
  rank can differ (different candidate pool). A score change caused solely by
  universe selection is treated as a semantic regression.
- **API contract.** Missing `?universe=` → `sp500` (backward compatible).
  Explicit `?universe=sp500` / `?universe=nasdaq100` selects that universe.
  Any other explicit value (including an empty value) is rejected with a safe
  `400 { error: { code: "INVALID_UNIVERSE" } }` — never silently mapped to
  S&P 500. Responses add `universe.id`, `universe.label` and `universeCount`
  while preserving all existing fields, so Overview/Intelligence/Catalysts/AI
  context consumers are unaffected.
- **Loading and race safety.** Switching shows a local loading state inside the
  anomaly section only (Market Indexes, Sector Rotation, Macro and Breadth are
  untouched). Requests carry a request-id + abort guard, so a slow Nasdaq 100
  response can never overwrite the current S&P 500 selection. Live failures
  show the local unavailable state — there is no demo substitution.

### Nasdaq 100 membership provenance

- Source: `https://en.wikipedia.org/wiki/List_of_NASDAQ-100_companies` (raw
  wikitext), retrieved **2026-09-20**. The page mirrors the official Nasdaq-100
  constituent list and carries the index provider's ICB industry column.
- Offline snapshot: `lib/anomalies/universe/nasdaq100.ts`, generated by
  `scripts/generate-nasdaq100-universe.mjs` — never scraped at runtime.
- Normalization: tickers uppercased/trimmed; wiki markup stripped from names;
  share classes kept as separate securities (101 securities — GOOGL + GOOG
  share one company); `count` is derived from the snapshot, never hard-coded
  to 100.
- Sectors: overlapping symbols reuse the canonical S&P 500 GICS sector;
  the remaining 15 symbols are normalized from the source's own ICB industry
  via the documented ICB→GICS table in the generator (ICB and GICS are
  different taxonomies — recorded as a known limitation).
- Update procedure: re-run the generator, review the diff (membership, count,
  `asOf`) and bump `NASDAQ100_UNIVERSE_VERSION` when membership changes.

### Demo mode

`ANOMALIES_MODE=demo` serves a deterministic, clearly-labeled demo fixture per
universe (membership-filtered, derived counts). It demonstrates the selector
without provider calls and is never substituted for a failed live response.

> Intelligence (`/intelligence`) is a separate analyst workspace — see
> [docs/intelligence-workspace.md](intelligence-workspace.md).

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
- `components/AnomalyUniverseSelector.tsx` — Markets-only universe pills.
- `components/Header.tsx` — route-aware active pill + mobile nav.
- `data/demo-market.ts` — shared nav definition (Markets enabled).
- `lib/anomalies/universe/` — versioned universe contract + `sp500` adapter +
  `nasdaq100` snapshot + registry (`registry.ts` is the single id→definition
  source; default `sp500`).
- `scripts/generate-nasdaq100-universe.mjs` — offline snapshot generator.
