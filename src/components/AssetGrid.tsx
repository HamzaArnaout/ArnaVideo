"use client";

import { AssetCard } from "./AssetCard";
import type { GalleryAsset, ReuseIntent } from "@/lib/types";

type Props = {
  assets: GalleryAsset[];
  selectedId: string | null;
  projectName: string;
  emptyMessage: string;
  onToggleSelect: (id: string) => void;
  onOpen: (asset: GalleryAsset) => void;
  onToggleFavorite: (id: string) => void;
  onReuse: (asset: GalleryAsset, intent: ReuseIntent) => void;
  onTrash: (id: string) => void;
  onCopyToProject: (id: string) => void;
};

export function AssetGrid({
  assets,
  selectedId,
  projectName,
  emptyMessage,
  onToggleSelect,
  onOpen,
  onToggleFavorite,
  onReuse,
  onTrash,
  onCopyToProject,
}: Props) {
  if (assets.length === 0) {
    return (
      <div className="flex min-h-[280px] items-center justify-center px-6 text-center text-[14px] text-fg-subtle">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2.5 px-5 pb-8 md:grid-cols-3 xl:grid-cols-4">
      {assets.map((asset) => (
        <AssetCard
          key={asset.id}
          asset={asset}
          selected={selectedId === asset.id}
          projectName={projectName}
          onToggleSelect={() => onToggleSelect(asset.id)}
          onOpen={() => onOpen(asset)}
          onToggleFavorite={() => onToggleFavorite(asset.id)}
          onReuse={(intent) => onReuse(asset, intent)}
          onTrash={() => onTrash(asset.id)}
          onCopyToProject={() => onCopyToProject(asset.id)}
        />
      ))}
    </div>
  );
}
