# Ask Sakura — Grounded Backend (V1.1C)

## Product purpose

Ask Sakura answers questions about the **current grounded Market War Room
evidence** — why a name moved, what catalyst evidence matches, whether breadth
is weak, what the macro backdrop looks like, what looks unusual. It is not a
general-purpose chat endpoint: the LLM is never the market-data source.

## Pipeline

```
Question
  → current BriefContext (demo or live builder)
  → safe model-facing evidence projection
  → deterministic evidence selection
  → LLM synthesis
  → ask-sakura-v1 schema
  → deterministic grounding validation
  → accepted answer / insufficient / unavailable
```

## ask-sakura-v1 contract

`{ version: "ask-sakura-v1", status: "answered"|"insufficient_evidence"|"out_of_scope",
answer: {text, evidenceRefs[0-8]}, supportingPoints[0-5], limitations[0-3] }`.

- `answer.text` is non-empty for every status.
- Every factual prose item carries evidence refs; procedural limitations may be
  empty.
- No model confidence is invented.

## API

`POST /api/ai/ask-sakura` — Node, force-dynamic, `Cache-Control: no-store`.
`GET` returns 405. Body: `{ "question": string }` (trimmed, 2–500 chars, no
extra privileged fields such as `systemPrompt`, `model`, `provider`,
`temperature`, or raw context).

Response fields: `mode`, `status`
(`generated` / `insufficient_grounded_data` / `unavailable`),
`contextFingerprint`, `inputConfidence`, `selectedFactCount`, `answer`, and a
safe `reason` enum on failure. Raw context, `EvidenceFact.data`, prompts,
provider payloads, `reasoning_content`, and keys are never exposed.

## Context source

Demo uses `buildDemoBriefContext()`; live uses `buildLiveBriefContext()`.
Explicit live failure never falls back to demo. If
`inputConfidence.label === "insufficient"` there are zero LLM calls.

## Evidence selection policy (deterministic)

`select-evidence.ts` — pure, high-recall, no LLM/embeddings/scoring:

- **Explicit ticker in the question** (only symbols actually present in the
  Evidence Pack): that ticker’s anomaly/catalyst facts plus
  market/sector/macro/regime/breadth context. Other tickers’ company-specific
  catalysts are excluded.
- **No explicit ticker**: the full safe Evidence Pack.
- Unknown uppercase tokens (WHY/USA/AI/CPI…) are not tickers.

## Prompt security

`ask-sakura` has its own system prompt: evidence and user question are both
untrusted delimited DATA, outside knowledge is forbidden, instructions in
evidence cannot override system rules, secrets are never revealed, no
predictions/trading advice, catalyst `.none` is never explained by guessing, and
stale means freshness not bearishness. The exact JSON contract is explicit.

## Grounding validator

Pure deterministic validator (`grounding-validator.ts`) checks:

1. schema validity
2. all refs exist in the selected pack
3. answered prose has refs
4. numbers match referenced `EvidenceFact.text` (no arithmetic)
5. no absolute causality (`caused`, `because`, `due to`, `driven by`,
   `led to`, `resulted in`)
6. no invented future events
7. catalyst refs align to discussed tickers
8. `catalyst.<TICKER>.none` cannot be contradicted
9. catalyst evidence strength cannot be overstated
10. out-of-scope answers are procedural only (grounded-market boilerplate, no
    outside facts)

## Status semantics

- **answered**: evidence materially supports a grounded answer.
- **insufficient_evidence**: market-related but unsupported; the model can cite
  the limiting facts (e.g. `anomaly.KLAC` + `catalyst.KLAC.none`).
- **out_of_scope**: non-market / personal / poetic / general knowledge question
  — the only allowed answer is the grounded-market-evidence limitation.

## Orchestration

`generate.ts` runs a first provider attempt, then at most **one** repair for
schema/grounding issues. Repair reuses the same question and same selected
evidence. Provider auth/rate-limit/timeout/server errors are never repaired.
Total attempts ≤ 2.

## Boundaries

- No conversation history — every request is independent and stateless.
- No streaming — grounding completes before one JSON response is returned.
- No question-answer caching.
- No chat UI (deferred to V1.1D).
