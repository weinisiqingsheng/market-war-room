# Short-Term Phase 2B.1 — Verified Market Data Bridge

Phase 2B.1 connects the existing server-side `ticker-context-v1` service to the isolated Short-Term pipeline without changing the ticker service, public ticker route, Mock Lab, or Jev assessment route.

## Data flow

```text
researchTicker(symbol, createProductionTickerDeps())
  -> verified TickerResearchContext
  -> marketStateFromTickerContext (typed fact.data only)
  -> createJevService(createFixtureTransport())
  -> response validation
  -> in-memory ShortTermShadowRecord
```

The bridge rejects `unsupported_symbol` and `unavailable` results. It does not create fixture market data as a fallback. Successful contexts retain `ok`, `partial`, or `insufficient_data` status, identity, typed numeric values, delayed-feed labels, timestamps, session phase, freshness, availability, and the original source fingerprint.

Every shadow result carries two explicit labels:

- `marketInputStatus: verified_market_input`
- `modelOutputStatus: fixture_model_output`

The Jev transport remains deterministic fixture-only. Fixture confidence and probabilities are simulated model output, not forecasts, calibrated probabilities, or trading signals.

## Acceptance test

The live acceptance test is skipped by default and never calls live/external Jev; it uses the deterministic fixture transport for the shadow step. To run the bounded NVDA/TSLA/AAPL market-data check, provide the existing local market-data environment explicitly:

```bash
SHORT_TERM_LIVE_ACCEPTANCE=1 \
MARKET_DATA_MODE=live \
TICKER_RESEARCH_MODE=live \
npm run test -w @war-room/web -- --run tests/short-term-live-acceptance.test.ts
```

The test fails closed when the provider is unavailable and never substitutes demo values. Unknown symbols, unsupported securities, partial data, stale data, and unavailable providers are covered by deterministic bridge tests.

Shadow records are held in memory by the runner. The existing temporary JSONL store remains available only for explicitly local paths; no recurring or background execution is enabled.
