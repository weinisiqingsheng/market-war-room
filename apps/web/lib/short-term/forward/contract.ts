export const FORWARD_TASK_ID = "next_session_direction_v1" as const;
export const FORWARD_TASK_VERSION = "short-term-forward-direction-v1" as const;
export const FORWARD_HORIZON = "next_session_close" as const;
export const FORWARD_DIRECTION_CLASSES = ["UP", "FLAT", "DOWN"] as const;
export const FORWARD_FLAT_BAND_PCT = 0.1;

export type ForwardDirection = (typeof FORWARD_DIRECTION_CLASSES)[number];

export function labelForwardReturn(returnPct: number): ForwardDirection {
  if (!Number.isFinite(returnPct)) throw new Error("Return must be finite");
  if (returnPct > FORWARD_FLAT_BAND_PCT) return "UP";
  if (returnPct < -FORWARD_FLAT_BAND_PCT) return "DOWN";
  return "FLAT";
}
