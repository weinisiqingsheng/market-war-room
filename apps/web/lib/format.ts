/**
 * Formatting helpers for financial figures.
 * All outputs are intentionally plain strings so components can control
 * tabular-numeral rendering and sign presentation themselves.
 */
import type { MacroSignal } from "@/types/market";

export function formatSignedPct(value: number, digits = 2): string {
  return `${formatSign(value)}${Math.abs(value).toFixed(digits)}%`;
}

export function formatSigned(value: number, digits = 2): string {
  return `${formatSign(value)}${Math.abs(value).toFixed(digits)}`;
}

function formatSign(value: number): string {
  if (value > 0) return "+";
  if (value < 0) return "-";
  return "";
}

export function formatPrice(value: number): string {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatVolume(multiple: number): string {
  return `${multiple.toFixed(1)}x`;
}

/** Formats an ISO timestamp as ET time (e.g. "2:42:15 PM"). Renders "—" when invalid. */
export function formatEtTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(date);
}

/** Formats a macro signal's numeric value per its display unit. */
export function formatMacroValue(signal: MacroSignal): string {
  if (signal.value === null) return "—";
  switch (signal.displayUnit) {
    case "percent":
    case "basis_points":
      return `${signal.value.toFixed(2)}%`;
    case "price":
      return `$${signal.value.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;
    case "index":
      return signal.value.toFixed(2);
  }
}

/**
 * Formats a macro signal's change.
 * - US 10Y (yield): change shown in BASIS POINTS, never as a % return.
 * - Others: relative change percent.
 */
export function formatMacroChange(signal: MacroSignal): string {
  if (signal.change === null) return "—";

  if (signal.id === "us10y") {
    const bps = Math.round(signal.change * 100);
    if (bps === 0) return "0 bp";
    return `${bps > 0 ? "+" : "-"}${Math.abs(bps)} bp`;
  }

  if (signal.changePct === null) return "—";
  const sign = signal.changePct > 0 ? "+" : signal.changePct < 0 ? "-" : "";
  return `${sign}${Math.abs(signal.changePct).toFixed(2)}%`;
}
