"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { fi, type FigmaIconName } from "@/components/admin/figmaIcons";
import type { TreeDrop } from "@/components/admin/ProjectDnd";

/**
 * The live editor's layer chrome, shared by its pages (the project's, the
 * Bileşenler page): the layer tree's rows, as Figma's (LayerRow), and the
 * selection's size badge on the canvas (SizeBadge).
 */

/**
 * The panels' action icons — 24 ones in 12px of room (their glyph; the box
 * is the button's), as the inspector's (see LiveInspector's glyph).
 */
const icon = (name: FigmaIconName) => fi(name, undefined, "-m-1.5 shrink-0");

export const Icons = {
  // Back to the value it had.
  reset: icon("reset.instance.small"),
  plus: icon("plus.small"),
  duplicate: icon("duplicate.small"),
  trash: icon("trash"),
  external: icon("new.tab"),
  arrowUp: icon("al.layout-vertical-up"),
  arrowDown: icon("al.layout-vertical"),
  edit: icon("pencil.small"),
  // Figma's "Collapse layers" / "Expand layers".
  collapseLayers: icon("collapse-layers.small"),
  expandLayers: icon("expand"),
  chevron: fi("16.chevron.down"),
  copy: icon("copy.small"),
  // A layer shown / hidden (its look's `hidden`).
  eye: icon("eye.small"),
  eyeOff: icon("hidden.small"),
  // Go to main component.
  goTo: icon("go.to.main.component.small"),
};

// ── Size badge ────────────────────────────────────────────────────────────────

/**
 * What the size badge (SizeBadge) shows: the element `selector` finds, its
 * line `below` px under its bottom (under a component's frame with `frame`),
 * `padded` for the editor's 10px around a section (SECTION_BOX), in `tone`.
 */
export type BadgeTarget = { selector: string; tone: string; below?: number; frame?: boolean; padded?: boolean };

/**
 * The selection's size (W × H), as Figma's: a small badge centred 4px under its
 * line, in its level's colour — the section's blue, the Blok's green, the
 * component's kind. It follows the element each frame while selected (typing,
 * images loading, the page moving). Render it in the canvas's `main`.
 */
export function SizeBadge({ selector, tone, below = 0, frame = false, padded = false }: BadgeTarget) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const badge = ref.current;
    if (!badge) return;
    let raf = 0;
    let shown = "";
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const el = document.querySelector<HTMLElement>(selector);
      const main = badge.offsetParent;
      if (!el || !main) {
        badge.style.visibility = "hidden";
        shown = "";
        return;
      }
      const r = el.getBoundingClientRect();
      const line = frame && el.firstElementChild ? el.firstElementChild.getBoundingClientRect().bottom : r.bottom + below;
      const m = main.getBoundingClientRect();
      const pad = padded ? 20 : 0;
      const text = `${Math.round(r.width - pad)} × ${Math.round(r.height - pad)}`;
      const left = Math.round(r.left + r.width / 2 - m.left);
      const top = Math.round(line + 4 - m.top);
      const next = `${text}|${left}|${top}`;
      if (next === shown) return;
      shown = next;
      badge.textContent = text;
      badge.style.left = `${left}px`;
      badge.style.top = `${top}px`;
      badge.style.visibility = "visible";
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [selector, below, frame, padded]);
  return (
    <span
      ref={ref}
      aria-hidden
      style={{ background: tone }}
      className="invisible pointer-events-none absolute z-40 -translate-x-1/2 px-1 rounded-[3px] text-[11px] font-medium leading-4 text-white tabular-nums whitespace-nowrap select-none"
    />
  );
}

// ── Layer tree ────────────────────────────────────────────────────────────────

/**
 * Hovering a layer outlines its element on the canvas (the canvas styles
 * `data-layer-hover` like its own hover).
 */
export function hoverOnCanvas(selector: string, on: boolean) {
  document.querySelector(`main ${selector}`)?.toggleAttribute("data-layer-hover", on);
}

/** Icon button of a layer row, as in Figma: a small rounded square, tinted on hover. */
export function LayerButton({ label, onClick, disabled = false, children }: { label: string; onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      onDoubleClick={(e) => e.stopPropagation()}
      className="flex items-center justify-center w-6 h-6 rounded-[6px] text-[var(--text-subtitle)] hover:text-[var(--text-title)] hover:bg-[var(--bg-5)] transition-colors cursor-pointer disabled:opacity-30 disabled:pointer-events-none"
    >
      {children}
    </button>
  );
}

/**
 * One row of the layer tree, Figma-like: indented by depth, a disclosure
 * chevron for containers, the level's icon — the only thing in colour
 * (`tone`); the rest stays in the theme's greys — and the layer's name.
 * Click selects; double-click renames (Enter / leaving the field keeps it,
 * Esc drops it, an empty name goes back to the default); the edit icon on
 * hover opens the inspector. The row is dragged with its node (listeners sit
 * on the node).
 */
export function LayerRow({ depth, tone, nameTone, icon, name, selected, hidden = false, onToggleHidden, open, onToggle, hover, onSelect, onInspect, onRename, children }: {
  depth: number;
  tone: string;
  /** Its name's colour too — a component's or an instance's purple, as Figma's */
  nameTone?: string;
  icon: ReactNode;
  name: string;
  selected: boolean;
  /** Not shown on the page (see FrameLook.hidden): greyed, its eye crossed out */
  hidden?: boolean;
  /** Layers that can be hidden: Figma's eye, at the row's end */
  onToggleHidden?: () => void;
  /** Containers: expanded or not (undefined: no chevron) */
  open?: boolean;
  onToggle?: () => void;
  /** Its element on the canvas, outlined while the row is hovered */
  hover?: string;
  onSelect: () => void;
  onInspect: () => void;
  /** Renamable layers: the new name (undefined: back to the default) */
  onRename?: (name: string | undefined) => void;
  /** Hover actions before the edit icon */
  children?: ReactNode;
}) {
  const [renaming, setRenaming] = useState(false);
  // Enter, Esc and leaving the field all end the rename — only the first one counts.
  const ended = useRef(false);
  const startRename = () => {
    ended.current = false;
    setRenaming(true);
  };
  /** Keeps `value` as the name (undefined: Esc, the name stays). */
  const finish = (value?: string) => {
    if (ended.current) return;
    ended.current = true;
    if (value !== undefined) onRename?.(value.trim() || undefined);
    setRenaming(false);
  };

  return (
    <div
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
      onDoubleClick={(e) => { e.stopPropagation(); if (onRename) startRename(); else onInspect(); }}
      onMouseEnter={() => hover && hoverOnCanvas(hover, true)}
      onMouseLeave={() => hover && hoverOnCanvas(hover, false)}
      style={{ paddingLeft: 4 + depth * 16 }}
      className={cn(
        "group/layer flex items-center gap-1 h-8 pr-1 rounded-[8px] text-[12px] leading-4 cursor-default select-none transition-colors",
        // Selected: the theme's #f2f2f2 (bg-4); hovered: a lighter tone of it.
        selected ? "bg-[var(--bg-4)]" : "hover:bg-[color-mix(in_srgb,var(--bg-4)_60%,transparent)]"
      )}
    >
      {open === undefined ? (
        <span className="w-4 shrink-0" />
      ) : (
        <button
          type="button"
          aria-label={open ? "Daralt" : "Genişlet"}
          aria-expanded={open}
          onClick={(e) => { e.stopPropagation(); onToggle?.(); }}
          onDoubleClick={(e) => e.stopPropagation()}
          className="flex items-center justify-center w-4 h-4 shrink-0 rounded text-[var(--text-subtitle)] hover:text-[var(--text-title)] cursor-pointer"
        >
          <span className={cn("transition-transform duration-150", !open && "-rotate-90")}>{Icons.chevron}</span>
        </button>
      )}
      <span className={cn("flex items-center justify-center w-4 h-4 shrink-0", hidden && "opacity-40")} style={{ color: tone }}>{icon}</span>
      {renaming ? (
        <input
          autoFocus
          aria-label="Katman adı"
          defaultValue={name}
          onFocus={(e) => e.currentTarget.select()}
          onBlur={(e) => finish(e.currentTarget.value)}
          onKeyDown={(e) => {
            // Keys stay in the field: no Backspace deleting the layer, no Escape dropping the selection.
            e.stopPropagation();
            if (e.key === "Enter") finish(e.currentTarget.value);
            if (e.key === "Escape") finish();
          }}
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
          className="min-w-0 flex-1 h-6 ml-0.5 px-1.5 rounded-[6px] border border-[var(--border-hover)] bg-[var(--bg-1)] text-[12px] font-medium text-[var(--text-title)] outline-none select-text"
        />
      ) : (
        <span className={cn("min-w-0 truncate pl-0.5 font-medium text-[var(--text-title)]", hidden && "opacity-40")} style={nameTone ? { color: nameTone } : undefined}>{name}</span>
      )}
      {!renaming && (
        <div className="ml-auto flex items-center gap-0.5 shrink-0">
          <div className="flex items-center gap-0.5 opacity-0 group-hover/layer:opacity-100 focus-within:opacity-100 transition-opacity">
            {children}
            <LayerButton label="Düzenle" onClick={onInspect}>{Icons.edit}</LayerButton>
          </div>
          {/* Figma's eye: on hover — always, crossed out, while hidden. */}
          {onToggleHidden && (
            <div className={cn(!hidden && "opacity-0 group-hover/layer:opacity-100 focus-within:opacity-100 transition-opacity")}>
              <LayerButton label={hidden ? "Göster" : "Gizle"} onClick={onToggleHidden}>{hidden ? Icons.eyeOff : Icons.eye}</LayerButton>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Figma's drop line: where the dragged row lands — above or below this row's
 * node, or first inside it (below its row, one level deeper).
 */
export function DropLine({ place, depth }: { place: TreeDrop["place"] | null; depth: number }) {
  if (!place) return null;
  return (
    <span
      aria-hidden
      className={cn(
        "pointer-events-none absolute right-1 z-10 h-[2px] rounded-full bg-[var(--text-title)]",
        // A ring at its start, as in Figma.
        "before:content-[''] before:absolute before:-left-[5px] before:-top-[2px] before:w-[6px] before:h-[6px] before:rounded-full before:border-2 before:border-[var(--text-title)] before:bg-[var(--bg-1)]",
        place === "before" ? "-top-px" : place === "after" ? "-bottom-px" : "top-[31px]"
      )}
      style={{ left: 24 + (place === "inside" ? depth + 1 : depth) * 16 }}
    />
  );
}

/** The subtree of a selected layer is tinted too (lighter), as in Figma. */
export const layerNode = (selected: boolean, dragging: boolean) =>
  cn(
    "relative flex flex-col rounded-[8px]",
    selected && "bg-[color-mix(in_srgb,var(--bg-4)_50%,transparent)]",
    // The dragged row stays where it is, dimmed — only the line moves.
    dragging && "opacity-40"
  );

