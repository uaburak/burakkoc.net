"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { FigmaIcon, type FigmaIconName } from "@/components/admin/figmaIcons";

/**
 * Figma's toolbar, floating at the bottom of the canvas (UI3): the move tool,
 * then what can be put on the page — a frame (a Blok in the selected Bölüm, or
 * a new Bölüm), a text, an image, a line — and the assets. Each adds where
 * the selection is, and selects what it added. On the Bileşenler page only
 * the move tool and the assets are there.
 */

function Tool({ icon, label, shortcut, active = false, disabled = false, onClick }: {
  icon: FigmaIconName;
  label: string;
  shortcut?: string;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <div className="relative group/tool">
      <button
        type="button"
        aria-label={label}
        aria-pressed={active}
        disabled={disabled}
        onClick={onClick}
        className={cn(
          "flex items-center justify-center w-8 h-8 rounded-[6px] transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-default",
          active ? "bg-[var(--edit-accent)] text-white" : "text-[var(--text-title)] enabled:hover:bg-[var(--bg-4)]"
        )}
      >
        <FigmaIcon name={icon} size={20} />
      </button>
      <span className="pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 -translate-x-1/2 z-50 hidden group-hover/tool:inline-flex items-center gap-2 h-7 px-2.5 rounded-[6px] bg-[#1e1e1e] text-[11px] font-medium text-white whitespace-nowrap">
        {label}
        {shortcut && <span className="text-white/50">{shortcut}</span>}
      </span>
    </div>
  );
}

const Divider = () => <span aria-hidden className="w-px h-5 mx-1 bg-[var(--border-hover)]" />;

export function CanvasToolbar({ onPage, frameLabel, onFrame, onText, onImage, onLine, onAssets, extra }: {
  /** The project's page: its tools to add with */
  onPage: boolean;
  /** What the frame tool adds, in words */
  frameLabel: string;
  onFrame: () => void;
  onText: () => void;
  onImage: () => void;
  onLine: () => void;
  onAssets: () => void;
  extra?: ReactNode;
}) {
  return (
    <div
      role="toolbar"
      aria-label="Araçlar"
      onClick={(e) => e.stopPropagation()}
      className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-0.5 p-1 rounded-[13px] border border-[var(--border)] bg-[var(--bg-1)] shadow-[0_8px_24px_rgba(0,0,0,0.12)] select-none"
    >
      <Tool icon="16.cursor" label="Taşı" shortcut="V" active />
      <Divider />
      <Tool icon="16.frame" label={frameLabel} shortcut="F" disabled={!onPage} onClick={onFrame} />
      <Tool icon="16.text" label="Metin" shortcut="T" disabled={!onPage} onClick={onText} />
      <Tool icon="16.image" label="Görsel" disabled={!onPage} onClick={onImage} />
      <Tool icon="16.line" label="Ayırıcı" disabled={!onPage} onClick={onLine} />
      <Divider />
      <Tool icon="16.component" label="Varlıklar" shortcut="⇧I" onClick={onAssets} />
      {extra}
    </div>
  );
}
