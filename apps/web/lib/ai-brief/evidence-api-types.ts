import type { ModelFacingContext } from "./serialize-context";

/**
 * V1.1B — HTTP DTO for GET /api/ai/evidence.
 *
 * This is the SAME model-facing evidence projection the AI brief is grounded
 * on (projectBriefContext), plus the evidence fingerprint for alignment. It is
 * intentionally not a second evidence contract and carries no raw payloads.
 */
export type AiEvidenceMode = "demo" | "live";

export interface AiEvidenceContext extends ModelFacingContext {
  fingerprint: string;
}

export interface AiEvidenceApiOk {
  mode: AiEvidenceMode;
  status: "ok";
  context: AiEvidenceContext;
}

export interface AiEvidenceApiUnavailable {
  mode: AiEvidenceMode;
  status: "unavailable";
}

export type AiEvidenceApiResponse = AiEvidenceApiOk | AiEvidenceApiUnavailable;
