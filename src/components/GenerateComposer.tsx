"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  ChevronDown,
  Image as ImageIcon,
  Minus,
  Paperclip,
  Plus,
  Redo2,
  Video,
  X,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { money } from "@/lib/money";
import type {
  GalleryAsset,
  ImageModel,
  PricingEstimate,
  Resolution,
  ReuseRecipe,
  VideoDuration,
} from "@/lib/types";
import {
  allowedVideoDurations,
  normalizeVideoDuration,
  VIDEO_EXTEND_SECONDS,
} from "@/lib/video-duration";

export type MediaMode = "image" | "video";

type ReferenceItem = {
  id: string;
  name: string;
  mimeType: string;
  data: string;
  previewUrl: string;
};

type Props = {
  mediaMode: MediaMode;
  onMediaModeChange: (mode: MediaMode) => void;
  models: ImageModel[];
  defaults?: {
    modelId?: string;
    aspectRatio?: string;
    resolution?: Resolution;
  };
  disabledReason?: string | null;
  /** When set, replaces the composer prompt + negative (shared by image & video). */
  loadedPrompt?: { id: string; body: string; negativePrompt?: string } | null;
  /** Video clip to extend (~+7s via Veo). */
  extendSource?: GalleryAsset | null;
  /** Restores prompt, attachments, and the full generation setup. */
  reuseRecipe?: ReuseRecipe | null;
  onClearExtend?: () => void;
  onGenerated: (assets: GalleryAsset[]) => void;
  onBalanceChange: (apiBalanceUsd: number, totalSpentUsd: number) => void;
  onSlotsChange: (slots: import("./GeneratingGrid").GeneratingSlot[]) => void;
  onOpenSettings: () => void;
};

const MAX_IMAGE_REFERENCES = 8;
const MAX_VIDEO_REFERENCES = 3;

async function fileToReference(file: File): Promise<ReferenceItem> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
    reader.readAsDataURL(file);
  });

  const comma = dataUrl.indexOf(",");
  const meta = comma >= 0 ? dataUrl.slice(0, comma) : "";
  const data = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  const mimeFromMeta = meta.match(/data:([^;]+);/)?.[1];
  const mimeType = mimeFromMeta || file.type || "image/png";

  return {
    id: crypto.randomUUID(),
    name: file.name || "pasted-image",
    mimeType,
    data,
    previewUrl: dataUrl.startsWith("data:") ? dataUrl : `data:${mimeType};base64,${data}`,
  };
}

export function GenerateComposer({
  mediaMode,
  onMediaModeChange,
  models,
  defaults,
  disabledReason,
  loadedPrompt,
  extendSource,
  reuseRecipe,
  onClearExtend,
  onGenerated,
  onBalanceChange,
  onSlotsChange,
  onOpenSettings,
}: Props) {
  const extending = Boolean(extendSource);
  const enabledModels = useMemo(() => {
    const list = models.filter((m) => m.enabled);
    if (!extending) return list;
    return list.filter((m) => m.capabilities.videoExtension);
  }, [models, extending]);
  const initial =
    enabledModels.find((m) => m.id === defaults?.modelId) ??
    enabledModels.find((m) => m.default) ??
    enabledModels[0];

  const [prompt, setPrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [modelId, setModelId] = useState(initial?.id ?? "");
  const [aspectRatio, setAspectRatio] = useState(
    defaults?.aspectRatio ?? initial?.capabilities.aspectRatios[1] ?? "16:9",
  );
  const [resolution, setResolution] = useState<Resolution>(
    defaults?.resolution ?? "2K",
  );
  const [durationSeconds, setDurationSeconds] = useState<VideoDuration>(8);
  const [count, setCount] = useState(1);
  const [references, setReferences] = useState<ReferenceItem[]>([]);
  const [estimate, setEstimate] = useState<PricingEstimate | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [modeOpen, setModeOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  /** Shown when a loaded prompt sets a negative; clears once More tools is opened. */
  const [negativeNotice, setNegativeNotice] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [previewRef, setPreviewRef] = useState<ReferenceItem | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const modeRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLElement>(null);
  const progressTimers = useRef<Record<string, number>>({});
  const slotsRef = useRef<import("./GeneratingGrid").GeneratingSlot[]>([]);
  const lastLoadedPromptId = useRef<string | null>(null);
  const lastExtendId = useRef<string | null>(null);
  const appliedReuseToken = useRef<string | null>(null);
  const promptRef = useRef<HTMLTextAreaElement>(null);

  const model = enabledModels.find((m) => m.id === modelId) ?? initial;
  const maxReferences =
    mediaMode === "video" ? MAX_VIDEO_REFERENCES : MAX_IMAGE_REFERENCES;
  const durationChoices = allowedVideoDurations({
    resolution,
    hasReferences: references.length > 0,
    extending,
  });

  useEffect(() => {
    if (!loadedPrompt) return;
    if (lastLoadedPromptId.current === loadedPrompt.id) return;
    lastLoadedPromptId.current = loadedPrompt.id;
    setPrompt(loadedPrompt.body);
    const nextNegative = loadedPrompt.negativePrompt ?? "";
    setNegativePrompt(nextNegative);
    // Notify only when the template actually brings a negative prompt.
    setNegativeNotice(nextNegative.trim().length > 0);
    if (nextNegative.trim().length > 0) setMoreOpen(false);
  }, [loadedPrompt]);

  useEffect(() => {
    if (!extendSource) {
      lastExtendId.current = null;
      return;
    }
    if (lastExtendId.current === extendSource.id) return;
    lastExtendId.current = extendSource.id;
    setReferences([]);
    setResolution("1K");
    setAspectRatio(extendSource.version.aspectRatio || "16:9");
    setCount(1);
    const sourceModel = enabledModels.find(
      (m) => m.id === extendSource.version.modelId && m.capabilities.videoExtension,
    );
    setModelId(sourceModel?.id ?? enabledModels[0]?.id ?? modelId);
    if (!prompt.trim()) {
      setPrompt("Continue the same camera move smoothly, matching lighting and style.");
    }
    composerRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [extendSource, enabledModels]); // eslint-disable-line react-hooks/exhaustive-deps

  const setSlots = useCallback(
    (
      next:
        | import("./GeneratingGrid").GeneratingSlot[]
        | ((
            prev: import("./GeneratingGrid").GeneratingSlot[],
          ) => import("./GeneratingGrid").GeneratingSlot[]),
    ) => {
      const value = typeof next === "function" ? next(slotsRef.current) : next;
      slotsRef.current = value;
      onSlotsChange(value);
    },
    [onSlotsChange],
  );

  useEffect(() => {
    const next =
      enabledModels.find((m) => m.id === defaults?.modelId) ??
      enabledModels.find((m) => m.default) ??
      enabledModels[0];
    if (next) {
      setModelId(next.id);
      setAspectRatio(
        next.capabilities.aspectRatios.includes("16:9")
          ? "16:9"
          : next.capabilities.aspectRatios[0],
      );
      setResolution(
        next.capabilities.resolutions.includes("1K")
          ? "1K"
          : next.capabilities.resolutions[0],
      );
      setCount(1);
    }
    setReferences((prev) =>
      prev.slice(0, mediaMode === "video" ? MAX_VIDEO_REFERENCES : MAX_IMAGE_REFERENCES),
    );
    setSlots([]);
  }, [mediaMode]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!reuseRecipe || enabledModels.length === 0) return;
    const firstApply = appliedReuseToken.current !== reuseRecipe.token;
    if (firstApply) {
      appliedReuseToken.current = reuseRecipe.token;
      setPrompt(reuseRecipe.prompt);
      const nextNegative = reuseRecipe.negativePrompt ?? "";
      setNegativePrompt(nextNegative);
      setNegativeNotice(nextNegative.trim().length > 0);
      setMoreOpen(nextNegative.trim().length > 0);

      const matched =
        enabledModels.find((item) => item.id === reuseRecipe.modelId) ??
        enabledModels.find((item) => item.default) ??
        enabledModels[0];
      if (matched) setModelId(matched.id);

      const ratios = matched?.capabilities.aspectRatios ?? [];
      setAspectRatio(
        ratios.includes(reuseRecipe.aspectRatio)
          ? reuseRecipe.aspectRatio
          : (ratios[0] ?? reuseRecipe.aspectRatio),
      );

      const resolutions = matched?.capabilities.resolutions ?? [];
      const nextResolution = resolutions.includes(reuseRecipe.resolution)
        ? reuseRecipe.resolution
        : (resolutions[resolutions.length - 1] ?? reuseRecipe.resolution);
      setResolution(nextResolution);

      const maxCount = matched?.capabilities.maxOutputCount ?? 4;
      setCount(Math.min(Math.max(reuseRecipe.outputCount || 1, 1), maxCount));
      setDurationSeconds(
        normalizeVideoDuration(reuseRecipe.durationSeconds, {
          resolution: nextResolution,
          hasReferences: reuseRecipe.references.length > 0,
        }),
      );
      composerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      window.setTimeout(() => promptRef.current?.focus(), 60);
    }

    let cancelled = false;
    void (async () => {
      const loaded: ReferenceItem[] = [];
      for (const ref of reuseRecipe.references) {
        try {
          const response = await fetch(ref.url);
          if (!response.ok) continue;
          const blob = await response.blob();
          const file = new File([blob], ref.name || "reference", {
            type: ref.mimeType || blob.type || "image/png",
          });
          loaded.push(await fileToReference(file));
        } catch {
          // Skip a reference that can no longer be read.
        }
      }
      if (cancelled) return;
      const cap = mediaMode === "video" ? MAX_VIDEO_REFERENCES : MAX_IMAGE_REFERENCES;
      setReferences(loaded.slice(0, cap));
    })();

    return () => {
      cancelled = true;
    };
  }, [reuseRecipe, enabledModels, mediaMode]);

  const clearProgressTimer = useCallback((id: string) => {
    const timer = progressTimers.current[id];
    if (timer) {
      window.clearInterval(timer);
      delete progressTimers.current[id];
    }
  }, []);

  const startProgress = useCallback(
    (id: string) => {
      clearProgressTimer(id);
      setSlots((prev) =>
        prev.map((s) => (s.id === id ? { ...s, status: "running", progress: 5 } : s)),
      );
      progressTimers.current[id] = window.setInterval(() => {
        setSlots((prev) =>
          prev.map((s) => {
            if (s.id !== id || s.status !== "running") return s;
            const bump = 1.5 + Math.random() * 6;
            return { ...s, progress: Math.min(s.progress + bump, 92) };
          }),
        );
      }, 400);
    },
    [clearProgressTimer, setSlots],
  );

  useEffect(() => {
    return () => {
      Object.keys(progressTimers.current).forEach((id) => {
        window.clearInterval(progressTimers.current[id]);
      });
      progressTimers.current = {};
    };
  }, []);

  const addFiles = useCallback(async (files: FileList | File[]) => {
    const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (list.length === 0) {
      setError("Only image files can be attached as references.");
      return;
    }

    try {
      const converted = await Promise.all(list.map((f) => fileToReference(f)));
      setReferences((prev) => {
        const next = [...prev, ...converted].slice(0, maxReferences);
        if (prev.length + converted.length > maxReferences) {
          setError(`You can attach up to ${maxReferences} reference images.`);
        }
        return next;
      });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to attach image");
    }
  }, [maxReferences]);

  useEffect(() => {
    if (!model) return;
    if (extending) {
      if (resolution !== "1K") setResolution("1K");
      return;
    }
    if (!model.capabilities.resolutions.includes(resolution)) {
      setResolution(model.capabilities.resolutions[0]);
    }
    if (!model.capabilities.aspectRatios.includes(aspectRatio)) {
      setAspectRatio(model.capabilities.aspectRatios[0]);
    }
  }, [model, resolution, aspectRatio, extending]);

  useEffect(() => {
    if (mediaMode !== "video") return;
    const next = normalizeVideoDuration(durationSeconds, {
      resolution,
      hasReferences: references.length > 0,
      extending,
    });
    if (next !== durationSeconds) setDurationSeconds(next);
  }, [mediaMode, resolution, references.length, extending, durationSeconds]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!pickerRef.current?.contains(e.target as Node)) setPickerOpen(false);
      if (!modeRef.current?.contains(e.target as Node)) setModeOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  useEffect(() => {
    if (!modelId) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch("/api/v1/pricing/estimate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: modelId,
            resolution: extending ? "1K" : resolution,
            count,
            durationSeconds: mediaMode === "video" ? durationSeconds : undefined,
            extending: mediaMode === "video" && extending,
          }),
          signal: controller.signal,
        });
        if (!response.ok) return;
        setEstimate(await response.json());
      } catch (err) {
        if ((err as Error).name !== "AbortError") console.error(err);
      }
    }, 180);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [modelId, resolution, count, durationSeconds, mediaMode, extending]);

  async function generate() {
    if (!prompt.trim() || submitting) return;
    if (estimate?.generationAllowed === false) return;
    if (disabledReason) {
      setError(disabledReason);
      onOpenSettings();
      return;
    }
    setSubmitting(true);
    setError(null);

    const runCount = extending ? 1 : count;
    const batchId = crypto.randomUUID();
    const initialSlots = Array.from({ length: runCount }, (_, index) => ({
      id: `${batchId}-${index}`,
      index,
      progress: 0,
      status: "queued" as const,
    }));
    setSlots(initialSlots);

    const createdAll: GalleryAsset[] = [];

    try {
      for (let index = 0; index < runCount; index += 1) {
        const slotId = `${batchId}-${index}`;
        startProgress(slotId);

        try {
          const response = await fetch(
            mediaMode === "video"
              ? "/api/v1/generations/videos"
              : "/api/v1/generations/images",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Idempotency-Key": crypto.randomUUID(),
              },
              body: JSON.stringify({
                model: modelId,
                prompt,
                negativePrompt: negativePrompt.trim() || undefined,
                resolution: extending ? "1K" : resolution,
                aspectRatio,
                durationSeconds:
                  mediaMode === "video" && !extending ? durationSeconds : undefined,
                extendFromAssetId: extending ? extendSource?.id : undefined,
                count: 1,
                batchCount: runCount,
                references: extending
                  ? []
                  : references.map((r) => ({
                      name: r.name,
                      mimeType: r.mimeType,
                      data: r.data,
                    })),
              }),
            },
          );
          const data = await response.json();
          if (!response.ok) {
            throw new Error(data.error ?? "Generation failed");
          }

          clearProgressTimer(slotId);
          setSlots((prev) =>
            prev.map((s) =>
              s.id === slotId ? { ...s, status: "succeeded", progress: 100 } : s,
            ),
          );

          if (data.settings) {
            onBalanceChange(data.settings.apiBalanceUsd, data.settings.totalSpentUsd);
          } else if (data.workspace) {
            onBalanceChange(data.workspace.apiBalanceUsd, data.workspace.totalSpentUsd);
          }

          const assets = (data.assets ?? []) as GalleryAsset[];
          createdAll.push(...assets);
          onGenerated(assets);
          if (extending) onClearExtend?.();

          await new Promise((r) => window.setTimeout(r, 280));
          setSlots((prev) => prev.filter((s) => s.id !== slotId));
        } catch (err) {
          clearProgressTimer(slotId);
          const message = err instanceof Error ? err.message : "Generation failed";
          setSlots((prev) =>
            prev.map((s) =>
              s.id === slotId
                ? { ...s, status: "failed", progress: 100, error: message }
                : s,
            ),
          );
          setError(message);
          break;
        }
      }
    } finally {
      setSubmitting(false);
      window.setTimeout(() => {
        setSlots((prev) => prev.filter((s) => s.status === "failed"));
        window.setTimeout(() => setSlots([]), 4000);
      }, 500);
    }

    void createdAll;
  }

  function onPaste(e: React.ClipboardEvent) {
    const items = e.clipboardData?.items;
    if (!items?.length) return;

    // Clipboard often lists the same image twice (e.g. png + bitmap). Keep one.
    const imageFiles: File[] = [];
    const seen = new Set<string>();
    for (const item of Array.from(items)) {
      if (!item.type.startsWith("image/")) continue;
      const file = item.getAsFile();
      if (!file) continue;
      const key = `${file.type}:${file.size}:${file.lastModified}`;
      if (seen.has(key)) continue;
      seen.add(key);
      imageFiles.push(file);
    }

    if (imageFiles.length > 0) {
      e.preventDefault();
      e.stopPropagation();
      void addFiles(imageFiles);
    }
  }

  return (
    <>
    <section
      ref={composerRef}
      aria-label="Generate image"
      className="mx-auto w-full max-w-[760px] px-4"
      onPaste={onPaste}
    >
      <div
        className={cn(
          "rounded-[14px] border bg-surface-raised shadow-composer transition-colors",
          dragging ? "border-accent ring-2 ring-accent/30" : "border-border",
        )}
        onDragEnter={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (extending) return;
          if (e.dataTransfer.files?.length) void addFiles(e.dataTransfer.files);
        }}
      >
        {extending && extendSource && (
          <div className="flex items-center gap-3 border-b border-border-subtle px-4 py-3">
            <div className="relative h-12 w-16 shrink-0 overflow-hidden rounded-lg bg-surface">
              <video
                src={extendSource.version.masterUrl}
                muted
                playsInline
                preload="metadata"
                className="h-full w-full object-cover"
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 text-[13px] font-medium text-fg">
                <Redo2 className="h-3.5 w-3.5 text-accent" strokeWidth={1.75} />
                Extending {extendSource.name}
              </p>
              <p className="text-[11.5px] text-fg-subtle">
                Adds ~{VIDEO_EXTEND_SECONDS}s · locked to 720p · describe the next move
              </p>
            </div>
            <button
              type="button"
              onClick={() => onClearExtend?.()}
              className="rounded-lg px-2.5 py-1.5 text-[12px] text-fg-muted hover:bg-surface-hover hover:text-fg"
            >
              Cancel
            </button>
          </div>
        )}

        {references.length > 0 && !extending && (
          <div className="flex flex-wrap gap-2 border-b border-border-subtle px-4 pt-3">
            {references.map((ref) => (
              <div
                key={ref.id}
                className="group relative h-16 w-16 overflow-hidden rounded-lg border border-border bg-surface"
              >
                <button
                  type="button"
                  aria-label={`Preview ${ref.name}`}
                  onClick={() => setPreviewRef(ref)}
                  className="h-full w-full cursor-zoom-in"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={ref.previewUrl}
                    alt={ref.name}
                    className="h-full w-full object-cover"
                  />
                </button>
                <button
                  type="button"
                  aria-label={`Remove ${ref.name}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setReferences((prev) => prev.filter((item) => item.id !== ref.id));
                    setPreviewRef((cur) => (cur?.id === ref.id ? null : cur));
                  }}
                  className="absolute right-0.5 top-0.5 z-10 inline-flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-white opacity-90 hover:opacity-100"
                >
                  <X className="h-3 w-3" strokeWidth={2} />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="inline-flex h-16 w-16 items-center justify-center rounded-lg border border-dashed border-border text-fg-muted hover:border-fg-subtle hover:text-fg"
              aria-label="Add another reference"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        )}

        <div className="relative px-4 pt-4">
          <textarea
            ref={promptRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void generate();
              }
            }}
            placeholder={
              extending
                ? "How should the clip continue? e.g. keep drifting forward through the atrium…"
                : references.length > 0
                  ? mediaMode === "video"
                    ? "Describe how to use the reference image(s) for the video…"
                    : "Describe how to use the reference image(s)…"
                  : mediaMode === "video"
                    ? "What video do you want to create? (paste or attach a reference)"
                    : "What image do you want to create? (paste or attach a reference)"
            }
            aria-label="Prompt"
            rows={3}
            className="max-h-[50vh] min-h-[4.5rem] w-full resize-y bg-transparent pr-10 text-[15px] leading-6 text-fg placeholder:text-fg-subtle focus:outline-none"
          />
          {!extending && (
            <button
              type="button"
              aria-label="Attach reference"
              title="Attach reference image"
              onClick={() => fileRef.current?.click()}
              className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-lg text-fg-muted hover:bg-surface-hover hover:text-fg"
            >
              <Paperclip className="h-4 w-4" strokeWidth={1.75} />
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif,image/*"
            className="hidden"
            multiple
            onChange={(e) => {
              if (e.target.files?.length) void addFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>

        {dragging && (
          <p className="px-4 pb-2 text-[12px] text-accent">Drop reference images here</p>
        )}

        <div className="flex flex-wrap items-center gap-2 px-3 pb-3 pt-2">
          {!extending && (
            <button
              type="button"
              aria-label="Add reference image"
              onClick={() => fileRef.current?.click()}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border text-fg-muted hover:bg-surface-hover hover:text-fg"
            >
              <Plus className="h-4 w-4" strokeWidth={1.75} />
            </button>
          )}

          <div className="relative" ref={modeRef}>
            <button
              type="button"
              onClick={() => {
                setModeOpen((o) => !o);
                setPickerOpen(false);
              }}
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border bg-surface px-3 text-[12.5px] text-fg"
            >
              {mediaMode === "video" ? (
                <Video className="h-3.5 w-3.5" strokeWidth={1.75} />
              ) : (
                <ImageIcon className="h-3.5 w-3.5" strokeWidth={1.75} />
              )}
              {mediaMode === "video" ? "Video" : "Image"}
              {references.length > 0 && (
                <span className="rounded-full bg-accent/20 px-1.5 text-[11px] text-accent">
                  {references.length}
                </span>
              )}
              <ChevronDown className="h-3.5 w-3.5 text-fg-muted" strokeWidth={1.75} />
            </button>

            {modeOpen && (
              <div className="absolute left-0 top-[calc(100%+6px)] z-30 w-44 overflow-hidden rounded-xl border border-border bg-surface-raised shadow-composer">
                <button
                  type="button"
                  onClick={() => {
                    onMediaModeChange("image");
                    setModeOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-2.5 text-left text-[13px] hover:bg-surface-hover",
                    mediaMode === "image" && "bg-surface text-fg",
                    mediaMode !== "image" && "text-fg-muted",
                  )}
                >
                  <ImageIcon className="h-3.5 w-3.5" strokeWidth={1.75} />
                  Image
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onMediaModeChange("video");
                    setModeOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-2.5 text-left text-[13px] hover:bg-surface-hover",
                    mediaMode === "video" && "bg-surface text-fg",
                    mediaMode !== "video" && "text-fg-muted",
                  )}
                >
                  <Video className="h-3.5 w-3.5" strokeWidth={1.75} />
                  Video
                </button>
              </div>
            )}
          </div>

          <div className="relative" ref={pickerRef}>
            <button
              type="button"
              onClick={() => setPickerOpen((o) => !o)}
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border bg-surface px-3 text-[12.5px] text-fg"
            >
              <span>{model?.label ?? "Model"}</span>
              <span className="text-fg-subtle">•</span>
              <span>{aspectRatio}</span>
              <span className="text-fg-subtle">•</span>
              <span>{extending ? "720p" : resolution}</span>
              {mediaMode === "video" && (
                <>
                  <span className="text-fg-subtle">•</span>
                  <span>{extending ? `+${VIDEO_EXTEND_SECONDS}s` : `${durationSeconds}s`}</span>
                </>
              )}
              <ChevronDown className="h-3.5 w-3.5 text-fg-muted" strokeWidth={1.75} />
            </button>

            {pickerOpen && (
              <div className="absolute left-0 top-[calc(100%+6px)] z-30 w-[320px] overflow-hidden rounded-xl border border-border bg-surface-raised shadow-composer">
                <div className="border-b border-border-subtle px-3 py-2 text-[11px] uppercase tracking-wide text-fg-subtle">
                  {mediaMode === "video" ? "Video model" : "Image model"}
                </div>
                <div className="max-h-56 overflow-y-auto scrollbar-thin">
                  {enabledModels.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setModelId(m.id)}
                      className={cn(
                        "flex w-full flex-col gap-0.5 px-3 py-2.5 text-left hover:bg-surface-hover",
                        m.id === modelId && "bg-surface",
                      )}
                    >
                      <span className="text-[13px] text-fg">{m.label}</span>
                      <span className="text-[11px] text-fg-subtle">{m.description}</span>
                      <span className="text-[10px] text-fg-subtle">{m.id}</span>
                    </button>
                  ))}
                </div>

                <div className="border-t border-border-subtle px-3 py-2 text-[11px] uppercase tracking-wide text-fg-subtle">
                  Aspect ratio
                </div>
                <div className="grid grid-cols-4 gap-1 p-2">
                  {(model?.capabilities.aspectRatios ?? ["16:9"]).map((ratio) => (
                    <button
                      key={ratio}
                      type="button"
                      onClick={() => setAspectRatio(ratio)}
                      className={cn(
                        "rounded-lg px-2 py-1.5 text-[12px]",
                        ratio === aspectRatio
                          ? "bg-accent text-white"
                          : "bg-surface text-fg-muted hover:text-fg",
                      )}
                    >
                      {ratio}
                    </button>
                  ))}
                </div>

                <div className="border-t border-border-subtle px-3 py-2 text-[11px] uppercase tracking-wide text-fg-subtle">
                  Resolution
                  {extending && (
                    <span className="ml-2 normal-case tracking-normal text-fg-subtle">
                      (720p required to extend)
                    </span>
                  )}
                </div>
                <div className="flex gap-1 p-2">
                  {(extending ? (["1K"] as Resolution[]) : (model?.capabilities.resolutions ?? ["2K"])).map(
                    (res) => (
                      <button
                        key={res}
                        type="button"
                        disabled={extending && res !== "1K"}
                        onClick={() => setResolution(res)}
                        className={cn(
                          "rounded-lg px-2.5 py-1.5 text-[12px]",
                          (extending ? "1K" : resolution) === res
                            ? "bg-accent text-white"
                            : "bg-surface text-fg-muted hover:text-fg",
                          extending && res !== "1K" && "opacity-40",
                        )}
                      >
                        {res}
                        {mediaMode === "video" && res === "1K" ? " · 720p" : ""}
                        {mediaMode === "video" && res === "2K" ? " · 1080p" : ""}
                        {mediaMode === "video" && res === "4K" ? " · 4K" : ""}
                      </button>
                    ),
                  )}
                </div>

                {mediaMode === "video" && (
                  <>
                    <div className="border-t border-border-subtle px-3 py-2 text-[11px] uppercase tracking-wide text-fg-subtle">
                      Length
                      {extending ? (
                        <span className="ml-2 normal-case tracking-normal text-fg-subtle">
                          (~{VIDEO_EXTEND_SECONDS}s added)
                        </span>
                      ) : durationChoices.length === 1 ? (
                        <span className="ml-2 normal-case tracking-normal text-fg-subtle">
                          (8s required for 1080p/4K or refs)
                        </span>
                      ) : null}
                    </div>
                    <div className="flex gap-1 p-2">
                      {extending ? (
                        <span className="rounded-lg bg-accent px-2.5 py-1.5 text-[12px] text-white">
                          +~{VIDEO_EXTEND_SECONDS}s
                        </span>
                      ) : (
                        durationChoices.map((secs) => (
                          <button
                            key={secs}
                            type="button"
                            onClick={() => setDurationSeconds(secs)}
                            className={cn(
                              "rounded-lg px-2.5 py-1.5 text-[12px]",
                              secs === durationSeconds
                                ? "bg-accent text-white"
                                : "bg-surface text-fg-muted hover:text-fg",
                            )}
                          >
                            {secs}s
                          </button>
                        ))
                      )}
                    </div>
                  </>
                )}

                <div className="border-t border-border-subtle p-2">
                  <button
                    type="button"
                    onClick={() => setPickerOpen(false)}
                    className="w-full rounded-lg bg-surface py-2 text-[12.5px] text-fg hover:bg-surface-hover"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="ml-auto flex items-center gap-2">
            {!extending && (
              <div className="inline-flex h-8 items-center rounded-full border border-border bg-surface">
                <button
                  type="button"
                  aria-label="Decrease count"
                  disabled={count <= 1}
                  onClick={() => setCount((c) => Math.max(1, c - 1))}
                  className="inline-flex h-8 w-8 items-center justify-center text-fg-muted disabled:opacity-30"
                >
                  <Minus className="h-3.5 w-3.5" strokeWidth={1.75} />
                </button>
                <span className="min-w-5 text-center text-[12.5px] tabular-nums text-fg">
                  {count}
                </span>
                <button
                  type="button"
                  aria-label="Increase count"
                  disabled={count >= (model?.capabilities.maxOutputCount ?? 4)}
                  onClick={() =>
                    setCount((c) => Math.min(model?.capabilities.maxOutputCount ?? 4, c + 1))
                  }
                  className="inline-flex h-8 w-8 items-center justify-center text-fg-muted disabled:opacity-30"
                >
                  <Plus className="h-3.5 w-3.5" strokeWidth={1.75} />
                </button>
              </div>
            )}

            <button
              type="button"
              aria-label={extending ? "Extend clip" : "Generate"}
              title={estimate?.display}
              disabled={
                !prompt.trim() ||
                submitting ||
                estimate?.generationAllowed === false
              }
              onClick={() => void generate()}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-accent text-white transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
            >
              {submitting ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              ) : (
                <ArrowRight className="h-4 w-4" strokeWidth={2} />
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between gap-3 px-1">
        <button
          type="button"
          onClick={() => {
            setMoreOpen((o) => {
              const next = !o;
              if (next) setNegativeNotice(false);
              return next;
            });
          }}
          className="inline-flex items-center gap-1.5 text-[12.5px] text-fg-muted hover:text-fg"
        >
          More tools
          {negativeNotice && !moreOpen && (
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
            </span>
          )}
          <ChevronDown
            className={cn("h-3.5 w-3.5 transition", moreOpen && "rotate-180")}
            strokeWidth={1.75}
          />
        </button>
        <span
          className="text-[12px] text-fg-subtle"
          aria-live="polite"
          title={
            mediaMode === "video" && estimate?.perSecondUsd
              ? `Google bills ~${money.format(estimate.perSecondUsd)}/sec · shown total is for your full selection`
              : undefined
          }
        >
          {references.length > 0 && !extending
            ? `${references.length} reference${references.length === 1 ? "" : "s"} · ${estimate?.display ?? ""}`
            : (estimate?.display ?? "Calculating…")}
        </span>
      </div>

      {negativeNotice && !moreOpen && (
        <button
          type="button"
          onClick={() => {
            setMoreOpen(true);
            setNegativeNotice(false);
          }}
          className="mt-2 flex w-full items-start gap-2 rounded-xl border border-accent/30 bg-accent/10 px-3 py-2.5 text-left transition hover:bg-accent/15"
        >
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
          <span className="min-w-0">
            <span className="block text-[12.5px] font-medium text-fg">
              This prompt includes a negative prompt
            </span>
            <span className="mt-0.5 block text-[11.5px] text-fg-muted">
              Open More tools to view or edit it
            </span>
          </span>
        </button>
      )}

      {moreOpen && (
        <div className="mt-2 rounded-xl border border-border bg-surface-raised p-3">
          <label className="block">
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="text-[12px] text-fg-muted">Negative prompt</span>
              {negativePrompt.trim().length > 0 && (
                <button
                  type="button"
                  onClick={() => setNegativePrompt("")}
                  className="text-[11.5px] text-fg-muted hover:text-fg"
                >
                  Clear
                </button>
              )}
            </div>
            <textarea
              value={negativePrompt}
              onChange={(e) => setNegativePrompt(e.target.value)}
              rows={2}
              placeholder="Optional — things to avoid"
              className="w-full resize-none rounded-lg border border-border bg-surface px-3 py-2 text-[13px] text-fg placeholder:text-fg-subtle focus:outline-none"
            />
          </label>
          {mediaMode === "video" && model && !model.capabilities.nativeNegativePrompt && (
            <p className="mt-2 text-[11.5px] text-amber-400/90">
              {model.label} ignores negative prompts. Use Veo 3.1 or Fast to apply them.
            </p>
          )}
          <p className="mt-2 text-[11.5px] text-fg-subtle">
            Tip: click the paperclip, press Ctrl+V with an image copied, or drag images onto the
            prompt box.
          </p>
        </div>
      )}

      {(error || estimate?.reason || disabledReason) && (
        <p role="status" className="mt-2 px-1 text-[12.5px] text-red-400">
          {error ?? estimate?.reason ?? disabledReason}
          {disabledReason && (
            <>
              {" "}
              <button type="button" className="underline" onClick={onOpenSettings}>
                Open Settings
              </button>
            </>
          )}
        </p>
      )}
    </section>

    {previewRef && (
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Preview ${previewRef.name}`}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6"
        onClick={() => setPreviewRef(null)}
      >
        <button
          type="button"
          aria-label="Close preview"
          onClick={() => setPreviewRef(null)}
          className="absolute right-5 top-5 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
        >
          <X className="h-4 w-4" />
        </button>
        <div
          className="relative flex max-h-[90vh] max-w-[92vw] items-center justify-center"
          onClick={(e) => e.stopPropagation()}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewRef.previewUrl}
            alt={previewRef.name}
            className="max-h-[90vh] max-w-[92vw] rounded-xl object-contain shadow-2xl"
          />
        </div>
      </div>
    )}
    </>
  );
}
