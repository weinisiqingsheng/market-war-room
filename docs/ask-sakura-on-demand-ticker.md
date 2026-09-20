# Ask Sakura — On-Demand Ticker Integration (V1.2B)

Ask Sakura can now answer **current-state** questions about a supported US
equity even when that ticker is absent from the anomaly Top 8, by researching it
on demand through the V1.2A `ticker-context-v1` service.

- Current-state evidence analysis only. **No forecasting**, no price targets,
  no predictions, no trading advice, no conversation memory, no streaming.
- Chinese localization is out of scope for this phase.

## Deterministic routing (no LLM involved)

`lib/ask-sakura/question-routing.ts` decides the evidence path _before_ the
model is called. DeepSeek is never used to recognise a ticker.

| Outcome           | When                                                               | Behaviour                                                                |
| ----------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| `GLOBAL_MARKET`   | symbol already present in the BriefContext, or no ticker candidate | existing V1.1C path, unchanged                                           |
| `TICKER_RESEARCH` | exactly one plausible symbol the global pack does not contain      | one on-demand `ticker-context-v1` lookup                                 |
| `AMBIGUOUS`       | two or more distinct unknown symbols                               | honest clarification; **no** LLM call, never silently picks or drops one |
| `OUT_OF_SCOPE`    | clearly non-market question (advisory hint)                        | existing prompt policy still produces the final `out_of_scope` answer    |

Ticker candidates are `$SYMBOL` (any case) or ALL-CAPS tokens of 2–10
characters. A documented high-precision stopword list prevents market acronyms
and common English/market words (WHY, USA, CPI, FOMC, AI, MARKET, BREADTH,
EARNINGS, …) from ever being treated as securities. Company names are **not**
mapped to tickers (no verified name→ticker mapping exists in the repository), so
name-only questions stay on the global path.

Routing is pure and cannot be overridden by prompt injection: instructions
inside the question are data, and the system prompt plus grounding validator
remain the authority.

## Supported ticker scope

Support comes from the V1.2A provider security directory (active, tradable,
`us_equity`). Unknown symbols → `insufficient_grounded_data` +
`reason: "unknown_symbol"`; unsupported types → `reason:
"unsupported_security_type"`. Neither ever falls back to generic global
evidence, and neither is answered from demo values.

`TICKER_RESEARCH_MODE=live` (plus live Alpaca credentials) is required; when it
is not set, ticker questions return `unavailable` with
`reason: "ticker_research_unavailable"` and no fabricated evidence.

## Evidence composition and budget

`lib/ask-sakura/ticker-evidence.ts` composes an Ask-only pack (BriefContext is
never mutated):

1. **All** ticker-context-v1 facts, verbatim (ids, text, timestamps, freshness,
   confidence, sourceVersion, internal `data`).
2. A deterministic compact global backdrop: `market.*` indices → the symbol's
   own `sector.<ETF>` fact → its own validated `anomaly.<SYM>` /
   `catalyst.<SYM>.primary|none` when present → `macro.*` (≤3) → `regime.*` (≤2)
   → `breadth.*` (≤2).

Bounds: `totalMax = 28` facts, `backdropMax = 8`. Ticker facts are **never**
dropped; when they already fill the budget the backdrop is omitted entirely and
recorded as `backdropOmitted`. Unrelated tickers' anomalies and catalysts are
always excluded, and no fake `anomaly.<SYM>` fact is ever created for a
researched ticker.

## Grounding

The grounding validator was extended additively (existing rules untouched):

- `ticker.<SYM>.*` facts now contribute symbols, so ticker-specific claims can
  be grounded — and `ticker.TSLA.price` is rejected as `UNKNOWN_EVIDENCE_REF`
  when only NVDA facts were selected.
- `TICKER_EVIDENCE_MISMATCH` — an answer discussing the researched ticker must
  cite that ticker's evidence, not only the global backdrop.
- `CONTEXT_ONLY_CATALYST_PROMOTION` — contextual `news`/`sec` items cannot be
  presented as the cause of a move when no validated `catalyst.*.primary` exists.
- `UNSUPPORTED_FORECAST` — asserted future prices, price targets, probabilities
  and "will rise/fall" language are rejected (negated phrasing such as "the
  evidence does not establish whether NVDA will rise next week" is allowed).
- `catalyst.FICO.primary` in an NVDA on-demand answer is rejected
  (`CROSS_TICKER_CATALYST_REF`), as is event attribution when the ticker's own
  pack reports `ticker.<SYM>.catalyst` status `none`
  (`NO_CLEAR_CATALYST_CONTRADICTION`).
- Numeric validation is unchanged: every number must appear in the text of the
  cited facts, so invented prices, percentages and volume multiples fail.

## Timing and source alignment

Global and ticker evidence may come from different effective instants; the
answer must not present them as one synchronized snapshot. Each fact keeps its
own `asOf`, `freshness`, `marketSessionAsOf`, `effectiveAsOf` and
`sourceVersion`; delayed SIP stays labeled delayed (never realtime), and a
previous-session price is never described as today's intraday price. The
response exposes this metadata via `research` (see below).

## Provider failure handling

| Situation                                                                 | Result                                                                                                                                               |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ticker price/history available, secondary providers down                  | `partial` research → answer generated with the available facts                                                                                       |
| Ticker research reports `insufficient_data` (no price **and** no history) | `insufficient_grounded_data`, `reason: "ticker_insufficient_evidence"`                                                                               |
| Provider outage / research throws                                         | `unavailable`, `reason: "ticker_research_unavailable"`                                                                                               |
| Unknown or unsupported symbol                                             | `insufficient_grounded_data` with the honest symbol reason                                                                                           |
| Global brief input confidence `insufficient`                              | global questions keep the existing gate; a verified ticker question is still answered from its own evidence, with per-fact freshness and limitations |

A ticker question is never answered from generic global evidence, and demo
values are never substituted in live mode.

## API compatibility

`POST /api/ai/ask-sakura` is unchanged: the request body is still exactly
`{ "question": "..." }` (extra fields such as `ticker`, `evidence`, `model` or
`provider` are rejected with `400 invalid_request`), research and evidence
selection happen server-side, and status conventions are preserved (`200`
generated/insufficient, `503` unavailable, `Cache-Control: no-store`).

Optional additive response metadata (safe, no raw provider data):

```json
{
  "route": "TICKER_RESEARCH",
  "research": {
    "requestedSymbol": "NVDA",
    "symbol": "NVDA",
    "status": "ok",
    "reason": null,
    "effectiveAsOf": "2026-09-18T20:00:00.000Z",
    "marketSessionAsOf": "2026-09-18",
    "freshness": "delayed",
    "confidence": "high",
    "factCount": 12,
    "researchVersion": "ticker-context-v1"
  }
}
```

Schema validation, the single repair attempt and the two-provider-call maximum
are unchanged; the repair uses the same question and the same composed evidence,
and no new market-data fetch happens during repair.

## UI

The existing Ask Sakura card is reused (no second section). Minimal additions:
the answer footer states when on-demand ticker research grounded the answer
(`On-demand ticker research · NVDA · session 2026-09-18 ET`, with
`partial evidence` when applicable), and the insufficient block adds a short,
honest sentence for the unknown/unsupported/ambiguous/insufficient cases.

## Deferred

- Forecasting, multi-turn memory, streaming, ticker detail pages and charts
  (not V1.2B).
- Chinese localization of this integration.
