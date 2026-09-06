# Visual QA — Screenshots

Phase 0B/1 captures of the running application (production build, system Chrome
headless via `puppeteer-core`).

| File                                     | Viewport   | Notes                                                                                                               |
| ---------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------- |
| `market-war-room-desktop.png`            | 1440 × 900 | **Mandatory primary fidelity target** — demo mode                                                                   |
| `market-war-room-tablet.png`             | 1024 × 768 | demo mode, stacked modules, no overflow                                                                             |
| `market-war-room-mobile.png`             | 390 × 844  | demo mode, priority-stacked, table scrolls in-card                                                                  |
| `market-war-room-desktop-live.png`       | 1440 × 900 | live mode — `LIVE · IEX` equities labels, header market status, ranked sectors                                      |
| `market-war-room-desktop-live-macro.png` | 1440 × 900 | **macro live mode** — per-cell provenance (`FRED · Daily`, `Twelve Data · Live`, `Alpaca · Live`), multi-source tag |

## Regenerate

```bash
# start the app (dev or prod), then from the repo root:
npm run capture                       # defaults to http://localhost:3103
npm run capture -- --url=http://localhost:3000
```

Live-mode validation uses a local mock Alpaca server (no real credentials):

```bash
node scripts/mock-alpaca.mjs 9998     # terminal 1 (equities + crypto)
node scripts/mock-macro.mjs 9997     # terminal 2 (FRED + Twelve Data)
MARKET_DATA_MODE=live \
MACRO_DATA_MODE=live \
ALPACA_API_KEY_ID=test ALPACA_API_SECRET_KEY=test \
ALPACA_DATA_BASE_URL=http://localhost:9998 \
ALPACA_TRADING_BASE_URL=http://localhost:9998 \
FRED_API_KEY=test FRED_BASE_URL=http://localhost:9997/fred \
TWELVE_DATA_API_KEY=test TWELVE_DATA_BASE_URL=http://localhost:9997 \
  npx next start -p 3104              # terminal 3 (from apps/web)
node scripts/probe-live.mjs           # equities DOM probe + live screenshot
node scripts/probe-macro.mjs          # macro API + DOM probe + live screenshot
```

`scripts/capture-screenshots.mjs` also emits structural probes (content width,
header height, section order, horizontal overflow). For the deeper layout audit
(geometry, colors, overflow sources, truncation):

```bash
npm run audit -- --viewport=1440x900
```

`scripts/probe-pixels.mjs` samples actual rendered pixel colors at key
elements for a data-driven fidelity check.

## Visual-review limitation

These PNGs are byte-level captures of the real render (verified by decoding
them and sampling pixels). A human designer pass against the Figma file is
still recommended — automated checks verify tokens, geometry and overflow, not
aesthetic judgement.
