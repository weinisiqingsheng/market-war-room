import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ShortTermLab } from "@/features/short-term/ShortTermLab";

const result = {
  status: "simulated",
  request: {
    ticker: "NVDA",
    strategyId: "momentum-watch",
    horizonHours: 4,
    maxLossPct: 2,
  },
  strategy: {
    id: "momentum-watch",
    label: "Momentum watch",
    description: "Synthetic strategy",
  },
  marketData: {
    status: "synthetic_fixture",
    asOf: "simulated fixture",
    price: { value: 123.45, isLive: false },
    checks: [
      { label: "Volatility", value: "Elevated", detail: "Synthetic check" },
    ],
  },
  assessment: {
    provider: "mock-jev",
    model: "jev-short-term-mock-v0",
    label: "watch",
    confidence: 0.68,
    probabilities: { bullish: 0.32, neutral: 0.44, bearish: 0.24 },
    rationale: ["Synthetic rationale"],
  },
  evidence: [{ label: "Momentum", value: "+1.2%", interpretation: "Synthetic" }],
  scenarios: [
    { label: "Base", range: "-0.5% to +0.8%", risk: "Mixed" },
  ],
  limitations: ["This result is simulated."],
};

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
  cleanup();
});

describe("ShortTermLab", () => {
  it("starts as an isolated, mock-only workspace", () => {
    render(<ShortTermLab />);
    expect(screen.getByRole("heading", { name: /short-term intelligence lab/i })).toBeInTheDocument();
    expect(screen.getByText(/simulated jev analysis/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/ticker/i)).toBeInTheDocument();
    expect(screen.getByText(/no analysis yet/i)).toBeInTheDocument();
  });

  it("submits a ticker and keeps simulated status visible in the result", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(jsonResponse(result));
    render(<ShortTermLab />);

    await user.type(screen.getByLabelText(/ticker/i), "NVDA");
    await user.click(screen.getByRole("button", { name: /run simulated analysis/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      "/api/short-term/analyze",
      expect.objectContaining({ method: "POST", cache: "no-store" }),
    ));
    expect(await screen.findByText(/mock-jev · simulated/i)).toBeInTheDocument();
    expect(screen.getByText(/synthetic_fixture · simulated fixture/i)).toBeInTheDocument();
    expect(screen.getByText(/this result is simulated/i)).toBeInTheDocument();
  });
});
