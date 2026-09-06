import type { RegimeDriver } from "@/types/market";
import { Trend } from "./ui/Trend";
import { ToneBadge } from "./ui/ToneBadge";

export function RegimeDriverCard({ driver }: { driver: RegimeDriver }) {
  const direction = driver.changePct > 0 ? "up" : driver.changePct < 0 ? "down" : "flat";
  return (
    <li className="rounded-xl border border-line bg-white/80 p-3 shadow-soft">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-ink-secondary">{driver.name}</span>
        <Trend direction={direction} className="text-sm font-semibold">
          {driver.value}
        </Trend>
      </div>
      <div className="mt-2">
        <ToneBadge tone={driver.tone} label={driver.signal} />
      </div>
    </li>
  );
}
