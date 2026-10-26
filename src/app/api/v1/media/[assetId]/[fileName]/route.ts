import { readFileSync } from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { resolveAssetFile, resolveMasterFile } from "@/lib/store";
import { ensureThumbFile, isThumbFileName, thumbFileName } from "@/lib/thumbs";

type Params = { params: Promise<{ assetId: string; fileName: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { assetId, fileName: rawName } = await params;
  const fileName = decodeURIComponent(rawName);

  if (isThumbFileName(fileName) || fileName === thumbFileName(assetId)) {
    const masterPath = resolveMasterFile(assetId);
    if (!masterPath) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    // Videos use the master as preview; no JPEG thumb pipeline yet.
    if (/\.(mp4|webm|mov)$/i.test(masterPath)) {
      const buffer = readFileSync(masterPath);
      return new NextResponse(buffer, {
        headers: {
          "Content-Type": masterPath.toLowerCase().endsWith(".webm")
            ? "video/webm"
            : "video/mp4",
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    }
    // Keep thumbs next to the master file when possible
    const thumbPath = path.join(path.dirname(masterPath), thumbFileName(assetId));
    const ready = await ensureThumbFile(masterPath, thumbPath);
    if (!ready) {
      return NextResponse.json({ error: "Thumb unavailable" }, { status: 404 });
    }
    const buffer = readFileSync(ready);
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  }

  const filePath = resolveAssetFile(assetId, fileName);
  if (!filePath) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const buffer = readFileSync(filePath);
  const lower = fileName.toLowerCase();
  const contentType =
    lower.endsWith(".mp4") || lower.endsWith(".mov")
      ? "video/mp4"
      : lower.endsWith(".webm")
        ? "video/webm"
        : lower.endsWith(".jpg") || lower.endsWith(".jpeg")
          ? "image/jpeg"
          : lower.endsWith(".webp")
            ? "image/webp"
            : "image/png";

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
