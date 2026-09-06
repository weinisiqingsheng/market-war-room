"""Regime engine — scoring utilities, mapping, labels, determinism."""

from __future__ import annotations

import pytest

from app.regime.engine import (
    classify_score,
    clamp,
    confidence_for,
    piecewise,
    weighted_mean,
)


def test_clamp_bounds():
    assert clamp(150) == 100
    assert clamp(-5) == 0
    assert clamp(42) == 42
    assert clamp(42, 10, 60) == 42


def test_piecewise_interpolates_linearly():
    points = [(-2.0, 0.0), (-1.0, 25.0), (0.0, 50.0), (1.0, 75.0), (2.0, 100.0)]
    # Midpoint between -1 (25) and 0 (50) → 37.5
    assert piecewise(-0.5, points) == pytest.approx(37.5)
    # Clamp below the first and above the last point.
    assert piecewise(-3.0, points) == 0.0
    assert piecewise(3.0, points) == 100.0


def test_piecewise_exact_points():
    points = [(-2.0, 0.0), (-1.0, 25.0), (0.0, 50.0)]
    assert piecewise(-2.0, points) == 0.0
    assert piecewise(0.0, points) == 50.0


def test_piecewise_rejects_empty_points():
    with pytest.raises(ValueError):
        piecewise(0.0, [])


def test_weighted_mean():
    assert weighted_mean([(100.0, 1.0), (0.0, 1.0)]) == pytest.approx(50.0)
    assert weighted_mean([(50.0, 3.0)]) == pytest.approx(50.0)
    with pytest.raises(ValueError):
        weighted_mean([])


# ── Label boundaries (upper boundary belongs to the higher bucket) ────────

def test_label_boundaries_exact():
    assert classify_score(70.0) == "STRONG RISK-ON"
    assert classify_score(55.0) == "RISK-ON"
    assert classify_score(40.0) == "CAUTIOUS / NEUTRAL"
    assert classify_score(25.0) == "RISK-OFF"
    assert classify_score(0.0) == "EXTREME RISK-OFF"


def test_label_boundaries_just_below():
    assert classify_score(69.99) == "RISK-ON"
    assert classify_score(54.99) == "CAUTIOUS / NEUTRAL"
    assert classify_score(39.99) == "RISK-OFF"
    assert classify_score(24.99) == "EXTREME RISK-OFF"


def test_label_regions():
    assert classify_score(100.0) == "STRONG RISK-ON"
    assert classify_score(88.0) == "STRONG RISK-ON"
    assert classify_score(64.0) == "RISK-ON"
    assert classify_score(47.0) == "CAUTIOUS / NEUTRAL"
    assert classify_score(31.0) == "RISK-OFF"
    assert classify_score(12.0) == "EXTREME RISK-OFF"


# ── Confidence ────────────────────────────────────────────────────────────

def test_confidence_bands():
    assert confidence_for(0.85) == "high"
    assert confidence_for(0.90) == "high"
    assert confidence_for(0.65) == "medium"
    assert confidence_for(0.70) == "medium"
    assert confidence_for(0.50) == "low"
    assert confidence_for(0.60) == "low"
    assert confidence_for(0.49) == "insufficient"
    assert confidence_for(0.0) == "insufficient"
