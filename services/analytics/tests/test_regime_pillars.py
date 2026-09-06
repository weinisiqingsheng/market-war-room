"""Regime engine — pillar scoring, coverage, drivers, determinism."""

from __future__ import annotations

import json

import pytest

from app.regime import constants as C
from app.regime.engine import evaluate

from tests.helpers import make_input, make_macro, macro_signal
from tests.helpers import SECTOR_TICKERS


def component(result, pillar_id):
    return next(c for c in result.components if c.id == pillar_id)


def _all_sector_changes(value: float) -> dict[str, float]:
    return {t: value for t in SECTOR_TICKERS}


# ── Equity tape ───────────────────────────────────────────────────────────

def test_equity_all_zero_is_neutral():
    result = evaluate(make_input())
    assert component(result, "equity").score == pytest.approx(50.0)
    assert result.score == pytest.approx(50.0, abs=0.5)
    assert result.confidence == "high"


def test_equity_broad_selloff_is_low():
    result = evaluate(
        make_input(
            index_changes={"SPY": -2.0, "QQQ": -1.5, "IWM": -2.5, "DIA": -1.0},
            sector_changes=_all_sector_changes(-1.0),
        )
    )
    equity = component(result, "equity")
    assert equity.score == pytest.approx(0.35 * 0 + 0.30 * 12.5 + 0.25 * 0 + 0.10 * 25)
    assert equity.score < 10
    assert result.score < 50


def test_equity_broad_rally_is_high():
    result = evaluate(
        make_input(
            index_changes={"SPY": 2.0, "QQQ": 1.5, "IWM": 2.5, "DIA": 1.0},
            sector_changes=_all_sector_changes(1.0),
        )
    )
    equity = component(result, "equity")
    assert equity.score == pytest.approx(0.35 * 100 + 0.30 * 87.5 + 0.25 * 100 + 0.10 * 75)
    assert equity.score > 70
    assert result.score > 55


def test_equity_small_cap_weakness_is_negative():
    result = evaluate(
        make_input(
            index_changes={"SPY": 0.0, "QQQ": 0.0, "IWM": -1.8, "DIA": 0.0},
            sector_changes=_all_sector_changes(0.0),
        )
    )
    equity = component(result, "equity")
    # Neutral indices score 50; IWM at -1.8% maps to 5 (weighted 25%).
    assert equity.score == pytest.approx(0.35 * 50 + 0.30 * 50 + 0.25 * 5 + 0.10 * 50)
    assert result.score < 50


def test_equity_missing_index_renormalizes_without_neutral_50():
    # Only SPY is provided (+2%): its score is 100 and is never diluted to 50.
    result = evaluate(
        make_input(
            index_changes={"SPY": 2.0},
            index_overrides={
                "QQQ": {"available": False},
                "IWM": {"available": False},
                "DIA": {"available": False},
            },
        )
    )
    equity = component(result, "equity")
    assert equity.score == pytest.approx(100.0)
    assert "index:QQQ" in result.missing_inputs
    assert result.coverage < 1.0


# ── Sectors ───────────────────────────────────────────────────────────────

def test_sectors_all_neutral():
    result = evaluate(make_input())
    assert component(result, "sectors").score == pytest.approx(50.0)


def test_sectors_broad_participation_strong():
    result = evaluate(make_input(sector_changes=_all_sector_changes(1.5)))
    sector = component(result, "sectors")
    assert sector.score == pytest.approx(0.65 * 87.5 + 0.35 * 50.0)


def test_sectors_broad_participation_weak():
    result = evaluate(make_input(sector_changes=_all_sector_changes(-1.5)))
    sector = component(result, "sectors")
    assert sector.score == pytest.approx(0.65 * 12.5 + 0.35 * 50.0)
    assert sector.score < 50


def test_sectors_cyclicals_outperform_defensives():
    changes = {t: 2.0 for t in C.CYCLICAL_BASKET}
    changes.update({t: -2.0 for t in C.DEFENSIVE_BASKET})
    result = evaluate(make_input(sector_changes=changes))
    sector = component(result, "sectors")
    assert sector.score > 60
    leaders = [d for d in result.positive_drivers if d.id == "sector_leadership"]
    assert leaders
    assert "Cyclicals outperformed defensives" in leaders[0].reason


def test_sectors_defensives_outperform_cyclicals():
    changes = {t: -2.0 for t in C.CYCLICAL_BASKET}
    changes.update({t: 2.0 for t in C.DEFENSIVE_BASKET})
    result = evaluate(make_input(sector_changes=changes))
    sector = component(result, "sectors")
    assert sector.score < 50
    defenders = [d for d in result.negative_drivers if d.id == "sector_leadership"]
    assert defenders
    assert "Defensives outperformed cyclicals" in defenders[0].reason


def test_sectors_energy_only_leadership_does_not_create_risk_on():
    # XLE strongly up while the whole tape is weak: Energy is NOT cyclical
    # leadership, so this must read weak — never strong risk-on.
    changes = {t: -2.0 for t in SECTOR_TICKERS}
    changes["XLE"] = 2.0
    result = evaluate(make_input(sector_changes=changes))
    sector = component(result, "sectors")
    assert sector.score < 30
    assert result.score < 50
    assert result.label not in ("RISK-ON", "STRONG RISK-ON")


# ── Volatility ────────────────────────────────────────────────────────────

def test_vix_low():
    macro = make_macro(vix_value=12.0, vix_change_pct=0.0)
    result = evaluate(make_input(macro=macro))
    assert component(result, "volatility").score == pytest.approx(0.8 * 100 + 0.2 * 50)


def test_vix_high():
    macro = make_macro(vix_value=40.0, vix_change_pct=0.0)
    result = evaluate(make_input(macro=macro))
    assert component(result, "volatility").score == pytest.approx(0.8 * 0 + 0.2 * 50)


def test_vix_rising_is_risk_negative():
    macro = make_macro(vix_value=18.0, vix_change_pct=5.0)
    result = evaluate(make_input(macro=macro))
    assert component(result, "volatility").score == pytest.approx(0.8 * 70 + 0.2 * 25)


def test_vix_falling_is_risk_positive():
    macro = make_macro(vix_value=20.0, vix_change_pct=-10.0)
    result = evaluate(make_input(macro=macro))
    assert component(result, "volatility").score > 60


def test_vix_missing_change_uses_level_only_and_reduces_coverage():
    macro = make_macro(vix=macro_signal(value=22.0, change_pct=None))
    result = evaluate(make_input(macro=macro))
    vol = component(result, "volatility")
    assert vol.score == pytest.approx(50.0)
    full = evaluate(make_input(macro=make_macro(vix_value=22.0, vix_change_pct=0.0)))
    assert result.coverage < full.coverage


# ── Rates ─────────────────────────────────────────────────────────────────

def test_rates_positive_bps_points():
    for bps, move_score in [(20.0, 0.0), (10.0, 25.0), (0.0, 50.0), (-10.0, 75.0), (-20.0, 100.0)]:
        macro = make_macro(us10y_value=4.5, us10y_change=bps / 100.0)
        result = evaluate(make_input(macro=macro))
        rates = component(result, "rates")
        assert rates.score == pytest.approx(0.8 * move_score + 0.2 * 50)


def test_rates_absolute_yield_is_small_modifier():
    high = evaluate(make_input(macro=make_macro(us10y_value=5.5, us10y_change=0.0)))
    low = evaluate(make_input(macro=make_macro(us10y_value=3.5, us10y_change=0.0)))
    assert component(low, "rates").score > component(high, "rates").score
    assert abs(component(high, "rates").score - 50) <= 35


# ── Macro pressure ────────────────────────────────────────────────────────

def test_macro_wti_surge_is_inflation_risk():
    macro = make_macro(wti_change_pct=4.0)
    result = evaluate(make_input(macro=macro))
    m = component(result, "macro")
    assert m.score == pytest.approx((8 * 0 + 5 * 50 + 2 * 50) / 15)


def test_macro_wti_collapse_is_relief():
    macro = make_macro(wti_change_pct=-4.0)
    result = evaluate(make_input(macro=macro))
    m = component(result, "macro")
    assert m.score == pytest.approx((8 * 100 + 5 * 50 + 2 * 50) / 15)


def test_macro_usd_strengthening_is_headwind():
    macro = make_macro(usd_change_pct=1.0)
    result = evaluate(make_input(macro=macro))
    m = component(result, "macro")
    assert m.score == pytest.approx((8 * 50 + 5 * 0 + 2 * 50) / 15)


def test_macro_usd_weakening_is_tailwind():
    macro = make_macro(usd_change_pct=-1.0)
    result = evaluate(make_input(macro=macro))
    m = component(result, "macro")
    assert m.score == pytest.approx((8 * 50 + 5 * 100 + 2 * 50) / 15)


def test_macro_gold_has_only_limited_influence():
    # Even an extreme +20% gold move can only nudge the pillar within the band.
    up = make_macro(gold_change_pct=20.0)
    down = make_macro(gold_change_pct=-20.0)
    up_result = component(evaluate(make_input(macro=up)), "macro").score
    down_result = component(evaluate(make_input(macro=down)), "macro").score
    assert 40 <= up_result <= 52
    assert 48 <= down_result <= 60
    assert up_result < down_result


# ── Crypto ────────────────────────────────────────────────────────────────

def test_btc_pillars():
    assert component(evaluate(make_input(macro=make_macro(btc_change_pct=5.0))), "crypto").score \
        == pytest.approx(100.0)
    assert component(evaluate(make_input(macro=make_macro(btc_change_pct=0.0))), "crypto").score \
        == pytest.approx(50.0)
    assert component(evaluate(make_input(macro=make_macro(btc_change_pct=-5.0))), "crypto").score \
        == pytest.approx(0.0)


def test_btc_missing_change_is_not_neutral_50():
    macro = make_macro(btc=macro_signal(value=60000.0, change_pct=None))
    result = evaluate(make_input(macro=macro))
    crypto = component(result, "crypto")
    assert crypto.score is None
    assert result.coverage < 1.0



# ── Coverage, quality, insufficient data ──────────────────────────────────

def test_coverage_all_fresh_is_1():
    result = evaluate(make_input())
    assert result.coverage == pytest.approx(1.0)
    assert result.confidence == "high"


def test_coverage_one_stale_macro_input():
    macro = make_macro(vix=macro_signal(value=22.0, change_pct=0.0, stale=True))
    result = evaluate(make_input(macro=macro))
    assert result.coverage == pytest.approx(1.0 - 0.15 * 0.5)
    assert result.confidence == "high"
    assert "vix" in result.stale_inputs


def test_coverage_one_missing_macro_input():
    macro = make_macro(wti=macro_signal(value=None, change_pct=None, available=False))
    result = evaluate(make_input(macro=macro))
    expected_loss = 0.15 * (8.0 / 15.0)
    assert result.coverage == pytest.approx(1.0 - expected_loss)
    assert "macro:wti" in result.missing_inputs


def test_coverage_entire_pillar_missing():
    result = evaluate(make_input(sectors=[]))
    assert result.coverage == pytest.approx(1.0 - 0.20)
    assert result.missing_inputs  # every sector reported missing


def test_coverage_mixed_stale_and_missing():
    macro = make_macro(
        vix=macro_signal(value=22.0, change_pct=0.0, stale=True),
        wti=macro_signal(value=None, change_pct=None, available=False),
    )
    result = evaluate(make_input(macro=macro))
    assert result.coverage < 1.0
    assert result.coverage > 0.7
    assert result.confidence in ("high", "medium")


def test_insufficient_coverage_never_publishes_a_score():
    # Only SPY (fresh) plus VIX are available — well below the 0.50 band.
    from app.models import RegimeIndexInput

    macro = make_macro()
    macro.wti = macro_signal(available=False, value=None, change_pct=None)
    macro.us10y = macro_signal(available=False, value=None, change=None)
    macro.usd_broad = macro_signal(available=False, value=None, change_pct=None)
    macro.gold = macro_signal(available=False, value=None, change_pct=None)
    macro.btc = macro_signal(available=False, value=None, change_pct=None)
    result = evaluate(
        make_input(
            index_changes={"SPY": 0.0},
            index_overrides={"QQQ": {"available": False}, "IWM": {"available": False},
                             "DIA": {"available": False}},
            sectors=[],
            macro=macro,
        )
    )
    assert result.confidence == "insufficient"
    assert result.score is None
    assert result.display_score is None
    assert result.label == "Insufficient Data"


# ── Drivers + determinism + engine metadata ───────────────────────────────

def test_driver_reasons_and_signs():
    macro = make_macro(us10y_value=4.5, us10y_change=0.15)  # +15 bp → risk-off
    result = evaluate(
        make_input(
            index_changes={"SPY": 2.0, "QQQ": 2.0, "IWM": 2.0, "DIA": 2.0},
            sector_changes=_all_sector_changes(1.0),
            macro=macro,
        )
    )
    pos_ids = [d.id for d in result.positive_drivers]
    neg_ids = [d.id for d in result.negative_drivers]
    assert "SPY" in pos_ids
    assert any(d.id == "us10y" and d.reason == "US 10Y rose 15 bp" for d in result.negative_drivers)
    # Positive drivers sorted by decreasing impact; negative by most-negative first.
    pos_impacts = [d.impact for d in result.positive_drivers]
    neg_impacts = [d.impact for d in result.negative_drivers]
    assert pos_impacts == sorted(pos_impacts, reverse=True)
    assert neg_impacts == sorted(neg_impacts)
    assert all(d.impact > 0 for d in result.positive_drivers)
    assert all(d.impact < 0 for d in result.negative_drivers)
    # Both lists present when the data supports it.
    assert pos_ids and neg_ids


def test_drivers_top_three_maximum():
    macro = make_macro(wti_change_pct=4.0)  # negative driver
    result = evaluate(
        make_input(
            index_changes={"SPY": -2.0, "QQQ": -2.0, "IWM": -2.0, "DIA": -2.0},
            sector_changes=_all_sector_changes(-2.0),
            macro=macro,
        )
    )
    assert len(result.negative_drivers) <= 3
    assert len(result.positive_drivers) <= 3


def test_driver_reason_is_deterministic_template():
    macro = make_macro(wti_change_pct=3.1)
    result = evaluate(make_input(macro=macro))
    wti = next(d for d in result.negative_drivers if d.id == "wti")
    assert wti.reason == "WTI rose 3.1%, increasing inflation pressure"


def test_same_input_always_returns_identical_result():
    payload = make_input(
        index_changes={"SPY": -0.4, "QQQ": -0.6, "IWM": -1.2, "DIA": -0.3},
        sector_changes={t: -0.3 for t in SECTOR_TICKERS},
        macro=make_macro(us10y_change=0.08, vix_value=17.0, vix_change_pct=2.0),
    )
    first = json.dumps(evaluate(payload).model_dump(mode="json"), sort_keys=True)
    second = json.dumps(evaluate(payload).model_dump(mode="json"), sort_keys=True)
    assert first == second


def test_engine_version_and_component_weights():
    result = evaluate(make_input())
    assert result.engine_version == "regime-v1"
    total = sum(c.weight for c in result.components)
    assert total == pytest.approx(1.0)
    assert result.display_score == 50

