import { describe, expect, it } from "vitest";
import { buildDemoBriefContext } from "@/lib/ai-brief/demo-context";
import { selectEvidenceForQuestion } from "@/lib/ask-sakura/select-evidence";

const context = buildDemoBriefContext();

describe("ask-sakura deterministic evidence selection", () => {
  it("detects FICO and selects FICO anomaly + catalyst without LULU catalyst", () => {
    const selection = selectEvidenceForQuestion(context, "Why is FICO down so much?");
    expect(selection.detectedTickers).toEqual(["FICO"]);
    expect(selection.selectionMode).toBe("ticker_scoped");
    expect(selection.selectedFactIds).toContain("anomaly.FICO");
    expect(selection.selectedFactIds).toContain("catalyst.FICO.primary");
    expect(selection.selectedFactIds).not.toContain("catalyst.LULU.primary");
    expect(selection.selectedFactIds).not.toContain("anomaly.LULU");
  });

  it("includes global market/regime/breadth/macro/sector context for a ticker question", () => {
    const selection = selectEvidenceForQuestion(context, "Why is FICO down so much?");
    const has = (prefix: string) => selection.selectedFactIds.some((id) => id.startsWith(prefix));
    expect(has("market.")).toBe(true);
    expect(has("regime.")).toBe(true);
    expect(has("breadth.")).toBe(true);
    expect(has("macro.")).toBe(true);
    expect(has("sector.")).toBe(true);
  });

  it("does not treat unknown uppercase tokens as tickers", () => {
    const selection = selectEvidenceForQuestion(context, "What is the weather in the USA today?");
    expect(selection.selectionMode).toBe("full_pack");
    expect(selection.detectedTickers).toEqual([]);
  });

  it("uses the full pack when no explicit evidence symbol appears", () => {
    const selection = selectEvidenceForQuestion(context, "Is market breadth weak?");
    expect(selection.selectionMode).toBe("full_pack");
    expect(selection.selectedFactIds.length).toBe(context.evidence.length);
  });

  it("is deterministic and never fabricates facts", () => {
    const a = selectEvidenceForQuestion(context, "Why did KLAC move?");
    const b = selectEvidenceForQuestion(context, "Why did KLAC move?");
    expect(a.selectedFactIds).toEqual(b.selectedFactIds);
    expect(a.detectedTickers).toEqual(["KLAC"]);
    const ids = new Set(context.evidence.map((fact) => fact.id));
    for (const id of a.selectedFactIds) expect(ids.has(id)).toBe(true);
    expect(a.facts.length).toBe(a.safeFacts.length);
    for (const fact of a.safeFacts) expect(fact).not.toHaveProperty("data");
  });

  it("keeps catalyst.KLAC.none available so .none can be surfaced", () => {
    const selection = selectEvidenceForQuestion(context, "Why did KLAC move?");
    expect(selection.selectedFactIds).toContain("anomaly.KLAC");
    expect(selection.selectedFactIds).toContain("catalyst.KLAC.none");
    expect(selection.selectedFactIds).not.toContain("catalyst.KLAC.primary");
  });
});
