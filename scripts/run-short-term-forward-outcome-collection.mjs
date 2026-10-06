import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const scriptsDirectory = dirname(fileURLToPath(import.meta.url));
const child = spawnSync(
  process.execPath,
  [
    "--experimental-strip-types",
    "--import",
    resolve(scriptsDirectory, "short-term-node-alias-hooks.mjs"),
    resolve(scriptsDirectory, "short-term-forward-outcome-collection.ts"),
  ],
  { cwd: resolve(scriptsDirectory, ".."), env: process.env, stdio: "inherit" },
);
if (child.error) throw child.error;
process.exitCode = child.status ?? 1;
