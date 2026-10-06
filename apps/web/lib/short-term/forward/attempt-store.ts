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
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, join, relative } from "node:path";
import { assertForwardExperimentAttempt, type ForwardExperimentAttempt } from "./attempt";

const FILE_NAME = "attempts.jsonl";

export interface ForwardAttemptStore {
  directory: string;
  filePath: string;
  append(record: ForwardExperimentAttempt): void;
  list(): ForwardExperimentAttempt[];
  pruneExpired(now?: Date): number;
}

function lockPath(filePath: string): string {
  return `${filePath}.lock`;
}

function outside(path: string, root: string): boolean {
  const rel = relative(root, path);
  return rel === "" || rel === ".." || rel.startsWith("..") || isAbsolute(rel);
}

function ensureSecure(directory: string, filePath: string): void {
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  chmodSync(directory, 0o700);
  if (!existsSync(filePath)) writeFileSync(filePath, "", { mode: 0o600 });
  chmodSync(filePath, 0o600);
}

function writeDurably(filePath: string, contents: string): void {
  writeFileSync(filePath, contents, { mode: 0o600 });
  const descriptor = openSync(filePath, "r");
  try {
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
}

function parse(filePath: string): ForwardExperimentAttempt[] {
  if (!existsSync(filePath)) return [];
  const contents = readFileSync(filePath, "utf8");
  if (!contents) return [];
  return contents
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      try {
        const value = JSON.parse(line) as ForwardExperimentAttempt;
        assertForwardExperimentAttempt(value);
        return value;
      } catch {
        throw new Error("Malformed or partial forward attempt JSONL");
      }
    });
}

function withLock<T>(filePath: string, operation: () => T): T {
  const lock = lockPath(filePath);
  try {
    writeFileSync(lock, `${process.pid}\n`, { mode: 0o600, flag: "wx" });
  } catch {
    throw new Error("Forward attempt store is locked");
  }
  try {
    return operation();
  } finally {
    try {
      unlinkSync(lock);
    } catch {
      /* already cleaned */
    }
  }
}

export function createForwardAttemptStore(options: {
  directory?: string;
  repositoryRoot?: string;
  retentionDays: number;
}): ForwardAttemptStore {
  if (!Number.isInteger(options.retentionDays) || options.retentionDays < 1)
    throw new Error("Retention days must be positive");
  const repositoryRoot = options.repositoryRoot ?? process.cwd();
  const directory =
    options.directory ??
    join(homedir(), ".local", "share", "market-war-room", "jev-shadow", "forward");
  const filePath = join(directory, FILE_NAME);
  if (!outside(directory, repositoryRoot))
    throw new Error("Forward attempt storage must be outside the repository");
  ensureSecure(directory, filePath);
  return {
    directory,
    filePath,
    append(record) {
      assertForwardExperimentAttempt(record);
      withLock(filePath, () => {
        const records = parse(filePath);
        if (records.some((item) => item.eventId === record.eventId))
          throw new Error("Duplicate forward attempt event");
        const attemptRecords = records.filter((item) => item.attemptId === record.attemptId);
        const previousSequence = attemptRecords.at(-1)?.sequence ?? 0;
        if (record.sequence !== previousSequence + 1)
          throw new Error("Forward attempt lifecycle sequence is out of order");
        const temporary = `${filePath}.${process.pid}.tmp`;
        writeDurably(temporary, `${readFileSync(filePath, "utf8")}${JSON.stringify(record)}\n`);
        chmodSync(temporary, 0o600);
        renameSync(temporary, filePath);
        chmodSync(filePath, 0o600);
      });
    },
    list() {
      return parse(filePath);
    },
    pruneExpired(now: Date = new Date()) {
      return withLock(filePath, () => {
        const cutoff = now.getTime() - options.retentionDays * 24 * 60 * 60 * 1000;
        const records = parse(filePath);
        const retained = records.filter((record) => Date.parse(record.requestedAt) >= cutoff);
        const removed = records.length - retained.length;
        const temporary = `${filePath}.${process.pid}.tmp`;
        writeDurably(
          temporary,
          retained.map((record) => JSON.stringify(record)).join("\n") +
            (retained.length ? "\n" : ""),
        );
        chmodSync(temporary, 0o600);
        renameSync(temporary, filePath);
        chmodSync(filePath, 0o600);
        return removed;
      });
    },
  };
}

export function defaultForwardAttemptStore(): ForwardAttemptStore {
  return createForwardAttemptStore({ retentionDays: 90 });
}
