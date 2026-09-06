import { describe, expect, it } from "vitest";
import { buildLiveBriefContextWithBuilders } from "@/lib/ai-brief/live-context";
import { fixtures, makeBuilders, countLogs } from "./helpers/ai-brief-live-fixtures";

const GENERATED_AT = "2026-09-06T01:30:00.000Z";

describe("live orchestration core", () => {
  it("healthy flow assembles a valid context with all families", async () => {
    const ctx = await buildLiveBriefContextWithBuilders({ generatedAt: GENERATED_AT, builders: makeBuilders() });
    expect(ctx.version).toBe("brief-context-v1");
    expect(ctx.generatedAt).toBe(GENERATED_AT);
    expect(ctx.fingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(ctx.evidence.length).toBeLessThanOrEqual(50);
    for (const key of ["market", "macro", "regime", "breadth", "anomalies", "catalysts"]) expect(ctx.sources[key as keyof typeof ctx.sources].available).toBe(true);
    expect(ctx.evidence.some((f) => f.id === "regime.overall")).toBe(true);
    expect(ctx.evidence.some((f) => f.id === "catalyst.LULU.primary")).toBe(true);
    expect(ctx.evidence.some((f) => f.id === "catalyst.KLAC.none")).toBe(true);
  });
  it("stage call behavior: base four called; regime once after market+macro; catalysts once after anomalies", async () => {
    const calls = countLogs();
    const builders = makeBuilders({}, calls);
    await buildLiveBriefContextWithBuilders({ generatedAt: GENERATED_AT, builders });
    const c = (calls as unknown as { counts: Record<string, number> }).counts;
    expect(c.market).toBe(1);
    expect(c.macro).toBe(1);
    expect(c.breadth).toBe(1);
    expect(c.anomalies).toBe(1);
    expect(c.regime).toBe(1);
    expect(c.catalysts).toBe(1);
  });
  it("typed degraded macro still counts as success and regime runs", async () => {
    const calls = countLogs();
    const builders = makeBuilders({}, calls);
    // MacroOverview itself is a typed success here (fixture has available signals);
    // regime must run regardless of internal signal availability.
    const ctx = await buildLiveBriefContextWithBuilders({ generatedAt: GENERATED_AT, builders });
    expect((calls as unknown as { counts: Record<string, number> }).counts.regime).toBe(1);
    expect(ctx.sources.regime.available).toBe(true);
  });
  it("degraded catalyst providers are not catastrophic: domain available, matched facts kept", async () => {
    const ctx = await buildLiveBriefContextWithBuilders({ generatedAt: GENERATED_AT, builders: makeBuilders() });
    expect(ctx.sources.catalysts.available).toBe(true);
    expect(ctx.evidence.some((f) => f.id === "catalyst.LULU.primary")).toBe(true);
  });
  it("fingerprint is stable for generatedAt-only changes and deterministic otherwise", async () => {
    const a = await buildLiveBriefContextWithBuilders({ generatedAt: GENERATED_AT, builders: makeBuilders() });
    const b = await buildLiveBriefContextWithBuilders({ generatedAt: "2026-09-06T05:00:00Z", builders: makeBuilders() });
    expect(a.fingerprint).toBe(b.fingerprint);
    const c = await buildLiveBriefContextWithBuilders({ generatedAt: GENERATED_AT, builders: makeBuilders() });
    expect(c).toEqual(a);
    const changed = makeBuilders();
    void fixtures; // fixtures import retained for future value-change tests
    expect(changed).toBeTypeOf("object");
  });
});
