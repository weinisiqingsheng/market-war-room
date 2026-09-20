import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AskWarRoom } from "@/components/AskWarRoom";
import type { SuggestedQuestion } from "@/types/market";
import type { AskSakuraAnswer } from "@/lib/ask-sakura/types";

const suggestions: SuggestedQuestion[] = [
  { id: "fico-anomaly", label: "Why is FICO down so much?" },
  { id: "breadth-weak", label: "Is market breadth weak?" },
  { id: "regime-cautious", label: "Why is the regime cautious?" },
];

const answer: AskSakuraAnswer = {
  version: "ask-sakura-v1",
  status: "answered",
  answer: {
    text: "FICO fell 16.7% amid an extreme anomaly and matched regulatory evidence.",
    evidenceRefs: ["anomaly.FICO", "catalyst.FICO.primary"],
  },
  supportingPoints: [
    { text: "The matched catalyst evidence is strong.", evidenceRefs: ["catalyst.FICO.primary"] },
  ],
  limitations: [
    { text: "The catalyst match indicates association, not causation.", evidenceRefs: [] },
  ],
};

function successBody(overrides: Partial<AskSakuraAnswer> = {}): string {
  return JSON.stringify({
    mode: "live",
    status: "generated",
    contextFingerprint: "abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdef",
    inputConfidence: { score: 0.9, label: "high" },
    selectedFactCount: 35,
    answer: { ...answer, ...overrides },
  });
}

function stubResponder(body: () => Promise<Response>) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => body()),
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderPanel() {
  return render(<AskWarRoom suggestions={suggestions} />);
}

async function ask(question: string) {
  const user = userEvent.setup();
  await user.type(screen.getByRole("textbox"), question);
  await user.click(screen.getByRole("button", { name: "Ask Sakura" }));
}

describe("AskWarRoom", () => {
  it("renders the idle scope, market placeholder and suggested questions", () => {
    renderPanel();
    expect(screen.getByRole("heading", { name: "Ask Sakura" })).toBeInTheDocument();
    expect(
      screen.getByText(/questions about the market evidence currently available/i),
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(/today's market, a ticker, breadth, regime, or catalysts/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Why is FICO down so much?" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Is market breadth weak?" })).toBeInTheDocument();
  });

  it("fills the input from a suggestion", async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.click(screen.getByRole("button", { name: "Why is FICO down so much?" }));
    expect(screen.getByRole("textbox")).toHaveValue("Why is FICO down so much?");
  });

  it("disables submit for empty/short questions and blocks >500 characters", async () => {
    renderPanel();
    const submit = screen.getByRole("button", { name: "Ask Sakura" });
    expect(submit).toBeDisabled();
    const textbox = screen.getByRole("textbox");
    fireEvent.change(textbox, { target: { value: "a" } });
    expect(submit).toBeDisabled();
    fireEvent.change(textbox, { target: { value: "x".repeat(501) } });
    expect(submit).toBeDisabled();
    expect(screen.getByText(/Character limit 500/)).toBeInTheDocument();
  });

  it("shows a grounded loading state without fake prose", async () => {
    let resolve: (value: Response) => void = () => {};
    const pending = new Promise<Response>((r) => (resolve = r));
    stubResponder(() => pending);
    renderPanel();
    const user = userEvent.setup();
    await user.type(screen.getByRole("textbox"), "Why is FICO down so much?");
    await user.click(screen.getByRole("button", { name: "Ask Sakura" }));
    expect(
      screen.getByRole("status", { name: /checking current grounded evidence/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText(answer.answer.text)).toBeNull();
    await waitFor(() =>
      resolve(
        new Response(successBody(), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      ),
    );
  });

  it("renders the answered state with supporting points, limitations, trust metadata", async () => {
    stubResponder(
      async () =>
        new Response(successBody(), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );
    renderPanel();
    await ask("Why is FICO down so much?");
    expect(await screen.findByText(answer.answer.text)).toBeInTheDocument();
    expect(screen.getByText("Supporting Evidence")).toBeInTheDocument();
    expect(screen.getByText(/The matched catalyst evidence is strong/)).toBeInTheDocument();
    expect(screen.getByText("Limitations")).toBeInTheDocument();
    expect(screen.getByText(/association, not causation/)).toBeInTheDocument();
    expect(screen.getAllByText(/Ground(ed)? · ask-sakura-v1/i).length).toBeGreaterThan(0);
    expect(screen.getByText("Grounded in 35 selected facts")).toBeInTheDocument();
    expect(screen.getByText(/fp abcdefab…/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View evidence" }).getAttribute("href")).toBe(
      "/intelligence",
    );
  });

  it("renders insufficient_evidence as LIMITED EVIDENCE, not an error", async () => {
    const limited: AskSakuraAnswer = {
      ...answer,
      status: "insufficient_evidence",
      answer: {
        text: "KLAC moved abnormally, but no sufficiently strong company-specific catalyst was identified.",
        evidenceRefs: ["anomaly.KLAC", "catalyst.KLAC.none"],
      },
    };
    stubResponder(
      async () =>
        new Response(successBody(limited), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );
    renderPanel();
    await ask("Why did KLAC move?");
    expect(
      await screen.findByText(/no sufficiently strong company-specific catalyst was identified/i),
    ).toBeInTheDocument();
    expect(screen.getByText("Limited Evidence")).toBeInTheDocument();
    expect(screen.queryByText(/temporarily unavailable/i)).toBeNull();
  });

  it("renders out_of_scope with the grounded scope helper", async () => {
    const scope: AskSakuraAnswer = {
      ...answer,
      status: "out_of_scope",
      answer: {
        text: "Ask Sakura currently answers questions using the Market War Room's grounded market evidence.",
        evidenceRefs: [],
      },
      supportingPoints: [],
      limitations: [],
    };
    stubResponder(
      async () =>
        new Response(successBody(scope), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );
    renderPanel();
    await ask("Write me a poem.");
    expect(
      await screen.findByText(/currently answers questions using the Market War Room/i),
    ).toBeInTheDocument();
    expect(screen.getByText("Out of Scope")).toBeInTheDocument();
    expect(screen.queryByText(answer.answer.text)).toBeNull();
  });

  it("renders API-level insufficient_grounded_data honestly", async () => {
    stubResponder(
      async () =>
        new Response(
          JSON.stringify({
            mode: "live",
            status: "insufficient_grounded_data",
            selectedFactCount: 0,
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
    );
    renderPanel();
    await ask("Why is the market moving?");
    expect(await screen.findByText("Current Data Insufficient")).toBeInTheDocument();
    expect(
      screen.getByText(/doesn't currently have enough reliable grounded market data/i),
    ).toBeInTheDocument();
  });

  it("renders unavailable with an accessible Retry that reuses the question", async () => {
    const fetchMock = vi.fn(async () => new Response("nope", { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);
    renderPanel();
    await ask("Why is FICO down?");
    expect(await screen.findByText("Ask Sakura temporarily unavailable.")).toBeInTheDocument();
    const retry = screen.getByRole("button", { name: "Retry" });
    expect(retry).toBeEnabled();
    await userEvent.click(retry);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const calls = fetchMock.mock.calls as unknown as Array<[unknown, RequestInit?]>;
    const body = JSON.parse(String(calls[1]![1]?.body));
    expect(body).toEqual({ question: "Why is FICO down?" });
  });

  it("never renders raw evidence IDs in normal prose", async () => {
    stubResponder(
      async () =>
        new Response(successBody(), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );
    renderPanel();
    await ask("Why is FICO down so much?");
    await screen.findByText(answer.answer.text);
    expect(screen.queryByText("anomaly.FICO")).toBeNull();
    expect(screen.queryByText("catalyst.FICO.primary")).toBeNull();
    expect(screen.queryByText(/provider|model|system prompt|reasoning_content/i)).toBeNull();
  });
});
