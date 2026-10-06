import { describe, expect, it } from "vitest";
import {
  NYSE_REGULAR_SESSION_CALENDAR,
  NYSE_REGULAR_SESSION_CALENDAR_VERSION,
} from "@/lib/short-term/prospective/calendar";

describe("Phase 2D.2 NYSE regular-session calendar", () => {
  it("uses the versioned NYSE schedule rather than a weekday-only approximation", () => {
    expect(NYSE_REGULAR_SESSION_CALENDAR_VERSION).toBe("nyse-core-session-2026-2028-v1");
    expect(NYSE_REGULAR_SESSION_CALENDAR.sessionFor("2026-01-01")).toBeNull();
    expect(NYSE_REGULAR_SESSION_CALENDAR.sessionFor("2026-07-03")).toBeNull();
    expect(NYSE_REGULAR_SESSION_CALENDAR.sessionFor("2026-11-26")).toBeNull();
    expect(NYSE_REGULAR_SESSION_CALENDAR.sessionFor("2026-09-19")).toBeNull();
    expect(NYSE_REGULAR_SESSION_CALENDAR.sessionFor("2029-01-02")).toBeNull();
  });

  it("uses official early closes and skips an observed holiday when finding the next session", () => {
    expect(NYSE_REGULAR_SESSION_CALENDAR.sessionFor("2026-11-27")).toMatchObject({
      earlyClose: true,
      openAt: "2026-11-27T14:30:00.000Z",
      closeAt: "2026-11-27T18:00:00.000Z",
    });
    expect(NYSE_REGULAR_SESSION_CALENDAR.sessionFor("2026-12-24")).toMatchObject({
      earlyClose: true,
      closeAt: "2026-12-24T18:00:00.000Z",
    });
    expect(NYSE_REGULAR_SESSION_CALENDAR.nextSessionAfter("2026-11-25")).toMatchObject({
      sessionDate: "2026-11-27",
    });
  });

  it("converts regular-session boundaries across daylight-saving time", () => {
    expect(NYSE_REGULAR_SESSION_CALENDAR.sessionFor("2026-03-06")).toMatchObject({
      openAt: "2026-03-06T14:30:00.000Z",
      closeAt: "2026-03-06T21:00:00.000Z",
    });
    expect(NYSE_REGULAR_SESSION_CALENDAR.sessionFor("2026-03-09")).toMatchObject({
      openAt: "2026-03-09T13:30:00.000Z",
      closeAt: "2026-03-09T20:00:00.000Z",
    });
  });
});
