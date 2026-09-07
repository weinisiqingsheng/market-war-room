import type { MarketDataMode } from "@war-room/types";
import { SakuraLogo } from "@/components/SakuraLogo";
import { chineseCopy } from "./ChineseCopy";

export function ChineseFooter({ mode }: { mode: MarketDataMode }) {
  return (
    <footer className="border-t border-line bg-white/50 py-6">
      <div className="mx-auto flex w-full max-w-[1360px] flex-col items-center justify-between gap-3 px-4 text-center sm:flex-row sm:px-6 sm:text-left">
        <p className="flex items-center gap-2 text-xs text-ink-muted">
          <SakuraLogo size={16} />
          {chineseCopy.footerName}
        </p>
        <p className="text-xs text-ink-muted">
          {mode === "live" ? chineseCopy.footerLive : chineseCopy.footerDemo}
        </p>
      </div>
    </footer>
  );
}
