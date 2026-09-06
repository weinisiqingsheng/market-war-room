import type { SVGProps } from "react";
import type { TrendDirection } from "@war-room/types";

type IconProps = SVGProps<SVGSVGElement>;

const iconDefaults = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.9,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

/** Directional arrow used for raw price movement (never conveys meaning alone). */
export function TrendArrow({ direction, ...props }: IconProps & { direction: TrendDirection }) {
  if (direction === "flat") {
    return (
      <svg {...iconDefaults} {...props}>
        <path d="M4 12h16" />
      </svg>
    );
  }
  return (
    <svg {...iconDefaults} {...props}>
      {direction === "up" ? (
        <>
          <path d="M7 17 17 7" />
          <path d="M9 7h8v8" />
        </>
      ) : (
        <>
          <path d="M7 7l10 10" />
          <path d="M17 9v8H9" />
        </>
      )}
    </svg>
  );
}

export function SparkleIcon(props: IconProps) {
  return (
    <svg {...iconDefaults} {...props}>
      <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z" />
      <path d="M19 17l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7.7-1.8z" />
    </svg>
  );
}

export function LeafIcon(props: IconProps) {
  return (
    <svg {...iconDefaults} {...props}>
      <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.5 19 3c1 2.5 1.5 4 2 10-.6 1.5-1.8 4.5-5 5.5-2 1-4 1.5-5 1.5z" />
      <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
    </svg>
  );
}

export function TriangleAlertIcon(props: IconProps) {
  return (
    <svg {...iconDefaults} {...props}>
      <path d="M21.73 18l-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}

export function InfoIcon(props: IconProps) {
  return (
    <svg {...iconDefaults} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  );
}

export function EyeIcon(props: IconProps) {
  return (
    <svg {...iconDefaults} {...props}>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function LinkIcon(props: IconProps) {
  return (
    <svg {...iconDefaults} {...props}>
      <path d="M9 17H7A5 5 0 0 1 7 7h2" />
      <path d="M15 7h2a5 5 0 0 1 0 10h-2" />
      <path d="M8 12h8" />
    </svg>
  );
}

export function ShieldIcon(props: IconProps) {
  return (
    <svg {...iconDefaults} {...props}>
      <path d="M12 22s8-3 8-10V5l-8-3-8 3v7c0 7 8 10 8 10Z" />
      <path d="M12 8v4" />
      <path d="M12 16h.01" />
    </svg>
  );
}
