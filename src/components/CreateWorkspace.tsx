"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PrimarySidebar, type SidebarPrompt } from "@/components/PrimarySidebar";
import { TopBar } from "@/components/TopBar";
import { GenerateComposer, type MediaMode } from "@/components/GenerateComposer";
import { AssetGrid } from "@/components/AssetGrid";
import { AssetViewer } from "@/components/AssetViewer";
import { MaskEditor } from "@/components/MaskEditor";
import { SettingsDialog } from "@/components/SettingsDialog";
import {
  PromptEditorDialog,
  type PromptDraft,
} from "@/components/PromptEditorDialog";
import { ConfirmDeletePromptDialog } from "@/components/ConfirmDeletePromptDialog";
import {
  GeneratingGrid,
  type GeneratingSlot,
} from "@/components/GeneratingGrid";
import type {
  GalleryAsset,
  ImageModel,
  Project,
  Resolution,
  ReuseIntent,
  ReuseRecipe,
  Workspace,
} from "@/lib/types";

type SettingsView = {
  outputDir: string;
  videoOutputDir: string;
  billingUrl: string;
  hasGeminiApiKey: boolean;
  apiBalanceUsd: number;
  totalSpentUsd: number;
  defaultModelId: string;
  defaultAspectRatio: string;
  defaultResolution: "1K" | "2K" | "4K";
};

type LibraryResponse = {
  workspace: Workspace;
  project: Project;
  assets: GalleryAsset[];
  settings: SettingsView;
};

export function CreateWorkspace() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [assets, setAssets] = useState<GalleryAsset[]>([]);
  const [imageModels, setImageModels] = useState<ImageModel[]>([]);
  const [videoModels, setVideoModels] = useState<ImageModel[]>([]);
  const [settings, setSettings] = useState<SettingsView | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [viewer, setViewer] = useState<GalleryAsset | null>(null);
  const [maskTarget, setMaskTarget] = useState<GalleryAsset | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mediaMode, setMediaMode] = useState<MediaMode>("image");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [generatingSlots, setGeneratingSlots] = useState<GeneratingSlot[]>([]);
  const [extendSource, setExtendSource] = useState<GalleryAsset | null>(null);
  const [reuseRecipe, setReuseRecipe] = useState<ReuseRecipe | null>(null);
  const [prompts, setPrompts] = useState<SidebarPrompt[]>([]);
  const [activePromptId, setActivePromptId] = useState<string | null>(null);
  const [loadedPrompt, setLoadedPrompt] = useState<{
    id: string;
    body: string;
    negativePrompt?: string;
  } | null>(null);
  const [promptEditorOpen, setPromptEditorOpen] = useState(false);
  const [promptDraft, setPromptDraft] = useState<PromptDraft | null>(null);
  const [promptPendingDelete, setPromptPendingDelete] =
    useState<SidebarPrompt | null>(null);
  const [deletingPrompt, setDeletingPrompt] = useState(false);

  const loadPrompts = useCallback(async () => {
    const res = await fetch("/api/v1/prompts");
    if (!res.ok) throw new Error(`Prompts failed (${res.status})`);
    const data = (await res.json()) as { prompts: SidebarPrompt[] };
    setPrompts(data.prompts ?? []);
  }, []);

  const loadLibrary = useCallback(async (kind: MediaMode) => {
    const [libraryRes, modelsRes] = await Promise.all([
      fetch(`/api/v1/library?kind=${kind}`),
      fetch("/api/v1/models"),
    ]);
    if (!libraryRes.ok) throw new Error(`Library failed (${libraryRes.status})`);
    if (!modelsRes.ok) throw new Error(`Models failed (${modelsRes.status})`);
    const library = (await libraryRes.json()) as LibraryResponse;
    const modelsData = (await modelsRes.json()) as {
      models: ImageModel[];
      videoModels: ImageModel[];
    };
    if (!library.workspace || !library.project || !library.settings) {
      throw new Error("Library response was incomplete");
    }
    setWorkspace({
      ...library.workspace,
      apiBalanceUsd: library.settings.apiBalanceUsd,
      totalSpentUsd: library.settings.totalSpentUsd,
    });
    setProject(library.project);
    setAssets(library.assets ?? []);
    setSettings({
      ...library.settings,
      billingUrl: library.settings.billingUrl ?? "",
    });
    setImageModels((modelsData.models ?? []).filter((m) => m.enabled));
    setVideoModels((modelsData.videoModels ?? []).filter((m) => m.enabled));
    return library.settings;
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        setLoadError(null);
        const [s] = await Promise.all([loadLibrary("image"), loadPrompts()]);
        if (!s.hasGeminiApiKey) setSettingsOpen(true);
      } catch (err) {
        console.error(err);
        setLoadError(err instanceof Error ? err.message : "Failed to load workspace");
      } finally {
        setLoading(false);
      }
    })();
  }, [loadLibrary, loadPrompts]);

  useEffect(() => {
    if (loading) return;
    void (async () => {
      const res = await fetch(`/api/v1/library?kind=${mediaMode}`);
      const data = (await res.json()) as LibraryResponse;
      setAssets(data.assets);
      setSelectedId(null);
      setGeneratingSlots([]);
      if (mediaMode !== "video") setExtendSource(null);
    })();
  }, [mediaMode, loading]);

  const beginExtend = useCallback((asset: GalleryAsset) => {
    setMediaMode("video");
    setExtendSource(asset);
    setReuseRecipe(null);
    setViewer(null);
    setSelectedId(asset.id);
  }, []);

  const beginReuse = useCallback((asset: GalleryAsset, intent: ReuseIntent = "reuse") => {
    const version = asset.version;
    const outputImage = {
      name: `${asset.name}.png`,
      mimeType: version.mimeType.startsWith("image/") ? version.mimeType : "image/jpeg",
      url: version.masterUrl || version.previewUrl,
    };
    const keepOriginal = intent === "reuse" || intent === "similar";
    const mode = intent === "image-to-video" ? "video" : intent === "edit" || intent === "upscale" ? "image" : asset.kind === "video" ? "video" : "image";
    const resolution: Resolution =
      intent === "upscale"
        ? version.resolution === "1K"
          ? "2K"
          : "4K"
        : intent === "image-to-video"
          ? "1K"
          : version.resolution;
    setExtendSource(null);
    setViewer(null);
    setMediaMode(mode);
    setReuseRecipe({
      token: `${asset.id}:${intent}:${Date.now()}`,
      intent,
      prompt: version.prompt,
      negativePrompt: version.negativePrompt,
      modelId: version.modelId,
      aspectRatio: version.aspectRatio,
      resolution,
      outputCount: intent === "image-to-video" ? 1 : version.outputCount ?? 1,
      durationSeconds: version.durationSeconds,
      references: keepOriginal ? (version.references ?? []) : [outputImage],
    });
  }, []);

  const trashAsset = useCallback(async (assetId: string) => {
    setAssets((prev) => prev.filter((asset) => asset.id !== assetId));
    setViewer((current) => (current?.id === assetId ? null : current));
    setSelectedId((current) => (current === assetId ? null : current));
    try {
      await fetch(`/api/v1/assets/${assetId}`, { method: "DELETE" });
    } catch {
      // The card is already gone; a refresh will reconcile if the delete failed.
    }
  }, []);

  const copyAssetToProject = useCallback(async (assetId: string) => {
    const response = await fetch(`/api/v1/assets/${assetId}/duplicate`, { method: "POST" });
    if (!response.ok) return;
    const data = (await response.json()) as { asset?: GalleryAsset };
    if (!data.asset) return;
    setAssets((prev) => [data.asset as GalleryAsset, ...prev]);
  }, []);

  const activeModels = mediaMode === "video" ? videoModels : imageModels;

  const visibleAssets = useMemo(() => {
    if (favoritesOnly) return assets.filter((a) => a.favorite);
    return assets;
  }, [assets, favoritesOnly]);

  const disabledReason = useMemo(() => {
    if (!settings) return "Loading…";
    if (!settings.hasGeminiApiKey) {
      return mediaMode === "video"
        ? "Set GEMINI_API_KEY in .env and restart to enable Veo video generation."
        : "Set GEMINI_API_KEY in .env and restart before generating.";
    }
    return null;
  }, [mediaMode, settings]);

  const emptyMessage = favoritesOnly
    ? "No favorites yet. Heart an image in the gallery to see it here."
    : mediaMode === "video"
      ? settings?.hasGeminiApiKey
        ? generatingSlots.length > 0
          ? "Generating…"
          : "Generate your first video with Veo — results appear in your video output folder."
        : "Set GEMINI_API_KEY in .env and restart to generate videos with Veo."
      : settings?.hasGeminiApiKey
        ? generatingSlots.length > 0
          ? "Generating…"
          : "Generate your first image — results appear here from your output folder."
        : "Set GEMINI_API_KEY in .env, restart the app, then generate an image.";

  const onToggleFavorite = useCallback(async (assetId: string) => {
    setAssets((prev) =>
      prev.map((a) => (a.id === assetId ? { ...a, favorite: !a.favorite } : a)),
    );
    try {
      await fetch(`/api/v1/assets/${assetId}/favorite`, { method: "POST" });
    } catch {
      setAssets((prev) =>
        prev.map((a) => (a.id === assetId ? { ...a, favorite: !a.favorite } : a)),
      );
    }
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-canvas text-fg-muted">
        Loading workspace…
      </div>
    );
  }

  if (loadError || !workspace || !project || !settings) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-canvas px-6 text-center">
        <p className="text-fg-muted">{loadError ?? "Workspace data missing."}</p>
        <button
          type="button"
          className="rounded-xl bg-accent px-3.5 py-2 text-[13px] font-medium text-white hover:bg-accent-hover"
          onClick={() => window.location.reload()}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-canvas">
      <PrimarySidebar
        mediaMode={mediaMode}
        onMediaModeChange={setMediaMode}
        prompts={prompts}
        activePromptId={activePromptId}
        onLoadPrompt={(prompt) => {
          setActivePromptId(prompt.id);
          setLoadedPrompt({
            id: `${prompt.id}:${Date.now()}`,
            body: prompt.body,
            negativePrompt: prompt.negativePrompt,
          });
        }}
        onAddPrompt={() => {
          setPromptDraft({ title: "", body: "", negativePrompt: "" });
          setPromptEditorOpen(true);
        }}
        onEditPrompt={(prompt) => {
          setPromptDraft({
            id: prompt.id,
            title: prompt.title,
            body: prompt.body,
            negativePrompt: prompt.negativePrompt,
          });
          setPromptEditorOpen(true);
        }}
        onDeletePrompt={(prompt) => {
          setPromptPendingDelete(prompt);
        }}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          projectName={project.name}
          apiBalanceUsd={settings.apiBalanceUsd}
          billingUrl={settings.billingUrl}
          title={mediaMode === "video" ? "Create video" : "Create image"}
          favoritesOnly={favoritesOnly}
          onToggleFavorites={() => setFavoritesOnly((v) => !v)}
          onOpenSettings={() => setSettingsOpen(true)}
        />

        <main className="flex-1 overflow-y-auto scrollbar-thin">
          <div className="bg-canvas pb-4 pt-2">
            <GenerateComposer
              mediaMode={mediaMode}
              onMediaModeChange={(mode) => {
                setMediaMode(mode);
                if (mode !== "video") setExtendSource(null);
              }}
              models={activeModels}
              defaults={{
                modelId:
                  mediaMode === "video"
                    ? activeModels.find((m) => m.default)?.id
                    : settings.defaultModelId,
                aspectRatio: settings.defaultAspectRatio,
                resolution: settings.defaultResolution,
              }}
              disabledReason={disabledReason}
              loadedPrompt={loadedPrompt}
              extendSource={extendSource}
              reuseRecipe={reuseRecipe}
              onClearExtend={() => setExtendSource(null)}
              onOpenSettings={() => setSettingsOpen(true)}
              onSlotsChange={setGeneratingSlots}
              onBalanceChange={(apiBalanceUsd, totalSpentUsd) => {
                setSettings((s) => (s ? { ...s, apiBalanceUsd, totalSpentUsd } : s));
                setWorkspace((ws) => (ws ? { ...ws, apiBalanceUsd, totalSpentUsd } : ws));
              }}
              onGenerated={(created) => {
                setAssets((prev) => [...created, ...prev]);
              }}
            />
          </div>

          <GeneratingGrid slots={generatingSlots} mediaMode={mediaMode} />

          <AssetGrid
            assets={visibleAssets}
            selectedId={selectedId}
            projectName={project.name}
            emptyMessage={emptyMessage}
            onToggleSelect={(id) => setSelectedId((current) => (current === id ? null : id))}
            onOpen={setViewer}
            onToggleFavorite={onToggleFavorite}
            onReuse={beginReuse}
            onTrash={(id) => void trashAsset(id)}
            onCopyToProject={(id) => void copyAssetToProject(id)}
          />
        </main>
      </div>

      {viewer && (
        <AssetViewer
          asset={viewer}
          related={assets.filter(
            (asset) => asset.id !== viewer.id && asset.version.prompt === viewer.version.prompt,
          )}
          projectName={project.name}
          modelLabel={
            [...imageModels, ...videoModels].find((model) => model.id === viewer.version.modelId)
              ?.label ?? viewer.version.modelId
          }
          prompts={prompts}
          selected={selectedId === viewer.id}
          onToggleSelect={() =>
            setSelectedId((current) => (current === viewer.id ? null : viewer.id))
          }
          onClose={() => setViewer(null)}
          onOpenAsset={setViewer}
          onToggleFavorite={() => onToggleFavorite(viewer.id)}
          onReuse={(intent) => beginReuse(viewer, intent)}
          onPaintMask={() => setMaskTarget(viewer)}
          onLoadPrompt={(prompt) => {
            setActivePromptId(prompt.id);
            setLoadedPrompt({
              id: `${prompt.id}:${Date.now()}`,
              body: prompt.body,
              negativePrompt: prompt.negativePrompt,
            });
            setViewer(null);
          }}
          onTrash={() => void trashAsset(viewer.id)}
          onCopyToProject={() => void copyAssetToProject(viewer.id)}
          onExtend={viewer.kind === "video" ? () => beginExtend(viewer) : undefined}
        />
      )}

      {maskTarget && (
        <MaskEditor
          asset={maskTarget}
          onClose={() => setMaskTarget(null)}
          onGenerated={(created) => {
            if (!created.length) return;
            setAssets((prev) => [...created, ...prev]);
            setMaskTarget(null);
            setViewer(created[0]);
          }}
          onBalanceChange={(apiBalanceUsd, totalSpentUsd) => {
            setSettings((s) => (s ? { ...s, apiBalanceUsd, totalSpentUsd } : s));
            setWorkspace((ws) => (ws ? { ...ws, apiBalanceUsd, totalSpentUsd } : ws));
          }}
        />
      )}

      <PromptEditorDialog
        open={promptEditorOpen}
        initial={promptDraft}
        onClose={() => {
          setPromptEditorOpen(false);
          setPromptDraft(null);
        }}
        onSaved={() => {
          void loadPrompts();
        }}
      />

      <ConfirmDeletePromptDialog
        open={Boolean(promptPendingDelete)}
        title={promptPendingDelete?.title ?? ""}
        confirming={deletingPrompt}
        onCancel={() => {
          if (deletingPrompt) return;
          setPromptPendingDelete(null);
        }}
        onConfirm={() => {
          if (!promptPendingDelete) return;
          void (async () => {
            setDeletingPrompt(true);
            try {
              await fetch(`/api/v1/prompts/${promptPendingDelete.id}`, {
                method: "DELETE",
              });
              if (activePromptId === promptPendingDelete.id) {
                setActivePromptId(null);
              }
              setPromptPendingDelete(null);
              await loadPrompts();
            } finally {
              setDeletingPrompt(false);
            }
          })();
        }}
      />

      <SettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onSaved={(next) => {
          setSettings(next);
          setWorkspace((ws) =>
            ws
              ? {
                  ...ws,
                  apiBalanceUsd: next.apiBalanceUsd,
                  totalSpentUsd: next.totalSpentUsd,
                }
              : ws,
          );
        }}
      />
    </div>
  );
}
