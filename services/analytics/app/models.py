"""Canonical Pydantic contracts for the regime engine.

Only normalized data is accepted — no provider payloads, no UI-only fields.
Validation rejects malformed input safely (HTTP 422).
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict


class RegimeIndexInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    ticker: str
    change_pct: float | None = None
    available: bool = True
    stale: bool = False


class RegimeSectorInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    ticker: str
    change_pct: float | None = None
    available: bool = True
    stale: bool = False


class MacroSignalInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    value: float | None = None
    change: float | None = None
    change_pct: float | None = None
    available: bool = True
    stale: bool = False
    frequency: Literal["realtime", "intraday", "daily"] = "daily"


class MacroInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    vix: MacroSignalInput | None = None
    us10y: MacroSignalInput | None = None
    usd_broad: MacroSignalInput | None = None
    wti: MacroSignalInput | None = None
    gold: MacroSignalInput | None = None
    btc: MacroSignalInput | None = None


class RegimeInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    as_of: str | None = None
    indices: list[RegimeIndexInput] = []
    sectors: list[RegimeSectorInput] = []
    macro: MacroInput | None = None


class RegimeComponentScore(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: Literal["equity", "sectors", "volatility", "rates", "macro", "crypto"]
    name: str
    score: float | None
    weight: float


class RegimeDriverAttribution(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    name: str
    direction: Literal["positive", "negative"]
    impact: float
    reason: str


class RegimeResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    score: float | None
    display_score: int | None
    label: str
    coverage: float
    confidence: Literal["high", "medium", "low", "insufficient"]
    components: list[RegimeComponentScore]
    positive_drivers: list[RegimeDriverAttribution]
    negative_drivers: list[RegimeDriverAttribution]
    stale_inputs: list[str]
    missing_inputs: list[str]
    as_of: str | None
    engine_version: str
