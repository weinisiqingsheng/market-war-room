import { describe, expect, it } from "vitest";
import type { EvidenceDomain, EvidenceFact, JSONObject } from "@/lib/ai-brief/types";
import { validateAskSakuraAnswer } from "@/lib/ask-sakura/grounding-validator";
import type { AskSakuraAnswer } from "@/lib/ask-sakura/types";

function fact(
  id: string,
  domain: EvidenceDomain,
  text: string,
  extra: JSONObject = {},
): EvidenceFact {
  return {
    id,
    domain,
    text,
    data: extra,
    asOf: "2026-09-05T13:00:00Z",
    freshness: "delayed",
    confidence: null,
    sourceVersion: "v1",
  };
}

const facts: EvidenceFact[] = [
  fact("anomaly.FICO", "anomaly", "FICO fell 16.7% with an EXTREME anomaly score."),
  fact(
    "catalyst.FICO.primary",
    "catalyst",
    "FICO's strongest matched catalyst is REGULATORY / LEGAL with moderate evidence.",
    { evidenceStrength: "moderate" },
  ),
  fact("anomaly.LULU", "anomaly", "LULU fell 17.4% with an EXTREME anomaly score."),
  fact(
    "catalyst.LULU.primary",
    "catalyst",
    "LULU's strongest matched catalyst is GUIDANCE with strong evidence.",
    { evidenceStrength: "strong" },
  ),
  fact("anomaly.KLAC", "anomaly", "KLAC rose 7.3% with an extreme anomaly score."),
  fact(
    "catalyst.KLAC.none",
    "catalyst",
    "No sufficiently strong company-specific catalyst was identified for KLAC.",
  ),
  fact("market.spy", "market", "SPY fell 0.4% in the latest market observation."),
];

const TICKER_SELECTION: { detectedTickers: string[]; selectionMode: "ticker_scoped" } = {
  detectedTickers: ["FICO"],
  selectionMode: "ticker_scoped",
};

function answered(overrides: Partial<AskSakuraAnswer> = {}): AskSakuraAnswer {
  return {
    version: "ask-sakura-v1",
    status: "answered",
    answer: { text: "FICO fell 16.7% amid an extreme anomaly.", evidenceRefs: ["anomaly.FICO"] },
    supportingPoints: [],
    limitations: [],
    ...overrides,
  };
}

describe("ask-sakura grounding validator", () => {
  it("rejects unknown evidence refs and refs outside the selected pack", () => {
    expect(
      validateAskSakuraAnswer(
        answered({ answer: { text: "x", evidenceRefs: ["catalyst.UNKNOWN"] } }),
        facts,
        TICKER_SELECTION,
      ).valid,
    ).toBe(false);
    expect(
      validateAskSakuraAnswer(
        answered({ answer: { text: "SPY fell.", evidenceRefs: ["market.spy"] } }),
        [facts[0]!, facts[1]!],
        TICKER_SELECTION,
      ).valid,
    ).toBe(false);
  });

  it("rejects unsupported numbers and accepts exact supported numbers", () => {
    expect(
      validateAskSakuraAnswer(
        answered({ answer: { text: "FICO fell 99% today.", evidenceRefs: ["anomaly.FICO"] } }),
        facts,
        TICKER_SELECTION,
      ).valid,
    ).toBe(false);
    expect(validateAskSakuraAnswer(answered(), facts, TICKER_SELECTION).valid).toBe(true);
  });

  it("rejects derived arithmetic", () => {
    const invalid = answered({
      answer: {
        text: "FICO fell an average of 33.4% over two sessions.",
        evidenceRefs: ["anomaly.FICO"],
      },
    });
    expect(validateAskSakuraAnswer(invalid, facts, TICKER_SELECTION).valid).toBe(false);
  });

  it("rejects absolute causality", () => {
    const invalid = answered({
      answer: {
        text: "FICO fell because of the regulatory catalyst.",
        evidenceRefs: ["anomaly.FICO", "catalyst.FICO.primary"],
      },
    });
    expect(validateAskSakuraAnswer(invalid, facts, TICKER_SELECTION).valid).toBe(false);
  });

  it("rejects unsupported future events", () => {
    const invalid = answered({
      answer: { text: "FICO will report earnings tomorrow.", evidenceRefs: ["anomaly.FICO"] },
    });
    expect(validateAskSakuraAnswer(invalid, facts, TICKER_SELECTION).valid).toBe(false);
  });

  it("rejects wrong-ticker catalyst refs", () => {
    const invalid = answered({
      answer: {
        text: "FICO is pressured alongside a LULU guidance catalyst.",
        evidenceRefs: ["anomaly.FICO", "catalyst.LULU.primary"],
      },
    });
    expect(validateAskSakuraAnswer(invalid, facts, TICKER_SELECTION).valid).toBe(false);
  });

  it("rejects .none contradiction and catalyst strength overstatement", () => {
    const noneFacts = [facts[4]!, facts[5]!];
    const noneAnswer: AskSakuraAnswer = {
      ...answered({ status: "answered" }),
      answer: {
        text: "KLAC rose as analysts upgraded it amid semiconductor demand.",
        evidenceRefs: ["anomaly.KLAC", "catalyst.KLAC.none"],
      },
    };
    expect(
      validateAskSakuraAnswer(noneAnswer, [...noneFacts], {
        detectedTickers: ["KLAC"],
        selectionMode: "ticker_scoped",
      }).valid,
    ).toBe(false);

    const overstate = answered({
      answer: {
        text: "Strong evidence confirmed the FICO regulatory catalyst.",
        evidenceRefs: ["anomaly.FICO", "catalyst.FICO.primary"],
      },
    });
    expect(validateAskSakuraAnswer(overstate, facts, TICKER_SELECTION).valid).toBe(false);
  });

  it("allows an honest .none statement", () => {
    const noneAnswer: AskSakuraAnswer = {
      ...answered({ status: "insufficient_evidence" }),
      status: "insufficient_evidence",
      answer: {
        text: "KLAC experienced an abnormal move, but no sufficiently strong company-specific catalyst was identified in the available evidence.",
        evidenceRefs: ["anomaly.KLAC", "catalyst.KLAC.none"],
      },
    };
    const noneFacts = [facts[4]!, facts[5]!];
    expect(
      validateAskSakuraAnswer(noneAnswer, noneFacts, {
        detectedTickers: ["KLAC"],
        selectionMode: "ticker_scoped",
      }).valid,
    ).toBe(true);
  });

  it("rejects answered prose without evidence refs", () => {
    const invalid = answered({ answer: { text: "FICO fell sharply.", evidenceRefs: [] } });
    expect(validateAskSakuraAnswer(invalid, facts, TICKER_SELECTION).valid).toBe(false);
  });

  it("accepts procedural out_of_scope and rejects outside factual content", () => {
    const scope: AskSakuraAnswer = {
      version: "ask-sakura-v1",
      status: "out_of_scope",
      answer: {
        text: "Ask Sakura currently answers questions using the Market War Room's grounded market evidence.",
        evidenceRefs: [],
      },
      supportingPoints: [],
      limitations: [],
    };
    expect(validateAskSakuraAnswer(scope, facts, TICKER_SELECTION).valid).toBe(true);

    const outside: AskSakuraAnswer = {
      ...scope,
      answer: {
        text: "The president of the United States lives in the White House.",
        evidenceRefs: [],
      },
    };
    expect(validateAskSakuraAnswer(outside, facts, TICKER_SELECTION).valid).toBe(false);
  });
});
