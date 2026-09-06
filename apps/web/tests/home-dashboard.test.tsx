import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { HomeDashboard } from "@/features/home/HomeDashboard";

const PROPS = { mode: "demo" as const, macroMode: "demo" as const };

describe("HomeDashboard", () => {
  it("renders the approved information architecture in order", () => {
    render(<HomeDashboard {...PROPS} />);
    const headings = screen
      .getAllByRole("heading", { level: 2 })
      .map((heading) => heading.textContent);
    expect(headings).toEqual([
      "Market Regime",
      "Market Pulse",
      "Macro Pulse",
      "Sector Rotation",
      "Market Breadth",
      "Market Anomalies",
      "Catalyst Intelligence",
      "Sakura AI Market Brief",
      "Ask War Room",
    ]);
  });

  it("displays the global demo-data label", () => {
    render(<HomeDashboard {...PROPS} />);
    const banner = screen.getByRole("note", { name: "Demo data notice" });
    expect(banner).toHaveTextContent(/design preview/i);
    expect(banner).toHaveTextContent(/not live market data/i);
  });

  it("does not present fixture numbers as live data", () => {
    render(<HomeDashboard {...PROPS} />);
    expect(screen.getByText(/not live market data/i)).toBeInTheDocument();
    expect(screen.getAllByText(/demo/i).length).toBeGreaterThan(0);
  });
});
