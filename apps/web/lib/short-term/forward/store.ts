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
import type { ForwardDirectionPredictionRecord } from "./types";

const FILE_NAME = "predictions.jsonl";
export interface ForwardPredictionStore {
  directory: string;
  filePath: string;
  append(record: ForwardDirectionPredictionRecord): void;
  list(): ForwardDirectionPredictionRecord[];
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
function writeDurably(path: string, content: string): void {
  writeFileSync(path, content, { mode: 0o600 });
  const descriptor = openSync(path, "r");
  try {
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
}
function parse(filePath: string): ForwardDirectionPredictionRecord[] {
  if (!existsSync(filePath)) return [];
  const text = readFileSync(filePath, "utf8");
  if (!text) return [];
  return text
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      try {
        const value = JSON.parse(line) as ForwardDirectionPredictionRecord;
        if (
          !value ||
          typeof value.predictionId !== "string" ||
          typeof value.createdAt !== "string" ||
          value.marketDataPolicyVersion !== "short-term-forward-market-data-policy-v1" ||
          typeof value.outputFingerprint !== "string" ||
          !value.baselines ||
          typeof value.baselines !== "object"
        )
          throw new Error("required fields");
        return value;
      } catch {
        throw new Error("Malformed or partial forward prediction JSONL");
      }
    });
}
function withLock<T>(filePath: string, fn: () => T): T {
  const lock = lockPath(filePath);
  try {
    writeFileSync(lock, `${process.pid}\n`, { mode: 0o600, flag: "wx" });
  } catch {
    throw new Error("Forward prediction store is locked");
  }
  try {
    return fn();
  } finally {
    try {
      unlinkSync(lock);
    } catch {
      /* already cleaned */
    }
  }
}

export function createForwardPredictionStore(options: {
  directory?: string;
  repositoryRoot?: string;
  retentionDays: number;
}): ForwardPredictionStore {
  if (!Number.isInteger(options.retentionDays) || options.retentionDays < 1)
    throw new Error("Retention days must be positive");
  const repositoryRoot = options.repositoryRoot ?? process.cwd();
  const directory =
    options.directory ??
    join(homedir(), ".local", "share", "market-war-room", "jev-shadow", "forward");
  const filePath = join(directory, FILE_NAME);
  if (!outside(directory, repositoryRoot))
    throw new Error("Forward prediction storage must be outside the repository");
  ensureSecure(directory, filePath);
  return {
    directory,
    filePath,
    append(record: ForwardDirectionPredictionRecord): void {
      withLock(filePath, () => {
        const records = parse(filePath);
        if (records.some((item) => item.predictionId === record.predictionId))
          throw new Error("Duplicate prediction");
        const line = `${JSON.stringify(record)}\n`;
        const temp = `${filePath}.${process.pid}.tmp`;
        writeDurably(temp, `${readFileSync(filePath, "utf8")}${line}`);
        chmodSync(temp, 0o600);
        renameSync(temp, filePath);
        chmodSync(filePath, 0o600);
      });
    },
    list(): ForwardDirectionPredictionRecord[] {
      return parse(filePath);
    },
    pruneExpired(now: Date = new Date()): number {
      return withLock(filePath, () => {
        const cutoff = now.getTime() - options.retentionDays * 24 * 60 * 60 * 1000;
        const records = parse(filePath);
        const retained = records.filter((record) => Date.parse(record.createdAt) >= cutoff);
        const removed = records.length - retained.length;
        const temp = `${filePath}.${process.pid}.tmp`;
        writeDurably(
          temp,
          retained.map((record) => JSON.stringify(record)).join("\n") +
            (retained.length ? "\n" : ""),
        );
        chmodSync(temp, 0o600);
        renameSync(temp, filePath);
        chmodSync(filePath, 0o600);
        return removed;
      });
    },
  };
}
