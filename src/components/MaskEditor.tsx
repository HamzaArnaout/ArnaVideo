"use client";

import { useEffect, useRef, useState } from "react";
import { Eraser, ImagePlus, Paintbrush, RotateCcw, X } from "lucide-react";
import type { GalleryAsset } from "@/lib/types";

type Props = {
  asset: GalleryAsset;
  onClose: () => void;
  onGenerated: (assets: GalleryAsset[]) => void;
  onBalanceChange: (apiBalanceUsd: number, totalSpentUsd: number) => void;
};

const PAINT = "rgba(255, 64, 96, 0.5)";
const MAX_REFS = 6;

type LocalRef = {
  id: string;
  name: string;
  mimeType: string;
  data: string;
  previewUrl: string;
};

async function readReference(file: File): Promise<LocalRef> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
    reader.readAsDataURL(file);
  });
  const comma = dataUrl.indexOf(",");
  return {
    id: crypto.randomUUID(),
    name: file.name || "reference",
    mimeType: file.type || "image/png",
    data: comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl,
    previewUrl: dataUrl,
  };
}

export function MaskEditor({ asset, onClose, onGenerated, onBalanceChange }: Props) {
  const imgRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [brush, setBrush] = useState(42);
  const [erasing, setErasing] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [references, setReferences] = useState<LocalRef[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState<{ x: number; y: number; visible: boolean }>({
    x: 0,
    y: 0,
    visible: false,
  });
  const src = asset.version.masterUrl || asset.version.previewUrl;

  useEffect(() => {
    if (imgRef.current?.complete) syncCanvas();
  }, [src]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  function syncCanvas() {
    const img = imgRef.current;
    const canvas = canvasRef.current;
    if (!img || !canvas || !img.naturalWidth) return;
    const maxEdge = 1600;
    const scale = Math.min(1, maxEdge / Math.max(img.naturalWidth, img.naturalHeight));
    const width = Math.max(1, Math.round(img.naturalWidth * scale));
    const height = Math.max(1, Math.round(img.naturalHeight * scale));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
  }

  function point(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  function stamp(x: number, y: number, drag: boolean) {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = brush;
    ctx.strokeStyle = PAINT;
    ctx.fillStyle = PAINT;
    ctx.globalCompositeOperation = erasing ? "destination-out" : "source-over";
    ctx.beginPath();
    if (!drag || !last.current) {
      ctx.arc(x, y, brush / 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.moveTo(last.current.x, last.current.y);
      ctx.lineTo(x, y);
      ctx.stroke();
    }
    last.current = { x, y };
  }

  function exportMask() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return null;
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const mask = document.createElement("canvas");
    mask.width = canvas.width;
    mask.height = canvas.height;
    const maskCtx = mask.getContext("2d");
    if (!maskCtx) return null;
    const out = maskCtx.createImageData(canvas.width, canvas.height);
    let hits = 0;
    for (let i = 0; i < pixels.data.length; i += 4) {
      if (pixels.data[i + 3] > 16) {
        hits += 1;
        out.data[i] = 255;
        out.data[i + 1] = 255;
        out.data[i + 2] = 255;
        out.data[i + 3] = 255;
      }
    }
    if (hits < 24) return null;
    maskCtx.putImageData(out, 0, 0);
    const url = mask.toDataURL("image/png");
    const comma = url.indexOf(",");
    return comma >= 0 ? url.slice(comma + 1) : url;
  }

  async function generate() {
    const maskData = exportMask();
    if (!maskData) {
      setError("Paint the area you want to change.");
      return;
    }
    if (!instruction.trim()) {
      setError("Describe what should change inside the painted area.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/v1/generations/images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: asset.version.modelId,
          prompt: instruction.trim(),
          resolution: asset.version.resolution,
          aspectRatio: asset.version.aspectRatio,
          count: 1,
          batchCount: 1,
          maskEdit: {
            assetId: asset.id,
            maskData,
            instruction: instruction.trim(),
            references: references.map((ref) => ({
              name: ref.name,
              mimeType: ref.mimeType,
              data: ref.data,
            })),
          },
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Mask edit failed");
      }
      if (data.settings) {
        onBalanceChange(data.settings.apiBalanceUsd, data.settings.totalSpentUsd);
      }
      const created = (data.assets ?? []) as GalleryAsset[];
      if (!created.length) {
        throw new Error("No image came back.");
      }
      onGenerated(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Mask edit failed");
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex bg-[#0c0c0e] text-white">
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 px-4">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/10 disabled:opacity-40"
            aria-label="Close mask editor"
          >
            <X className="h-4 w-4" />
          </button>
          <p className="text-[14px] font-medium">Paint a mask</p>
          <p className="text-[12px] text-white/45">
            Paint roughly where to look. Only what you describe will change.
          </p>
        </header>
        <div className="flex min-h-0 flex-1 items-center justify-center px-6 pb-6">
          <div className="relative inline-block max-h-full max-w-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imgRef}
              src={src}
              alt=""
              onLoad={syncCanvas}
              className="block max-h-[calc(100vh-120px)] max-w-[calc(100vw-380px)] select-none"
              draggable={false}
            />
            <canvas
              ref={canvasRef}
              className="absolute inset-0 h-full w-full touch-none"
              style={{ cursor: "none" }}
              onPointerDown={(event) => {
                event.currentTarget.setPointerCapture(event.pointerId);
                drawing.current = true;
                const next = point(event);
                if (!next) return;
                stamp(next.x, next.y, false);
              }}
              onPointerMove={(event) => {
                const rect = event.currentTarget.getBoundingClientRect();
                setCursor({
                  x: event.clientX - rect.left,
                  y: event.clientY - rect.top,
                  visible: true,
                });
                if (!drawing.current) return;
                const next = point(event);
                if (!next) return;
                stamp(next.x, next.y, true);
              }}
              onPointerUp={() => {
                drawing.current = false;
                last.current = null;
              }}
              onPointerLeave={() => setCursor((current) => ({ ...current, visible: false }))}
            />
            {cursor.visible && (
              <span
                className="pointer-events-none absolute rounded-full border border-white/80"
                style={{
                  width: brush * ((canvasRef.current?.getBoundingClientRect().width ?? brush) / (canvasRef.current?.width || 1)),
                  height: brush * ((canvasRef.current?.getBoundingClientRect().height ?? brush) / (canvasRef.current?.height || 1)),
                  left: cursor.x,
                  top: cursor.y,
                  transform: "translate(-50%, -50%)",
                }}
              />
            )}
          </div>
        </div>
      </div>

      <aside className="flex w-[320px] shrink-0 flex-col overflow-y-auto border-l border-white/10 bg-[#121214] p-4">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setErasing(false)}
            className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-2 text-[13px] ${erasing ? "bg-white/10" : "bg-white text-black"}`}
          >
            <Paintbrush className="h-3.5 w-3.5" />
            Brush
          </button>
          <button
            type="button"
            onClick={() => setErasing(true)}
            className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-2 text-[13px] ${erasing ? "bg-white text-black" : "bg-white/10"}`}
          >
            <Eraser className="h-3.5 w-3.5" />
            Erase
          </button>
        </div>

        <label className="mt-4 block text-[12px] text-white/55">
          Brush size
          <input
            type="range"
            min={12}
            max={120}
            value={brush}
            onChange={(event) => setBrush(Number(event.target.value))}
            className="mt-2 w-full"
          />
        </label>

        <button
          type="button"
          onClick={() => canvasRef.current?.getContext("2d")?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)}
          className="mt-3 inline-flex items-center gap-1.5 text-[12px] text-white/60 hover:text-white"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Clear mask
        </button>

        <label className="mt-5 block text-[12px] text-white/55">
          What should change?
          <textarea
            value={instruction}
            onChange={(event) => setInstruction(event.target.value)}
            placeholder="Change only what's on the screen. Leave people, furniture, and the room as they are."
            className="mt-2 h-28 w-full resize-none rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-[13px] text-white outline-none placeholder:text-white/30"
          />
        </label>

        <div className="mt-4">
          <div className="flex items-center justify-between">
            <p className="text-[12px] text-white/55">Reference images</p>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={references.length >= MAX_REFS}
              className="inline-flex items-center gap-1 text-[12px] text-white/70 hover:text-white disabled:opacity-40"
            >
              <ImagePlus className="h-3.5 w-3.5" />
              Add
            </button>
          </div>
          <p className="mt-1 text-[11px] leading-4 text-white/35">
            Optional. Attach the SketchUp view or any source the change should follow.
          </p>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(event) => {
              const files = [...(event.target.files ?? [])];
              event.target.value = "";
              void (async () => {
                const next: LocalRef[] = [];
                for (const file of files) {
                  if (references.length + next.length >= MAX_REFS) break;
                  if (!file.type.startsWith("image/")) continue;
                  if (file.size > 8 * 1024 * 1024) {
                    setError(`${file.name} is over 8MB.`);
                    continue;
                  }
                  next.push(await readReference(file));
                }
                if (next.length) setReferences((current) => [...current, ...next].slice(0, MAX_REFS));
              })();
            }}
          />
          {references.length > 0 && (
            <ul className="mt-2 flex flex-col gap-1.5">
              {references.map((ref) => (
                <li key={ref.id} className="flex items-center gap-2 rounded-lg bg-white/5 px-2 py-1.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={ref.previewUrl} alt="" className="h-8 w-8 rounded object-cover" />
                  <span className="min-w-0 flex-1 truncate text-[12px]">{ref.name}</span>
                  <button
                    type="button"
                    aria-label={`Remove ${ref.name}`}
                    onClick={() => setReferences((current) => current.filter((item) => item.id !== ref.id))}
                    className="text-white/50 hover:text-white"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {error && <p className="mt-3 text-[12px] text-red-300">{error}</p>}

        <button
          type="button"
          disabled={busy}
          onClick={() => void generate()}
          className="mt-auto rounded-full bg-white px-4 py-2.5 text-[13px] font-medium text-black disabled:opacity-50"
        >
          {busy ? "Editing…" : "Generate edit"}
        </button>
      </aside>
    </div>
  );
}
