/** ask-sakura-v1 grounding issue contract. */
export type AskGroundingIssueCode =
  | "UNKNOWN_EVIDENCE_REF"
  | "REF_OUTSIDE_SELECTED"
  | "MISSING_EVIDENCE_REFS"
  | "UNSUPPORTED_NUMBER"
  | "ABSOLUTE_CAUSALITY"
  | "UNSUPPORTED_FUTURE_EVENT"
  | "CROSS_TICKER_CATALYST_REF"
  | "NO_CLEAR_CATALYST_CONTRADICTION"
  | "CATALYST_STRENGTH_OVERSTATEMENT"
  | "OUT_OF_SCOPE_CONTENT"
  | "MISSING_TICKER_EVIDENCE"
  /* V1.2B — on-demand ticker evidence rules */
  | "TICKER_EVIDENCE_MISMATCH"
  | "CONTEXT_ONLY_CATALYST_PROMOTION"
  | "UNSUPPORTED_FORECAST";

export interface AskGroundingIssue {
  code: AskGroundingIssueCode;
  path: string;
  message: string;
}

export type AskGroundingResult =
  { valid: true; issues: [] } | { valid: false; issues: AskGroundingIssue[] };
