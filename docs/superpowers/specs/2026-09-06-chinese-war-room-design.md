# Chinese Market War Room — Design Specification

## Goal

Add a standalone Simplified Chinese equivalent of the English home dashboard at
`/zh/war-room`. The new route must preserve the home dashboard's structure,
behavior, data meaning, and responsive density while localizing user-facing
presentation and language-specific AI output.

The existing English application is read-only for this work. Every source,
route, configuration file, shared component, utility, test, and styling file
that exists before implementation must remain unchanged.

## Approved isolation boundary

The dependency direction is one-way:

```text
/zh/war-room
  -> new Chinese page and presentation components
  -> existing read-only hooks, types, utilities, calculations, and APIs
  -> existing market-data providers and normalized responses
```

New Chinese code may import existing language-neutral code exactly as it is.
When an existing UI component contains copy, labels, prompt behavior, or
presentation that must differ, the implementation will copy it into a
Chinese-specific directory rather than modifying the original. No existing
English file may import or depend on Chinese files.

## Page composition

`/zh/war-room` mirrors the full `/` home dashboard, not `/intelligence`:

1. Chinese header with session and freshness disclosure.
2. Market Regime.
3. Market Pulse.
4. Macro Pulse.
5. Sector Rotation and Market Breadth.
6. Market Anomalies and Catalyst Intelligence.
7. AI Market Brief.
8. Ask War Room.
9. Chinese footer and disclosure.

The Chinese route is directly addressable and does not require changes to
English navigation or the global layout. The `/intelligence` workspace remains
a separate deeper evidence experience.

## Presentation layer

New Chinese-specific page/dashboard and card files will preserve the existing
visual language: Sakura colors, card surfaces, borders, typography hierarchy,
charts, spacing, grid relationships, state transitions, and interaction model.
Existing pure visual primitives, icons, types, formatting helpers, and hooks
may be imported when they work unchanged.

User-facing copy will use concise professional Simplified Chinese. Examples:

| English | Chinese |
| --- | --- |
| Market War Room | 市场作战室 |
| Market Regime | 市场环境 |
| Market Pulse | 市场脉搏 |
| Macro Pulse | 宏观脉搏 |
| Sector Rotation | 板块轮动 |
| Market Breadth | 市场广度 |
| Market Anomalies | 市场异常 |
| Catalyst Intelligence | 催化事件 |
| AI Market Brief | AI 市场简报 |
| Ask Sakura / Ask War Room | 询问市场作战室 |
| Risk-Off / Neutral / Risk-On | 避险 / 中性 / 风险偏好 |
| Return Shock / Volume Shock | 价格异动 / 成交量异动 |
| Evidence / Opportunity / Risk | 分析证据 / 机会 / 风险 |

Ticker symbols, company names, S&P 500, Nasdaq, VIX, RSI, EPS, P/E, ETF, AI,
API, provider names, feed names, and engine/version identifiers remain in
English where that is the industry-standard form. Prices, percentages,
timestamps, rankings, scores, chart values, evidence references, and all other
underlying market facts remain unchanged.

Chinese-specific layout changes are limited to new files and may include
flexible wrapping, `min-w-0`, local line-height adjustments, label widths,
tooltip widths, and mobile-safe card/button/table behavior. No global CSS,
Tailwind configuration, package file, or shared component will be modified.

## Data flow

The new page reads the existing server-side mode configuration and passes the
same demo/live mode values to a new Chinese dashboard. The dashboard reuses the
existing read-only client hooks and calls these existing APIs unchanged:

- `/api/market/overview`
- `/api/macro/overview`
- `/api/regime/overview`
- `/api/breadth/overview`
- `/api/anomalies/overview`
- `/api/catalysts/overview`

This preserves real market data, provider provenance, calculation logic,
loading behavior, error isolation, and no-demo-fallback semantics. No duplicate
market-data API is created merely to translate structured data.

## Language-specific AI

The Chinese page uses new endpoints only where language behavior must change:

- `/api/zh/ai/market-brief`
- `/api/zh/ai/ask-war-room`

These routes reuse or copy the existing context builders, evidence selection,
request validation, schema validation, grounding validation, provider setup,
and failure boundaries without modifying existing English AI files.

The Chinese market-brief prompt requires primarily Simplified Chinese,
professional concise wording, evidence-only claims, exact supplied numbers,
and no invented catalysts, predictions, causal claims, or outside knowledge.
The Chinese Ask War Room prompt applies the same grounding rules to answered,
insufficient-evidence, and out-of-scope responses. New Chinese demo fixtures
ensure demo mode is also Chinese. Standard identifiers and raw facts remain
unchanged.

## State and interaction parity

The Chinese implementation will include localized equivalents for every home
dashboard state that is user-visible:

- initial loading/skeleton states;
- provider unavailable/error states;
- insufficient grounded data;
- empty catalyst/evidence conditions;
- stale/live/demo provenance labels;
- retry controls;
- AI brief generation/cache states;
- Ask War Room idle, submitting, success, insufficient, out-of-scope, and
  unavailable states;
- existing chart, tooltip, filter, and question interactions.

Buttons and controls retain the existing meaning and do not become new
navigation or product behavior solely because the copy is translated.

## Proposed new-file areas

The exact file list will follow the implementation pass, but all task-created
files will be additions under areas like:

- `apps/web/app/zh/war-room/`
- `apps/web/app/api/zh/ai/`
- `apps/web/components/war-room-zh/`
- `apps/web/features/war-room-zh/`
- `apps/web/lib/war-room-zh/`
- `apps/web/tests/` for Chinese-specific tests

No existing file will be moved, renamed, or edited to support these paths.

## Validation

Validation will be proportional and additions-only:

1. Add focused tests for the Chinese page, localized labels, state rendering,
   and language-specific AI prompts/routes.
2. Run relevant Chinese tests plus the existing typecheck, lint, build, and
   focused test commands that the current checkout supports.
3. Run the app and verify `/zh/war-room` on desktop and mobile: major cards,
   charts, filters/interactions, real/demo data, loading, empty, error, AI
   brief, and Ask War Room.
4. Check for significant new browser console errors and visible Chinese text
   overflow.
5. Re-check the English `/` dashboard behavior without changing it.
6. Compare final `git status`, `git diff`, and `git diff --staged` with the
   pre-task state. The task must add files only: zero modified, deleted,
   renamed, or moved existing files.

Pre-existing dirty files are preserved exactly and reported separately from
the task's new files.

