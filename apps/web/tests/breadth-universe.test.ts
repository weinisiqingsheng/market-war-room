import { describe, expect, it } from "vitest";
import { sp500Universe, SP500_UNIVERSE_VERSION } from "@/lib/breadth/universe/sp500";
import { alpacaToCanonical, canonicalToAlpaca, getUniverseTickers } from "@/lib/breadth/symbols";

describe("S&P 500 universe", () => {
  it("is versioned with a documented asOf and the actual canonical count", () => {
    expect(sp500Universe.name).toBe("S&P 500");
    expect(sp500Universe.version).toBe(SP500_UNIVERSE_VERSION);
    expect(sp500Universe.asOf).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(sp500Universe.count).toBe(sp500Universe.members.length);
    // The index has 503 symbols (multiple share classes) — preserve it as-is.
    expect(sp500Universe.count).toBeGreaterThanOrEqual(500);
    expect(sp500Universe.count).toBeLessThanOrEqual(510);
  });

  it("contains no duplicate tickers", () => {
    const tickers = sp500Universe.members.map((member) => member.ticker);
    expect(new Set(tickers).size).toBe(tickers.length);
  });

  it("keeps canonical share classes like BRK.B", () => {
    const brk = sp500Universe.members.find((member) => member.ticker === "BRK.B");
    expect(brk).toBeDefined();
    expect(getUniverseTickers()).toContain("BRK.B");
  });
});

describe("provider symbol mapping", () => {
  it("maps canonical share-class tickers to their Alpaca form and back", () => {
    expect(canonicalToAlpaca("BRK.B")).toBe("BRK.B");
    expect(alpacaToCanonical("BRK.B")).toBe("BRK.B");
    // Dashed aliases are handled centrally, never in scattered provider code.
    expect(canonicalToAlpaca("BRK-B")).toBe("BRK.B");
    expect(alpacaToCanonical("BRK-B")).toBe("BRK.B");
    expect(alpacaToCanonical("BRK.B")).toBe("BRK.B");
  });

  it("is the identity for ordinary tickers", () => {
    expect(canonicalToAlpaca("AAPL")).toBe("AAPL");
    expect(alpacaToCanonical("msft")).toBe("MSFT");
  });
});
