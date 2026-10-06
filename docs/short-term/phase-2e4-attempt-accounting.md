# Phase 2E.4 Attempt Accounting

Phase 2E.4 adds an append-only lifecycle ledger for manually initiated real
forward pilots. It does not change the Phase 2E prediction or outcome
contracts, the question registry, or any public route.

## Lifecycle contract

Each initiated symbol receives an `attemptId` and a monotonically increasing
sequence of immutable events. The supported statuses are:

`ATTEMPT_STARTED`, `MARKET_INPUT_UNAVAILABLE`, `MARKET_INPUT_STALE`,
`SESSION_NOT_ELIGIBLE`, `JEV_TRANSPORT_FAILED`, `JEV_VALIDATION_FAILED`,
`BUDGET_BLOCKED`, `STORAGE_FAILED`, and `PREDICTION_CREATED`.

The terminal event is authoritative for accounting. A prediction is counted as
successful only when a `PREDICTION_CREATED` event links to an existing
`originalDecisionRunId`. Failure and budget/provider/validation/storage counts
are derived from terminal lifecycle states; an attempt with only a started
event remains visible as untracked/in-progress.

## Private storage

Events are stored as JSONL outside the repository at
`$HOME/.local/share/market-war-room/jev-shadow/forward/attempts.jsonl` by
default. The directory is forced to `0700` and the file to `0600`. Appends are
serialized with an exclusive lock, written to a temporary file with `fsync`,
and atomically renamed. Duplicate event IDs, sequence gaps, malformed lines,
and partial records fail closed. The store exposes a 90-day retention prune;
private files are never staged or exposed by an HTTP route.

## Reconciliation

The ledger reports total attempts, successful linked predictions, failed and
blocked attempts, categorized failure counts, untracked attempts, and the
number of attempt-linked predictions that do not match prediction records.
`sourceRecordsMutated` is always `false`; predictions and outcomes remain
separate immutable inputs. Existing accuracy, confusion, baseline, and
forward-performance fields are computed exactly as before and do not treat
attempts as market outcomes.

No real Jev request or market-data request is made by the tests or by this
checkpoint. The manually invoked real runner must still be explicitly
confirmed and now receives the private attempt store from its script entry
point.
