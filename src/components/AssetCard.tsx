"use client";

import { useState } from "react";
import { Check, Heart, ImageOff, MoreHorizontal, Play, RotateCw } from "lucide-react";
import { AssetMenu } from "@/components/AssetMenu";
import { cn } from "@/lib/cn";
import type { GalleryAsset, ReuseIntent } from "@/lib/types";

type Props = {
  asset: GalleryAsset;
  selected: boolean;
  projectName: string;
  onToggleSelect: () => void;
  onOpen: () => void;
  onToggleFavorite: () => void;
  onReuse: (intent: ReuseIntent) => void;
  onTrash: () => void;
  onCopyToProject: () => void;
};

export function AssetCard({
  asset,
  selected,
  projectName,
  onToggleSelect,
  onOpen,
  onToggleFavorite,
  onReuse,
  onTrash,
  onCopyToProject,
}: Props) {
  const { version } = asset;
  const [broken, setBroken] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<DOMRect | null>(null);
  const src = version.thumbnailUrl || version.previewUrl;
  const isVideo = asset.kind === "video" || version.mimeType.startsWith("video/");
  const menuOpen = Boolean(menuAnchor);

  return (
    <article
      data-open={menuOpen || undefined}
      className={cn(
        "group relative overflow-hidden rounded-[14px] bg-surface",
        selected && "ring-2 ring-white/80",
      )}
    >
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Open ${asset.name}`}
        className="block w-full overflow-hidden"
      >
        <div className="relative aspect-[4/3] w-full bg-surface">
          {broken || !src ? (
            <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-fg-subtle">
              <ImageOff className="h-6 w-6" strokeWidth={1.5} />
              <span className="px-3 text-center text-[11px]">{asset.name}</span>
            </div>
          ) : isVideo ? (
            <>
              <video
                src={src}
                muted
                playsInline
                preload="metadata"
                className="h-full w-full object-cover"
                onError={() => setBroken(true)}
              />
              <span className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-80 transition group-hover:opacity-0">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm">
                  <Play className="h-4 w-4 fill-white" strokeWidth={0} />
                </span>
              </span>
            </>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt={asset.name}
              className="h-full w-full object-cover"
              loading="lazy"
              decoding="async"
              onError={() => setBroken(true)}
            />
          )}
          <span className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/25 via-transparent to-black/45 opacity-0 transition group-hover:opacity-100 group-data-[open]:opacity-100" />
        </div>
      </button>

      <button
        type="button"
        aria-label={selected ? "Deselect" : "Select"}
        aria-pressed={selected}
        onClick={(event) => {
          event.stopPropagation();
          onToggleSelect();
        }}
        className={cn(
          "absolute left-2.5 top-2.5 inline-flex h-[22px] w-[22px] items-center justify-center rounded-[6px] border border-white/80 text-black shadow-sm transition",
          selected ? "bg-white opacity-100" : "bg-black/20 opacity-0 group-hover:opacity-100 group-data-[open]:opacity-100",
        )}
      >
        {selected ? <Check className="h-3.5 w-3.5" strokeWidth={2.5} /> : null}
      </button>

      <button
        type="button"
        aria-label={asset.favorite ? "Remove favorite" : "Favorite"}
        onClick={(event) => {
          event.stopPropagation();
          onToggleFavorite();
        }}
        className={cn(
          "absolute right-2.5 top-2.5 inline-flex h-7 w-7 items-center justify-center text-white drop-shadow transition",
          asset.favorite ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-data-[open]:opacity-100",
        )}
      >
        <Heart className={cn("h-[18px] w-[18px]", asset.favorite && "fill-white")} strokeWidth={1.75} />
      </button>

      <div className="pointer-events-none absolute inset-x-2 bottom-2 flex items-center justify-between opacity-0 transition group-hover:opacity-100 group-data-[open]:opacity-100">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onReuse("reuse");
          }}
          className="pointer-events-auto inline-flex items-center gap-1.5 text-[13px] font-medium text-white drop-shadow"
        >
          <RotateCw className="h-3.5 w-3.5" strokeWidth={2} />
          Reuse inputs
        </button>
        <button
          type="button"
          aria-label="More options"
          aria-expanded={menuOpen}
          onClick={(event) => {
            event.stopPropagation();
            setMenuAnchor(event.currentTarget.getBoundingClientRect());
          }}
          className="pointer-events-auto inline-flex h-7 w-7 items-center justify-center text-white drop-shadow"
        >
          <MoreHorizontal className="h-5 w-5" strokeWidth={1.75} />
        </button>
      </div>

      {menuAnchor && (
        <AssetMenu
          asset={asset}
          projectName={projectName}
          selected={selected}
          anchor={menuAnchor}
          onClose={() => setMenuAnchor(null)}
          onToggleSelect={onToggleSelect}
          onTrash={onTrash}
          onCopyToProject={onCopyToProject}
        />
      )}
    </article>
  );
}
