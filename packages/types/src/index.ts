/**
 * Market War Room — canonical market domain models.
 *
 * These contracts describe the *shape* of every market signal the terminal
 * renders. In Phase 0A every value is demo/design data (see
 * `apps/web/data/demo-market.ts`). From Phase 1 onward, each model is filled
 * by a real data provider while the UI contracts stay unchanged.
 *
 * Conventions:
 * - A `change` describes raw price movement *direction* only.
 * - A `tone` describes the market *interpretation* — an up move is not
 *   automatically positive. These two concepts are deliberately separated so
 *   components can render them as distinct visual signals.
 */

/** Raw direction of a price/rate move. */
export type TrendDirection = "up" | "down" | "flat";

/**
 * Market interpretation tone, kept separate from raw direction.
 * - `positive`  → supportive of risk-taking / bullish context
 * - `negative`  → pressure / risk-off context
 * - `warning`   → watch item, elevated but not acute risk
 * - `neutral`   → no strong signal either way
 */
export type Tone = "positive" | "negative" | "warning" | "neutral";

/** Pastel surface a card can sit on. Maps to a small set of design tokens. */
export type IndexSurface = "sakura" | "lavender" | "cream" | "mint";

/** Strength of an anomaly relative to its own recent tape, 1 (weak) to 3 (strong). */
export type RelativeStrength = 1 | 2 | 3;

/** Top-level market regime — the information center of the product. */
export interface MarketRegime {
  /** Regime score on the 0–100 spectrum (higher = more risk-on). */
  score: number;
  /** Human label, e.g. "Cautious / Risk-Off". */
  label: string;
  /** Supporting explanation shown under the score. */
  explanation: string;
  /** Small branded "today at a glance" insight chip. */
  insight: {
    title: string;
    text: string;
  };
  /** Labels for the risk spectrum endpoints / midpoint. */
  spectrum: {
    riskOff: string;
    neutral: string;
    riskOn: string;
  };
}

/** One compact signal card feeding the regime read. */
export interface RegimeDriver {
  id: string;
  /** Driver name, e.g. "Oil". */
  name: string;
  /** Display value, e.g. "+2.5%". */
  value: string;
  /** Signed numeric change in percent, used for directional color/arrows. */
  changePct: number;
  /** Short signal label, e.g. "Inflation Risk". */
  signal: string;
  tone: Tone;
}

/** One index snapshot card in Market Pulse. */
export interface MarketIndex {
  ticker: string;
  name: string;
  /** Last price. Null when the symbol is unavailable. */
  price: number | null;
  /** Signed percent change today. Null when unavailable. */
  changePct: number | null;
  open: number | null;
  high: number | null;
  low: number | null;
  /** Which pastel surface the card renders on. */
  surface: IndexSurface;
  /**
   * Intraday proxy series for the sparkline (unitless, normalized in render).
   * Present in demo/preview data only — Phase 1 live data intentionally omits
   * it until real historical series support is added (no manufactured lines).
   */
  sparkline?: number[];
}

/** Identifiers for the six Macro Pulse signals. */
export type MacroSignalId = "vix" | "us10y" | "wti" | "usd_broad" | "gold" | "btc";

/** How a signal's numeric value should be rendered. */
export type MacroDisplayUnit = "index" | "percent" | "price" | "basis_points";

/** Source freshness semantics — daily observations are never called real-time. */
export type MacroFrequency = "realtime" | "intraday" | "daily";

/** The provider that supplies a macro signal. */
export type MacroProviderId = "fred" | "twelve" | "alpaca-crypto";

/** One macro cell in Macro Pulse (Phase 2: live, provider-independent). */
export interface MacroSignal {
  id: MacroSignalId;
  label: string;
  /**
   * Optional instrument descriptor shown in the provenance line before the
   * source (e.g. "Broad USD Index · FRED · Daily").
   */
  instrument?: string;
  /** Latest numeric value in `displayUnit` terms. Null when unavailable. */
  value: number | null;
  displayUnit: MacroDisplayUnit;
  /** Raw change in the value's own unit (e.g. yield points for US 10Y). */
  change: number | null;
  /** Relative change in percent. Null when unavailable. */
  changePct: number | null;
  /** Deterministic display interpretation, e.g. "Rate Pressure". */
  interpretation: string | null;
  tone: Tone;
  /** Human-readable source name, e.g. "FRED", "Twelve Data", "Alpaca". */
  source: string;
  /** Source freshness semantics (never advertise a daily FRED value as real-time). */
  frequency: MacroFrequency;
  /** Latest observation timestamp (ISO). Null when unavailable. */
  asOf: string | null;
  stale: boolean;
  available: boolean;
}

/** Provenance + freshness metadata for the whole Macro Pulse module. */
export interface MacroDataMeta {
  mode: MarketDataMode;
  /** Newest observation timestamp across all available signals. */
  asOf: string | null;
  /** True when any signal is stale. */
  stale: boolean;
  /** Providers that contributed at least one available signal. */
  providers: MacroProviderId[];
}

/** Normalized payload returned by `GET /api/macro/overview`. */
export interface MacroOverview {
  meta: MacroDataMeta;
  signals: MacroSignal[];
}

/** One ranked sector row in Sector Rotation. */
export interface SectorPerformance {
  id: string;
  sector: string;
  etf: string;
  /** Raw daily return, percent. Null when the symbol is unavailable. */
  dailyReturnPct: number | null;
  /** Return vs the SPY benchmark, percent — relative strength signal. Null when unavailable. */
  relativeReturnPct: number | null;
  /** Signal label, e.g. "Leader". "Unavailable" when data is missing. */
  signal: string;
  tone: Tone;
  /** Visual strength 0–100 driving the strength bar. Null when unavailable. */
  strength: number | null;
}

/** Market breadth summary. */
export interface MarketBreadth {
  advancingPct: number;
  decliningPct: number;
  stocksUpOver2Pct: number;
  stocksDownOver2Pct: number;
  /** Share of stocks above their 50-day moving average, percent. */
  above50DmaPct: number;
  newHighs: number;
  newLows: number;
  /** Composite breadth score 0–100. */
  score: number;
  scoreLabel: string;
}

/** One row of unusual activity in Market Anomalies. */
export interface MarketAnomaly {
  symbol: string;
  /** Signed move, percent. */
  movePct: number;
  /** Relative volume multiple (e.g. 9.5 = 9.5x normal). */
  relativeVolume: number;
  /** Distance from the high of the day, percent. */
  hodDistancePct: number;
  relativeStrength: RelativeStrength;
  /** Anomaly score 0–100. */
  score: number;
}

/** One step in a catalyst → impact chain. */
export interface CatalystEvent {
  id: string;
  /** Category chip, e.g. "IRAN / ENERGY". */
  category: string;
  /** Headline, e.g. "US–Iran tensions escalate". */
  headline: string;
  /** Ordered impact chain rendered as step → step → step. */
  chain: string[];
  /** Impact score 0–100. */
  impactScore: number;
}

/** AI Market Brief — visual module only in Phase 0A (no LLM). */
export interface MarketBrief {
  summary: string;
  keyTakeaways: string[];
  whatToWatch: string[];
  /** Representative sources shown in the brief. */
  sources: string[];
  /** Total sources the (future) brief is grounded in. */
  sourceCount: number;
  /** Label clarifying content provenance. */
  provenance: string;
}

/** A suggested question chip in Ask War Room. */
export interface SuggestedQuestion {
  id: string;
  label: string;
}

/** Header navigation entry. */
export interface HeaderNavItem {
  id: string;
  label: string;
  href: string;
  /** Only "Overview" is implemented in Phase 0A. */
  disabled?: boolean;
}

/** Market session / status shown in the header. */
export interface MarketSession {
  /** Exchange session label, e.g. "US Markets". */
  label: string;
  /** Session state, e.g. "Open". */
  status: string;
  /** Demo context shown next to the session state. */
  note: string;
}

/** Page-level demo data bundle (single import point for the homepage). */
export interface DemoMarketData {
  regime: MarketRegime;
  regimeDrivers: RegimeDriver[];
  indices: MarketIndex[];
  macro: MacroSignal[];
  sectors: SectorPerformance[];
  benchmark: {
    ticker: string;
    dailyReturnPct: number;
  };
  breadth: MarketBreadth;
  anomalies: MarketAnomaly[];
  catalysts: CatalystEvent[];
  brief: MarketBrief;
  suggestedQuestions: SuggestedQuestion[];
}

/**
 * ── Market data (Phase 1) ────────────────────────────────────────────────
 * Provider-independent market data contracts. The UI consumes these domain
 * shapes; provider-specific payloads never leave the provider boundary.
 */

/** Explicit data source mode. `demo` needs no credentials and never fetches. */
export type MarketDataMode = "demo" | "live";

/** Which provider produced the data. */
export type MarketDataProviderName = "demo" | "alpaca";

/** Data feed provenance. IEX is NOT the full consolidated SIP feed. */
export type MarketFeed = "demo" | "iex" | "sip" | "delayed_sip";

/** Which snapshot field supplied the current price. */
export type PriceSource = "latest_trade" | "minute_bar" | "daily_bar" | "unavailable";

/** Provider-independent snapshot of one symbol at a point in time. */
export interface NormalizedMarketSnapshot {
  symbol: string;
  price: number | null;
  previousClose: number | null;
  open: number | null;
  high: number | null;
  low: number | null;
  change: number | null;
  changePct: number | null;
  volume: number | null;
  timestamp: string | null;
  /** Which field supplied `price`, per the deterministic price priority. */
  source: PriceSource;
  feed: MarketFeed;
  /** True when the market is open and this snapshot is older than the threshold. */
  stale: boolean;
  /** True when a usable current price was obtained. */
  available: boolean;
}

export type MarketSnapshotMap = Record<string, NormalizedMarketSnapshot>;

/** Provenance + freshness metadata exposed to the UI. Never contains secrets. */
export interface MarketDataMeta {
  mode: MarketDataMode;
  provider: MarketDataProviderName;
  feed: MarketFeed;
  /** Newest market-data timestamp backing the page (ISO). */
  asOf: string | null;
  marketOpen: boolean | null;
  nextOpen: string | null;
  nextClose: string | null;
  stale: boolean;
}

/** Minimal provider contract — the only coupling point to a data source. */
export interface MarketDataProvider {
  getSnapshots(symbols: string[]): Promise<MarketSnapshotMap>;
  getMarketClock(): Promise<{
    marketOpen: boolean | null;
    nextOpen: string | null;
    nextClose: string | null;
  }>;
}

/** Normalized payload returned by `GET /api/market/overview`. */
export interface MarketOverview {
  meta: MarketDataMeta;
  indices: MarketIndex[];
  sectors: SectorPerformance[];
}

/**
 * ── Regime engine (Phase 3) ───────────────────────────────────────────────
 * Transport/domain types for the deterministic Python regime engine. These
 * describe the *result contract* only — scoring logic lives once, in the
 * Python analytics service. TypeScript never re-implements scoring.
 */

export type RegimeComponentId = "equity" | "sectors" | "volatility" | "rates" | "macro" | "crypto";

export type RegimeConfidence = "high" | "medium" | "low" | "insufficient";

export type RegimeDriverDirection = "positive" | "negative";

export interface RegimeComponentScore {
  id: RegimeComponentId;
  name: string;
  /** 0–100 pillar score. Null when the whole pillar has no usable inputs. */
  score: number | null;
  /** Configured pillar weight (sum of the six = 1). */
  weight: number;
}

export interface RegimeDriverAttribution {
  id: string;
  name: string;
  direction: RegimeDriverDirection;
  /** Contribution in overall-score points relative to neutral. */
  impact: number;
  /** Deterministic template reason, e.g. "US 10Y rose 8 bp". */
  reason: string;
}

/** Deterministic engine result (camelCase mirror of the Python contract). */
export interface RegimeResult {
  /** 0–100 risk-on score. Null only for "Insufficient Data". */
  score: number | null;
  /** Rounded integer for the hero display. Null when score is null. */
  displayScore: number | null;
  label: string;
  /** Expected-weight data coverage 0–1. */
  coverage: number;
  confidence: RegimeConfidence;
  components: RegimeComponentScore[];
  positiveDrivers: RegimeDriverAttribution[];
  negativeDrivers: RegimeDriverAttribution[];
  staleInputs: string[];
  missingInputs: string[];
  asOf: string | null;
  engineVersion: string;
}

export interface RegimeOverviewMeta {
  mode: MarketDataMode;
  asOf: string | null;
}

/** Normalized payload returned by `GET /api/regime/overview`. */
export interface RegimeOverview {
  mode: MarketDataMode;
  meta: RegimeOverviewMeta;
  /** Present in live mode after a successful engine run; null in demo mode. */
  result: RegimeResult | null;
}
