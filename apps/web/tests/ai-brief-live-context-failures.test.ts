import { describe, expect, it } from "vitest";
import { buildLiveBriefContextWithBuilders } from "@/lib/ai-brief/live-context";
import { makeBuilders, countLogs } from "./helpers/ai-brief-live-fixtures";

const GENERATED_AT = "2026-09-06T01:30:00.000Z";
const counts = (logs: ReturnType<typeof countLogs>) => (logs as unknown as { counts: Record<string, number> }).counts;

describe("live orchestration failures and dependency skips", () => {
  it("market throws → regime skipped; breadth/anomalies survive", async () => {
    const logs = countLogs();
    const ctx = await buildLiveBriefContextWithBuilders({ generatedAt: GENERATED_AT, builders: makeBuilders({ market: true }, logs) });
    expect(counts(logs).regime).toBe(0);
    expect(ctx.sources.market.available).toBe(false);
    expect(ctx.sources.regime.available).toBe(false);
    expect(ctx.sources.breadth.available).toBe(true);
    expect(ctx.sources.anomalies.available).toBe(true);
  });
  it("macro throws → regime skipped; others survive", async () => {
    const logs = countLogs();
    const ctx = await buildLiveBriefContextWithBuilders({ generatedAt: GENERATED_AT, builders: makeBuilders({ macro: true }, logs) });
    expect(counts(logs).regime).toBe(0);
    expect(ctx.sources.macro.available).toBe(false);
    expect(ctx.sources.regime.available).toBe(false);
    expect(ctx.sources.market.available).toBe(true);
    expect(ctx.evidence.some((f) => f.id === "regime.overall")).toBe(false);
  });
  it("anomalies throw → catalysts skipped; no catalyst facts survive", async () => {
    const logs = countLogs();
    const ctx = await buildLiveBriefContextWithBuilders({ generatedAt: GENERATED_AT, builders: makeBuilders({ anomalies: true }, logs) });
    expect(counts(logs).catalysts).toBe(0);
    expect(ctx.sources.anomalies.available).toBe(false);
    expect(ctx.sources.catalysts.available).toBe(false);
    expect(ctx.evidence.some((f) => f.domain === "catalyst")).toBe(false);
  });
  it("breadth throws → only breadth unavailable", async () => {
    const ctx = await buildLiveBriefContextWithBuilders({ generatedAt: GENERATED_AT, builders: makeBuilders({ breadth: true }) });
    expect(ctx.sources.breadth.available).toBe(false);
    expect(ctx.sources.market.available).toBe(true);
    expect(ctx.sources.catalysts.available).toBe(true);
  });
  it("regime throws after valid upstream → only regime unavailable; market/macro facts remain", async () => {
    const ctx = await buildLiveBriefContextWithBuilders({ generatedAt: GENERATED_AT, builders: makeBuilders({ regime: true }) });
    expect(ctx.sources.regime.available).toBe(false);
    expect(ctx.evidence.some((f) => f.domain === "regime")).toBe(false);
    expect(ctx.evidence.some((f) => f.domain === "market")).toBe(true);
  });
  it("catalysts throw after valid anomalies → only catalysts unavailable; anomaly facts remain", async () => {
    const ctx = await buildLiveBriefContextWithBuilders({ generatedAt: GENERATED_AT, builders: makeBuilders({ catalysts: true }) });
    expect(ctx.sources.catalysts.available).toBe(false);
    expect(ctx.evidence.some((f) => f.id === "anomaly.LULU")).toBe(true);
  });
  it("all base builders throw → valid insufficient context; dependents skipped; no exception", async () => {
    const logs = countLogs();
    const ctx = await buildLiveBriefContextWithBuilders({ generatedAt: GENERATED_AT, builders: makeBuilders({ market: true, macro: true, breadth: true, anomalies: true, regime: true, catalysts: true }, logs) });
    expect(counts(logs).regime).toBe(0);
    expect(counts(logs).catalysts).toBe(0);
    expect(ctx.inputConfidence.label).toBe("insufficient");
    expect(ctx.version).toBe("brief-context-v1");
  });
});
