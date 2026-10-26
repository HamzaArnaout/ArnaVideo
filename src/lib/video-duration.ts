import type { Resolution, VideoDuration } from "./types";

export const VIDEO_DURATIONS: VideoDuration[] = [4, 6, 8];
/** Official Veo extension length billed / expected add-on. */
export const VIDEO_EXTEND_SECONDS = 7;
/** Prices in VIDEO_MODELS are listed for this baseline length. */
export const VIDEO_PRICE_BASE_SECONDS = 8;

/**
 * Veo forces 8s when using 1080p/4K or reference images.
 * Extension is always ~7s and must run at 720p (1K).
 */
export function allowedVideoDurations(input: {
  resolution: Resolution;
  hasReferences: boolean;
  extending?: boolean;
}): VideoDuration[] {
  if (input.extending) return [];
  if (input.resolution !== "1K" || input.hasReferences) return [8];
  return [...VIDEO_DURATIONS];
}

export function normalizeVideoDuration(
  duration: number | undefined,
  opts: { resolution: Resolution; hasReferences: boolean; extending?: boolean },
): VideoDuration {
  const allowed = allowedVideoDurations(opts);
  if (allowed.length === 0) return 8;
  if (duration === 4 || duration === 6 || duration === 8) {
    if (allowed.includes(duration)) return duration;
  }
  return allowed.includes(8) ? 8 : allowed[0];
}
