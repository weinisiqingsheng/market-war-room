import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MarketIndexCard } from "@/components/MarketIndexCard";
import type { MarketIndex } from "@/types/market";

const spy: MarketIndex = {
  ticker: "SPY",
  name: "S&P 500 ETF",
  price: 563.24,
  changePct: -0.24,
  open: 565.1,
  high: 566.2,
  low: 560.4,
  surface: "sakura",
  sparkline: [58, 56, 54, 55, 53],
};

describe("MarketIndexCard", () => {
  it("renders ticker, name, price, OHLC and signed change", () => {
    render(<MarketIndexCard index={spy} />);
    expect(screen.getByRole("heading", { level: 3, name: "SPY" })).toBeInTheDocument();
    expect(screen.getByText("S&P 500 ETF")).toBeInTheDocument();
    expect(screen.getByText("563.24")).toBeInTheDocument();
    expect(screen.getByText("-0.24%")).toBeInTheDocument();
    expect(screen.getByText("565.10")).toBeInTheDocument(); // open
    expect(screen.getByText("566.20")).toBeInTheDocument(); // high
    expect(screen.getByText("560.40")).toBeInTheDocument(); // low
  });

  it("uses tabular numerals for financial figures", () => {
    const { container } = render(<MarketIndexCard index={spy} />);
    const price = container.querySelector("p.tabular-nums");
    expect(price).not.toBeNull();
    expect(price?.textContent).toBe("563.24");
  });

  it("describes the day-range position for assistive technology", () => {
    render(<MarketIndexCard index={spy} />);
    expect(screen.getByLabelText(/through today's range/i)).toBeInTheDocument();
  });

  it("exposes a labelled sparkline", () => {
    render(<MarketIndexCard index={spy} />);
    expect(screen.getByLabelText(/SPY preview trend/i)).toBeInTheDocument();
  });
});
