# Phase 2C Evaluation Foundation Implementation Plan

**Goal:** Add an offline-only Score audit, durable local Shadow storage, and versioned prospective-evaluation contracts without changing the public Short-Term surface or the production Jev validator.

**Architecture:** New code lives under `apps/web/lib/short-term/evaluation/`. The Score audit helper validates the caller-defined ordered rubric and probability-weighted result independently, while documenting the exact future production-validator change required for approval. The durable store writes sanitized records outside the repository using restrictive permissions, duplicate detection, lock-protected atomic replacement, and explicit retention. The evaluator consumes existing Shadow Records and deterministic fixtures only; it never manufactures outcomes or contacts providers.

**Tech Stack:** TypeScript, Node `fs` primitives, Vitest, existing Jev question/validator types, existing Short-Term Shadow Record schema.

## Global Constraints

- No real Jev or market-provider requests.
- Do not modify the existing production Jev validator; document the required future change instead.
- Do not modify the Mock UI, public routes, market engines, ticker research, dependencies, environment configuration, or existing pilot JSONL.
- Do not commit, push, reset, clean, move, delete, or overwrite existing work.
- Durable records must remain outside the Git repository and must never be written to a repository path.
- Tests use deterministic fixtures and saved-record-shaped data only.

## Task 1: Score-contract audit

**Files:**

- Create: `apps/web/lib/short-term/evaluation/score-contract.ts`
- Test: `apps/web/tests/short-term-phase2c-score-contract.test.ts`
- Modify: `docs/short-term/phase-2c-evaluation.md`

Define `auditScoreAnswer(answer, question)` returning `{ valid: true, weightedScore, minScore, maxScore }` or `{ valid: false, issues }`. Require exact rubric keys, finite probabilities in `[0,1]`, probability sum within `1e-6`, finite score within `[0, criteria.length - 1]`, and weighted score agreement within `1e-6`. Keep confidence validation in `[0,1]`; do not interpret it as an outcome probability. Include AAPL’s `1.01`, exact boundaries, tolerance-edge acceptance, and invalid-score/distribution cases.

The documentation must state that this helper is offline audit logic only. A future approved production-validator change would call the helper from `validateScore`; it must preserve the existing question registry, accept fractional in-range scores, and reject only contract-invalid values.

## Task 2: Durable local Shadow store

**Files:**

- Create: `apps/web/lib/short-term/evaluation/durable-shadow-store.ts`
- Test: `apps/web/tests/short-term-phase2c-durable-store.test.ts`

Implement `createDurableShadowStore(options)` with an explicit absolute directory outside `process.cwd()`, a required positive `retentionDays`, and a default location under the user-local data directory. Create the directory with mode `0700` and the JSONL file with mode `0600`. Use an exclusive lock file, read/parse all existing lines before writing, reject malformed/partial records and duplicate `runId` values, write the complete replacement JSONL to a same-directory temporary file, `fsync`, close, and rename atomically. Expose `append`, `list`, `pruneExpired`, and `retentionPolicy` without changing the existing temporary store.

Tests must verify permissions, repository-path rejection, duplicate rejection, malformed-file protection, atomic replacement behavior, retention pruning, and preservation of the original pilot path by never opening it for write.

## Task 3: Frozen evaluation contracts and deterministic evaluators

**Files:**

- Create: `apps/web/lib/short-term/evaluation/types.ts`
- Create: `apps/web/lib/short-term/evaluation/evaluators.ts`
- Create: `apps/web/lib/short-term/evaluation/baselines.ts`
- Test: `apps/web/tests/short-term-phase2c-evaluation.test.ts`

Define versioned schemas for frozen decision inputs, session-aligned horizons (`one_hour`, `session_close`, `next_session_close`), observable labels (`up`, `flat`, `down`, `not_observable`), and independently observed outcomes. Enforce observed timestamps strictly after both requested and effective timestamps, preserve session/feed/freshness metadata, and represent unavailable/partial/stale inputs without fabricated values.

Implement deterministic evaluators for:

- typed-response validity using the existing validator;
- provenance completeness and fingerprint presence;
- finite non-negative latency and cost;
- missing-data and freshness summaries;
- outcome-label comparison only when an independently supplied outcome exists;
- naive no-change baseline and predeclared historical-frequency baseline interfaces;
- stability and evidence-change comparison helpers that report observed differences without claiming quality.

No evaluator may calculate predictive accuracy or calibration for Jev confidence without a matching, explicitly defined outcome label.

## Task 4: Documentation and offline verification

**Files:**

- Create: `docs/short-term/phase-2c-evaluation.md`

Document the Score interpretation, AAPL audit, storage security/retention policy, prospective timestamp/session rules, baselines, metrics, missing-data rules, retrospective versus prospective evaluation, and remaining limitations. Include the exact future production-validator change that requires separate approval.

Run focused Phase 2C tests, the full web suite with live variables unset, analytics tests, TypeScript, ESLint, changed-file Prettier checks, Webpack production build, and the existing secret scan. Confirm the pilot JSONL hash/permissions and Git status before and after verification.
