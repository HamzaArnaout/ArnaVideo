"use client";

import { useEffect, useState } from "react";
import { DollarSign, ExternalLink, FolderOpen, KeyRound, Video, X } from "lucide-react";

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

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: (settings: SettingsView) => void;
};

export function SettingsDialog({ open, onClose, onSaved }: Props) {
  const [outputDir, setOutputDir] = useState("");
  const [videoOutputDir, setVideoOutputDir] = useState("");
  const [billingUrl, setBillingUrl] = useState("");
  const [apiBalanceUsd, setApiBalanceUsd] = useState("0");
  const [totalSpentUsd, setTotalSpentUsd] = useState(0);
  const [hasKey, setHasKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [picking, setPicking] = useState<"image" | "video" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    void (async () => {
      const res = await fetch("/api/v1/settings");
      const data = await res.json();
      setOutputDir(data.settings.outputDir);
      setVideoOutputDir(data.settings.videoOutputDir ?? "");
      setBillingUrl(data.settings.billingUrl ?? "");
      setHasKey(data.settings.hasGeminiApiKey);
      setApiBalanceUsd(String(data.settings.apiBalanceUsd ?? 0));
      setTotalSpentUsd(data.settings.totalSpentUsd ?? 0);
      setMessage(null);
      setError(null);
    })();
  }, [open]);

  if (!open) return null;

  async function browseFolder(target: "image" | "video") {
    setPicking(target);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/v1/settings/pick-folder", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not open folder picker");
      if (!data.cancelled && data.path) {
        if (target === "image") setOutputDir(data.path);
        else setVideoOutputDir(data.path);
        setMessage("Folder selected. Click Save to keep it.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open folder picker");
    } finally {
      setPicking(null);
    }
  }

  async function save() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/v1/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outputDir,
          videoOutputDir,
          billingUrl,
          apiBalanceUsd,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save settings");
      onSaved(data.settings);
      setHasKey(data.settings.hasGeminiApiKey);
      setBillingUrl(data.settings.billingUrl ?? billingUrl);
      setApiBalanceUsd(String(data.settings.apiBalanceUsd ?? 0));
      setTotalSpentUsd(data.settings.totalSpentUsd ?? 0);
      setMessage("Settings saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-surface-raised p-5 shadow-composer scrollbar-thin"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[16px] font-semibold text-fg">Settings</h2>
          <button
            type="button"
            aria-label="Close settings"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-fg-muted hover:bg-surface-hover hover:text-fg"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-4 block">
          <span className="mb-1.5 flex items-center gap-1.5 text-[12.5px] text-fg-muted">
            <FolderOpen className="h-3.5 w-3.5" />
            Image output folder
          </span>
          <div className="flex gap-2">
            <input
              value={outputDir}
              onChange={(e) => setOutputDir(e.target.value)}
              className="min-w-0 flex-1 rounded-xl border border-border bg-surface px-3 py-2.5 text-[13.5px] text-fg focus:outline-none focus:ring-2 focus:ring-accent/50"
            />
            <button
              type="button"
              onClick={() => void browseFolder("image")}
              disabled={picking !== null}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-2.5 text-[13px] text-fg hover:bg-surface-hover disabled:opacity-50"
            >
              <FolderOpen className="h-4 w-4" />
              {picking === "image" ? "Opening…" : "Browse"}
            </button>
          </div>
        </div>

        <div className="mb-4 block">
          <span className="mb-1.5 flex items-center gap-1.5 text-[12.5px] text-fg-muted">
            <Video className="h-3.5 w-3.5" />
            Video output folder
          </span>
          <div className="flex gap-2">
            <input
              value={videoOutputDir}
              onChange={(e) => setVideoOutputDir(e.target.value)}
              className="min-w-0 flex-1 rounded-xl border border-border bg-surface px-3 py-2.5 text-[13.5px] text-fg focus:outline-none focus:ring-2 focus:ring-accent/50"
            />
            <button
              type="button"
              onClick={() => void browseFolder("video")}
              disabled={picking !== null}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-2.5 text-[13px] text-fg hover:bg-surface-hover disabled:opacity-50"
            >
              <FolderOpen className="h-4 w-4" />
              {picking === "video" ? "Opening…" : "Browse"}
            </button>
          </div>
        </div>

        <div className="mb-4 rounded-xl border border-border bg-surface px-3 py-3">
          <div className="flex items-start gap-2.5">
            <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-fg-muted" />
            <div>
              <p className="text-[12.5px] font-medium text-fg">
                Gemini API key: {hasKey ? "configured" : "not configured"}
              </p>
              <p className="mt-1 text-[11.5px] leading-5 text-fg-subtle">
                Set <code className="text-fg-muted">GEMINI_API_KEY</code> in your local{" "}
                <code className="text-fg-muted">.env</code> file, then restart the app.
                Keys are never accepted through the interface.
              </p>
            </div>
          </div>
        </div>

        <label className="mb-4 block">
          <span className="mb-1.5 flex items-center gap-1.5 text-[12.5px] text-fg-muted">
            <DollarSign className="h-3.5 w-3.5" />
            Gemini API balance (USD)
          </span>
          <div className="flex gap-2">
            <input
              type="number"
              min="0"
              step="0.01"
              value={apiBalanceUsd}
              onChange={(e) => setApiBalanceUsd(e.target.value)}
              className="min-w-0 flex-1 rounded-xl border border-border bg-surface px-3 py-2.5 text-[13.5px] text-fg focus:outline-none focus:ring-2 focus:ring-accent/50"
            />
            <a
              href={billingUrl || undefined}
              target="_blank"
              rel="noopener noreferrer"
              aria-disabled={!billingUrl}
              className={
                billingUrl
                  ? "inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-2.5 text-[13px] text-fg hover:bg-surface-hover"
                  : "inline-flex shrink-0 cursor-not-allowed items-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-2.5 text-[13px] text-fg-subtle opacity-50"
              }
              onClick={(e) => {
                if (!billingUrl) e.preventDefault();
              }}
            >
              <ExternalLink className="h-4 w-4" />
              Billing
            </a>
          </div>
          <span className="mt-1 block text-[11.5px] text-fg-subtle">
            Tracked spend so far: ${totalSpentUsd.toFixed(3)}. Local tracker only — open
            Billing to check the real AI Studio amount.
          </span>
        </label>

        <label className="mb-4 block">
          <span className="mb-1.5 block text-[12.5px] text-fg-muted">
            AI Studio billing URL
          </span>
          <input
            value={billingUrl}
            onChange={(e) => setBillingUrl(e.target.value)}
            placeholder="https://aistudio.google.com/billing"
            className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-[13.5px] text-fg placeholder:text-fg-subtle focus:outline-none focus:ring-2 focus:ring-accent/50"
          />
          <span className="mt-1 block text-[11.5px] text-fg-subtle">
            Saved to <code className="text-fg-muted">BILLING_URL</code> in{" "}
            <code className="text-fg-muted">.env</code>. Also used when you click the
            balance in the top bar.
          </span>
        </label>

        {message && <p className="mb-3 text-[12.5px] text-emerald-400">{message}</p>}
        {error && <p className="mb-3 text-[12.5px] text-red-400">{error}</p>}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-3.5 py-2 text-[13px] text-fg-muted hover:bg-surface-hover hover:text-fg"
          >
            Close
          </button>
          <button
            type="button"
            disabled={saving || !outputDir.trim() || !videoOutputDir.trim()}
            onClick={() => void save()}
            className="rounded-xl bg-accent px-3.5 py-2 text-[13px] font-medium text-white hover:bg-accent-hover disabled:opacity-40"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
