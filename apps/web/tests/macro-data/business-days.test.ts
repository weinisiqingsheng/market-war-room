import { describe, expect, it } from "vitest";
import { countElapsedBusinessDays, isUsBusinessDay } from "@/lib/macro-data/business-days";

describe("isUsBusinessDay", () => {
  it("treats weekdays as business days", () => {
    expect(isUsBusinessDay(new Date("2026-08-31T12:00:00Z"))).toBe(true); // Monday
    expect(isUsBusinessDay(new Date("2026-09-01T12:00:00Z"))).toBe(true); // Tuesday
  });

  it("treats weekends as non-business days", () => {
    expect(isUsBusinessDay(new Date("2026-08-29T12:00:00Z"))).toBe(false); // Saturday
    expect(isUsBusinessDay(new Date("2026-08-30T12:00:00Z"))).toBe(false); // Sunday
  });

  it("treats US market holidays as non-business days", () => {
    expect(isUsBusinessDay(new Date("2026-07-03T12:00:00Z"))).toBe(false); // Jul 4 observed (Sat → Fri)
    expect(isUsBusinessDay(new Date("2026-09-07T12:00:00Z"))).toBe(false); // Labor Day
    expect(isUsBusinessDay(new Date("2026-12-25T12:00:00Z"))).toBe(false); // Christmas
  });
});

describe("countElapsedBusinessDays", () => {
  it("Friday observation viewed Saturday → 0 elapsed (weekend not counted)", () => {
    expect(countElapsedBusinessDays("2026-08-28", "2026-08-29")).toBe(0);
  });

  it("Friday observation viewed Sunday → 0 elapsed", () => {
    expect(countElapsedBusinessDays("2026-08-28", "2026-08-30")).toBe(0);
  });

  it("Friday observation viewed Monday → 1 elapsed business day", () => {
    expect(countElapsedBusinessDays("2026-08-28", "2026-08-31")).toBe(1);
  });

  it("Friday observation viewed Tuesday → 2 elapsed business days (boundary)", () => {
    expect(countElapsedBusinessDays("2026-08-28", "2026-09-01")).toBe(2);
  });

  it("Friday observation viewed Wednesday → 3 elapsed business days (stale)", () => {
    expect(countElapsedBusinessDays("2026-08-28", "2026-09-02")).toBe(3);
  });

  it("Thursday observation viewed Monday → 2 (Friday + Monday counted)", () => {
    expect(countElapsedBusinessDays("2026-08-27", "2026-08-31")).toBe(2);
  });

  it("skips a US market holiday between the observation and today", () => {
    // Friday 2026-07-03 is a holiday; obs Thursday 07-02, today Monday 07-06
    // → business days in (07-02, 07-06] = Fri(holiday, skipped), Mon → 1
    expect(countElapsedBusinessDays("2026-07-02", "2026-07-06")).toBe(1);
  });

  it("returns 0 when the observation date is today or in the future", () => {
    expect(countElapsedBusinessDays("2026-09-01", "2026-09-01")).toBe(0);
    expect(countElapsedBusinessDays("2026-09-02", "2026-09-01")).toBe(0);
  });
});
