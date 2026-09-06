"use client";

import { useAiMarketBrief } from "../useAiMarketBrief";
import { AiMarketBriefCard } from "@/components/ai-market-brief-card";

/** Owns AI Brief networking/state so HomeDashboard stays free of fetch logic. */
export function AiMarketBriefPanel() {
  const { status, response, refetch } = useAiMarketBrief();
  return (
    <AiMarketBriefCard
      data={response}
      loading={status === "loading" && response === null}
      networkError={status === "error"}
      onRetry={refetch}
    />
  );
}
