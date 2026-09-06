import type { ReactNode } from "react";
import type { TrendDirection } from "@war-room/types";
import { cn } from "@/lib/cn";
import { TrendArrow } from "./icons";

const palette: Record<TrendDirection, string> = {
  up: "text-pos",
  down: "text-neg",
  flat: "text-ink-muted",
};

interface TrendProps {
  direction: TrendDirection;
  children: ReactNode;
  className?: string;
  iconClassName?: string;
}

/**
 * Raw price movement: an arrow + signed value. Color follows *direction*
 * (up = positive green, down = rose). Market *interpretation* is a separate
 * signal rendered by ToneBadge — never conflate the two.
 */
export function Trend({ direction, children, className, iconClassName }: TrendProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 font-medium tabular-nums",
        palette[direction],
        className,
      )}
    >
      <TrendArrow direction={direction} className={cn("h-3.5 w-3.5 shrink-0", iconClassName)} />
      <span>{children}</span>
    </span>
  );
}
