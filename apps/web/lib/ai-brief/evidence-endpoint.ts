import { NextResponse } from "next/server";
import type { BriefContext } from "./types";
import { projectBriefContext } from "./serialize-context";
import { buildDemoBriefContext } from "./demo-context";
import { buildLiveBriefContext } from "./live-context";
import { resolveAiBriefMode, type AiBriefProductionMode } from "./production-service";
import type { AiEvidenceApiResponse, AiEvidenceContext } from "./evidence-api-types";

/** Project the sealed BriefContext into its client-safe DTO (no data/prompts). */
export function buildAiEvidenceContext(context: BriefContext): AiEvidenceContext {
  const projection = projectBriefContext(context);
  return { ...projection, fingerprint: context.fingerprint };
}

export interface AiEvidenceGetOptions {
  mode?: AiBriefProductionMode;
  contextBuilder?: () => BriefContext | Promise<BriefContext>;
}

function defaultContextBuilder(mode: AiBriefProductionMode) {
  return mode === "demo" ? () => buildDemoBriefContext() : () => buildLiveBriefContext();
}

/**
 * Read-only evidence endpoint boundary. Returns ONLY the model-facing evidence
 * projection + fingerprint. Explicit live failure returns 503 and never falls
 * back to demo; config errors are safe and secret-free.
 */
export async function handleAiEvidenceGet(input: AiEvidenceGetOptions = {}): Promise<NextResponse> {
  const noStore = { "Cache-Control": "no-store" };
  let requestedMode: AiBriefProductionMode | undefined;

  try {
    requestedMode = input.mode ?? resolveAiBriefMode();
    const builder = input.contextBuilder ?? defaultContextBuilder(requestedMode);
    const context = await builder();
    const payload: AiEvidenceApiResponse = {
      mode: requestedMode,
      status: "ok",
      context: buildAiEvidenceContext(context),
    };
    return NextResponse.json(payload, { status: 200, headers: noStore });
  } catch {
    const safeMode: AiBriefProductionMode = requestedMode === "demo" ? "demo" : "live";
    const payload: AiEvidenceApiResponse = { mode: safeMode, status: "unavailable" };
    return NextResponse.json(payload, { status: 503, headers: noStore });
  }
}
