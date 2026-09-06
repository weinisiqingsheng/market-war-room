import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildLiveBriefContextWithBuilders, buildLiveBriefContext } from "@/lib/ai-brief/live-context";
import { makeBuilders } from "./helpers/ai-brief-live-fixtures";

const GENERATED_AT = "2026-09-06T01:30:00.000Z";
const SOURCE = readFileSync(resolve("lib/ai-brief/live-context.ts"), "utf8");

describe("live orchestration security and integrity", () => {
  it("thrown error secrets and stacks never enter the context", async () => {
    const failing = makeBuilders({ market: true, macro: true, breadth: true, anomalies: true, regime: true, catalysts: true });
    failing.market = async () => { throw new Error("ALPACA_API_KEY_ID=SUPER_SECRET_123\nat stack()"); };
    const ctx = await buildLiveBriefContextWithBuilders({ generatedAt: GENERATED_AT, builders: failing });
    const serialized = JSON.stringify(ctx);
    expect(serialized).not.toContain("SUPER_SECRET_123");
    expect(serialized).not.toContain("stack");
    expect(serialized).not.toContain("boom");
  });
  it("no live→demo fallback and no internal HTTP fetches", () => {
    expect(SOURCE).not.toContain("buildDemoOverview");
    expect(SOURCE).not.toContain("buildDemoMacroOverview");
    expect(SOURCE).not.toContain("buildDemoBriefContext");
    expect(SOURCE).not.toMatch(/fetch\(\s*["']\/api\//);
    expect(SOURCE).not.toContain("/api/");
  });
  it("injectable orchestrator has no Date.now dependency and is exported", () => {
    const core = SOURCE.slice(0, SOURCE.indexOf("export function buildLiveBriefContext"));
    expect(core).not.toContain("Date.now()");
    expect(core).toContain("export async function buildLiveBriefContextWithBuilders");
    expect(SOURCE).toContain("export function buildLiveBriefContext");
    expect(typeof buildLiveBriefContext).toBe("function");
  });
  it("changed real-domain value alters the fingerprint", async () => {
    const a = await buildLiveBriefContextWithBuilders({ generatedAt: GENERATED_AT, builders: makeBuilders() });
    const custom = makeBuilders();
    const base = await custom.market();
    const altered = { ...base, indices: [{ ticker: "SPY", changePct: 0.4 }] };
    custom.market = async () => altered as typeof base;
    const b = await buildLiveBriefContextWithBuilders({ generatedAt: GENERATED_AT, builders: custom });
    expect(b.fingerprint).not.toBe(a.fingerprint);
  });
  it("anomaly catastrophic failure leaves zero catalyst facts and no regime.overall on market/macro failure", async () => {
    const anom = await buildLiveBriefContextWithBuilders({ generatedAt: GENERATED_AT, builders: makeBuilders({ anomalies: true, catalysts: true }) });
    expect(anom.evidence.filter((f) => f.domain === "catalyst")).toHaveLength(0);
    const upstream = await buildLiveBriefContextWithBuilders({ generatedAt: GENERATED_AT, builders: makeBuilders({ market: true, macro: true, regime: true }) });
    expect(upstream.evidence.filter((f) => f.id === "regime.overall")).toHaveLength(0);
  });
});
