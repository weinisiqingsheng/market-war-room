import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repositoryRoot = resolve(process.cwd(), "../..");
const runner = resolve(repositoryRoot, "scripts/run-short-term-prospective-pilot.mjs");

describe("Phase 2D.2 fixture-only prospective runner", () => {
  it("executes the standalone fixture script with the project aliases and no real provider requests", () => {
    const result = spawnSync(process.execPath, [runner, "--dry-run"], {
      cwd: repositoryRoot,
      encoding: "utf8",
      env: { ...process.env },
    });

    expect(result.status).toBe(0);
    const report = JSON.parse(result.stdout) as {
      realProviderRequests: number;
      results: unknown[];
    };
    expect(report.realProviderRequests).toBe(0);
    expect(report.results).toHaveLength(3);
  });

  it("rejects real mode before loading the TypeScript pilot module", () => {
    const result = spawnSync(process.execPath, [runner, "--real"], {
      cwd: repositoryRoot,
      encoding: "utf8",
      env: { ...process.env },
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("fixture-only");
    expect(result.stdout).toBe("");
  });
});
