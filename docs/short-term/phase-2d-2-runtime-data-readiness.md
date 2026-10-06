# Short-Term Phase 2D.2 Runtime and Data Readiness

Phase 2D.2 adds only private runtime and outcome-readiness safeguards. It does
not enable real Jev, add a public execution route, or create prospective
records.

## Fixture-only script runner

Run the existing prospective fixture entrypoint through the project-local
Node-native alias runner:

```bash
node scripts/run-short-term-prospective-pilot.mjs --dry-run
```

The runner accepts exactly `--dry-run`. It refuses `--real`, does not load a
TypeSafe credential, and launches Node with type stripping plus a process-local
resolver for the existing `@/` alias. The resolver also maps `server-only` to a
private CLI stub; it does not affect Next.js, browser code, or global module
resolution.

## Authoritative regular-session calendar

`apps/web/lib/short-term/prospective/calendar.ts` embeds the published NYSE
core-session schedule for 2026–2028 and declares its source and version:

- Source: <https://www.nyse.com/trade/hours-calendars>
- Version: `nyse-core-session-2026-2028-v1`
- Coverage: 2026-01-01 through 2028-12-31 only
- Core session: 09:30–16:00 America/New_York; published early closes at 13:00
  America/New_York

The adapter returns `null` outside coverage, on weekends, and on official NYSE
holiday closures. It uses `Intl` with `America/New_York` to calculate UTC
instants, including daylight-saving transitions. It does not poll an exchange
calendar or infer unknown sessions from weekdays.

## Future daily-close provenance

The production observation adapter uses the existing injected
`createProductionTickerDeps().fetchBars` capability only. For an eligible
close-based horizon, a completed observation carries independent metadata:

- provider: `alpaca`
- feed: `sip`
- price reference: split-adjusted one-day bar close
- source version: `alpaca-v2-stocks-bars-1day-sip-split-v1`
- source fingerprint: SHA-256 of the provider configuration and observed bar

It never copies feed or freshness from the frozen decision. A future daily bar
is accepted only after the published delayed-SIP window has elapsed, the
authoritative calendar has a regular session for the date, and the response has
a matching bar timestamp and finite close. Missing bar metadata, a provider
failure, an incomplete/delayed window, or missing independent provenance yields
`not_observable`.

One-hour observations remain unavailable because the approved production
dependency exposes daily bars only. A session-close decision at or after its
same-session close is rejected; next-session-close uses the next session from
the injected calendar.

## Outcome schema

New outcomes use `short-term-prospective-outcome-v2`. Frozen decision records
remain `short-term-prospective-decision-v1` and are never changed. There were no
stored prospective outcomes to migrate. V2 adds independent observation
availability, freshness, delay, price-reference type, source version, and
source fingerprint fields.
