import type { ImageModel } from "./types";

const COMMON_RATIOS = [
  "1:1",
  "16:9",
  "9:16",
  "4:3",
  "3:4",
  "3:2",
  "2:3",
  "4:5",
  "5:4",
  "21:9",
];

const VEO_RATIOS = ["16:9", "9:16"];

/** App resolution → Veo API resolution (8s default duration). */
export const VEO_RESOLUTION_MAP = {
  "1K": "720p",
  "2K": "1080p",
  "4K": "4k",
} as const;

export const IMAGE_MODELS: ImageModel[] = [
  {
    id: "gemini-3-pro-image",
    provider: "google",
    label: "Nano Banana Pro",
    description: "Maximum quality — complex scenes, typography, brand consistency",
    enabled: true,
    default: false,
    pricingVerified: true,
    prices: { "1K": 0.134, "2K": 0.134, "4K": 0.24 },
    creditCost: { "1K": 12, "2K": 12, "4K": 22 },
    capabilities: {
      type: "image",
      resolutions: ["1K", "2K", "4K"],
      aspectRatios: COMMON_RATIOS,
      referenceImages: true,
      imageEditing: true,
      multiTurn: true,
      seed: false,
      nativeNegativePrompt: false,
      maxOutputCount: 4,
    },
  },
  {
    id: "gemini-nano-banana-2.1",
    provider: "google",
    label: "Nano Banana 2.1",
    description: "Recommended high-efficiency workhorse (1K / 2K / 4K)",
    enabled: true,
    default: true,
    pricingVerified: false,
    prices: {},
    creditCost: { "1K": 8, "2K": 10, "4K": 16 },
    capabilities: {
      type: "image",
      resolutions: ["1K", "2K", "4K"],
      aspectRatios: COMMON_RATIOS,
      referenceImages: true,
      imageEditing: true,
      multiTurn: true,
      seed: false,
      nativeNegativePrompt: false,
      maxOutputCount: 4,
    },
  },
  {
    id: "gemini-3.1-flash-image",
    provider: "google",
    label: "Nano Banana 2 (Flash)",
    description: "Fast production model with broad aspect ratios",
    enabled: true,
    pricingVerified: true,
    prices: { "1K": 0.067, "2K": 0.101, "4K": 0.151 },
    creditCost: { "1K": 6, "2K": 9, "4K": 14 },
    capabilities: {
      type: "image",
      resolutions: ["1K", "2K", "4K"],
      aspectRatios: [...COMMON_RATIOS, "1:4", "4:1", "1:8", "8:1"],
      referenceImages: true,
      imageEditing: true,
      multiTurn: true,
      seed: false,
      nativeNegativePrompt: false,
      maxOutputCount: 4,
    },
  },
  {
    id: "gemini-3.1-flash-lite-image",
    provider: "google",
    label: "Nano Banana 2 Lite",
    description: "Fastest / cheapest for high-volume 1K work",
    enabled: true,
    pricingVerified: true,
    prices: { "1K": 0.0336 },
    creditCost: { "1K": 3 },
    capabilities: {
      type: "image",
      resolutions: ["1K"],
      aspectRatios: COMMON_RATIOS,
      referenceImages: true,
      imageEditing: true,
      multiTurn: false,
      seed: false,
      nativeNegativePrompt: false,
      maxOutputCount: 4,
    },
  },
  {
    id: "gemini-2.5-flash-image",
    provider: "google",
    label: "Nano Banana (Legacy)",
    description: "Previous generation — prefer 2.1 / Flash when possible",
    enabled: true,
    pricingVerified: true,
    prices: { "1K": 0.039 },
    creditCost: { "1K": 4 },
    capabilities: {
      type: "image",
      resolutions: ["1K"],
      aspectRatios: ["1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3"],
      referenceImages: true,
      imageEditing: true,
      multiTurn: true,
      seed: false,
      nativeNegativePrompt: false,
      maxOutputCount: 4,
    },
  },
];

export function getModel(id: string) {
  return IMAGE_MODELS.find((m) => m.id === id) ?? getVideoModel(id);
}

export function getDefaultModel() {
  return IMAGE_MODELS.find((m) => m.default) ?? IMAGE_MODELS[0];
}

/**
 * Video models — Veo via Gemini API for now; Kling reserved for later.
 * `prices` = full-clip USD for an 8s video at that resolution (Google bills /sec;
 * the estimator scales to 4/6/8s or +~7s extend for the selection total).
 */
export const VIDEO_MODELS: ImageModel[] = [
  {
    id: "veo-3.1-fast-generate-preview",
    provider: "google",
    label: "Veo 3.1 Fast",
    description: "Recommended — fast video with audio; extendable",
    enabled: true,
    default: true,
    pricingVerified: true,
    prices: { "1K": 0.8, "2K": 0.96, "4K": 2.4 },
    creditCost: { "1K": 80, "2K": 96, "4K": 240 },
    capabilities: {
      type: "video",
      resolutions: ["1K", "2K", "4K"],
      aspectRatios: VEO_RATIOS,
      durations: [4, 6, 8],
      videoExtension: true,
      referenceImages: true,
      imageEditing: false,
      multiTurn: false,
      seed: false,
      nativeNegativePrompt: true,
      maxOutputCount: 1,
    },
  },
  {
    id: "veo-3.1-generate-preview",
    provider: "google",
    label: "Veo 3.1",
    description: "Highest quality cinematic video with audio; extendable",
    enabled: true,
    pricingVerified: true,
    prices: { "1K": 3.2, "2K": 3.2, "4K": 4.8 },
    creditCost: { "1K": 320, "2K": 320, "4K": 480 },
    capabilities: {
      type: "video",
      resolutions: ["1K", "2K", "4K"],
      aspectRatios: VEO_RATIOS,
      durations: [4, 6, 8],
      videoExtension: true,
      referenceImages: true,
      imageEditing: false,
      multiTurn: false,
      seed: false,
      nativeNegativePrompt: true,
      maxOutputCount: 1,
    },
  },
  {
    id: "veo-3.1-lite-generate-preview",
    provider: "google",
    label: "Veo 3.1 Lite",
    description: "Cheapest drafts — 720p/1080p; no negative prompt, extend, or multi-refs",
    enabled: true,
    pricingVerified: true,
    prices: { "1K": 0.4, "2K": 0.64 },
    creditCost: { "1K": 40, "2K": 64 },
    capabilities: {
      type: "video",
      resolutions: ["1K", "2K"],
      aspectRatios: VEO_RATIOS,
      durations: [4, 6, 8],
      videoExtension: false,
      // Single starting-frame image-to-video is supported; multi-asset refs are not.
      referenceImages: true,
      imageEditing: false,
      multiTurn: false,
      seed: false,
      nativeNegativePrompt: false,
      maxOutputCount: 1,
    },
  },
  {
    id: "kling-video-placeholder",
    provider: "kling",
    label: "Kling (coming soon)",
    description: "Save a Kling key in Settings — wiring comes next",
    enabled: false,
    pricingVerified: false,
    prices: {},
    creditCost: { "1K": 20, "2K": 20, "4K": 40 },
    capabilities: {
      type: "video",
      resolutions: ["1K", "2K"],
      aspectRatios: ["16:9", "9:16", "1:1"],
      durations: [4, 6, 8],
      videoExtension: false,
      referenceImages: true,
      imageEditing: false,
      multiTurn: false,
      seed: false,
      nativeNegativePrompt: false,
      maxOutputCount: 4,
    },
  },
];

export function getVideoModel(id: string) {
  return VIDEO_MODELS.find((m) => m.id === id);
}

export function getDefaultVideoModel() {
  return VIDEO_MODELS.find((m) => m.default && m.enabled) ?? VIDEO_MODELS.find((m) => m.enabled) ?? VIDEO_MODELS[0];
}
