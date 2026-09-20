"use client";

import { useEffect } from "react";
import { useAiMarketBrief } from "../useAiMarketBrief";
import { AiMarketBriefCard } from "@/components/ai-market-brief-card";

export interface AiMarketBriefPanelProps {
  /** Intelligence-only: forwards a claim's evidence refs to Evidence Explorer. */
  onShowEvidence?: (evidenceRefs: string[]) => void;
  /** Intelligence-only: reports the AI response's context fingerprint for alignment. */
  onFingerprintChange?: (fingerprint: string | null) => void;
}

/** Owns AI Brief networking/state so HomeDashboard stays free of fetch logic. */
export function AiMarketBriefPanel({
  onShowEvidence,
  onFingerprintChange,
}: AiMarketBriefPanelProps = {}) {
  const { status, response, refetch } = useAiMarketBrief();
  const fingerprint = response?.contextFingerprint ?? null;

  useEffect(() => {
    onFingerprintChange?.(fingerprint);
  }, [fingerprint, onFingerprintChange]);

  return (
    <AiMarketBriefCard
      data={response}
      loading={status === "loading" && response === null}
      networkError={status === "error"}
      onRetry={refetch}
      onShowEvidence={onShowEvidence}
    />
  );
}
