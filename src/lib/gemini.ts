import { resolveGeminiApiKey } from "./settings";

export type ReferenceImageInput = {
  mimeType: string;
  data: string; // base64 without data: prefix
  name?: string;
};

type GeminiImageRequest = {
  model: string;
  prompt: string;
  aspectRatio: string;
  imageSize: "1K" | "2K" | "4K";
  negativePrompt?: string;
  count: number;
  references?: ReferenceImageInput[];
  /** Send the prompt as written. Mask edits must not get the generic reference hint. */
  literalPrompt?: boolean;
};

export type GeneratedImageBytes = {
  buffer: Buffer;
  mimeType: string;
};

function compilePrompt(
  prompt: string,
  negativePrompt?: string,
  hasReferences?: boolean,
) {
  const parts = [prompt.trim()];
  if (hasReferences) {
    parts.push(
      "Use the attached reference image(s) as visual guidance for subject, style, composition, and details.",
    );
  }
  if (negativePrompt?.trim()) {
    parts.push(`Constraints: do not include ${negativePrompt.trim()}.`);
  }
  return parts.join("\n");
}

function normalizeMime(mimeType: string) {
  const mime = mimeType.toLowerCase();
  if (mime === "image/jpg") return "image/jpeg";
  if (mime.startsWith("image/")) return mime;
  return "image/png";
}

async function generateOne(
  apiKey: string,
  request: Omit<GeminiImageRequest, "count">,
): Promise<GeneratedImageBytes> {
  const references = (request.references ?? []).slice(0, 14);
  const parts: Array<Record<string, unknown>> = [
    {
      text: request.literalPrompt
        ? request.prompt.trim()
        : compilePrompt(
            request.prompt,
            request.negativePrompt,
            references.length > 0,
          ),
    },
    ...references.map((ref) => ({
      inlineData: {
        mimeType: normalizeMime(ref.mimeType),
        data: ref.data,
      },
    })),
  ];

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(request.model)}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: {
          responseModalities: ["TEXT", "IMAGE"],
          imageConfig: {
            aspectRatio: request.aspectRatio,
            imageSize: request.imageSize,
          },
        },
      }),
      signal: AbortSignal.timeout(180_000),
    },
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Gemini failed (${response.status}): ${body}`);
  }

  const data = (await response.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{
          inlineData?: { mimeType?: string; data?: string };
          inline_data?: { mime_type?: string; data?: string };
        }>;
      };
    }>;
    error?: { message?: string };
  };

  if (data.error?.message) {
    throw new Error(data.error.message);
  }

  for (const candidate of data.candidates ?? []) {
    for (const part of candidate.content?.parts ?? []) {
      const inline = part.inlineData ?? part.inline_data;
      if (!inline?.data) continue;
      const mime =
        ("mimeType" in inline && inline.mimeType) ||
        ("mime_type" in inline && inline.mime_type) ||
        "image/png";
      return { buffer: Buffer.from(inline.data, "base64"), mimeType: String(mime) };
    }
  }

  throw new Error("Gemini returned no image data. Try another model or simplify the prompt.");
}

export async function generateImages(
  request: GeminiImageRequest,
): Promise<GeneratedImageBytes[]> {
  const apiKey = resolveGeminiApiKey();
  if (!apiKey) {
    throw new Error(
      "Gemini API key is not configured. Set GEMINI_API_KEY in .env and restart the app.",
    );
  }

  const count = Math.min(Math.max(request.count, 1), 4);
  const results: GeneratedImageBytes[] = [];

  for (let i = 0; i < count; i += 1) {
    results.push(
      await generateOne(apiKey, {
        model: request.model,
        prompt: request.prompt,
        aspectRatio: request.aspectRatio,
        imageSize: request.imageSize,
        negativePrompt: request.negativePrompt,
        references: request.references,
        literalPrompt: request.literalPrompt,
      }),
    );
  }

  return results;
}
