# Phase 2E Explicit Forward Direction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task with checkpoints.

**Goal:** Add an isolated, fixture-only `next_session_direction_v1` experiment that produces immutable forward predictions and deterministic offline evaluation without changing current-state Jev or Phase 2D behavior.

**Architecture:** New code lives under `apps/web/lib/short-term/forward/`. A typed contract and question builder feed a strict isolated validator; a record builder freezes decision-time inputs; a private JSONL store persists predictions atomically outside Git; baselines and metrics consume prediction/outcome links only after observation. A fixture runner and private CLI demonstrate the complete path without real providers.

**Tech Stack:** TypeScript, Vitest, Node `fs`/`crypto`, existing read-only market and prospective types, deterministic fixture transport, Next.js workspace tooling.

## Global Constraints

- Keep the task ID `next_session_direction_v1`, contract `short-term-forward-direction-v1`, question set `short-term-forward-questions-v1`, and horizon `next_session_close`.
- Use `UP`, `FLAT`, `DOWN` and the existing inclusive `±0.10%` flat band.
- Do not modify shared modules, current-state Jev questions/validator, routes, UI, navigation, dependencies, environment, or Phase 2D records.
- Do not make real Jev requests or real prospective observations; fixture CLI must reject real mode.
- Store prediction records outside Git with restrictive permissions and atomic duplicate-safe writes.
- Do not describe class weights as calibrated market-return probabilities.

---

### Task 1: Add the forward contract and question registry

**Files:**

- Create: `apps/web/lib/short-term/forward/contract.ts`
- Create: `apps/web/lib/short-term/forward/types.ts`
- Create: `apps/web/lib/short-term/forward/questions.ts`
- Test: `apps/web/tests/short-term-phase2e-contract.test.ts`

**Interfaces:**

- `contract.ts` exports task/version/horizon/class constants, `ForwardDirection`, and the `±0.10%` label function.
- `types.ts` exports provider response, validated assessment, prediction record, outcome link, and metric types.
- `questions.ts` exports `buildForwardDirectionQuestion(decision)` and the question-set version.

- [ ] **Step 1: Write failing tests** for exact task constants, strict boundary labels, question text containing both timestamps/session targets, and exact class keys.
- [ ] **Step 2: Run** `cd apps/web && npx vitest run tests/short-term-phase2e-contract.test.ts`; confirm failure because the forward modules do not exist.
- [ ] **Step 3: Implement** the constants, discriminated types, label function, and temporal question builder without importing or modifying the current Jev question registry.
- [ ] **Step 4: Run** the focused test and confirm all contract assertions pass.

### Task 2: Implement isolated response validation and immutable records

**Files:**

- Create: `apps/web/lib/short-term/forward/validate.ts`
- Create: `apps/web/lib/short-term/forward/record.ts`
- Test: `apps/web/tests/short-term-phase2e-record.test.ts`

**Interfaces:**

- `validateForwardResponse(response, question)` returns a validated assessment or throws a safe validation error.
- `buildForwardPredictionRecord(input)` returns a deeply frozen `ForwardDirectionPredictionRecord`.

- [ ] **Step 1: Write failing tests** for exact class maps, normalization tolerance, invalid confidence, invalid predicted class, missing evidence, future-field rejection, target-session identity, stale input, and deep immutability.
- [ ] **Step 2: Run** `cd apps/web && npx vitest run tests/short-term-phase2e-record.test.ts`; confirm expected missing-module failures.
- [ ] **Step 3: Implement** strict finite-unit validation, exact keys, `1e-6` normalization tolerance, decision-time timestamp checks, target-session checks, and a deep-freezing record builder.
- [ ] **Step 4: Run** the focused test and confirm invalid responses never produce records.

### Task 3: Implement private durable prediction storage

**Files:**

- Create: `apps/web/lib/short-term/forward/store.ts`
- Test: `apps/web/tests/short-term-phase2e-store.test.ts`

**Interfaces:**

- `createForwardPredictionStore(options)` returns `append`, `list`, and `pruneExpired` for `predictions.jsonl`.

- [ ] **Step 1: Write failing tests** for outside-repository enforcement, `0700`/`0600` permissions, atomic writes, duplicate prediction rejection, malformed JSONL rejection, lock rejection, and retention pruning.
- [ ] **Step 2: Run** the store test and confirm it fails before implementation.
- [ ] **Step 3: Implement** private JSONL storage using exclusive lock files, `fsync`, temporary `0600` files, atomic rename, strict parsing, and a 90-day policy.
- [ ] **Step 4: Run** the store test and verify no repository file is created.

### Task 4: Implement baselines and deterministic evaluation

**Files:**

- Create: `apps/web/lib/short-term/forward/baselines.ts`
- Create: `apps/web/lib/short-term/forward/evaluate.ts`
- Test: `apps/web/tests/short-term-phase2e-evaluation.test.ts`

**Interfaces:**

- `alwaysFlatBaseline()` returns `FLAT`.
- `historicalMajorityBaseline(counts)` validates counts and resolves ties as `FLAT`, `UP`, `DOWN`.
- `frozenMomentumBaseline(referencePrice, previousClose)` uses the declared flat band.
- `evaluateForwardBatch(predictions, outcomes, baselineConfig)` returns accuracy, confusion matrix, per-class precision/recall, macro F1, baseline deltas, paired comparisons, and `forwardMetricStatus: "applicable"` only for linked outcomes.

- [ ] **Step 1: Write failing tests** for all baselines, tie handling, confusion matrix, precision/recall, macro F1, baseline deltas, identity mismatch rejection, and no Brier/log-loss claim.
- [ ] **Step 2: Run** the evaluation test and confirm expected failures.
- [ ] **Step 3: Implement** deterministic integer-count metrics with explicit zero-denominator handling and no future data access during prediction construction.
- [ ] **Step 4: Run** the evaluation test and verify exact expected metrics.

### Task 5: Add fixture runner and private CLI

**Files:**

- Create: `apps/web/lib/short-term/forward/fixture.ts`
- Create: `apps/web/lib/short-term/forward/runner.ts`
- Create: `scripts/short-term-forward-pilot.ts`
- Create: `scripts/run-short-term-forward-pilot.mjs`
- Test: `apps/web/tests/short-term-phase2e-runner.test.ts`

**Interfaces:**

- `runForwardFixturePilot()` returns three fixture predictions, linked fixture outcomes, and deterministic evaluation with zero real requests.
- The CLI accepts exactly `--dry-run` and rejects `--real` or other modes.

- [ ] **Step 1: Write failing tests** for three-symbol fixture execution, fixture-only output status, zero real-request count, immutable predictions, and CLI rejection of real mode.
- [ ] **Step 2: Run** the runner test and confirm it fails before implementation.
- [ ] **Step 3: Implement** deterministic fixture decisions, temporal questions, fixture responses, validated records, the separately testable private store, and CLI argument gating.
- [ ] **Step 4: Run** focused runner tests and `node scripts/run-short-term-forward-pilot.mjs --dry-run`; verify no real transport is available.

### Task 6: Documentation and full verification

**Files:**

- Modify only the two Phase 2E design/plan documents created above if self-review finds a documentation inconsistency.

- [ ] **Step 1: Run** focused Phase 2E tests.
- [ ] **Step 2: Run** `npm test -w @war-room/web` and confirm live tests remain skipped by default.
- [ ] **Step 3: Run** `npm run test:analytics`, `npm run typecheck`, and `npm run lint`.
- [ ] **Step 4: Run** changed-file `prettier --check`, `npm run build -w @war-room/web -- --webpack`, `bash scripts/check-secrets.sh`, and `git diff --check`.
- [ ] **Step 5: Verify** `git status`, no public route/UI diffs, no Phase 2D record changes, and no generated repository shadow files.
- [ ] **Step 6: Report** `PASS_OFFLINE_READY_FOR_FORWARD_PILOT` only if every gate passes; do not commit or push.
