import "server-only";
import { createHash } from "node:crypto";
import { barSessionDate } from "@/lib/breadth/dates";
import type { ProspectiveSessionCalendar } from "../prospective/types";
import {
  FORWARD_OUTCOME_DELAY_MINUTES,
  FORWARD_OUTCOME_SOURCE_VERSION,
  type ForwardOutcomeObservation,
} from "./outcome";

export interface ApprovedSipOutcomeProviderOptions {
  ticker: string;
  stateFingerprint: string;
  targetSessionDate: string;
  now: () => number;
  calendar: ProspectiveSessionCalendar;
  fetchBars: (
    providerSymbol: string,
    startIso: string,
    endIso: string,
  ) => Promise<Array<{ t?: string; c?: number }>>;
}

function sourceFingerprint(input: {
  ticker: string;
  sessionDate: string;
  barTimestamp: string;
  close: number;
}): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        provider: "alpaca",
        feed: "sip",
        priceReferenceType: "daily_bar_close_split_adjusted",
        sourceVersion: FORWARD_OUTCOME_SOURCE_VERSION,
        adjustment: "split",
        ...input,
      }),
    )
    .digest("hex");
}

/**
 * Fetches only the approved SIP close. The end bound is capped at the close
 * plus the declared delay so free/historical SIP access is never mistaken for
 * a request for still-recent data through the end of the calendar day.
 */
export async function collectApprovedSipOutcomeObservation(
  options: ApprovedSipOutcomeProviderOptions,
): Promise<ForwardOutcomeObservation> {
  const session = options.calendar.sessionFor(options.targetSessionDate);
  if (!session || !session.regular || session.earlyClose)
    throw new Error("outcome_session_not_eligible");
  const closeMs = Date.parse(session.closeAt);
  const nowMs = options.now();
  const eligibleMs = closeMs + FORWARD_OUTCOME_DELAY_MINUTES * 60_000;
  if (nowMs < eligibleMs) throw new Error("outcome_not_yet_eligible");
  const endMs = Math.min(nowMs - FORWARD_OUTCOME_DELAY_MINUTES * 60_000, eligibleMs);
  const startIso = `${options.targetSessionDate}T00:00:00.000Z`;
  const endIso = new Date(endMs).toISOString();
  const bars = await options.fetchBars(options.ticker, startIso, endIso).catch(() => {
    throw new Error("outcome_provider_unavailable");
  });
  const bar = bars.find((candidate) => barSessionDate(candidate.t) === options.targetSessionDate);
  if (
    typeof bar?.t !== "string" ||
    typeof bar.c !== "number" ||
    !Number.isFinite(bar.c) ||
    bar.c <= 0
  )
    throw new Error("outcome_data_pending");
  return {
    ticker: options.ticker,
    stateFingerprint: options.stateFingerprint,
    sessionDate: options.targetSessionDate,
    observedAt: session.closeAt,
    observedPrice: bar.c,
    provider: "alpaca",
    feed: "sip",
    delayMinutes: FORWARD_OUTCOME_DELAY_MINUTES,
    freshness: "delayed",
    availability: "available",
    completeness: "complete",
    regularSession: true,
    halted: false,
    priceReferenceType: "daily_bar_close_split_adjusted",
    sourceVersion: FORWARD_OUTCOME_SOURCE_VERSION,
    sourceFingerprint: sourceFingerprint({
      ticker: options.ticker,
      sessionDate: options.targetSessionDate,
      barTimestamp: bar.t,
      close: bar.c,
    }),
  };
}
