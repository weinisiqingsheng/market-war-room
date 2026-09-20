/** ask-sakura-v1 generation result contract (V1.1C). */
import type { AskSakuraAnswer } from "./types";
import type { BriefInputConfidence } from "@/lib/ai-brief/types";

export type AskSakuraGenerationStatus = "generated" | "insufficient_grounded_data" | "unavailable";

export interface SafeAskIssue {
  code: string;
  path: string;
  message: string;
}

export type AskGenerationResult =
  | {
      status: "generated";
      answer: AskSakuraAnswer;
      attempts: 1 | 2;
      contextFingerprint: string;
      inputConfidence: BriefInputConfidence;
    }
  | {
      status: "insufficient_grounded_data";
      answer: null;
      attempts: 0;
      contextFingerprint: string;
      inputConfidence: BriefInputConfidence;
    }
  | {
      status: "unavailable";
      answer: null;
      attempts: 0 | 1 | 2;
      contextFingerprint: string;
      inputConfidence: BriefInputConfidence;
      reason: "provider_error" | "schema_validation_failed" | "grounding_validation_failed";
      providerErrorCategory?: string;
      validationIssues?: SafeAskIssue[];
    };
