# Roadmap

| Phase | Deliverable                                                                                                                         | Status         |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| 0A    | UI foundation — approved Sakura Finance homepage on typed demo data; analytics service skeleton (`/health`)                         | ✅ Done        |
| 0B    | Visual fidelity audit + UI polish                                                                                                   | ✅ Done        |
| 1     | Real market data — index + sector ETFs and market clock via Alpaca (IEX); demo/live modes                                           | ✅ Done        |
| 2     | Live Macro Pulse — VIX/US 10Y/Broad USD/WTI (FRED), Gold (Twelve Data), BTC (Alpaca); per-source freshness                          | ✅ **Current** |
| 3     | Market regime engine — six-pillar deterministic regime engine (Python analytics), live Market Regime + drivers, coverage/confidence | ✅ Done        |
| 4     | Market breadth — S&P 500 delayed-SIP breadth-v1 (Next.js) ✅ · sector-rotation live engine pending                                  | Planned        |
| 5     | S&P 500 anomaly scanner — delayed-SIP anomaly-v1 statistical scanner (Next.js) ✅ · catalyst engine pending                         | Planned        |
| 6     | Catalyst engine — news → market impact chains                                                                                       | Planned        |
| 7     | AI market brief — grounded, sourced daily brief (LLM)                                                                               | Planned        |
| 8     | Ask War Room — grounded conversational Q&A                                                                                          | Planned        |
| 9     | Historical intelligence — regime/breadth history, comparisons                                                                       | Planned        |
| 10    | Production polish — auth, observability, hardening, scale                                                                           | Planned        |

## Guardrails

- Each phase replaces one demo-data module with a real provider while keeping
  the `@war-room/types` contracts — UI components do not change shape.
- The analytics service grows routers per engine (regime, anomalies,
  catalysts) rather than one monolithic endpoint.
- Demo fixtures stay available behind an explicit mode flag once real data
  lands, so the design can always be reviewed without a data dependency.
