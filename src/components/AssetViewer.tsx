"use client";

import { useEffect, useState, type MouseEvent, type ReactNode } from "react";
import {
  ChevronLeft,
  Clapperboard,
  Copy,
  Download,
  Heart,
  Link2,
  Maximize2,
  MoreHorizontal,
  Pencil,
  RotateCw,
  Sparkles,
} from "lucide-react";
import { AssetMenu } from "@/components/AssetMenu";
import { copyAssetLink, downloadAsset, relativeAge } from "@/lib/asset-actions";
import { cn } from "@/lib/cn";
import type { GalleryAsset, ReuseIntent } from "@/lib/types";

type PromptChip = {
  id: string;
  title: string;
  body: string;
  negativePrompt?: string;
};

type Props = {
  asset: GalleryAsset;
  related: GalleryAsset[];
  projectName: string;
  modelLabel: string;
  prompts: PromptChip[];
  selected: boolean;
  onToggleSelect: () => void;
  onClose: () => void;
  onOpenAsset: (asset: GalleryAsset) => void;
  onToggleFavorite: () => void;
  onReuse: (intent: ReuseIntent) => void;
  onPaintMask: () => void;
  onLoadPrompt: (prompt: PromptChip) => void;
  onTrash: () => void;
  onCopyToProject: () => void;
  onExtend?: () => void;
};

export function AssetViewer({
  asset,
  related,
  projectName,
  modelLabel,
  prompts,
  selected,
  onToggleSelect,
  onClose,
  onOpenAsset,
  onToggleFavorite,
  onReuse,
  onPaintMask,
  onLoadPrompt,
  onTrash,
  onCopyToProject,
  onExtend,
}: Props) {
  const src = asset.version.masterUrl || asset.version.previewUrl;
  const isVideo = asset.kind === "video" || asset.version.mimeType.startsWith("video/");
  const [menuAnchor, setMenuAnchor] = useState<DOMRect | null>(null);
  const [editChoice, setEditChoice] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const thumbs = [asset, ...related.filter((item) => item.id !== asset.id)].slice(0, 4);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && editChoice) {
        setEditChoice(false);
        return;
      }
      if (event.key === "Escape" && !menuAnchor) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [editChoice, menuAnchor, onClose]);

  return (
    <div role="dialog" aria-modal="true" aria-label={asset.name} className="fixed inset-0 z-50 flex bg-[#0c0c0e] text-white">
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-2 px-3">
          <button
            type="button"
            aria-label="Back"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-white/80 hover:bg-white/10"
          >
            <ChevronLeft className="h-5 w-5" strokeWidth={1.75} />
          </button>
          <p className="truncate text-[14px] font-medium">{modelLabel}</p>
          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              onClick={() => downloadAsset(asset)}
              className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] text-white/85 hover:bg-white/10"
            >
              <Download className="h-4 w-4" strokeWidth={1.75} />
              Download
            </button>
            <button
              type="button"
              aria-label="Copy image link"
              onClick={() => {
                void copyAssetLink(asset).then(() => {
                  setCopiedLink(true);
                  window.setTimeout(() => setCopiedLink(false), 1200);
                });
              }}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-white/85 hover:bg-white/10"
            >
              <Link2 className="h-4 w-4" strokeWidth={1.75} />
              <span className="sr-only">{copiedLink ? "Copied" : "Copy link"}</span>
            </button>
            <button
              type="button"
              aria-label={asset.favorite ? "Remove favorite" : "Favorite"}
              onClick={onToggleFavorite}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-white/85 hover:bg-white/10"
            >
              <Heart className={cn("h-4 w-4", asset.favorite && "fill-white")} strokeWidth={1.75} />
            </button>
            <button
              type="button"
              aria-label="More options"
              onClick={(event) => setMenuAnchor(event.currentTarget.getBoundingClientRect())}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-white/85 hover:bg-white/10"
            >
              <MoreHorizontal className="h-4 w-4" strokeWidth={1.75} />
            </button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 items-center justify-center px-8 pb-8">
          {isVideo ? (
            <video src={src} controls autoPlay playsInline className="max-h-full max-w-full rounded-lg" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt={asset.version.prompt || asset.name} className="max-h-full max-w-full object-contain" />
          )}
        </div>
      </div>

      <aside className="flex w-[340px] shrink-0 flex-col border-l border-white/10 bg-[#121214]">
        <div className="flex-1 overflow-y-auto px-4 pb-4 pt-4 scrollbar-thin">
          <div className="grid grid-cols-4 gap-1.5">
            {thumbs.map((item) => {
              const thumb = item.version.thumbnailUrl || item.version.previewUrl;
              const active = item.id === asset.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onOpenAsset(item)}
                  className={cn(
                    "aspect-square overflow-hidden rounded-md bg-white/5",
                    active && "ring-2 ring-white",
                  )}
                >
                  {item.kind === "video" ? (
                    <video src={thumb} muted className="h-full w-full object-cover" />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={thumb} alt="" className="h-full w-full object-cover" />
                  )}
                </button>
              );
            })}
          </div>

          <p className="mt-4 line-clamp-6 text-[13px] leading-5 text-white/80">
            {asset.version.prompt || "No prompt saved for this result."}
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onReuse("reuse")}
              className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-[12px] font-medium hover:bg-white/15"
            >
              <RotateCw className="h-3.5 w-3.5" strokeWidth={2} />
              Reuse inputs
            </button>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(asset.version.prompt || "").then(() => {
                  setCopiedPrompt(true);
                  window.setTimeout(() => setCopiedPrompt(false), 1200);
                });
              }}
              className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-[12px] font-medium hover:bg-white/15"
            >
              <Copy className="h-3.5 w-3.5" strokeWidth={1.75} />
              {copiedPrompt ? "Copied" : "Copy prompt"}
            </button>
          </div>

          <p className="mt-4 text-[12px] text-white/45">
            {projectName} · {relativeAge(asset.createdAt)}
          </p>

          {prompts.length > 0 && (
            <div className="mt-6">
              <p className="text-[13px] text-white/70">Templates you might like</p>
              <div className="mt-2 flex flex-col gap-1">
                {prompts.slice(0, 3).map((prompt) => (
                  <button
                    key={prompt.id}
                    type="button"
                    onClick={() => onLoadPrompt(prompt)}
                    className="truncate rounded-lg px-2 py-1.5 text-left text-[12px] text-white/55 hover:bg-white/8 hover:text-white/80"
                  >
                    {prompt.title}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5 border-t border-white/10 p-3">
          {!isVideo && (
            <ActionButton label="Image to video" onClick={() => onReuse("image-to-video")}>
              <Clapperboard className="h-3.5 w-3.5" strokeWidth={1.75} />
            </ActionButton>
          )}
          {isVideo && onExtend && (
            <ActionButton label="Extend" onClick={onExtend}>
              <Clapperboard className="h-3.5 w-3.5" strokeWidth={1.75} />
            </ActionButton>
          )}
          {!isVideo && (
            <ActionButton label="Upscale" onClick={() => onReuse("upscale")}>
              <Maximize2 className="h-3.5 w-3.5" strokeWidth={1.75} />
            </ActionButton>
          )}
          {!isVideo && (
            <ActionButton label="Edit image" onClick={() => setEditChoice(true)}>
              <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} />
            </ActionButton>
          )}
          <ActionButton label="Similar" onClick={() => onReuse("similar")}>
            <Sparkles className="h-3.5 w-3.5" strokeWidth={1.75} />
          </ActionButton>
          <ActionButton
            label="More"
            onClick={(event) => setMenuAnchor(event.currentTarget.getBoundingClientRect())}
          >
            <MoreHorizontal className="h-3.5 w-3.5" strokeWidth={1.75} />
          </ActionButton>
        </div>
      </aside>

      {editChoice && (
        <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/60 p-6">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#161618] p-5 shadow-2xl">
            <p className="text-[16px] font-medium">Edit image</p>
            <p className="mt-1 text-[13px] text-white/55">
              Re-prompt loads this image into the composer. Paint a mask changes only what you describe.
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  setEditChoice(false);
                  onReuse("edit");
                }}
                className="rounded-xl bg-white/8 px-4 py-3 text-left hover:bg-white/12"
              >
                <span className="block text-[14px]">Re-prompt</span>
                <span className="mt-0.5 block text-[12px] text-white/50">
                  Load the original prompt and this image, then generate again.
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditChoice(false);
                  onPaintMask();
                }}
                className="rounded-xl bg-white px-4 py-3 text-left text-black hover:bg-white/90"
              >
                <span className="block text-[14px] font-medium">Paint a mask</span>
                <span className="mt-0.5 block text-[12px] text-black/60">
                  Paint roughly, describe the change, and attach a reference if you have one.
                </span>
              </button>
            </div>
            <button
              type="button"
              onClick={() => setEditChoice(false)}
              className="mt-3 text-[12px] text-white/50 hover:text-white"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

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
    </div>
  );
}

function ActionButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1.5 text-[12px] text-white/85 hover:bg-white/10"
    >
      {children}
      {label}
    </button>
  );
}
