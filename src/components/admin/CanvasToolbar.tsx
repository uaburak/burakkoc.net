"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { FigmaIcon, type FigmaIconName } from "@/components/admin/figmaIcons";
import type { CanvasTool } from "@/components/admin/canvasModel";

/**
 * Figma's toolbar, floating at the bottom of the canvas (UI3): the move tool,
 * then what can be put on the page — a frame (a Blok in the selected Bölüm, or
 * a new Bölüm), a text, an image, a line — and the assets. Each adds where
 * the selection is, and selects what it added. On the Bileşenler page —
 * Figma's canvas — its drawing tools: move, hand, frame, rectangle, ellipse,
 * text; the one in use pressed.
 */

/** The Bileşenler page's tools, as Figma's toolbar orders them. */
const CANVAS_TOOLS: { tool: CanvasTool; icon: FigmaIconName; label: string; shortcut: string; divided?: boolean }[] = [
  { tool: "move", icon: "16.cursor", label: "Taşı", shortcut: "V" },
  { tool: "hand", icon: "16.hand", label: "El — görünümü kaydır (Boşluk basılıyken de)", shortcut: "H" },
  { tool: "frame", icon: "16.frame", label: "Çerçeve", shortcut: "F", divided: true },
  { tool: "rectangle", icon: "16.rectangle", label: "Dikdörtgen", shortcut: "R" },
  { tool: "ellipse", icon: "16.ellipse", label: "Elips", shortcut: "O" },
  { tool: "text", icon: "16.text", label: "Metin", shortcut: "T" },
];

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

/** Figma's mode switch at the toolbar's end: Design (this editor) and Dev Mode (the block editor). */
const Modes = {
  design: (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <path d="M3 5.5h6M5.5 3v6" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
      <path d="M8.5 8.5l6.5 2.6-2.9 1.1-1.1 2.9L8.5 8.5z" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" />
    </svg>
  ),
  dev: (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <path d="M6.5 5L3 9l3.5 4M11.5 5L15 9l-3.5 4" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};

export function CanvasToolbar({ onPage, canvas, frameLabel, onFrame, onText, onImage, onLine, onDevMode, extra }: {
  /** The project's page: its tools to add with */
  onPage: boolean;
  /** The Bileşenler page: its drawing tools, the one in use */
  canvas?: { tool: CanvasTool; onTool: (tool: CanvasTool) => void };
  /** What the frame tool adds, in words */
  frameLabel: string;
  onFrame: () => void;
  onText: () => void;
  onImage: () => void;
  onLine: () => void;
  /** Figma's Dev Mode switch: the block editor */
  onDevMode: () => void;
  extra?: ReactNode;
}) {
  return (
    <div
      role="toolbar"
      aria-label="Araçlar"
      onClick={(e) => e.stopPropagation()}
      className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-0.5 h-12 p-2 rounded-[13px] border border-[var(--border)] bg-[var(--bg-1)] shadow-[0_2px_14px_rgba(0,0,0,0.15)] select-none"
    >
      {canvas ? (
        CANVAS_TOOLS.map((t) => (
          <div key={t.tool} className="flex items-center">
            {t.divided && <Divider />}
            <Tool icon={t.icon} label={t.label} shortcut={t.shortcut} active={canvas.tool === t.tool} onClick={() => canvas.onTool(t.tool)} />
          </div>
        ))
      ) : (
        <>
          <Tool icon="16.cursor" label="Taşı" shortcut="V" active />
          <Divider />
          <Tool icon="16.frame" label={frameLabel} shortcut="F" disabled={!onPage} onClick={onFrame} />
          <Tool icon="16.text" label="Metin" shortcut="T" disabled={!onPage} onClick={onText} />
          <Tool icon="16.image" label="Görsel" disabled={!onPage} onClick={onImage} />
          <Tool icon="16.line" label="Ayırıcı" disabled={!onPage} onClick={onLine} />
        </>
      )}
      {extra}
      {/* Figma's mode switch: Design (pressed) and Dev Mode — the block editor. */}
      <span aria-hidden className="w-px h-8 mx-2 bg-[var(--border)]" />
      <div className="relative group/tool">
        <button type="button" aria-label="Canlı Düzenleyici" aria-pressed className="flex items-center justify-center w-8 h-8 rounded-[6px] bg-[color-mix(in_srgb,var(--edit-accent)_14%,transparent)] text-[var(--edit-accent)] cursor-default">
          {Modes.design}
        </button>
        <span className="pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 -translate-x-1/2 z-50 hidden group-hover/tool:inline-flex items-center h-7 px-2.5 rounded-[6px] bg-[#1e1e1e] text-[11px] font-medium text-white whitespace-nowrap">Canlı Düzenleyici</span>
      </div>
      <div className="relative group/tool">
        <button type="button" aria-label="Blok Düzenleyici" onClick={onDevMode} className="flex items-center justify-center w-8 h-8 rounded-[6px] text-[var(--text-title)] hover:bg-[var(--bg-4)] transition-colors cursor-pointer">
          {Modes.dev}
        </button>
        <span className="pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 -translate-x-1/2 z-50 hidden group-hover/tool:inline-flex items-center gap-2 h-7 px-2.5 rounded-[6px] bg-[#1e1e1e] text-[11px] font-medium text-white whitespace-nowrap">Blok Düzenleyici <span className="text-white/50">⇧D</span></span>
      </div>
    </div>
  );
}
