# Task 2 — Chinese Market War Room cards

## Commit

- `3f42eebcd8429dbd4b05c98c72c8211ff8976c02` — `feat: localize Chinese war room cards`

## Delivered scope

- Added the seven Task 2 Chinese presentation cards for market regime, pulse, macro, sector rotation, breadth, anomalies, and catalyst intelligence.
- Added `apps/web/tests/chinese-war-room-components.test.tsx` with ready, loading, error, and empty-state coverage plus preservation checks for supplied SPY data and live regime-driver attribution.
- Wired only `apps/web/features/war-room-zh/ChineseWarRoomDashboard.tsx` to the new Chinese cards and existing hook-result shapes.
- Kept provider names, tickers, company names, and engine identifiers unmodified; localized UI labels, unavailable states, analysis context, and compact wrapping behavior.

## TDD evidence

1. Added the focused component test before the Task 2 card modules existed.
2. The initial correctly targeted Vitest run failed at import resolution because `ChineseCatalystIntelligence` did not yet exist.
3. Implemented the minimum localized card behavior and reran the test until green.

## Verification

- `npm test -- --run tests/chinese-war-room-components.test.tsx tests/chinese-war-room-dashboard.test.tsx` — 2 files passed, 8 tests passed.
- `npm run typecheck` — passed for `@war-room/web` and `@war-room/types`.
- `npm run lint` — no errors. Two warnings remain in the pre-existing unrelated `apps/web/tests/ai-brief-schema.test.ts`.
- `git diff --check` for Task 2 paths — clean.
- Staged-file inspection immediately before commit listed exactly seven new Chinese cards, the new Task 2 test, and the authorized Chinese dashboard update.

## Self-review

- Confirmed loading states expose `role=status` and `aria-busy=true`.
- Confirmed error states do not render supplied market figures in place of unavailable live data.
- Confirmed Chinese copy uses local `min-w-0`, `break-words`, and `leading-relaxed` where compact text could otherwise overflow.
- Confirmed no existing English card, `HomeDashboard.tsx`, or pre-existing dirty implementation path was modified or staged by this task.

## Concern

The requested root-level test command passes the path through to the web workspace, whose working directory is `apps/web`; its literal `apps/web/tests/...` form therefore finds no files. The verification command above uses the equivalent workspace-relative `tests/...` paths and passed. npm also emits a pre-existing CLI-forwarding warning for `--run`.

## Review fix — preserved live facts and provenance

- Restored the localized Market Pulse day-range position and supplied sparkline; Macro Pulse stale, frequency, and tone/source provenance; Sector Rotation daily return, signal, and strength; and live Breadth metrics, coverage, confidence, engine, universe, and delayed-SIP provenance.
- Restored supplied live anomaly movement and severity without deriving severity from its score. Live Regime now discloses coverage, confidence, stale/missing inputs, engine version, and as-of timestamp.
- `ChineseCatalystIntelligence` now selects live overview only when `mode="live"`; `ChineseWarRoomDashboard` passes `catalystsMode`. Live catalyst cards preserve evidence source, time, supporting evidence, provider degradation, and evidence links; demo mode ignores retained live overview state.
- Extended `apps/web/tests/chinese-war-room-components.test.tsx` for those live facts/provenance, anomaly movement/severity, and a live-to-demo catalyst transition.

## Review fix verification

- `npm test -- --run tests/chinese-war-room-components.test.tsx tests/chinese-war-room-dashboard.test.tsx` — passed: 2 files, 11 tests.
- `npm run typecheck` — passed for `@war-room/web` and `@war-room/types`.
- `npm run lint` — passed with 0 errors; 2 pre-existing warnings remain in `apps/web/tests/ai-brief-schema.test.ts`.
- `git diff --check -- apps/web/components/war-room-zh apps/web/features/war-room-zh/ChineseWarRoomDashboard.tsx apps/web/tests/chinese-war-room-components.test.tsx` — passed.
