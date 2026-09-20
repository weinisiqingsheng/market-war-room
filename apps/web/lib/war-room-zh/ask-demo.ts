import { selectEvidenceForQuestion } from "@/lib/ask-sakura/select-evidence";
import type { AskSakuraAnswer } from "@/lib/ask-sakura/types";
import type { BriefContext } from "@/lib/ai-brief/types";

export function buildChineseDemoAnswer(question: string, context: BriefContext): AskSakuraAnswer {
  const selection = selectEvidenceForQuestion(context, question);
  const ticker = selection.detectedTickers[0];
  const factMap = new Map(selection.facts.map((fact) => [fact.id, fact]));

  if (ticker) {
    const anomaly = factMap.get(`anomaly.${ticker}`);
    const primary = factMap.get(`catalyst.${ticker}.primary`);
    const none = factMap.get(`catalyst.${ticker}.none`);
    if (anomaly && primary) {
      const category =
        typeof primary.data.category === "string" ? primary.data.category : "相关证据";
      return {
        version: "ask-sakura-v1",
        status: "answered",
        answer: {
          text: `${ticker} 出现异常波动。系统匹配到相关证据类别：${category}，该匹配代表关联，不等同于因果关系。`,
          evidenceRefs: [`anomaly.${ticker}`, `catalyst.${ticker}.primary`],
        },
        supportingPoints: [
          {
            text: `${ticker} 已被当前证据标记为异常波动，并匹配到可核查的证据。`,
            evidenceRefs: [`anomaly.${ticker}`, `catalyst.${ticker}.primary`],
          },
        ],
        limitations: [{ text: "该回答仅基于当前 Market War Room 证据。", evidenceRefs: [] }],
      };
    }
    if (anomaly && none) {
      return {
        version: "ask-sakura-v1",
        status: "insufficient_evidence",
        answer: {
          text: `${ticker} 出现异常波动，但当前证据未发现足够强的公司特定催化剂，因此不做原因推断。`,
          evidenceRefs: [`anomaly.${ticker}`, `catalyst.${ticker}.none`],
        },
        supportingPoints: [],
        limitations: [{ text: "该回答仅基于当前 Market War Room 证据。", evidenceRefs: [] }],
      };
    }
  }

  const refs = selection.facts.slice(0, 3).map((fact) => fact.id);
  if (refs.length === 0) {
    return {
      version: "ask-sakura-v1",
      status: "insufficient_evidence",
      answer: {
        text: "当前 Market War Room 证据不足，无法回答该问题。",
        evidenceRefs: [],
      },
      supportingPoints: [],
      limitations: [],
    };
  }
  return {
    version: "ask-sakura-v1",
    status: "answered",
    answer: {
      text: `根据当前 Market War Room 证据（共 ${selection.selectedFactIds.length} 条），可以先核对以下事实：${selection.facts
        .slice(0, 2)
        .map((fact) => fact.text)
        .join(" ")}`,
      evidenceRefs: refs,
    },
    supportingPoints: [],
    limitations: [{ text: "该回答仅基于当前 Market War Room 证据。", evidenceRefs: [] }],
  };
}
