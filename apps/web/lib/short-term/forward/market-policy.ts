import type { ForwardDecisionContext } from "./types";

/**
 * Frozen Phase 2E market-data semantics. The existing ticker research path
 * deliberately uses delayed-SIP snapshots for decision-time state and SIP
 * split-adjusted daily bars for the independently observed session close.
 */
export const FORWARD_MARKET_DATA_POLICY_VERSION =
  "short-term-forward-market-data-policy-v1" as const;

export const FORWARD_MARKET_DATA_POLICY = Object.freeze({
  version: FORWARD_MARKET_DATA_POLICY_VERSION,
  provider: "alpaca",
  decisionFeed: "delayed_sip",
  outcomeFeed: "sip",
  delayMinutes: 15,
  outcomeAdjustment: "split",
  outcomePriceReferenceType: "daily_bar_close_split_adjusted",
  freshness: "delayed",
  crossFeedRule: "same_provider_delayed_sip_decision_to_sip_outcome",
  failClosedReasons: [
    "decision_feed_mismatch",
    "decision_delay_mismatch",
    "decision_freshness_mismatch",
    "outcome_feed_mismatch",
    "outcome_adjustment_mismatch",
  ],
} as const);

export type ForwardDecisionPolicyResult =
  | { ok: true }
  | {
      ok: false;
      reason: "decision_feed_mismatch" | "decision_delay_mismatch" | "decision_freshness_mismatch";
    };

export function assertForwardDecisionPolicy(
  decision: Pick<ForwardDecisionContext, "feed" | "delayMinutes"> & {
    freshness: "real_time" | "fresh" | "delayed" | "stale" | "unavailable";
  },
): ForwardDecisionPolicyResult {
  if (decision.feed !== FORWARD_MARKET_DATA_POLICY.decisionFeed)
    return { ok: false, reason: "decision_feed_mismatch" };
  if (decision.delayMinutes !== FORWARD_MARKET_DATA_POLICY.delayMinutes)
    return { ok: false, reason: "decision_delay_mismatch" };
  if (decision.freshness !== FORWARD_MARKET_DATA_POLICY.freshness)
    return { ok: false, reason: "decision_freshness_mismatch" };
  return { ok: true };
}
