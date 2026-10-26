import { existsSync, readFileSync, writeFileSync } from "fs";
import sharp from "sharp";
import { THUMB_MAX_EDGE, THUMB_QUALITY } from "./thumb-names";

export {
  THUMB_MAX_EDGE,
  THUMB_QUALITY,
  thumbFileName,
  isThumbFileName,
} from "./thumb-names";

export async function writeThumbFromBuffer(
  buffer: Buffer,
  thumbPath: string,
): Promise<{ width: number; height: number }> {
  const image = sharp(buffer, { failOn: "none" });
  const meta = await image.metadata();
  const resized = await image
    .rotate()
    .resize({
      width: THUMB_MAX_EDGE,
      height: THUMB_MAX_EDGE,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: THUMB_QUALITY, mozjpeg: true })
    .toBuffer({ resolveWithObject: true });

  writeFileSync(thumbPath, resized.data);
  return {
    width: meta.width ?? resized.info.width,
    height: meta.height ?? resized.info.height,
  };
}

/** Create a cached 720p JPEG next to the master if missing. */
export async function ensureThumbFile(
  masterPath: string,
  thumbPath: string,
): Promise<string | null> {
  if (existsSync(thumbPath)) return thumbPath;
  if (!existsSync(masterPath)) return null;
  try {
    await writeThumbFromBuffer(readFileSync(masterPath), thumbPath);
    return thumbPath;
  } catch {
    return null;
  }
}
