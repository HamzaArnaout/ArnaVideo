import sharp, { type Sharp } from "sharp";

/** JPEG small enough to send as a Gemini reference. */
export async function jpegReference(buffer: Buffer, maxEdge = 1536) {
  return sharp(buffer, { failOn: "none" })
    .rotate()
    .resize({
      width: maxEdge,
      height: maxEdge,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: 86 })
    .toBuffer();
}

function smoothstep(edge0: number, edge1: number, value: number) {
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** Sharp's blur promotes a grey mask to RGB. Collapse it back to one channel. */
async function greyRaw(pipeline: Sharp, width: number, height: number) {
  const { data, info } = await pipeline.raw().toBuffer({ resolveWithObject: true });
  if (info.channels === 1 && data.length === width * height) return data;
  const out = Buffer.alloc(width * height);
  for (let i = 0; i < width * height; i += 1) {
    out[i] = data[i * info.channels] ?? 0;
  }
  return out;
}

/**
 * Keep the original photograph except where the user painted AND the edit
 * actually changed those pixels. Brush edges and untouched objects stay put.
 */
export async function compositeMaskedEdit(input: {
  original: Buffer;
  generated: Buffer;
  mask: Buffer;
}) {
  const base = sharp(input.original, { failOn: "none" }).rotate();
  const meta = await base.metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  if (!width || !height) {
    throw new Error("Could not read the original image.");
  }

  const minEdge = Math.min(width, height);
  const erode = Math.max(0.6, Math.min(18, minEdge * 0.006));
  const feather = Math.max(1.5, Math.min(42, minEdge * 0.014));

  const origRaw = await base.ensureAlpha().raw().toBuffer();
  const genRaw = await sharp(input.generated, { failOn: "none" })
    .rotate()
    .resize(width, height, { fit: "fill" })
    .ensureAlpha()
    .raw()
    .toBuffer();
  const binary = await sharp(input.mask, { failOn: "none" })
    .resize(width, height, { fit: "fill" })
    .greyscale()
    .threshold(16)
    .raw()
    .toBuffer();

  let painted = 0;
  for (let i = 0; i < binary.length; i += 1) {
    if (binary[i] > 16) painted += 1;
  }
  if (painted < Math.max(32, width * height * 0.001)) {
    throw new Error("Paint the area you want to change before generating.");
  }

  const eroded = await greyRaw(
    sharp(binary, { raw: { width, height, channels: 1 } }).blur(erode).threshold(210),
    width,
    height,
  );
  let erodedMass = 0;
  for (let i = 0; i < eroded.length; i += 1) erodedMass += eroded[i];
  const core = erodedMass < 255 * 48 ? binary : eroded;
  const soft = await greyRaw(
    sharp(core, { raw: { width, height, channels: 1 } }).blur(feather),
    width,
    height,
  );

  const out = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i += 1) {
    const paintedMix = soft[i] / 255;
    const offset = i * 4;
    const delta =
      Math.max(
        Math.abs(origRaw[offset] - genRaw[offset]),
        Math.abs(origRaw[offset + 1] - genRaw[offset + 1]),
        Math.abs(origRaw[offset + 2] - genRaw[offset + 2]),
      ) / 255;
    // Ignore tiny shifts. A person or frame brushed by accident stays original
    // when the edit did not actually change them.
    const mix = paintedMix * smoothstep(0.07, 0.2, delta);
    const keep = 1 - mix;
    out[offset] = Math.round(origRaw[offset] * keep + genRaw[offset] * mix);
    out[offset + 1] = Math.round(origRaw[offset + 1] * keep + genRaw[offset + 1] * mix);
    out[offset + 2] = Math.round(origRaw[offset + 2] * keep + genRaw[offset + 2] * mix);
    out[offset + 3] = 255;
  }

  return sharp(out, { raw: { width, height, channels: 4 } })
    .jpeg({ quality: 95, mozjpeg: true })
    .toBuffer();
}
