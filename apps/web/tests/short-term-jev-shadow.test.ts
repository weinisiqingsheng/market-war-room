import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildShadowRecord } from "@/lib/short-term/shadow/record";
import { joinObservedOutcome } from "@/lib/short-term/shadow/outcomes";
import { createLocalJsonlShadowStore } from "@/lib/short-term/shadow/store";
import type { ShortTermJevAssessment } from "@/lib/short-term/jev/types";

const assessment = {
  status: "fixture",
  runId: "run-1",
  requestedAt: "2026-09-18T19:00:00.000Z",
  model: "jev-1.13.0",
  questionSetVersion: "short-term-jev-questions-v1",
  inputContractVersion: "short-term-jev-assessment-v1",
  stateFingerprint: "c".repeat(64),
  answers: {},
  usage: { inputTokens: 10, outputTokens: 2, estimatedCostUsd: 0.000001 },
  latencyMs: 2,
  provenance: { kind: "fixture", source: "fixture", sourceFingerprint: "d".repeat(64) },
  cache: { hit: false },
} as ShortTermJevAssessment;

describe("offline Jev shadow records", () => {
  const temporaryDirectories: string[] = [];

  afterEach(() => {
    for (const directory of temporaryDirectories.splice(0))
      rmSync(directory, { recursive: true, force: true });
  });

  it("stores sanitized fields and excludes credentials/prompts", () => {
    const record = buildShadowRecord({
      assessment,
      request: { ticker: "NVDA", strategyId: "risk-first", horizonHours: 1, maxLossPct: 1 },
      marketState: {
        version: "short-term-market-state-v1",
        symbol: "NVDA",
        security: {
          name: "NVIDIA",
          exchange: "NASDAQ",
          assetClass: "us_equity",
          status: "active",
          tradable: true,
        },
        effectiveAsOf: "2026-09-18T19:00:00.000Z",
        marketSessionAsOf: "2026-09-18",
        marketSessionStatus: "closed",
        feed: "fixture",
        delayMinutes: null,
        availability: {
          price: false,
          volume: false,
          history: false,
          volatility: false,
          sector: false,
        },
        freshness: "unavailable",
        facts: [],
        provenance: { source: "fixture", sourceFingerprint: "e".repeat(64) },
      },
    });
    expect(JSON.stringify(record)).not.toMatch(/api[_-]?key|authorization|prompt/i);
    expect(record.stateFingerprint).toMatch(/^[a-f0-9]{64}$/);
  });

  it("rejects an outcome that is not after the decision timestamp", () => {
    expect(() =>
      joinObservedOutcome(
        { requestedAt: "2026-09-18T19:00:00.000Z", effectiveAsOf: "2026-09-18T20:00:00.000Z" },
        { observedAt: "2026-09-18T19:30:00.000Z", horizonHours: 1, label: "up" },
      ),
    ).toThrow("look-ahead");
  });

  it("persists only to an explicitly local temporary JSONL path", () => {
    const directory = mkdtempSync(join(tmpdir(), "short-term-shadow-"));
    temporaryDirectories.push(directory);
    const store = createLocalJsonlShadowStore(join(directory, "records.jsonl"));
    const record = buildShadowRecord({
      assessment,
      request: { ticker: "NVDA", strategyId: "risk-first", horizonHours: 1, maxLossPct: 1 },
      marketState: {
        version: "short-term-market-state-v1",
        symbol: "NVDA",
        security: { name: null, exchange: null, assetClass: null, status: null, tradable: null },
        effectiveAsOf: null,
        marketSessionAsOf: null,
        marketSessionStatus: "unknown",
        feed: "fixture",
        delayMinutes: null,
        availability: {
          price: false,
          volume: false,
          history: false,
          volatility: false,
          sector: false,
        },
        freshness: "unavailable",
        facts: [],
        provenance: { source: "fixture", sourceFingerprint: "e".repeat(64) },
      },
    });
    store.append(record);
    expect(store.list()).toEqual([record]);
    expect(() => createLocalJsonlShadowStore("/repo/shadow.jsonl")).toThrow("local temporary");
  });
});
