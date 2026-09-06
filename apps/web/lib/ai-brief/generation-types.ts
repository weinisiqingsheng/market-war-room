/** Phase 7B.3 — controlled grounded generation result contract. */
import type { GroundedMarketBrief } from "./brief-types";
import type { BriefInputConfidence } from "./types";

export type AiBriefStatus = "generated" | "insufficient_grounded_data" | "unavailable";

export interface SafeGenerationIssue {
  code: string;
  path: string;
  message: string;
}

export type AiBriefGenerationResult =
  | {
      status: "generated";
      brief: GroundedMarketBrief;
      attempts: 1 | 2;
      contextFingerprint: string;
      inputConfidence: BriefInputConfidence;
      model?: string;
      usage?: { inputTokens?: number; outputTokens?: number };
    }
  | {
      status: "insufficient_grounded_data";
      brief: null;
      attempts: 0;
      contextFingerprint: string;
      inputConfidence: BriefInputConfidence;
    }
  | {
      status: "unavailable";
      brief: null;
      attempts: 0 | 1 | 2;
      contextFingerprint: string;
      inputConfidence: BriefInputConfidence;
      reason: "provider_error" | "schema_validation_failed" | "grounding_validation_failed";
      providerErrorCategory?: string;
      validationIssues?: SafeGenerationIssue[];
    };
