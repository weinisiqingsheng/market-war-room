import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

  it("localizes navigation, suggested questions, and demo catalyst presentation", async () => {
    const user = userEvent.setup();
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

    expect(screen.getByRole("navigation", { name: "主要导航" })).toHaveTextContent("概览市场情报");
    expect(screen.queryByText("Overview")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "打开主要导航" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    await user.click(screen.getByRole("button", { name: "打开主要导航" }));
    expect(screen.getByRole("navigation", { name: "移动端主要导航" })).toBeInTheDocument();

    expect(screen.getByRole("button", { name: "为什么 FICO 跌幅这么大？" })).toBeInTheDocument();
    expect(screen.queryByText("Why is FICO down so much?")).not.toBeInTheDocument();
    expect(screen.getByText("美伊紧张局势升级")).toBeInTheDocument();
    expect(screen.getByText(/通胀风险上升/)).toBeInTheDocument();
    expect(screen.queryByText("US–Iran tensions escalate")).not.toBeInTheDocument();
  });
});
