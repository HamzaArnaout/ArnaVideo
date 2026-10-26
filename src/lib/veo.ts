import { VEO_RESOLUTION_MAP } from "./models";
import { resolveGeminiApiKey } from "./settings";
import type { Resolution, VideoDuration } from "./types";
import { normalizeVideoDuration } from "./video-duration";

export type ReferenceImageInput = {
  mimeType: string;
  data: string; // base64 without data: prefix
  name?: string;
};

type VeoVideoRequest = {
  model: string;
  prompt: string;
  aspectRatio: string;
  resolution: Resolution;
  durationSeconds?: VideoDuration;
  negativePrompt?: string;
  /** Starting-frame / reference images (Veo accepts up to 3). */
  references?: ReferenceImageInput[];
  /** Prior Veo clip bytes for extension (~+7s). */
  sourceVideo?: { mimeType: string; data: string };
};

export type GeneratedVideoBytes = {
  buffer: Buffer;
  mimeType: string;
};

const BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
const POLL_MS = 10_000;
const MAX_WAIT_MS = 7 * 60_000;

function normalizeMime(mimeType: string) {
  const mime = mimeType.toLowerCase();
  if (mime === "image/jpg") return "image/jpeg";
  if (mime.startsWith("image/")) return mime;
  return "image/png";
}

/**
 * Veo predictLongRunning uses Vertex-style media objects, not Gemini inlineData.
 * { mimeType, bytesBase64Encoded }
 */
function toVeoImage(ref: ReferenceImageInput) {
  return {
    mimeType: normalizeMime(ref.mimeType),
    bytesBase64Encoded: ref.data,
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function supportsAssetReferences(model: string) {
  // Lite: image-to-video only (single starting frame). No multi-asset referenceImages.
  return !model.includes("lite");
}

function buildInstance(request: VeoVideoRequest) {
  const instance: Record<string, unknown> = {
    prompt: request.prompt.trim(),
  };

  if (request.sourceVideo?.data) {
    instance.video = {
      mimeType: request.sourceVideo.mimeType || "video/mp4",
      bytesBase64Encoded: request.sourceVideo.data,
    };
    return instance;
  }

  const refs = (request.references ?? []).slice(0, 3);
  if (refs.length === 0) return instance;

  if (refs.length === 1 || !supportsAssetReferences(request.model)) {
    // Image-to-video: animate the attached frame.
    instance.image = toVeoImage(refs[0]);
    return instance;
  }

  instance.referenceImages = refs.map((ref) => ({
    image: toVeoImage(ref),
    referenceType: "asset",
  }));
  return instance;
}

function buildParameters(request: VeoVideoRequest) {
  const extending = Boolean(request.sourceVideo?.data);
  const hasImageInput =
    Boolean(request.sourceVideo?.data) || (request.references?.length ?? 0) > 0;
  const veoRes = extending ? "720p" : VEO_RESOLUTION_MAP[request.resolution];
  const parameters: Record<string, unknown> = {
    aspectRatio: request.aspectRatio,
    resolution: veoRes,
  };

  // Image-to-video / extend: API only allows allow_adult (does not bypass likeness filter).
  if (hasImageInput) {
    parameters.personGeneration = "allow_adult";
  }

  if (extending) {
    parameters.numberOfVideos = 1;
  } else {
    const duration = normalizeVideoDuration(request.durationSeconds, {
      resolution: request.resolution,
      hasReferences: (request.references?.length ?? 0) > 0,
    });
    // Veo requires a JSON number, not a string.
    parameters.durationSeconds = duration;
  }

  // Lite rejects negativePrompt; only Fast / Standard accept it.
  if (
    request.negativePrompt?.trim() &&
    !request.model.includes("lite")
  ) {
    parameters.negativePrompt = request.negativePrompt.trim();
  }
  return parameters;
}

function formatVeoFilterError(reasons: string[]) {
  const joined = reasons.join("; ");
  if (/likeness|celebrity|prominent person/i.test(joined)) {
    return (
      "Google’s likeness filter blocked this (common false positive on photoreal AI faces). " +
      "Try: room-only reference without a clear face, lightly edit/blur the face, or animate the empty space first. " +
      "Rewording the prompt usually won’t help — the check is on the image."
    );
  }
  return `Veo blocked this generation: ${joined}`;
}

type LongRunningStart = {
  name?: string;
  error?: { message?: string };
};

type OperationStatus = {
  name?: string;
  done?: boolean;
  error?: { message?: string };
  response?: {
    generateVideoResponse?: {
      generatedSamples?: Array<{
        video?: { uri?: string };
      }>;
      raiMediaFilteredCount?: number;
      raiMediaFilteredReasons?: string[];
    };
  };
};

async function startOperation(
  apiKey: string,
  request: VeoVideoRequest,
): Promise<string> {
  const response = await fetch(
    `${BASE_URL}/models/${encodeURIComponent(request.model)}:predictLongRunning`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        instances: [buildInstance(request)],
        parameters: buildParameters(request),
      }),
      signal: AbortSignal.timeout(180_000),
    },
  );

  const data = (await response.json()) as LongRunningStart;
  if (!response.ok || data.error?.message) {
    throw new Error(
      data.error?.message ??
        `Veo failed to start (${response.status}): ${JSON.stringify(data)}`,
    );
  }
  if (!data.name) {
    throw new Error("Veo returned no operation name.");
  }
  return data.name;
}

async function pollOperation(apiKey: string, operationName: string): Promise<OperationStatus> {
  const started = Date.now();
  while (Date.now() - started < MAX_WAIT_MS) {
    const response = await fetch(`${BASE_URL}/${operationName}`, {
      headers: { "x-goog-api-key": apiKey },
      signal: AbortSignal.timeout(60_000),
    });
    const data = (await response.json()) as OperationStatus;
    if (!response.ok || data.error?.message) {
      throw new Error(
        data.error?.message ??
          `Veo poll failed (${response.status}): ${JSON.stringify(data)}`,
      );
    }
    if (data.done) return data;
    await sleep(POLL_MS);
  }
  throw new Error("Veo timed out waiting for the video. Try again in a quieter period.");
}

async function downloadVideo(apiKey: string, uri: string): Promise<GeneratedVideoBytes> {
  const response = await fetch(uri, {
    headers: { "x-goog-api-key": apiKey },
    redirect: "follow",
    signal: AbortSignal.timeout(180_000),
  });
  if (!response.ok) {
    throw new Error(`Failed to download Veo video (${response.status}).`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  const mimeType = response.headers.get("content-type") || "video/mp4";
  return { buffer, mimeType: mimeType.split(";")[0].trim() || "video/mp4" };
}

export async function generateVideo(
  request: VeoVideoRequest,
): Promise<GeneratedVideoBytes> {
  const apiKey = resolveGeminiApiKey();
  if (!apiKey) {
    throw new Error(
      "Gemini API key is not configured. Set GEMINI_API_KEY in .env and restart the app.",
    );
  }

  if (!request.prompt.trim()) {
    throw new Error("Prompt is required for video generation.");
  }

  const operationName = await startOperation(apiKey, request);
  const done = await pollOperation(apiKey, operationName);

  const filtered = done.response?.generateVideoResponse?.raiMediaFilteredReasons;
  if (filtered?.length) {
    throw new Error(formatVeoFilterError(filtered));
  }

  const uri =
    done.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri;
  if (!uri) {
    throw new Error("Veo returned no video. Try another model or simplify the prompt.");
  }

  return downloadVideo(apiKey, uri);
}
