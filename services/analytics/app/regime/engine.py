"""Deterministic regime scoring engine (canonical implementation).

This module is the single source of truth for regime scoring. TypeScript holds
matching transport/domain types only — it never re-implements the scoring.

Philosophy:
- 0 = strongly risk-off, 50 = neutral, 100 = strongly risk-on.
- Unavailable inputs are NEVER replaced with neutral 50.
- Scores are computed from available inputs; weights are renormalized among
  available components; coverage is computed separately and communicated via
  confidence instead of mechanically dragging the market toward neutral.
- Every threshold lives in `constants.py`.

This is a deterministic market-regime heuristic. It is NOT a prediction model
and does not forecast future returns.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field

from app.models import (
    MacroInput,
    RegimeComponentScore,
    RegimeDriverAttribution,
    RegimeIndexInput,
    RegimeInput,
    RegimeResult,
    RegimeSectorInput,
)
from app.regime import constants as C

MACRO_KEYS = ["vix", "us10y", "usd_broad", "wti", "gold", "btc"]


# ── Generic scoring utilities ─────────────────────────────────────────────

def clamp(value: float, low: float = 0.0, high: float = 100.0) -> float:
    return max(low, min(high, value))


def piecewise(x: float, points: list[tuple[float, float]]) -> float:
    """Linear interpolation across (x, y) points; flat/clamped outside range."""
    if not points:
        raise ValueError("piecewise requires at least one point")
    if x <= points[0][0]:
        return points[0][1]
    if x >= points[-1][0]:
        return points[-1][1]
    for (x0, y0), (x1, y1) in zip(points, points[1:]):
        if x0 <= x <= x1:
            span = x1 - x0
            if span == 0:
                return y0
            return y0 + (y1 - y0) * (x - x0) / span
    return points[-1][1]


def weighted_mean(values: list[tuple[float, float]]) -> float:
    total_weight = sum(weight for _, weight in values)
    if total_weight <= 0:
        raise ValueError("weighted_mean requires positive total weight")
    return sum(value * weight for value, weight in values) / total_weight


def mean(values: list[float]) -> float:
    if not values:
        raise ValueError("mean requires at least one value")
    return sum(values) / len(values)


def input_quality(available: bool, stale: bool) -> float:
    """Quality: fresh available = 1.0, stale available = 0.5, unavailable = 0.0."""
    if not available:
        return C.QUALITY_UNAVAILABLE
    return C.QUALITY_STALE if stale else C.QUALITY_FRESH


@dataclass
class Leaf:
    """One scored sub-component with its renormalized within-pillar weight."""

    id: str
    name: str
    score: float
    norm_weight: float
    reason: str


@dataclass
class Pillar:
    id: str
    present: bool
    score: float | None
    quality: float
    leaves: list[Leaf] = field(default_factory=list)


# ── Deterministic description helpers (template language only) ───────────

def _move_word(value: float) -> str:
    return "rose" if value > 0 else ("fell" if value < 0 else "was flat at")


def _fmt_move(value: float) -> str:
    """Movement phrase with a magnitude, e.g. \"rose 1.2%\" / \"fell 0.8%\". No double sign."""
    magnitude = abs(value)
    if value > 0:
        return f"rose {magnitude:.1f}%"
    if value < 0:
        return f"fell {magnitude:.1f}%"
    return "was flat at 0.0%"


def _fmt_pct(value: float) -> str:
    return f"{value:+.1f}%"


# ── Pillar 1 · Equity tape (30%) ──────────────────────────────────────────

def equity_pillar(indices: list[RegimeIndexInput]) -> Pillar:
    by_ticker = {index.ticker: index for index in indices}
    usable: list[tuple[str, float, float]] = []  # (ticker, score, weight)
    leaves: list[Leaf] = []
    quality_sum = 0.0

    for ticker, weight in C.INDEX_WEIGHTS.items():
        signal = by_ticker.get(ticker)
        avail = bool(signal and signal.available)
        quality_sum += weight * input_quality(avail, bool(signal and signal.stale))
        if not (signal and signal.available and signal.change_pct is not None):
            continue
        change_pct = float(signal.change_pct)
        score = piecewise(change_pct, C.EQUITY_TAPE_POINTS)
        usable.append((ticker, score, weight))
        leaves.append(
            Leaf(
                id=ticker,
                name=ticker,
                score=score,
                norm_weight=0.0,  # renormalized once the available weight is known
                reason=f"{ticker} {_fmt_move(change_pct)}",
            )
        )

    available_weight = sum(weight for _, _, weight in usable)
    present = available_weight > 0
    score = weighted_mean([(s, w) for _, s, w in usable]) if present else None
    for leaf in leaves:
        leaf.norm_weight = C.INDEX_WEIGHTS[leaf.id] / available_weight

    total_expected = sum(C.INDEX_WEIGHTS.values())
    return Pillar("equity", present, score, quality_sum / total_expected, leaves)


# ── Pillar 2 · Sector participation (20%) ─────────────────────────────────

def sector_pillar(sectors: list[RegimeSectorInput]) -> Pillar:
    by_ticker = {sector.ticker: sector for sector in sectors}

    def usable_change(ticker: str) -> float | None:
        signal = by_ticker.get(ticker)
        if signal and signal.available and signal.change_pct is not None:
            return float(signal.change_pct)
        return None

    # Participation: equal-weight mean across ALL available sectors.
    participation_changes = [
        change for change in (usable_change(t) for t in C.ALL_SECTOR_ETFS) if change is not None
    ]
    participation_q = (
        mean(
            [
                input_quality(
                    bool((sig := by_ticker.get(t)) and sig.available),
                    bool(sig and sig.stale),
                )
                for t in C.ALL_SECTOR_ETFS
            ]
        )
        if C.ALL_SECTOR_ETFS
        else 0.0
    )

    part_present = len(participation_changes) > 0
    part_score = (
        mean([piecewise(c, C.EQUITY_TAPE_POINTS) for c in participation_changes])
        if part_present
        else None
    )

    # Leadership: cyclical vs defensive averages. XLE is deliberately excluded.
    cyclical = [
        change
        for change in (usable_change(t) for t in sorted(C.CYCLICAL_BASKET))
        if change is not None
    ]
    defensive = [
        change
        for change in (usable_change(t) for t in sorted(C.DEFENSIVE_BASKET))
        if change is not None
    ]
    lead_present = bool(cyclical) and bool(defensive)
    spread = (mean(cyclical) - mean(defensive)) if lead_present else None
    lead_score = piecewise(spread, C.LEADERSHIP_SPREAD_POINTS) if lead_present else None

    basket_tickers = sorted(C.CYCLICAL_BASKET | C.DEFENSIVE_BASKET)
    leadership_q = (
        mean(
            [
                input_quality(
                    bool((sig := by_ticker.get(t)) and sig.available),
                    bool(sig and sig.stale),
                )
                for t in basket_tickers
            ]
        )
        if lead_present
        else 0.0
    )

    present = part_present
    denom = C.SECTOR_PARTICIPATION_WEIGHT + (C.SECTOR_LEADERSHIP_WEIGHT if lead_present else 0.0)
    score = None
    if present:
        weighted = []
        if part_score is not None:
            weighted.append((part_score, C.SECTOR_PARTICIPATION_WEIGHT))
        if lead_score is not None:
            weighted.append((lead_score, C.SECTOR_LEADERSHIP_WEIGHT))
        score = weighted_mean(weighted)

    leaves: list[Leaf] = []
    if present and part_score is not None:
        mean_change = mean(participation_changes)
        direction = "positive" if mean_change > 0 else "negative"
        leaves.append(
            Leaf(
                id="sector_participation",
                name="Sector Participation",
                score=part_score,
                norm_weight=C.SECTOR_PARTICIPATION_WEIGHT / denom,
                reason=f"Broad sector participation was {direction} (mean {_fmt_pct(mean_change)})",
            )
        )
    if lead_present and lead_score is not None and spread is not None:
        if spread >= 0:
            reason = f"Cyclicals outperformed defensives by {spread:.2f}pp"
        else:
            reason = f"Defensives outperformed cyclicals by {abs(spread):.2f}pp"
        leaves.append(
            Leaf(
                id="sector_leadership",
                name="Cyclical vs Defensive",
                score=lead_score,
                norm_weight=C.SECTOR_LEADERSHIP_WEIGHT / denom,
                reason=reason,
            )
        )

    quality = C.SECTOR_PARTICIPATION_WEIGHT * participation_q + (
        C.SECTOR_LEADERSHIP_WEIGHT * leadership_q if lead_present else 0.0
    )
    return Pillar("sectors", present, score, quality, leaves)


# ── Pillar 3 · Volatility (15%) ───────────────────────────────────────────

def volatility_pillar(macro) -> Pillar:
    signal = getattr(macro, "vix", None)
    avail = bool(signal and signal.available)
    if not avail or signal.value is None:
        return Pillar("volatility", False, None, 0.0)

    level_score = piecewise(float(signal.value), C.VIX_LEVEL_POINTS)
    has_change = signal.change_pct is not None
    change_score = (
        clamp(50.0 - float(signal.change_pct) * C.VIX_CHANGE_SLOPE) if has_change else None
    )

    total_sub = C.VIX_LEVEL_WEIGHT + C.VIX_CHANGE_WEIGHT
    denom = C.VIX_LEVEL_WEIGHT + (C.VIX_CHANGE_WEIGHT if has_change else 0.0)
    score = C.VIX_LEVEL_WEIGHT * level_score
    if change_score is not None:
        score += C.VIX_CHANGE_WEIGHT * change_score
    score = score / denom

    quality = input_quality(avail, bool(signal.stale)) * (denom / total_sub)

    level_value = float(signal.value)
    if level_value <= 16.0:
        level_reason = f"VIX is low at {level_value:.1f}"
    elif level_value <= 25.0:
        level_reason = f"VIX is moderate at {level_value:.1f}"
    else:
        level_reason = f"VIX is elevated at {level_value:.1f}"

    leaves = [
        Leaf(
            id="vix_level",
            name="VIX Level",
            score=level_score,
            norm_weight=C.VIX_LEVEL_WEIGHT / denom,
            reason=level_reason,
        )
    ]
    if change_score is not None:
        leaves.append(
            Leaf(
                id="vix_change",
                name="VIX Change",
                score=change_score,
                norm_weight=C.VIX_CHANGE_WEIGHT / denom,
                reason=f"VIX {_fmt_move(float(signal.change_pct))} to {level_value:.1f}",
            )
        )
    return Pillar("volatility", True, score, quality, leaves)


# ── Pillar 4 · Rates (15%) ────────────────────────────────────────────────

def rates_pillar(macro) -> Pillar:
    signal = getattr(macro, "us10y", None)
    avail = bool(signal and signal.available)
    if not avail or signal.value is None:
        return Pillar("rates", False, None, 0.0)

    value = float(signal.value)
    level_score = piecewise(value, C.YIELD_LEVEL_POINTS)
    has_move = signal.change is not None
    move_score = piecewise(float(signal.change) * 100.0, C.RATES_MOVE_POINTS) if has_move else None

    total_sub = C.RATES_MOVE_WEIGHT + C.RATES_LEVEL_WEIGHT
    denom = C.RATES_MOVE_WEIGHT * int(has_move) + C.RATES_LEVEL_WEIGHT
    score = C.RATES_LEVEL_WEIGHT * level_score
    if move_score is not None:
        score += C.RATES_MOVE_WEIGHT * move_score
    score = score / denom

    quality = input_quality(avail, bool(signal.stale)) * (denom / total_sub)

    leaves: list[Leaf] = []
    if move_score is not None:
        bps = float(signal.change) * 100.0
        move_reason = (
            f"US 10Y {_move_word(bps)} {abs(bps):.0f} bp" if bps != 0 else "US 10Y unchanged"
        )
        leaves.append(
            Leaf(
                id="us10y",
                name="US 10Y",
                score=move_score,
                norm_weight=C.RATES_MOVE_WEIGHT / denom,
                reason=move_reason,
            )
        )
    leaves.append(
        Leaf(
            id="us10y_level",
            name="US 10Y Level",
            score=level_score,
            norm_weight=C.RATES_LEVEL_WEIGHT / denom,
            reason=f"US 10Y yield at {value:.2f}%",
        )
    )
    return Pillar("rates", True, score, quality, leaves)


# ── Pillar 5 · Macro pressure (15%) ───────────────────────────────────────

def macro_pillar(macro) -> Pillar:
    leaves: list[Leaf] = []
    weighted: list[tuple[float, float]] = []
    quality_sum = 0.0

    for key, importance in C.MACRO_IMPORTANCE.items():
        signal = getattr(macro, key, None) if macro else None
        avail = bool(signal and signal.available)
        usable = bool(signal and signal.available and signal.change_pct is not None)
        quality_sum += importance * (
            input_quality(avail, bool(signal and signal.stale)) if usable else 0.0
        )
        if not usable:
            continue
        change_pct = float(signal.change_pct)
        if key == "wti":
            score = piecewise(change_pct, C.WTI_POINTS)
            if change_pct > 0:
                reason = f"WTI rose {change_pct:.1f}%, increasing inflation pressure"
            elif change_pct < 0:
                reason = f"WTI fell {abs(change_pct):.1f}%, easing inflation pressure"
            else:
                reason = "WTI was flat"
        elif key == "usd_broad":
            score = piecewise(change_pct, C.USD_BROAD_POINTS)
            if change_pct > 0:
                reason = f"Broad USD strengthened {change_pct:.1f}%"
            elif change_pct < 0:
                reason = f"Broad USD weakened {abs(change_pct):.1f}%"
            else:
                reason = "Broad USD was flat"
        else:  # gold
            score = clamp(
                50.0 - change_pct * C.GOLD_CHANGE_SLOPE, C.GOLD_SCORE_MIN, C.GOLD_SCORE_MAX
            )
            if change_pct > 0:
                reason = f"Gold rose {change_pct:.1f}% (mild stress signal)"
            elif change_pct < 0:
                reason = f"Gold fell {abs(change_pct):.1f}% (mild support signal)"
            else:
                reason = "Gold was flat"
        weighted.append((score, importance))
        leaves.append(
            Leaf(
                id=key,
                name=C.MACRO_DISPLAY_NAMES[key],
                score=score,
                norm_weight=0.0,
                reason=reason,
            )
        )

    available_importance = sum(importance for _, importance in weighted)
    present = available_importance > 0
    score = weighted_mean(weighted) if present else None
    for leaf in leaves:
        leaf.norm_weight = C.MACRO_IMPORTANCE[leaf.id] / available_importance

    return Pillar(
        "macro",
        present,
        score,
        quality_sum / C.MACRO_IMPORTANCE_TOTAL,
        leaves,
    )


# ── Pillar 6 · Crypto risk appetite (5%) ──────────────────────────────────

def crypto_pillar(macro) -> Pillar:
    signal = getattr(macro, "btc", None) if macro else None
    usable = bool(signal and signal.available and signal.change_pct is not None)
    if not usable:
        return Pillar("crypto", False, None, 0.0)
    change_pct = float(signal.change_pct)
    score = piecewise(change_pct, C.BTC_POINTS)
    quality = input_quality(True, bool(signal.stale))
    leaves = [
        Leaf(
            id="btc",
            name="BTC",
            score=score,
            norm_weight=1.0,
            reason=f"BTC {_fmt_move(change_pct)}",
        )
    ]
    return Pillar("crypto", True, score, quality, leaves)


# ── Classification ────────────────────────────────────────────────────────

def classify_score(score: float) -> str:
    """Deterministic label from the score. Boundaries belong to the upper bucket."""
    if score >= 70.0:
        return C.LABEL_STRONG_RISK_ON
    if score >= 55.0:
        return C.LABEL_RISK_ON
    if score >= 40.0:
        return C.LABEL_CAUTIOUS
    if score >= 25.0:
        return C.LABEL_RISK_OFF
    return C.LABEL_EXTREME_RISK_OFF


def confidence_for(coverage: float) -> str:
    if coverage >= C.CONFIDENCE_HIGH:
        return "high"
    if coverage >= C.CONFIDENCE_MEDIUM:
        return "medium"
    if coverage >= C.CONFIDENCE_LOW:
        return "low"
    return "insufficient"


# ── Input quality reporting ───────────────────────────────────────────────

def stale_ids(indices, sectors, macro) -> list[str]:
    ids: list[str] = []
    for index in indices:
        if index.available and index.stale:
            ids.append(index.ticker)
    for sector in sectors:
        if sector.available and sector.stale:
            ids.append(sector.ticker)
    if macro:
        for key in MACRO_KEYS:
            signal = getattr(macro, key, None)
            if signal and signal.available and signal.stale:
                ids.append(key)
    return ids


def evaluate(payload: RegimeInput) -> RegimeResult:
    indices = payload.indices or []
    sectors = payload.sectors or []
    macro = payload.macro or MacroInput()

    pillars = [
        equity_pillar(indices),
        sector_pillar(sectors),
        volatility_pillar(macro),
        rates_pillar(macro),
        macro_pillar(macro),
        crypto_pillar(macro),
    ]

    drivers = _collect_drivers(pillars)
    positive = sorted(
        (d for d in drivers if d["impact"] > 0), key=lambda d: (-d["impact"], d["id"])
    )[:3]
    negative = sorted(
        (d for d in drivers if d["impact"] < 0), key=lambda d: (d["impact"], d["id"])
    )[:3]

    coverage = sum(C.PILLAR_WEIGHTS[p.id] * p.quality for p in pillars)
    confidence = confidence_for(coverage)

    present = [p for p in pillars if p.present and p.score is not None]
    overall_score = (
        weighted_mean([(p.score, C.PILLAR_WEIGHTS[p.id]) for p in present])
        if present
        else None
    )

    if confidence == "insufficient":
        score: float | None = None
        label = C.LABEL_INSUFFICIENT
        display_score: int | None = None
    else:
        score = overall_score
        label = classify_score(score) if score is not None else C.LABEL_INSUFFICIENT
        display_score = int(math.floor(score + 0.5)) if score is not None else None

    components = [
        RegimeComponentScore(id=p.id, name=C.PILLAR_NAMES[p.id], score=p.score,
                             weight=C.PILLAR_WEIGHTS[p.id])
        for p in pillars
    ]

    return RegimeResult(
        score=score,
        display_score=display_score,
        label=label,
        coverage=coverage,
        confidence=confidence,
        components=components,
        positive_drivers=[_driver_out(d) for d in positive],
        negative_drivers=[_driver_out(d) for d in negative],
        stale_inputs=stale_ids(indices, sectors, macro),
        missing_inputs=_missing_ids(indices, sectors, macro),
        as_of=payload.as_of,
        engine_version=C.ENGINE_VERSION,
    )


def _collect_drivers(pillars: list[Pillar]) -> list[dict]:
    drivers: list[dict] = []
    for pillar in pillars:
        if not pillar.present:
            continue
        pillar_weight = C.PILLAR_WEIGHTS[pillar.id]
        for leaf in pillar.leaves:
            impact = pillar_weight * leaf.norm_weight * (leaf.score - 50.0)
            if abs(impact) < C.DRIVER_MIN_ABS_IMPACT:
                continue
            drivers.append(
                {
                    "id": leaf.id,
                    "name": leaf.name,
                    "impact": round(impact, 1),
                    "reason": leaf.reason,
                }
            )
    return drivers


def _driver_out(driver: dict) -> RegimeDriverAttribution:
    direction = "positive" if driver["impact"] > 0 else "negative"
    return RegimeDriverAttribution(
        id=driver["id"],
        name=driver["name"],
        direction=direction,
        impact=driver["impact"],
        reason=driver["reason"],
    )


def _missing_ids(indices, sectors, macro) -> list[str]:
    index_map = {index.ticker: index for index in indices}
    sector_map = {sector.ticker: sector for sector in sectors}
    missing: list[str] = []
    for ticker in C.INDEX_WEIGHTS:
        if not index_map.get(ticker) or not index_map[ticker].available:
            missing.append(f"index:{ticker}")
    for ticker in C.ALL_SECTOR_ETFS:
        if not sector_map.get(ticker) or not sector_map[ticker].available:
            missing.append(f"sector:{ticker}")
    for key in MACRO_KEYS:
        signal = getattr(macro, key, None) if macro else None
        if not signal or not signal.available:
            missing.append(f"macro:{key}")
    return missing

