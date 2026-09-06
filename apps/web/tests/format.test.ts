import { describe, expect, it } from "vitest";
import { formatPrice, formatSignedPct, formatVolume } from "@/lib/format";

describe("format helpers", () => {
  it("formats signed percentages", () => {
    expect(formatSignedPct(2.5)).toBe("+2.50%");
    expect(formatSignedPct(-0.24)).toBe("-0.24%");
    expect(formatSignedPct(0)).toBe("0.00%");
  });

  it("formats prices with thousands separators", () => {
    expect(formatPrice(2438.1)).toBe("2,438.10");
    expect(formatPrice(563.24)).toBe("563.24");
  });

  it("formats relative volume multipliers", () => {
    expect(formatVolume(9.5)).toBe("9.5x");
    expect(formatVolume(1)).toBe("1.0x");
  });
});
