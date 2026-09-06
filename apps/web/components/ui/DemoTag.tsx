import { SparkleIcon } from "./icons";

/** Small "Demo" provenance tag used on data-bearing modules. */
export function DemoTag({ label = "Demo" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-line bg-white/70 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
      <SparkleIcon className="h-3 w-3" />
      {label}
    </span>
  );
}
