# Intelligence Workspace (V1.1B)

## Overview vs Markets vs Intelligence

- **Overview** (`/`) — “What is the market trading today?” regime, pulse,
  catalysts and the grounded Sakura AI Market Brief.
- **Markets** (`/markets`) — “What are the actual market numbers?” a
  deterministic data workspace (indexes, sectors, macro, breadth, anomalies).
- **Intelligence** (`/intelligence`) — “Why does the market look this way, what
  is unusual, and what evidence supports those conclusions?” an analyst
  investigation workspace: regime read, the AI Market Brief, Top-Overall
  anomalies, catalyst matches, and a source-linked Evidence Explorer.

Intelligence deliberately does not repeat the full Markets workspace — no Major
Indexes, no full Macro Dashboard, no Sector Rotation table.

## Page structure

1. Intelligence header (deterministic signals · grounded AI · source-linked
   evidence)
2. Market Regime (reuses regime-v1 presentation; drivers prominent)
3. Sakura AI Market Brief (reuses `AiMarketBriefPanel`/`AiMarketBriefCard` —
   one AI call, one 180s polling owner)
4. Market Anomalies (anomaly-v1 Top Overall; “Trace evidence” focuses the
   explorer on `anomaly.<TICKER>` + `catalyst.<TICKER>.*`)
5. Catalyst Intelligence (catalyst-match-v1 — `MATCHED` /
   `NO CLEAR CATALYST FOUND`, never causal language)
6. Evidence Explorer (core V1.1B feature)

## Evidence Explorer source contract

- Endpoint: `GET /api/ai/evidence` (`runtime = nodejs`, `force-dynamic`,
  `Cache-Control: no-store`).
- Demo: builds the sealed `buildDemoBriefContext()`; live: builds
  `buildLiveBriefContext()`.
- Response uses the **same model-facing evidence projection the AI brief is
  grounded on** — `projectBriefContext(context)` — plus `context.fingerprint`.
  No second evidence contract, no `EvidenceFact.data`, no provider payloads, no
  prompts, no API keys, no reasoning content.

Fields returned per evidence fact: `id`, `domain`, `text`, `asOf`,
`freshness`, `confidence`, `sourceVersion`. Source metas are returned for all
six families; input confidence and fingerprint are returned at context level.

Explicit live failure returns `503 {status:"unavailable"}` and never falls back
to demo.

## Fingerprint alignment semantics

The AI Brief endpoint and Evidence Explorer each build a context independently,
so live timestamps can move between them.

- AI Brief `contextFingerprint` == Explorer fingerprint → subtle
  **EVIDENCE ALIGNED**.
- Different fingerprints → **EVIDENCE UPDATED** with “Market evidence has
  updated since this brief was generated.” This is not an error and never
  pretends the current explorer generated the displayed brief.
- Fingerprint is shown debug-style (`fp ab12cd34…`), never as a dominant hash.

## UI interactions

- **Show evidence** on AI key drivers / notable moves sends that claim’s
  `evidenceRefs` to the Explorer (default Overview card is unchanged when the
  callback is absent).
- Anomaly **Trace evidence** filters the Explorer to that anomaly/catalyst
  evidence.
- Explorer filters: domain, freshness, and a client-side ticker/ID/text search
  (no embeddings, no semantic search). Ordering preserves the sealed stable-id
  ordering for “All”.

## Source Health

Six source metas are shown (Market, Macro, Regime, Breadth, Anomalies,
Catalysts) with availability/freshness/confidence. Freshness is never a market
opinion: stale is a data-quality state; delayed-SIP is expected, not degraded;
unavailable sources are shown honestly without a fake neutral fact.

## Partial failure

If one source is unavailable the explorer still renders every other fact.
Other Intelligence modules (regime, AI brief, anomalies, catalysts) fail
independently.

## Boundaries

- Evidence Explorer is deterministic and read-only: no LLM calls, no
  summarization, no freeform answers.
- No new anomaly/regime/breadth scoring and no client reranking.
- Ask Sakura (chat / question input / answer generation) is explicitly deferred
  to V1.1C.
