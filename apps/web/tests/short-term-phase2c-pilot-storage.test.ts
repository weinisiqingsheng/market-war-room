import { mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createRealPilotShadowStore } from "@/lib/short-term/pilot/storage";

describe("Phase 2C.1 private pilot storage integration", () => {
  const directories: string[] = [];

  afterEach(() => {
    for (const directory of directories.splice(0))
      rmSync(directory, { recursive: true, force: true });
  });

  it("constructs the private pilot store with the documented retention policy", () => {
    const directory = mkdtempSync(join(tmpdir(), "phase2c-pilot-"));
    directories.push(directory);
    const store = createRealPilotShadowStore(directory);

    expect(store.retentionPolicy.days).toBe(90);
    expect(store.filePath).toBe(join(directory, "records.jsonl"));
    expect(statSync(directory).mode & 0o777).toBe(0o700);
  });
});
