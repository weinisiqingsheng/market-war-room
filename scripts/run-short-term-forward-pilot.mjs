import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const args = process.argv.slice(2);
if (args.length !== 1 || args[0] !== "--dry-run") {
  console.error("Phase 2E runner is fixture-only; expected exactly --dry-run.");
  process.exitCode = 1;
} else {
  const scriptsDirectory = dirname(fileURLToPath(import.meta.url));
  const child = spawnSync(
    process.execPath,
    [
      "--experimental-strip-types",
      "--import",
      resolve(scriptsDirectory, "short-term-node-alias-hooks.mjs"),
      resolve(scriptsDirectory, "short-term-forward-pilot.ts"),
      "--dry-run",
    ],
    { cwd: resolve(scriptsDirectory, ".."), env: process.env, stdio: "inherit" },
  );
  if (child.error) throw child.error;
  process.exitCode = child.status ?? 1;
}
