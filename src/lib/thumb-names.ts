/** Shared thumb naming — keep free of sharp so library listing stays light. */

/** Longest edge for gallery previews (~720p). */
export const THUMB_MAX_EDGE = 1280;
export const THUMB_QUALITY = 72;

export function thumbFileName(assetId: string) {
  return `${assetId}.thumb.jpg`;
}

export function isThumbFileName(fileName: string) {
  return fileName.toLowerCase().endsWith(".thumb.jpg");
}
