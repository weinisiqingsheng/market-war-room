export const SHORT_TERM_LAB_VERSION = "short-term-lab-v1" as const;
export const MOCK_JEV_MODEL = "jev-short-term-mock-v0" as const;

export const STRATEGIES = {
  "momentum-watch": {
    label: "Momentum watch",
    description: "Looks for persistent short-term direction with volatility confirmation.",
    defaultHorizonHours: 4,
    defaultMaxLossPct: 2,
  },
  "mean-reversion-watch": {
    label: "Mean-reversion watch",
    description: "Looks for stretched moves that may return toward a recent reference range.",
    defaultHorizonHours: 24,
    defaultMaxLossPct: 1.5,
  },
  "risk-first": {
    label: "Risk-first review",
    description: "Prioritizes downside scenarios, liquidity checks, and invalidation conditions.",
    defaultHorizonHours: 1,
    defaultMaxLossPct: 1,
  },
} as const;

export type StrategyId = keyof typeof STRATEGIES;

export interface ShortTermAnalysisRequest {
  ticker: string;
  strategyId: StrategyId;
  horizonHours: number;
  maxLossPct: number;
}

export interface ShortTermCheck {
  label: string;
  value: string;
  detail: string;
  tone: "positive" | "caution" | "neutral";
}

export interface ShortTermAnalysisResult {
  version: typeof SHORT_TERM_LAB_VERSION;
  status: "simulated";
  request: ShortTermAnalysisRequest;
  strategy: { id: StrategyId; label: string; description: string };
  marketData: {
    status: "synthetic_fixture";
    asOf: "simulated fixture";
    price: { value: number; isLive: false };
    checks: ShortTermCheck[];
  };
  assessment: {
    provider: "mock-jev";
    model: typeof MOCK_JEV_MODEL;
    label: "constructive" | "watch" | "defensive";
    confidence: number;
    probabilities: { bullish: number; neutral: number; bearish: number };
    rationale: string[];
  };
  evidence: Array<{ label: string; value: string; interpretation: string }>;
  scenarios: Array<{ label: string; range: string; risk: string; trigger: string }>;
  limitations: string[];
}

