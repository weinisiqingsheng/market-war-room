# Jev Short-Term Intelligence Lab prototype

The standalone `/short-term` route is an isolated prototype. It does not modify or call the existing Market War Room overview, Markets, Intelligence, Ask Sakura, analytics, Chinese localization, navigation, scoring, or evidence pipelines.

## Current contract

- `POST /api/short-term/analyze` accepts a ticker, strategy profile, review horizon, and maximum-loss review threshold.
- The route validates the request and calls `lib/short-term/mock-engine.ts` only.
- The response is versioned `short-term-lab-v1`, marked `status: simulated`, and identifies `provider: mock-jev` and `model: jev-short-term-mock-v0`.
- All market values, prices, probabilities, confidence values, scores, evidence, and scenarios are deterministic synthetic fixtures.
- No external HTTP request, real Jev credential, provider data, broker, exchange, or trading API is used.

## What a future Jev phase would replace

Only the isolated mock evaluator should be replaced. A production adapter would need server-only credentials, a pinned Jev model, a minimized structured state, typed response validation, timeout/retry and rate-limit policy, cost telemetry, calibration data, and an explicit shadow-to-visible rollout.

## What mock responses cannot validate

The prototype cannot validate Jev quality, probability calibration, factual market context, latency, API pricing, rate limits, provider availability, or whether a real response improves a regime/risk decision. Those require an separately approved, capped, non-trading live evaluation.

## Preservation rule

Do not add navigation links or imports from existing application modules. Any future integration that requires changing an existing file must be proposed and approved separately.

