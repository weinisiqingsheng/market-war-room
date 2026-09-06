import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { RegimeSpectrum } from "@/components/RegimeSpectrum";

describe("RegimeSpectrum", () => {
  it("exposes an accessible meter with the regime score", () => {
    render(
      <RegimeSpectrum
        score={42}
        label="Cautious / Risk-Off"
        labels={{ riskOff: "Risk-Off", neutral: "Neutral", riskOn: "Risk-On" }}
      />,
    );
    const meter = screen.getByRole("meter");
    expect(meter).toHaveAttribute("aria-valuenow", "42");
    expect(meter).toHaveAttribute("aria-valuemin", "0");
    expect(meter).toHaveAttribute("aria-valuemax", "100");
  });

  it("renders the risk axis labels and the score", () => {
    render(
      <RegimeSpectrum
        score={42}
        label="Cautious / Risk-Off"
        labels={{ riskOff: "Risk-Off", neutral: "Neutral", riskOn: "Risk-On" }}
      />,
    );
    expect(screen.getByText("Risk-Off")).toBeInTheDocument();
    expect(screen.getByText("Neutral")).toBeInTheDocument();
    expect(screen.getByText("Risk-On")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("clamps the marker position into the valid range", () => {
    render(
      <RegimeSpectrum
        score={150}
        label="Risk-On"
        labels={{ riskOff: "Risk-Off", neutral: "Neutral", riskOn: "Risk-On" }}
      />,
    );
    expect(screen.getByRole("meter")).toHaveAttribute("aria-valuenow", "100");
  });
});
