import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Vitest runs with `globals: false`, so RTL's automatic cleanup is not
// registered — do it explicitly to keep the DOM isolated between tests.
afterEach(() => {
  cleanup();
});
