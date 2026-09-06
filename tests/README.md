# Tests

Tests live beside the code they cover:

- **Web** — `apps/web/tests/*` run by **Vitest + React Testing Library**
  (jsdom). Covers the demo-data contracts, format helpers, key components
  (regime spectrum, index cards, Ask War Room) and the full homepage assembly
  (heading order = approved information architecture).
- **Analytics** — `services/analytics/tests/*` run by **pytest** (FastAPI
  `TestClient`). Phase 0A: `/health` contract tests.

## Commands

```bash
# Web
npm test                          # from repo root (runs apps/web vitest)
npm run test -w @war-room/web     # watch-less vitest run

# Analytics
cd services/analytics && .venv/bin/pytest -q

# CI runs both, plus lint, typecheck and production build.
```

## Adding a test

- Web: drop a `*.test.ts(x)` in `apps/web/tests/` (or colocate near a
  component). `tests/setup.ts` registers jest-dom matchers and RTL cleanup.
- Analytics: add a `test_*.py` under `services/analytics/tests/`.
