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
import type { ForwardDirectionPredictionRecord } from "./types";
import { FORWARD_OUTCOME_SCHEMA_VERSION, type ForwardOutcomeRecord } from "./outcome";

const FILE_NAME = "outcomes.jsonl";

export interface ForwardOutcomeStore {
  directory: string;
  filePath: string;
  append(record: ForwardOutcomeRecord, prediction: ForwardDirectionPredictionRecord): void;
  list(): ForwardOutcomeRecord[];
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

function parse(filePath: string): ForwardOutcomeRecord[] {
  if (!existsSync(filePath)) return [];
  const contents = readFileSync(filePath, "utf8");
  if (!contents) return [];
  return contents
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      try {
        const value = JSON.parse(line) as ForwardOutcomeRecord;
        if (
          !value ||
          value.schemaVersion !== FORWARD_OUTCOME_SCHEMA_VERSION ||
          typeof value.predictionId !== "string" ||
          typeof value.originalDecisionRunId !== "string" ||
          typeof value.ticker !== "string" ||
          typeof value.stateFingerprint !== "string" ||
          typeof value.sourceFingerprint !== "string" ||
          typeof value.observedPrice !== "number" ||
          typeof value.returnPct !== "number" ||
          !["UP", "FLAT", "DOWN"].includes(value.label)
        )
          throw new Error("required fields");
        return value;
      } catch {
        throw new Error("Malformed or partial forward outcome JSONL");
      }
    });
}

function withLock<T>(filePath: string, operation: () => T): T {
  const path = lockPath(filePath);
  try {
    writeFileSync(path, `${process.pid}\n`, { mode: 0o600, flag: "wx" });
  } catch {
    throw new Error("Forward outcome store is locked");
  }
  try {
    return operation();
  } finally {
    try {
      unlinkSync(path);
    } catch {
      /* already cleaned */
    }
  }
}

function assertLinked(record: ForwardOutcomeRecord, prediction: ForwardDirectionPredictionRecord) {
  if (
    record.predictionId !== prediction.predictionId ||
    record.originalDecisionRunId !== prediction.originalDecisionRunId ||
    record.ticker !== prediction.ticker ||
    record.stateFingerprint !== prediction.stateFingerprint ||
    record.targetSessionDate !== prediction.targetSessionDate ||
    record.targetCloseAt !== prediction.targetCloseAt ||
    record.predictionOutputFingerprint !== prediction.outputFingerprint
  )
    throw new Error("Forward outcome does not match frozen prediction");
}

export function createForwardOutcomeStore(options: {
  directory?: string;
  repositoryRoot?: string;
}): ForwardOutcomeStore {
  const repositoryRoot = options.repositoryRoot ?? process.cwd();
  const directory =
    options.directory ??
    join(homedir(), ".local", "share", "market-war-room", "jev-shadow", "forward");
  const filePath = join(directory, FILE_NAME);
  if (!outside(directory, repositoryRoot))
    throw new Error("Forward outcome storage must be outside the repository");
  ensureSecure(directory, filePath);
  return {
    directory,
    filePath,
    append(record, prediction) {
      assertLinked(record, prediction);
      withLock(filePath, () => {
        const records = parse(filePath);
        if (
          records.some(
            (existing) =>
              existing.predictionId === record.predictionId ||
              existing.originalDecisionRunId === record.originalDecisionRunId,
          )
        )
          throw new Error("Duplicate forward outcome");
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
  };
}
