import type { Tone } from "@war-room/types";
import { cn } from "@/lib/cn";
import { InfoIcon, LeafIcon, TrendArrow, TriangleAlertIcon } from "./icons";

const styles: Record<Tone, string> = {
  positive: "bg-pos-bg text-pos",
  negative: "bg-neg-bg text-neg",
  warning: "bg-warn-bg text-warn",
  neutral: "bg-[#F4EFF2] text-ink-secondary",
};

interface ToneBadgeProps {
  tone: Tone;
  label: string;
  className?: string;
}

/**
 * Market *interpretation* chip. Distinct from raw direction (Trend): a price
 * can be up and still carry a negative/risk interpretation.
 */
export function ToneBadge({ tone, label, className }: ToneBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
        styles[tone],
        className,
      )}
    >
      <ToneIcon tone={tone} />
      <span className="truncate">{label}</span>
    </span>
  );
}

function ToneIcon({ tone }: { tone: Tone }) {
  switch (tone) {
    case "positive":
      return <LeafIcon className="h-3 w-3 shrink-0" />;
    case "negative":
      return <TrendArrow direction="down" className="h-3 w-3 shrink-0" />;
    case "warning":
      return <TriangleAlertIcon className="h-3 w-3 shrink-0" />;
    case "neutral":
      return <InfoIcon className="h-3 w-3 shrink-0" />;
  }
}
