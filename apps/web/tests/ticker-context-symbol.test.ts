import { describe, expect, it } from "vitest";
import {
  classifyProviderAsset,
  normalizeTickerSymbol,
  toProviderSymbol,
} from "@/lib/ticker-context/symbol";

describe("ticker symbol validation (V1.2A)", () => {
  it("normalizes casing and surrounding whitespace", () => {
    expect(normalizeTickerSymbol("  nvda ")).toBe("NVDA");
    expect(normalizeTickerSymbol("Tsla")).toBe("TSLA");
    expect(normalizeTickerSymbol("brk.b")).toBe("BRK.B");
  });

  it("rejects malformed input instead of guessing", () => {
    for (const bad of ["", " ", "1NVDA", "NV DA", "NVDA!", "TOOLONGSYMBOL", 42, null, undefined]) {
      expect(normalizeTickerSymbol(bad)).toBeNull();
    }
    // Single-letter US tickers are valid symbols.
    expect(normalizeTickerSymbol("f")).toBe("F");
  });

  it("maps documented share-class aliases to the provider form", () => {
    expect(toProviderSymbol("BRK-B")).toBe("BRK.B");
    expect(toProviderSymbol("bf-b")).toBe("BF.B");
    expect(toProviderSymbol("NVDA")).toBe("NVDA");
  });

  it("accepts an active, tradable US equity", () => {
    const result = classifyProviderAsset("NVDA", {
      symbol: "NVDA",
      name: "NVIDIA Corporation",
      exchange: "NASDAQ",
      class: "us_equity",
      status: "active",
      tradable: true,
    });
    expect(result).toEqual({
      kind: "supported",
      identity: {
        symbol: "NVDA",
        name: "NVIDIA Corporation",
        exchange: "NASDAQ",
        assetClass: "us_equity",
        status: "active",
        tradable: true,
      },
    });
  });

  it("rejects non-equity and inactive securities explicitly", () => {
    expect(
      classifyProviderAsset("BTCUSD", {
        symbol: "BTCUSD",
        name: "Bitcoin",
        class: "crypto",
        status: "active",
        tradable: true,
      }),
    ).toMatchObject({ kind: "unsupported", reason: "unsupported_security_type" });

    expect(
      classifyProviderAsset("DEAD", {
        symbol: "DEAD",
        name: "Old Corp",
        class: "us_equity",
        status: "inactive",
        tradable: true,
      }),
    ).toMatchObject({ kind: "unsupported", reason: "unsupported_security_type" });

    expect(
      classifyProviderAsset("OTC1", {
        symbol: "OTC1",
        name: "Thin Co",
        class: "us_equity",
        status: "active",
        tradable: false,
      }),
    ).toMatchObject({ kind: "unsupported", reason: "unsupported_security_type" });
  });

  it("treats a directory entry without a usable name as provider failure, never as a supported symbol", () => {
    expect(
      classifyProviderAsset("NVDA", {
        symbol: "NVDA",
        class: "us_equity",
        status: "active",
        tradable: true,
      }),
    ).toMatchObject({
      kind: "unsupported",
      reason: "provider_unavailable",
    });
  });
});
