"""Shared fixtures/builders for regime engine tests."""

from __future__ import annotations

from app.models import (
    MacroInput,
    MacroSignalInput,
    RegimeIndexInput,
    RegimeInput,
    RegimeSectorInput,
)

INDEX_TICKERS = ["SPY", "QQQ", "IWM", "DIA"]
SECTOR_TICKERS = [
    "XLK", "XLY", "XLI", "XLF", "XLP", "XLV", "XLU",
    "XLE", "XLB", "XLRE", "XLC",
]


def macro_signal(
    value: float | None = 0.0,
    change: float | None = 0.0,
    change_pct: float | None = 0.0,
    available: bool = True,
    stale: bool = False,
) -> MacroSignalInput:
    return MacroSignalInput(
        value=value,
        change=change,
        change_pct=change_pct,
        available=available,
        stale=stale,
    )


def make_macro(
    vix_value: float = 22.0,
    vix_change_pct: float = 0.0,
    us10y_value: float = 4.5,
    us10y_change: float = 0.0,
    wti_change_pct: float = 0.0,
    usd_change_pct: float = 0.0,
    gold_change_pct: float = 0.0,
    btc_change_pct: float = 0.0,
    **overrides,
) -> MacroInput:
    """A neutral macro snapshot by default; override any value with kwargs."""
    base = MacroInput(
        vix=macro_signal(value=vix_value, change_pct=vix_change_pct),
        us10y=macro_signal(value=us10y_value, change=us10y_change),
        usd_broad=macro_signal(value=118.0, change_pct=usd_change_pct),
        wti=macro_signal(value=78.0, change_pct=wti_change_pct),
        gold=macro_signal(value=2400.0, change_pct=gold_change_pct),
        btc=macro_signal(value=62000.0, change_pct=btc_change_pct),
    )
    if "vix" in overrides:
        base.vix = overrides["vix"]
    if "us10y" in overrides:
        base.us10y = overrides["us10y"]
    if "usd_broad" in overrides:
        base.usd_broad = overrides["usd_broad"]
    if "wti" in overrides:
        base.wti = overrides["wti"]
    if "gold" in overrides:
        base.gold = overrides["gold"]
    if "btc" in overrides:
        base.btc = overrides["btc"]
    return base


def make_indices(changes: dict[str, float] | None = None, **overrides):
    """Index inputs; default all returns 0.0 (neutral)."""
    if changes is None:
        changes = {t: 0.0 for t in INDEX_TICKERS}
    inputs = []
    for ticker in INDEX_TICKERS:
        sig = overrides.get(ticker, {})
        inputs.append(
            RegimeIndexInput(
                ticker=ticker,
                change_pct=changes.get(ticker, 0.0),
                available=sig.get("available", True),
                stale=sig.get("stale", False),
            )
        )
    return inputs


def make_sectors(changes: dict[str, float] | None = None, **overrides):
    """Sector inputs; default all returns 0.0 (neutral)."""
    if changes is None:
        changes = {t: 0.0 for t in SECTOR_TICKERS}
    inputs = []
    for ticker in SECTOR_TICKERS:
        sig = overrides.get(ticker, {})
        inputs.append(
            RegimeSectorInput(
                ticker=ticker,
                change_pct=changes.get(ticker, 0.0),
                available=sig.get("available", True),
                stale=sig.get("stale", False),
            )
        )
    return inputs


def make_input(
    index_changes: dict[str, float] | None = None,
    sector_changes: dict[str, float] | None = None,
    macro: MacroInput | None = None,
    sectors: list[RegimeSectorInput] | None = None,
    **overrides,
) -> RegimeInput:
    if sectors is None:
        sectors = make_sectors(sector_changes, **overrides.get("sector_overrides", {}))
    return RegimeInput(
        as_of=overrides.get("as_of", "2026-09-01T12:00:00Z"),
        indices=make_indices(index_changes, **overrides.get("index_overrides", {})),
        sectors=sectors,
        macro=macro or make_macro(),
    )
