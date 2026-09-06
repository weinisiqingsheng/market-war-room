# @war-room/types

Canonical typed market domain models for Market War Room.

## Purpose

Every market signal the terminal renders (regime, indices, macro, sectors,
breadth, anomalies, catalysts, brief) has one typed contract living here so the
web app and future services (analytics, regime engine, catalyst engine) share
the same data vocabulary.

## Phase 0A usage

The web app consumes these contracts as **type-only imports** from
`@war-room/types`. The actual values currently come from
`apps/web/data/demo-market.ts`. In Phase 1 the same contracts are implemented by
API-backed data loaders — components do not change, only the data source.

## Conventions

- `change` / `changeDirection` = raw price movement only.
- `tone` = market interpretation (up is not automatically positive).
  Components render these as visually distinct signals.

## Commands

```bash
npm run typecheck -w @war-room/types
```
