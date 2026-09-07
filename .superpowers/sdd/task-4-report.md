
## Task 4 report — Chinese Ask War Room

Date: 2026-09-06

### Scope

Implemented only the Chinese Ask War Room endpoint, hook, localized UI, tests, and dashboard wiring described in `task-4-brief.md`.

Created:

- `apps/web/lib/war-room-zh/ask-prompt.ts`
- `apps/web/lib/war-room-zh/ask-generate.ts`
- `apps/web/lib/war-room-zh/ask-service.ts`
- `apps/web/app/api/zh/ai/ask-war-room/route.ts`
- `apps/web/features/war-room-zh/useChineseAskWarRoom.ts`
- `apps/web/components/war-room-zh/ChineseAskWarRoom.tsx`
- `apps/web/tests/chinese-war-room-ask.test.ts`

Modified only the Task 1–3 Chinese dashboard:

- `apps/web/features/war-room-zh/ChineseWarRoomDashboard.tsx`

Existing English Ask files and unrelated pre-existing dirty paths were not modified.

### Implementation

- Added a Simplified Chinese prompt requiring evidence-only answers, prompt-safe untrusted evidence/question boundaries, preserved `evidenceRefs`, no invention, no outside knowledge, no new calculations, no trading instructions, no unsupported causal claims, and explicit insufficient/out-of-scope statuses.
- Added an isolated Chinese generation boundary using the existing request contract types, evidence selection, schema parser, grounding validator, context types/builders, and provider boundary. It preserves the controlled maximum of two provider calls.
- Added `POST /api/zh/ai/ask-war-room`, parsing the request body once and preserving 400/200/503 semantics with no provider configuration exposure.
- Added the localized hook with abort, stale-request protection, retry, clear, validation, and status mapping.
- Added the localized one-question UI with Enter submit, Shift+Enter newline, 500-character limit, suggested questions, submitting/answer/evidence/limitations/retry/unavailable states, and `/intelligence` evidence link.
- Wired the new card immediately after the Chinese AI market brief and removed the redundant dashboard heading wrapper to preserve a single accessible heading.

### TDD evidence

1. RED: the focused test initially failed because the Chinese Ask files did not exist. A test syntax issue was corrected before the feature implementation; the next run failed on the intended missing-module error.
2. GREEN: implementation made the focused Chinese Ask suite pass.

### Verification

- `npm run test -w @war-room/web -- --run tests/chinese-war-room-ask.test.ts`: 5 tests passed.
- `npm run test -w @war-room/web -- --run tests/chinese-war-room-ask.test.ts tests/chinese-war-room-dashboard.test.tsx tests/chinese-war-room-ai-brief.test.ts tests/chinese-war-room-components.test.tsx`: 4 files, 25 tests passed.
- `npm run typecheck -w @war-room/web`: passed.
- Focused workspace lint for all Task 4 files and the dashboard: passed with zero errors and zero warnings.
- Full `npm run lint -w @war-room/web`: zero errors; two pre-existing warnings remain in `apps/web/tests/ai-brief-schema.test.ts` for unused imports.
- `git diff --check`: passed.

### Concerns

- The production route follows the existing provider/config boundary and therefore requires the same live LLM configuration behavior as the existing Ask endpoint.
- Browser verification and build belong to Task 5 and were not performed here.
