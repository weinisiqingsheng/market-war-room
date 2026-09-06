/**
 * Sakura blossom brand mark — inline SVG, fully editable and scalable.
 * No external image dependency. Used around the brand and sparingly as a
 * decorative corner accent (via `decorative`).
 */

interface SakuraLogoProps {
  size?: number;
  className?: string;
}

const PETALS = [0, 72, 144, 216, 288];
const STAMENS = [18, 90, 162, 234, 306];
const PETAL_PATH = "M24 24 C18.5 20.5 16.5 10.5 24 6.5 C31.5 10.5 29.5 20.5 24 24 Z";

export function SakuraLogo({ size = 28, className }: SakuraLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Sakura blossom brand mark"
      className={className}
    >
      <defs>
        <linearGradient
          id="sakura-petal-gradient"
          x1="24"
          y1="4"
          x2="24"
          y2="30"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#F7C7D8" />
          <stop offset="1" stopColor="#EC9DB9" />
        </linearGradient>
      </defs>
      {PETALS.map((angle) => (
        <path
          key={angle}
          d={PETAL_PATH}
          transform={`rotate(${angle} 24 24)`}
          fill="url(#sakura-petal-gradient)"
          opacity={angle % 144 === 0 ? 1 : 0.92}
        />
      ))}
      <circle cx="24" cy="24" r="3.2" fill="#C15C82" />
      {STAMENS.map((angle) => (
        <circle
          key={angle}
          cx="24"
          cy="17.6"
          r="1.1"
          fill="#FFF8FB"
          opacity="0.85"
          transform={`rotate(${angle} 24 24)`}
        />
      ))}
    </svg>
  );
}
