import { NextResponse } from "next/server";
import {
  evaluateShortTermMock,
  normalizeShortTermRequest,
} from "@/lib/short-term/mock-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" } as const;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const normalized = normalizeShortTermRequest(body);
    return NextResponse.json(evaluateShortTermMock(normalized), { headers: noStore });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Request could not be evaluated";
    const status = message === "Request body is required" ? 400 : 400;
    return NextResponse.json(
      { error: { code: "INVALID_REQUEST", message } },
      { status, headers: noStore },
    );
  }
}

