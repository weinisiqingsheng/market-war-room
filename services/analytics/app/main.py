"""Market War Room — Analytics service.

Regime engine (Phase 3): deterministic, explainable market-regime heuristic.
Financial analytics (anomaly detection, catalysts) arrive in later phases and
will plug in as routers here.
"""

from fastapi import FastAPI

from app.routers.regime import router as regime_router

app = FastAPI(
    title="Market War Room Analytics",
    description="Analytics backend for Market War Room. Regime engine is a "
    "deterministic heuristic, not a prediction model.",
    version="0.3.0",
)

app.include_router(regime_router)


@app.get("/health")
def health() -> dict[str, str]:
    """Liveness probe used by CI and the web app."""
    return {"status": "ok", "service": "market-war-room-analytics"}

