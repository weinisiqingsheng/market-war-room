"""Regime API endpoint contract tests (POST /v1/regime/evaluate)."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app
from tests.helpers import make_input

client = TestClient(app)


def _neutral_payload() -> dict:
    payload = make_input().model_dump(mode="json")
    return payload


def test_evaluate_returns_deterministic_result():
    response = client.post("/v1/regime/evaluate", json=_neutral_payload())
    assert response.status_code == 200
    body = response.json()
    assert body["score"] == pytest.approx(50.0)
    assert body["display_score"] == 50
    assert body["label"] == "CAUTIOUS / NEUTRAL"
    assert body["coverage"] == pytest.approx(1.0)
    assert body["confidence"] == "high"
    assert body["engine_version"] == "regime-v1"
    assert body["as_of"] == "2026-09-01T12:00:00Z"

    # Six components with configured weights summing to 1.
    assert [c["id"] for c in body["components"]] == [
        "equity", "sectors", "volatility", "rates", "macro", "crypto",
    ]
    assert sum(c["weight"] for c in body["components"]) == pytest.approx(1.0)

    # Both driver lists are present and shaped correctly.
    for driver in body["positive_drivers"] + body["negative_drivers"]:
        assert {"id", "name", "direction", "impact", "reason"} <= set(driver)


def test_evaluate_rejects_malformed_input():
    # Change_pct must be a number, not arbitrary text.
    payload = _neutral_payload()
    payload["indices"][0]["change_pct"] = "not-a-number"
    response = client.post("/v1/regime/evaluate", json=payload)
    assert response.status_code == 422


def test_evaluate_rejects_unknown_fields():
    payload = _neutral_payload()
    payload["color_theme"] = "sakura"
    response = client.post("/v1/regime/evaluate", json=payload)
    assert response.status_code == 422


def test_evaluate_empty_body_returns_insufficient_data():
    # {} is schema-valid (everything defaults to missing) → never a 500, and
    # never a fabricated numeric score.
    response = client.post("/v1/regime/evaluate", json={})
    assert response.status_code == 200
    body = response.json()
    assert body["score"] is None
    assert body["label"] == "Insufficient Data"
    assert body["confidence"] == "insufficient"


def test_insufficient_data_payload_round_trip():
    macro = _neutral_payload()["macro"]
    for key in ["us10y", "usd_broad", "wti", "gold", "btc"]:
        macro[key] = {"value": None, "change": None, "change_pct": None,
                      "available": False, "stale": False}
    macro["vix"]["stale"] = True
    payload = {
        "as_of": "2026-09-01T12:00:00Z",
        "indices": [],
        "sectors": [],
        "macro": macro,
    }
    response = client.post("/v1/regime/evaluate", json=payload)
    assert response.status_code == 200
    body = response.json()
    assert body["score"] is None
    assert body["label"] == "Insufficient Data"
    assert body["confidence"] == "insufficient"


def test_health_still_works():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "market-war-room-analytics"}
