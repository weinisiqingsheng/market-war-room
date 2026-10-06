# Phase 2D Prospective Jev Shadow Evaluation Implementation Plan

> **For agentic workers:** Implement task-by-task with TDD and review each isolated task before continuing.

**Goal:** Build a fixture-first, isolated prospective Jev evaluation workflow with immutable decision records and separate independently verified outcome records.

**Architecture:** Add a `short-term/prospective` namespace that composes existing Bridge, Shadow Runner, production validation, evaluators, baselines, and durable storage. Keep decision and outcome JSONL records separate, use injected session calendars/providers, and fail closed when production observations are unavailable.

**Tech Stack:** TypeScript, Vitest, existing Next.js server-only modules, Node filesystem primitives already used by Phase 2C.1.

## Global Constraints

- Do not modify the Mock UI, public fixture-only routes, global market contracts, ticker research, scoring engines, localization, dependencies, environment files, or existing pilot records.
- Do not make real Jev or market-provider requests.
- Do not commit or push.
- Do not interpret Jev confidence, Score values, or existing classifications as calibrated return probabilities.
- Preserve Phase 2C.1 Score validation and durable storage behavior.

### Task 1: Prospective schemas and decision freezing

**Files:**

- Create: `apps/web/lib/short-term/prospective/types.ts`
- Create: `apps/web/lib/short-term/prospective/freeze.ts`
- Test: `apps/web/tests/short-term-phase2d-freeze.test.ts`

**Steps:**

- [ ] Write failing tests for exact schema versions, structured numeric price extraction, verified-input requirement, deep immutability, and fingerprint preservation.
- [ ] Run `npm run test -w @war-room/web -- --run tests/short-term-phase2d-freeze.test.ts`; expect failures because the namespace does not exist.
- [ ] Implement `FrozenProspectiveDecision`, `ProspectiveHorizon`, and `freezeProspectiveDecision(record, horizon)` with deep cloning, numeric fact extraction, and fail-closed validation.
- [ ] Re-run the focused test and confirm green.

### Task 2: Injected calendars and horizon eligibility

**Files:**

- Create: `apps/web/lib/short-term/prospective/horizons.ts`
- Modify: `apps/web/lib/short-term/prospective/types.ts` (calendar interface)
- Test: `apps/web/tests/short-term-phase2d-horizons.test.ts`

**Steps:**

- [ ] Write failing fixture tests for regular sessions, weekends, holidays, early closes, delayed observations, stale data, incomplete sessions, halts, current-close, next-close, and one-hour capability absence.
- [ ] Run the focused test and verify expected failures.
- [ ] Implement the injected `ProspectiveSessionCalendar` interface and `resolveHorizonEligibility` without wall-clock arithmetic.
- [ ] Re-run and confirm all horizon cases pass.

### Task 3: Independent outcome observation and labels

**Files:**

- Create: `apps/web/lib/short-term/prospective/observations.ts`
- Create: `apps/web/lib/short-term/prospective/outcomes.ts`
- Test: `apps/web/tests/short-term-phase2d-outcomes.test.ts`

**Steps:**

- [ ] Write failing tests for verified observations, return calculation, the `±0.10%` flat band, missing observations, stale/partial data, look-ahead, identity/fingerprint mismatch, and duplicate horizon outcomes.
- [ ] Run the focused test and verify expected failures.
- [ ] Implement `FutureObservationProvider`, fixture provider support, `collectProspectiveOutcome`, and deterministic label calculation.
- [ ] Re-run and confirm green.

### Task 4: Separate durable prospective stores

**Files:**

- Create: `apps/web/lib/short-term/prospective/store.ts`
- Test: `apps/web/tests/short-term-phase2d-storage.test.ts`

**Steps:**

- [ ] Write failing tests for separate decision/outcome paths, restrictive permissions, atomic writes, duplicate prevention, malformed-record fail-closed behavior, retention, and no overwrite of decisions by outcomes.
- [ ] Run the focused test and verify expected failures.
- [ ] Implement stores using the Phase 2C.1 durability guarantees and an outside-repository default directory.
- [ ] Re-run and confirm green; verify the original `/private/tmp` record hash remains unchanged.

### Task 5: Prospective evaluator and baseline comparison

**Files:**

- Create: `apps/web/lib/short-term/prospective/evaluate.ts`
- Test: `apps/web/tests/short-term-phase2d-evaluation.test.ts`

**Steps:**

- [ ] Write failing tests for current-state evaluation reuse, historical TSLA exclusion, baseline pairing, `not_applicable` forward metrics, and no calibration of Jev confidence.
- [ ] Run the focused test and verify expected failures.
- [ ] Implement `evaluateProspectivePair` using Phase 2C evaluators and baselines; require an explicit mapping before any forward metric.
- [ ] Re-run and confirm green.

### Task 6: Fixture-first dry-run entrypoint

**Files:**

- Create: `apps/web/lib/short-term/prospective/pilot.ts`
- Create: `scripts/short-term-prospective-pilot.ts`
- Test: `apps/web/tests/short-term-phase2d-pilot.test.ts`
- Create: `docs/short-term/phase-2d-prospective-evaluation.md`

**Steps:**

- [ ] Write failing tests that run NVDA, TSLA, and AAPL through fixture market states and fixture Jev transport, producing separate immutable decisions and outcomes with explicit fixture statuses.
- [ ] Run the focused test and verify expected failures.
- [ ] Implement the private `--dry-run` entrypoint; keep `--real` disabled unless explicit confirmation and existing budget controls are present, with no automatic retries.
- [ ] Add operator documentation that real mode is not run in Phase 2D and that existing outputs have no defensible future-direction mapping.
- [ ] Re-run the focused pilot test and confirm green.

### Task 7: Isolation and quality gates

**Files:**

- No production files outside the new prospective namespace, dedicated tests, script, and documentation.

**Steps:**

- [ ] Run focused Phase 2D tests and verify all pass without network calls.
- [ ] Run the full web suite, analytics suite, TypeScript, ESLint, changed-file Prettier, Webpack build, and secret scan.
- [ ] Run `git diff --check`, verify no public route/UI/global module changes, verify the original pilot SHA-256, and inspect tracked/untracked status.
- [ ] Stop with `PASS_OFFLINE_READY_FOR_PROSPECTIVE_PILOT` only if every gate passes; otherwise report the exact blocker.
