import { getModel } from "./models";
import { money } from "./money";
import type { PricingEstimate, Resolution } from "./types";
import {
  VIDEO_EXTEND_SECONDS,
  VIDEO_PRICE_BASE_SECONDS,
} from "./video-duration";

export { money };
/** Fallback estimates when Google has not published a verified row yet. */
const UNVERIFIED_FALLBACK: Partial<Record<Resolution, number>> = {
  "1K": 0.067,
  "2K": 0.101,
  "4K": 0.151,
};

function videoResLabel(resolution: Resolution) {
  if (resolution === "1K") return "720p";
  if (resolution === "2K") return "1080p";
  return "4K";
}

/**
 * Google Veo prices are per second. VIDEO_MODELS.prices store the cost of an
 * 8s clip at that resolution; we scale to the selected length for a full-clip total.
 */
export function unitCostUsd(
  modelId: string,
  resolution: Resolution,
  opts?: { durationSeconds?: number; extending?: boolean },
): {
  amount: number;
  perSecond: number;
  verified: boolean;
} {
  const model = getModel(modelId);
  if (!model) return { amount: 0, perSecond: 0, verified: false };
  const listed = model.prices[resolution];
  const verified = listed !== undefined ? model.pricingVerified : false;
  const base8s =
    listed !== undefined
      ? listed
      : (UNVERIFIED_FALLBACK[resolution] ?? 0.1);

  if (model.capabilities.type === "video") {
    const perSecond = base8s / VIDEO_PRICE_BASE_SECONDS;
    const seconds = opts?.extending
      ? VIDEO_EXTEND_SECONDS
      : (opts?.durationSeconds ?? VIDEO_PRICE_BASE_SECONDS);
    const amount = perSecond * seconds;
    return {
      amount: Math.round(amount * 1000) / 1000,
      perSecond: Math.round(perSecond * 1000) / 1000,
      verified,
    };
  }

  return { amount: base8s, perSecond: 0, verified };
}

function formatVideoDisplay(input: {
  total: number;
  verified: boolean;
  extending?: boolean;
  billSeconds: number;
  resolution: Resolution;
  count: number;
  perSecond: number;
}) {
  const unverified = input.verified ? "" : " (unverified)";
  const res = videoResLabel(input.resolution);
  const qty =
    input.count > 1
      ? ` × ${input.count}`
      : "";

  if (input.extending) {
    // Extend only bills the newly generated ~7s, not the whole resulting file.
    return `est. ${money.format(input.total)} for +~${input.billSeconds}s extend · ${res}${unverified}`;
  }

  // Full clip total for the selected length (not a per-second sticker price).
  return `est. ${money.format(input.total)} for ${input.billSeconds}s · ${res}${qty}${unverified}`;
}

export function estimateGeneration(input: {
  modelId: string;
  resolution: Resolution;
  count: number;
  apiBalanceUsd: number;
  durationSeconds?: number;
  extending?: boolean;
}): PricingEstimate {
  const model = getModel(input.modelId);
  if (!model || !model.enabled) {
    return {
      modelId: input.modelId,
      resolution: input.resolution,
      count: input.count,
      durationSeconds: input.durationSeconds,
      estimatedCredits: 0,
      display: "Unavailable",
      estimateOnly: true,
      generationAllowed: false,
      reason: "Selected model is unavailable.",
      pricingVerified: false,
    };
  }

  if (!model.capabilities.resolutions.includes(input.resolution)) {
    return {
      modelId: input.modelId,
      resolution: input.resolution,
      count: input.count,
      durationSeconds: input.durationSeconds,
      estimatedCredits: 0,
      display: "Unsupported",
      estimateOnly: true,
      generationAllowed: false,
      reason: `${model.label} does not support ${input.resolution}.`,
      pricingVerified: model.pricingVerified,
    };
  }

  if (input.extending && !model.capabilities.videoExtension) {
    return {
      modelId: input.modelId,
      resolution: input.resolution,
      count: input.count,
      durationSeconds: VIDEO_EXTEND_SECONDS,
      estimatedCredits: 0,
      display: "Unsupported",
      estimateOnly: true,
      generationAllowed: false,
      reason: `${model.label} cannot extend clips. Switch to Veo 3.1 or Fast.`,
      pricingVerified: model.pricingVerified,
    };
  }

  const isVideo = model.capabilities.type === "video";
  const billSeconds = isVideo
    ? input.extending
      ? VIDEO_EXTEND_SECONDS
      : (input.durationSeconds ?? VIDEO_PRICE_BASE_SECONDS)
    : undefined;

  const unit = unitCostUsd(input.modelId, input.resolution, {
    durationSeconds: billSeconds,
    extending: input.extending,
  });
  const estimatedTotal = unit.amount * input.count;
  const estimatedCredits = Math.round(estimatedTotal * 100);
  const generationAllowed = estimatedTotal <= input.apiBalanceUsd + 1e-9;

  const display = isVideo
    ? formatVideoDisplay({
        total: estimatedTotal,
        verified: unit.verified,
        extending: input.extending,
        billSeconds: billSeconds ?? VIDEO_PRICE_BASE_SECONDS,
        resolution: input.resolution,
        count: input.count,
        perSecond: unit.perSecond,
      })
    : unit.verified
      ? `est. ${money.format(estimatedTotal)}`
      : `est. ${money.format(estimatedTotal)} (unverified)`;

  return {
    modelId: input.modelId,
    resolution: input.resolution,
    count: input.count,
    durationSeconds: billSeconds,
    perSecondUsd: isVideo ? unit.perSecond : undefined,
    estimatedTotal,
    estimatedCredits,
    display,
    estimateOnly: !unit.verified,
    generationAllowed,
    reason: generationAllowed
      ? undefined
      : `Not enough API balance (need ${money.format(estimatedTotal)}, have ${money.format(input.apiBalanceUsd)}). Update balance in Settings.`,
    pricingVerified: unit.verified,
  };
}
