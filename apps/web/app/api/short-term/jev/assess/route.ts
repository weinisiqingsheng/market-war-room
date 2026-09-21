import { NextResponse } from "next/server";
import { createFixtureMarketState } from "@/lib/short-term/market-data/fixture";
import { createFixtureTransport } from "@/lib/short-term/jev/fixture-transport";
import { createJevService } from "@/lib/short-term/jev/service";
import { normalizeJevAssessmentRequest } from "@/lib/short-term/jev/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" } as const;
const MAX_BODY_BYTES = 16_384;
const phase2aService = createJevService({ transport: createFixtureTransport() });

function response(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: noStore });
}

export async function POST(request: Request) {
  let raw: string;
  try {
    raw = await request.text();
  } catch {
    return response(
      { error: { code: "INVALID_REQUEST", message: "Request body could not be read." } },
      400,
    );
  }
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
    return response(
      { error: { code: "INVALID_REQUEST", message: "Request body is too large." } },
      400,
    );
  }
  try {
    const requestInput = normalizeJevAssessmentRequest(JSON.parse(raw));
    const assessment = await phase2aService.assess(
      requestInput,
      createFixtureMarketState(requestInput.ticker),
    );
    return response(assessment);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Request could not be evaluated";
    return response({ error: { code: "INVALID_REQUEST", message } }, 400);
  }
}
