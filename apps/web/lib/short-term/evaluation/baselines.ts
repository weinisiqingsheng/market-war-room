import type { OutcomeLabel } from "./types";

export function noChangeBaseline(): OutcomeLabel {
  return "flat";
}

export function historicalFrequencyBaseline(
  counts: Partial<Record<OutcomeLabel, number>>,
): OutcomeLabel {
  const candidates: OutcomeLabel[] = ["flat", "up", "down", "not_observable"];
  for (const label of candidates) {
    const count = counts[label];
    if (count !== undefined && (!Number.isFinite(count) || count < 0))
      throw new Error("Historical baseline counts must be finite and non-negative.");
  }
  return candidates.reduce(
    (best, label) => ((counts[label] ?? 0) > (counts[best] ?? 0) ? label : best),
    "flat",
  );
}
