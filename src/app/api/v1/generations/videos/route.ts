import { NextResponse } from "next/server";
import { getDefaultVideoModel, getVideoModel } from "@/lib/models";
import { estimateGeneration, unitCostUsd } from "@/lib/pricing";
import { deductApiSpend, readSettings, resolveGeminiApiKey } from "@/lib/settings";
import {
  createJob,
  getGalleryAsset,
  getProject,
  getWorkspace,
  persistReferences,
  readVideoAssetBytes,
  saveGeneratedVideos,
  updateJob,
} from "@/lib/store";
import type { Resolution, VideoDuration } from "@/lib/types";
import {
  normalizeVideoDuration,
  VIDEO_EXTEND_SECONDS,
} from "@/lib/video-duration";
import { generateVideo, type ReferenceImageInput } from "@/lib/veo";

export const maxDuration = 600;

const MAX_REFERENCES = 3;
const MAX_REF_BYTES = 8 * 1024 * 1024;

export async function POST(request: Request) {
  const body = (await request.json()) as {
    model?: string;
    prompt?: string;
    negativePrompt?: string;
    resolution?: Resolution;
    aspectRatio?: string;
    durationSeconds?: number;
    count?: number;
    batchCount?: number;
    references?: ReferenceImageInput[];
    extendFromAssetId?: string;
  };

  const prompt = body.prompt?.trim();
  const extending = Boolean(body.extendFromAssetId);
  let modelId = body.model;
  let resolution: Resolution = extending ? "1K" : (body.resolution ?? "1K");
  let aspectRatio = body.aspectRatio ?? "16:9";
  const references = extending
    ? []
    : (body.references ?? [])
        .filter((r) => r?.data && r?.mimeType?.startsWith("image/"))
        .slice(0, MAX_REFERENCES)
        .map((r) => ({
          name: r.name,
          mimeType: r.mimeType,
          data: r.data.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, ""),
        }));

  for (const ref of references) {
    const approxBytes = Math.ceil((ref.data.length * 3) / 4);
    if (approxBytes > MAX_REF_BYTES) {
      return NextResponse.json(
        { error: "A reference image is too large (max ~8MB each)." },
        { status: 400 },
      );
    }
  }

  if (!prompt || !modelId) {
    return NextResponse.json({ error: "Prompt and model are required" }, { status: 400 });
  }

  if (!resolveGeminiApiKey()) {
    return NextResponse.json(
      {
        error:
          "Gemini API key missing. Open Settings (gear icon) and add your key from Google AI Studio — Veo uses the same key as images.",
      },
      { status: 400 },
    );
  }

  let sourceVideo: { mimeType: string; data: string } | undefined;
  let sourceAsset = null as ReturnType<typeof getGalleryAsset>;
  if (extending && body.extendFromAssetId) {
    sourceAsset = getGalleryAsset(body.extendFromAssetId);
    if (!sourceAsset || sourceAsset.kind !== "video") {
      return NextResponse.json(
        { error: "Source clip not found. Pick a video from your gallery to extend." },
        { status: 400 },
      );
    }
    const bytes = readVideoAssetBytes(sourceAsset.id);
    if (!bytes) {
      return NextResponse.json(
        { error: "Could not read the source video file for extend." },
        { status: 400 },
      );
    }
    sourceVideo = bytes;
    aspectRatio = sourceAsset.version.aspectRatio || aspectRatio;
    // Prefer an extend-capable model; fall back to Fast if source was Lite.
    const preferred = getVideoModel(modelId);
    if (!preferred?.capabilities.videoExtension) {
      modelId =
        getVideoModel(sourceAsset.version.modelId)?.capabilities.videoExtension
          ? sourceAsset.version.modelId
          : (getDefaultVideoModel()?.id ?? modelId);
    }
    resolution = "1K";
  }

  const model = getVideoModel(modelId);
  if (!model?.enabled || model.capabilities.type !== "video") {
    return NextResponse.json({ error: "Model unavailable" }, { status: 400 });
  }

  if (model.provider !== "google") {
    return NextResponse.json(
      {
        error: `${model.label} is not connected yet. Use a Veo model for now.`,
      },
      { status: 501 },
    );
  }

  if (extending && !model.capabilities.videoExtension) {
    return NextResponse.json(
      { error: `${model.label} cannot extend clips. Use Veo 3.1 or Veo 3.1 Fast.` },
      { status: 400 },
    );
  }

  if (references.length > 0 && !model.capabilities.referenceImages) {
    return NextResponse.json(
      { error: `${model.label} does not support reference images.` },
      { status: 400 },
    );
  }

  if (!model.capabilities.resolutions.includes(resolution)) {
    return NextResponse.json(
      { error: `${model.label} does not support ${resolution}` },
      { status: 400 },
    );
  }

  if (!model.capabilities.aspectRatios.includes(aspectRatio)) {
    return NextResponse.json(
      { error: `${model.label} does not support aspect ratio ${aspectRatio}` },
      { status: 400 },
    );
  }

  const durationSeconds: VideoDuration = normalizeVideoDuration(body.durationSeconds, {
    resolution,
    hasReferences: references.length > 0,
    extending,
  });
  const billSeconds = extending ? VIDEO_EXTEND_SECONDS : durationSeconds;
  const savedDuration = extending
    ? (sourceAsset?.version.durationSeconds ?? 8) + VIDEO_EXTEND_SECONDS
    : durationSeconds;

  const settings = readSettings();
  const project = getProject();
  const estimate = estimateGeneration({
    modelId,
    resolution,
    count: 1,
    apiBalanceUsd: settings.apiBalanceUsd,
    durationSeconds,
    extending,
  });

  if (!estimate.generationAllowed) {
    return NextResponse.json(
      { error: estimate.reason ?? "Generation not allowed" },
      { status: 402 },
    );
  }

  const unit = unitCostUsd(modelId, resolution, {
    durationSeconds: billSeconds,
    extending,
  });
  const job = createJob({
    workspaceId: getWorkspace().id,
    projectId: project.id,
    provider: model.provider,
    modelId,
    prompt,
    negativePrompt: body.negativePrompt,
    aspectRatio,
    resolution,
    outputCount: Math.min(Math.max(body.batchCount ?? body.count ?? 1, 1), 4),
    reservedCredits: 0,
    estimatedCostUsd: estimate.estimatedTotal,
    status: "running",
  });

  try {
    const video = await generateVideo({
      model: modelId,
      prompt,
      negativePrompt: model.capabilities.nativeNegativePrompt
        ? body.negativePrompt
        : undefined,
      aspectRatio,
      resolution,
      durationSeconds,
      references,
      sourceVideo,
    });

    const totalCost = unit.amount;
    const updatedSettings = deductApiSpend(totalCost);

    const storedReferences = persistReferences(references);
    const assets = await saveGeneratedVideos({
      projectId: project.id,
      prompt,
      negativePrompt: body.negativePrompt,
      outputCount: Math.min(Math.max(body.batchCount ?? 1, 1), 4),
      references: storedReferences,
      modelId,
      aspectRatio,
      resolution,
      durationSeconds: savedDuration,
      extendedFromAssetId: body.extendFromAssetId,
      videos: [video],
      costUsdPerVideo: unit.amount,
      costVerified: unit.verified,
    });

    updateJob(job.id, {
      status: "succeeded",
      assetIds: assets.map((a) => a.id),
      estimatedCostUsd: totalCost,
    });

    return NextResponse.json({
      jobId: job.id,
      status: "succeeded",
      assets,
      costUsd: totalCost,
      costUsdPerVideo: unit.amount,
      costVerified: unit.verified,
      workspace: {
        ...getWorkspace(),
        apiBalanceUsd: updatedSettings.apiBalanceUsd,
        totalSpentUsd: updatedSettings.totalSpentUsd,
      },
      settings: {
        apiBalanceUsd: updatedSettings.apiBalanceUsd,
        totalSpentUsd: updatedSettings.totalSpentUsd,
      },
    });
  } catch (error) {
    updateJob(job.id, {
      status: "failed",
      errorMessage: error instanceof Error ? error.message : "Generation failed",
    });
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Generation failed",
        jobId: job.id,
        workspace: getWorkspace(),
      },
      { status: 500 },
    );
  }
}
