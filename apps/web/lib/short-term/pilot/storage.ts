import "server-only";
import {
  createDurableShadowStore,
  DEFAULT_SHADOW_RETENTION_DAYS,
  type DurableShadowStore,
} from "../evaluation/durable-shadow-store";

export const REAL_PILOT_SHADOW_RETENTION_DAYS = DEFAULT_SHADOW_RETENTION_DAYS;

export function createRealPilotShadowStore(directory?: string): DurableShadowStore {
  return createDurableShadowStore({
    ...(directory ? { directory } : {}),
    retentionDays: REAL_PILOT_SHADOW_RETENTION_DAYS,
  });
}
