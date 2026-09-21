# Ticker Intelligence UI (V1.2C)

On-demand, verified research for **one supported US equity**, rendered inside the
Markets workspace. V1.2C is a UI layer over the accepted V1.2A backend
(`ticker-context-v1`); it adds no new market-data backend, no scoring and no LLM
call.

## 1. User workflow

1. Open `/markets` → section **Ticker Intelligence** (section 3, directly after
   Sector Rotation).
2. Type a symbol (or press one of the example chips `NVDA`, `TSLA`, `AAPL`,
   `AMD`) and press **Enter** or **Research**.
3. The browser calls `GET /api/intelligence/ticker?symbol=<SYMBOL>` exactly once
   per submit — never on keystroke, never on a timer (V1.2C has no polling).
4. The result renders: verified identity → coverage notices → metric cards →
   provenance strip → Company Evidence + evidence facts.
5. Nothing is fetched until a submit, and no demo value is ever substituted on
   failure.

Example chips are shortcuts only. They do **not** define provider eligibility —
any symbol the provider security directory accepts can be researched.

## 2. Supported-security scope

- Supported: **active, tradable `us_equity`** securities known to the Alpaca
  security directory (`alpaca-assets-v1`).
- Rejected with an explicit state: unknown symbols (`404 UNKNOWN_SYMBOL`),
  crypto/OTC/inactive/unlisted assets (`422 UNSUPPORTED_SECURITY_TYPE`).
- Research is **not** restricted to the anomaly Top 8, the S&P 500/Nasdaq 100
  universes or any watchlist.
- Client-side validation mirrors the API rule (1–10 chars, starts with a letter,
  letters/digits/`.`/`-`); the server stays authoritative.

## 3. API contract

`GET /api/intelligence/ticker?symbol=NVDA` → `Cache-Control: no-store`.

- **200** `{ mode, status: "ok" | "partial" | "insufficient_data", symbol, context }`
- **404** `{ mode, status: "unsupported_symbol", reason: "unknown_symbol", error }`
- **422** `{ mode, status: "unsupported_symbol", reason: "unsupported_security_type", error }`
- **503** `{ mode, status: "unavailable", reason: "provider_unavailable" | "live_data_required", error }`
- **400** `{ error: { code: "MALFORMED_QUERY" | "INVALID_SYMBOL" } }`

`context` keeps the V1.2A safe projection (identity, timestamps, session,
sources, availability, confidence, `factCount`, `facts`, `fingerprint`) and adds
the **V1.2C additive `summary`** (`ticker-summary-v1`).

### 3.1 Additive summary DTO (`lib/ticker-context/summary.ts`)

The V1.2A projection deliberately exposes fact **text** plus metadata only, so
the UI cannot render metric cards without scraping prose. `summary` therefore
copies already-computed, deterministic `ticker-context-v1` values into a typed,
strictly allowlisted DTO:

| Field                                                    | Unit / meaning                                             |
| -------------------------------------------------------- | ---------------------------------------------------------- |
| `price.value`                                            | USD — regular-session reference price                      |
| `price.previousClose`                                    | USD — previous regular-session close                       |
| `price.changePct`                                        | percent (2dp)                                              |
| `price.direction`                                        | `advancer` \| `decliner` \| `unchanged` \| `unavailable`   |
| `price.sessionDate`                                      | ET session date `YYYY-MM-DD`                               |
| `price.feed`, `price.delayMinutes`                       | `delayed_sip`, entitlement delay                           |
| `quote.tradePrice`, `quote.tradeTimestamp`               | latest trade (may include extended hours)                  |
| `volume.sessionVolume`                                   | shares in the session of the price evidence                |
| `volume.avgVolume20`                                     | shares — mean of the last 20 completed sessions            |
| `volume.relativeVolume`                                  | multiple (2dp) — **completed sessions only**               |
| `volume.partialSessionVolumePctOfAvg`                    | percent of average, **in-session only**                    |
| `volume.sessionCompleted`                                | boolean                                                    |
| `volatility.returnVol20Pct`                              | percent — sample σ of ≤20 completed close-to-close returns |
| `volatility.latestMoveSigma`                             | `                                                          | changePct | / max(returnVol20Pct, floor)` — a magnitude, **not** an anomaly-v1 score |
| `volatility.historySessionCount`, `windowSessions`       | completed sessions available / window size                 |
| `range.prior20Low`, `range.prior20High`                  | USD                                                        |
| `range.rangePositionPct`                                 | percent — `(price − low) / (high − low) × 100`             |
| `sector.name`, `sector.benchmarkTicker`                  | verified classification + canonical ETF                    |
| `sector.benchmarkChangePct`                              | percent — same delayed-SIP observation                     |
| `sector.classificationSource`                            | e.g. `sp500-v1`                                            |
| `events.status`                                          | `candidates` \| `none` (no clear catalyst)                 |
| `events.newsCount` / `secCount` / `corporateActionCount` | counts in the evidence window                              |
| `events.window`                                          | `{ startIso, cutoffIso }`                                  |
| `events.news[]`                                          | headline, source, publishedAt, category, specificity       |
| `events.filings[]`                                       | form, formLabel, filedAt                                   |
| `events.corporateActions[]`                              | type, date, description                                    |

Guarantees (covered by `tests/ticker-summary-contract.test.ts`):

- values are **copied verbatim** from the sealed pipeline — no recomputation, no
  rounding in the client, no new arithmetic anywhere;
- missing evidence ⇒ `null` block/field, never `0` and never a substitute;
- `TickerEvidenceFact.data` is still never serialized (`newsId`, `url`,
  `filingUrl`, `barTimestamp`, `cik`, credentials stay server-side);
- fact text and the `ticker-context-v1` fingerprint are unchanged;
- existing consumers keep working (the DTO is additive).

## 4. Data provenance

| Domain                     | Provider / version                                                 | Cache TTL (server) |
| -------------------------- | ------------------------------------------------------------------ | ------------------ |
| Security identity          | Alpaca assets (`alpaca-assets-v1`)                                 | 24 h               |
| Snapshot / reference price | Alpaca delayed SIP (`alpaca-delayed-sip-v1`)                       | 60 s               |
| Daily history              | Alpaca SIP daily bars (`alpaca-sip-daily-v1`, split-adjusted)      | 30 min             |
| Metrics                    | `ticker-metrics-v1` (over `anomaly-v1` history eligibility)        | with history       |
| Sector classification      | S&P 500 / Nasdaq 100 universe mapping (`sp500-v1`, `nasdaq100-v1`) | static             |
| News                       | Alpaca news (`alpaca-news-v1`)                                     | 60 s               |
| SEC filings                | SEC EDGAR submissions (`sec-edgar-submissions-v1`)                 | 10 min             |
| Corporate actions          | Alpaca corporate actions (`alpaca-corporate-actions-v1`)           | 10 min             |

Provider calls per lookup are bounded (≈8 cold, 0–3 warm) and documented in
`lib/ticker-context/production-service.ts`. **No provider SDK or credential is
ever present in the browser bundle** — the UI only calls the local route.

## 5. Session and freshness semantics

- The price shown is the **regular-session reference price** for the session the
  evidence describes. Delayed SIP is always labeled delayed (`Delayed SIP 15m
behind`); it is never called live.
- After-hours prints are never used as the regular-session close. When the
  market is open, the latest trade appears in a separate **Latest trade** card
  explicitly marked as possibly including extended-hours activity.
- `session.phase` distinguishes `regular` (in progress) from `closed`
  (completed session); the UI therefore says _“completed session”_ when the
  market is closed instead of implying an intraday move.
- Volume keeps the sealed distinction: `relativeVolume` exists only for a
  **completed** session; an in-session figure is reported as
  `partialSessionVolumePctOfAvg` (“participation so far”) and is never shown as a
  comparable multiple.
- Timestamps are explicit: `effectiveAsOf` (price evidence) and `sessionDate`
  (ET) are shown as market timestamps, while `requestedAt` / `generatedAt` are
  labeled **orchestration instants** so request time cannot be mistaken for the
  price timestamp. `providerAsOf`/`marketSessionAsOf` come from the same
  response; no ambient browser locale is used (ET formatting via
  `Intl.DateTimeFormat(..., { timeZone: "America/New_York" })`).

## 6. Event evidence vs causation

News, SEC filings and corporate actions are **unpromoted contextual candidates**.
The UI states this explicitly:

- no clear candidates → _“No clear company-specific catalyst identified for
  `<SYM>` in the evidence window …”_;
- candidates present → _“Unpromoted company-specific candidate events … These are
  contextual candidates, not a proven cause of the price move.”_

Wording such as “Why NVDA rose”, “confirmed cause” or a promoted strong catalyst
is never generated. A `context_only` media mention is labeled “Contextual
mention” and kept distinct from “Company-specific” news. **Source links are
omitted in V1.2C**: the V1.2A safe projection does not expose verified URLs, and
URLs are never re-constructed from headlines.

## 7. Error and partial states

| State                     | Trigger                       | UI                                                            |
| ------------------------- | ----------------------------- | ------------------------------------------------------------- |
| IDLE                      | no submit yet                 | form + scope description                                      |
| LOADING                   | request in flight             | “Researching `<SYM>`…” status (busy form)                     |
| OK                        | `status: "ok"`                | full available research                                       |
| PARTIAL                   | `status: "partial"`           | research + “Partial data … Unavailable in this snapshot: …”   |
| INSUFFICIENT_DATA         | `status: "insufficient_data"` | identity + honest unavailable metrics + reason                |
| INVALID_SYMBOL            | client validation             | “That symbol cannot be researched”                            |
| UNKNOWN_SYMBOL            | `404`                         | “No supported equity found for this symbol.”                  |
| UNSUPPORTED_SECURITY_TYPE | `422`                         | “This security type is not supported by Ticker Intelligence.” |
| UNAVAILABLE               | `503`/network                 | “Ticker research temporarily unavailable.” + **Retry**        |

Failure states never show the previous ticker’s identity or metrics: a new submit
clears the payload, and stale responses are dropped by request id.

## 8. Global evidence isolation

- Ticker facts live **only** inside the current research result. They are never
  merged into the global `BriefContext`, the `/intelligence` Evidence Explorer,
  the AI Market Brief, `anomaly-v1` or `catalyst-match-v1`.
- No LLM request is made by this feature: `tests/ticker-intelligence-boundaries`
  asserts the only request is `/api/intelligence/ticker?symbol=…`.
- Ask Sakura keeps its own independent on-demand ticker workflow (server-side
  `researchTicker` inside `lib/ask-sakura/production-service.ts`); V1.2C did not
  modify it.

## 9. Files

- `lib/ticker-context/summary.ts` — additive `ticker-summary-v1` DTO + allowlist
- `lib/ticker-context/api-types.ts` — `summary` added to `SafeTickerContext`
- `features/markets/useTickerResearch.ts` — request lifecycle hook
- `components/TickerIntelligence.tsx` — section, search form, states, provenance
- `components/TickerIntelligenceMetrics.tsx` — metric cards
- `components/TickerIntelligenceEvidence.tsx` — Company Evidence + facts panel
- `features/markets/MarketsWorkspace.tsx` — Markets section slot (one instance)
- Tests: `ticker-summary-contract`, `use-ticker-research`,
  `ticker-intelligence`, `ticker-intelligence-boundaries`

## 10. Known limitations (V1.2C)

- No source links (see §6).
- Sector comparison is only available for symbols classified by the S&P 500 /
  Nasdaq 100 universe mapping; other supported equities show “Sector comparison
  unavailable.” (never a guessed GICS sector).
- One symbol per lookup; no comparison, no history charts, no multi-turn chat.
- Live research requires `TICKER_RESEARCH_MODE=live` with live market-data
  credentials; otherwise the route returns `503 live_data_required` and the UI
  shows the UNAVAILABLE state (no demo substitution).
