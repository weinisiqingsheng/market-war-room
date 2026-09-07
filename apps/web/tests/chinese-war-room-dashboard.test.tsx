import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ChineseWarRoomDashboard } from "@/features/war-room-zh/ChineseWarRoomDashboard";

vi.mock("@/features/home/useMarketOverview", () => ({
  useMarketOverview: () => ({ meta: null, indices: [], sectors: [], status: "ready" }),
}));

vi.mock("@/features/home/useMacroOverview", () => ({
  useMacroOverview: () => ({ meta: null, signals: [], status: "ready" }),
}));

vi.mock("@/features/home/useRegimeOverview", () => ({
  useRegimeOverview: () => ({
    status: "ready",
    regime: null,
    regimeDrivers: [],
    result: null,
    asOf: null,
  }),
}));

vi.mock("@/features/home/useBreadthOverview", () => ({
  useBreadthOverview: () => ({ status: "ready", demo: null, overview: null }),
}));

vi.mock("@/features/home/useAnomaliesOverview", () => ({
  useAnomaliesOverview: () => ({ status: "ready", demo: null, overview: null }),
}));

vi.mock("@/features/home/useCatalystsOverview", () => ({
  useCatalystsOverview: () => ({ status: "ready", overview: null }),
}));

vi.mock("@/features/home/useAiMarketBrief", () => ({
  useAiMarketBrief: () => ({ status: "ready", response: null, refetch: vi.fn() }),
}));

vi.mock("@/features/ask-sakura/useAskSakura", () => ({
  useAskSakura: () => ({
    status: "idle",
    data: null,
    errorKind: null,
    lastQuestion: null,
    submit: vi.fn(),
    retry: vi.fn(),
  }),
}));

describe("ChineseWarRoomDashboard", () => {
  it("renders the Chinese dashboard shell in the approved order", () => {
    render(
      <ChineseWarRoomDashboard
        mode="demo"
        macroMode="demo"
        regimeMode="demo"
        breadthMode="demo"
        anomaliesMode="demo"
        catalystsMode="demo"
      />,
    );

    expect(screen.getByRole("heading", { name: "市场环境" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "市场脉搏" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "宏观脉搏" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "AI 市场简报" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "询问市场作战室" })).toBeInTheDocument();

    const text = screen.getByRole("main").textContent ?? "";
    expect(text.indexOf("市场环境")).toBeLessThan(text.indexOf("市场脉搏"));
  });
});
