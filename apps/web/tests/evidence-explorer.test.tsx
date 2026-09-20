import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within, cleanup } from "@testing-library/react";
import { EvidenceExplorer } from "@/features/intelligence/components/EvidenceExplorer";
import type { AiEvidenceApiOk, AiEvidenceContext } from "@/lib/ai-brief/evidence-api-types";

function context(overrides: Partial<AiEvidenceContext> = {}): AiEvidenceContext {
  return {
    version: "brief-context-v1",
    fingerprint: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    inputConfidence: { score: 0.9, label: "high" },
    sources: {
      market: {
        available: true,
        asOf: "2026-09-05T13:00:00Z",
        freshness: "fresh",
        confidence: null,
        version: null,
      },
      macro: {
        available: true,
        asOf: "2026-09-05T12:00:00Z",
        freshness: "stale",
        confidence: null,
        version: null,
      },
      regime: {
        available: false,
        asOf: null,
        freshness: "unavailable",
        confidence: null,
        version: null,
      },
      breadth: {
        available: true,
        asOf: "2026-09-05T13:00:00Z",
        freshness: "delayed",
        confidence: "high",
        version: "breadth-v1",
      },
      anomalies: {
        available: true,
        asOf: "2026-09-05T13:00:00Z",
        freshness: "delayed",
        confidence: null,
        version: "anomaly-v1",
      },
      catalysts: {
        available: true,
        asOf: "2026-09-05T13:00:00Z",
        freshness: "delayed",
        confidence: null,
        version: "catalyst-match-v1",
      },
    },
    evidence: [
      {
        id: "anomaly.FICO",
        domain: "anomaly",
        text: "FICO fell sharply with an EXTREME anomaly score.",
        asOf: "2026-09-05T13:00:00Z",
        freshness: "delayed",
        confidence: null,
        sourceVersion: "anomaly-v1",
      },
      {
        id: "catalyst.FICO.primary",
        domain: "catalyst",
        text: "FICO matched a REGULATORY / LEGAL catalyst.",
        asOf: "2026-09-05T13:00:00Z",
        freshness: "delayed",
        confidence: null,
        sourceVersion: "catalyst-match-v1",
      },
      {
        id: "macro.vix",
        domain: "macro",
        text: "VIX stale macro reading.",
        asOf: "2026-09-05T12:00:00Z",
        freshness: "stale",
        confidence: null,
        sourceVersion: null,
      },
      {
        id: "market.spy",
        domain: "market",
        text: "SPY rose 0.4% in the latest market observation.",
        asOf: "2026-09-05T13:00:00Z",
        freshness: "fresh",
        confidence: null,
        sourceVersion: "market",
      },
    ],
    ...overrides,
  };
}

function payload(overrides: Partial<AiEvidenceApiOk> = {}): AiEvidenceApiOk {
  return { mode: "live", status: "ok", context: context(), ...overrides };
}

function renderExplorer(props: Partial<Parameters<typeof EvidenceExplorer>[0]> = {}) {
  const defaultProps = {
    data: payload(),
    status: "ready" as const,
    onRefresh: vi.fn(),
    aiFingerprint: null,
    focusRefs: [] as string[],
    onClearFocus: vi.fn(),
    ...props,
  };
  render(<EvidenceExplorer {...defaultProps} />);
  return defaultProps;
}

describe("Evidence Explorer", () => {
  it("shows the dynamic fact count, never a hard-coded 49", () => {
    renderExplorer();
    expect(screen.getByText(/4 grounded evidence facts/)).toBeInTheDocument();
  });

  it("domain filters keep their subset and preserve sealed ordering for All", () => {
    const { onClearFocus } = renderExplorer();
    expect(onClearFocus).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "Catalyst" }));
    expect(screen.getByText(/REGULATORY \/ LEGAL catalyst/)).toBeInTheDocument();
    expect(screen.queryByText(/SPY rose/)).toBeNull();
    expect(screen.queryByText(/stale macro reading/)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "All" }));
    const articles = screen.getAllByRole("article");
    const ids = articles.map((article) => article.querySelector("code")?.textContent);
    expect(ids).toEqual(["anomaly.FICO", "catalyst.FICO.primary", "macro.vix", "market.spy"]);
  });

  it("FICO search matches both anomaly and catalyst evidence", () => {
    renderExplorer();
    fireEvent.change(screen.getByLabelText(/Search evidence/), { target: { value: "FICO" } });
    expect(screen.getByText(/FICO fell sharply/)).toBeInTheDocument();
    expect(screen.getByText(/FICO matched a REGULATORY/)).toBeInTheDocument();
    expect(screen.queryByText(/stale macro reading/)).toBeNull();
  });

  it("renders the Source Health strip with an honest unavailable source", () => {
    renderExplorer();
    const health = screen.getByRole("region", { name: "Source Health" });
    expect(within(health).getByText("Regime")).toBeInTheDocument();
    expect(within(health).getAllByText("Unavailable").length).toBeGreaterThan(0);
    expect(within(health).getByText(/Delayed SIP is expected/)).toBeInTheDocument();
  });

  it("displays stale freshness without bearish styling", () => {
    renderExplorer();
    const staleArticle = screen.getByText(/stale macro reading/).closest("article");
    expect(staleArticle).not.toBeNull();
    const staleLabel = within(staleArticle as HTMLElement).getByText("Stale");
    expect(staleLabel.className).toContain("text-warn");
    expect(staleLabel.className).not.toContain("text-neg");
  });

  it("shows Evidence Aligned when AI and explorer fingerprints match", () => {
    renderExplorer({
      aiFingerprint: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    });
    expect(screen.getByText("Evidence Aligned")).toBeInTheDocument();
    expect(screen.queryByText("Evidence Updated")).toBeNull();
  });

  it("shows Evidence Updated (non-fatal, amber) when fingerprints differ", () => {
    renderExplorer({
      aiFingerprint: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    });
    expect(screen.getByText("Evidence Updated")).toBeInTheDocument();
    expect(screen.queryByText("Evidence Aligned")).toBeNull();
    expect(screen.getByText("Evidence Updated").className).toContain("text-warn");
    expect(screen.getByText("Evidence Updated").className).not.toContain("text-neg");
  });

  it("focuses selected refs and Clear restores the full stream", () => {
    const onClearFocus = vi.fn();
    renderExplorer({ focusRefs: ["market.spy"], onClearFocus });
    expect(screen.getByText(/SPY rose/)).toBeInTheDocument();
    expect(screen.queryByText(/stale macro reading/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(onClearFocus).toHaveBeenCalledTimes(1);
  });

  it("an unknown selected ref never crashes the UI", () => {
    renderExplorer({ focusRefs: ["catalyst.UNKNOWN"] });
    expect(screen.getByText(/no matching evidence for the selected claim/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Clear" })).toBeInTheDocument();
  });

  it("shows loading, error and empty states honestly", () => {
    renderExplorer({ data: null, status: "loading" });
    expect(screen.getByRole("status", { name: /Loading grounded evidence/i })).toBeInTheDocument();

    cleanup();
    renderExplorer({ data: null, status: "error" });
    expect(screen.getByText("Evidence Explorer temporarily unavailable.")).toBeInTheDocument();

    cleanup();
    renderExplorer({
      data: { mode: "live", status: "ok", context: { ...context(), evidence: [] } },
    });
    expect(screen.getByText("No grounded evidence is currently available.")).toBeInTheDocument();
  });
});
