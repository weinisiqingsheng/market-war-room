import { useId } from "react";
import type { TrendDirection } from "@war-room/types";
import { cn } from "@/lib/cn";

interface SparklineProps {
  data: number[];
  tone: TrendDirection;
  label: string;
  className?: string;
}

const STROKE: Record<TrendDirection, string> = {
  up: "var(--color-pos)",
  down: "var(--color-neg)",
  flat: "var(--color-ink-muted)",
};

/**
 * Lightweight SVG sparkline — deliberately dependency-free. A chart library
 * is out of scope for tiny intraday strips.
 */
export function Sparkline({ data, tone, label, className }: SparklineProps) {
  const rawId = useId();
  const gradientId = `spark-${rawId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const width = 200;
  const height = 44;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const stepX = width / (data.length - 1);
  const points = data.map((value, i) => {
    const x = i * stepX;
    const y = 3 + (1 - (value - min) / range) * (height - 6);
    return [x, y] as const;
  });
  const linePoints = points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const areaPoints = `0,${height} ${linePoints} ${width},${height}`;
  const stroke = STROKE[tone];

  return (
    <div role="img" aria-label={label} className={cn("w-full", className)}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-11 w-full"
        preserveAspectRatio="none"
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.22" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={areaPoints} fill={`url(#${gradientId})`} />
        <polyline
          points={linePoints}
          fill="none"
          stroke={stroke}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}
