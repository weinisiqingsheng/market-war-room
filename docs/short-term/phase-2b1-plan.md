# Short-Term Phase 2B.1 Implementation Plan

**Goal:** Bridge verified `ticker-context-v1` results into the isolated Short-Term market-state contract and run an opt-in fixture-Jev shadow assessment without changing shared services or public routes.

**Architecture:** A server-only adapter will call the existing `researchTicker()` with `createProductionTickerDeps()`, reject unsupported/unavailable results without fallback, and map typed numeric facts into a canonical Short-Term state. A separate shadow runner will feed that state into the existing fixture Jev service and build a local-only record labeled `verified_market_input` plus `fixture_model_output`.

**Constraints:** No changes to existing ticker services, API contracts, `/short-term` UI, `/api/short-term/jev/assess`, dependencies, environment files, or Git history. The live acceptance test is opt-in and never calls Jev.

## Tasks

- [ ] Add failing tests for bridge success, unsupported/unavailable results, provenance, session/feed semantics, deterministic fingerprints, and no evidence-text parsing.
- [ ] Add the server-only verified snapshot bridge using existing ticker services and the existing typed-fact adapter.
- [ ] Add failing tests for shadow labels and local-only record construction.
- [ ] Add the isolated shadow runner and explicit input/output labels.
- [ ] Add an opt-in bounded live acceptance test for NVDA, TSLA, and AAPL plus synthetic unknown, unsupported, partial, stale, and provider-unavailable cases.
- [ ] Add focused documentation describing the data flow, opt-in command, and validation boundary.
- [ ] Run focused tests, full web/analytics suites, typecheck, lint, changed-file formatting, and Webpack build; compare the final worktree against the starting state.
