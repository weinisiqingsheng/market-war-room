import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { IntelligenceDashboard } from "@/features/intelligence/IntelligenceDashboard";
import { buildDemoGroundedBrief } from "@/lib/ai-brief/demo-brief";

const { pathnameMock } = vi.hoisted(() => ({ pathnameMock: vi.fn() }));

vi.mock("next/navigation", () => ({
  usePathname: () => pathnameMock(),
}));

vi.mock("next/link", async () => {
  const React = await import("react");
  return {
    default: (props: {
      href: string;
      children: React.ReactNode;
      className?: string;
      "aria-current"?: string;
    }) =>
      React.createElement(
        "a",
        { href: props.href, className: props.className, "aria-current": props["aria-current"] },
        props.children,
      ),
  };
});

const read = (rel: string) => readFileSync(resolve(rel), "utf8");
const dashboard = read("features/intelligence/IntelligenceDashboard.tsx");
const explorer = read("features/intelligence/components/EvidenceExplorer.tsx");
const route = read("app/intelligence/page.tsx");

const AI_FP = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

function evidencePayload(fingerprint: string) {
  return {
    mode: "live",
    status: "ok",
    context: {
      version: "brief-context-v1",
      fingerprint,
      inputConfidence: { score: 0.9, label: "high" },
      sources: {
        market: { available: true, asOf: "x", freshness: "fresh", confidence: null, version: null },
        macro: { available: true, asOf: "x", freshness: "stale", confidence: null, version: null },
        regime: {
          available: true,
          asOf: "x",
          freshness: "fresh",
          confidence: "high",
          version: null,
        },
        breadth: {
          available: true,
          asOf: "x",
          freshness: "delayed",
          confidence: null,
          version: "breadth-v1",
        },
        anomalies: {
          available: true,
          asOf: "x",
          freshness: "delayed",
          confidence: null,
          version: "anomaly-v1",
        },
        catalysts: {
          available: true,
          asOf: "x",
          freshness: "delayed",
          confidence: null,
          version: "catalyst-match-v1",
        },
      },
      evidence: [
        {
          id: "market.spy",
          domain: "market",
          text: "SPY rose 0.4% in the latest market observation.",
          asOf: "x",
          freshness: "fresh",
          confidence: null,
          sourceVersion: "market",
        },
      ],
    },
  };
}

function renderWithEvidence({ evidenceFingerprint }: { evidenceFingerprint: string }) {
  pathnameMock.mockReturnValue("/intelligence");
  const brief = buildDemoGroundedBrief();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/ai/market-brief")) {
        return new Response(
          JSON.stringify({
            mode: "live",
            status: "generated",
            brief,
            contextFingerprint: AI_FP,
            inputConfidence: { score: 0.9, label: "high" },
            cache: { hit: false },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      if (url.includes("/api/ai/evidence")) {
        return new Response(JSON.stringify(evidencePayload(evidenceFingerprint)), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      throw new Error(`unexpected fetch ${url}`);
    }),
  );
  return render(
    <IntelligenceDashboard
      marketMode="demo"
      regimeMode="demo"
      anomaliesMode="demo"
      catalystsMode="demo"
    />,
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function renderDemo() {
  pathnameMock.mockReturnValue("/intelligence");
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      throw new Error("no network in test");
    }),
  );
  return render(
    <IntelligenceDashboard
      marketMode="demo"
      regimeMode="demo"
      anomaliesMode="demo"
      catalystsMode="demo"
    />,
  );
}

describe("Intelligence page", () => {
  it("renders the Intelligence title and every intended module", () => {
    renderDemo();
    const headings = screen
      .getAllByRole("heading", { level: 2 })
      .map((heading) => heading.textContent);
    expect(headings).toEqual([
      "Intelligence",
      "Market Regime",
      "Sakura AI Market Brief",
      "Market Anomalies",
      "Catalyst Intelligence",
      "Evidence Explorer",
    ]);
  });

  it("does not duplicate the full Markets workspace", () => {
    renderDemo();
    expect(screen.queryByText("Major Indexes")).toBeNull();
    expect(screen.queryByText("Sector Rotation")).toBeNull();
    expect(screen.queryByText("Macro Pulse")).toBeNull();
    expect(screen.queryByText("Macro Dashboard")).toBeNull();
  });

  it("stays free of Ask Sakura and chat input", () => {
    renderDemo();
    expect(screen.queryByText(/Ask Sakura|Ask War Room|chat|question/i)).toBeNull();
  });

  it("shows Evidence Aligned when AI and explorer fingerprints match", async () => {
    renderWithEvidence({ evidenceFingerprint: AI_FP });
    expect(await screen.findByText("Evidence Aligned")).toBeInTheDocument();
    expect(screen.queryByText("Evidence Updated")).toBeNull();
  });

  it("shows Evidence Updated (amber, non-fatal) when fingerprints differ", async () => {
    renderWithEvidence({
      evidenceFingerprint: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    });
    expect(await screen.findByText("Evidence Updated")).toBeInTheDocument();
    expect(screen.queryByText("Evidence Aligned")).toBeNull();
  });
});

describe("Intelligence V1.1B boundaries", () => {
  it("does not import or invoke a new LLM provider", () => {
    for (const source of [dashboard, explorer, route]) {
      expect(source).not.toMatch(/@\/lib\/llm|createOpenAiCompatibleProvider|chat\/completions/);
    }
    expect(route).not.toContain("/api/ai/market-brief");
    expect(dashboard).not.toContain("fetch(");
    expect(explorer).not.toContain("fetch(");
  });

  it("keeps all client code free of API keys and raw provider payloads", () => {
    for (const source of [dashboard, explorer]) {
      expect(source).not.toMatch(
        /LLM_API_KEY|ALPACA_API|FRED_API_KEY|TWELVE_DATA_API_KEY|SEC_USER_AGENT|process\.env/,
      );
    }
    expect(explorer).not.toContain("fact.data");
    expect(explorer).not.toMatch(/alpaca|fred|news_body|reasoning_content/i);
  });

  it("contains no new anomaly/regime/breadth math or client rerank", () => {
    for (const source of [dashboard, explorer]) {
      expect(source).not.toMatch(/\.sort\(|Math\.max|Math\.min|advanceRatio|\.toFixed\(\s*2/);
    }
  });
});
