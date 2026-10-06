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
import { homedir } from "node:os";
import { isAbsolute, join, relative, sep } from "node:path";
import { randomUUID } from "node:crypto";
import type { ShortTermShadowRecord } from "../shadow/types";

export const DEFAULT_SHADOW_RETENTION_DAYS = 90;

export interface DurableShadowStoreOptions {
  directory?: string;
  fileName?: string;
  retentionDays: number;
  now?: () => Date;
  repositoryRoot?: string;
}

export interface DurableShadowStore {
  readonly filePath: string;
  readonly retentionPolicy: { days: number };
  append(record: ShortTermShadowRecord): void;
  list(): ShortTermShadowRecord[];
  pruneExpired(now?: Date): number;
  clear(): never;
}

function defaultDirectory(): string {
  return join(homedir(), ".local", "share", "market-war-room", "jev-shadow");
}

function assertOutsideRepository(directory: string, repositoryRoot: string): void {
  const relativePath = relative(repositoryRoot, directory);
  const insideRepository =
    relativePath === "" || (relativePath !== ".." && !relativePath.startsWith(`..${sep}`));
  if (insideRepository) throw new Error("Durable Shadow storage must be outside the repository.");
}

function assertOptions(options: DurableShadowStoreOptions): void {
  if (!Number.isInteger(options.retentionDays) || options.retentionDays <= 0)
    throw new Error("Shadow retentionDays must be a positive integer.");
  if (options.fileName && !/^[A-Za-z0-9._-]+\.jsonl$/.test(options.fileName))
    throw new Error("Shadow fileName must be a simple .jsonl filename.");
}

function parseRecords(contents: string): ShortTermShadowRecord[] {
  if (contents.trim() === "") return [];
  const records: ShortTermShadowRecord[] = [];
  const runIds = new Set<string>();
  for (const [index, line] of contents.split("\n").filter(Boolean).entries()) {
    try {
      const value: unknown = JSON.parse(line);
      if (!value || typeof value !== "object") throw new Error("record is not an object");
      const record = value as Partial<ShortTermShadowRecord>;
      if (typeof record.runId !== "string" || typeof record.requestedAt !== "string")
        throw new Error("record identity is incomplete");
      if (runIds.has(record.runId)) throw new Error("duplicate runId");
      runIds.add(record.runId);
      records.push(value as ShortTermShadowRecord);
    } catch {
      throw new Error(`Shadow JSONL is malformed or partial at record ${index + 1}.`);
    }
  }
  return records;
}

function readRecords(filePath: string): ShortTermShadowRecord[] {
  if (!existsSync(filePath)) return [];
  chmodSync(filePath, 0o600);
  return parseRecords(readFileSync(filePath, "utf8"));
}

function writeAtomically(filePath: string, records: ShortTermShadowRecord[]): void {
  const temporaryPath = `${filePath}.tmp-${randomUUID()}`;
  const payload =
    records.length > 0 ? `${records.map((record) => JSON.stringify(record)).join("\n")}\n` : "";
  let descriptor: number | null = null;
  try {
    descriptor = openSync(temporaryPath, "wx", 0o600);
    writeSync(descriptor, payload, undefined, "utf8");
    fsyncSync(descriptor);
    closeSync(descriptor);
    descriptor = null;
    chmodSync(temporaryPath, 0o600);
    renameSync(temporaryPath, filePath);
    chmodSync(filePath, 0o600);
  } catch (error) {
    if (descriptor !== null) closeSync(descriptor);
    if (existsSync(temporaryPath)) unlinkSync(temporaryPath);
    throw error;
  }
}

function withExclusiveLock<T>(filePath: string, operation: () => T): T {
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
      throw new Error("Durable Shadow storage is locked by another writer.");
    throw error;
  } finally {
    if (descriptor !== null) closeSync(descriptor);
    if (descriptor !== null && existsSync(lockPath)) unlinkSync(lockPath);
  }
}

export function createDurableShadowStore(options: DurableShadowStoreOptions): DurableShadowStore {
  assertOptions(options);
  const directory = options.directory ?? defaultDirectory();
  const fileName = options.fileName ?? "records.jsonl";
  if (!isAbsolute(directory)) throw new Error("Durable Shadow directory must be absolute.");
  assertOutsideRepository(directory, options.repositoryRoot ?? process.cwd());
  const filePath = join(directory, fileName);
  const now = options.now ?? (() => new Date());

  mkdirSync(directory, { recursive: true, mode: 0o700 });
  chmodSync(directory, 0o700);
  if (existsSync(filePath)) chmodSync(filePath, 0o600);

  return {
    filePath,
    retentionPolicy: { days: options.retentionDays },
    append(record) {
      withExclusiveLock(filePath, () => {
        const records = readRecords(filePath);
        if (records.some((existing) => existing.runId === record.runId))
          throw new Error(`Duplicate Shadow runId: ${record.runId}`);
        writeAtomically(filePath, [...records, record]);
      });
    },
    list() {
      return structuredClone(readRecords(filePath));
    },
    pruneExpired(referenceDate = now()) {
      if (!Number.isFinite(referenceDate.getTime())) throw new Error("Retention date is invalid.");
      return withExclusiveLock(filePath, () => {
        const records = readRecords(filePath);
        const cutoff = referenceDate.getTime() - options.retentionDays * 24 * 60 * 60 * 1000;
        const kept = records.filter((record) => {
          const requestedAt = Date.parse(record.requestedAt);
          if (!Number.isFinite(requestedAt)) throw new Error("Shadow requestedAt is invalid.");
          return requestedAt >= cutoff;
        });
        if (kept.length !== records.length) writeAtomically(filePath, kept);
        return records.length - kept.length;
      });
    },
    clear() {
      throw new Error("Durable Shadow stores are append-only; use retention pruning.");
    },
  };
}
