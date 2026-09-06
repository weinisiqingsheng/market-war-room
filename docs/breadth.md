# Phase 4 — Live S&P 500 Market Breadth

Deterministic S&P 500 constituent breadth from **Alpaca delayed-SIP** data
(15-minute delay on the current Basic entitlement). Breadth is a Next.js
domain-data transformation — no Python dependency — and is engine-versioned
`breadth-v1`. It does NOT feed regime-v1 (a future regime-v2 integration is
documented below, not built).

## Why S&P 500

Breadth is measured over the S&P 500 — the benchmark behind the Market Pulse
index set (SPY). The constituent list is **version-controlled and static**
(`apps/web/lib/breadth/universe/sp500.ts`, `sp500-v1`) and is never scraped at
runtime. The index contains **503 symbols** because several companies list
multiple share classes (e.g. BRK.B) — the canonical list is preserved as-is
rather than force-rounded to 500.

## Delayed-SIP vs IEX — never merge the two

| Module         | Feed        | Disclosure                  |
| -------------- | ----------- | --------------------------- |
| Market Pulse   | IEX         | `LIVE · IEX`                |
| Market Breadth | delayed SIP | `S&P 500 · 15m Delayed SIP` |

Breadth is NOT full-market breadth, NOT real-time consolidated SIP breadth, and
is never labeled LIVE without the `15M DELAYED SIP` qualifier. Symbols with a
dotted share class (BRK.B) map through `lib/breadth/symbols.ts` so punctuation
handling is never scattered through code.

## Current session (delayed-SIP snapshots)

- `GET /v2/stocks/snapshots?feed=delayed_sip`, multi-symbol in batches (no
  ~500 individual requests). ~60s server cache.
- Conservative reference price: during the regular session → session daily-bar
  close; after the close → the regular-session close (after-hours/overnight
  latest trades are never used).
- Classification: `|changePct| > 0.001%` → advancer/decliner; otherwise
  unchanged. Missing names are never classified as unchanged.

## Historical (SMA20/SMA50 + 20D range)

- Multi-symbol `GET /v2/stocks/bars` (1Day, feed=sip, paginated, batched).
  On Basic, `end` is set safely **before the restricted recent ~15-minute SIP
  window**.
- The currently-forming session is excluded; SMA windows use only completed
  closes. History is cached ~30 min and never refetched on every client poll.

## Score formula (breadth-v1)

Weights: advance participation 35% · % above 20D MA 25% · % above 50D MA 25% ·
new-high/low balance 15%. Sub-scores use piecewise-linear maps (all in
`lib/breadth/constants.ts`); new-high/low balance is neutral 50 when both are
zero, otherwise `highs/(highs+lows)` linear 0→100. Components are renormalized
over available data; missing data never becomes neutral.

## Participation states (deterministic, order matters)

- SPY up & advanceRatio ≥ 0.60 & above20Pct ≥ 0.55 → **Broad Rally**
- SPY up & advanceRatio < 0.45 → **Narrow Rally**
- SPY down & advanceRatio ≤ 0.40 → **Broad Selloff**
- SPY down & advanceRatio > 0.55 → **Internal Resilience**
- otherwise → **Mixed Participation**

## Coverage / confidence

`coveragePct = currentCoverageCount / universeCount`. Confidence: ≥95% high ·
≥85% medium · ≥70% low · <70% insufficient (score `null` when insufficient).
Coverage counters for current / historical-20 / historical-50 are exposed.

## Known limitations

- Universe is the static S&P 500 constituent snapshot (`sp500-v1`); no daily
  index-adjustment feed → survivorship/constituent drift between regenerations.
- Delayed-SIP = 15-minute delayed consolidated tape; breadth is a snapshot in
  time, not real-time.
- The current-session close is compared to MA/range windows ending the prior
  completed session (conservative; after the close the just-completed session
  is not folded into the average yet).
- Deterministic heuristic — no regime-v1 integration yet. Future integration
  would be a documented regime-v2 input, never a silent change to regime-v1.
