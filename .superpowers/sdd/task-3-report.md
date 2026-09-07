# Task 3 Report — Chinese AI Market Brief

## Scope

Implemented only the Chinese AI Market Brief boundary and UI. Existing English AI routes, schema, validators, providers, and unrelated dirty work were left unchanged. The Task 1/2 Chinese dashboard now renders the localized brief card after catalysts and before Ask War Room.

## Implementation

- Added Simplified Chinese evidence-only prompt with the `ai-brief-v1` root contract, exact-number, identifier, evidence-reference, no-invention, no-prediction, and constrained-causality rules.
- Added deterministic Chinese demo fixture validated by the existing schema and grounding validator.
- Added isolated two-call Chinese generation flow: one generation call plus one schema/grounding repair call; transport failures are returned as unavailable without repair.
- Added Chinese service with generated, cached, insufficient-grounded-data, and unavailable statuses, including a `zh:` cache namespace.
- Added `/api/zh/ai/market-brief` with the existing safe response shape and `Cache-Control: no-store`.
- Added Chinese client hook with abort, refetch, refresh, loading, cached, insufficient, and unavailable behavior.
- Added localized brief card/content with `核心驱动`, `市场内部结构`, `宏观`, `值得关注`, `数据质量`, and optional `查看证据` controls.

## Verification

- Focused Chinese AI brief and dashboard tests: 6 passed.
- Web and shared-package typecheck: passed.
- ESLint: 0 errors; two pre-existing warnings remain in `apps/web/tests/ai-brief-schema.test.ts`.
- `git diff --check`: passed.

## Concerns

- Live provider execution was not exercised because it requires the repository's external LLM configuration and credentials. The demo route and deterministic contract are covered.
- The repository contained pre-existing dirty paths; none were staged or modified by this task.
