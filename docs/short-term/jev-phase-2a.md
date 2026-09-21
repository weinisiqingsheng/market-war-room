# Short-Term Jev Phase 2A

Phase 2A adds an isolated, server-only Jev adapter boundary and offline shadow contracts. It does not replace the existing mock evaluator and does not make network calls.

## Runtime boundary

`POST /api/short-term/jev/assess` is fixture-backed in this phase. Responses carry `status: "fixture"` and `provenance.kind: "fixture"`; they are not verified market data, Jev output, forecasts, or trading instructions.

The existing `POST /api/short-term/analyze` route and `/short-term` UI remain unchanged.

## Pinned provider contract

- Endpoint: `https://api.typesafe.ai/v1/systemone` (fixed in code)
- Model: `jev-1.13.0` (not `jev-latest`)
- Question types: Choice, Score, Noul
- Real HTTP transport: disabled by default and not invoked by Phase 2A tests
- No SDK dependency is required; the future transport uses native server-side `fetch`

The adapter validates answer IDs and types, allowed choices, score legends, probability normalization, confidence ranges, token usage, model version, and request fingerprints. Invalid results become a typed unavailable state; missing financial judgments are never repaired.

## Market state

The canonical `short-term-market-state-v1` contract preserves symbol identity, effective/session timestamps, session phase, feed/delay labels, availability, freshness, typed fact values, and source fingerprints. The adapter can consume the existing `ticker-context-v1` context without changing it. Fact text is not parsed for numbers, and missing fields remain missing.

## Shadow records

`short-term-shadow-record-v1` records only sanitized request context, state fingerprint, pinned model, typed answers, usage, latency, status, cache outcome, and source provenance. The in-memory store is local-only. No credentials, authorization headers, raw provider bodies, or full prompts are stored.

Future outcome joins require an observation timestamp after both the request and effective market timestamp. Fixture results validate software behavior only; they cannot establish Jev accuracy, calibration, latency, or predictive superiority.

## Before real-provider testing

Separate approval is required for a server secret, a spending limit, an explicit enablement path, and a real-provider test plan. That phase must pin the model, record provider usage, keep the existing mock route/UI available, and compare Jev against deterministic and naive baselines.
