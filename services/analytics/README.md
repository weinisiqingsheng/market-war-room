# Market War Room — Analytics Service

Python **FastAPI** service for Market War Room.

## Phase 3 scope — regime engine

The service hosts the deterministic, explainable Market Regime engine (the
single scoring implementation — Next.js only transports normalized data):

```text
POST /v1/regime/evaluate     RegimeInput → RegimeResult (deterministic)
GET  /health                 liveness probe
```

Input/output contracts: `app/models.py`. Scoring: `app/regime/engine.py`
(all thresholds in `app/regime/constants.py`). The engine is a heuristic, not a
prediction model; see `../docs/regime-engine.md` for design and known limits.

```json
GET /health
{ "status": "ok", "service": "market-war-room-analytics" }
```

## Run locally

```bash
cd services/analytics
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn app.main:app --reload --port 8000
```

Then visit http://localhost:8000/health (or the interactive docs at
http://localhost:8000/docs).

## Test

```bash
cd services/analytics
.venv/bin/pytest -q
```

## Layout

```text
services/analytics/
├── app/
│   ├── __init__.py
│   ├── main.py            # FastAPI app: /health + regime router
│   ├── models.py          # Pydantic RegimeInput/RegimeResult contracts
│   ├── regime/
│   │   ├── constants.py   # every weight/threshold (single source of truth)
│   │   └── engine.py      # deterministic six-pillar scoring engine
│   └── routers/
│       └── regime.py      # POST /v1/regime/evaluate
├── tests/
│   ├── helpers.py
│   ├── test_health.py
│   ├── test_regime_scoring.py
│   ├── test_regime_pillars.py
│   └── test_regime_api.py
├── pyproject.toml
└── requirements.txt
```
