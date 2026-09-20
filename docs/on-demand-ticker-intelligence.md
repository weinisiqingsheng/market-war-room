# On-Demand Ticker Intelligence (V1.2A)

`ticker-context-v1` answers **"what verified current evidence can we collect
about this particular stock?"** for a supported US equity — even when the symbol
is absent from the current anomaly Top 8, the S&P 500 universe and the Nasdaq
100 universe.

It does **not** answer "will this stock rise?" — no predictions, no buy/sell
decisions, no portfolio analysis, and no new anomaly scoring algorithm.
`anomaly-v1` remains the only anomaly scorer. Ask Sakura integration is
deliberately deferred to V1.2B.

## Reused architecture (no duplicate provider stack)

| Concern                             | Reused implementation                                                                   |
| ----------------------------------- | --------------------------------------------------------------------------------------- |
| Credentials / env                   | `lib/market-data/config.ts` (`getMarketDataConfig`)                                     |
| HTTP + auth + timeout + safe errors | `lib/market-data/providers/alpaca-http.ts`, `MarketDataError`                           |
| Market clock                        | `fetchMarketClock` (`lib/breadth/provider.ts`)                                          |
| Current session data                | `fetchAllSnapshots` (delayed-SIP), `normalizeBreadthSymbol`                             |
| History                             | `fetchAllDailyBars` (`1Day`, `feed=sip`, `adjustment=split`), `computeAnomalyHistory`   |
| Session/date semantics              | `lib/breadth/dates.ts` (`barSessionDate`, `etSessionCloseIso`, `previousETWeekday`)     |
| News                                | `fetchAlpacaNews`, `dedupeArticles`, `extractCandidateEvidence` (candidate specificity) |
| Event categorisation                | `classifyNews`, `classifySecForm`/`secFormLabel` (deterministic keyword rules)          |
| SEC                                 | `fetchSecSubmissions` + SEC `company_tickers.json` directory (cached 24h)               |
| Corporate actions                   | `fetchCorporateActions`                                                                 |
| Sector benchmark                    | canonical GICS sectors from `sp500-v1` / `nasdaq100-v1` + `GICS_TO_SPDR`                |
| Caching                             | `withBreadthCache` (in-memory TTL + in-flight dedup, no Redis/queues)                   |
| Confidence/limits conventions       | `confidenceLabel`, `canonicalizeJson`, `no-store` responses                             |

Sealed and untouched: `brief-context-v1`, `anomaly-v1`, `catalyst-match-v1`,
`ask-sakura-v1`, the Evidence Explorer and the AI Market Brief.

## Supported securities & symbol validation

- The **provider security directory** (Alpaca `GET /v2/assets/{symbol}`) decides
  support — never the market-wide Evidence Pack, the anomaly Top 8, or the
  universe snapshots.
- Accepted: `active`, `tradable`, `class = us_equity`.
- Rejected explicitly: unknown symbols (404 `UNKNOWN_SYMBOL`), non-equity /
  inactive / non-tradable symbols (422 `UNSUPPORTED_SECURITY_TYPE`).
- Normalization: trim + uppercase; share-class aliases (`BRK-B` → `BRK.B`) go
  through `canonicalToAlpaca`, the single conversion point.
- **No silent substitution:** if the directory resolves to a different symbol
  than requested, the request fails (`unavailable`) rather than returning
  another company's evidence.

## Data feeds, semantics and limitations

- Prices/volumes: Alpaca **delayed SIP**, 15 minutes behind — never labeled
  IEX/live.
- History: **SIP daily bars**, split-adjusted, current forming session excluded.
- The regular-session **reference price** follows the sealed breadth rule
  (`normalizeBreadthSymbol`): the session daily close, and after-hours/overnight
  trades are never used as that price. During an open session a separate
  `ticker.<S>.quote` fact may report the latest trade and says explicitly that it
  may include extended-hours prints.
- Timestamps are distinct and never conflated:
  `requestedAt`/`generatedAt` (orchestration, excluded from the fingerprint),
  `providerAsOf` (newest provider observation), `marketSessionAsOf` (ET session
  date), `effectiveAsOf` (price instant the evidence describes).
- A Friday close requested on a Saturday is reported as "session 2026-09-18 ET",
  never as "today".

## Deterministic metrics

Centralized in `lib/ticker-context/metrics.ts` (`ticker-metrics-v1`):

| Metric                         | Formula / window                                                                             |
| ------------------------------ | -------------------------------------------------------------------------------------------- |
| `returnVol20Pct`               | sample σ (ddof=1) of the last 20 close-to-close % returns, completed split-adjusted sessions |
| `latestMoveSigma`              | `                                                                                            | dailyChangePct | / max(returnVol20Pct, 0.5%)` — statistical magnitude only |
| `avgVolume20`                  | mean volume of 20 completed sessions                                                         |
| `relativeVolume`               | completed-session volume / `avgVolume20` (only for a completed regular session)              |
| `partialSessionVolumePctOfAvg` | in-session volume / `avgVolume20` as a percentage, explicitly **not** a comparable multiple  |
| `rangePositionPct`             | `(price − prior20Low) / (prior20High − prior20Low) × 100`                                    |

Volatility is only reported when the sealed anomaly-v1 eligibility rule holds
(≥21 completed sessions ⇒ ≥20 returns). Missing inputs propagate as `null` —
never `0`, never an unrelated benchmark; zero/negative denominators and
degenerate ranges are guarded.

## Sector context

The stock is compared with its canonical sector ETF (`GICS_TO_SPDR`) only when a
verified GICS classification exists in `sp500-v1` or `nasdaq100-v1`. Otherwise
the sector fact is omitted entirely and no sector-relative claim is made.

## Event evidence vs causation

- Company events reuse Alpaca news, SEC submissions and corporate actions.
- Articles must actually mention the company (`extractCandidateEvidence`
  specificity) — unrelated-company roundups are excluded.
- Events must fall inside the deterministic window
  `[previous regular close, effective price time]`; post-cutoff events (e.g.
  news published after the priced session) are excluded.
- Events are **unpromoted contextual candidates**: never labeled a strong
  catalyst and never a proven cause of the price move. "No clear
  company-specific catalyst identified" is a valid, expected result.

## Confidence

Weights: price 0.30 · history 0.20 · volume 0.10 · sector 0.10 · news 0.15 ·
SEC 0.15. Each domain contributes `weight × freshness factor` (fresh 1.0,
delayed 0.95, stale 0.75, unavailable 0) when available. Labels reuse the
established thresholds (≥0.90 high, ≥0.75 medium, ≥0.60 low, else
insufficient). Freshness affects confidence only — never market direction.

## Safe evidence contract

- Fact ids: `ticker.<SYMBOL>.<domain>[.n]` (e.g. `ticker.NVDA.price`,
  `ticker.NVDA.news.1`, `ticker.NVDA.sec.1`, `ticker.NVDA.catalyst`).
- Internal `data` (numbers, provider ids, URLs) stays server-side; the public
  projection exposes only `id/domain/text/asOf/freshness/confidence/sourceVersion`
  plus context metadata — no raw provider payloads, no secret headers, and no
  full news/filing bodies (headlines and filing links only).
- Fingerprint: SHA-256 over canonicalized material evidence (facts sorted by id,
  sorted object keys). Identical evidence ⇒ identical digest; material changes ⇒
  new digest; `requestedAt`/`generatedAt` are excluded because orchestration
  time alone must not invalidate evidence. The BriefContext fingerprint
  algorithm is untouched.

## API

### `GET /api/intelligence/ticker?symbol=NVDA`

| Case                                   | HTTP | Body highlights                                              |
| -------------------------------------- | ---- | ------------------------------------------------------------ |
| Supported, full provider coverage      | 200  | `status:"ok"`, `context` (safe projection)                   |
| Supported, some providers degraded     | 200  | `status:"partial"`, `availability` flags                     |
| Supported, no price **and** no history | 200  | `status:"insufficient_data"`                                 |
| Symbol unknown                         | 404  | `status:"unsupported_symbol"`, `error.code:"UNKNOWN_SYMBOL"` |
| Symbol exists, not a supported equity  | 422  | `error.code:"UNSUPPORTED_SECURITY_TYPE"`                     |
| Providers/directory down               | 503  | `status:"unavailable"`, `error.code:"PROVIDER_UNAVAILABLE"`  |
| Malformed/duplicate/invalid `symbol`   | 400  | `error.code:"MALFORMED_QUERY"` / `"INVALID_SYMBOL"`          |
| `TICKER_RESEARCH_MODE` not `live`      | 503  | `status:"unavailable"`, `reason:"live_data_required"`        |

`Cache-Control: no-store` is deliberate: evidence is on-demand and
session-sensitive, is already cached server-side per provider TTL, and a shared
cache could serve mislabeled freshness to another consumer.

Mode: `TICKER_RESEARCH_MODE=live` enables real provider access (requires live
market data + Alpaca credentials). In demo mode the endpoint returns
`live_data_required` and never fabricates ticker values.

## Failure isolation

`partial` is the normal degradation: price works but SEC is unavailable, history
is short, or the sector is unclassified. The clock, snapshots, bars, news, SEC
and corporate-action providers settle independently; a total loss of price and
history yields `insufficient_data`; only a directory/provider outage yields
`unavailable`. Demo values are never substituted. No new LLM call is made.

## Resource limits (provider calls per ticker lookup)

- Cold: asset (1) + clock (1) + snapshots (1) + daily bars (1, ≤6 pages) + news
  (1, ≤3 pages) + SEC directory (1, amortized 24h) + SEC submissions (1) +
  corporate actions (1) ≈ **8 upstream calls**.
- Warm: 0–3 calls (clock 15s, snapshots 60s, news 60s; bars 30min, SEC 10min,
  directory/asset 24h).
- Max concurrency inside one lookup: 3 (news + CIK directory + actions).
- Lookback: 160 calendar days of daily bars (≈70 sessions) to guarantee ≥21
  completed sessions; news window is one session boundary; results capped at
  5 news, 5 filings, 3 corporate actions.

## Ask Sakura integration

Deferred to V1.2B. `POST /api/ai/ask-sakura`, `ask-sakura-v1`, the evidence
selector, the grounding validator and the Ask Sakura UI are unchanged by this
phase; the ticker endpoint works independently.
