import { readFileSync } from "fs";
import { NextResponse } from "next/server";
import { generateImages, type ReferenceImageInput } from "@/lib/gemini";
import { compositeMaskedEdit, jpegReference } from "@/lib/mask-composite";
import { getModel } from "@/lib/models";
import { estimateGeneration, unitCostUsd } from "@/lib/pricing";
import { deductApiSpend, readSettings, resolveGeminiApiKey } from "@/lib/settings";
import {
  createJob,
  getGalleryAsset,
  getProject,
  getWorkspace,
  persistReferences,
  resolveMasterFile,
  saveGeneratedImages,
  updateJob,
} from "@/lib/store";
import type { Resolution, StoredReference } from "@/lib/types";

const MAX_REFERENCES = 14;
const MAX_REF_BYTES = 8 * 1024 * 1024;

export async function POST(request: Request) {
  const body = (await request.json()) as {
    model?: string;
    prompt?: string;
    negativePrompt?: string;
    resolution?: Resolution;
    aspectRatio?: string;
    count?: number;
    /** Composer output count, even when each request produces one image. */
    batchCount?: number;
    references?: ReferenceImageInput[];
    maskEdit?: {
      assetId?: string;
      maskData?: string;
      instruction?: string;
      references?: ReferenceImageInput[];
    };
  };

  const maskInstruction = body.maskEdit?.instruction?.trim();
  const maskAssetId = body.maskEdit?.assetId?.trim();
  const maskData = body.maskEdit?.maskData?.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, "");
  const isMaskEdit = Boolean(maskAssetId && maskData && maskInstruction);
  const prompt = isMaskEdit ? maskInstruction : body.prompt?.trim();
  const modelId = body.model;
  const resolution = body.resolution ?? "2K";
  const aspectRatio = body.aspectRatio ?? "16:9";
  const count = isMaskEdit ? 1 : Math.min(Math.max(body.count ?? 1, 1), 4);
  const outputCount = isMaskEdit ? 1 : Math.min(Math.max(body.batchCount ?? count, 1), 4);
  const references = (body.references ?? [])
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
          "Gemini API key missing. Open Settings (gear icon) and add your key from Google AI Studio.",
      },
      { status: 400 },
    );
  }

  const model = getModel(modelId);
  if (!model?.enabled) {
    return NextResponse.json({ error: "Model unavailable" }, { status: 400 });
  }

  if ((references.length > 0 || isMaskEdit) && !model.capabilities.referenceImages) {
    return NextResponse.json(
      {
        error: isMaskEdit
          ? `${model.label} cannot paint-edit an image.`
          : `${model.label} does not support reference images.`,
      },
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

  const settings = readSettings();
  const project = getProject();
  const estimate = estimateGeneration({
    modelId,
    resolution,
    count,
    apiBalanceUsd: settings.apiBalanceUsd,
  });

  if (!estimate.generationAllowed) {
    return NextResponse.json(
      { error: estimate.reason ?? "Generation not allowed" },
      { status: 402 },
    );
  }

  const unit = unitCostUsd(modelId, resolution);

  let maskOriginal: Buffer | null = null;
  let maskBuffer: Buffer | null = null;
  let maskSourceRef: StoredReference | undefined;
  let modelReferences = references;

  if (isMaskEdit && maskAssetId && maskData) {
    const source = getGalleryAsset(maskAssetId);
    const masterPath = resolveMasterFile(maskAssetId);
    if (!source || source.kind === "video" || !masterPath) {
      return NextResponse.json({ error: "Original image was not found." }, { status: 404 });
    }
    maskOriginal = readFileSync(masterPath);
    maskBuffer = Buffer.from(maskData, "base64");
    const sourceJpeg = await jpegReference(maskOriginal, 2048);
    const maskJpeg = await jpegReference(maskBuffer);
    const extraReferences = (body.maskEdit?.references ?? [])
      .filter((ref) => ref?.data && ref.mimeType?.startsWith("image/"))
      .slice(0, 6)
      .map((ref) => ({
        ...ref,
        data: ref.data.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, ""),
      }));
    for (const ref of extraReferences) {
      const approxBytes = Math.ceil((ref.data.length * 3) / 4);
      if (approxBytes > MAX_REF_BYTES) {
        return NextResponse.json(
          { error: "A reference image is too large (max ~8MB each)." },
          { status: 400 },
        );
      }
    }
    const extraJpegs = await Promise.all(
      extraReferences.map(async (ref, index) => ({
        name: ref.name?.trim() || `reference-${index + 1}.jpg`,
        mimeType: "image/jpeg",
        data: (await jpegReference(Buffer.from(ref.data, "base64"))).toString("base64"),
      })),
    );
    modelReferences = [
      { name: source.name, mimeType: "image/jpeg", data: sourceJpeg.toString("base64") },
      { name: "edit-mask.jpg", mimeType: "image/jpeg", data: maskJpeg.toString("base64") },
      ...extraJpegs,
    ];
    maskSourceRef = {
      name: source.name,
      mimeType: source.version.mimeType.startsWith("image/")
        ? source.version.mimeType
        : "image/jpeg",
      url: source.version.masterUrl,
    };
  }

  const job = createJob({
    workspaceId: getWorkspace().id,
    projectId: project.id,
    provider: model.provider,
    modelId,
    prompt,
    negativePrompt: body.negativePrompt,
    aspectRatio,
    resolution,
    outputCount,
    reservedCredits: 0,
    estimatedCostUsd: estimate.estimatedTotal,
    status: "running",
  });

  try {
    const images = await generateImages({
      model: modelId,
      prompt: isMaskEdit
        ? [
            "Image 1 is the finished photograph. Keep its camera, perspective, vanishing lines, architecture, furniture, people, lighting, materials, and framing.",
            "Image 2 is a rough paint mask. White is only the area you may look at. It is not a command to redraw everything inside it. Black must stay identical to the photograph.",
            modelReferences.length > 2
              ? "The remaining images are references, such as an unrendered model or a source photo. Use them only to understand the requested change. Do not replace the photograph with a reference, and do not copy a reference's camera, clay materials, or lighting."
              : "",
            "Change only the specific thing named in the instruction. If the paint also covers a person, a frame, furniture, or any other object the instruction does not mention, leave that object exactly as it is.",
            "The edit has to belong in the same space: continue existing lines, match perspective, and match the light, grain, and materials around it so it does not look pasted, redrawn, or composited.",
            `Instruction: ${prompt}`,
          ]
            .filter(Boolean)
            .join("\n")
        : prompt!,
      negativePrompt: isMaskEdit ? undefined : body.negativePrompt,
      aspectRatio,
      imageSize: resolution,
      count,
      references: modelReferences,
      literalPrompt: isMaskEdit,
    });

    const finished = maskOriginal && maskBuffer
      ? await Promise.all(
          images.map(async (image) => ({
            buffer: await compositeMaskedEdit({
              original: maskOriginal as Buffer,
              generated: image.buffer,
              mask: maskBuffer as Buffer,
            }),
            mimeType: "image/jpeg",
          })),
        )
      : images;

    const totalCost = unit.amount * finished.length;
    const updatedSettings = deductApiSpend(totalCost);

    const storedReferences = isMaskEdit
      ? [
          ...(maskSourceRef ? [maskSourceRef] : []),
          ...persistReferences(modelReferences.slice(2)),
        ]
      : persistReferences(references);
    const assets = await saveGeneratedImages({
      projectId: project.id,
      prompt,
      negativePrompt: body.negativePrompt,
      outputCount,
      references: storedReferences,
      modelId,
      aspectRatio,
      resolution,
      images: finished,
      costUsdPerImage: unit.amount,
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
      costUsdPerImage: unit.amount,
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
