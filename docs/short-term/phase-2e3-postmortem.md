# Phase 2E.3 Forward Pilot Postmortem

The first real Phase 2E v1 experiment is frozen. This document is descriptive
only; it does not retune the prompt, alter the question set, change the label
threshold, or rewrite any prediction or outcome record.

## Immutable inputs

- Prediction JSONL SHA-256: `3e527c3221461fd57ad98181f208f14a44e82fde0d3f6398438af9185bba344b`
- Outcome JSONL SHA-256: `dc6ed0bac7d95cefb1d2929e44a06aaa952e419851802ec188bd8a87f07135c4`
- Task: `next_session_direction_v1`
- Contract: `short-term-forward-direction-v1`
- Question set: `short-term-forward-questions-v1`
- Market-data policy: `short-term-forward-market-data-policy-v1`
- Horizon: `next_session_close`
- Ground truth: UP above `+0.10%`, FLAT inclusive through `±0.10%`, DOWN below `-0.10%`

## Descriptive review

| Symbol | Frozen decision-time evidence                                                                                           | Jev output                                                               | Independent outcome            | Frozen momentum |
| ------ | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------ | --------------- |
| NVDA   | Reference `225.07`, previous close `224.58`, delayed SIP, effective `2026-09-25T20:00:00Z`, evidence sufficiency `0.42` | FLAT; weights `0.27/0.70/0.03`, confidence `0.55`, manual review `false` | `228.86`, `+1.68392056%`, UP   | UP              |
| TSLA   | Reference `372.11`, previous close `377.94`, delayed SIP, effective `2026-09-25T20:00:00Z`, evidence sufficiency `0.37` | DOWN; weights `0.09/0.33/0.58`, confidence `0.36`, manual review `true`  | `357.45`, `-3.93969525%`, DOWN | DOWN            |
| AAPL   | Reference `341.07`, previous close `335.92`, delayed SIP, effective `2026-09-25T20:00:00Z`, evidence sufficiency `0.42` | FLAT; weights `0.47/0.48/0.05`, confidence `0.22`, manual review `false` | `338.40`, `-0.78283050%`, DOWN | UP              |

The table reports stored fields only. It does not infer hidden reasoning or
causal feature importance. Directional alignment is an observation: TSLA's
stored momentum baseline and Jev class both matched DOWN; NVDA's momentum
baseline matched UP while Jev selected FLAT; AAPL's momentum baseline selected
UP while the observed label was DOWN. These are observations, not explanations.

## Cost-reserve postmortem

The original reserve used a character-to-token heuristic multiplied by two.
That represented 6,339 priced input tokens across the batch, while the three
stored responses reported 7,073 input tokens. The provider therefore reported
input usage above that heuristic reserve, so the pre-send reserve of
`$0.00026628` was below the usage-based estimate of `$0.000297066`. The
configured pricing contract charges input tokens at `$0.042 / 1M`; no
output-token price is configured and none is invented here.

The isolated Phase 2E guard now reserves at least the configured
`maxInputTokensPerRequest` under that pricing model, while retaining the hard
three-request and `$0.10` batch ceiling. The guard remains a reserve, not a
claim about actual provider billing.

## Cumulative ledger

`short-term-forward-ledger-v1` is an offline, read-only summary contract. It
groups records by model, task, task version, question-set version, and
market-data-policy version. It reports completed and pending observations,
invalid attempts, explicit validation/market-input/outcome/provider failures,
3x3 confusion matrices, class support, baselines, paired wins/losses/ties, and
version-specific breakdowns. Missing attempt, prediction, or outcome identities
are surfaced as `untrackedAttemptCount`, `untrackedPredictionCount`, or
`untrackedOutcomeCount`; they are never silently discarded.

The three-record experiment is a **pipeline-validation sample**. It is not a
statistical, calibration, predictive-superiority, or profitability result.

## Next pilot readiness

Future manually authorized runs must retain the same v1 task, contract,
question set, market-data policy, horizon, and thresholds. Each prediction
must use a new eligible decision timestamp and target session. No automatic
scheduling, public exposure, broker integration, or real Jev execution is
enabled by this phase.
