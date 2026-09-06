import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AiMarketBriefCard } from "@/components/ai-market-brief-card";
import { buildDemoGroundedBrief } from "@/lib/ai-brief/demo-brief";
import type { AiMarketBriefApiResponse } from "@/features/home/useAiMarketBrief";

const brief = buildDemoGroundedBrief();
const response = (overrides: Partial<AiMarketBriefApiResponse>): AiMarketBriefApiResponse => ({
  mode: "live",
  status: "generated",
  brief,
  inputConfidence: { score: 0.9, label: "high" },
  cache: { hit: false },
  ...overrides,
});

describe("AiMarketBriefCard", () => {
  it("renders generated content sections without printing evidence IDs", () => {
    render(<AiMarketBriefCard data={response({})} loading={false} onRetry={() => {}} />);
    expect(screen.getByText(brief.headline)).toBeTruthy();
    expect(screen.getByText(brief.stance.label)).toBeTruthy();
    expect(screen.getByText(brief.keyDrivers[0].title)).toBeTruthy();
    expect(screen.getByText(brief.marketInternals.text)).toBeTruthy();
    expect(screen.getByText(brief.macro.text)).toBeTruthy();
    expect(screen.getByText(brief.notableMoves[0].ticker)).toBeTruthy();
    expect(screen.queryByText("regime.overall")).toBeNull();
  });
  it("cached renders normally with unchanged-evidence copy and no stale/error", () => {
    render(<AiMarketBriefCard data={response({ status: "cached", cache: { hit: true } })} loading={false} onRetry={() => {}} />);
    expect(screen.getByText(brief.headline)).toBeTruthy();
    expect(screen.getByText("Cached for unchanged evidence")).toBeTruthy();
    expect(screen.queryByText(/stale/i)).toBeNull();
  });
  it("demo renders full brief with DEMO label", () => {
    render(<AiMarketBriefCard data={response({ mode: "demo", status: "demo" })} loading={false} onRetry={() => {}} />);
    expect(screen.getByText("DEMO")).toBeTruthy();
    expect(screen.getByText(brief.headline)).toBeTruthy();
  });
  it("insufficient shows honest copy, never demo prose", () => {
    render(<AiMarketBriefCard data={response({ status: "insufficient_grounded_data", brief: null })} loading={false} onRetry={() => {}} />);
    expect(screen.getByText(/Not enough grounded market data/i)).toBeTruthy();
    expect(screen.queryByText(brief.headline)).toBeNull();
  });
  it("unavailable renders graceful copy; retry calls onRetry once", () => {
    const onRetry = vi.fn();
    render(<AiMarketBriefCard data={response({ status: "unavailable", brief: null })} loading={false} onRetry={onRetry} />);
    expect(screen.getByText(/temporarily unavailable/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
  it("network error without data maps to generic unavailable and hides error text", () => {
    render(<AiMarketBriefCard data={null} loading={false} networkError onRetry={() => {}} />);
    expect(screen.getByText(/temporarily unavailable/i)).toBeTruthy();
    expect(screen.queryByText("ECONNREFUSED")).toBeNull();
  });
  it("loading shows skeleton and no market facts", () => {
    render(<AiMarketBriefCard data={null} loading onRetry={() => {}} />);
    expect(screen.getByText(/Loading grounded market brief/i)).toBeTruthy();
    expect(screen.queryByText(brief.headline)).toBeNull();
  });
});
