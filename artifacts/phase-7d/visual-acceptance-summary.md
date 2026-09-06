# Phase 7D.3 — Real Browser Visual Acceptance · Final V1 Release Gate

Date: 2026-08-31 (system shell date 2026-09-05/06)
Browser: Google Chrome (installed app) driven by `puppeteer-core` headless
("new" mode), real DOM + network + screenshot capture.
Services: analytics `127.0.0.1:8000` (health ok); Next dev `localhost:3000`
(`AI_BRIEF_MODE=live`, thinking disabled, 60s LLM timeout).
Demo check used a second local Next instance temporarily forced to
`AI_BRIEF_MODE=demo`, then the live server was restarted and re-verified.
Product code changes: **ZERO** (all probe scripts were temporary and removed).

## Real live result
- `GET /api/ai/market-brief` → `200` `{mode:"live",status:"generated"}`, valid
  ai-brief-v1 grounded by real DeepSeek validation (2 attempts max).
- Network interception confirmed the browser card's headline byte-equals the
  API response JSON delivered to that same page
  ("Broad selloff with extreme single-stock anomalies; cautious regime persists").
- 180s polling preserved in hook code; no 15/30s request storm observed;
  dev StrictMode mounts emit two initial requests (development-only).
- No browser calls to DeepSeek; no API keys in browser payloads/console.

## Page / layout
- Dashboard loads (HTTP 200), no blank screen, no hydration failure, no React
  page errors with `localhost` origin. (Using `127.0.0.1` caused only Next 16
  dev-HMR origin-block console messages, unrelated to product runtime.)
- Heading order preserved: Regime, Pulse, Macro, Rotation+Breadth,
  Anomalies+Catalysts, AI Brief, Ask War Room.
- Exactly **one** `Sakura AI Market Brief` section/h2 (aiCount=1). Legacy
  `AIMarketBrief` markup not rendered (source-verified via dashboard tests).

## Measured DOM geometry (generated state)
Desktop 1440×900:
- AI card 1312 wide × ~1374 tall; `scrollHeight == clientHeight` (no clipping,
  no hidden overflow); `overflow: visible`; border radius 20px; bg white
  surface; font Inter. Header overflow false (badges fit). Key Drivers +
  Internals/Macro grid = 2 columns (5 drivers / 6 notable moves / 3 watch-next).
  `scrollWidth - innerWidth = 0`. GROUNDED · ai-brief-v1 trust badge rendered;
  no DEMO/CACHED; stance chip rendered; no evidence IDs leak into visible text.
- Card ≈ 18% of the 7798px document — long but balanced and scannable.

Mobile 390×844:
- AI card 358 wide × ~2138 tall; same client==scroll height; grid collapses to
  1 column; no horizontal scroll (`hScroll = 0`); header/badges wrap; long
  FICO/LULU/ADBE prose and ticker pills wrap; 5 drivers / 6 moves / 3
  watch-next present; no evidence-ID leakage.

## Status-state visual coverage
- LOADING: natural first-load skeleton captured — skeleton bars fit card, no
  fake market numbers, rest of dashboard visible/usable.
- UNAVAILABLE: page-local API mock — honest copy + exactly one reachable
  `Retry` button (also accessible text).
- INSUFFICIENT: page-local API mock — honest no-brief copy, modules stay up.
- DEMO: real demo-mode instance — same card, DEMO chip visible, one heading,
  no legacy static panel.
- CACHED: not naturally observed in the browser window within a fingerprint
  TTL; existing deterministic cache tests cover the behavior.

## Classification
No BLOCKER, no MAJOR, no mobile overflow, no clipping/overlap, no duplicate
card, no runtime crash, no broken Retry.

MINOR/COSMETIC (non-blocking, ship with V1):
- Real brief is long (~1370px desktop / ~2140px mobile), which is proportional
  but makes the AI card the tallest module; future concision work applies.
- The AI card intentionally shows no `LIVE` chip (only `DEMO` when demo);
  live provenance stays subtle via the global LIVE · IEX banner + GROUNDED
  trust badge — consistent with `docs/ai-market-brief-ui.md`.
- HMR-origin warnings only if browsing dev via `127.0.0.1`.

Scores (1–10): A 8 · B 7 · C 7 · D 8 · E 7 · F 9 · G 9 · H 8

## Repo gates
`tsc --noEmit` clean. `vitest run` with the env-neutral default config
(credentials unset, as the tests expect): **56 files / 493 tests passing**.

FINAL CLASSIFICATION: **READY_FOR_V1**
