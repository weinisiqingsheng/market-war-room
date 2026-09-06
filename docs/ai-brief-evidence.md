# AI Brief — Grounded Evidence Layer (Phase 7A)

Phase 7A delivers the deterministic evidence layer only. There is **no LLM** yet.

## 1. brief-context-v1 purpose
A fully inspectable, deterministic fact bank describing the current validated
market state. `BriefContext` = six source families + bounded `EvidenceFact[]` +
input confidence + SHA-256 fingerprint. It is the ONLY factual input a future
grounded generation layer (Phase 7B) may consume.

## 2. Phase 7A architecture
Normalized domain outputs → `buildEvidenceFacts` → `computeBriefInputConfidence`
→ `fingerprintBriefEvidence` → `buildBriefContext` (assembler). No fetch, no
env, no network, no `Date.now` in the assembler (generatedAt is supplied).

## 3. EvidenceFact contract
`{ id, domain, text, data (JSON-safe), asOf, freshness, confidence,
sourceVersion }`. Text is deterministic, display-rounded code output — no
interpretation.

## 4. Stable evidence IDs
`market.spy|qqq|iwm|dia`, `sector.*` (11 fixed ETFs), `macro.vix|us10y|
usdBroad|wti|gold|btc`, `regime.overall|driver.(positive|negative).1..3`,
`breadth.summary|advanceRatio|above20|above50|highLow`,
`anomaly.<TICKER>`, `catalyst.<TICKER>.primary|none`.

## 5. Bounded evidence
Max 4 market + 11 sectors + 6 macro + 7 regime + 5 breadth + 8 anomalies +
8 catalysts = ≤50 facts; builder throws above the hard ceiling. Catalysts align
only to included anomaly tickers.

## 6. Per-domain timestamps
Each fact carries its own `asOf`/freshness: market IEX `fresh`, breadth/anomalies
delayed-SIP `delayed`, catalysts keyed to `catalystCutoff`, macro signals carry
their cadence (daily FRED can be `stale`). Never a single fake universal "as of".

## 7. Freshness semantics
fresh 1.0 · delayed 0.95 · stale 0.75 · unavailable 0.0. Delayed SIP is
high-quality, not poor data. Freshness is never converted into direction.

## 8–10. Input-confidence formula
`quality = availability × freshness × reportedConfidence × coverage ×
reliability`; `score = Σ(weight × quality)` with weights Market 0.20, Macro
0.15, Regime 0.20, Breadth 0.15, Anomalies 0.15, Catalysts 0.15 (no
renormalization when a domain is missing). `reliabilityFactor` is a generic
0–1 degradation multiplier (e.g. 0.9 for a catalysts domain with one
supplemental provider degraded) — confidence.ts knows no provider names.
Labels: ≥0.90 high · ≥0.75 medium · ≥0.60 low · <0.60 insufficient.

## 11–12. Fingerprint inputs/exclusions
SHA-256 over canonical sorted-key serialization of sources metadata, all
evidence facts (id/domain/text/data/asOf/freshness/confidence/sourceVersion),
and inputConfidence. Evidence arrays are sorted by stable id before hashing;
nested data arrays keep semantic order. `generatedAt` (and the fingerprint
itself) are excluded so orchestration time alone never changes the digest.

## 13. Friday-like demo fixture
`demo-context.ts` (fixed generatedAt `2026-09-06T01:30:00.000Z`) models the
validated Friday state: cautious/neutral regime 49, breadth 24 / Broad Selloff,
low VIX, WTI pressure, LULU/FICO/EFX/ADSK/PTC/ADBE/BEN/KLAC anomalies, strong
GUIDANCE (LULU) and REGULATORY / LEGAL (FICO/EFX), moderate MANAGEMENT (ADBE),
and NO CLEAR CATALYST for KLAC/ADSK/PTC/BEN. 49 facts, input confidence high.

## 14. Why no LLM in Phase 7A
Generation is the next phase; the evidence layer must first be stable,
deterministic, bounded, and testable so an LLM can never be a data source.

## 15. Phase 7B contract
Phase 7B receives ONLY the assembled `BriefContext` (facts + source metadata +
confidence + fingerprint) as its factual input. Every generated claim must
resolve to an evidence ID; the evidence layer stays read-only and sealed.
