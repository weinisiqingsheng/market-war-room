# Phase 6 — Catalyst Intelligence (catalyst-match-v1)

Grounded, deterministic matching of evidence to anomaly-v1 candidates.
No LLM. No causal claims. Version: `catalyst-match-v1`. Anomaly semantics
remain `anomaly-v1` (regular session, delayed-SIP 15 min).

## Data sources
- Alpaca News (`/v1beta1/news`) — delayed entitlement; UI shows timestamps,
  never "REALTIME NEWS". Reuses breadth/market-data HTTP + credentials.
- SEC EDGAR submissions (`https://data.sec.gov/submissions/CIK##########.json`)
  — declared `SEC_USER_AGENT` (config enforced), ≤3 concurrent company
  requests, cached 10 min per CIK. Missing UA → provider `disabled`.
- Alpaca Corporate Actions (`/v2/corporate_actions`) — supplemental; failures
  never block matching.

## Time alignment (mandatory)
Catalyst matches are anchored to the anomaly's **effective market-data time**,
never orchestration time. `generatedAt` (when the overview ran) is separate
from `effectiveAsOf` (price time). Closed market → `effectiveAsOf` is the
4:00 PM ET close of the completed regular session whose prices were scored
(from the actual scored bars — Saturday/Sunday/holiday-safe). Open market →
`effectiveAsOf` comes from real delayed-SIP provider timestamps and can never
be later than the price data used. `catalystCutoff = effectiveAsOf`; evidence
must satisfy `publishedAt <= catalystCutoff` (`inCatalystWindow`, inclusive).
The search starts at the regular-session close immediately preceding the
scored session, capturing post-close earnings, overnight/weekend filings, and
pre-market news. Evidence after the effective close (e.g. a Friday-evening
recap or Saturday article) never explains the Friday move.

## Candidate selection
Unique union of anomaly `topOverall`, `topPositive`, `topNegative`, ranked by
anomaly score, capped at 12. Offline universe metadata now includes `cik`
(via official SEC `company_tickers.json`, version-controlled).

## Normalization / dedup
News normalizes only: id, headline, summary, source, author, timestamps,
symbols, url. Dedup by provider article id, then normalized headline/url —
duplicates can never create false corroboration.

## Classification
Centralized taxonomy + keyword rules with explicit precedence
(EARNINGS, GUIDANCE, ANALYST ACTION, M&A / STRATEGIC, REGULATORY / LEGAL,
FINANCING / OFFERING, CAPITAL RETURN, PRODUCT / CONTRACT, MANAGEMENT,
CORPORATE ACTION, SEC FILING, MACRO / SECTOR, OTHER). Polarity only when
language is explicit (`upgraded`, `downgraded`, `raises guidance`,
`FDA approves`, …); otherwise `unknown`.

## Relevance (0–100)
25% symbol specificity · 25% temporal (2h/8h/24h/older) · 30% materiality ·
20% corroboration (official evidence + related news > 2+ distinct sources >
one specific article > single weak mention).
Evidence strength: ≥80 strong, ≥65 moderate, ≥50 weak; below 50 is not a
primary catalyst → item status `NO CLEAR CATALYST FOUND` (valid result —
a reason is never forced).

## Direction alignment
`aligned` / `divergent` / `unknown` is informational only; divergent matches
are never rejected.

## Partial failure
Each provider is isolated: news fail / SEC fail / corporate-actions fail /
all fail → Catalyst still builds from whatever evidence exists and reports
`meta.providers` status. Live mode has **no** demo fallback.

## Caching
News 60 s · SEC 10 min per CIK · corporate actions 10 min · result 60 s.
In-memory TTL + in-flight dedup. No DB, no Redis.

## API / UI
`GET /api/catalysts/overview` (`CATALYSTS_MODE=demo|live`; live requires
`ANOMALIES_MODE=live`). Demo returns an empty overview; the demo panel keeps
rendering the design fixtures. Live panel: per-anomaly card with
LIKELY CATALYST (primary) / related evidence (secondary), category, strength,
headline, source + timestamp, SEC/action evidence counts, and source links —
with degraded-provider notice. Copy uses "Likely / Possible catalyst /
Strong evidence match", never "caused".

## Known catalyst-match-v1 limitations
- SEC filings match only when their date is inside the window; an unrelated
  filing never becomes a strong catalyst on its own.
- News classification is keyword-based; rare multi-event days may
  under-classify or pick the higher-precedence event.
- Corporate actions endpoint availability depends on entitlement.
- Real-time news latency/entitlement is not assumed.
- Delayed-SIP asOf derives from the market-clock timestamp; snapshots can be
  older than real time, which the cutoff rule correctly respects.
