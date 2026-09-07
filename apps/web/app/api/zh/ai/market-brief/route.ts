import { handleChineseAiMarketBriefGet } from "@/lib/war-room-zh/ai-brief-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return handleChineseAiMarketBriefGet();
}
