import { labelForwardReturn, type ForwardDirection } from "./contract";

export function alwaysFlatBaseline(): "FLAT" {
  return "FLAT";
}
export function historicalMajorityBaseline(
  counts: Partial<Record<ForwardDirection, number>>,
): ForwardDirection {
  const values = { FLAT: counts.FLAT ?? 0, UP: counts.UP ?? 0, DOWN: counts.DOWN ?? 0 };
  if (!Object.values(values).every((value) => Number.isFinite(value) && value >= 0))
    throw new Error("Invalid historical counts");
  return (["FLAT", "UP", "DOWN"] as const).reduce(
    (best, label) => (values[label] > values[best] ? label : best),
    "FLAT",
  );
}
export function frozenMomentumBaseline(
  referencePrice: number,
  previousClose: number,
): ForwardDirection {
  if (![referencePrice, previousClose].every((value) => Number.isFinite(value) && value > 0))
    throw new Error("Invalid momentum prices");
  return labelForwardReturn(((referencePrice - previousClose) / previousClose) * 100);
}
