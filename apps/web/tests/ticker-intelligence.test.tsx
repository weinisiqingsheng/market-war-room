import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TickerIntelligence } from "@/components/TickerIntelligence";
import type { TickerResearchApiOk } from "@/lib/ticker-context/api-types";
import type { SafeTickerSummary } from "@/lib/ticker-context/summary";
import type { SafeTickerFact } from "@/lib/ticker-context/api-types";

/**
 * Ticker Intelligence component contract (V1.2C). The fixture deliberately
 * contains two different symbol snapshots so any hard-coded financial value in
 * the UI would fail the suite.
 */
const BASE_SUMMARY: SafeTickerSummary = {
  version: "ticker-summary-v1",
  price: {
    value: 222.27,
    previousClose: 219.34,
    changePct: 1.34,
    direction: "advancer",
    sessionDate: "2026-09-18",
    feed: "delayed_sip",
    delayMinutes: 15,
  },
  quote: { tradePrice: 222.31, tradeTimestamp: "2026-09-18T19:58:12.000Z" },
  volume: {
    sessionVolume: 191_619_629,
    avgVolume20: 130_670_732,
    relativeVolume: 1.47,
    partialSessionVolumePctOfAvg: null,
    sessionCompleted: true,
    sessionDate: "2026-09-18",
  },
  volatility: {
    returnVol20Pct: 2.92,
    latestMoveSigma: 0.46,
    historySessionCount: 30,
    windowSessions: 20,
  },
  range: { prior20Low: 207.25, prior20High: 234.76, rangePositionPct: 54.6, windowSessions: 20 },
  sector: {
    name: "Information Technology",
    benchmarkTicker: "XLK",
    benchmarkChangePct: 0.82,
    classificationSource: "sp500-v1",
  },
  events: {
    status: "candidates",
    newsCount: 1,
    secCount: 1,
    corporateActionCount: 0,
    window: { startIso: "2026-09-17T20:00:00.000Z", cutoffIso: "2026-09-18T20:00:00.000Z" },
    news: [
      {
        headline: "Chip demand stays firm into the quarter",
        source: "benzinga",
        publishedAt: "2026-09-18T15:34:31Z",
        category: "company",
        specificity: "company_specific",
      },
    ],
    filings: [{ form: "8-K", formLabel: "Current report", filedAt: "2026-09-17" }],
    corporateActions: [],
  },
};

const FACTS: SafeTickerFact[] = [
  {
    id: "ticker.NVDA.identity",
    domain: "identity",
    text: "NVDA — NVIDIA Corporation Common Stock (NASDAQ).",
    asOf: null,
    freshness: "fresh",
    confidence: "high",
    sourceVersion: "alpaca-assets-v1",
  },
  {
    id: "ticker.NVDA.price",
    domain: "price",
    text: "NVDA regular-session reference price 222.27 vs previous close 219.34 — up 1.34% on session 2026-09-18 ET.",
    asOf: "2026-09-18T20:00:00.000Z",
    freshness: "delayed",
    confidence: "high",
    sourceVersion: "alpaca-delayed-sip-v1",
  },
];

function payload(
  symbol: string,
  overrides: {
    status?: "ok" | "partial" | "insufficient_data";
    summary?: SafeTickerSummary;
    facts?: SafeTickerFact[];
    sourcesOverrides?: Record<string, unknown>;
  } = {},
): TickerResearchApiOk {
  const status = overrides.status ?? "ok";
  return {
    mode: "live",
    status,
    symbol,
    context: {
      version: "ticker-context-v1",
      status,
      requestedSymbol: symbol,
      symbol,
      identity: {
        symbol,
        name: symbol === "NVDA" ? "NVIDIA Corporation Common Stock" : "Tesla, Inc. Common Stock",
        exchange: "NASDAQ",
        assetClass: "us_equity",
        status: "active",
        tradable: true,
      },
      requestedAt: "2026-09-18T21:05:00.000Z",
      generatedAt: "2026-09-18T21:05:02.000Z",
      providerAsOf: "2026-09-18T20:00:00.000Z",
      marketSessionAsOf: "2026-09-18",
      effectiveAsOf: "2026-09-18T20:00:00.000Z",
      session: { marketOpen: false, phase: "closed", sessionDate: "2026-09-18" },
      sources: {
        market: {
          available: true,
          asOf: "2026-09-18T20:00:00.000Z",
          freshness: "delayed",
          confidence: null,
          version: "alpaca-delayed-sip-v1",
        },
        identity: {
          available: true,
          asOf: null,
          freshness: "fresh",
          confidence: "high",
          version: "alpaca-assets-v1",
        },
        sector: {
          available: true,
          asOf: "2026-09-18T20:00:00.000Z",
          freshness: "delayed",
          confidence: null,
          version: "sp500-v1",
        },
        news: {
          available: true,
          asOf: "2026-09-18T15:34:31Z",
          freshness: "delayed",
          confidence: null,
          version: "alpaca-news-v1",
        },
        sec: {
          available: true,
          asOf: "2026-09-17T21:00:00Z",
          freshness: "delayed",
          confidence: null,
          version: "sec-edgar-submissions-v1",
        },
        ...overrides.sourcesOverrides,
      } as never,
      availability: {
        price: true,
        history: true,
        volume: true,
        volatility: true,
        sector: true,
        news: true,
        sec: true,
        corporateActions: true,
      },
      confidence: { score: 0.866, label: "medium" },
      factCount: (overrides.facts ?? FACTS).length,
      facts: overrides.facts ?? FACTS,
      summary: overrides.summary ?? BASE_SUMMARY,
      fingerprint: "f".repeat(64),
    },
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  cleanup();
});

async function research(user: ReturnType<typeof userEvent.setup>, symbol: string) {
  await user.type(screen.getByLabelText(/US stock ticker symbol/i), symbol);
  await user.click(screen.getByRole("button", { name: /^research$/i }));
}

describe("TickerIntelligence", () => {
  it("starts idle with a labeled search form and scope description, fetching nothing", () => {
    render(<TickerIntelligence />);
    expect(screen.getByRole("heading", { name: "Ticker Intelligence" })).toBeInTheDocument();
    expect(screen.getByLabelText(/US stock ticker symbol/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^research$/i })).toBeInTheDocument();
    expect(screen.getByText(/anomaly Top 8/)).toBeInTheDocument();
    expect(screen.getByText(/No ticker selected/)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not query the provider while the user types", async () => {
    const user = userEvent.setup();
    render(<TickerIntelligence />);
    await user.type(screen.getByLabelText(/US stock ticker symbol/i), "NVDA");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("submits on Enter and renders the verified identity and summary metrics", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(jsonResponse(payload("NVDA")));
    render(<TickerIntelligence />);

    await user.type(screen.getByLabelText(/US stock ticker symbol/i), "nvda{Enter}");

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/intelligence/ticker?symbol=NVDA",
        expect.objectContaining({ cache: "no-store" }),
      ),
    );
    expect(await screen.findByText("NVIDIA Corporation Common Stock")).toBeInTheDocument();
    expect(screen.getByText("Verified")).toBeInTheDocument();
    expect(screen.getByText("NASDAQ")).toBeInTheDocument();
    // Price / move
    expect(screen.getByText("222.27")).toBeInTheDocument();
    expect(screen.getByText("+1.34% · Advancing")).toBeInTheDocument();
    expect(screen.getByText("219.34")).toBeInTheDocument();
    // Volume (exact value + multiple, never a partial as a multiple)
    expect(screen.getByText("191,619,629")).toBeInTheDocument();
    expect(screen.getByText("130,670,732")).toBeInTheDocument();
    expect(screen.getByText("1.47×")).toBeInTheDocument();
    // Volatility (named as realized volatility, never an anomaly score)
    expect(screen.getByText("2.92%")).toBeInTheDocument();
    expect(screen.getByText("0.46× that volatility")).toBeInTheDocument();
    expect(screen.getByText(/not an anomaly-v1 score/)).toBeInTheDocument();
    // Range position
    expect(screen.getByText("54.6%")).toBeInTheDocument();
    expect(screen.getByText("207.25")).toBeInTheDocument();
    expect(screen.getByText("234.76")).toBeInTheDocument();
    // Sector comparison
    expect(screen.getByText("Information Technology / XLK")).toBeInTheDocument();
    expect(screen.getByText("+0.82%")).toBeInTheDocument();
  });

  it("shows session, feed and confidence provenance and separates request time from price time", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(jsonResponse(payload("NVDA")));
    render(<TickerIntelligence />);
    await research(user, "NVDA");

    expect(await screen.findByText(/2026-09-18 ET · completed session/)).toBeInTheDocument();
    expect(screen.getByText(/Delayed SIP 15m behind/)).toBeInTheDocument();
    expect(screen.getByText("medium")).toBeInTheDocument();
    expect(screen.getByText(/neither is the market price timestamp/)).toBeInTheDocument();
  });

  it("labels an in-session partial volume as participation, never as a multiple", async () => {
    const user = userEvent.setup();
    const summary: SafeTickerSummary = {
      ...BASE_SUMMARY,
      volume: {
        ...BASE_SUMMARY.volume!,
        relativeVolume: null,
        partialSessionVolumePctOfAvg: 30.6,
        sessionCompleted: false,
      },
    };
    fetchMock.mockResolvedValue(jsonResponse(payload("NVDA", { summary })));
    render(<TickerIntelligence />);
    await research(user, "NVDA");

    expect(await screen.findByText("30.6% of average")).toBeInTheDocument();
    expect(screen.queryByText(/^[0-9.]+×$/)).not.toBeInTheDocument();
  });

  it("renders honest unavailable states instead of invented numbers", async () => {
    const user = userEvent.setup();
    const summary: SafeTickerSummary = {
      ...BASE_SUMMARY,
      price: null,
      volume: null,
      volatility: null,
      range: null,
      sector: null,
      quote: null,
      events: null,
    };
    fetchMock.mockResolvedValue(
      jsonResponse(payload("NVDA", { status: "insufficient_data", summary })),
    );
    render(<TickerIntelligence />);
    await research(user, "NVDA");

    expect(await screen.findByText(/Insufficient grounded data/)).toBeInTheDocument();
    expect(screen.getAllByText("Unavailable for this session").length).toBeGreaterThanOrEqual(3);
    expect(screen.getByText("Sector comparison unavailable.")).toBeInTheDocument();
    expect(screen.getByText(/Company evidence is unavailable for this symbol/)).toBeInTheDocument();
  });
});

describe("TickerIntelligence · evidence and warnings", () => {
  it("renders the ticker evidence facts with id, domain, freshness and source version", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(jsonResponse(payload("NVDA")));
    render(<TickerIntelligence />);
    await research(user, "NVDA");

    expect(await screen.findByRole("heading", { name: "NVDA evidence" })).toBeInTheDocument();
    expect(screen.getByText(/grounded\s*facts/)).toBeInTheDocument();
    expect(screen.getByText("ticker.NVDA.price")).toBeInTheDocument();
    expect(screen.getByText("alpaca-delayed-sip-v1")).toBeInTheDocument();
    expect(
      screen.getByText(/NVDA regular-session reference price 222.27 vs previous close 219.34/),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Delayed").length).toBeGreaterThan(0);
  });

  it("labels company evidence as contextual and never as a confirmed cause", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(jsonResponse(payload("NVDA")));
    render(<TickerIntelligence />);
    await research(user, "NVDA");

    expect(await screen.findByText("Company Evidence")).toBeInTheDocument();
    expect(screen.getByText("Chip demand stays firm into the quarter")).toBeInTheDocument();
    expect(screen.getByText("benzinga")).toBeInTheDocument();
    expect(screen.getByText(/contextual candidates, not a proven cause/)).toBeInTheDocument();
    expect(screen.getByText("Company-specific")).toBeInTheDocument();
    expect(screen.queryByText(/confirmed cause/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Why NVDA/i)).not.toBeInTheDocument();
    // No links: the safe projection exposes no verified URL.
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("states the no-clear-catalyst result explicitly when no events were found", async () => {
    const user = userEvent.setup();
    const summary: SafeTickerSummary = {
      ...BASE_SUMMARY,
      events: {
        status: "none",
        newsCount: 0,
        secCount: 0,
        corporateActionCount: 0,
        window: { startIso: "2026-09-17T20:00:00.000Z", cutoffIso: null },
        news: [],
        filings: [],
        corporateActions: [],
      },
    };
    fetchMock.mockResolvedValue(jsonResponse(payload("NVDA", { summary })));
    render(<TickerIntelligence />);
    await research(user, "NVDA");

    expect(
      await screen.findByText(/No clear company-specific catalyst identified for NVDA/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/No company-specific news, SEC filings or corporate actions/),
    ).toBeInTheDocument();
  });

  it("warns about partial coverage without hiding available metrics", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(
      jsonResponse(
        payload("NVDA", {
          status: "partial",
          sourcesOverrides: {
            sec: {
              available: false,
              asOf: null,
              freshness: "unavailable",
              confidence: null,
              version: null,
            },
          },
        }),
      ),
    );
    render(<TickerIntelligence />);
    await research(user, "NVDA");

    expect(await screen.findByText(/Partial data\./)).toBeInTheDocument();
    expect(screen.getByText(/Unavailable in this snapshot: SEC filings\./)).toBeInTheDocument();
    expect(screen.getByText("222.27")).toBeInTheDocument();
  });

  it("renders different values for a different symbol (nothing hard-coded)", async () => {
    const user = userEvent.setup();
    const tslaSummary: SafeTickerSummary = {
      ...BASE_SUMMARY,
      price: {
        value: 364.27,
        previousClose: 366.2,
        changePct: -0.53,
        direction: "decliner",
        sessionDate: "2026-09-18",
        feed: "delayed_sip",
        delayMinutes: 15,
      },
      sector: {
        name: "Consumer Discretionary",
        benchmarkTicker: "XLY",
        benchmarkChangePct: -0.32,
        classificationSource: "sp500-v1",
      },
    };
    fetchMock.mockResolvedValue(jsonResponse(payload("TSLA", { summary: tslaSummary })));
    render(<TickerIntelligence />);
    await research(user, "TSLA");

    expect(await screen.findByText("Tesla, Inc. Common Stock")).toBeInTheDocument();
    expect(screen.getByText("364.27")).toBeInTheDocument();
    expect(screen.getByText("-0.53% · Declining")).toBeInTheDocument();
    expect(screen.getByText("Consumer Discretionary / XLY")).toBeInTheDocument();
    expect(screen.queryByText("222.27")).not.toBeInTheDocument();
  });
});

describe("TickerIntelligence · failure states", () => {
  it("never renders raw provider payload fields from the response", async () => {
    const user = userEvent.setup();
    const withExtras = payload("NVDA") as unknown as Record<string, unknown>;
    withExtras.leaked = "ak-secret-value";
    fetchMock.mockResolvedValue(jsonResponse(withExtras));
    render(<TickerIntelligence />);
    await research(user, "NVDA");

    expect(await screen.findByText("222.27")).toBeInTheDocument();
    expect(document.body.textContent).not.toContain("ak-secret-value");
    expect(document.body.textContent).not.toContain("leaked");
  });

  it("shows the unknown-symbol and unsupported-security states", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(
      jsonResponse(
        {
          mode: "live",
          status: "unsupported_symbol",
          symbol: "ZZZZ",
          reason: "unknown_symbol",
          error: { code: "UNKNOWN_SYMBOL", message: "Symbol is not recognised." },
        },
        404,
      ),
    );
    const first = render(<TickerIntelligence />);
    await research(user, "ZZZZ");
    expect(
      await screen.findByText("No supported equity found for this symbol."),
    ).toBeInTheDocument();
    first.unmount();

    fetchMock.mockResolvedValue(
      jsonResponse(
        {
          mode: "live",
          status: "unsupported_symbol",
          symbol: "BTCUSD",
          reason: "unsupported_security_type",
          error: {
            code: "UNSUPPORTED_SECURITY_TYPE",
            message: "Not a supported active US equity.",
          },
        },
        422,
      ),
    );
    render(<TickerIntelligence />);
    await research(user, "BTCUSD");
    expect(
      await screen.findByText("This security type is not supported by Ticker Intelligence."),
    ).toBeInTheDocument();
  });

  it("offers a Retry that re-runs the failed lookup", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(
      jsonResponse(
        {
          mode: "live",
          status: "unavailable",
          symbol: "NVDA",
          reason: "provider_unavailable",
          error: {
            code: "PROVIDER_UNAVAILABLE",
            message: "Providers are temporarily unavailable.",
          },
        },
        503,
      ),
    );
    render(<TickerIntelligence />);
    await research(user, "NVDA");
    expect(await screen.findByText("Ticker research temporarily unavailable.")).toBeInTheDocument();

    fetchMock.mockResolvedValue(jsonResponse(payload("NVDA")));
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("222.27")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
