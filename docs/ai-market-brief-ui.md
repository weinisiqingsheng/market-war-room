# AI Market Brief — UI (Phase 7C.3)

## Frontend architecture
`/api/ai/market-brief` → `useAiMarketBrief` (fetch, ~180s refresh, abort/race
guards) → `AiMarketBriefPanel` (owns hook state) → `AiMarketBriefCard` (pure
Sakura presentational card). `HomeDashboard` renders only `<AiMarketBriefPanel />`.

## One UI path for demo + live
The page never branches on `AI_BRIEF_MODE`; the client never reads it. Mode
arrives in API JSON (`mode: "demo"|"live"`) and the same card renders it, with a
subtle DEMO badge for demo. Legacy static brief markup is no longer rendered and
no hidden demo fallback survives failures.

## Status behavior
demo/generated/cached → full brief; loading → skeleton (page stays usable);
insufficient_grounded_data → honest no-brief copy; unavailable/network error →
card-local graceful panel with Retry (calls `refetch`, no `?force`, no reload).

## Key semantics
Cached ≠ stale (footer: “Cached for unchanged evidence”). Insufficient ≠
neutral. Unavailable affects only the AI card. ~180s polling lives only in the
hook (one instance, no second timers). The client performs no market reasoning,
reads no credentials, and imports no provider/server modules; evidenceRefs stay
in the object for auditability without inline ID display.
