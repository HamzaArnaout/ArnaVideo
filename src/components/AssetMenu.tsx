"use client";

import { useEffect, useRef, useState } from "react";
import {
  Check,
  ChevronRight,
  Copy,
  Download,
  ExternalLink,
  FolderInput,
  Link2,
  SquareCheck,
  Trash2,
} from "lucide-react";
import { copyAssetLink, downloadAsset, openAssetTab } from "@/lib/asset-actions";
import type { GalleryAsset } from "@/lib/types";

type Props = {
  asset: GalleryAsset;
  projectName: string;
  selected: boolean;
  anchor: DOMRect;
  onClose: () => void;
  onToggleSelect: () => void;
  onTrash: () => void;
  onCopyToProject: () => void;
};

export function AssetMenu({
  asset,
  projectName,
  selected,
  anchor,
  onClose,
  onToggleSelect,
  onTrash,
  onCopyToProject,
}: Props) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [submenu, setSubmenu] = useState<"copy" | "move" | null>(null);
  const openUp = anchor.bottom + 280 > window.innerHeight;
  const openLeft = anchor.left + 240 > window.innerWidth;

  useEffect(() => {
    const onPointer = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) onClose();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const itemClass =
    "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] text-white/90 hover:bg-white/8";

  return (
    <div
      ref={menuRef}
      role="menu"
      className="fixed z-[80] w-[220px] rounded-xl border border-white/10 bg-[#2a2a2e] p-1.5 shadow-2xl"
      style={{
        top: openUp ? undefined : anchor.bottom + 6,
        bottom: openUp ? window.innerHeight - anchor.top + 6 : undefined,
        left: openLeft ? undefined : anchor.left,
        right: openLeft ? window.innerWidth - anchor.right : undefined,
      }}
    >
      <button
        type="button"
        role="menuitem"
        className={itemClass}
        onClick={() => {
          openAssetTab(asset);
          onClose();
        }}
      >
        <ExternalLink className="h-4 w-4 text-white/80" strokeWidth={1.75} />
        Open in new tab
      </button>
      <button
        type="button"
        role="menuitem"
        className={itemClass}
        onClick={() => {
          void copyAssetLink(asset).then(() => {
            setCopied(true);
            window.setTimeout(onClose, 500);
          });
        }}
      >
        <Link2 className="h-4 w-4 text-white/80" strokeWidth={1.75} />
        {copied ? "Copied" : "Copy image link"}
      </button>
      <button
        type="button"
        role="menuitem"
        className={itemClass}
        onClick={() => {
          downloadAsset(asset);
          onClose();
        }}
      >
        <Download className="h-4 w-4 text-white/80" strokeWidth={1.75} />
        Download
      </button>

      <div
        className="relative"
        onMouseEnter={() => setSubmenu("copy")}
        onMouseLeave={() => setSubmenu((cur) => (cur === "copy" ? null : cur))}
      >
        <button type="button" role="menuitem" className={itemClass}>
          <Copy className="h-4 w-4 text-white/80" strokeWidth={1.75} />
          <span className="flex-1">Copy to project</span>
          <ChevronRight className="h-3.5 w-3.5 text-white/50" />
        </button>
        {submenu === "copy" && (
          <ProjectSubmenu
            projectName={projectName}
            side={openLeft ? "left" : "right"}
            onPick={() => {
              onCopyToProject();
              onClose();
            }}
          />
        )}
      </div>

      <div
        className="relative"
        onMouseEnter={() => setSubmenu("move")}
        onMouseLeave={() => setSubmenu((cur) => (cur === "move" ? null : cur))}
      >
        <button type="button" role="menuitem" className={itemClass}>
          <FolderInput className="h-4 w-4 text-white/80" strokeWidth={1.75} />
          <span className="flex-1">Move to project</span>
          <ChevronRight className="h-3.5 w-3.5 text-white/50" />
        </button>
        {submenu === "move" && (
          <ProjectSubmenu
            projectName={projectName}
            side={openLeft ? "left" : "right"}
            checked
            onPick={onClose}
          />
        )}
      </div>

      <button
        type="button"
        role="menuitem"
        className={itemClass}
        onClick={() => {
          onToggleSelect();
          onClose();
        }}
      >
        <SquareCheck className="h-4 w-4 text-white/80" strokeWidth={1.75} />
        {selected ? "Deselect" : "Select"}
      </button>

      <div className="my-1 h-px bg-white/10" />

      <button
        type="button"
        role="menuitem"
        className={itemClass}
        onClick={() => {
          onTrash();
          onClose();
        }}
      >
        <Trash2 className="h-4 w-4 text-white/80" strokeWidth={1.75} />
        Move to Trash
      </button>
    </div>
  );
}

function ProjectSubmenu({
  projectName,
  side,
  checked,
  onPick,
}: {
  projectName: string;
  side: "left" | "right";
  checked?: boolean;
  onPick: () => void;
}) {
  return (
    <div
      className="absolute top-0 z-[81] w-[180px] rounded-xl border border-white/10 bg-[#2a2a2e] p-1.5 shadow-2xl"
      style={side === "right" ? { left: "100%", marginLeft: 6 } : { right: "100%", marginRight: 6 }}
    >
      <button
        type="button"
        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] text-white/90 hover:bg-white/8"
        onClick={onPick}
      >
        {checked ? <Check className="h-3.5 w-3.5" strokeWidth={2} /> : <span className="w-3.5" />}
        <span className="truncate">{projectName}</span>
      </button>
    </div>
  );
}
