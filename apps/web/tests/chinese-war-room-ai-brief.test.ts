import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { createElement } from "react";
import { buildDemoBriefContext } from "@/lib/ai-brief/demo-context";
import { parseGroundedMarketBrief } from "@/lib/ai-brief/schema";
import { validateGroundedMarketBrief } from "@/lib/ai-brief/grounding-validator";
import { CHINESE_AI_BRIEF_SYSTEM_PROMPT } from "@/lib/war-room-zh/ai-brief-prompt";
import { buildChineseDemoGroundedBrief } from "@/lib/war-room-zh/ai-brief-demo";
import { createChineseAiBriefService } from "@/lib/war-room-zh/ai-brief-service";
import { GET } from "@/app/api/zh/ai/market-brief/route";
import { ChineseAiMarketBriefContent } from "@/components/war-room-zh/ChineseAiMarketBriefContent";

describe("Chinese AI Market Brief boundary", () => {
  it("uses concise Simplified Chinese evidence-only instructions and the root contract", () => {
    expect(CHINESE_AI_BRIEF_SYSTEM_PROMPT).toMatch(/[\u4e00-\u9fff]/);
    expect(CHINESE_AI_BRIEF_SYSTEM_PROMPT).toContain("只使用" );
    expect(CHINESE_AI_BRIEF_SYSTEM_PROMPT).toContain("不得编造" );
    expect(CHINESE_AI_BRIEF_SYSTEM_PROMPT).toContain("不得新增数字" );
    expect(CHINESE_AI_BRIEF_SYSTEM_PROMPT).toContain("evidenceRefs" );
    expect(CHINESE_AI_BRIEF_SYSTEM_PROMPT).toContain("ai-brief-v1" );
    expect(CHINESE_AI_BRIEF_SYSTEM_PROMPT).toContain("不要包裹" );
  });

  it("provides deterministic Chinese demo data compatible with existing schema and grounding", () => {
    const brief = buildChineseDemoGroundedBrief();
    const parsed = parseGroundedMarketBrief(brief);
    expect(parsed.ok).toBe(true);
    expect(brief.version).toBe("ai-brief-v1");
    expect(brief.headline).toMatch(/[\u4e00-\u9fff]/);
    expect(brief.overview.length).toBeGreaterThanOrEqual(1);
    expect(brief.overview.length).toBeLessThanOrEqual(3);
    expect(brief.keyDrivers.length).toBeGreaterThanOrEqual(2);
    expect(brief.keyDrivers.length).toBeLessThanOrEqual(5);
    expect(brief.stance.evidenceRefs.length).toBeGreaterThan(0);
    expect(validateGroundedMarketBrief(brief, buildDemoBriefContext()).valid).toBe(true);
    expect(buildChineseDemoGroundedBrief()).toEqual(brief);
  });

  it("returns the existing safe response shape and no-store header", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toMatchObject({
      mode: "demo",
      status: "generated",
      brief: { version: "ai-brief-v1" },
      cache: { hit: false },
    });
  });

  it("keeps Chinese cache keys isolated from English artifacts", async () => {
    const provider = { complete: vi.fn() };
    const service = createChineseAiBriefService({ mode: "demo", provider });
    const result = await service.generate();
    expect(result.status).toBe("generated");
    expect(provider.complete).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).toContain("ai-brief-v1");
  });

  it("renders localized headings and evidence control without exposing evidence IDs", () => {
    const brief = buildChineseDemoGroundedBrief();
    render(createElement(ChineseAiMarketBriefContent, { brief, onShowEvidence: () => {} }));
    expect(screen.getByRole("heading", { name: "核心驱动" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "市场内部结构" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "宏观" })).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { name: "值得关注" })).toHaveLength(2);
    expect(screen.getByText("数据质量 · high")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "查看证据" }).length).toBeGreaterThan(0);
    expect(screen.queryByText("regime.overall")).toBeNull();
  });
});
