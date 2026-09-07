import type { MarketDataMode, MarketFeed } from "@war-room/types";
import { SparkleIcon } from "@/components/ui/icons";
import { chineseCopy } from "./ChineseCopy";

export function ChineseDataBanner({
  mode,
  feed,
}: {
  mode: MarketDataMode;
  feed: MarketFeed | null;
}) {
  const live = mode === "live";
  return (
    <div
      role="note"
      aria-label={live ? "实时数据说明" : "演示数据说明"}
      className="mx-auto flex w-fit max-w-full items-center gap-2 rounded-full border border-line bg-white/70 px-4 py-1.5 shadow-soft"
    >
      <SparkleIcon className="h-3.5 w-3.5 shrink-0 text-brand" />
      <p className="text-[11px] font-medium tracking-wide text-ink-muted">
        <span className="font-semibold text-brand-deep">
          {live ? chineseCopy.liveData : chineseCopy.dataPreview}
        </span>{" "}
        —{" "}
        {live
          ? `市场脉搏与板块轮动来自 Alpaca ${feed?.toUpperCase() ?? "IEX"}`
          : chineseCopy.demoNotice}
      </p>
    </div>
  );
}
