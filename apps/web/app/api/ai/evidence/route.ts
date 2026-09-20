import { handleAiEvidenceGet } from "@/lib/ai-brief/evidence-endpoint";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/ai/evidence — read-only grounded Evidence Pack (model-facing
 * projection + fingerprint). Used by the Intelligence Evidence Explorer.
 */
export async function GET() {
  return handleAiEvidenceGet();
}
