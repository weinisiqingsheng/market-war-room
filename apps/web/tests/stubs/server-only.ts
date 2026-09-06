/**
 * Vitest stub for the `server-only` package.
 *
 * `server-only` throws when imported outside a React Server environment; in
 * tests we replace it with a no-op so server-boundary modules can be imported.
 * Next.js still enforces the real guard during application builds.
 */
export {};
