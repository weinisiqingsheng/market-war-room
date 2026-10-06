// @vitest-environment node
import { describe, expect, it } from "vitest";
import { NYSE_REGULAR_SESSION_CALENDAR } from "@/lib/short-term/prospective/calendar";
import { collectApprovedSipOutcomeObservation } from "@/lib/short-term/forward/outcome-provider";

describe("Phase 2E.2a approved SIP outcome provider", () => {
  it("caps the historical SIP end parameter at an eligible, non-future boundary", async () => {
    let requestedEnd = "";
    const observation = await collectApprovedSipOutcomeObservation({
      ticker: "NVDA",
      stateFingerprint: "a".repeat(64),
      targetSessionDate: "2026-09-28",
      now: () => Date.parse("2026-09-28T22:00:00.000Z"),
      calendar: NYSE_REGULAR_SESSION_CALENDAR,
      fetchBars: async (_symbol, _start, end) => {
        requestedEnd = end;
        return [{ t: "2026-09-28T20:00:00.000Z", c: 101 }];
      },
    });
    expect(Date.parse(requestedEnd)).toBeLessThanOrEqual(Date.parse("2026-09-28T20:15:00.000Z"));
    expect(observation.feed).toBe("sip");
    expect(observation.observedPrice).toBe(101);
    expect(observation.sourceFingerprint).toMatch(/^[a-f0-9]{64}$/);
  });

  it("fails before a provider call when delayed-SIP eligibility has not arrived", async () => {
    let called = false;
    await expect(
      collectApprovedSipOutcomeObservation({
        ticker: "NVDA",
        stateFingerprint: "a".repeat(64),
        targetSessionDate: "2026-09-28",
        now: () => Date.parse("2026-09-28T20:14:59.000Z"),
        calendar: NYSE_REGULAR_SESSION_CALENDAR,
        fetchBars: async () => {
          called = true;
          return [];
        },
      }),
    ).rejects.toThrow(/not_yet_eligible/i);
    expect(called).toBe(false);
  });
});
