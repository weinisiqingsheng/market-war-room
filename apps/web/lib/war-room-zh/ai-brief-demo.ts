import type { GroundedMarketBrief } from "@/lib/ai-brief/brief-types";

const section = (text: string, ...evidenceRefs: string[]) => ({ text, evidenceRefs });

export function buildChineseDemoGroundedBrief(): GroundedMarketBrief {
  return {
    version: "ai-brief-v1",
    headline: "市场参与度偏弱，波动保持温和",
    stance: {
      label: "谨慎 / 中性",
      summary: "市场环境偏谨慎，参与度偏弱，但波动保持温和。",
      evidenceRefs: ["regime.overall", "breadth.summary", "macro.vix"],
    },
    overview: [
      section("市场环境为 CAUTIOUS / NEUTRAL，评分为 49/100。", "regime.overall"),
      section("市场广度偏弱，参与度为 Broad Selloff，推进比例为 34.9%。", "breadth.advanceRatio"),
    ],
    keyDrivers: [
      {
        title: "市场广度偏弱",
        text: "仅 34.9% 的成分股上涨。",
        impact: "negative",
        evidenceRefs: ["breadth.advanceRatio"],
      },
      {
        title: "油价压力",
        text: "WTI 上涨 5.1%。",
        impact: "negative",
        evidenceRefs: ["macro.wti"],
      },
    ],
    marketInternals: section("35.0% 的成分股位于 20 日移动平均线之上。", "breadth.above20"),
    macro: section("最新可用日度观察中的 VIX 为 14.3。", "macro.vix"),
    notableMoves: [
      {
        ticker: "LULU",
        text: "LULU 下跌 17.4%；证据中的最强匹配催化事件是下调全年指引。",
        evidenceRefs: ["anomaly.LULU", "catalyst.LULU.primary"],
      },
      {
        ticker: "KLAC",
        text: "KLAC 上涨 7.3%，但没有识别出足够强的公司级催化事件。",
        evidenceRefs: ["anomaly.KLAC", "catalyst.KLAC.none"],
      },
    ],
    watchNext: [section("关注市场广度是否改善。", "breadth.summary")],
    dataQuality: {
      confidence: "high",
      text: "主要数据域可用；催化证据部分降级但仍可使用。",
      evidenceRefs: ["breadth.summary", "catalyst.LULU.primary"],
    },
  };
}
