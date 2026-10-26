import {
  FileText,
  Image as ImageIcon,
  Pencil,
  Plus,
  Settings,
  Trash2,
  Video,
} from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { cn } from "@/lib/cn";
import type { MediaMode } from "@/components/GenerateComposer";

export type SidebarPrompt = {
  id: string;
  title: string;
  body: string;
  negativePrompt?: string;
};

type Props = {
  mediaMode: MediaMode;
  onMediaModeChange: (mode: MediaMode) => void;
  prompts: SidebarPrompt[];
  activePromptId: string | null;
  onLoadPrompt: (prompt: SidebarPrompt) => void;
  onAddPrompt: () => void;
  onEditPrompt: (prompt: SidebarPrompt) => void;
  onDeletePrompt: (prompt: SidebarPrompt) => void;
  onOpenSettings: () => void;
};

export function PrimarySidebar({
  mediaMode,
  onMediaModeChange,
  prompts,
  activePromptId,
  onLoadPrompt,
  onAddPrompt,
  onEditPrompt,
  onDeletePrompt,
  onOpenSettings,
}: Props) {
  return (
    <aside className="flex h-full w-[248px] shrink-0 flex-col border-r border-border-subtle bg-canvas px-2.5 py-3">
      <div className="mb-3 px-2 pt-0.5">
        <BrandLogo />
      </div>

      <nav className="space-y-0.5" aria-label="Primary">
        <button
          type="button"
          onClick={() => onMediaModeChange("image")}
          className={cn(
            "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-left text-[13px] transition-colors",
            mediaMode === "image"
              ? "bg-surface-hover text-fg"
              : "text-fg-muted hover:bg-surface hover:text-fg",
          )}
        >
          <ImageIcon className="h-[15px] w-[15px]" strokeWidth={1.75} />
          Image
        </button>
        <button
          type="button"
          onClick={() => onMediaModeChange("video")}
          className={cn(
            "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-left text-[13px] transition-colors",
            mediaMode === "video"
              ? "bg-surface-hover text-fg"
              : "text-fg-muted hover:bg-surface hover:text-fg",
          )}
        >
          <Video className="h-[15px] w-[15px]" strokeWidth={1.75} />
          Video
        </button>
      </nav>

      <div className="mt-4 flex items-center justify-between px-2.5">
        <span className="text-[10.5px] font-medium uppercase tracking-[0.08em] text-fg-subtle">
          Prompts
        </span>
        <button
          type="button"
          aria-label="Add prompt"
          onClick={onAddPrompt}
          className="inline-flex h-6 w-6 items-center justify-center rounded-md text-fg-muted hover:bg-surface hover:text-fg"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={1.75} />
        </button>
      </div>

      <div className="mt-1.5 min-h-0 flex-1 space-y-0.5 overflow-y-auto scrollbar-thin">
        {prompts.length === 0 ? (
          <button
            type="button"
            onClick={onAddPrompt}
            className="flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left text-[12.5px] text-fg-subtle hover:bg-surface hover:text-fg-muted"
          >
            <FileText className="mt-0.5 h-[15px] w-[15px] shrink-0" strokeWidth={1.75} />
            <span>Save prompts to reuse for image & video</span>
          </button>
        ) : (
          prompts.map((prompt) => (
            <div
              key={prompt.id}
              className={cn(
                "flex items-start gap-1 rounded-lg px-1.5 py-1",
                activePromptId === prompt.id ? "bg-surface-hover" : "hover:bg-surface",
              )}
            >
              <button
                type="button"
                onClick={() => onLoadPrompt(prompt)}
                className="min-w-0 flex-1 rounded-md px-1 py-1 text-left"
                title="Load into composer"
              >
                <span className="block truncate text-[13px] text-fg">{prompt.title}</span>
                <span className="mt-0.5 line-clamp-2 text-[11px] text-fg-subtle">
                  {prompt.body}
                </span>
              </button>
              <div className="flex shrink-0 items-center gap-0.5">
                <button
                  type="button"
                  aria-label={`Edit ${prompt.title}`}
                  title="Edit"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditPrompt(prompt);
                  }}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md text-fg-muted hover:bg-surface-hover hover:text-fg"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  aria-label={`Delete ${prompt.title}`}
                  title="Delete"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeletePrompt(prompt);
                  }}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md text-fg-muted hover:bg-surface-hover hover:text-red-400"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="mt-2 shrink-0 space-y-0.5 border-t border-border-subtle pt-2">
        <button
          type="button"
          onClick={onOpenSettings}
          className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-left text-[13px] text-fg-muted hover:bg-surface hover:text-fg"
        >
          <Settings className="h-[15px] w-[15px]" strokeWidth={1.75} />
          Settings
        </button>

      </div>
    </aside>
  );
}
