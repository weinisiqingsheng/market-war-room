import { describe, expect, it, vi } from "vitest";
import { buildDemoBriefContext } from "@/lib/ai-brief/demo-context";
import { generateGroundedMarketBrief } from "@/lib/ai-brief/generate";
import { parseGroundedMarketBrief } from "@/lib/ai-brief/schema";
import { validateGroundedMarketBrief } from "@/lib/ai-brief/grounding-validator";
import { AI_BRIEF_SYSTEM_PROMPT } from "@/lib/ai-brief/prompt";
import {
  EVIDENCE_DELIMITER_END,
  EVIDENCE_DELIMITER_START,
} from "@/lib/ai-brief/serialize-context";
import type { GroundedMarketBrief } from "@/lib/ai-brief/brief-types";
import type { BriefContext, EvidenceFact } from "@/lib/ai-brief/types";
import type { LlmMessage, LlmRequest, LlmResponse } from "@/lib/llm/types";

const section = (text: string, ...evidenceRefs: string[]) => ({ text, evidenceRefs });

function validBrief(): GroundedMarketBrief {
  return {
    version: "ai-brief-v1",
    headline: "Weak breadth offsets calm volatility",
    stance: {
      label: "CAUTIOUS / NEUTRAL",
      summary: "Cautious regime with weak participation.",
      evidenceRefs: ["regime.overall", "breadth.summary"],
    },
    overview: [section("The regime is CAUTIOUS / NEUTRAL at 49/100.", "regime.overall")],
    keyDrivers: [
      {
        title: "Breadth",
        text: "Only 34.9% of members advanced.",
        impact: "negative",
        evidenceRefs: ["breadth.advanceRatio"],
      },
      { title: "Oil", text: "WTI rose 5.1%.", impact: "negative", evidenceRefs: ["macro.wti"] },
    ],
    marketInternals: section(
      "35.0% of constituents were above their 20-day moving average.",
      "breadth.above20",
    ),
    macro: section("VIX was 14.3 in the latest available daily observation.", "macro.vix"),
    notableMoves: [
      {
        ticker: "FICO",
        text: "FICO fell 16.7% alongside a regulatory/legal match.",
        evidenceRefs: ["anomaly.FICO", "catalyst.FICO.primary"],
      },
    ],
    watchNext: [section("Watch whether weak breadth improves.", "breadth.summary")],
    dataQuality: {
      confidence: "high",
      text: "All primary domains available.",
      evidenceRefs: ["breadth.summary"],
    },
  };
}

function providerReturning(...contents: string[]) {
  const queue = [...contents];
  const complete = vi.fn(async (request: LlmRequest): Promise<LlmResponse> => {
    if (!request.messages.length) throw new Error("provider called without messages");
    return { content: queue.shift() ?? JSON.stringify(validBrief()), model: "test-model", usage: {} };
  });
  return { complete };
}

function evidenceBlock(messages: LlmMessage[]): string {
  const user = messages.find((message) => message.content.includes(EVIDENCE_DELIMITER_START));
  const content = user?.content ?? "";
  const start = content.indexOf(EVIDENCE_DELIMITER_START) + EVIDENCE_DELIMITER_START.length;
  const end = content.indexOf(EVIDENCE_DELIMITER_END);
  return content.slice(start, end).trim();
}


describe("AI brief schema reliability (targeted fix)", () => {
  it("prompt states the mandatory non-empty evidenceRefs requirement for every section", () => {
    expect(AI_BRIEF_SYSTEM_PROMPT).toContain("NON-EMPTY evidenceRefs");
    expect(AI_BRIEF_SYSTEM_PROMPT).toContain("Never omit evidenceRefs");
    expect(AI_BRIEF_SYSTEM_PROMPT).toContain("including dataQuality");
  });

  it("still rejects a brief whose dataQuality.evidenceRefs is empty (validation not weakened)", () => {
    const broken = {
      ...validBrief(),
      dataQuality: { confidence: "high", text: "x", evidenceRefs: [] },
    };
    const parsed = parseGroundedMarketBrief(broken);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.errors.join(" ")).toContain(
        "dataQuality.evidenceRefs must be a non-empty array.",
      );
    }
  });

  it("recovers with one repair and names the missing section in the repair instruction", async () => {
    const context = buildDemoBriefContext();
    const broken = {
      ...validBrief(),
      dataQuality: { confidence: "high", text: "All good.", evidenceRefs: [] },
    };
    const provider = providerReturning(JSON.stringify(broken), JSON.stringify(validBrief()));

    const result = await generateGroundedMarketBrief({ context, provider });

    expect(result.status).toBe("generated");
    expect(result.attempts).toBe(2);
    const calls = provider.complete.mock.calls;
    expect(calls).toHaveLength(2);

    const repairMessages = calls[1]?.[0].messages ?? [];
    const repairText = repairMessages.map((message) => message.content).join("\n");
    expect(repairText).toContain("SCHEMA_INVALID at brief: dataQuality.evidenceRefs must be a non-empty array.");
    expect(repairText).toContain("NON-EMPTY evidenceRefs");
    // Same evidence, same question between attempts.
    expect(evidenceBlock(repairMessages)).toBe(evidenceBlock(calls[0]?.[0].messages ?? []));
  });

  it("reports schema_validation_failed after two identical schema failures", async () => {
    const context = buildDemoBriefContext();
    const broken = {
      ...validBrief(),
      dataQuality: { confidence: "high", text: "All good.", evidenceRefs: [] },
    };
    const provider = providerReturning(JSON.stringify(broken), JSON.stringify(broken));

    const result = await generateGroundedMarketBrief({ context, provider });

    expect(result.status).toBe("unavailable");
    expect(result.attempts).toBe(2);
    if (result.status === "unavailable") {
      expect(result.reason).toBe("schema_validation_failed");
    }
    expect(provider.complete).toHaveBeenCalledTimes(2);
  });
});


describe("brief number validation with thousands separators", () => {
  const volumeFact: EvidenceFact = {
    id: "macro.volume",
    domain: "macro",
    text: "Session volume was 191619629 shares.",
    data: { volume: 191619629 },
    asOf: "2026-09-19T20:00:00.000Z",
    freshness: "delayed",
    confidence: null,
    sourceVersion: "test",
  };

  function contextWith(fact: EvidenceFact): BriefContext {
    return {
      version: "brief-context-v1",
      generatedAt: "2026-09-19T20:05:00.000Z",
      sources: {
        market: { available: false, asOf: null, freshness: "unavailable", confidence: null, version: null },
        macro: { available: true, asOf: fact.asOf, freshness: "delayed", confidence: null, version: "test" },
        regime: { available: false, asOf: null, freshness: "unavailable", confidence: null, version: null },
        breadth: { available: false, asOf: null, freshness: "unavailable", confidence: null, version: null },
        anomalies: { available: false, asOf: null, freshness: "unavailable", confidence: null, version: null },
        catalysts: { available: false, asOf: null, freshness: "unavailable", confidence: null, version: null },
      },
      evidence: [fact],
      inputConfidence: { score: 0.95, label: "high" },
      fingerprint: "f".repeat(64),
    };
  }

  function issueCodes(brief: GroundedMarketBrief, context: BriefContext): string[] {
    const result = validateGroundedMarketBrief(brief, context);
    return result.valid ? [] : result.issues.map((issue) => issue.code);
  }

  /** Minimal brief referencing only the volume fact, with no other numbers. */
  function minimalBrief(macroText: string): GroundedMarketBrief {
    const ref = ["macro.volume"];
    return {
      version: "ai-brief-v1",
      headline: "Volume was the only supplied evidence",
      stance: { label: "NEUTRAL", summary: "Only volume evidence was supplied.", evidenceRefs: ref },
      overview: [section("Only volume evidence was supplied.", ...ref)],
      keyDrivers: [
        { title: "Volume", text: "Volume was the only supplied evidence.", impact: "mixed", evidenceRefs: ref },
        { title: "Coverage", text: "No other domains were supplied.", impact: "mixed", evidenceRefs: ref },
      ],
      marketInternals: section("Only volume evidence was supplied.", ...ref),
      macro: section(macroText, ...ref),
      notableMoves: [],
      watchNext: [section("Watch whether volume normalizes.", ...ref)],
      dataQuality: { confidence: "medium", text: "Only volume evidence was supplied.", evidenceRefs: ref },
    };
  }

  it("accepts a comma-formatted restatement of the exact evidence number", () => {
    const context = contextWith(volumeFact);
    const brief = minimalBrief("Session volume was 191,619,629 shares.");
    expect(issueCodes(brief, context)).not.toContain("UNSUPPORTED_NUMBER");
  });

  it("still rejects a comma-formatted number that is not in the cited evidence", () => {
    const context = contextWith(volumeFact);
    const brief = minimalBrief("Session volume was 999,999,999 shares.");
    expect(issueCodes(brief, context)).toContain("UNSUPPORTED_NUMBER");
  });
});
