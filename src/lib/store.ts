import { randomUUID } from "crypto";
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "fs";
import path from "path";
import { getAppRoot } from "./app-root";
import { getAssetsDir, getVideoAssetsDir, readSettings } from "./settings";
import { thumbFileName } from "./thumb-names";
import type {
  Asset,
  AssetVersion,
  GalleryAsset,
  GenerationJob,
  Project,
  Resolution,
  StoredReference,
  Workspace,
} from "./types";

type LibraryFile = {
  workspace: Workspace;
  project: Project;
  assets: Asset[];
  versions: AssetVersion[];
  jobs: GenerationJob[];
};

function dataDir() {
  return path.join(getAppRoot(), "data");
}

function libraryPath() {
  return path.join(dataDir(), "library.json");
}

function ensureLibraryDir() {
  const dir = dataDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function seedEmpty(): LibraryFile {
  const settings = readSettings();
  return {
    workspace: {
      id: "ws_local",
      name: "Personal",
      planCode: "pro",
      creditBalance: 0,
      apiBalanceUsd: settings.apiBalanceUsd,
      totalSpentUsd: settings.totalSpentUsd,
    },
    project: {
      id: "prj_first",
      workspaceId: "ws_local",
      name: "First project",
      visibility: "private",
    },
    assets: [],
    versions: [],
    jobs: [],
  };
}

function readLibrary(): LibraryFile {
  ensureLibraryDir();
  if (!existsSync(libraryPath())) {
    const empty = seedEmpty();
    writeFileSync(libraryPath(), JSON.stringify(empty, null, 2), "utf8");
    return empty;
  }
  return JSON.parse(readFileSync(libraryPath(), "utf8")) as LibraryFile;
}

function writeLibrary(lib: LibraryFile) {
  ensureLibraryDir();
  writeFileSync(libraryPath(), JSON.stringify(lib, null, 2), "utf8");
}

function mediaUrl(assetId: string, fileName: string) {
  return `/api/v1/media/${assetId}/${encodeURIComponent(fileName)}`;
}

export function getWorkspace() {
  const lib = readLibrary();
  const settings = readSettings();
  return {
    ...lib.workspace,
    apiBalanceUsd: settings.apiBalanceUsd,
    totalSpentUsd: settings.totalSpentUsd,
  };
}

export function getProject() {
  return readLibrary().project;
}

export function listGalleryAssets(filter?: {
  favorites?: boolean;
  kind?: "image" | "video";
}): GalleryAsset[] {
  const lib = readLibrary();
  return lib.assets
    .filter((a) => !a.deletedAt)
    .filter((a) => (filter?.favorites ? a.favorite : true))
    .filter((a) => (filter?.kind ? a.kind === filter.kind : true))
    .map((asset) => {
      const version = lib.versions.find((v) => v.id === asset.currentVersionId);
      if (!version) return null;
      const thumb = mediaUrl(asset.id, thumbFileName(asset.id));
      const master = version.masterUrl || version.previewUrl || thumb;
      return {
        ...asset,
        version: {
          ...version,
          // Grid uses 720p thumbs; viewer uses master (full res).
          thumbnailUrl: thumb,
          previewUrl: thumb,
          masterUrl: master,
          costUsd: version.costUsd ?? 0,
          costVerified: version.costVerified ?? false,
        },
      };
    })
    .filter((a): a is GalleryAsset => a !== null)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function toggleFavorite(assetId: string) {
  const lib = readLibrary();
  const asset = lib.assets.find((a) => a.id === assetId);
  if (!asset) return null;
  asset.favorite = !asset.favorite;
  asset.updatedAt = new Date().toISOString();
  writeLibrary(lib);
  return asset;
}

export function reserveCredits(amount: number) {
  const lib = readLibrary();
  if (lib.workspace.creditBalance < amount) return false;
  lib.workspace.creditBalance -= amount;
  writeLibrary(lib);
  return true;
}

export function refundCredits(amount: number) {
  const lib = readLibrary();
  lib.workspace.creditBalance += amount;
  writeLibrary(lib);
}

export function createJob(
  input: Omit<GenerationJob, "id" | "createdAt" | "updatedAt" | "assetIds" | "status"> & {
    status?: GenerationJob["status"];
  },
): GenerationJob {
  const lib = readLibrary();
  const now = new Date().toISOString();
  const job: GenerationJob = {
    id: `job_${randomUUID().slice(0, 8)}`,
    status: input.status ?? "queued",
    assetIds: [],
    createdAt: now,
    updatedAt: now,
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    provider: input.provider,
    modelId: input.modelId,
    prompt: input.prompt,
    negativePrompt: input.negativePrompt,
    aspectRatio: input.aspectRatio,
    resolution: input.resolution,
    outputCount: input.outputCount,
    reservedCredits: input.reservedCredits,
    estimatedCostUsd: input.estimatedCostUsd,
    errorMessage: input.errorMessage,
  };
  lib.jobs.unshift(job);
  writeLibrary(lib);
  return job;
}

export function updateJob(jobId: string, patch: Partial<GenerationJob>) {
  const lib = readLibrary();
  const job = lib.jobs.find((j) => j.id === jobId);
  if (!job) return null;
  Object.assign(job, patch, { updatedAt: new Date().toISOString() });
  writeLibrary(lib);
  return job;
}

export function getJob(jobId: string) {
  return readLibrary().jobs.find((j) => j.id === jobId) ?? null;
}

export async function saveGeneratedImages(input: {
  projectId: string;
  prompt: string;
  negativePrompt?: string;
  outputCount?: number;
  references?: StoredReference[];
  modelId: string;
  aspectRatio: string;
  resolution: Resolution;
  images: Array<{ buffer: Buffer; mimeType: string }>;
  costUsdPerImage: number;
  costVerified: boolean;
}) {
  const lib = readLibrary();
  const now = new Date().toISOString();
  const assetsDir = getAssetsDir();
  const created: GalleryAsset[] = [];

  for (let index = 0; index < input.images.length; index += 1) {
    const image = input.images[index];
    const assetId = `ast_${randomUUID().slice(0, 10)}`;
    const versionId = `ver_${randomUUID().slice(0, 10)}`;
    const ext = image.mimeType.includes("jpeg") || image.mimeType.includes("jpg") ? "jpg" : "png";
    const fileName = `${assetId}.${ext}`;
    const filePath = path.join(assetsDir, fileName);
    writeFileSync(filePath, image.buffer);

    const thumbName = thumbFileName(assetId);
    const thumbPath = path.join(assetsDir, thumbName);
    let width = 0;
    let height = 0;
    try {
      const { writeThumbFromBuffer } = await import("./thumbs");
      const dims = await writeThumbFromBuffer(image.buffer, thumbPath);
      width = dims.width;
      height = dims.height;
    } catch {
      // Fall back to master if thumb generation fails
      writeFileSync(thumbPath, image.buffer);
    }

    const master = mediaUrl(assetId, fileName);
    const thumb = mediaUrl(assetId, thumbName);
    const asset: Asset = {
      id: assetId,
      projectId: input.projectId,
      folderId: null,
      kind: "image",
      name: `Generation ${lib.assets.length + index + 1}`,
      favorite: false,
      currentVersionId: versionId,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    const version: AssetVersion = {
      id: versionId,
      assetId,
      parentVersionId: null,
      width,
      height,
      mimeType: image.mimeType,
      thumbnailUrl: thumb,
      previewUrl: thumb,
      masterUrl: master,
      prompt: input.prompt,
      negativePrompt: input.negativePrompt?.trim() || undefined,
      outputCount: input.outputCount,
      references: input.references?.length ? input.references : undefined,
      modelId: input.modelId,
      aspectRatio: input.aspectRatio,
      resolution: input.resolution,
      costUsd: input.costUsdPerImage,
      costVerified: input.costVerified,
      createdAt: now,
    };

    lib.assets.unshift(asset);
    lib.versions.unshift(version);
    created.push({
      ...asset,
      version: {
        ...version,
        thumbnailUrl: thumb,
        previewUrl: thumb,
        masterUrl: master,
      },
    });
  }

  writeLibrary(lib);
  return created;
}

export function getGalleryAsset(assetId: string): GalleryAsset | null {
  const lib = readLibrary();
  const asset = lib.assets.find((a) => a.id === assetId && !a.deletedAt);
  if (!asset) return null;
  const version = lib.versions.find((v) => v.id === asset.currentVersionId);
  if (!version) return null;
  const thumb = mediaUrl(asset.id, thumbFileName(asset.id));
  const master = version.masterUrl || version.previewUrl || thumb;
  return {
    ...asset,
    version: {
      ...version,
      thumbnailUrl: asset.kind === "video" ? master : thumb,
      previewUrl: asset.kind === "video" ? master : thumb,
      masterUrl: master,
      costUsd: version.costUsd ?? 0,
      costVerified: version.costVerified ?? false,
    },
  };
}

/** Read a saved video master as base64 for Veo extend. */
export function readVideoAssetBytes(assetId: string): {
  mimeType: string;
  data: string;
} | null {
  const masterPath = resolveMasterFile(assetId);
  if (!masterPath || !/\.(mp4|webm|mov)$/i.test(masterPath)) return null;
  const buffer = readFileSync(/* turbopackIgnore: true */ masterPath);
  const lower = masterPath.toLowerCase();
  const mimeType = lower.endsWith(".webm") ? "video/webm" : "video/mp4";
  return { mimeType, data: buffer.toString("base64") };
}

export async function saveGeneratedVideos(input: {
  projectId: string;
  prompt: string;
  negativePrompt?: string;
  outputCount?: number;
  references?: StoredReference[];
  modelId: string;
  aspectRatio: string;
  resolution: Resolution;
  durationSeconds: number;
  extendedFromAssetId?: string;
  videos: Array<{ buffer: Buffer; mimeType: string }>;
  costUsdPerVideo: number;
  costVerified: boolean;
}) {
  const lib = readLibrary();
  const now = new Date().toISOString();
  const assetsDir = getVideoAssetsDir();
  const created: GalleryAsset[] = [];

  for (let index = 0; index < input.videos.length; index += 1) {
    const video = input.videos[index];
    const assetId = `ast_${randomUUID().slice(0, 10)}`;
    const versionId = `ver_${randomUUID().slice(0, 10)}`;
    const fileName = `${assetId}.mp4`;
    const filePath = path.join(assetsDir, fileName);
    writeFileSync(filePath, video.buffer);

    const master = mediaUrl(assetId, fileName);
    const [wStr, hStr] = input.aspectRatio.split(":");
    const w = Number(wStr) || 16;
    const h = Number(hStr) || 9;
    const longEdge =
      input.resolution === "4K" ? 3840 : input.resolution === "2K" ? 1920 : 1280;
    const width = w >= h ? longEdge : Math.round((longEdge * w) / h);
    const height = h > w ? longEdge : Math.round((longEdge * h) / w);
    const videoCount = lib.assets.filter((a) => a.kind === "video").length;
    const name = input.extendedFromAssetId
      ? `Extend ${videoCount + index + 1}`
      : `Video ${videoCount + index + 1}`;

    const asset: Asset = {
      id: assetId,
      projectId: input.projectId,
      folderId: null,
      kind: "video",
      name,
      favorite: false,
      currentVersionId: versionId,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    const version: AssetVersion = {
      id: versionId,
      assetId,
      parentVersionId: null,
      width,
      height,
      mimeType: video.mimeType || "video/mp4",
      thumbnailUrl: master,
      previewUrl: master,
      masterUrl: master,
      prompt: input.prompt,
      negativePrompt: input.negativePrompt?.trim() || undefined,
      outputCount: input.outputCount,
      references: input.references?.length ? input.references : undefined,
      modelId: input.modelId,
      aspectRatio: input.aspectRatio,
      resolution: input.resolution,
      durationSeconds: input.durationSeconds,
      extendedFromAssetId: input.extendedFromAssetId,
      costUsd: input.costUsdPerVideo,
      costVerified: input.costVerified,
      createdAt: now,
    };

    lib.assets.unshift(asset);
    lib.versions.unshift(version);
    created.push({
      ...asset,
      version: {
        ...version,
        thumbnailUrl: master,
        previewUrl: master,
        masterUrl: master,
      },
    });
  }

  writeLibrary(lib);
  return created;
}

export function resolveAssetFile(assetId: string, fileName: string) {
  for (const assetsDir of candidateAssetDirs()) {
    const filePath = path.resolve(assetsDir, fileName);
    const relative = path.relative(assetsDir, filePath);
    if (relative.startsWith("..") || path.isAbsolute(relative)) continue;
    if (!fileName.startsWith(assetId)) continue;
    if (existsSync(filePath)) return filePath;
  }
  return null;
}

/** Find the full-resolution master file for an asset (image or video). */
export function resolveMasterFile(assetId: string) {
  const candidates = [
    `${assetId}.mp4`,
    `${assetId}.webm`,
    `${assetId}.png`,
    `${assetId}.jpg`,
    `${assetId}.jpeg`,
    `${assetId}.webp`,
  ];
  for (const assetsDir of candidateAssetDirs()) {
    for (const name of candidates) {
      const filePath = path.join(assetsDir, name);
      if (existsSync(filePath)) return filePath;
    }
  }
  return null;
}

function referencesDir() {
  return path.join(getAppRoot(), "media", "references");
}

function extForMime(mimeType: string) {
  const mime = mimeType.toLowerCase();
  if (mime.includes("jpeg") || mime.includes("jpg")) return "jpg";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("gif")) return "gif";
  return "png";
}

/** Write reference images once so every output from the batch can point at them. */
export function persistReferences(
  refs: Array<{ mimeType: string; data: string; name?: string }>,
): StoredReference[] {
  if (refs.length === 0) return [];
  const dir = referencesDir();
  mkdirSync(dir, { recursive: true });
  return refs.map((ref) => {
    const id = `ref_${randomUUID().slice(0, 10)}`;
    const fileName = `${id}.${extForMime(ref.mimeType)}`;
    writeFileSync(path.join(dir, fileName), Buffer.from(ref.data, "base64"));
    return {
      name: ref.name?.trim() || fileName,
      mimeType: ref.mimeType,
      url: mediaUrl(id, fileName),
    };
  });
}

function candidateAssetDirs() {
  const dirs = [getAssetsDir(), getVideoAssetsDir(), referencesDir()];
  // Legacy locations from earlier path defaults
  const legacy = [
    path.join(process.cwd(), "pics", "assets"),
    path.join(process.cwd(), "media", "images", "assets"),
    path.join(process.cwd(), "media", "videos", "assets"),
    path.join(process.cwd(), "dist", "images", "assets"),
    path.join(process.cwd(), ".next", "media", "images", "assets"),
  ];
  for (const dir of legacy) {
    if (!dirs.includes(dir) && existsSync(/* turbopackIgnore: true */ dir)) dirs.push(dir);
  }
  return dirs;
}

export function duplicateAsset(assetId: string): GalleryAsset | null {
  const lib = readLibrary();
  const asset = lib.assets.find((a) => a.id === assetId && !a.deletedAt);
  if (!asset) return null;
  const version = lib.versions.find((v) => v.id === asset.currentVersionId);
  if (!version) return null;
  const now = new Date().toISOString();
  const newAssetId = `ast_${randomUUID().slice(0, 10)}`;
  const newVersionId = `ver_${randomUUID().slice(0, 10)}`;
  lib.assets.unshift({
    ...asset,
    id: newAssetId,
    name: `${asset.name} copy`,
    favorite: false,
    currentVersionId: newVersionId,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  });
  lib.versions.unshift({
    ...version,
    id: newVersionId,
    assetId: newAssetId,
    createdAt: now,
  });
  writeLibrary(lib);
  return getGalleryAsset(newAssetId);
}

export function deleteAsset(assetId: string) {
  const lib = readLibrary();
  const asset = lib.assets.find((a) => a.id === assetId);
  if (!asset) return false;
  asset.deletedAt = new Date().toISOString();
  const version = lib.versions.find((v) => v.id === asset.currentVersionId);
  if (version) {
    const fileName = version.masterUrl.split("/").pop();
    if (fileName) {
      for (const dir of candidateAssetDirs()) {
        const filePath = path.join(dir, decodeURIComponent(fileName));
        if (existsSync(filePath)) unlinkSync(filePath);
      }
    }
  }
  for (const dir of candidateAssetDirs()) {
    const thumbPath = path.join(dir, thumbFileName(assetId));
    if (existsSync(thumbPath)) unlinkSync(thumbPath);
  }
  writeLibrary(lib);
  return true;
}
