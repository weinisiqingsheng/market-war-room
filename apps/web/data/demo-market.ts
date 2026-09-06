/**
 * Phase 0A demo fixtures for the Sakura Finance homepage, kept for demo mode.
 *
 * DESIGN DATA ONLY — fixtures are intentionally labeled in the UI
 * ("DESIGN PREVIEW", "DEMO") and must never be presented as live market data.
 *
 * Phase 1 note: ticker names/surfaces are derived from the centralized symbol
 * universe (`@/lib/market-data/symbols`) so there is a single source of truth.
 * Live mode replaces `demoMarketData.indices` and `.sectors` with normalized
 * provider data through `GET /api/market/overview`; everything else stays demo.
 */
import type {
  CatalystEvent,
  DemoMarketData,
  HeaderNavItem,
  MacroSignal,
  MarketAnomaly,
  MarketBreadth,
  MarketBrief,
  MarketIndex,
  MarketRegime,
  MarketSession,
  RegimeDriver,
  SectorPerformance,
  SuggestedQuestion,
} from "@/types/market";
import {
  BENCHMARK_SYMBOL,
  MARKET_PULSE_UNIVERSE,
  SECTOR_UNIVERSE,
} from "@/lib/market-data/symbols";

export const demoHeaderNav: HeaderNavItem[] = [
  { id: "overview", label: "Overview", href: "/" },
  { id: "markets", label: "Markets", href: "/markets" },
  { id: "intelligence", label: "Intelligence", href: "/intelligence", disabled: true },
];

export const demoSession: MarketSession = {
  label: "US Markets",
  status: "Demo",
  note: "Demo session",
};

export const demoRegime: MarketRegime = {
  score: 42,
  label: "Cautious / Risk-Off",
  explanation:
    "Rising yields and crude oil are pressuring equities while energy continues to show relative strength.",
  insight: {
    title: "Today at a glance",
    text: "Oil ↑ · Yields ↑ · Energy leading",
  },
  spectrum: {
    riskOff: "Risk-Off",
    neutral: "Neutral",
    riskOn: "Risk-On",
  },
};

export const demoRegimeDrivers: RegimeDriver[] = [
  {
    id: "oil",
    name: "Oil",
    value: "+2.5%",
    changePct: 2.5,
    signal: "Inflation Risk",
    tone: "negative",
  },
  {
    id: "us10y",
    name: "US 10Y",
    value: "4.76%",
    changePct: 0.08,
    signal: "Rate Pressure",
    tone: "warning",
  },
  {
    id: "tech",
    name: "Technology",
    value: "-0.44%",
    changePct: -0.44,
    signal: "Weak Relative Strength",
    tone: "negative",
  },
  {
    id: "energy",
    name: "Energy",
    value: "+2.10%",
    changePct: 2.1,
    signal: "Leader",
    tone: "positive",
  },
];

/* Index fixtures keyed by symbol — tickers themselves come from the universe. */
const INDEX_FIXTURES: Record<
  string,
  { price: number; changePct: number; open: number; high: number; low: number; sparkline: number[] }
> = {
  SPY: {
    price: 563.24,
    changePct: -0.24,
    open: 565.1,
    high: 566.2,
    low: 560.4,
    sparkline: [58, 56, 54, 55, 53, 51, 50, 48, 49, 47, 46, 44, 45, 43, 41, 42],
  },
  QQQ: {
    price: 492.11,
    changePct: -0.31,
    open: 493.8,
    high: 494.5,
    low: 489.9,
    sparkline: [55, 54, 52, 53, 50, 48, 47, 45, 46, 44, 42, 43, 40, 38, 37, 36],
  },
  IWM: {
    price: 218.62,
    changePct: -0.18,
    open: 219.3,
    high: 220.1,
    low: 217.4,
    sparkline: [50, 51, 49, 48, 49, 47, 46, 44, 45, 43, 42, 43, 41, 40, 41, 40],
  },
  DIA: {
    price: 412.78,
    changePct: -0.12,
    open: 413.2,
    high: 414.1,
    low: 411.6,
    sparkline: [52, 53, 51, 52, 50, 49, 48, 47, 46, 47, 45, 46, 44, 45, 43, 44],
  },
};

export const demoIndices: MarketIndex[] = MARKET_PULSE_UNIVERSE.map((entry) => ({
  ticker: entry.symbol,
  name: entry.name,
  surface: entry.surface,
  ...INDEX_FIXTURES[entry.symbol],
}));

export const demoMacro: MacroSignal[] = [
  {
    id: "vix",
    label: "VIX",
    value: 15.42,
    displayUnit: "index",
    change: -0.84,
    changePct: -5.17,
    interpretation: "Volatility Calm",
    tone: "positive",
    source: "Demo",
    frequency: "daily",
    asOf: null,
    stale: false,
    available: true,
  },
  {
    id: "us10y",
    label: "US 10Y",
    value: 4.76,
    displayUnit: "percent",
    change: 0.08,
    changePct: 1.71,
    interpretation: "Rate Pressure",
    tone: "warning",
    source: "Demo",
    frequency: "daily",
    asOf: null,
    stale: false,
    available: true,
  },
  {
    id: "wti",
    label: "WTI",
    value: 78.54,
    displayUnit: "price",
    change: 1.92,
    changePct: 2.5,
    interpretation: "Inflation Risk",
    tone: "negative",
    source: "Demo",
    frequency: "daily",
    asOf: null,
    stale: false,
    available: true,
  },
  {
    id: "usd_broad",
    label: "US Dollar",
    instrument: "Broad USD Index",
    value: 118.75,
    displayUnit: "index",
    change: -0.28,
    changePct: -0.24,
    interpretation: "Dollar Softening",
    tone: "neutral",
    source: "Demo",
    frequency: "daily",
    asOf: null,
    stale: false,
    available: true,
  },
  {
    id: "gold",
    label: "Gold",
    value: 2438.1,
    displayUnit: "price",
    change: 21.75,
    changePct: 0.9,
    interpretation: "Safe-Haven Bid",
    tone: "positive",
    source: "Demo",
    frequency: "intraday",
    asOf: null,
    stale: false,
    available: true,
  },
  {
    id: "btc",
    label: "BTC",
    value: 62150,
    displayUnit: "price",
    change: 857,
    changePct: 1.4,
    interpretation: "Risk Appetite",
    tone: "positive",
    source: "Demo",
    frequency: "realtime",
    asOf: null,
    stale: false,
    available: true,
  },
];

export const demoBenchmark = {
  ticker: BENCHMARK_SYMBOL,
  dailyReturnPct: -0.24,
};

/* Sector fixtures keyed by symbol — only a subset is fleshed out for demo. */
const SECTOR_FIXTURES: Record<
  string,
  {
    dailyReturnPct: number;
    relativeReturnPct: number;
    signal: string;
    tone: "positive" | "negative" | "neutral" | "warning";
    strength: number;
  }
> = {
  XLE: {
    dailyReturnPct: 2.1,
    relativeReturnPct: 2.34,
    signal: "Leader",
    tone: "positive",
    strength: 92,
  },
  XLF: {
    dailyReturnPct: 0.62,
    relativeReturnPct: 0.86,
    signal: "Strong",
    tone: "positive",
    strength: 74,
  },
  XLI: {
    dailyReturnPct: 0.18,
    relativeReturnPct: 0.42,
    signal: "Neutral",
    tone: "neutral",
    strength: 58,
  },
  XLK: {
    dailyReturnPct: -0.44,
    relativeReturnPct: -0.2,
    signal: "Weak",
    tone: "negative",
    strength: 46,
  },
  XLU: {
    dailyReturnPct: -0.72,
    relativeReturnPct: -0.48,
    signal: "Lagging",
    tone: "negative",
    strength: 31,
  },
};

export const demoSectors: SectorPerformance[] = SECTOR_UNIVERSE.filter(
  (entry) => SECTOR_FIXTURES[entry.symbol],
).map((entry) => ({
  id: entry.symbol,
  sector: entry.sector,
  etf: entry.symbol,
  ...SECTOR_FIXTURES[entry.symbol],
}));

export const demoBreadth: MarketBreadth = {
  advancingPct: 42,
  decliningPct: 58,
  stocksUpOver2Pct: 118,
  stocksDownOver2Pct: 342,
  above50DmaPct: 42,
  newHighs: 64,
  newLows: 218,
  score: 38,
  scoreLabel: "Weak",
};

export const demoAnomalies: MarketAnomaly[] = [
  {
    symbol: "NEOV",
    movePct: 29.2,
    relativeVolume: 9.5,
    hodDistancePct: 1.4,
    relativeStrength: 3,
    score: 92,
  },
  {
    symbol: "SLB",
    movePct: 3.8,
    relativeVolume: 2.8,
    hodDistancePct: 2.1,
    relativeStrength: 2,
    score: 81,
  },
  {
    symbol: "NVDA",
    movePct: 1.2,
    relativeVolume: 1.6,
    hodDistancePct: 4.2,
    relativeStrength: 2,
    score: 73,
  },
  {
    symbol: "XOM",
    movePct: 2.5,
    relativeVolume: 1.4,
    hodDistancePct: 3.8,
    relativeStrength: 1,
    score: 68,
  },
];

export const demoCatalysts: CatalystEvent[] = [
  {
    id: "iran-energy",
    category: "IRAN / ENERGY",
    headline: "US–Iran tensions escalate",
    chain: ["Oil +2.5%", "Inflation Risk ↑", "10Y +8 bp", "Growth valuation pressure"],
    impactScore: 88,
  },
  {
    id: "ma-ai-infra",
    category: "M&A / AI INFRA",
    headline: "SLB → Kelvion acquisition",
    chain: ["$4.1B transaction", "Data Center exposure ↑", "SLB relative strength"],
    impactScore: 81,
  },
];

export const demoBrief: MarketBrief = {
  summary:
    "Today's market is trading defensively as rising crude oil prices and Treasury yields revive inflation concerns. Energy is the clear relative-strength leader while utilities and technology lag. Breadth remains weak, indicating pressure is broader than a handful of index names.",
  keyTakeaways: [
    "Energy leads while tech and utilities lag — a clear defensive rotation.",
    "Rising yields (10Y +8 bp) and crude (+2.5%) keep inflation risk in focus.",
    "Breadth is weak (38 / 100) — internals are worse than index levels suggest.",
  ],
  whatToWatch: [
    "A 10Y push above 4.80% would add to rate pressure.",
    "WTI holding above $78 extends the energy leadership theme.",
    "Breadth recovering above 50 would signal a healthier tape.",
  ],
  sources: [
    "Equity tape snapshot (demo)",
    "US Treasury data (demo)",
    "Energy complex (demo)",
    "Market breadth feed (demo)",
  ],
  sourceCount: 8,
  provenance: "Design preview — not AI-generated",
};

export const demoSuggestedQuestions: SuggestedQuestion[] = [
  { id: "tech-weak", label: "Why is tech weak today?" },
  { id: "risk-off", label: "What is driving the risk-off regime?" },
  { id: "relative-strength", label: "Which sectors show relative strength?" },
];

export const demoMarketData: DemoMarketData = {
  regime: demoRegime,
  regimeDrivers: demoRegimeDrivers,
  indices: demoIndices,
  macro: demoMacro,
  sectors: demoSectors,
  benchmark: demoBenchmark,
  breadth: demoBreadth,
  anomalies: demoAnomalies,
  catalysts: demoCatalysts,
  brief: demoBrief,
  suggestedQuestions: demoSuggestedQuestions,
};
