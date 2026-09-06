from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_returns_ok():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "market-war-room-analytics"}


def test_health_has_content_type_json():
    response = client.get("/health")
    assert response.headers["content-type"].startswith("application/json")
