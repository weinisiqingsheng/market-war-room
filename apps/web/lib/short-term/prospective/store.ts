import "server-only";
import {
  chmodSync,
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeSync,
} from "node:fs";
import { randomUUID } from "node:crypto";
import { homedir } from "node:os";
import { isAbsolute, join, relative, sep } from "node:path";
import type { FrozenProspectiveDecision, ProspectiveOutcomeRecord } from "./types";

export const PROSPECTIVE_RETENTION_DAYS = 90;

export interface ProspectiveStore {
  readonly decisionFilePath: string;
  readonly outcomeFilePath: string;
  readonly retentionPolicy: { days: number };
  appendDecision(record: FrozenProspectiveDecision): void;
  appendOutcome(record: ProspectiveOutcomeRecord): void;
  listDecisions(): FrozenProspectiveDecision[];
  listOutcomes(): ProspectiveOutcomeRecord[];
  pruneExpired(now?: Date): { decisions: number; outcomes: number };
}

function defaultDirectory(): string {
  return join(homedir(), ".local", "share", "market-war-room", "jev-shadow", "prospective");
}

function assertOutsideRepository(directory: string, repositoryRoot: string): void {
  const path = relative(repositoryRoot, directory);
  if (path === "" || (path !== ".." && !path.startsWith(`..${sep}`)))
    throw new Error("Prospective storage must be outside the repository.");
}

function parseJsonl<T extends { runId: string }>(filePath: string, kind: string): T[] {
  if (!existsSync(filePath)) return [];
  const contents = readFileSync(filePath, "utf8");
  if (contents.trim() === "") return [];
  const records: T[] = [];
  const ids = new Set<string>();
  for (const [index, line] of contents.split("\n").filter(Boolean).entries()) {
    try {
      const value: unknown = JSON.parse(line);
      if (!value || typeof value !== "object") throw new Error("not object");
      const record = value as T;
      if (typeof record.runId !== "string" || !record.runId) throw new Error("missing runId");
      if (typeof (record as { ticker?: unknown }).ticker !== "string")
        throw new Error("missing ticker");
      const timestampValue =
        kind === "decision"
          ? (record as { requestedAt?: unknown }).requestedAt
          : (record as { decisionEffectiveAsOf?: unknown }).decisionEffectiveAsOf;
      if (typeof timestampValue !== "string" || !Number.isFinite(Date.parse(timestampValue)))
        throw new Error("invalid timestamp");
      if (ids.has(record.runId) && kind === "decision") throw new Error("duplicate runId");
      ids.add(record.runId);
      records.push(record);
    } catch {
      throw new Error(`Prospective ${kind} JSONL is malformed or partial at record ${index + 1}.`);
    }
  }
  return records;
}

function writeAtomically(filePath: string, records: unknown[]): void {
  const tempPath = `${filePath}.tmp-${randomUUID()}`;
  const payload = records.length
    ? `${records.map((record) => JSON.stringify(record)).join("\n")}\n`
    : "";
  let descriptor: number | null = null;
  try {
    descriptor = openSync(tempPath, "wx", 0o600);
    writeSync(descriptor, payload, undefined, "utf8");
    fsyncSync(descriptor);
    closeSync(descriptor);
    descriptor = null;
    chmodSync(tempPath, 0o600);
    renameSync(tempPath, filePath);
    chmodSync(filePath, 0o600);
  } catch (error) {
    if (descriptor !== null) closeSync(descriptor);
    if (existsSync(tempPath)) unlinkSync(tempPath);
    throw error;
  }
}

function withLock<T>(filePath: string, operation: () => T): T {
  const lockPath = `${filePath}.lock`;
  let descriptor: number | null = null;
  try {
    descriptor = openSync(lockPath, "wx", 0o600);
    const pid = Buffer.from(`${process.pid}\n`, "utf8");
    writeSync(descriptor, pid, 0, pid.length, 0);
    fsyncSync(descriptor);
    return operation();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST")
      throw new Error("Prospective storage is locked by another writer.");
    throw error;
  } finally {
    if (descriptor !== null) closeSync(descriptor);
    if (descriptor !== null && existsSync(lockPath)) unlinkSync(lockPath);
  }
}

export function createProspectiveStore(options: {
  directory?: string;
  retentionDays: number;
  now?: () => Date;
  repositoryRoot?: string;
}): ProspectiveStore {
  if (!Number.isInteger(options.retentionDays) || options.retentionDays <= 0)
    throw new Error("Prospective retentionDays must be a positive integer.");
  const directory = options.directory ?? defaultDirectory();
  if (!isAbsolute(directory)) throw new Error("Prospective storage directory must be absolute.");
  assertOutsideRepository(directory, options.repositoryRoot ?? process.cwd());
  const decisionFilePath = join(directory, "decisions.jsonl");
  const outcomeFilePath = join(directory, "outcomes.jsonl");
  const now = options.now ?? (() => new Date());

  mkdirSync(directory, { recursive: true, mode: 0o700 });
  chmodSync(directory, 0o700);
  for (const filePath of [decisionFilePath, outcomeFilePath]) {
    if (existsSync(filePath)) chmodSync(filePath, 0o600);
  }

  return {
    decisionFilePath,
    outcomeFilePath,
    retentionPolicy: { days: options.retentionDays },
    appendDecision(record) {
      withLock(decisionFilePath, () => {
        const records = parseJsonl<FrozenProspectiveDecision>(decisionFilePath, "decision");
        if (records.some((existing) => existing.runId === record.runId))
          throw new Error(`Duplicate prospective decision runId: ${record.runId}`);
        writeAtomically(decisionFilePath, [...records, structuredClone(record)]);
      });
    },
    appendOutcome(record) {
      withLock(outcomeFilePath, () => {
        const decisions = parseJsonl<FrozenProspectiveDecision>(decisionFilePath, "decision");
        const matching = decisions.find(
          (decision) =>
            decision.runId === record.runId &&
            decision.ticker === record.ticker &&
            decision.stateFingerprint === record.stateFingerprint,
        );
        if (!matching) throw new Error("Outcome requires a matching frozen decision.");
        const records = parseJsonl<ProspectiveOutcomeRecord>(outcomeFilePath, "outcome");
        if (
          records.some(
            (existing) => existing.runId === record.runId && existing.horizon === record.horizon,
          )
        )
          throw new Error(`Duplicate prospective outcome: ${record.runId}/${record.horizon}`);
        writeAtomically(outcomeFilePath, [...records, structuredClone(record)]);
      });
    },
    listDecisions() {
      return structuredClone(parseJsonl<FrozenProspectiveDecision>(decisionFilePath, "decision"));
    },
    listOutcomes() {
      return structuredClone(parseJsonl<ProspectiveOutcomeRecord>(outcomeFilePath, "outcome"));
    },
    pruneExpired(referenceDate = now()) {
      if (!Number.isFinite(referenceDate.getTime()))
        throw new Error("Prospective retention date is invalid.");
      const cutoff = referenceDate.getTime() - options.retentionDays * 86_400_000;
      return withLock(decisionFilePath, () =>
        withLock(outcomeFilePath, () => {
          const decisions = parseJsonl<FrozenProspectiveDecision>(decisionFilePath, "decision");
          const outcomes = parseJsonl<ProspectiveOutcomeRecord>(outcomeFilePath, "outcome");
          const keptDecisions = decisions.filter(
            (record) => Date.parse(record.requestedAt) >= cutoff,
          );
          const keptOutcomes = outcomes.filter(
            (record) => Date.parse(record.decisionEffectiveAsOf) >= cutoff,
          );
          if (keptDecisions.length !== decisions.length)
            writeAtomically(decisionFilePath, keptDecisions);
          if (keptOutcomes.length !== outcomes.length)
            writeAtomically(outcomeFilePath, keptOutcomes);
          return {
            decisions: decisions.length - keptDecisions.length,
            outcomes: outcomes.length - keptOutcomes.length,
          };
        }),
      );
    },
  };
}
