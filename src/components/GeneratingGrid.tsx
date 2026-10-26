"use client";

import { cn } from "@/lib/cn";
import type { MediaMode } from "@/components/GenerateComposer";

export type GeneratingSlot = {
  id: string;
  index: number;
  progress: number;
  status: "queued" | "running" | "succeeded" | "failed";
  error?: string;
};

type Props = {
  slots: GeneratingSlot[];
  mediaMode?: MediaMode;
};

export function GeneratingGrid({ slots, mediaMode = "image" }: Props) {
  if (slots.length === 0) return null;
  const label = mediaMode === "video" ? "Video" : "Image";

  return (
    <div className="mb-3 grid grid-cols-2 gap-2.5 px-5 md:grid-cols-3 xl:grid-cols-4">
      {slots.map((slot) => (
        <article
          key={slot.id}
          className="relative overflow-hidden rounded-[10px] border border-border bg-surface"
        >
          <div className="relative flex aspect-[4/3] w-full flex-col items-center justify-center gap-3 bg-gradient-to-b from-surface-hover to-surface px-4">
            <div className="h-10 w-10 animate-pulse rounded-full border-2 border-accent/40 border-t-accent" />
            <div className="w-full max-w-[180px]">
              <div className="mb-1.5 flex items-center justify-between text-[11px] text-fg-muted">
                <span>
                  {slot.status === "queued"
                    ? "Queued"
                    : slot.status === "failed"
                      ? "Failed"
                      : slot.status === "succeeded"
                        ? "Done"
                        : "Generating"}
                </span>
                <span className="tabular-nums text-fg">
                  {Math.round(slot.progress)}%
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-black/40">
                <div
                  className={cn(
                    "h-full rounded-full transition-[width] duration-300 ease-out",
                    slot.status === "failed" ? "bg-red-500" : "bg-accent",
                  )}
                  style={{ width: `${Math.min(100, Math.max(0, slot.progress))}%` }}
                />
              </div>
            </div>
            <p className="text-[11px] text-fg-subtle">
              {label} {slot.index + 1}
            </p>
            {slot.error && (
              <p className="line-clamp-2 text-center text-[10px] text-red-400">{slot.error}</p>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}
