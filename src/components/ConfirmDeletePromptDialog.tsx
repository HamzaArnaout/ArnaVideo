"use client";

import { X } from "lucide-react";

type Props = {
  open: boolean;
  title: string;
  onCancel: () => void;
  onConfirm: () => void;
  confirming?: boolean;
};

export function ConfirmDeletePromptDialog({
  open,
  title,
  onCancel,
  onConfirm,
  confirming = false,
}: Props) {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Delete prompt"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-border bg-surface-raised p-5 shadow-composer"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <h2 className="text-[16px] font-semibold text-fg">Delete prompt?</h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onCancel}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-fg-muted hover:bg-surface-hover hover:text-fg"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-[13.5px] leading-5 text-fg-muted">
          “{title}” will be permanently removed. This can’t be undone.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={confirming}
            className="rounded-xl px-3.5 py-2 text-[13px] text-fg-muted hover:bg-surface-hover hover:text-fg disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={confirming}
            onClick={onConfirm}
            className="rounded-xl bg-red-500/90 px-3.5 py-2 text-[13px] font-medium text-white hover:bg-red-500 disabled:opacity-40"
          >
            {confirming ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}
