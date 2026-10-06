import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";
import { registerHooks } from "node:module";

const scriptsDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptsDirectory, "..");
const webRoot = resolve(repositoryRoot, "apps/web");
const serverOnlyStub = pathToFileURL(
  resolve(scriptsDirectory, "short-term-server-only-stub.mjs"),
).href;
const extensions = ["", ".ts", ".tsx", ".mts", ".js", ".mjs"];

function sourceUrl(candidate) {
  for (const extension of extensions) {
    const resolved = `${candidate}${extension}`;
    if (existsSync(resolved)) return pathToFileURL(resolved).href;
  }
  return null;
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") return { url: serverOnlyStub, shortCircuit: true };
    if (specifier.startsWith("@/")) {
      const resolved = sourceUrl(resolve(webRoot, specifier.slice(2)));
      if (resolved) return { url: resolved, shortCircuit: true };
    }
    if (
      (specifier.startsWith("./") || specifier.startsWith("../")) &&
      context.parentURL?.startsWith(pathToFileURL(webRoot).href)
    ) {
      const resolved = sourceUrl(resolve(dirname(fileURLToPath(context.parentURL)), specifier));
      if (resolved) return { url: resolved, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});
