import { NextRequest, NextResponse } from "next/server";
import {
  getProductionAskSakuraService,
  handleAskSakuraPost,
} from "@/lib/ask-sakura/production-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET intentionally does not perform generation. */
export async function GET() {
  return new NextResponse(null, {
    status: 405,
    headers: { Allow: "POST", "Cache-Control": "no-store" },
  });
}

/**
 * POST /api/ai/ask-sakura — grounded, stateless question answering.
 * Grounding must complete before a response is returned; no streaming.
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  return handleAskSakuraPost(rawBody, { getService: getProductionAskSakuraService });
}
