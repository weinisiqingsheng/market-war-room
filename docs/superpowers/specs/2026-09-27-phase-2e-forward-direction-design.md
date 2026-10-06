# Phase 2E Explicit Forward Direction Design

## Status and scope

Phase 2E is an additions-only, fixture-first research experiment. It adds a
new forward-direction task without changing the current-state Jev registry,
validator, API routes, Mock UI, Phase 2D records, or shared market contracts.
No real Jev request, live prospective observation, trading action, broker
integration, schedule, or public exposure is included in this phase.

## Task and horizon contract

- Task ID: `next_session_direction_v1`
- Contract version: `short-term-forward-direction-v1`
- Question-set version: `short-term-forward-questions-v1`
- Horizon: `next_session_close` only
- Target session: the next eligible regular NYSE session identified by the
  injected Phase 2 calendar
- Direction classes: `UP`, `FLAT`, `DOWN`

The task is distinct from the existing current-state `market_condition`
question. Existing `bullish`, `mixed`, and `defensive` answers remain current
state only and are never converted into forward predictions.

## Ground truth

The frozen decision reference price is compared with the independently
verified next eligible regular-session closing price. Both prices must be
compatible with the declared adjustment convention. The existing Phase 2D
rule is retained exactly:

- `UP` when return is strictly greater than `+0.10%`.
- `FLAT` when return is greater than or equal to `-0.10%` and less than or
  equal to `+0.10%`.
- `DOWN` when return is strictly less than `-0.10%`.

The future outcome is derived independently from Jev and is never included in
the prediction input.

## Question structure

The forward question explicitly states the frozen decision timestamp, the
effective market timestamp, the current session, the frozen reference price,
the next eligible NYSE session and its close, the `next_session_close`
horizon, and the rule that only supplied evidence available at decision time
may be used. It distinguishes current market state from expected next-session
close direction and requires an uncertainty-preserving class distribution.

The fixture transport uses the same question shape but is clearly labelled as
fixture output. No browser or public route can invoke it.

## Typed output and validation

The isolated forward provider response contains:

- task ID and task version;
- horizon and target session;
- predicted class;
- exact `UP`/`FLAT`/`DOWN` class distribution;
- confidence in `[0,1]`;
- evidence sufficiency in `[0,1]`;
- manual-review boolean;
- pinned model and question-set version;
- non-negative token usage.

The private real-provider bridge sends an isolated three-question Jev registry
(`next_session_direction`, `evidence_sufficiency`, and `manual_review`) and
maps the provider's choice/noul answers into this forward schema. It never
uses the current-state question registry.

Validation requires exact class keys, finite unit values, a sum within
`1e-6`, a valid predicted class, the exact task/horizon versions, and no
future-outcome fields. Class weights are model judgment weights, not calibrated
market-return probabilities.

## Immutable prediction record

`ForwardDirectionPredictionRecord` is separate from the existing
`FrozenProspectiveDecision`, current-state `ShortTermShadowRecord`, and future
`ProspectiveOutcomeRecord`. It links to the original decision by run ID,
ticker, state fingerprint, source fingerprint, decision timestamps, target
session, and horizon. It stores decision-time reference data needed by the
deterministic baseline, but never stores future prices or outcome labels.

Records are deep-frozen before persistence. The private JSONL store is outside
the repository at
`$HOME/.local/share/market-war-room/jev-shadow/forward/predictions.jsonl` by
default. It uses `0700` directories, `0600` files, exclusive lock files,
atomic replacement, duplicate prediction-ID rejection, malformed-record
rejection, and a 90-day retention policy. There is no public storage endpoint.
Each record also includes a SHA-256 output fingerprint, provider latency, and
estimated cost. Fixture preflight uses a temporary store; the real operator
entrypoint is separate and requires explicit confirmation.

## Look-ahead prevention

Prediction construction accepts only a frozen decision and decision-time
market facts. It rejects a target session that is not strictly after the
decision session, invalid or future-dated decision timestamps, stale or
unavailable market input, copied future-outcome fields, and non-verified
provenance when production input is required. Outcomes are linked only during
evaluation after independent observation; they cannot be read by the
prediction builder. A prediction cannot be overwritten by a later model or
question version.

## Baselines

Baselines are declared before any new real pilot:

1. Always `FLAT`.
2. Historical-frequency majority class supplied as a frozen count map; ties
   resolve deterministically in `FLAT`, `UP`, `DOWN` order.
3. Frozen-information momentum: compare decision reference price with
   previous close using the same `±0.10%` band; above is `UP`, below is `DOWN`,
   otherwise `FLAT`.

No baseline is optimized from future outcomes.

## Evaluation metrics

For linked complete outcomes, the evaluator computes multiclass accuracy,
confusion matrix, per-class precision, per-class recall, macro F1, baseline
accuracies, and Jev-minus-baseline deltas. It reports paired wins/losses/ties
against each baseline. Brier score and log loss are intentionally not computed
in this phase because the class distribution is not yet established as a
calibrated probability distribution.

Three observations are pipeline validation only. No predictive superiority,
calibration, or trading-usefulness claim is permitted. Suggested review
milestones are 3 (pipeline), 10–20 (qualitative), 30+ (preliminary
comparison), and 100+ (more meaningful calibration/baseline analysis).

## Failure states and security

The isolated runner distinguishes `PREDICTION_CREATED`,
`PREDICTION_VALIDATION_FAILED`, `MARKET_INPUT_UNAVAILABLE`,
`MARKET_INPUT_STALE`, `SESSION_NOT_ELIGIBLE`, `OUTCOME_PENDING`,
`OUTCOME_NOT_OBSERVABLE`, and `EVALUATION_COMPLETE`. It never maps failure to
`FLAT`.

Real Jev execution remains server-only, manual, explicitly confirmed,
sequential, retry-free, and bounded by request and cost budgets. Phase 2E
offline tooling rejects real mode. Credentials are never accepted from a
browser or persisted in prediction records.

## Acceptance criteria

- All new code is under `apps/web/lib/short-term/forward/` or dedicated tests,
  docs, and private fixture CLI files.
- Existing current-state files and public contracts are unchanged.
- Fixture pilot creates valid immutable predictions and deterministic metrics.
- Default tests make zero real Jev or market-provider requests.
- Focused tests, full web and analytics suites, TypeScript, ESLint, changed-file
  formatting, Webpack, secret scan, and `git diff --check` pass.
- The final status is `PASS_OFFLINE_READY_FOR_FORWARD_PILOT` only after all
  gates pass.
