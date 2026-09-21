import { createHash } from "node:crypto";
import type { JSONValue } from "@/lib/ai-brief/types";
import type { ShortTermMarketState } from "./types";

function canonicalize(value: JSONValue): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(",")}}`;
}

export function canonicalizeMarketState(state: ShortTermMarketState): string {
  const stable: JSONValue = {
    ...state,
    facts: [...state.facts].sort((a, b) => a.id.localeCompare(b.id)),
  } as unknown as JSONValue;
  return canonicalize(stable);
}

export function fingerprintMarketState(state: ShortTermMarketState): string {
  return createHash("sha256").update(canonicalizeMarketState(state), "utf8").digest("hex");
}

export function fingerprintShortTermInput(input: JSONValue): string {
  return createHash("sha256").update(canonicalize(input), "utf8").digest("hex");
}
