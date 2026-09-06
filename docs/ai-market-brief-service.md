# AI Market Brief — Service Layer (Phase 7C.2A)

## Production wiring & HTTP (Phase 7C.2B)
- `AI_BRIEF_MODE` absent/`demo` → demo; `live` → live; any other value is a
  deterministic configuration error. Explicit `live` never becomes demo.
- Demo: deterministic `buildDemoGroundedBrief()` via the sealed service, using a
  "never called" provider. No Alpaca or LLM credentials required.
- Live: `buildLiveBriefContext` + OpenAI-compatible provider built from the
  existing LLM config module (`LLM_BASE_URL`/`LLM_API_KEY`/`LLM_MODEL`); model
  identity = configured `LLM_MODEL`.
- Service instance is process-local and lazy (`getProductionAiBriefService`);
  config/model changes require a server restart.
- `GET /api/ai/market-brief` is Node (`runtime = "nodejs"`), force-dynamic, and
  responds `Cache-Control: no-store`. `demo/generated/cached/insufficient`
  → HTTP 200; `unavailable`, config errors, and unexpected internal errors
  → HTTP 503 with a safe body (never stacks/secrets/prompts).
- Insufficient grounded data is a valid outcome (200), not an exception.
- API response excludes BriefContext, EvidenceFact.data, prompts, provider
  bodies, and Authorization values.
- Process-local 180s evidence cache is not shared across server instances
  (acceptable V1; no Redis). Underlying correctness never depends on cache hits.


## Service responsibility
`service.ts` (`createAiBriefService`) owns mode selection, BriefContext source,
fingerprint-keyed cache lookup, in-flight dedup, and invocation of the sealed
`generateGroundedMarketBrief`. It does NOT own schema/grounding/repair logic —
those stay in the sealed 7B chain — and never re-validates or rewrites model
output.

## Demo vs live
- Demo: returns the deterministic `buildDemoGroundedBrief()` fixture (schema-
  and grounding-valid against `buildDemoBriefContext()`). Never calls live
  builders or the LLM.
- Live: builds context → checks `inputConfidence` → fingerprint cache → generate
  on miss. No live→demo fallback, no extra retries, failures never cached.

## Cache by evidence fingerprint
`cache.ts` is a generic in-memory TTL store keyed by
`ai-brief-v1:<modelIdentity>:<context.fingerprint>`. The fingerprint already
excludes `generatedAt`, so orchestration-time-only changes reuse cached briefs;
changed SPY/breadth/catalyst/source-version/confidence evidence produce new
keys (cache miss).

## TTL / inflight
Default TTL 180s with an injectable clock; expired entries are removed lazily.
`service.ts` keeps a per-key `Map<key, Promise<result>>`: concurrent requests
for the same fingerprint share one generation; the entry is removed after
settlement, and unavailable results are shared but never cached, so a later
request may retry.

## Failure semantics
provider_error / schema / grounding failures → `unavailable`, not cached, no
further retry, no demo substitution. Insufficient context → zero LLM calls and
`insufficient_grounded_data`.

## Ownership boundary
The cache does not reduce domain-builder work: BriefContext must still be built
to learn its fingerprint. Underlying Phase 1–6 data caches are unaffected.
Model identity is namespaced so changed models don’t reuse stale briefs; no API
keys or provider payloads ever enter keys, cache values, or results.
