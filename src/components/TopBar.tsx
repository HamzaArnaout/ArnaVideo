"use client";

import { ChevronDown, Heart, Settings } from "lucide-react";
import { cn } from "@/lib/cn";
import { money } from "@/lib/money";

type Props = {
  projectName: string;
  apiBalanceUsd: number;
  billingUrl?: string;
  title?: string;
  favoritesOnly: boolean;
  onToggleFavorites: () => void;
  onOpenSettings: () => void;
};

export function TopBar({
  projectName,
  apiBalanceUsd,
  billingUrl,
  title = "Create image",
  favoritesOnly,
  onToggleFavorites,
  onOpenSettings,
}: Props) {
  return (
    <header className="flex h-[52px] shrink-0 items-center justify-between px-5">
      <div className="flex items-center gap-1.5 text-[13.5px]">
        <span className="text-fg-muted">{favoritesOnly ? "Favorites" : title}</span>
        <span className="text-fg-subtle">/</span>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-md px-1 py-0.5 text-fg hover:bg-surface"
        >
          {projectName}
          <ChevronDown className="h-3.5 w-3.5 text-fg-muted" strokeWidth={1.75} />
        </button>
      </div>

      <div className="flex items-center gap-1">
        <IconButton label="Settings" onClick={onOpenSettings}>
          <Settings className="h-4 w-4" strokeWidth={1.75} />
        </IconButton>
        <IconButton
          label={favoritesOnly ? "Show all" : "Show favorites"}
          onClick={onToggleFavorites}
          active={favoritesOnly}
        >
          <Heart
            className={cn("h-4 w-4", favoritesOnly && "fill-current")}
            strokeWidth={1.75}
          />
        </IconButton>
        {billingUrl ? (
          <a
            href={billingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-1 inline-flex h-8 min-w-8 items-center justify-center rounded-full bg-surface-hover px-2.5 text-[12.5px] font-semibold text-fg hover:bg-surface"
            aria-label={`Open AI Studio billing — local balance ${money.format(apiBalanceUsd)}`}
            title="Open Google AI Studio billing"
          >
            {money.format(apiBalanceUsd)}
          </a>
        ) : (
          <button
            type="button"
            onClick={onOpenSettings}
            className="ml-1 inline-flex h-8 min-w-8 items-center justify-center rounded-full bg-surface-hover px-2.5 text-[12.5px] font-semibold text-fg"
            aria-label={`API balance ${money.format(apiBalanceUsd)}`}
            title="Gemini API balance (set in Settings)"
          >
            {money.format(apiBalanceUsd)}
          </button>
        )}
      </div>
    </header>
  );
}

function IconButton({
  children,
  label,
  onClick,
  active,
}: {
  children: React.ReactNode;
  label: string;
  onClick?: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
        active
          ? "bg-surface-hover text-fg"
          : "text-fg-muted hover:bg-surface hover:text-fg",
      )}
    >
      {children}
    </button>
  );
}
