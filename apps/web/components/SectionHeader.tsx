import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

interface SectionHeaderProps {
  kicker?: string;
  title: string;
  subtitle?: string;
  meta?: ReactNode;
  align?: "left" | "center";
  id?: string;
}

export function SectionHeader({
  kicker,
  title,
  subtitle,
  meta,
  align = "left",
  id,
}: SectionHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-start justify-between gap-x-4 gap-y-2",
        align === "center" && "flex-col items-center text-center",
      )}
    >
      <div className={cn("min-w-0", align === "center" && "text-center")}>
        {kicker && (
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-deep">
            {kicker}
          </p>
        )}
        <h2 id={id} className="mt-1 text-xl font-semibold tracking-tight text-ink">
          {title}
        </h2>
        {subtitle && <p className="mt-1 text-sm text-ink-secondary">{subtitle}</p>}
      </div>
      {meta && <div className="shrink-0">{meta}</div>}
    </div>
  );
}
