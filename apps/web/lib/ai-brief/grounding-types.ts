/** Phase 7B.2 — deterministic grounding validation issue contract. */

export type GroundingIssueCode =
  | "INSUFFICIENT_CONTEXT"
  | "UNKNOWN_EVIDENCE_REF"
  | "STANCE_MISSING_REGIME_REF"
  | "SECTION_DOMAIN_MISMATCH"
  | "UNKNOWN_NOTABLE_TICKER"
  | "MISSING_ANOMALY_REF"
  | "CROSS_TICKER_CATALYST_REF"
  | "MISSING_CATALYST_REF"
  | "NO_CLEAR_CATALYST_CONTRADICTION"
  | "CATALYST_STRENGTH_OVERSTATEMENT"
  | "ABSOLUTE_CAUSALITY"
  | "UNSUPPORTED_NUMBER"
  | "UNSUPPORTED_FUTURE_EVENT"
  | "DATA_QUALITY_CONFIDENCE_MISMATCH";

export interface GroundingIssue {
  code: GroundingIssueCode;
  path: string;
  message: string;
}

export type GroundingValidationResult =
  | { valid: true; issues: [] }
  | { valid: false; issues: GroundingIssue[] };
