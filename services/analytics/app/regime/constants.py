"""Regime engine constants — the single source of truth for weights/thresholds.

The engine deliberately reads every magic number from this module so thresholds
can evolve under engine-versioned changes instead of being scattered across
scoring code.
"""

from __future__ import annotations

# ── Pillar weights (must sum to 1.0) ──────────────────────────────────────
PILLAR_WEIGHTS: dict[str, float] = {
    "equity": 0.30,
    "sectors": 0.20,
    "volatility": 0.15,
    "rates": 0.15,
    "macro": 0.15,
    "crypto": 0.05,
}

PILLAR_NAMES: dict[str, str] = {
    "equity": "Equity Tape",
    "sectors": "Sector Participation",
    "volatility": "Volatility",
    "rates": "Rates",
    "macro": "Macro Pressure",
    "crypto": "Crypto Risk Appetite",
}

ENGINE_VERSION = "regime-v1"

# ── Equity tape (pillar: equity) ──────────────────────────────────────────
INDEX_WEIGHTS: dict[str, float] = {
    "SPY": 0.35,
    "QQQ": 0.30,
    "IWM": 0.25,
    "DIA": 0.10,
}

# (return_pct, score) points — linear interpolation, flat/clamped outside.
EQUITY_TAPE_POINTS: list[tuple[float, float]] = [
    (-2.0, 0.0),
    (-1.0, 25.0),
    (0.0, 50.0),
    (1.0, 75.0),
    (2.0, 100.0),
]

# ── Sectors (pillar: sectors) ─────────────────────────────────────────────
SECTOR_PARTICIPATION_WEIGHT = 0.65
SECTOR_LEADERSHIP_WEIGHT = 0.35

CYCLICAL_BASKET = frozenset({"XLK", "XLY", "XLI", "XLF"})
DEFENSIVE_BASKET = frozenset({"XLP", "XLV", "XLU"})

# All 11 sector ETFs the engine expects (denominator for coverage).
ALL_SECTOR_ETFS = [
    "XLK",
    "XLY",
    "XLI",
    "XLF",
    "XLP",
    "XLV",
    "XLU",
    "XLE",
    "XLB",
    "XLRE",
    "XLC",
]

LEADERSHIP_SPREAD_POINTS: list[tuple[float, float]] = [
    (-2.0, 0.0),
    (0.0, 50.0),
    (2.0, 100.0),
]

# ── Volatility (pillar: volatility) ───────────────────────────────────────
VIX_LEVEL_WEIGHT = 0.80
VIX_CHANGE_WEIGHT = 0.20

# (vix level, score) — piecewise, flat/clamped outside the endpoints.
VIX_LEVEL_POINTS: list[tuple[float, float]] = [
    (12.0, 100.0),
    (14.0, 90.0),
    (18.0, 70.0),
    (22.0, 50.0),
    (30.0, 20.0),
    (40.0, 0.0),
]

# score = clamp(50 - vix_change_pct * 5, 0, 100)
VIX_CHANGE_SLOPE = 5.0

# ── Rates (pillar: rates) ─────────────────────────────────────────────────
RATES_MOVE_WEIGHT = 0.80  # daily basis-point move
RATES_LEVEL_WEIGHT = 0.20  # absolute yield modifier (deliberately small)

# (bps_change, score) — decreasing yields are risk-positive.
RATES_MOVE_POINTS: list[tuple[float, float]] = [
    (-20.0, 100.0),
    (-10.0, 75.0),
    (0.0, 50.0),
    (10.0, 25.0),
    (20.0, 0.0),
]

# (absolute yield %, score) — flat/clamped outside the endpoints.
YIELD_LEVEL_POINTS: list[tuple[float, float]] = [
    (3.5, 80.0),
    (4.0, 65.0),
    (4.5, 50.0),
    (5.0, 30.0),
    (5.5, 15.0),
]

# ── Macro pressure (pillar: macro) ────────────────────────────────────────
# Importance weights for WTI / Broad USD / Gold within the macro pillar.
MACRO_IMPORTANCE: dict[str, float] = {
    "wti": 8.0,
    "usd_broad": 5.0,
    "gold": 2.0,
}
MACRO_IMPORTANCE_TOTAL = sum(MACRO_IMPORTANCE.values())  # 15.0

# (change_pct, score) for each macro input. Higher values mean "risk-on".
WTI_POINTS: list[tuple[float, float]] = [
    (-4.0, 100.0),
    (0.0, 50.0),
    (4.0, 0.0),
]

USD_BROAD_POINTS: list[tuple[float, float]] = [
    (-1.0, 100.0),
    (0.0, 50.0),
    (1.0, 0.0),
]

# Gold is ambiguous: a mild stress modifier only, clamped between 35 and 65.
GOLD_CHANGE_SLOPE = 5.0
GOLD_SCORE_MIN = 35.0
GOLD_SCORE_MAX = 65.0

# ── Crypto (pillar: crypto) ───────────────────────────────────────────────
BTC_POINTS: list[tuple[float, float]] = [
    (-5.0, 0.0),
    (0.0, 50.0),
    (5.0, 100.0),
]

# ── Quality / coverage ────────────────────────────────────────────────────
QUALITY_FRESH = 1.0
QUALITY_STALE = 0.5  # stale-but-available data still contributes, at half weight
QUALITY_UNAVAILABLE = 0.0

# Confidence bands on overall coverage.
CONFIDENCE_HIGH = 0.85
CONFIDENCE_MEDIUM = 0.65
CONFIDENCE_LOW = 0.50
# Below CONFIDENCE_LOW the engine refuses to publish a numeric score.

# ── Regime labels (exact boundaries; upper bound belongs to the higher bucket) ──
LABEL_STRONG_RISK_ON = "STRONG RISK-ON"
LABEL_RISK_ON = "RISK-ON"
LABEL_CAUTIOUS = "CAUTIOUS / NEUTRAL"
LABEL_RISK_OFF = "RISK-OFF"
LABEL_EXTREME_RISK_OFF = "EXTREME RISK-OFF"
LABEL_INSUFFICIENT = "Insufficient Data"

# ── Driver attribution ────────────────────────────────────────────────────
# Minimum absolute impact for a driver to be reported.
DRIVER_MIN_ABS_IMPACT = 0.05

MACRO_DISPLAY_NAMES: dict[str, str] = {
    "vix": "VIX",
    "us10y": "US 10Y",
    "usd_broad": "Broad USD",
    "wti": "WTI",
    "gold": "Gold",
    "btc": "BTC",
}

SECTOR_DISPLAY_NAMES: dict[str, str] = {
    "XLK": "Technology",
    "XLF": "Financials",
    "XLE": "Energy",
    "XLV": "Healthcare",
    "XLI": "Industrials",
    "XLP": "Consumer Staples",
    "XLY": "Consumer Discretionary",
    "XLU": "Utilities",
    "XLB": "Materials",
    "XLRE": "Real Estate",
    "XLC": "Communication Services",
}
