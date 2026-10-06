# Phase 2E.3 Implementation Plan

## Scope

Preserve the frozen Phase 2E v1 predictions and outcomes, fix only the
isolated forward cost reserve, add a read-only cumulative ledger, and add
offline regression coverage. No provider calls, prompt changes, contract
changes, or prediction/outcome mutations are permitted.

## Files

- Create `apps/web/lib/short-term/forward/cost.ts` for conservative input-only
  reserve calculation.
- Modify `apps/web/lib/short-term/forward/real-pilot.ts` to use the reserve
  helper before each transport call.
- Create `apps/web/lib/short-term/forward/ledger.ts` for versioned cumulative
  summaries and explicit attempt/failure categories.
- Create `apps/web/tests/short-term-phase2e3-cost-budget.test.ts` for reserve
  regression coverage.
- Create `apps/web/tests/short-term-phase2e3-ledger.test.ts` for current-sample,
  pending/failure, and version-breakdown coverage.
- Create this postmortem and plan documentation.

## Acceptance

The cost reserve must be greater than or equal to the configured input-token
pricing estimate for every usage value within the configured request ceiling.
The ledger must preserve version boundaries, expose incomplete attempts, and
return `sourceRecordsMutated: false`. Focused tests, the web/analytics suites,
typecheck, lint, formatting, Webpack build, secret scan, and `git diff --check`
must be run before the final report. No commit or push is performed.
