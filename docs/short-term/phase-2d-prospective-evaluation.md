# Short-Term Phase 2D Prospective Evaluation

Phase 2D adds a fixture-first prospective workflow under `apps/web/lib/short-term/prospective/`.

The private dry-run command is:

```bash
node scripts/run-short-term-prospective-pilot.mjs --dry-run
```

It evaluates NVDA, TSLA, and AAPL with explicitly labelled fixture market inputs and fixture Jev outputs. It writes no real-provider requests and does not modify the existing temporary pilot JSONL.

Decision records are immutable and separate from outcome records. Outcomes must match the decision run ID, ticker, and state fingerprint. The default outcome convention is percentage return from the structured reference price with a `±0.10` percentage-point flat band. Missing, stale, partial, halted, or unavailable observations are `not_observable`.

The existing Jev question registry describes current-state judgments only. Phase 2D therefore reports forward Jev performance as `not_applicable`; it does not treat market-condition options, Score values, or confidence as future-return probabilities. A future-direction task would require a new question-set and evaluation protocol version.

The production market stack currently exposes daily bars. Session-close and next-session-close observations require the versioned NYSE regular-session calendar and independently fingerprinted Alpaca SIP daily-bar provenance. One-hour production observations fail closed until verified intraday data is available. Real Jev execution remains private, manual, confirmation-gated, budget-bounded, and outside this fixture-only phase. See `phase-2d-2-runtime-data-readiness.md` for bounded calendar coverage and runner details.
