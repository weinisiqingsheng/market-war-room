# Phase 2E.2 Market-Data Readiness Implementation Plan

> **For agentic workers:** This plan is an additions-only readiness audit. Do not execute the real pilot without the exact authorization token.

**Goal:** Establish a versioned, fail-closed market-data policy and verify the private forward runner is ready on the local host path without making Jev requests.

**Architecture:** Reuse the existing server-side ticker research and verified bridge. Keep feed semantics in a new `short-term/forward` policy module, persist its version in forward records, and keep host diagnostics/read-only acceptance outside public routes.

**Tech Stack:** Next.js/TypeScript, Vitest, Alpaca REST through existing production services, injected NYSE calendar, private JSONL store.

## Global Constraints

- No real Jev or paid requests.
- No new forward predictions or outcomes.
- No shared-module, public-route, UI, dependency, environment, trading, commit, or push changes.
- Preserve all pre-existing tracked and untracked work.

### Task 1: Capture runtime and provider evidence

**Files:**

- Read: `apps/web/lib/ticker-context/production-service.ts`, `apps/web/lib/ticker-context/service.ts`, `apps/web/lib/short-term/market-data/verified-bridge.ts`.
- Document: `docs/short-term/phase-2e2-market-data-readiness.md`.

- [x] Verify sandbox failure categories without printing credentials.
- [x] Verify host DNS/TLS and official Alpaca clock, asset, snapshot, and bar status.
- [x] Capture NVDA, TSLA, and AAPL verified bridge metadata once.

### Task 2: Freeze the isolated feed policy

**Files:**

- Create: `apps/web/lib/short-term/forward/market-policy.ts`.
- Modify: `apps/web/lib/short-term/forward/types.ts`, `record.ts`, `store.ts`, `real-pilot.ts`.
- Test: `apps/web/tests/short-term-phase2e1-readiness.test.ts` and existing Phase 2E tests.

- [x] Require delayed-SIP/15-minute decision inputs.
- [x] Record SIP/split-adjusted outcome semantics and explicit cross-feed rule.
- [x] Reject decision feed, delay, or freshness mismatches before Jev transport.
- [x] Persist policy version in every forward prediction record.

### Task 3: Verify the private runner and quality gates

**Files:**

- Read: `scripts/run-short-term-forward-real-pilot.mjs`, `scripts/short-term-forward-real-pilot.ts`.
- No execution of the real command.

- [x] Confirm exact confirmation, request, concurrency, retry, and cost guards by code inspection and fixture tests.
- [x] Run focused tests, full web and analytics suites, typecheck, lint, formatting, Webpack, secret scan, and `git diff --check`.
- [x] Confirm no public route/UI or current-state registry changes.
