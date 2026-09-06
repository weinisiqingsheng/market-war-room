import { getProductionAiBriefService } from "@/lib/ai-brief/production-service";
import { handleAiMarketBriefGet } from "@/lib/ai-brief/production-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return handleAiMarketBriefGet({ getService: getProductionAiBriefService });
}
