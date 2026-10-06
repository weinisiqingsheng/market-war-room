# Short-Term Phase 2C — Jev Score Audit and Evaluation Foundation

Phase 2C is an offline evaluation foundation. It does not make Jev requests, create market outcomes, change the `/short-term` Mock UI, or expose real Jev results through public routes.

## Score contract audit

TypeSafe defines a Score as a probability-weighted value across the caller-defined ordered rubric levels. With the existing `downside_concern` rubric:

```text
0 = Low
1 = Moderate
2 = High
```

the valid score interval is `[0, 2]`, and fractional values are expected. The pilot's AAPL score of `1.01` is valid because:

```text
0 × 0.22 + 1 × 0.55 + 2 × 0.23 = 1.01
```

This value is a rubric-weighted judgment. It is not a probability of a stock-price decline, a return forecast, or a calibrated risk probability. Choice and Score confidence values are also model-derived certainty fields, not validated financial outcome probabilities.

The isolated `auditScoreAnswer` helper checks:

- exact legend and probability keys for the ordered rubric;
- finite probabilities in `[0, 1]` whose total is `1 ± 1e-6`;
- finite Score values within `[0, criteria.length - 1]`;
- agreement between the returned Score and the probability-weighted level value within `1e-6`;
- the existing `[0, 1]` confidence range.

The production validator now calls the same audit after its existing response, rubric, probability, legend, model, question-ID, confidence, and usage checks. It preserves `short-term-jev-questions-v1`, accepts fractional in-range responses such as `1.01`, and rejects out-of-range, malformed, or non-weighted responses. The `1e-6` threshold is only a numerical-comparison tolerance; the TypeSafe API documentation does not define a provider rounding rule, so no broader historical-compatibility tolerance is applied. The exact historical TSLA discrepancy is handled only by the separate, identity-scoped audit annotation below and cannot bypass production validation.

## Shadow-record integrity and durable retention

The original pilot file remains at:

```text
/private/tmp/market-war-room/jev-shadow/real-pilot-1789963084204.jsonl
```

It was verified before this phase and was not moved, overwritten, deleted, or uploaded. It contains three sanitized records with distinct run/state/source fingerprints, verified-market input labels, real-model output labels, timestamps, provenance, usage, latency, and typed answers. The file remains temporary and may not survive host cleanup.

The new durable store is opt-in and separate from the existing temporary store. Its default destination is outside the repository:

```text
~/.local/share/market-war-room/jev-shadow/records.jsonl
```

The storage contract is:

- directory mode `0700` and JSONL mode `0600`;
- absolute paths only, with repository paths rejected;
- append-only semantics with explicit `retentionDays` (default policy: 90 days);
- exclusive lock file for one writer at a time;
- complete-file replacement through same-directory temporary write, `fsync`, and atomic rename;
- duplicate `runId` rejection;
- malformed or partial existing JSONL causes a fail-closed error and no overwrite;
- retention pruning is explicit and timestamp-based;
- no Git ignore rule is needed because the default location is outside the repository, and repository paths are rejected.

No migration or copy of the original `/private/tmp` record is performed by Phase 2C.

## Frozen prospective evaluation contract

Each evaluation begins with a versioned `short-term-evaluation-input-v1` snapshot containing the decision timestamp, effective market timestamp, market session, feed and delay labels, freshness, availability, state fingerprint, source fingerprint, question-set version, and model ID. It does not include information observed after the decision boundary.

Prospective outcomes use `short-term-evaluation-outcome-v1` and must specify:

- `observedAt`, strictly after both the requested and effective timestamps;
- the applicable market `sessionDate`;
- one horizon: `one_hour`, `session_close`, or `next_session_close`;
- a named benchmark, such as `SPY`;
- one observable label: `up`, `flat`, `down`, or `not_observable`.

Weekend and holiday observations use the next valid regular session rather than fabricated bars. Extended-hours data must retain its feed/session label and must not be compared with regular-session outcomes without an explicit protocol. Delayed or stale snapshots retain their original delay and freshness metadata. Partial or unavailable provider fields remain missing; evaluators never synthesize values or silently substitute demo data. If an outcome cannot be observed under the declared session rule, the label is `not_observable`.

The four Jev questions remain separate tasks:

1. current market-condition classification;
2. evidence sufficiency;
3. downside concern on the supplied facts;
4. manual-review requirement.

None is treated as a future directional prediction.

## Baselines and metrics

The offline foundation supports the following measurements:

- typed-response validity, including the Score audit;
- provenance/fingerprint completeness;
- latency and reported input/output cost;
- missing and stale availability fields;
- repeat-input stability using the same frozen state fingerprint;
- evidence-change sensitivity by comparing outputs after a deliberate frozen-input change;
- classification agreement only when an independently defined label exists;
- forward-outcome scoring only after the outcome is frozen independently of Jev.

The naive no-change baseline is `flat`. A historical-frequency baseline selects the predeclared most frequent label with deterministic tie ordering. These are comparison rules, not claims about market behavior. No baseline is compared with Jev until paired frozen observations exist.

Calibration metrics such as Brier score are not applied to Jev confidence or Score probabilities. They are only appropriate when the evaluated probability has a defensible meaning and matches an independently observed outcome label.

The three pilot records are retrospective audit material. They do not provide enough repeated, prospective, or independently labeled observations to establish predictive accuracy, calibration, incremental value, or trading usefulness.

## Phase 2C.1 historical compatibility annotation

The stored TSLA record is retained exactly as written, including its original `modelOutputStatus: real_jev_model_output`. Its separate audit annotation is:

```text
status: weighted_consistency_unverified
runId: short-term-1981f035e3c261a384354a87
stateFingerprint: 1981f035e3c261a384354a87fdd3f3a5ac887951cb56bd979cebdcf39e73e007
reason: stored Score 0.93 differs from the 0.94 weighted result; no higher-precision provider data or documented rounding rule is available
```

This exception is scoped to that exact run ID, ticker, Score, probabilities, and state fingerprint. It is not a TSLA, model-version, or historical-record exemption. The record is excluded from verified-consistency metrics. New provider responses still fail closed on the same inconsistency through the production validator.

The private pilot script now writes future explicitly authorized Shadow Records through the durable store at `~/.local/share/market-war-room/jev-shadow/records.jsonl` (or its test-injected equivalent). The script remains server-only, manually invoked, confirmation-gated, budget-bounded, and fixture-only unless both existing real-pilot flags are supplied.
