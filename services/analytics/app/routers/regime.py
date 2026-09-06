"""Regime evaluation endpoint.

POST /v1/regime/evaluate
  body: RegimeInput (normalized domain data only)
  → 200 RegimeResult
  → 422 for malformed input (Pydantic validation)
"""

from fastapi import APIRouter

from app.models import RegimeInput, RegimeResult
from app.regime.engine import evaluate

router = APIRouter(prefix="/v1/regime", tags=["regime"])


@router.post("/evaluate", response_model=RegimeResult)
def evaluate_regime(payload: RegimeInput) -> RegimeResult:
    """Deterministic regime score for a normalized market snapshot."""
    return evaluate(payload)
