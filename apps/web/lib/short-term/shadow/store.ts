import "server-only";
import { appendFileSync, mkdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname } from "node:path";
import type { ShortTermShadowRecord } from "./types";

export interface ShortTermShadowStore {
  append(record: ShortTermShadowRecord): void;
  list(): ShortTermShadowRecord[];
  clear(): void;
}

export function createInMemoryShadowStore(): ShortTermShadowStore {
  const records: ShortTermShadowRecord[] = [];
  return {
    append(record) {
      records.push(record);
    },
    list() {
      return records.map((record) => structuredClone(record));
    },
    clear() {
      records.length = 0;
    },
  };
}

export function createLocalJsonlShadowStore(filePath: string): ShortTermShadowStore {
  const temporaryRoots = ["/tmp/", "/private/tmp/", `${tmpdir().replace(/\/$/, "")}/`];
  if (!temporaryRoots.some((root) => filePath.startsWith(root))) {
    throw new Error("Shadow records must be stored in a local temporary directory.");
  }
  return {
    append(record) {
      mkdirSync(dirname(filePath), { recursive: true });
      appendFileSync(filePath, `${JSON.stringify(record)}\n`, { encoding: "utf8", mode: 0o600 });
    },
    list() {
      try {
        return readFileSync(filePath, "utf8")
          .split("\n")
          .filter(Boolean)
          .map((line) => JSON.parse(line) as ShortTermShadowRecord);
      } catch (error) {
        if (error instanceof Error && "code" in error && error.code === "ENOENT") return [];
        throw error;
      }
    },
    clear() {
      throw new Error("Shadow stores are append-only; remove temporary files outside the adapter.");
    },
  };
}
