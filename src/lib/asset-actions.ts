import type { GalleryAsset } from "@/lib/types";

export function assetFileUrl(asset: GalleryAsset) {
  return asset.version.masterUrl || asset.version.previewUrl;
}

export function absoluteAssetUrl(asset: GalleryAsset) {
  return new URL(assetFileUrl(asset), window.location.origin).href;
}

export async function copyAssetLink(asset: GalleryAsset) {
  await navigator.clipboard.writeText(absoluteAssetUrl(asset));
}

export function openAssetTab(asset: GalleryAsset) {
  window.open(absoluteAssetUrl(asset), "_blank", "noopener,noreferrer");
}

export function downloadAsset(asset: GalleryAsset) {
  const url = assetFileUrl(asset);
  const anchor = document.createElement("a");
  anchor.href = url;
  const leaf = decodeURIComponent(url.split("/").pop() ?? "file");
  const ext = leaf.includes(".") ? leaf.split(".").pop() : "png";
  anchor.download = `${asset.name}.${ext}`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

export function relativeAge(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.max(0, Math.round(diff / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d`;
  return new Date(iso).toLocaleDateString();
}
