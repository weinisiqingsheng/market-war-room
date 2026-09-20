/** ask-sakura-v1 — independent grounded Q&A contract (V1.1C). */

export const ASK_SAKURA_VERSION = "ask-sakura-v1";

export type AskSakuraStatus = "answered" | "insufficient_evidence" | "out_of_scope";

export interface AskTextUnit {
  text: string;
  evidenceRefs: string[];
}

export interface AskSakuraAnswer {
  version: "ask-sakura-v1";
  status: AskSakuraStatus;
  answer: AskTextUnit;
  supportingPoints: AskTextUnit[];
  limitations: AskTextUnit[];
}
