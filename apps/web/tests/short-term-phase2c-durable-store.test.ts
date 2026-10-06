import {
  chmodSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { ShortTermShadowRecord } from "@/lib/short-term/shadow/types";
import { createDurableShadowStore } from "@/lib/short-term/evaluation/durable-shadow-store";

function record(runId: string, requestedAt: string): ShortTermShadowRecord {
  return {
    version: "short-term-shadow-record-v1",
    runId,
    requestedAt,
    ticker: "NVDA",
    strategyId: "risk-first",
    horizonHours: 1,
    maxLossPct: 1,
    stateFingerprint: runId.padEnd(64, "0").slice(0, 64),
    inputContractVersion: "short-term-jev-assessment-v1",
    questionSetVersion: "short-term-jev-questions-v1",
    pinnedModel: "jev-1.13.0",
    sanitizedState: {
      version: "short-term-market-state-v1",
      symbol: "NVDA",
      security: {
        name: "NVIDIA",
        exchange: "NASDAQ",
        assetClass: "us_equity",
        status: "active",
        tradable: true,
      },
      effectiveAsOf: requestedAt,
      marketSessionAsOf: requestedAt.slice(0, 10),
      marketSessionStatus: "closed",
      feed: "delayed_sip",
      delayMinutes: 15,
      availability: { price: true, volume: true, history: true, volatility: true, sector: true },
      freshness: "delayed",
      facts: [],
      provenance: { source: "ticker-context-v1", sourceFingerprint: "f".repeat(64) },
    },
    answers: {},
    usage: { inputTokens: 10, outputTokens: 2, estimatedCostUsd: 0.000001 },
    latencyMs: 12,
    resultStatus: "verified",
    marketInputStatus: "verified_market_input",
    modelOutputStatus: "real_jev_model_output",
    provenance: {
      kind: "verified_market_snapshot",
      source: "ticker-context-v1",
      sourceFingerprint: "f".repeat(64),
    },
    cacheHit: false,
  };
}

describe("Phase 2C durable local Shadow store", () => {
  const directories: string[] = [];

  afterEach(() => {
    for (const directory of directories.splice(0))
      rmSync(directory, { recursive: true, force: true });
  });

  it("creates a restrictive directory and file and reads records back", () => {
    const directory = mkdtempSync(join(tmpdir(), "phase2c-shadow-"));
    directories.push(directory);
    const store = createDurableShadowStore({ directory, retentionDays: 90 });
    store.append(record("run-1", "2026-09-18T19:00:00.000Z"));

    expect(store.list()).toHaveLength(1);
    expect(statSync(directory).mode & 0o777).toBe(0o700);
    expect(statSync(store.filePath).mode & 0o777).toBe(0o600);
    expect(
      readdirSync(directory).filter((name) => name.endsWith(".tmp") || name.endsWith(".lock")),
    ).toEqual([]);
  });

  it("rejects repository paths before creating storage", () => {
    expect(() =>
      createDurableShadowStore({
        directory: join(process.cwd(), "phase2c-shadow"),
        retentionDays: 90,
      }),
    ).toThrow("outside the repository");
  });

  it("rejects duplicate run IDs without changing the JSONL file", () => {
    const directory = mkdtempSync(join(tmpdir(), "phase2c-shadow-"));
    directories.push(directory);
    const store = createDurableShadowStore({ directory, retentionDays: 90 });
    const first = record("run-duplicate", "2026-09-18T19:00:00.000Z");
    store.append(first);
    const before = readFileSync(store.filePath, "utf8");

    expect(() => store.append(first)).toThrow("duplicate");
    expect(readFileSync(store.filePath, "utf8")).toBe(before);
  });

  it("fails closed without deleting another writer's lock", () => {
    const directory = mkdtempSync(join(tmpdir(), "phase2c-shadow-"));
    directories.push(directory);
    const store = createDurableShadowStore({ directory, retentionDays: 90 });
    const lockPath = `${store.filePath}.lock`;
    writeFileSync(lockPath, "other-writer\n", { encoding: "utf8", mode: 0o600 });

    expect(() => store.append(record("run-locked", "2026-09-18T19:00:00.000Z"))).toThrow("locked");
    expect(readFileSync(lockPath, "utf8")).toBe("other-writer\n");
  });

  it("fails closed on malformed or partial existing JSONL", () => {
    const directory = mkdtempSync(join(tmpdir(), "phase2c-shadow-"));
    directories.push(directory);
    const store = createDurableShadowStore({ directory, retentionDays: 90 });
    writeFileSync(store.filePath, '{"runId":"partial"', { encoding: "utf8", mode: 0o600 });

    expect(() => store.append(record("run-2", "2026-09-18T19:00:00.000Z"))).toThrow("malformed");
    expect(readFileSync(store.filePath, "utf8")).toBe('{"runId":"partial"');
  });

  it("tightens an existing file and rejects duplicate records already on disk", () => {
    const directory = mkdtempSync(join(tmpdir(), "phase2c-shadow-"));
    directories.push(directory);
    const first = record("run-existing", "2026-09-18T19:00:00.000Z");
    const filePath = join(directory, "records.jsonl");
    writeFileSync(filePath, `${JSON.stringify(first)}\n${JSON.stringify(first)}\n`, {
      encoding: "utf8",
      mode: 0o644,
    });
    chmodSync(filePath, 0o644);
    const store = createDurableShadowStore({ directory, retentionDays: 90 });

    expect(statSync(store.filePath).mode & 0o777).toBe(0o600);
    expect(() => store.list()).toThrow("malformed");
  });

  it("prunes records older than the explicit retention window atomically", () => {
    const directory = mkdtempSync(join(tmpdir(), "phase2c-shadow-"));
    directories.push(directory);
    const store = createDurableShadowStore({ directory, retentionDays: 30 });
    store.append(record("run-old", "2026-08-01T19:00:00.000Z"));
    store.append(record("run-new", "2026-09-10T19:00:00.000Z"));

    expect(store.pruneExpired(new Date("2026-09-20T19:00:00.000Z"))).toBe(1);
    expect(store.list().map((item) => item.runId)).toEqual(["run-new"]);
  });
});
