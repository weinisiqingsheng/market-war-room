# @war-room/config

Shared, non-published configuration for Market War Room workspace packages.

## Contents

- `tsconfig/base.json` — strict TypeScript compiler base used by workspace packages.

The Next.js web app keeps its own `tsconfig.json` (generated and managed by
`create-next-app`); shared non-app code (e.g. `@war-room/types`) extends this base.

## Why a config package?

Phase 1+ adds more services and packages. A single home for shared compiler
settings keeps those settings consistent without copy-paste drift. It is kept
deliberately small — no toolchain orchestration (e.g. Turborepo) is introduced
until there is more than one JS build to coordinate.
