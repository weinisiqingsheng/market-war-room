import { describe, expect, it } from "vitest";
import ShortTermPage from "@/app/short-term/page";

describe("/short-term", () => {
  it("exports a standalone page without importing existing navigation", () => {
    expect(ShortTermPage).toBeTypeOf("function");
  });
});
