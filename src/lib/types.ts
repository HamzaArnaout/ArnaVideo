export type AssetKind = "image" | "video" | "reference";
export type JobStatus =
  | "queued"
  | "running"
  | "retrying"
  | "succeeded"
  | "failed"
  | "cancelled";
export type Resolution = "1K" | "2K" | "4K";
/** Veo generate lengths (seconds). Extension adds ~7s separately. */
export type VideoDuration = 4 | 6 | 8;

export type Workspace = {
  id: string;
  name: string;
  planCode: string;
  creditBalance: number;
  apiBalanceUsd: number;
  totalSpentUsd: number;
};

export type Project = {
  id: string;
  workspaceId: string;
  name: string;
  visibility: "private" | "shared";
};

export type Folder = {
  id: string;
  projectId: string;
  parentFolderId: string | null;
  name: string;
};

export type Asset = {
  id: string;
  projectId: string;
  folderId: string | null;
  kind: AssetKind;
  name: string;
  favorite: boolean;
  currentVersionId: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

/** Reference image saved with a generation so Reuse inputs can restore it. */
export type StoredReference = {
  name: string;
  mimeType: string;
  url: string;
};

export type ReuseIntent = "reuse" | "similar" | "edit" | "upscale" | "image-to-video";

/** Composer snapshot restored by Reuse inputs and the detail-view actions. */
export type ReuseRecipe = {
  token: string;
  intent: ReuseIntent;
  prompt: string;
  negativePrompt?: string;
  modelId: string;
  aspectRatio: string;
  resolution: Resolution;
  outputCount: number;
  durationSeconds?: number;
  references: StoredReference[];
};

export type AssetVersion = {
  id: string;
  assetId: string;
  parentVersionId: string | null;
  width: number;
  height: number;
  mimeType: string;
  thumbnailUrl: string;
  previewUrl: string;
  masterUrl: string;
  prompt: string;
  negativePrompt?: string;
  /** How many images the composer was set to produce. */
  outputCount?: number;
  /** Original attachments used for this generation. */
  references?: StoredReference[];
  modelId: string;
  aspectRatio: string;
  resolution: Resolution;
  /** Clip length in seconds (generate: 4/6/8; extend: cumulative approx). */
  durationSeconds?: number;
  /** When this asset was produced by extending another clip. */
  extendedFromAssetId?: string;
  costUsd: number;
  costVerified: boolean;
  createdAt: string;
};

export type GenerationJob = {
  id: string;
  workspaceId: string;
  projectId: string;
  status: JobStatus;
  provider: string;
  modelId: string;
  prompt: string;
  negativePrompt?: string;
  aspectRatio: string;
  resolution: Resolution;
  outputCount: number;
  reservedCredits: number;
  estimatedCostUsd?: number;
  errorMessage?: string;
  assetIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type ModelCapability = {
  type: "image" | "video";
  resolutions: Resolution[];
  aspectRatios: string[];
  /** Allowed generate durations for video models. */
  durations?: VideoDuration[];
  /** Whether the model supports extending a prior Veo clip (~+7s). */
  videoExtension?: boolean;
  referenceImages: boolean;
  imageEditing: boolean;
  multiTurn: boolean;
  seed: boolean;
  nativeNegativePrompt: boolean;
  maxOutputCount: number;
};

export type ImageModel = {
  id: string;
  provider: string;
  label: string;
  description?: string;
  enabled: boolean;
  default?: boolean;
  pricingVerified: boolean;
  prices: Partial<Record<Resolution, number>>;
  creditCost: Partial<Record<Resolution, number>>;
  capabilities: ModelCapability;
};

export type PricingEstimate = {
  modelId: string;
  resolution: Resolution;
  count: number;
  durationSeconds?: number;
  /** USD per second for video models (Google bills /sec; we show full-clip total). */
  perSecondUsd?: number;
  estimatedTotal?: number;
  estimatedCredits: number;
  display: string;
  estimateOnly: boolean;
  generationAllowed: boolean;
  reason?: string;
  pricingVerified: boolean;
};

export type GalleryAsset = Asset & {
  version: AssetVersion;
};
