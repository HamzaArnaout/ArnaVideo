"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

export type PromptDraft = {
  id?: string;
  title: string;
  body: string;
  negativePrompt?: string;
};

type Props = {
  open: boolean;
  initial?: PromptDraft | null;
  onClose: () => void;
  onSaved: () => void;
};

export function PromptEditorDialog({ open, initial, onClose, onSaved }: Props) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTitle(initial?.title ?? "");
    setBody(initial?.body ?? "");
    setNegativePrompt(initial?.negativePrompt ?? "");
    setError(null);
  }, [open, initial]);

  if (!open) return null;

  async function save() {
    if (!body.trim()) {
      setError("Paste or type a prompt first.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const editing = Boolean(initial?.id);
      const res = await fetch(
        editing ? `/api/v1/prompts/${initial!.id}` : "/api/v1/prompts",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            body,
            // Always send the field so empty clears a previously saved negative.
            negativePrompt,
          }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save prompt");
      onSaved();
      onClose();
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
      aria-label={initial?.id ? "Edit prompt" : "New prompt"}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-border bg-surface-raised p-5 shadow-composer"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[16px] font-semibold text-fg">
            {initial?.id ? "Edit prompt" : "New prompt"}
          </h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-fg-muted hover:bg-surface-hover hover:text-fg"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <label className="mb-3 block">
          <span className="mb-1.5 block text-[12.5px] text-fg-muted">1. Title</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Luxury bathroom"
            className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-[13.5px] text-fg placeholder:text-fg-subtle focus:outline-none focus:ring-2 focus:ring-accent/50"
          />
        </label>

        <label className="mb-3 block">
          <span className="mb-1.5 block text-[12.5px] text-fg-muted">2. Prompt</span>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={8}
            placeholder="Paste your prompt here…"
            className="w-full resize-y rounded-xl border border-border bg-surface px-3 py-2.5 text-[13.5px] leading-6 text-fg placeholder:text-fg-subtle focus:outline-none focus:ring-2 focus:ring-accent/50"
          />
        </label>

        <label className="mb-4 block">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <span className="text-[12.5px] text-fg-muted">3. Negative prompt</span>
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
            rows={3}
            placeholder="Optional — leave empty if you don’t need one"
            className="w-full resize-y rounded-xl border border-border bg-surface px-3 py-2.5 text-[13.5px] leading-6 text-fg placeholder:text-fg-subtle focus:outline-none focus:ring-2 focus:ring-accent/50"
          />
        </label>

        {error && <p className="mb-3 text-[12.5px] text-red-400">{error}</p>}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-3.5 py-2 text-[13px] text-fg-muted hover:bg-surface-hover hover:text-fg"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
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
