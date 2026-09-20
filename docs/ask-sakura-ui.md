# Ask Sakura UI (V1.1D)

## Product scope

Ask Sakura is grounded question answering over the **current Market War Room
evidence** — not “ask me anything”. It will not answer general knowledge,
provide predictions, portfolio/trading advice, or use web search. Example scope:
ticker moves (`Why is FICO down so much?`), catalyst evidence (`Why did KLAC
move?`), breadth, regime, unusual stocks, and macro backdrop.

## Backend endpoint

The UI calls only `POST /api/ai/ask-sakura` with
`{ "question": "<trimmed question>" }`. No model/temperature/system/context/
history fields are sent. The backend is sealed from V1.1C; the browser never
calls DeepSeek or any provider directly.

## Single-turn / stateless behavior

Each question is independent. Submitting a new question replaces the previous
displayed answer. No conversation memory, transcript persistence, chat history,
or localStorage state is kept. Retry only re-sends the **same** last question
and is never automatic.

## No streaming

The UI shows a grounded loading state (`Checking current evidence…`) with no
fake answer text. The full validated JSON answer appears only after grounding
completes.

## Status states

- **Idle**: Ask Sakura title, scope description, input, suggested questions.
- **Submitting**: input stays usable/stable; submit becomes disabled with
  “Checking evidence…” and a polite status.
- **Answered**: structured blocks —
  Answer → Supporting Evidence → Limitations, with raw evidence IDs never shown.
- **insufficient_evidence**: shown as **Limited Evidence** (an honest neutral
  outcome, not an error).
- **out_of_scope**: shown as **Out of Scope** with the grounded procedural
  response.
- **API `insufficient_grounded_data`**: **Current Data Insufficient** copy —
  distinct from the model-level insufficient answer.
- **Unavailable**: “Ask Sakura temporarily unavailable.” with an accessible
  Retry that re-sends the same question.

## Grounded trust signal / metadata

A validated answer shows a quiet `GROUNDED · ask-sakura-v1` badge. Footer shows
`Grounded in N selected facts` (facts, not independent sources) and a compact
`fp abcdef12…` fingerprint when the backend returns one. A `View evidence` link
points to `/intelligence`. No raw `anomaly.FICO` style IDs are rendered in
answer prose.

## Input + keyboard

Placeholder: “Ask about today's market, a ticker, breadth, regime, or
catalysts…” Enter submits; Shift+Enter inserts a newline. Input mirrors client
limits (≥2, ≤500 chars); the server remains authoritative.

## Accessibility / design

The panel keeps the Sakura Finance V3 card: warm gradient surface, structured
answer blocks, labels/aria-live status, accessible submit/Retry, no
chat-bubble/typing-dots styling. Mobile input/buttons/examples wrap and never
overflow horizontally.

## Example questions

- Why is FICO down so much?
- Is market breadth weak?
- Why is the regime cautious?
- What are the most unusual stocks today?

## Deferred

Conversation memory, streaming, voice/file uploads, and multi-turn context are
not part of V1.1D.
