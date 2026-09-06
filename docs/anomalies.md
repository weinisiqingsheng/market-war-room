# Phase 5 — S&P 500 Market Anomaly Scanner (anomaly-v1)

A deterministic statistical anomaly detector over the S&P 500 using Alpaca
**delayed-SIP** data (15-minute delay). It answers _"which S&P 500 stocks are
behaving unusually right now?"_ — it is NOT a recommendation engine, NOT a
prediction model, and NOT a catalyst explanation system.

## Statistical definition + provenance

- Universe: `sp500-v1` (503 symbols incl. share classes), version-controlled,
  never scraped at runtime. GICS sector is captured during offline generation.
- Feed: `15M DELAYED SIP` — never labeled LIVE, never called full-US-market.
- Sector-relative comparisons use the SAME delayed-SIP sector-ETF feed (never
  delayed-SIP stocks vs live-IEX sector moves).

## Score weights (anomaly-v1)

Return Shock 35% · Sector Divergence 20% · Gap Shock 15% · Range Expansion 15%
· Volume Participation 10% · Breakout/Breakdown 5%. Components are renormalized
over what is available; **Return Shock is mandatory** for primary ranking, and
securities need ≥21 completed sessions (≥20 daily returns) to qualify.

## Exact formulas

- dailyMovePct = (current − prevClose)/prevClose·100; direction up/down/flat.
- returnVol20 = sample σ of last 20 completed close-to-close % returns; sigma =
  |move| / max(returnVol20, 0.50%); map 0→0,1→25,2→60,3→85,4+→100.
- sector divergence = stock move − same-feed sector-ETF move; sigma normalized
  vs the stock's own 20D volatility (map 0→0,0.5→20,1→40,2→75,3+→100).
- gap = (open−prevClose)/prevClose·100; ATR20 (mean true range of 20 completed
  sessions); gapAtrRatio = |gap|/max(ATR20%, 0.2%); map 0→0,0.5→30,1→60,2+→100.
- rangeExpansionRatio = current true range / ATR20; map 0.5→10,1→40,1.5→70,2+→100.
- volumeParticipation = current session volume / avg volume of last 20 completed
  sessions — this is a fraction-of-normal-day traded, NOT a same-time RVOL
  (no intraday time-of-day profile exists in V1); map 0.3→0,0.6→20,1→45,1.5→70,2.5+→100.
- 20D breakout/breakdown vs the high/low of the previous 20 completed sessions
  (current forming session excluded).

## Split-adjustment semantics

Anomaly history requests `adjustment=split`. Close-to-close returns, ATR and
20D ranges are computed on the split-adjusted series so stock splits never
fabricate anomalies; raw and adjusted series are never mixed.

## Severity + ranking

Score ≥80 EXTREME · ≥65 HIGH · ≥50 ELEVATED · <50 NORMAL (upper bucket owns the
boundary). Ranking: score desc → return-sigma desc → |move| desc → ticker
alphabetical. Top overall 8, top positive 5, top negative 5 — negative 4σ moves
rank exactly as strongly as positive 4σ moves.

## Quality / stale semantics

coveragePct = eligible/scanner universe. Confidence ≥95% high · ≥85% medium ·
≥70% low · <70% insufficient (no ranking published as reliable when
insufficient). During an open session, if the newest snapshot trade is older
than delayed-SIP expectations the feed is flagged stale (never silently ranked).

## Known anomaly-v1 limitations

- 15-minute delayed data: scans are snapshots in time, not real-time.
- Volume participation is not time-of-day-adjusted (documented V1 limitation).
- No catalyst/news/earnings context: reasons are statistical only.
- Universe static between regenerations (survivorship/drift).
- Deterministic heuristic; not a prediction model; does not forecast returns.
- Not integrated into regime-v1 or breadth-v1 (any future integration would be
  a new engine version).
