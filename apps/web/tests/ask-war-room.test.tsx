import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AskWarRoom } from "@/components/AskWarRoom";
import type { SuggestedQuestion } from "@/types/market";

const suggestions: SuggestedQuestion[] = [
  { id: "tech-weak", label: "Why is tech weak today?" },
  { id: "risk-off", label: "What is driving the risk-off regime?" },
];

describe("AskWarRoom", () => {
  it("fills the input from a suggested question", async () => {
    const user = userEvent.setup();
    render(<AskWarRoom suggestions={suggestions} />);
    await user.click(screen.getByRole("button", { name: "Why is tech weak today?" }));
    expect(screen.getByRole("textbox")).toHaveValue("Why is tech weak today?");
  });

  it("shows a development notice instead of a fake AI answer on submit", async () => {
    const user = userEvent.setup();
    render(<AskWarRoom suggestions={suggestions} />);
    await user.type(screen.getByRole("textbox"), "Why is oil up?");
    await user.click(screen.getByRole("button", { name: "Ask Sakura" }));
    expect(screen.getByRole("status")).toHaveTextContent(/UI preview/i);
    expect(screen.queryByText(/analysts believe/i)).not.toBeInTheDocument();
  });

  it("renders the approved helper copy", () => {
    render(<AskWarRoom suggestions={suggestions} />);
    expect(screen.getByText("Ask Sakura why the market is moving")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Ask why the market is moving…")).toBeInTheDocument();
  });
});
