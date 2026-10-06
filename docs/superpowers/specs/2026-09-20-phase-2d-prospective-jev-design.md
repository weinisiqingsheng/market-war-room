# Phase 2D Prospective Jev Shadow Evaluation Design

## Goal

Add an isolated, fixture-first prospective evaluation workflow that freezes verified decision-time inputs and Jev outputs, records later independently verified market observations separately, and evaluates only predeclared, defensible mappings.

## Scope and non-goals

- Preserve all existing public routes, the `/short-term` Mock UI, ticker-context contracts, deterministic scoring engines, and historical Shadow Records.
- Make no real Jev or market-provider requests during Phase 2D implementation or verification.
- Do not add trading, broker, prediction-market, scheduling, background execution, or public paid-model activation.
- Existing `bullish`/`mixed`/`defensive` judgments, Score values, confidence, and rubric probabilities remain current-state research outputs. They are not future-return probabilities.

## Architecture

All new workflow code lives under `apps/web/lib/short-term/prospective/`. It composes the existing verified Bridge, Jev service, production Score validator, Shadow Runner, Phase 2C evaluators, and durable storage. Decision and outcome records are separate JSONL record types and are linked by `runId`, `stateFingerprint`, ticker identity, and protocol version.

The production observation adapter uses injected provider capabilities. Existing daily-bar capability supports session-close and next-session-close observations. One-hour production observation is fail-closed as `not_observable` until a verified intraday capability is supplied. Fixture adapters cover every supported horizon and failure state.

## Versioned records

### Frozen decision record: `short-term-prospective-decision-v1`

```ts
interface FrozenProspectiveDecision {
  schemaVersion: "short-term-prospective-decision-v1";
  runId: string;
  ticker: string;
  identity: {
    symbol: string;
    name: string;
    exchange: string | null;
    assetClass: string;
    status: string;
    tradable: boolean;
  };
  strategyId: string;
  horizon: "one_hour" | "session_close" | "next_session_close";
  requestedAt: string;
  effectiveAsOf: string;
  marketSessionDate: string;
  marketSessionStatus: "regular" | "closed";
  referencePrice: number;
  previousClose: number | null;
  feed: string;
  delayMinutes: number | null;
  freshness: "fresh" | "delayed";
  availability: Record<string, boolean>;
  stateFingerprint: string;
  sourceFingerprint: string;
  inputContractVersion: string;
  questionSetVersion: string;
  pinnedModel: string;
  protocolVersion: "short-term-prospective-protocol-v1";
  deterministicBaseline: "flat";
  assessment: {
    answers: unknown;
    usage: unknown;
    latencyMs: number;
    resultStatus: string;
    modelOutputStatus: string;
  };
}
```

The record is produced only from a verified-market Shadow Record, is deep-cloned before storage, and is never updated after append. Structured fact values provide prices; evidence prose is never parsed.

### Outcome record: `short-term-prospective-outcome-v2`

```ts
interface ProspectiveOutcomeRecord {
  schemaVersion: "short-term-prospective-outcome-v2";
  runId: string;
  ticker: string;
  stateFingerprint: string;
  horizon: "one_hour" | "session_close" | "next_session_close";
  decisionEffectiveAsOf: string;
  referencePrice: number;
  observedPrice: number | null;
  observedAt: string | null;
  sessionDate: string | null;
  provider: string | null;
  feed: string | null;
  completeness: "complete" | "partial" | "unavailable";
  returnPct: number | null;
  label: "up" | "flat" | "down" | "not_observable";
  reason: string | null;
}
```

Outcomes are append-only and stored in a separate file. An outcome must reference an existing frozen decision with the same run ID, ticker, and state fingerprint. Duplicate outcomes for the same run/horizon are rejected.

## Horizon and timestamp rules

- `one_hour`: requires an independently verified regular-session observation at or after one elapsed regular trading hour from the frozen reference timestamp. Daily bars cannot satisfy this horizon; production returns `not_observable` when intraday data is unavailable.
- `session_close`: requires the regular close of the frozen session when the decision was captured during that regular session. A decision captured after close is not relabeled as a new intraday window.
- `next_session_close`: requires the next eligible regular session after the frozen session, determined by the injected session calendar and verified observation metadata.
- Weekends, holidays, early closes, halts, incomplete sessions, stale data, delayed timestamps, and provider failures are evaluated by the injected calendar/provider contract. No naive `+24h` or `+1h` arithmetic determines eligibility.
- `observedAt` must be strictly after both `requestedAt` and `effectiveAsOf`; otherwise the outcome is rejected for look-ahead.

## Outcome labels and mapping

Return convention: `returnPct = ((observedPrice - referencePrice) / referencePrice) * 100`. The protocol uses a documented `0.10` percentage-point flat band: `up` when return exceeds `+0.10`, `down` when below `-0.10`, and `flat` otherwise. Missing, stale, incomplete, halted, or unverifiable observations become `not_observable` with a reason.

The current Jev question registry has no defensible future-direction mapping. Therefore forward-performance metrics for existing market-condition, downside-concern, evidence-sufficiency, and manual-review outputs are `not_applicable`. A future-direction question, if later approved, must use a new question-set version and its own mapping/metrics contract.

## Storage and safety

Decision and outcome stores remain outside the repository under the existing local application data root. They use restrictive directory/file permissions, exclusive locks, atomic `fsync` + rename writes, duplicate identity checks, malformed-record fail-closed behavior, and explicit retention. Existing Phase 2C.1 durable Shadow records and the original temporary three-record pilot file are never migrated or rewritten. Real Jev remains a private manually invoked path with explicit confirmation, max three requests, one per symbol, no retries, max `$0.10`, and concurrency one.

## Evaluation

The evaluator first runs the existing Phase 2C/2C.1 response/provenance/Score audit. It then evaluates market-input completeness, stale/missing data, latency, usage/cost, repeated-input stability, controlled evidence-change sensitivity, and paired baseline comparisons. Forward metrics are emitted only when an independently defined output-to-label mapping exists; otherwise they are explicitly `not_applicable`. No calibration metric is applied to Jev confidence or rubric probabilities.

## Verification and acceptance

Fixture-only tests cover immutability, session calendars, horizons, delayed/stale/partial/unavailable data, early closes, look-ahead, fingerprints, labels, duplicate outcomes, historical TSLA exclusion, durable storage, isolation, and the NVDA/TSLA/AAPL dry run. Full web/analytics tests, TypeScript, ESLint, Prettier, Webpack, and secret scanning must pass. No existing route or public contract may change, and no real request may occur.
