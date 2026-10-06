import { appendFileSync, mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type {
  FrozenProspectiveDecision,
  ProspectiveOutcomeRecord,
} from "@/lib/short-term/prospective/types";
import { createProspectiveStore } from "@/lib/short-term/prospective/store";

const decision = {
  schemaVersion: "short-term-prospective-decision-v1",
  runId: "store-1",
  ticker: "NVDA",
  identity: {
    symbol: "NVDA",
    name: "NVIDIA",
    exchange: "NASDAQ",
    assetClass: "us_equity",
    status: "active",
    tradable: true,
  },
  strategyId: "risk-first",
  horizon: "session_close",
  requestedAt: "2026-09-21T13:35:00.000Z",
  effectiveAsOf: "2026-09-21T13:45:00.000Z",
  marketSessionDate: "2026-09-21",
  marketSessionStatus: "regular",
  referencePrice: 100,
  previousClose: 99,
  feed: "delayed_sip",
  delayMinutes: 15,
  freshness: "delayed",
  availability: { price: true, volume: true, history: true, volatility: true, sector: true },
  stateFingerprint: "a".repeat(64),
  sourceFingerprint: "b".repeat(64),
  inputContractVersion: "short-term-jev-assessment-v1",
  questionSetVersion: "short-term-jev-questions-v1",
  pinnedModel: "jev-1.13.0",
  protocolVersion: "short-term-prospective-protocol-v1",
  deterministicBaseline: "flat",
  assessment: {
    answers: {},
    usage: { inputTokens: 1, outputTokens: 1, estimatedCostUsd: 0 },
    latencyMs: 1,
    resultStatus: "fixture",
    modelOutputStatus: "fixture_model_output",
  },
} as unknown as FrozenProspectiveDecision;

const outcome = {
  schemaVersion: "short-term-prospective-outcome-v2",
  runId: decision.runId,
  ticker: decision.ticker,
  stateFingerprint: decision.stateFingerprint,
  horizon: decision.horizon,
  decisionEffectiveAsOf: decision.effectiveAsOf,
  referencePrice: 100,
  observedPrice: 101,
  observedAt: "2026-09-21T20:01:00.000Z",
  sessionDate: "2026-09-21",
  provider: "fixture-market",
  feed: "delayed_sip",
  delayMinutes: 15,
  freshness: "delayed",
  availability: "available",
  priceReferenceType: "fixture_close",
  sourceVersion: "phase-2d-fixture-market-v2",
  sourceFingerprint: "d".repeat(64),
  completeness: "complete",
  returnPct: 1,
  label: "up",
  reason: null,
} as ProspectiveOutcomeRecord;

describe("Phase 2D separate prospective storage", () => {
  const directories: string[] = [];
  afterEach(() => {
    for (const directory of directories.splice(0))
      rmSync(directory, { recursive: true, force: true });
  });

  it("stores immutable decisions and linked outcomes in separate restricted files", () => {
    const directory = mkdtempSync(join(tmpdir(), "phase2d-store-"));
    directories.push(directory);
    const store = createProspectiveStore({ directory, retentionDays: 90 });
    store.appendDecision(decision);
    store.appendOutcome(outcome);

    expect(store.decisionFilePath).not.toBe(store.outcomeFilePath);
    expect(store.listDecisions()).toEqual([decision]);
    expect(store.listOutcomes()).toEqual([outcome]);
    expect(statSync(directory).mode & 0o777).toBe(0o700);
    expect(statSync(store.decisionFilePath).mode & 0o777).toBe(0o600);
    expect(statSync(store.outcomeFilePath).mode & 0o777).toBe(0o600);
  });

  it("rejects duplicate decisions, duplicate horizon outcomes, and outcomes without a matching decision", () => {
    const directory = mkdtempSync(join(tmpdir(), "phase2d-store-"));
    directories.push(directory);
    const store = createProspectiveStore({ directory, retentionDays: 90 });
    expect(() => store.appendOutcome(outcome)).toThrow("decision");
    store.appendDecision(decision);
    expect(() => store.appendDecision(decision)).toThrow(/duplicate/i);
    store.appendOutcome(outcome);
    expect(() => store.appendOutcome(outcome)).toThrow(/duplicate/i);
  });

  it("fails closed on malformed or partial existing JSONL", () => {
    const directory = mkdtempSync(join(tmpdir(), "phase2d-store-"));
    directories.push(directory);
    const store = createProspectiveStore({ directory, retentionDays: 90 });
    appendFileSync(store.decisionFilePath, '{"runId":"partial"\n', "utf8");
    expect(() => store.listDecisions()).toThrow("malformed");
    expect(() => store.appendDecision(decision)).toThrow("malformed");
  });
});
