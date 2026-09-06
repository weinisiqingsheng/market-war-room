import { describe, expect, it } from "vitest";
import {
  dominantSessionDate,
  resolveEffectiveTime,
  snapshotPriceTimestamp,
} from "@/lib/anomalies/effective-time";

const SATURDAY_EVENING = Date.parse("2026-09-05T20:47:35-04:00"); // real validation bug scenario
const SUNDAY = Date.parse("2026-09-06T11:15:00-04:00");
const HOLIDAY_MONDAY = Date.parse("2026-09-07T10:00:00-04:00");

describe("anomaly effective timestamp (generated vs price time)", () => {
  it("A/B — Saturday/Sunday request maps to Friday 4:00 PM ET when prices are Friday's", () => {
    for (const generatedAtMs of [SATURDAY_EVENING, SUNDAY]) {
      const result = resolveEffectiveTime({
        isOpen: false,
        sessionKeys: ["2026-09-04", "2026-09-04", "2026-09-04"],
        providerTimestamps: ["2026-09-04T20:00:00.000Z"],
        generatedAtMs,
      });
      expect(result.sessionDate).toBe("2026-09-04");
      expect(result.effectiveAsOf).toBe("2026-09-04T20:00:00.000Z");
      expect(result.generatedAt).not.toBe(result.effectiveAsOf);
    }
  });

  it("C — market-holiday Monday with Friday prices keeps Friday close as effectiveAsOf", () => {
    const result = resolveEffectiveTime({
      isOpen: false,
      sessionKeys: ["2026-09-04"],
      providerTimestamps: [],
      generatedAtMs: HOLIDAY_MONDAY,
    });
    expect(result.effectiveAsOf).toBe("2026-09-04T20:00:00.000Z");
  });

  it("open market — uses the delayed-SIP provider timestamp, never the generated clock", () => {
    const generatedAtMs = Date.parse("2026-09-04T16:02:00-04:00");
    const result = resolveEffectiveTime({
      isOpen: true,
      sessionKeys: ["2026-09-04"],
      providerTimestamps: ["2026-09-04T15:47:11-04:00"],
      generatedAtMs,
    });
    expect(result.effectiveAsOf).toBe("2026-09-04T15:47:11-04:00");
  });

  it("open market — never uses future timestamps: falls back to delayed-SIP time", () => {
    const generatedAtMs = Date.parse("2026-09-04T15:00:00-04:00");
    const result = resolveEffectiveTime({
      isOpen: true,
      sessionKeys: ["2026-09-04"],
      providerTimestamps: ["2026-09-04T20:00:00.000Z"], // future vs generation
      generatedAtMs,
    });
    expect(result.effectiveAsOf).toBe("2026-09-04T18:45:00.000Z"); // generated (19:00Z) − 15 min delayed
  });

  it("dominant session comes from actual scored bars", () => {
    expect(dominantSessionDate(["2026-09-04", "2026-09-04", "2026-09-03"])).toBe("2026-09-04");
    expect(dominantSessionDate([null, undefined, ""])).toBeNull();
  });

  it("closed market prefers the daily-bar timestamp for provider time", () => {
    expect(
      snapshotPriceTimestamp({ latestTrade: { t: "2026-09-04T23:10:00Z" }, dailyBar: { t: "2026-09-04T20:00:00Z" } }, false),
    ).toBe("2026-09-04T20:00:00Z");
    expect(
      snapshotPriceTimestamp({ latestTrade: { t: "2026-09-04T15:47:00Z" } }, true),
    ).toBe("2026-09-04T15:47:00Z");
  });
});
