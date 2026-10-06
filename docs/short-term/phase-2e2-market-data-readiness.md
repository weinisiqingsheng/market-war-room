# Phase 2E.2 Forward Pilot Market-Data Readiness

## Scope

This is a read-only readiness record. It does not make Jev requests, create
new predictions, collect outcomes, or change the existing application.

## Host/runtime evidence

The Codex sandbox could not reach Alpaca: DNS/fetch failures were reported by
the existing production ticker dependencies for clock, assets, snapshots, and
bars. A separately approved host-context diagnostic reached the same official
Alpaca endpoints without exposing credentials: `paper-api.alpaca.markets` clock
and NVDA asset returned HTTP 200; `data.alpaca.markets` delayed-SIP snapshot and
IEX historical-bar probes returned HTTP 200. The sandbox is therefore not a
valid live-provider acceptance environment; the local host path is the
documented operator path.

## Feed policy

Policy version: `short-term-forward-market-data-policy-v1`.

- Decision input: Alpaca delayed-SIP snapshot (`feed=delayed_sip`), 15-minute
  delay, delayed freshness, regular-session semantics, structured prices only.
- Outcome input: Alpaca SIP `1Day` bar (`feed=sip`), split-adjusted, daily-bar
  close (`daily_bar_close_split_adjusted`), available only after the declared
  delayed-SIP observation point.
- Cross-feed rule: delayed-SIP decision state to SIP outcome is explicit and
  permitted only for the same Alpaca source and declared adjustment convention.
- No fallback from a missing or mismatched feed is permitted. Feed, delay,
  freshness, adjustment, timestamps, provenance, completeness, and calendar
  eligibility fail closed.
- `.env.local` reports `ALPACA_DATA_FEED=iex` for a generic market-data layer;
  the existing ticker-research path used by this bridge has its own explicit
  delayed-SIP/SIP policy. These are separate layers and are not silently
  substituted.

The policy version is frozen into every forward prediction record. The private
runner asserts the decision feed, delay, and freshness before any Jev transport
is reached.

## Read-only three-symbol acceptance

At capture time `2026-09-28T03:42:03.492Z`–`03:42:05.472Z`, the existing
`researchTicker()` plus the isolated bridge produced verified, complete
decision snapshots for NVDA, TSLA, and AAPL. All three reported the same
effective market session (`2026-09-25`, closed), delayed-SIP feed, 15-minute
delay, delayed freshness, and target NYSE session close
`2026-09-28T20:00:00.000Z`; the conservative outcome observation point is
`2026-09-28T20:15:00.000Z`. State and source fingerprints are retained in the
operator report and are not reused as new prediction records here.

## Operator guardrails

The private command is only:

```text
node scripts/run-short-term-forward-real-pilot.mjs --confirm CONFIRM_PHASE_2E_1_REAL_FORWARD_PILOT
```

The isolated runner requires the exact confirmation, the pinned
`jev-1.13.0` configuration, server-side credentials, exactly NVDA/TSLA/AAPL,
one sequential request per symbol, zero retries, at most three requests, and a
USD 0.10 estimated-cost ceiling. It validates and durably stores each
prediction before any future outcome can be considered and never reads an
outcome while constructing a prediction. This command was inspected only; it
was not executed in this readiness phase.

## Classification

`READY_FOR_AUTHORIZED_FORWARD_PILOT` on the local host path, subject to a new
explicit user authorization. The Codex sandbox remains unsuitable for live
provider acceptance. No real Jev request, prediction record, outcome record,
commit, or push was made in Phase 2E.2.
