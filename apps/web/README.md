# @war-room/web

Market War Room web terminal — **Sakura Market Intelligence**.

The approved Sakura Finance homepage implemented in Next.js (App Router),
TypeScript (strict) and Tailwind CSS v4.

## Phase 0A

- High-fidelity desktop homepage: Header → Market Regime → Market Pulse →
  Macro Pulse → Sector Rotation + Market Breadth → Market Anomalies +
  Catalyst Intelligence → AI Market Brief → Ask War Room.
- All values are **typed demo fixtures** (`data/demo-market.ts`), clearly
  labeled as such in the UI.
- No real market APIs, no LLM, no backend — those arrive in later phases.

## Scripts

```bash
npm run dev          # local dev server
npm run build        # production build
npm run lint         # ESLint (flat config)
npm run typecheck    # tsc --noEmit
npm test             # Vitest + Testing Library
```

## Structure

```
app/            # App Router: layout, homepage, global theme
components/     # UI + section components (prop-driven, no data fetching)
features/       # feature composition (home dashboard assembly)
lib/            # cn + formatting helpers
types/          # app-level re-export of @war-room/types contracts
data/           # demo fixtures (Phase 0A); replaced by API loaders in Phase 1
tests/          # Vitest suite
```
