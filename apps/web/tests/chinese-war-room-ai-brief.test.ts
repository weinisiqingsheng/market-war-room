import { describe, expect, it, vi } from "vitest";
import { act, render, renderHook, screen, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { buildDemoBriefContext } from "@/lib/ai-brief/demo-context";
import { parseGroundedMarketBrief } from "@/lib/ai-brief/schema";
import { validateGroundedMarketBrief } from "@/lib/ai-brief/grounding-validator";
import { CHINESE_AI_BRIEF_SYSTEM_PROMPT } from "@/lib/war-room-zh/ai-brief-prompt";
import { buildChineseDemoGroundedBrief } from "@/lib/war-room-zh/ai-brief-demo";
import { createChineseAiBriefService, resetProductionChineseAiBriefServiceForTests, resolveChineseAiBriefMode } from "@/lib/war-room-zh/ai-brief-service";
import { GET } from "@/app/api/zh/ai/market-brief/route";
import { ChineseAiMarketBriefContent } from "@/components/war-room-zh/ChineseAiMarketBriefContent";
import { useChineseAiMarketBrief } from "@/features/war-room-zh/useChineseAiMarketBrief";
import type { LlmResponse } from "@/lib/llm/types";

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

  it("aborts the active request on manual refetch and unmount", async () => {
    const requests: Array<{ signal: AbortSignal; resolve: (response: Response) => void }> = [];
    vi.stubGlobal("fetch", vi.fn((_input: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((resolve) => {
      requests.push({ signal: init?.signal as AbortSignal, resolve });
    })));
    const { result, unmount } = renderHook(() => useChineseAiMarketBrief());
    await waitFor(() => expect(requests).toHaveLength(1));
    act(() => result.current.refetch());
    expect(requests[0].signal.aborted).toBe(true);
    await waitFor(() => expect(requests).toHaveLength(2));
    unmount();
    expect(requests[1].signal.aborted).toBe(true);
    vi.unstubAllGlobals();
  });

  it("preserves invalid AI_BRIEF_MODE as a configuration error", async () => {
    expect(() => resolveChineseAiBriefMode({ AI_BRIEF_MODE: "edge" })).toThrow();
    const previous = process.env.AI_BRIEF_MODE;
    process.env.AI_BRIEF_MODE = "edge";
    resetProductionChineseAiBriefServiceForTests();
    const response = await GET();
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ status: "unavailable", brief: null, reason: "configuration_error" });
    if (previous === undefined) delete process.env.AI_BRIEF_MODE;
    else process.env.AI_BRIEF_MODE = previous;
    resetProductionChineseAiBriefServiceForTests();
  });

  it("deduplicates concurrent live generation for an equal cache key", async () => {
    const context = buildDemoBriefContext();
    let release!: (value: LlmResponse) => void;
    const provider = { complete: vi.fn(() => new Promise<LlmResponse>((resolve) => { release = resolve; })) };
    const service = createChineseAiBriefService({ mode: "live", liveContextBuilder: async () => context, provider });
    const first = service.generate();
    const second = service.generate();
    await waitFor(() => expect(provider.complete).toHaveBeenCalledTimes(1));
    release({ content: JSON.stringify(buildChineseDemoGroundedBrief()), model: "test", usage: {} });
    const results = await Promise.all([first, second]);
    expect(results[0]?.status).toBe("generated");
    expect(results[1]?.status).toBe("generated");
    expect(provider.complete).toHaveBeenCalledTimes(1);
    const cached = await service.generate();
    expect(cached.status).toBe("cached");
  });

  it("renders localized headings and evidence control without exposing evidence IDs", () => {
    const brief = buildChineseDemoGroundedBrief();
    render(createElement(ChineseAiMarketBriefContent, { brief, onShowEvidence: () => {} }));
    expect(screen.getByRole("heading", { name: "核心驱动" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "市场内部结构" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "宏观" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "值得关注" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "后续关注" })).toBeInTheDocument();
    expect(screen.getByText("数据质量 · 高")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "查看证据" }).length).toBeGreaterThan(0);
    expect(screen.queryByText("regime.overall")).toBeNull();
  });
});
