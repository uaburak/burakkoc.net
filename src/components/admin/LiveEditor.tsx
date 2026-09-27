"use client";

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useDndMonitor } from "@dnd-kit/core";
import { Block, BlockType, ComponentDesign, ComponentDesigns, GridSettings, Group, ItemTextField, PageDivider, PageItem, PageSection, ProjectData } from "@/types/project";
import type { DesignVariable, VariableKind } from "@/types/design";
import { cn } from "@/lib/utils";
import { findBlock, findGroup, freeCells, gridColumns, gridFlow, gridRows, layoutCells, rowCount, sectionBlocks, sectionsOf, type Cell } from "@/lib/projectLayout";
import { PillButton } from "@/components/Button";
import { Input } from "@/components/Input";
import { ScrollArea } from "@/components/ScrollArea";
import { FillHeightContext, ProjectBlock, ProjectDivider } from "@/components/project/CoreBlocks";
import { absoluteProps, cellProps, gridProps, pageFrameProps, sectionFrameProps, sizeProps } from "@/components/project/LayoutGrid";
import { EditableText } from "@/components/project/Editable";
import { DRAG_LIFT, DragActivationContext, setDragTarget } from "@/components/project/Sortable";
import { createBlockEditApi, localizeBlock } from "@/components/project/editing";
import { projectThemeAttrs } from "@/components/project/projectTheme";
import { PillLabel } from "@/components/admin/FormEditor";
import { ProjectThemeFields } from "@/components/admin/ProjectThemeFields";
import {
  BlockInspector,
  ComponentLayoutGroup,
  GroupInspector,
  ItemInspector,
  ItemLayoutGroup,
  PageFrameInspector,
  PlacementGroup,
  ProjectInspector,
  SectionInspector,
  SizeGroup,
  TextLayerInspector,
  VariableInspector,
  canMoveItem,
  duplicateItem,
  freeSize,
  hasItem,
  itemName,
  moveItem,
  plainText,
  removeItem,
  textLayersOf,
  addEntry,
  itemNoun,
} from "@/components/admin/LiveInspector";
import { DESIGNED_TYPES, resolveDesign } from "@/components/project/componentDesign";
import { DesignVariablesStyle } from "@/components/project/designVariables";
import { VariablesPanel } from "@/components/admin/VariablesPanel";
import { BLOCK_DEFS, BLOCK_GROUPS, BLOCK_LABELS, BlockPickerDialog, GROUP_TONE, SECTION_TONE, blockTone, uid } from "@/components/admin/blockCatalog";
import {
  GroupBlocks,
  ProjectDndProvider,
  REORDER_LIST,
  REORDER_ROOM,
  ReorderRow,
  SectionGroups,
  sortableStyle,
  usePageReorder,
  useKeepDropPosition,
  useSortableBlock,
  useActiveDrag,
  useCellDrop,
  useInsertion,
  useNewBlockDrag,
  useSortableGroup,
  useSortablePageItem,
  useTreeDrop,
  type TreeDrop,
} from "@/components/admin/ProjectDnd";
import type { EditorActions } from "@/components/admin/editorActions";

/**
 * Live editor ("Canlı Düzenleyici"): the project page itself, editable.
 *
 * Layout, as in Figma: icon rail → left panel → canvas → inspector.
 * - Rail / left panel: Katmanlar (the page as a Figma-like layer tree),
 *   Bileşenler (the component catalog — drag onto the page), Tema (radius /
 *   colors), Yayın (link, content status, template).
 * - Inspector (Düzenle, right): whatever is selected — the project when nothing is.
 * - Canvas: the page is Bölüm (section) › Blok (group) › Bileşen (component,
 *   `Block` in code); sections lay out their Bloks on a grid, Bloks their
 *   components. As in Figma, each click goes a level deeper: the section, its
 *   Blok, the component, a card inside it (see pressOn) — its settings open in
 *   the panel; double-click a text of the selected component to type in place.
 *   With Cmd / Ctrl held a click picks the innermost layer at once, and a
 *   double-click types in any text.
 *   Drag what is selected to reorder it; components can move between Bloks,
 *   Bloks between sections. Under the selection, a badge shows its size (SizeBadge).
 *   With Alt held, the drop leaves a copy where it was (see ProjectDnd).
 * - Links never navigate here, images never open the lightbox.
 */

type Lang = "tr" | "en";
type Selection =
  | { kind: "none" }
  /** The page's frame (PageFrame): the root layer, named after the project */
  | { kind: "page" }
  | { kind: "meta"; part?: OverviewPart }
  | { kind: "section"; sectionId: string }
  | { kind: "group"; groupId: string }
  | {
      kind: "block";
      blockId: string;
      /** An item clicked inside the block (card, step, list item…) */
      itemId?: string;
      /** A text layer of that item (a component laid out by its main component — see ComponentDesign) */
      text?: ItemTextField;
    }
  | { kind: "divider"; dividerId: string }
  /** A design variable (see DesignVariable), picked in the Değişkenler tab */
  | { kind: "variable"; variableId: string };
/** The left panel's tabs; the inspector (Düzenle) has a panel of its own, on the right. */
type Tab = "layers" | "components" | "variables" | "theme" | "publish";
/** Pieces of the project overview that behave like blocks. */
type OverviewPart = "title" | "description" | "cover";

function findSection(items: PageItem[], sectionId: string): { section: PageSection; index: number } | null {
  const sections = sectionsOf(items);
  const index = sections.findIndex((s) => s.id === sectionId);
  return index >= 0 ? { section: sections[index], index } : null;
}

const sectionNumber = (index: number) => String(index + 1).padStart(2, "0");
const sectionLabel = (index: number) => `${sectionNumber(index)} Bölüm`;
const groupLabel = (index: number) => `Blok ${index + 1}`;

/** Layer names: the one given in the layer tree, else the default ("01 Bölüm", "Blok 1", the component's type). */
const sectionName = (section: PageSection, index: number) => section.name?.trim() || sectionLabel(index);
const groupName = (group: Group, index: number) => group.name?.trim() || groupLabel(index);
const blockName = (block: Block) => block.name?.trim() || BLOCK_LABELS[block.type];

// ── Icons (20px rail / 14px panel, 1.5 stroke like the rest of the site) ───────

const RailIcons = {
  // Figma's assets: the component catalog.
  components: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path d="M10 2.75l2.75 2.75L10 8.25 7.25 5.5 10 2.75zM5.5 7.25L8.25 10 5.5 12.75 2.75 10 5.5 7.25zM14.5 7.25L17.25 10l-2.75 2.75L11.75 10l2.75-2.75zM10 11.75l2.75 2.75L10 17.25l-2.75-2.75L10 11.75z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  ),
  layers: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path d="M10 3l7 3.5-7 3.5-7-3.5L10 3z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M3 10l7 3.5 7-3.5M3 13.5L10 17l7-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  theme: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path d="M10 3a7 7 0 100 14c1.1 0 1.6-.8 1.3-1.7-.3-.9.2-1.8 1.2-1.8H14a3 3 0 003-3A7 7 0 0010 3z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx="6.75" cy="9.5" r="1" fill="currentColor" />
      <circle cx="9" cy="6.5" r="1" fill="currentColor" />
      <circle cx="12.75" cy="7" r="1" fill="currentColor" />
    </svg>
  ),
  // Figma's variables: a hexagon.
  variables: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path d="M10 2.75l6.25 3.6v7.3L10 17.25l-6.25-3.6v-7.3L10 2.75z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx="10" cy="10" r="2" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  ),
  publish: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
      <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.5" />
      <path d="M3 10h14M10 3c1.8 1.9 2.7 4.2 2.7 7s-.9 5.1-2.7 7c-1.8-1.9-2.7-4.2-2.7-7S8.2 4.9 10 3z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  ),
};

const Icons = {
  // Back to the value it had: an arrow turning back.
  reset: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M3 5.5A4.5 4.5 0 117 11.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M2.5 2.5v3h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  plus: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M7 2.5v9M2.5 7h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  duplicate: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <rect x="4.5" y="4.5" width="8" height="8" rx="1.8" stroke="currentColor" strokeWidth="1.4" />
      <path d="M9.5 2.5H3.3A1.3 1.3 0 002 3.8v6.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  ),
  trash: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M2 3.5h10M5.5 3.5V2h3v1.5M4 3.5l.5 8h5l.5-8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  external: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M8 2h4v4M12 2L6.5 7.5M5.5 3H3a1 1 0 00-1 1v7a1 1 0 001 1h7a1 1 0 001-1V8.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  arrowUp: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M7 11.5v-9M3.5 6L7 2.5 10.5 6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  arrowDown: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M7 2.5v9M3.5 8L7 11.5 10.5 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  edit: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M9.5 2.5l2 2L5 11H3V9l6.5-6.5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  ),
  // Figma's "Collapse layers": the chevrons point in; "expand": out.
  collapseLayers: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M1.75 3.5h6M1.75 7h6M1.75 10.5h6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M9.75 3l1.5 1.5L12.75 3M9.75 11l1.5-1.5 1.5 1.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  expandLayers: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M1.75 3.5h6M1.75 7h6M1.75 10.5h6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M9.75 4.5l1.5-1.5 1.5 1.5M9.75 9.5l1.5 1.5 1.5-1.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  chevron: (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <path d="M3 4.5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  close: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M3.5 3.5l7 7M10.5 3.5l-7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  copy: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <rect x="4.5" y="4.5" width="7.5" height="7.5" rx="1.6" stroke="currentColor" strokeWidth="1.4" />
      <path d="M9.5 2.5H3.3A1.3 1.3 0 002 3.8v5.7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  ),
};

// ── Shared chrome ─────────────────────────────────────────────────────────────

/** Panel card — same surface as a block row in the form editor. */
function PanelCard({ title, actions, children, className }: {
  title?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-[10px] p-[12px] rounded-[18px] border border-[var(--border)] bg-[var(--bg-4)]", className)}>
      {(title || actions) && (
        <div className="flex items-center justify-between gap-2 min-h-8">
          {title && <PillLabel>{title}</PillLabel>}
          {actions && <div className="flex items-center gap-1">{actions}</div>}
        </div>
      )}
      {children}
    </div>
  );
}

function EmptyNote({ children }: { children: ReactNode }) {
  return <p className="px-2 py-1 text-[13px] leading-5 text-[var(--text-subtitle)]">{children}</p>;
}

// ── Rail ──────────────────────────────────────────────────────────────────────

/** A tab of the icon rail, Figma-like: a small rounded square, grey when active; its name shows on hover. */
function RailButton({ icon, label, active, indicator, onClick }: {
  icon: ReactNode;
  label: string;
  active: boolean;
  indicator?: boolean;
  onClick: () => void;
}) {
  return (
    <div className="relative group/rail">
      <button
        type="button"
        aria-label={label}
        aria-pressed={active}
        onClick={onClick}
        className={cn(
          "flex items-center justify-center w-8 h-8 rounded-[8px] transition-colors cursor-pointer [&_svg]:w-4 [&_svg]:h-4",
          active
            ? "bg-[var(--bg-4)] text-[var(--text-title)]"
            : "text-[var(--text-subtitle)] hover:text-[var(--text-title)] hover:bg-[color-mix(in_srgb,var(--bg-4)_60%,transparent)]"
        )}
      >
        {icon}
      </button>
      {indicator && (
        <span aria-hidden className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-[var(--edit-accent)] ring-2 ring-[var(--bg-1)] pointer-events-none" />
      )}
      <span className="pointer-events-none absolute left-[calc(100%+8px)] top-1/2 -translate-y-1/2 z-50 hidden group-hover/rail:inline-flex items-center h-7 px-2.5 rounded-[8px] border border-[var(--border)] bg-[var(--bg-1)] text-[12px] font-medium text-[var(--text-title)] shadow-[0_8px_24px_rgba(0,0,0,0.08)] whitespace-nowrap">
        {label}
      </span>
    </div>
  );
}

// ── Canvas: overview ──────────────────────────────────────────────────────────

// ── Selection frame ───────────────────────────────────────────────────────────

/**
 * The lines on the canvas, as Figma's: a component's frame is drawn on its
 * edge; each layer holding it draws its own 4px further out — its Blok (see
 * groupOutline), its section (SECTION_BOX), the page (PAGE_LINE).
 */

/** Corner radius around plain text (it has no surface of its own). */
const TEXT_RADIUS = 8;
const TRANSPARENT = /^(transparent|rgba\(0, 0, 0, 0\))$/;

/**
 * First / last child that is part of the layout — skips floating toolbars,
 * remove buttons and hidden helpers (e.g. dnd-kit's screen-reader text).
 */
function flowChild(el: Element, edge: "top" | "bottom"): Element | null {
  const kids = Array.from(el.children);
  if (edge === "bottom") kids.reverse();
  return (
    kids.find((k) => {
      const { position, display } = getComputedStyle(k);
      if (display === "none" || position === "absolute" || position === "fixed") return false;
      const r = k.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    }) ?? null
  );
}

/**
 * Where the component's visible surface begins (top) or ends (bottom) — the
 * first card, image, bordered box or line of text along that edge, past any
 * layout padding — and its corner radius there.
 */
function surfaceEdge(root: HTMLElement, edge: "top" | "bottom"): { inset: number; radius: number } {
  const box = root.getBoundingClientRect();
  let el = flowChild(root, edge);
  while (el) {
    const r = el.getBoundingClientRect();
    const inset = Math.max(0, edge === "top" ? r.top - box.top : box.bottom - r.bottom);
    const style = getComputedStyle(el);
    const painted =
      !TRANSPARENT.test(style.backgroundColor) ||
      style.backgroundImage !== "none" ||
      parseFloat(edge === "top" ? style.borderTopWidth : style.borderBottomWidth) > 0 ||
      el instanceof HTMLImageElement || el instanceof HTMLVideoElement || el instanceof HTMLIFrameElement;
    if (painted) {
      const raw = edge === "top" ? style.borderTopLeftRadius : style.borderBottomLeftRadius;
      const px = raw.endsWith("%") ? (parseFloat(raw) / 100) * r.width : parseFloat(raw) || 0;
      return { inset, radius: Math.min(px, r.width / 2, r.height / 2) };
    }
    if (Array.from(el.childNodes).some((n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim())) {
      return { inset, radius: TEXT_RADIUS };
    }
    el = flowChild(el, edge);
  }
  return { inset: 0, radius: TEXT_RADIUS };
}

/**
 * Fits a component's selection frame to its visible surface — on its edge, with
 * its corners (the project theme's radius). Refits on hover and on every render
 * while selected. Returns [root ref, frame ref, fit].
 */
function useSelectionFrame(selected: boolean) {
  const root = useRef<HTMLElement | null>(null);
  const frame = useRef<HTMLDivElement | null>(null);
  const setRoot = useCallback((el: HTMLElement | null) => { root.current = el; }, []);
  const setFrame = useCallback((el: HTMLDivElement | null) => { frame.current = el; }, []);
  const fit = useCallback(() => {
    const r = root.current;
    const f = frame.current;
    if (!r || !f) return;
    const top = surfaceEdge(r, "top");
    const bottom = surfaceEdge(r, "bottom");
    f.style.top = `${top.inset}px`;
    f.style.bottom = `${bottom.inset}px`;
    f.style.borderRadius = `${top.radius}px ${top.radius}px ${bottom.radius}px ${bottom.radius}px`;
  }, []);
  useLayoutEffect(() => {
    if (selected) fit();
  });
  return [setRoot, setFrame, fit] as const;
}

/**
 * Box of a section on the canvas (the project overview counts as one): its
 * outline is drawn on the box edge, 10px around the Bloks on every side — 4px
 * outside theirs (the box reaches 10px into the page gutter, so the Bloks stay
 * where they are on the live page). Its corners follow the Bloks' (see
 * groupOutline), 5px further out.
 */
const SECTION_BOX = "relative -mx-[10px] w-[calc(100%+20px)] p-[10px]";
/**
 * Room between two sections, in place of the live page's 40px gap — the size
 * badge of a selected section sits in it.
 */
const SECTION_GAP = "mt-[52px]";

/**
 * Outline of a section: solid blue when selected; dashed in the lighter hover
 * blue while a click would select it (`data-canvas-hover`, see hoverOn), or
 * while one of its blocks is selected.
 */
function sectionOutline(selected: boolean, active: boolean) {
  return cn(
    // The corners of the Bloks' outlines (25px), 5px further out.
    "rounded-[30px] outline-1 -outline-offset-1 transition-[outline-color]",
    selected
      ? "outline-solid outline-[var(--edit-accent)]"
      : active
        ? "outline-dashed outline-[color-mix(in_srgb,var(--edit-accent)_40%,transparent)]"
        : "outline-dashed outline-transparent data-[canvas-hover]:outline-[color-mix(in_srgb,var(--edit-accent)_40%,transparent)] data-[layer-hover]:outline-[color-mix(in_srgb,var(--edit-accent)_70%,transparent)]"
  );
}

/**
 * The page frame's line, as a Figma frame's — only while it is selected (the
 * root layer) or hovered in the layers. It sits 4px outside its sections'
 * outlines: they reach 10px into the gutter on the sides (SECTION_BOX), none
 * above or below.
 */
const PAGE_LINE = "relative before:content-[''] before:pointer-events-none before:absolute before:-inset-x-[15px] before:-inset-y-[5px] before:rounded-[2px] before:border before:border-transparent";
const PAGE_LINE_HOVER = "data-[layer-hover]:before:border-[color-mix(in_srgb,var(--edit-accent)_60%,transparent)]";

/**
 * Outline of a Blok, 4px outside its components' frames (drawn on their edge)
 * and 4px inside its section's: solid green when selected; dashed and lighter
 * while one of its components is selected or a click would select it.
 */
function groupOutline(selected: boolean, active: boolean) {
  return cn(
    // 1.25rem (20px — corners of 25px out there): not a px class, which the project theme's radius would change (globals.css).
    "rounded-[1.25rem] outline-1 outline-offset-[4px] transition-[outline-color]",
    selected
      ? "outline-solid outline-[var(--edit-group)]"
      : active
        ? "outline-dashed outline-[color-mix(in_srgb,var(--edit-group)_40%,transparent)]"
        : cn(
            "outline-dashed outline-transparent data-[canvas-hover]:outline-[color-mix(in_srgb,var(--edit-group)_40%,transparent)]",
            // Hovered in the layer tree.
            "data-[layer-hover]:outline-[color-mix(in_srgb,var(--edit-group)_70%,transparent)]"
          )
  );
}

/**
 * What the size badge (SizeBadge) shows: the element `selector` finds, its
 * line `below` px under its bottom (under a component's frame with `frame`),
 * `padded` for the editor's 10px around a section (SECTION_BOX), in `tone`.
 */
type BadgeTarget = { selector: string; tone: string; below?: number; frame?: boolean; padded?: boolean };

/**
 * The selection's size (W × H), as Figma's: a small badge centred 4px under its
 * line, in its level's colour — the section's blue, the Blok's green, the
 * component's kind. It follows the element each frame while selected (typing,
 * images loading, the page moving). Render it in the canvas's `main`.
 */
function SizeBadge({ selector, tone, below = 0, frame = false, padded = false }: BadgeTarget) {
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

/** Where the component picker adds: into a Blok — after one of its components, at its end, or in a free cell. */
type PickerTarget = { groupId: string; afterBlockId?: string; cell?: { row: number; col: number } };

/**
 * A free cell of a section's grid (for Bloks and components) or a Blok's (for
 * components), in its place on the grid (from md up): a drop target while
 * something is dragged, and — on a selected section / Blok, or an empty one —
 * a "+" to add a child right there. Tinted in the level's colour (--edit-tone).
 */
function FreeCell({ level, containerId, row, col, tall, noun, onAdd }: {
  level: "section" | "group";
  containerId: string;
  row: number;
  col: number;
  /** In a row of its own (nothing else sets its height) */
  tall: boolean;
  noun: string;
  onAdd: () => void;
}) {
  const { setNodeRef, isOver } = useCellDrop({ level, containerId, row, col });
  const cell = cellProps({ row, col, span: 1 });
  return (
    <button
      ref={setNodeRef}
      type="button"
      data-no-drag
      title={`${row}. satır, ${col}. sütuna ${noun} ekle`}
      aria-label={`${row}. satır, ${col}. sütuna ${noun} ekle`}
      onClick={(e) => { e.stopPropagation(); onAdd(); }}
      style={cell.style}
      className={cn(
        cell.className,
        "group/cell hidden md:flex items-center justify-center self-stretch justify-self-stretch rounded-[12px] border border-dashed cursor-pointer transition-colors",
        tall ? "min-h-16" : "min-h-8",
        isOver
          ? "border-[var(--edit-tone,var(--edit-accent))] bg-[color-mix(in_srgb,var(--edit-tone,var(--edit-accent))_16%,transparent)]"
          : "border-[color-mix(in_srgb,var(--edit-tone,var(--edit-accent))_35%,transparent)] bg-[color-mix(in_srgb,var(--edit-tone,var(--edit-accent))_5%,transparent)] hover:bg-[color-mix(in_srgb,var(--edit-tone,var(--edit-accent))_12%,transparent)]"
      )}
    >
      <span className={cn("text-[var(--edit-tone,var(--edit-accent))] transition-opacity", isOver ? "opacity-100" : "opacity-0 group-hover/cell:opacity-100")}>
        {Icons.plus}
      </span>
    </button>
  );
}

/** Is the grid's content aligned to its middle or bottom (see GridSettings.align)? */
const lowered = (grid?: GridSettings) => grid?.align === "center" || grid?.align === "end";

/**
 * The free cells of a grid laid out as `cells`, in its set `rows` (see
 * gridRows) — those of one more row too when `newRow` (a row of its own, so
 * it only shows when asked for).
 */
function FreeCells({ level, containerId, cells, count, rows, newRow, noun, onAdd }: {
  level: "section" | "group";
  containerId: string;
  cells: Cell[];
  count: number;
  rows: number;
  newRow: boolean;
  noun: string;
  onAdd: (row: number, col: number) => void;
}) {
  const lastRow = Math.max(0, ...cells.map((c) => c.row));
  return freeCells(cells, count, rowCount(cells, rows, newRow))
    .map((f) => (
      <FreeCell
        key={`${f.row}:${f.col}`}
        level={level}
        containerId={containerId}
        row={f.row}
        col={f.col}
        tall={f.row > lastRow}
        noun={noun}
        onAdd={() => onAdd(f.row, f.col)}
      />
    ));
}

/**
 * 1px frame on a canvas component's edge, in its kind's colour — the first
 * child of the component (SizeBadge reads its bottom).
 */
function SelectionFrame({ frameRef, selected, dragging = false, dashed = false }: {
  frameRef: (el: HTMLDivElement | null) => void;
  selected: boolean;
  /** Being dragged: the frame becomes the lifted card behind the component */
  dragging?: boolean;
  /** An item inside is the actual selection: the block's frame turns dashed */
  dashed?: boolean;
}) {
  return (
    <div
      ref={frameRef}
      className={cn(
        "pointer-events-none absolute inset-0 z-20 border transition-colors duration-150",
        // Full colour when selected (or dragged), a lighter one while a click would select it (--edit-tone: the component's kind).
        selected || dragging
          ? cn("border-[var(--edit-tone,var(--edit-accent))]", dashed && !dragging && "border-dashed")
          : cn(
              "border-transparent group-data-[canvas-hover]/block:border-[color-mix(in_srgb,var(--edit-tone,var(--edit-accent))_40%,transparent)]",
              // Hovered in the layer tree.
              "group-data-[layer-hover]/block:border-[color-mix(in_srgb,var(--edit-tone,var(--edit-accent))_70%,transparent)]"
            ),
        dragging && "-z-10 bg-[var(--bg-1)] shadow-[0_18px_40px_rgba(0,0,0,0.18)]"
      )}
    />
  );
}

/** A piece of the overview with a block's frame (no drag / actions). */
function OverviewBlock({ part, selected, className, children }: {
  part: OverviewPart;
  selected: boolean;
  className?: string;
  children: ReactNode;
}) {
  const [rootRef, frameRef, fitFrame] = useSelectionFrame(selected);
  return (
    <div
      ref={rootRef}
      data-overview-part={part}
      // Its texts are edited in place (a double-click) while it is selected.
      data-live-selected={selected ? "" : undefined}
      onPointerEnter={fitFrame}
      // Selected on press (see pressOn); the click must not reach the canvas, which clears the selection.
      onClick={(e) => e.stopPropagation()}
      className={cn("group/block relative w-full", className)}
    >
      <SelectionFrame frameRef={frameRef} selected={selected} />
      {children}
    </div>
  );
}

/** The project overview (title, description, cover) — edited like a section of blocks. */
function LiveOverview({ project, lang, actions, selection }: {
  project: ProjectData;
  lang: Lang;
  actions: EditorActions;
  selection: Selection;
}) {
  const en = lang === "en";
  const active = selection.kind === "meta";
  const part = selection.kind === "meta" ? selection.part : undefined;
  return (
    <section
      id="live-overview"
      onClick={(e) => e.stopPropagation()}
      className={cn("group/section flex flex-col items-start scroll-mt-[64px]", SECTION_BOX, sectionOutline(active && !part, active))}
    >
      <OverviewBlock part="title" selected={part === "title"}>
        <EditableText
          as="h1"
          className="w-full text-base font-medium leading-5 text-[var(--text-title)]"
          value={en ? project.titleEn : project.title}
          onChange={(v) => actions.updateMeta(en ? { titleEn: v } : { title: v })}
          placeholder={en ? "Project title" : "Proje başlığı"}
        />
        <p className="w-full text-base font-normal leading-6 text-[var(--text-subtitle)]">
          <EditableText value={project.category} onChange={(v) => actions.updateMeta({ category: v })} placeholder="Kategori" />
          <span className="select-none"> · </span>
          <EditableText value={project.year} onChange={(v) => actions.updateMeta({ year: v })} placeholder="Yıl" />
        </p>
      </OverviewBlock>

      <OverviewBlock part="description" selected={part === "description"} className="mt-6">
        <EditableText
          as="p"
          multiline
          className="text-base font-light leading-7 text-[var(--text-p)] whitespace-pre-wrap"
          value={en ? project.descriptionEn : project.description}
          onChange={(v) => actions.updateMeta(en ? { descriptionEn: v } : { description: v })}
          placeholder={en ? "Project description…" : "Projeyi kısaca anlat…"}
        />
      </OverviewBlock>

      <OverviewBlock part="cover" selected={part === "cover"} className="mt-12">
        <div
          className="relative w-full rounded-[32px] border border-[var(--border)] bg-[var(--bg-2)] overflow-hidden"
          style={{ aspectRatio: "940/518" }}
        >
          {project.coverImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={project.coverImage} alt={project.title || project.slug} draggable={false} className="w-full h-full object-cover" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-sm font-light text-[var(--text-subtitle)] opacity-50 select-none">
              Kapak görseli — Proje sekmesinden ekle
            </div>
          )}
        </div>
      </OverviewBlock>
    </section>
  );
}

// ── Canvas: component (Bileşen) ───────────────────────────────────────────────

function LiveBlock({ block, group, cell, lang, actions, selected, selectedItemId, selectedText }: {
  block: Block;
  /** Its Blok: where it sits for drag & drop */
  group: Group;
  /** Its cell of the Blok's grid */
  cell: Cell;
  lang: Lang;
  actions: EditorActions;
  /** It, or an item inside it, is selected */
  selected: boolean;
  /** Item selected inside this block */
  selectedItemId: string | null;
  /** …or a text layer of that item */
  selectedText: ItemTextField | null;
}) {
  const { setNodeRef, listeners, transform, transition, isDragging } = useSortableBlock(block, group.id);
  const display = useMemo(() => localizeBlock(block, lang), [block, lang]);
  const edit = useMemo(
    () => createBlockEditApi(block, lang, (patch) => actions.updateBlock(block.id, patch)),
    [block, lang, actions]
  );
  const [rootRef, frameRef, fitFrame] = useSelectionFrame(selected);
  const blockEl = useRef<HTMLDivElement | null>(null);
  const place = cellProps(cell, gridFlow(group.grid) !== "grid" || Boolean(block.absolute));
  const size = sizeProps(block.size, true, block.cellAlign, gridFlow(group.grid));
  const free = absoluteProps(block.absolute);
  // A catalog component dragged over it: the line shows on which side it goes.
  const insertion = useInsertion();
  const line = insertion?.blockId === block.id ? insertion : null;

  // Mark the selected item — or text layer, its item then `data-child-selected` (SortableItem and the
  // text layers draw their lines in the block's colour for them).
  useLayoutEffect(() => {
    const root = blockEl.current;
    if (!root) return;
    root.querySelectorAll("[data-selected], [data-child-selected]").forEach((el) => {
      el.removeAttribute("data-selected");
      el.removeAttribute("data-child-selected");
    });
    const item = selectedItemId ? root.querySelector(`[data-entry-id="${selectedItemId}"]`) : null;
    const text = item && selectedText ? item.querySelector(`[data-text-layer="${selectedText}"]`) : null;
    if (text) {
      text.setAttribute("data-selected", "");
      item?.setAttribute("data-child-selected", "");
    } else item?.setAttribute("data-selected", "");
  });

  return (
    <div
      ref={(el) => { setNodeRef(el); rootRef(el); blockEl.current = el; }}
      data-live-block
      data-block-id={block.id}
      // --edit-tone: the colour of the component's kind — its frame, cards and hovered text.
      style={{ ...place.style, ...size.style, ...free.style, ...sortableStyle(transform, transition), "--edit-tone": blockTone(block.type) } as CSSProperties}
      {...listeners}
      // Its texts are edited in place (a double-click) while it, or an item inside it, is selected.
      data-live-selected={selected ? "" : undefined}
      onPointerEnter={fitFrame}
      // Selected on press (see pressOn); the click must not reach the canvas, which clears the selection.
      onClick={(e) => e.stopPropagation()}
      // Dragged: lifted above the page (a stacking context, so the frame's card sits right behind it).
      className={cn("group/block relative w-full", place.className, size.className, free.className, isDragging && "z-30 cursor-grabbing")}
    >
      <SelectionFrame frameRef={frameRef} selected={selected} dragging={isDragging} dashed={Boolean(selectedItemId)} />
      {line && (
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute z-40 rounded-full",
            line.horizontal
              ? cn("top-0 bottom-0 w-[3px]", line.before ? "-left-[10px]" : "-right-[10px]")
              : cn("left-0 right-0 h-[3px]", line.before ? "-top-[10px]" : "-bottom-[10px]")
          )}
          style={{ background: blockTone(line.blockType) }}
        />
      )}
      <FillHeightContext.Provider value={size.fillHeight}>
        <ProjectBlock block={display} edit={edit} lang={lang} />
      </FillHeightContext.Provider>
    </div>
  );
}

// ── Canvas: Blok (group) ──────────────────────────────────────────────────────

/**
 * A Blok on its section's grid, laying out its components on a grid of its
 * own. A click in its selected section selects it (see pressOn); drag it once
 * it is selected.
 */
function LiveGroup({ group, section, cell, lang, actions, selected, active, selectedBlockId, selectedItemId, selectedText, onInsert }: {
  group: Group;
  section: PageSection;
  /** Its cell of the section's grid */
  cell: Cell;
  lang: Lang;
  actions: EditorActions;
  selected: boolean;
  /** One of its components is selected */
  active: boolean;
  selectedBlockId: string | null;
  selectedItemId: string | null;
  selectedText: ItemTextField | null;
  /** Opens the component picker for this Blok: in a free cell, else at its end */
  onInsert: (at?: { cell?: { row: number; col: number } }) => void;
}) {
  const { setNodeRef, listeners, transform, transition, isDragging } = useSortableGroup(group, section.id);
  const place = cellProps(cell, gridFlow(section.grid) !== "grid" || Boolean(group.absolute));
  const size = sizeProps(group.size, false, group.cellAlign, gridFlow(section.grid));
  const free = absoluteProps(group.absolute);
  const grid = gridProps(group.grid);
  const columns = gridColumns(group.grid);
  const count = columns.length;
  const rows = gridRows(group.grid);
  const blockCells = layoutCells(group.blocks, count, rows);
  // Free cells: drop targets while a component is dragged, "+" while selected — or the empty Blok's placeholder.
  const drag = useActiveDrag();
  const dragged = drag?.kind === "block" || drag?.kind === "new";
  const empty = group.blocks.length === 0;
  // Free cells only on a grid: stacked / side by side, children just follow each other.
  const showCells = gridFlow(group.grid) === "grid" && (count > 1 || rows > 1) && (selected || dragged || empty);

  return (
    <div
      ref={setNodeRef}
      data-live-group
      data-group-id={group.id}
      style={{ ...place.style, ...grid.style, ...size.style, ...free.style, ...sortableStyle(transform, transition), "--edit-tone": GROUP_TONE } as CSSProperties}
      {...listeners}
      // Selected on press (see pressOn); the click must not reach the canvas, which clears the selection.
      onClick={(e) => e.stopPropagation()}
      className={cn(
        "group/blok relative",
        place.className,
        grid.className,
        size.className,
        free.className,
        groupOutline(selected || isDragging, active),
        isDragging && cn(DRAG_LIFT, "bg-[var(--bg-1)]")
      )}
    >
      <GroupBlocks group={group}>
        {group.blocks.map((block, i) => (
          <LiveBlock
            key={block.id}
            block={block}
            group={group}
            cell={blockCells[i]}
            lang={lang}
            actions={actions}
            selected={selectedBlockId === block.id}
            selectedItemId={selectedBlockId === block.id ? selectedItemId : null}
            selectedText={selectedBlockId === block.id ? selectedText : null}
          />
        ))}
      </GroupBlocks>

      {showCells && (
        <FreeCells
          level="group"
          containerId={group.id}
          cells={blockCells}
          count={count}
          rows={rows}
          // A new row only on demand (and when it has no set rows): while selected, empty, or while a component is dragged over it.
          // Not with its content in the middle / at the bottom: the row would sit under it and look like part of it.
          newRow={!rows && !lowered(group.grid) && (selected || empty || (dragged && drag?.overGroupId === group.id))}
          noun="bileşen"
          onAdd={(row, col) => onInsert({ cell: { row, col } })}
        />
      )}

      {empty && !showCells && (
        // An empty one-column Blok: add its first component — or drop one here (the Blok itself is the drop target).
        <button
          type="button"
          data-no-drag
          onClick={(e) => { e.stopPropagation(); onInsert(); }}
          className="col-span-full flex items-center justify-center gap-1.5 w-full h-16 rounded-[14px] border border-dashed border-[var(--border-hover)] text-[13px] text-[var(--text-subtitle)] hover:text-[var(--text-title)] hover:border-[color-mix(in_srgb,var(--edit-group)_40%,transparent)] transition-colors cursor-pointer"
        >
          {Icons.plus}
          Bileşen ekle
        </button>
      )}
    </div>
  );
}

// ── Canvas: section & divider ─────────────────────────────────────────────────

function LiveSection({ section, index, lang, actions, selected, active, selectedGroupId, activeGroupId, selectedBlockId, selectedItemId, selectedText, onSelect, onInsert }: {
  section: PageSection;
  index: number;
  lang: Lang;
  actions: EditorActions;
  selected: boolean;
  /** One of its Bloks or components is selected */
  active: boolean;
  selectedGroupId: string | null;
  /** The Blok holding the selected component */
  activeGroupId: string | null;
  selectedBlockId: string | null;
  selectedItemId: string | null;
  selectedText: ItemTextField | null;
  onSelect: (next: Selection) => void;
  /** Opens the component picker for a Blok */
  onInsert: (target: PickerTarget) => void;
}) {
  const { setNodeRef, setActivatorNodeRef, listeners, transform, transition, isDragging } = useSortablePageItem(section);
  const reordering = usePageReorder();
  const dropRef = useKeepDropPosition(isDragging);
  const ref = (el: HTMLElement | null) => { setNodeRef(el); dropRef(el); };
  const addGroup = () => onSelect({ kind: "group", groupId: actions.addGroup(section.id) });
  /** A new Blok in a free cell of the section's grid. */
  const addGroupAt = (row: number, col: number) => {
    const groupId = actions.addGroup(section.id);
    actions.placeGroup(groupId, section.id, row, col);
    onSelect({ kind: "group", groupId });
  };
  const drag = useActiveDrag();

  if (reordering) {
    const heading = sectionBlocks(section).find((b) => b.type === "heading");
    return (
      <section ref={ref} style={sortableStyle(transform, transition)} {...listeners} className={cn("relative w-full", isDragging && "z-30")}>
        <ReorderRow
          label={sectionName(section, index)}
          detail={heading ? localizeBlock(heading, lang).content : undefined}
          dragging={isDragging}
          activatorRef={setActivatorNodeRef}
        />
      </section>
    );
  }

  const grid = sectionFrameProps(section);
  const count = gridColumns(section.grid).length;
  const rows = gridRows(section.grid);
  const groupCells = layoutCells(section.groups, count, rows);
  // Free cells: drop targets while a Blok or component is dragged, "+" while selected — or the empty section's placeholder.
  const dragged = drag?.kind === "block" || drag?.kind === "group" || drag?.kind === "new";
  const empty = section.groups.length === 0;
  const showCells = gridFlow(section.grid) === "grid" && (count > 1 || rows > 1) && (selected || dragged || empty);

  return (
    <section
      ref={ref}
      data-section-id={section.id}
      style={sortableStyle(transform, transition)}
      {...listeners}
      // Selected on press (see pressOn); the click must not reach the canvas, which clears the selection.
      onClick={(e) => e.stopPropagation()}
      className={cn(
        // scroll-mt: some room above it when the layers panel scrolls here.
        "group/section flex flex-col gap-4 items-start scroll-mt-[64px]",
        SECTION_BOX,
        // The outline wraps its frame: narrower than the page (Hug / Fixed W), so is the outline.
        (section.size?.width ?? "fill") !== "fill" && "md:w-fit md:max-w-[calc(100%+20px)]",
        SECTION_GAP,
        sectionOutline(selected || isDragging, active),
        isDragging && cn(DRAG_LIFT, "bg-[var(--bg-1)]")
      )}
    >
      {(!empty || showCells) && (
        <div data-section-frame className={grid.className} style={grid.style}>
          <SectionGroups section={section}>
            {section.groups.map((group, i) => (
              <LiveGroup
                key={group.id}
                group={group}
                section={section}
                cell={groupCells[i]}
                lang={lang}
                actions={actions}
                selected={selectedGroupId === group.id}
                active={activeGroupId === group.id}
                selectedBlockId={selectedBlockId}
                selectedItemId={selectedItemId}
                selectedText={selectedText}
                onInsert={(at) => onInsert({ groupId: group.id, ...at })}
              />
            ))}
          </SectionGroups>
          {showCells && (
            <FreeCells
              level="section"
              containerId={section.id}
              cells={groupCells}
              count={count}
              rows={rows}
              // A new row only on demand (and when it has no set rows): while selected, empty, or while something is dragged over it.
              // Not with its content in the middle / at the bottom (see LiveGroup).
              newRow={!rows && !lowered(section.grid) && (selected || empty || (dragged && drag?.overSectionId === section.id))}
              noun="blok"
              onAdd={addGroupAt}
            />
          )}
        </div>
      )}

      {empty && !showCells && (
        <PillButton
          size="md"
          onClick={(e) => { e.stopPropagation(); addGroup(); }}
          startIcon={Icons.plus}
          className="w-full justify-center border-dashed border-[var(--border-hover)] hover:border-[var(--text-subtitle)]"
        >
          Bölüme blok ekle — ya da buraya bir blok sürükle
        </PillButton>
      )}
    </section>
  );
}

function LiveDivider({ divider, selected }: {
  divider: PageDivider;
  selected: boolean;
}) {
  const { setNodeRef, setActivatorNodeRef, listeners, transform, transition, isDragging } = useSortablePageItem(divider);
  const reordering = usePageReorder();
  const dropRef = useKeepDropPosition(isDragging);
  const ref = (el: HTMLElement | null) => { setNodeRef(el); dropRef(el); };

  if (reordering) {
    return (
      <div ref={ref} style={sortableStyle(transform, transition)} {...listeners} className={cn("relative w-full", isDragging && "z-30")}>
        <ReorderRow label="Ayırıcı" divider dragging={isDragging} activatorRef={setActivatorNodeRef} />
      </div>
    );
  }

  return (
    <div
      ref={ref}
      data-divider-id={divider.id}
      style={sortableStyle(transform, transition)}
      {...listeners}
      // Selected on press (see pressOn); the click must not reach the canvas, which clears the selection.
      onClick={(e) => e.stopPropagation()}
      className={cn(
        "relative w-full py-3 rounded-full outline-1 outline-offset-4 cursor-pointer transition-[outline-color]",
        // Solid when selected, as a section's.
        selected
          ? "outline-solid outline-[var(--edit-accent)]"
          : "outline-dashed outline-transparent data-[canvas-hover]:outline-[color-mix(in_srgb,var(--edit-accent)_40%,transparent)] data-[layer-hover]:outline-[color-mix(in_srgb,var(--edit-accent)_70%,transparent)]",
        isDragging && cn(DRAG_LIFT, "bg-[var(--bg-1)] outline-[var(--edit-accent)]")
      )}
    >
      <ProjectDivider />
    </div>
  );
}

// ── Panels ────────────────────────────────────────────────────────────────────

/** Where the selection lives ("02 Bölüm / Blok 1 / Kartlar"): a thin bar over the inspector; each step selects that level. */
function Crumbs({ items }: { items: { label: string; detail?: string; onClick: () => void }[] }) {
  return (
    <nav aria-label="Konum" className="flex items-center gap-0.5 min-h-9 px-3 py-1 flex-wrap border-b border-[var(--border)]">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-0.5 min-w-0">
          {i > 0 && <span className="text-[11px] text-[var(--text-subtitle)] select-none">/</span>}
          <button
            type="button"
            onClick={item.onClick}
            className="flex items-center gap-1 min-w-0 h-6 px-1.5 rounded-[4px] text-[11px] leading-4 text-[var(--text-subtitle)] hover:text-[var(--text-title)] hover:bg-[var(--bg-4)] transition-colors cursor-pointer"
          >
            <span className="shrink-0 font-medium text-[var(--text-title)]">{item.label}</span>
            {item.detail && <span className="min-w-0 truncate">{item.detail}</span>}
          </button>
        </span>
      ))}
    </nav>
  );
}

// ── Sections panel ────────────────────────────────────────────────────────────

/** Name of a section in the panel: its first heading. */
function sectionTitle(section: PageSection, lang: Lang) {
  const heading = sectionBlocks(section).find((b) => b.type === "heading");
  return heading ? plainText(localizeBlock(heading, lang).content) : undefined;
}

type SelectFromPanel = (next: Selection, opts?: { scroll?: boolean }) => void;

/** A layer on the canvas: what selecting it means, and its element. */
type Layer = { selection: Selection; el: HTMLElement };

/**
 * The layers under a point of the canvas, outermost first: section › Blok ›
 * component › the item under it (a card, a step, a list item…) — or the
 * overview › its part, or a divider.
 */
function layersAt(target: Element): Layer[] {
  const section = target.closest<HTMLElement>("[data-section-id]");
  if (section?.dataset.sectionId) {
    const layers: Layer[] = [{ selection: { kind: "section", sectionId: section.dataset.sectionId }, el: section }];
    const group = target.closest<HTMLElement>("[data-live-group]");
    if (!group?.dataset.groupId || !section.contains(group)) return layers;
    layers.push({ selection: { kind: "group", groupId: group.dataset.groupId }, el: group });
    const block = target.closest<HTMLElement>("[data-live-block]");
    const blockId = block?.dataset.blockId;
    if (!block || !blockId || !group.contains(block)) return layers;
    layers.push({ selection: { kind: "block", blockId }, el: block });
    const item = target.closest<HTMLElement>("[data-entry-id]");
    const itemId = item?.dataset.entryId;
    if (!item || !itemId || !block.contains(item)) return layers;
    layers.push({ selection: { kind: "block", blockId, itemId }, el: item });
    // A text layer of the item (a component laid out by its main component).
    const text = target.closest<HTMLElement>("[data-text-layer]");
    if (text?.dataset.textLayer && item.contains(text)) layers.push({ selection: { kind: "block", blockId, itemId, text: text.dataset.textLayer as ItemTextField }, el: text });
    return layers;
  }
  const overview = target.closest<HTMLElement>("#live-overview");
  if (overview) {
    const layers: Layer[] = [{ selection: { kind: "meta" }, el: overview }];
    const part = target.closest<HTMLElement>("[data-overview-part]");
    if (part && overview.contains(part)) layers.push({ selection: { kind: "meta", part: part.dataset.overviewPart as OverviewPart }, el: part });
    return layers;
  }
  const divider = target.closest<HTMLElement>("[data-divider-id]");
  return divider?.dataset.dividerId ? [{ selection: { kind: "divider", dividerId: divider.dataset.dividerId }, el: divider }] : [];
}

/** The same layers for a selection (the ones holding it, and itself). */
function selectionLayers(selection: Selection, items: PageItem[]): Selection[] {
  switch (selection.kind) {
    case "section":
      return [selection];
    case "group": {
      const found = findGroup(items, selection.groupId);
      return found ? [{ kind: "section", sectionId: found.section.id }, selection] : [];
    }
    case "block": {
      const found = findBlock(items, selection.blockId);
      if (!found) return [];
      const holders: Selection[] = [{ kind: "section", sectionId: found.section.id }, { kind: "group", groupId: found.group.id }, { kind: "block", blockId: selection.blockId }];
      if (!selection.itemId) return holders;
      const item: Selection = { kind: "block", blockId: selection.blockId, itemId: selection.itemId };
      return selection.text ? [...holders, item, selection] : [...holders, item];
    }
    case "meta":
      return selection.part ? [{ kind: "meta" }, selection] : [selection];
    case "divider":
      return [selection];
    default:
      return [];
  }
}

function layerKey(s: Selection): string {
  switch (s.kind) {
    case "section": return `section:${s.sectionId}`;
    case "group": return `group:${s.groupId}`;
    case "block": return s.text ? `text:${s.blockId}:${s.itemId}:${s.text}` : s.itemId ? `item:${s.blockId}:${s.itemId}` : `block:${s.blockId}`;
    case "meta": return `meta:${s.part ?? ""}`;
    case "divider": return `divider:${s.dividerId}`;
    default: return s.kind;
  }
}

/**
 * What a press on the canvas does, as in Figma — each click goes a level
 * deeper: the section, its Blok, the component, the item inside it (the
 * overview, then its part):
 * - Inside the selection, the selection stays — it is what a drag moves — and
 *   the click (`drill`) selects the layer one level down under the pointer.
 * - Elsewhere the layer beside the selection, or beside one of the layers
 *   holding it, is selected at once — the section when nothing is selected
 *   (a component of another Blok selects that Blok; the Blok's own area, the Blok).
 * - `deep` (Cmd / Ctrl held, as Figma's deep select): the innermost layer
 *   under the pointer at once — a list item or card inside a component too.
 * - A drag handle selects its own layer; the rest of a toolbar, nothing.
 * `armed`: the press is inside the selected component (or overview part), so
 * a double-click there edits its text and its own buttons work.
 */
function pressOn(target: Element, selected: Selection[], deep = false): { layer: Layer; drill: Layer | null; armed: boolean } | null {
  const handle = Boolean(target.closest("[data-drag-handle]"));
  if (target.closest("[data-no-drag]") && !handle) return null;
  const layers = layersAt(target);
  if (!layers.length) return null;
  if (handle) return { layer: layers[layers.length - 1], drill: null, armed: false };
  let shared = 0;
  while (shared < layers.length && shared < selected.length && layerKey(layers[shared].selection) === layerKey(selected[shared])) shared++;
  const leaf = selected.findIndex((s) => s.kind === "block" || (s.kind === "meta" && Boolean(s.part)));
  const armed = leaf >= 0 && shared > leaf;
  if (deep) return { layer: layers[layers.length - 1], drill: null, armed };
  const next = layers[Math.min(shared, layers.length - 1)];
  return selected.length > 0 && shared === selected.length ? { layer: layers[shared - 1], drill: next, armed } : { layer: next, drill: null, armed };
}

/** The layer a click at `target` would select — outlined on hover; a toolbar keeps its own layer's. */
function hoverOn(target: Element, selected: Selection[], deep = false): HTMLElement | null {
  if (target.closest("[data-no-drag]")) return layersAt(target).at(-1)?.el ?? null;
  const press = pressOn(target, selected, deep);
  return (press?.drill ?? press?.layer)?.el ?? null;
}

/** Cmd (Mac) / Ctrl held: a click picks the innermost layer (see pressOn). */
const deepSelect = (e: { metaKey: boolean; ctrlKey: boolean }) => e.metaKey || e.ctrlKey;

/** The same for a row of the sections panel. */
function layerPressTarget(target: Element): Selection | null {
  const row = target.closest<HTMLElement>("[data-layer-id]");
  const id = row?.dataset.layerId;
  if (!row || !id) return null;
  switch (row.dataset.layerKind) {
    case "block": return { kind: "block", blockId: id };
    case "group": return { kind: "group", groupId: id };
    case "section": return { kind: "section", sectionId: id };
    case "divider": return { kind: "divider", dividerId: id };
    default: return null;
  }
}

const isPrimaryPress = (e: React.PointerEvent) => e.button === 0 && e.isPrimary;

// ── Layers panel (Katmanlar) ──────────────────────────────────────────────────

const LayerIcons = {
  // Figma's frame, for the page's own (the root layer).
  frame: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <rect x="3" y="3" width="8" height="8" rx="1" stroke="currentColor" strokeWidth="1.3" />
      <path d="M1.5 3h1M11.5 3h1M1.5 11h1M11.5 11h1M3 1.5v1M11 1.5v1M3 11.5v1M11 11.5v1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  ),
  page: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M3.5 1.75h4.75L10.5 4v8.25h-7V1.75z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M8.25 1.75V4h2.25" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  ),
  // Figma's frame: a section.
  section: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M4.5 1.5v11M9.5 1.5v11M1.5 4.5h11M1.5 9.5h11" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  ),
  // A grid of its own: a Blok.
  group: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <rect x="2" y="2" width="4" height="4" rx="1" stroke="currentColor" strokeWidth="1.3" />
      <rect x="8" y="2" width="4" height="4" rx="1" stroke="currentColor" strokeWidth="1.3" />
      <rect x="2" y="8" width="4" height="4" rx="1" stroke="currentColor" strokeWidth="1.3" />
      <rect x="8" y="8" width="4" height="4" rx="1" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  ),
  divider: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M1.5 7h11" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  ),
  // An item of a component (a card, a row…): a frame of its own.
  item: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <rect x="2" y="3" width="10" height="8" rx="2" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  ),
  // Figma's text layer.
  text: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M3 3.5h8M7 3.5v7.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  ),
};

/** A component's icon, from the catalog (16px, drawn at 14px). */
function blockIcon(type: BlockType) {
  return <span className="flex items-center justify-center w-3.5 h-3.5 [&_svg]:w-3.5 [&_svg]:h-3.5">{BLOCK_DEFS.find((d) => d.type === type)?.icon}</span>;
}

/**
 * Hovering a layer outlines its element on the canvas (the canvas styles
 * `data-layer-hover` like its own hover).
 */
function hoverOnCanvas(selector: string, on: boolean) {
  document.querySelector(`main ${selector}`)?.toggleAttribute("data-layer-hover", on);
}

/** Icon button of a layer row, as in Figma: a small rounded square, tinted on hover. */
function LayerButton({ label, onClick, disabled = false, children }: { label: string; onClick: () => void; disabled?: boolean; children: ReactNode }) {
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
function LayerRow({ depth, tone, icon, name, selected, open, onToggle, hover, onSelect, onInspect, onRename, children }: {
  depth: number;
  tone: string;
  icon: ReactNode;
  name: string;
  selected: boolean;
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
      <span className="flex items-center justify-center w-4 h-4 shrink-0" style={{ color: tone }}>{icon}</span>
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
        <span className="min-w-0 truncate pl-0.5 font-medium text-[var(--text-title)]">{name}</span>
      )}
      {!renaming && (
        <div className="ml-auto flex items-center gap-0.5 shrink-0 opacity-0 group-hover/layer:opacity-100 focus-within:opacity-100 transition-opacity">
          {children}
          <LayerButton label="Düzenle" onClick={onInspect}>{Icons.edit}</LayerButton>
        </div>
      )}
    </div>
  );
}

/**
 * Figma's drop line: where the dragged row lands — above or below this row's
 * node, or first inside it (below its row, one level deeper).
 */
function DropLine({ place, depth }: { place: TreeDrop["place"] | null; depth: number }) {
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
const layerNode = (selected: boolean, dragging: boolean) =>
  cn(
    "relative flex flex-col rounded-[8px]",
    selected && "bg-[color-mix(in_srgb,var(--bg-4)_50%,transparent)]",
    // The dragged row stays where it is, dimmed — only the line moves.
    dragging && "opacity-40"
  );

/**
 * Components and items open in the layer tree (see LayerBlock) — they start
 * closed, as in Figma; a selection inside opens them (revealLayer).
 */
const OpenComponentsContext = createContext<{ open: ReadonlySet<string>; toggle: (id: string) => void }>({ open: new Set(), toggle: () => {} });

function LayerBlock({ block, group, selection, actions, onSelect }: {
  block: Block;
  /** Its Blok */
  group: Group;
  selection: Selection;
  actions: EditorActions;
  onSelect: SelectFromPanel;
}) {
  const { setNodeRef, listeners, isDragging } = useSortableBlock(block, group.id);
  const inside = selection.kind === "block" && selection.blockId === block.id;
  const selected = inside && !selection.itemId;
  const tone = blockTone(block.type);
  const select = () => onSelect({ kind: "block", blockId: block.id });
  const drop = useTreeDrop(block.id);
  const { open: opened, toggle } = useContext(OpenComponentsContext);
  // Laid out by its main component: its items, and their text layers, are layers too.
  const designed = DESIGNED_TYPES.has(block.type);
  const open = designed ? opened.has(block.id) : undefined;
  // A component with items (cards, rows, list items…): "+" adds one at its end and selects it.
  const noun = itemNoun(block);
  const addItem = () => {
    const { patch, id } = addEntry(block);
    actions.updateBlock(block.id, patch);
    onSelect({ kind: "block", blockId: block.id, itemId: id });
  };
  return (
    <div
      ref={setNodeRef}
      data-layer-id={block.id}
      data-layer-kind="block"
      {...listeners}
      className={layerNode(inside, isDragging)}
    >
      <DropLine place={drop} depth={2} />
      <LayerRow
        depth={2}
        tone={tone}
        icon={blockIcon(block.type)}
        name={blockName(block)}
        selected={selected}
        open={open}
        onToggle={() => toggle(block.id)}
        hover={`[data-block-id="${block.id}"]`}
        onSelect={select}
        onInspect={select}
        onRename={(name) => actions.updateBlock(block.id, { name })}
      >
        {noun && (
          <LayerButton label={`${noun} ekle`} onClick={addItem}>{Icons.plus}</LayerButton>
        )}
      </LayerRow>
      {open && (block.entries ?? []).map((entry) => (
        <LayerItem key={entry.id} block={block} itemId={entry.id} selection={selection} onSelect={onSelect} />
      ))}
    </div>
  );
}

/**
 * An item of a component (a card, a row…) in the layer tree, with its text
 * layers. Items are reordered on the canvas: its rows don't drag.
 */
function LayerItem({ block, itemId, selection, onSelect }: {
  block: Block;
  itemId: string;
  selection: Selection;
  onSelect: SelectFromPanel;
}) {
  const inside = selection.kind === "block" && selection.blockId === block.id && selection.itemId === itemId;
  const tone = blockTone(block.type);
  const { open: opened, toggle } = useContext(OpenComponentsContext);
  const texts = textLayersOf(block.type);
  const open = opened.has(itemId);
  const item = `[data-block-id="${block.id}"] [data-entry-id="${itemId}"]`;
  const select = () => onSelect({ kind: "block", blockId: block.id, itemId });
  return (
    <div data-layer-id={itemId} data-layer-kind="item" data-no-drag className={layerNode(inside, false)}>
      <LayerRow
        depth={3}
        tone={tone}
        icon={LayerIcons.item}
        name={itemName(block, itemId)}
        selected={inside && !selection.text}
        open={texts.length > 0 ? open : undefined}
        onToggle={() => toggle(itemId)}
        hover={item}
        onSelect={select}
        onInspect={select}
      />
      {open && texts.map((t) => {
        const pick = () => onSelect({ kind: "block", blockId: block.id, itemId, text: t.field });
        return (
          <div key={t.field} data-layer-id={`${itemId}:${t.field}`} data-layer-kind="text" data-no-drag>
            <LayerRow
              depth={4}
              tone={tone}
              icon={LayerIcons.text}
              name={t.name}
              selected={inside && selection.text === t.field}
              hover={`${item} [data-text-layer="${t.field}"]`}
              onSelect={pick}
              onInspect={pick}
            />
          </div>
        );
      })}
    </div>
  );
}

function LayerGroup({ group, index, section, selection, collapsed, onToggle, actions, onSelect, onAddBlock }: {
  group: Group;
  index: number;
  section: PageSection;
  selection: Selection;
  collapsed: Set<string>;
  onToggle: (id: string) => void;
  actions: EditorActions;
  onSelect: SelectFromPanel;
  onAddBlock: (groupId: string) => void;
}) {
  const { setNodeRef, listeners, isDragging } = useSortableGroup(group, section.id);
  const selected = selection.kind === "group" && selection.groupId === group.id;
  const open = !collapsed.has(group.id);
  const select = () => onSelect({ kind: "group", groupId: group.id });
  const drop = useTreeDrop(group.id);
  return (
    <div
      ref={setNodeRef}
      data-layer-id={group.id}
      data-layer-kind="group"
      {...listeners}
      className={layerNode(selected, isDragging)}
    >
      <DropLine place={drop} depth={1} />
      <LayerRow
        depth={1}
        tone={GROUP_TONE}
        icon={LayerIcons.group}
        name={groupName(group, index)}
        selected={selected}
        open={open}
        onToggle={() => onToggle(group.id)}
        hover={`[data-group-id="${group.id}"]`}
        onSelect={select}
        onInspect={select}
        onRename={(name) => actions.updateGroup(group.id, { name })}
      >
        <LayerButton label="Bloğa bileşen ekle" onClick={() => onAddBlock(group.id)}>{Icons.plus}</LayerButton>
      </LayerRow>
      {open && (
        <GroupBlocks group={group}>
          {group.blocks.map((block) => (
            <LayerBlock key={block.id} block={block} group={group} selection={selection} actions={actions} onSelect={onSelect} />
          ))}
          {group.blocks.length === 0 && (
            <p className="h-7 flex items-center pl-[56px] text-[12px] text-[var(--text-subtitle)] select-none">Boş — bir bileşen sürükle</p>
          )}
        </GroupBlocks>
      )}
    </div>
  );
}

function LayerSection({ section, index, selection, collapsed, onToggle, actions, onSelect, onAddBlock }: {
  section: PageSection;
  index: number;
  selection: Selection;
  collapsed: Set<string>;
  onToggle: (id: string) => void;
  actions: EditorActions;
  onSelect: SelectFromPanel;
  onAddBlock: (groupId: string) => void;
}) {
  const { setNodeRef, listeners, isDragging } = useSortablePageItem(section);
  const selected = selection.kind === "section" && selection.sectionId === section.id;
  const open = !collapsed.has(section.id);
  const select = () => onSelect({ kind: "section", sectionId: section.id });
  const drop = useTreeDrop(section.id);

  return (
    <div
      ref={setNodeRef}
      data-layer-id={section.id}
      data-layer-kind="section"
      {...listeners}
      className={layerNode(selected, isDragging)}
    >
      <DropLine place={drop} depth={0} />
      <LayerRow
        depth={0}
        tone={SECTION_TONE}
        icon={LayerIcons.section}
        name={sectionName(section, index)}
        selected={selected}
        open={open}
        onToggle={() => onToggle(section.id)}
        hover={`[data-section-id="${section.id}"]`}
        onSelect={select}
        onInspect={select}
        onRename={(name) => actions.updateSection(section.id, { name })}
      >
        <LayerButton label="Bölüme blok ekle" onClick={() => onSelect({ kind: "group", groupId: actions.addGroup(section.id) })}>{Icons.plus}</LayerButton>
      </LayerRow>
      {open && (
        <SectionGroups section={section}>
          {section.groups.map((group, i) => (
            <LayerGroup
              key={group.id}
              group={group}
              index={i}
              section={section}
              selection={selection}
              collapsed={collapsed}
              onToggle={onToggle}
              actions={actions}
              onSelect={onSelect}
              onAddBlock={onAddBlock}
            />
          ))}
          {section.groups.length === 0 && (
            <p className="h-7 flex items-center pl-[40px] text-[12px] text-[var(--text-subtitle)] select-none">Boş — bir blok sürükle ya da ekle</p>
          )}
        </SectionGroups>
      )}
    </div>
  );
}

function LayerDivider({ divider, selected, onSelect }: {
  divider: PageDivider;
  selected: boolean;
  onSelect: SelectFromPanel;
}) {
  const { setNodeRef, listeners, isDragging } = useSortablePageItem(divider);
  const drop = useTreeDrop(divider.id);

  return (
    <div
      ref={setNodeRef}
      data-layer-id={divider.id}
      data-layer-kind="divider"
      {...listeners}
      className={layerNode(false, isDragging)}
    >
      <DropLine place={drop} depth={0} />
      <LayerRow
        depth={0}
        tone="var(--text-subtitle)"
        icon={LayerIcons.divider}
        name="Ayırıcı"
        selected={selected}
        hover={`[data-divider-id="${divider.id}"]`}
        onSelect={() => onSelect({ kind: "divider", dividerId: divider.id })}
        onInspect={() => onSelect({ kind: "divider", dividerId: divider.id })}
      />
    </div>
  );
}

/** The root layer's key in the folded set (see LayersList). */
const PAGE_LAYER = "page";

/** The layer tree inside its own drag & drop context (see LayersPanel). */
function LayersList({ project, selection, collapsed, onToggle, actions, onSelect, onAddBlock }: {
  project: ProjectData;
  selection: Selection;
  /** Folded sections and Bloks */
  collapsed: Set<string>;
  onToggle: (id: string) => void;
  actions: EditorActions;
  onSelect: SelectFromPanel;
  /** Opens the component picker for a Blok */
  onAddBlock: (groupId: string) => void;
}) {
  let sectionIndex = 0;

  return (
    <div
      className="flex flex-col gap-px"
      // Whatever gets pressed (and maybe dragged) is selected at once; capture phase, so drag handling is untouched.
      onPointerDownCapture={(e) => {
        const next = isPrimaryPress(e) && !(e.target as Element).closest("button") ? layerPressTarget(e.target as Element) : null;
        if (next) onSelect(next, { scroll: false });
      }}
    >
      {/* The page's frame, named after the project — everything on the page sits in it, as in a Figma frame. */}
      <LayerRow
        depth={0}
        tone="var(--edit-accent)"
        icon={LayerIcons.frame}
        name={project.title?.trim() || "Sayfa"}
        selected={selection.kind === "page"}
        open={!collapsed.has(PAGE_LAYER)}
        onToggle={() => onToggle(PAGE_LAYER)}
        hover="[data-page-frame]"
        onSelect={() => onSelect({ kind: "page" })}
        onInspect={() => onSelect({ kind: "page" })}
      />

      {!collapsed.has(PAGE_LAYER) && (
      <div className="flex flex-col gap-px pl-4">
      <LayerRow
          depth={0}
          tone="var(--text-subtitle)"
          icon={LayerIcons.page}
          name="Proje bilgileri"
          selected={selection.kind === "meta"}
          hover="#live-overview"
          onSelect={() => onSelect({ kind: "meta" })}
          onInspect={() => onSelect({ kind: "meta" })}
        />

      {project.items.map((item) =>
        item.kind === "divider" ? (
          <LayerDivider
            key={item.id}
            divider={item}
            selected={selection.kind === "divider" && selection.dividerId === item.id}
            onSelect={onSelect}
          />
        ) : (
          <LayerSection
            key={item.id}
            section={item}
            index={sectionIndex++}
            selection={selection}
            collapsed={collapsed}
            onToggle={onToggle}
            actions={actions}
            onSelect={onSelect}
            onAddBlock={onAddBlock}
          />
        )
      )}

      {project.items.length === 0 && (
        <p className="px-2 py-4 text-[13px] text-center text-[var(--text-subtitle)]">Sayfada henüz bölüm yok.</p>
      )}
      </div>
      )}

      <div className="grid grid-cols-2 gap-2 pt-3">
        <PillButton size="md" onClick={() => actions.addSection()} startIcon={Icons.plus} className="justify-center">Bölüm ekle</PillButton>
        <PillButton size="md" onClick={() => actions.addDivider()} startIcon={Icons.plus} className="justify-center">Ayırıcı ekle</PillButton>
      </div>
    </div>
  );
}

/**
 * Katmanlar — the page as a tree, as in Figma: sections › Bloks ›
 * components, each folding open. Click to select (the canvas follows),
 * double-click to edit, hover to see it on the canvas. Everything reorders by
 * drag & drop here too — in a drag context of its own, so the canvas stays as
 * it is while the tree is dragged.
 */
function LayersPanel(props: Parameters<typeof LayersList>[0]) {
  const { project, actions, selection } = props;
  const selectedId =
    selection.kind === "block" ? selection.blockId
    : selection.kind === "group" ? selection.groupId
    : selection.kind === "section" ? selection.sectionId
    : selection.kind === "divider" ? selection.dividerId
    : null;

  // Follow the canvas: keep the selected row in view.
  useEffect(() => {
    if (selectedId) document.querySelector(`[data-layer-id="${selectedId}"]`)?.scrollIntoView({ block: "nearest" });
  }, [selectedId]);
  // A row hovered when the panel goes away leaves no outline behind.
  useEffect(() => () => document.querySelectorAll("[data-layer-hover]").forEach((el) => el.removeAttribute("data-layer-hover")), []);

  return (
    <ProjectDndProvider items={project.items} onItemsChange={actions.setItems} variant="tree">
      <LayersList {...props} />
    </ProjectDndProvider>
  );
}

// ── Components panel (Bileşenler) ─────────────────────────────────────────────

/**
 * A component in the catalog: drag it onto the page (a line shows where it
 * goes) or click to add it where the selection is. `blockId` is the id the
 * next copy gets — a fresh one after every drag, so the editor can select it.
 */
function CatalogTile({ type, onAdd }: { type: BlockType; onAdd: (type: BlockType) => void }) {
  const def = BLOCK_DEFS.find((d) => d.type === type);
  const [blockId, setBlockId] = useState(uid);
  const renew = ({ active }: { active: { id: string | number } }) => { if (active.id === `new:${type}`) setBlockId(uid()); };
  useDndMonitor({ onDragEnd: renew, onDragCancel: renew });
  const { setNodeRef, listeners, attributes, isDragging } = useNewBlockDrag(type, blockId);
  if (!def) return null;
  // A div, not a button: the editor's sensor never starts a drag from a button.
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      role="button"
      tabIndex={0}
      onClick={() => onAdd(type)}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onAdd(type); } }}
      title={def.description}
      style={{ "--edit-tone": blockTone(type) } as CSSProperties}
      className={cn(
        "flex flex-col items-start gap-2 p-2.5 rounded-[14px] border border-[var(--border)] bg-[var(--bg-1)] text-left cursor-grab touch-none transition-colors",
        "hover:border-[color-mix(in_srgb,var(--edit-tone)_50%,transparent)]",
        isDragging && "opacity-40"
      )}
    >
      <span className="flex items-center justify-center w-8 h-8 rounded-[10px] bg-[color-mix(in_srgb,var(--edit-tone)_12%,transparent)] text-[var(--edit-tone)]">
        {def.icon}
      </span>
      <span className="flex flex-col gap-0.5 min-w-0 w-full">
        <span className="text-[13px] font-medium leading-4 text-[var(--text-title)] truncate">{def.label}</span>
        <span className="text-[11px] leading-[14px] text-[var(--text-subtitle)] line-clamp-2">{def.description}</span>
      </span>
    </div>
  );
}

/** Bileşenler — every component, by kind, to drag onto the page (or click to add). */
function CatalogPanel({ target, onAdd }: {
  /** Where a click adds, in words */
  target: string;
  onAdd: (type: BlockType) => void;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLocaleLowerCase("tr");
  const matches = (type: BlockType) => {
    const def = BLOCK_DEFS.find((d) => d.type === type);
    return !q || Boolean(def && `${def.label} ${def.description}`.toLocaleLowerCase("tr").includes(q));
  };
  const kinds = BLOCK_GROUPS.map((kind) => ({ ...kind, types: kind.types.filter(matches) })).filter((kind) => kind.types.length > 0);

  return (
    <div className="flex flex-col gap-4">
      <Input type="search" size="md" bgContext="block" placeholder="Bileşen ara" value={query} onChange={(e) => setQuery(e.target.value)} />
      <p className="px-1 text-[12px] leading-4 text-[var(--text-subtitle)]">
        Sayfaya sürükleyip bırak — çizgi nereye gireceğini gösterir; boş bir hücreye de bırakabilirsin. Tıklarsan {target} eklenir.
      </p>
      {kinds.map((kind) => (
        <section key={kind.label} className="flex flex-col gap-2">
          <h3 className="flex items-center gap-2 px-1 text-[11px] font-medium uppercase tracking-widest text-[var(--text-subtitle)] select-none">
            <span aria-hidden className="w-2 h-2 rounded-full" style={{ background: kind.tone }} />
            {kind.label}
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {kind.types.map((type) => (
              <CatalogTile key={type} type={type} onAdd={onAdd} />
            ))}
          </div>
        </section>
      ))}
      {kinds.length === 0 && <EmptyNote>“{query}” ile eşleşen bileşen yok.</EmptyNote>}
    </div>
  );
}

function StatusRow({ label, ok, okText = "Var", missingText = "Eksik" }: { label: string; ok: boolean; okText?: string; missingText?: string }) {
  return (
    <div className="flex items-center justify-between h-10 px-4 rounded-full bg-[var(--bg-1)] text-[14px]">
      <span className="text-[var(--text-p)]">{label}</span>
      <span className={ok ? "font-medium text-[var(--text-title)]" : "text-[var(--text-subtitle)]"}>{ok ? okText : missingText}</span>
    </div>
  );
}

function PublishPanel({ project, slug, onLoadTemplate }: {
  project: ProjectData;
  slug: string;
  onLoadTemplate: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const path = `/projects/${slug}`;

  const sections = sectionsOf(project.items);
  const groups = sections.reduce((n, s) => n + s.groups.length, 0);
  const blocks = sections.reduce((n, s) => n + sectionBlocks(s).length, 0);
  const dividers = project.items.length - sections.length;

  function copy() {
    navigator.clipboard.writeText(`${window.location.origin}${path}`).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <PanelCard title="Bağlantı">
        <Input type="text" bgContext="block" size="md" value={path} readOnly className="tabular-nums" />
        <div className="grid grid-cols-2 gap-2">
          <PillButton size="md" bgContext="block" onClick={copy} startIcon={Icons.copy} className="justify-center">
            {copied ? "Kopyalandı" : "Kopyala"}
          </PillButton>
          <PillButton size="md" bgContext="block" onClick={() => window.open(path, "_blank")} startIcon={Icons.external} className="justify-center">
            Yeni sekmede aç
          </PillButton>
        </div>
      </PanelCard>

      <PanelCard title="İçerik durumu">
        <div className="grid grid-cols-4 gap-1.5">
          {[
            { value: sections.length, label: "Bölüm" },
            { value: groups, label: "Blok" },
            { value: blocks, label: "Bileşen" },
            { value: dividers, label: "Ayırıcı" },
          ].map((s) => (
            <div key={s.label} className="flex flex-col items-center gap-0.5 py-2.5 rounded-[14px] bg-[var(--bg-1)]">
              <span className="text-[20px] font-medium leading-7 text-[var(--text-title)] tabular-nums">{s.value}</span>
              <span className="text-[12px] leading-4 text-[var(--text-subtitle)]">{s.label}</span>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-1.5">
          <StatusRow label="Başlık (TR)" ok={Boolean(project.title)} />
          <StatusRow label="Başlık (EN)" ok={Boolean(project.titleEn)} />
          <StatusRow label="Açıklama (TR)" ok={Boolean(project.description)} />
          <StatusRow label="Açıklama (EN)" ok={Boolean(project.descriptionEn)} />
          <StatusRow label="Kapak görseli" ok={Boolean(project.coverImage)} />
        </div>
      </PanelCard>

      <PanelCard title="Şablon">
        <p className="px-1 text-[13px] leading-5 text-[var(--text-subtitle)]">
          Sayfanın içeriğini, bütün blokları kullanan vaka çalışması şablonuyla değiştirir.
        </p>
        <PillButton
          size="md"
          bgContext="block"
          className="justify-center"
          onClick={() => {
            if (window.confirm("Sayfanın mevcut içeriği şablonla değiştirilecek. Devam edilsin mi?")) onLoadTemplate();
          }}
        >
          Şablonu yükle
        </PillButton>
      </PanelCard>
    </div>
  );
}

// ── Live editor ───────────────────────────────────────────────────────────────

const TAB_TITLES: Record<Tab, string> = {
  layers: "Katmanlar",
  components: "Bileşenler",
  variables: "Değişkenler",
  theme: "Tema",
  publish: "Yayın",
};

export function LiveEditor({ project, lang, slug, companies, actions, designs, onDesign, variables, isStartingVariable, onVariable, onAddVariable, onRemoveVariable, onLoadTemplate }: {
  project: ProjectData;
  lang: Lang;
  slug: string;
  companies: string[];
  actions: EditorActions;
  /** The site's main components (see ComponentDesign) */
  designs: ComponentDesigns;
  /** Changes a type's main component — every instance, on every page */
  onDesign: (type: BlockType, design: ComponentDesign) => void;
  /** The site's design variables (see DesignVariable) */
  variables: DesignVariable[];
  /** One of the site's own tokens (it can only go back to its value, not be deleted) */
  isStartingVariable: (id: string) => boolean;
  onVariable: (variable: DesignVariable) => void;
  /** Adds a variable of that kind; returns its id */
  onAddVariable: (kind: VariableKind) => string;
  onRemoveVariable: (id: string) => void;
  onLoadTemplate: () => void;
}) {
  const [tab, setTab] = useState<Tab>("layers");
  const [rawSelection, setSelection] = useState<Selection>({ kind: "none" });
  // Where the component picker adds: a Blok, after one of its components or at its end.
  const [picker, setPicker] = useState<PickerTarget | null>(null);
  // Sections and Bloks folded in the layer tree (kept across tab switches).
  const [collapsedLayers, setCollapsedLayers] = useState<Set<string>>(() => new Set());
  // Components (and their items) open in the layer tree — they start closed, as in Figma.
  const [openComponents, setOpenComponents] = useState<Set<string>>(() => new Set());
  const toggleComponent = useCallback((id: string) => {
    setOpenComponents((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
  const layerSections = sectionsOf(project.items);
  const allLayersCollapsed = layerSections.length > 0 && layerSections.every((s) => collapsedLayers.has(s.id));
  /** Folds every section (the selected one too) — or opens everything, Bloks included. */
  const toggleAllLayers = (collapse: boolean) => setCollapsedLayers(collapse ? new Set(layerSections.map((s) => s.id)) : new Set());
  const reordering = usePageReorder();

  // Escape clears the selection (text fields handle their own Escape first).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape" || (document.activeElement as HTMLElement | null)?.isContentEditable) return;
      setSelection({ kind: "none" });
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // A deleted (or undone) element clears the selection.
  const selectedBlock = rawSelection.kind === "block" ? findBlock(project.items, rawSelection.blockId) : null;
  const selectedGroup = rawSelection.kind === "group" ? findGroup(project.items, rawSelection.groupId) : null;
  const selectedSection = rawSelection.kind === "section" ? findSection(project.items, rawSelection.sectionId) : null;
  const selectedDivider = rawSelection.kind === "divider" && project.items.some((i) => i.id === rawSelection.dividerId);
  const selection: Selection =
    (rawSelection.kind === "block" && !selectedBlock) ||
    (rawSelection.kind === "group" && !selectedGroup) ||
    (rawSelection.kind === "section" && !selectedSection) ||
    (rawSelection.kind === "divider" && !selectedDivider)
      ? { kind: "none" }
      : rawSelection;
  // An item that no longer exists (deleted, undone) falls back to its block.
  const selectedItemId =
    selection.kind === "block" && selection.itemId && selectedBlock && hasItem(selectedBlock.block, selection.itemId)
      ? selection.itemId
      : null;
  const selectedVariable = rawSelection.kind === "variable" ? variables.find((v) => v.id === rawSelection.variableId) ?? null : null;
  // A text layer of that item — of a component laid out by its main component.
  const selectedText =
    selection.kind === "block" && selectedItemId && selection.text && selectedBlock && textLayersOf(selectedBlock.block.type).some((t) => t.field === selection.text)
      ? selection.text
      : null;
  // Backspace / Delete removes the selection — the layer, or the card / item picked inside a
  // component — as in Figma; never while a field (text on the page, a layer's name…) is being typed in.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Backspace" && e.key !== "Delete") return;
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      // The raw selection: one that is already gone deletes nothing.
      const current = rawSelection;
      if (current.kind === "block") {
        // A text layer belongs to its main component: nothing to delete.
        if (selectedText) return;
        const found = selectedItemId ? findBlock(project.items, current.blockId) : null;
        if (found && selectedItemId) actions.updateBlock(found.block.id, removeItem(found.block, selectedItemId));
        else actions.deleteBlock(current.blockId);
      } else if (current.kind === "group") actions.deleteGroup(current.groupId);
      else if (current.kind === "section") actions.deleteItem(current.sectionId);
      else if (current.kind === "divider") actions.deleteItem(current.dividerId);
      else return;
      e.preventDefault();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [rawSelection, selectedItemId, selectedText, project.items, actions]);

  // The section and Blok holding the selection: their outlines stay lit.
  const activeSectionId = selectedBlock?.section.id ?? selectedGroup?.section.id ?? null;
  const activeGroupId = selectedBlock?.group.id ?? null;

  /**
   * A new selection opens the section and Blok holding it in the layer tree —
   * once: they fold again at will (also while it stays selected).
   */
  function revealLayer(next: Selection) {
    const block = next.kind === "block" ? findBlock(project.items, next.blockId) : null;
    const group = next.kind === "group" ? findGroup(project.items, next.groupId) : null;
    const ids = block ? [block.section.id, block.group.id] : group ? [group.section.id] : [];
    setCollapsedLayers((prev) => {
      if (!ids.some((id) => prev.has(id))) return prev;
      const open = new Set(prev);
      ids.forEach((id) => open.delete(id));
      return open;
    });
    // An item or text layer: its component (and item) open too — they start closed.
    if (next.kind !== "block" || !next.itemId) return;
    const inner = next.text ? [next.blockId, next.itemId] : [next.blockId];
    setOpenComponents((prev) => (inner.every((id) => prev.has(id)) ? prev : new Set([...prev, ...inner])));
  }

  /** Selecting shows the element in the inspector (right) and, with `scroll`, brings it into view on the canvas. */
  function select(next: Selection, { scroll = false } = {}) {
    setSelection(next);
    revealLayer(next);
    if (!scroll) return;
    // Next frame: the element may have just been added.
    requestAnimationFrame(() => {
      const target =
        next.kind === "block" && next.text ? document.querySelector(`[data-block-id="${next.blockId}"] [data-entry-id="${next.itemId}"] [data-text-layer="${next.text}"]`)
        : next.kind === "block" && next.itemId ? document.querySelector(`[data-block-id="${next.blockId}"] [data-entry-id="${next.itemId}"]`)
        : next.kind === "block" ? document.querySelector(`[data-block-id="${next.blockId}"]`)
        : next.kind === "group" ? document.querySelector(`[data-group-id="${next.groupId}"]`)
        : next.kind === "section" ? document.querySelector(`[data-section-id="${next.sectionId}"]`)
        : next.kind === "divider" ? document.querySelector(`[data-divider-id="${next.dividerId}"]`)
        : next.kind === "meta" ? document.getElementById("live-overview")
        : null;
      target?.scrollIntoView({ behavior: "smooth", block: next.kind === "section" || next.kind === "meta" ? "start" : "center" });
    });
  }

  // ── Picking on the canvas, as in Figma (see pressOn) ──
  const picked: Selection = selection.kind === "block" ? { kind: "block", blockId: selection.blockId, itemId: selectedItemId ?? undefined, text: selectedText ?? undefined } : selection;
  const pickedLayers = selectionLayers(picked, project.items);
  /** The last press: the layer its click goes down to — and whether it, and the one before it, was in the selected component. */
  const press = useRef<{ drill: Selection | null; armed: boolean; armedBefore: boolean }>({ drill: null, armed: false, armedBefore: false });
  // The layer a click would select carries `data-canvas-hover`: its hover outline.
  const hovered = useRef<HTMLElement | null>(null);
  const pointerOn = useRef<Element | null>(null);
  function showHover(el: HTMLElement | null) {
    if (hovered.current === el) return;
    hovered.current?.removeAttribute("data-canvas-hover");
    el?.setAttribute("data-canvas-hover", "");
    hovered.current = el;
  }
  // Cmd / Ctrl held (deep select): pressed or let go with the pointer still, the hover follows too.
  const [deep, setDeep] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => setDeep(deepSelect(e));
    const reset = () => setDeep(false);
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
    window.addEventListener("blur", reset);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
      window.removeEventListener("blur", reset);
    };
  }, []);
  // A new selection (or Cmd / Ctrl) changes what a click would select.
  useEffect(() => {
    const at = pointerOn.current;
    showHover(at?.isConnected ? hoverOn(at, pickedLayers, deep) : null);
  });

  /** A catalog click adds the component where the selection is: after the selected component, into the selected Blok or section, else at the page's end. */
  function addFromCatalog(type: BlockType) {
    const blockId = selectedBlock
      ? actions.addBlock(selectedBlock.group.id, type, undefined, selectedBlock.block.id)
      : selectedGroup
        ? actions.addBlock(selectedGroup.group.id, type)
        : selectedSection
          ? actions.addBlockToSection(selectedSection.section.id, type)
          : actions.addBlockToEnd(type);
    select({ kind: "block", blockId }, { scroll: true });
  }
  const catalogTarget = selectedBlock
    ? "seçili bileşenin arkasına"
    : selectedGroup
      ? `${groupName(selectedGroup.group, selectedGroup.index)} içine`
      : selectedSection
        ? `${sectionName(selectedSection.section, selectedSection.index)} içine`
        : "sayfanın sonuna";

  // A component dropped from the catalog becomes the selection (when it landed somewhere).
  useDndMonitor({
    onDragEnd({ active }) {
      const data = active.data.current as { type?: string; blockId?: string } | undefined;
      const blockId = data?.type === "new" ? data.blockId : undefined;
      if (!blockId) return;
      requestAnimationFrame(() => {
        if (document.querySelector(`[data-block-id="${blockId}"]`)) select({ kind: "block", blockId });
      });
    },
  });

  /** The first step of every trail: the section, with its title when it is the last step. */
  function sectionCrumb(section: PageSection, last: boolean) {
    return {
      label: sectionName(section, findSection(project.items, section.id)?.index ?? 0),
      detail: last ? sectionTitle(section, lang) : undefined,
      onClick: () => select({ kind: "section", sectionId: section.id }, { scroll: true }),
    };
  }

  /** Where the selected component / item sits: section › Blok (› component) — each step selects that level. */
  function blockCrumbs(found: NonNullable<typeof selectedBlock>, itemId: string | null) {
    const { section, group, block } = found;
    const crumbs = [
      sectionCrumb(section, false),
      {
        label: groupName(group, section.groups.findIndex((g) => g.id === group.id)),
        onClick: () => select({ kind: "group", groupId: group.id }, { scroll: true }),
      },
    ];
    if (itemId) crumbs.push({ label: blockName(block), onClick: () => select({ kind: "block", blockId: block.id }, { scroll: true }) });
    if (itemId && selectedText) crumbs.push({ label: itemName(block, itemId), onClick: () => select({ kind: "block", blockId: block.id, itemId }, { scroll: true }) });
    return crumbs;
  }

  // Left panel header: the tab's name and its actions.
  const panelTitle = TAB_TITLES[tab];
  let panelActions: ReactNode = null;
  if (tab === "layers") {
    panelActions = (
      <LayerButton label={allLayersCollapsed ? "Katmanları aç" : "Katmanları daralt"} onClick={() => toggleAllLayers(!allLayersCollapsed)}>
        {allLayersCollapsed ? Icons.expandLayers : Icons.collapseLayers}
      </LayerButton>
    );
  }
  if (tab === "theme" && project.theme) {
    panelActions = <PillButton size="sm" variant="ghost" onClick={() => actions.updateMeta({ theme: undefined })}>Varsayılana dön</PillButton>;
  }

  // Inspector header (right): what is selected and what can be done with it.
  let inspectorTitle = "Proje bilgileri";
  let inspectorActions: ReactNode = null;
  if (selectedBlock && selectedItemId && selectedText) {
    inspectorTitle = textLayersOf(selectedBlock.block.type).find((t) => t.field === selectedText)?.name ?? "Metin";
  } else if (selectedBlock && selectedItemId) {
    const { block } = selectedBlock;
    const itemId = selectedItemId;
    const update = (patch: Partial<Block>) => actions.updateBlock(block.id, patch);
    inspectorTitle = itemName(block, itemId);
    inspectorActions = (
      <>
        <LayerButton label="Yukarı taşı" disabled={!canMoveItem(block, itemId, -1)} onClick={() => update(moveItem(block, itemId, -1))}>{Icons.arrowUp}</LayerButton>
        <LayerButton label="Aşağı taşı" disabled={!canMoveItem(block, itemId, 1)} onClick={() => update(moveItem(block, itemId, 1))}>{Icons.arrowDown}</LayerButton>
        <LayerButton
          label="Çoğalt"
          onClick={() => {
            const { patch, id } = duplicateItem(block, itemId);
            update(patch);
            select({ kind: "block", blockId: block.id, itemId: id });
          }}
        >
          {Icons.duplicate}
        </LayerButton>
        <LayerButton label="Sil" onClick={() => update(removeItem(block, itemId))}>{Icons.trash}</LayerButton>
      </>
    );
  } else if (selectedBlock) {
    const { block } = selectedBlock;
    inspectorTitle = blockName(block);
    inspectorActions = (
      <>
        <LayerButton label="Çoğalt" onClick={() => select({ kind: "block", blockId: actions.duplicateBlock(block) })}>{Icons.duplicate}</LayerButton>
        <LayerButton label="Sil" onClick={() => actions.deleteBlock(block.id)}>{Icons.trash}</LayerButton>
      </>
    );
  } else if (selectedGroup) {
    const { group, index } = selectedGroup;
    inspectorTitle = groupName(group, index);
    inspectorActions = (
      <>
        <LayerButton label="Bileşen ekle" onClick={() => setPicker({ groupId: group.id })}>{Icons.plus}</LayerButton>
        <LayerButton label="Bloğu çoğalt" onClick={() => select({ kind: "group", groupId: actions.duplicateGroup(group.id) })}>{Icons.duplicate}</LayerButton>
        <LayerButton label="Bloğu sil" onClick={() => actions.deleteGroup(group.id)}>{Icons.trash}</LayerButton>
      </>
    );
  } else if (selectedSection) {
    const { section, index } = selectedSection;
    inspectorTitle = sectionName(section, index);
    inspectorActions = (
      <>
        <LayerButton label="Blok ekle" onClick={() => select({ kind: "group", groupId: actions.addGroup(section.id) })}>{Icons.plus}</LayerButton>
        <LayerButton label="Bölümü sil" onClick={() => actions.deleteItem(section.id)}>{Icons.trash}</LayerButton>
      </>
    );
  } else if (selection.kind === "page") {
    inspectorTitle = project.title?.trim() || "Sayfa";
  } else if (selection.kind === "divider") {
    const dividerId = selection.dividerId;
    inspectorTitle = "Ayırıcı";
    inspectorActions = <LayerButton label="Ayırıcıyı sil" onClick={() => actions.deleteItem(dividerId)}>{Icons.trash}</LayerButton>;
  } else if (selectedVariable) {
    const { id } = selectedVariable;
    inspectorTitle = selectedVariable.name;
    inspectorActions = isStartingVariable(id)
      ? <LayerButton label="Sitenin değerine dön" onClick={() => onRemoveVariable(id)}>{Icons.reset}</LayerButton>
      : <LayerButton label="Değişkeni sil" onClick={() => { onRemoveVariable(id); setSelection({ kind: "none" }); }}>{Icons.trash}</LayerButton>;
  }

  // The selected component's main component (see ComponentDesign), if its type has one; changes go to it — every instance.
  const blockDesign = selectedBlock && DESIGNED_TYPES.has(selectedBlock.block.type) ? resolveDesign(selectedBlock.block.type, designs) : null;
  const setMain = (patch: ComponentDesign) => {
    if (selectedBlock) onDesign(selectedBlock.block.type, { ...designs[selectedBlock.block.type], ...patch });
  };

  // The selection's size under its line (SizeBadge), in its level's colour — not while the page is the compact list.
  let badge: BadgeTarget | null = null;
  if (reordering) badge = null;
  else if (selectedBlock) {
    const { id, type } = selectedBlock.block;
    const item = `[data-block-id="${id}"] [data-entry-id="${selectedItemId}"]`;
    badge = selectedItemId
      ? { selector: selectedText ? `${item} [data-text-layer="${selectedText}"]` : item, tone: blockTone(type) }
      : { selector: `[data-block-id="${id}"]`, tone: blockTone(type), frame: true };
  } else if (selectedGroup) badge = { selector: `[data-group-id="${selectedGroup.group.id}"]`, tone: GROUP_TONE, below: 5 };
  else if (selectedSection) badge = { selector: `[data-section-id="${selectedSection.section.id}"]`, tone: SECTION_TONE, padded: true };
  else if (selection.kind === "meta") {
    badge = selection.part
      ? { selector: `[data-overview-part="${selection.part}"]`, tone: SECTION_TONE, frame: true }
      : { selector: "#live-overview", tone: SECTION_TONE, padded: true };
  } else if (selection.kind === "divider") badge = { selector: `[data-divider-id="${selection.dividerId}"]`, tone: SECTION_TONE, below: 5 };
  else if (selection.kind === "page") badge = { selector: "[data-page-frame]", tone: SECTION_TONE, below: 5 };

  let sectionIndex = 0;

  const pageFrame = pageFrameProps(project.frame);
  return (
    // Drags start as soon as the pointer moves (no press-and-hold wait) — for the
    // cards inside blocks and the sections panel too.
    <DragActivationContext.Provider value="press">
      <div className="flex h-full min-h-0">
        {/* ── Icon rail ── */}
        <nav aria-label="Editör araçları" className="w-12 shrink-0 h-full flex flex-col items-center gap-1 py-2 border-r border-[var(--border)] bg-[var(--bg-1)] z-20 select-none">
          <RailButton icon={RailIcons.layers} label="Katmanlar" active={tab === "layers"} onClick={() => setTab("layers")} />
          <RailButton icon={RailIcons.components} label="Bileşenler" active={tab === "components"} onClick={() => setTab("components")} />
          <RailButton icon={RailIcons.theme} label="Tema" active={tab === "theme"} onClick={() => setTab("theme")} />
          <RailButton icon={RailIcons.variables} label="Değişkenler" active={tab === "variables"} onClick={() => setTab("variables")} />
          <RailButton icon={RailIcons.publish} label="Yayın" active={tab === "publish"} onClick={() => setTab("publish")} />
        </nav>

        {/* ── Left panel: layers, components, theme, publish ── */}
        <aside className="w-[280px] shrink-0 h-full flex flex-col border-r border-[var(--border)] bg-[var(--bg-1)] z-10">
          <div className="shrink-0 flex items-center justify-between gap-2 h-11 pl-4 pr-2 border-b border-[var(--border)]">
            <h2 className="min-w-0 truncate text-[13px] font-semibold leading-4 text-[var(--text-title)] select-none">{panelTitle}</h2>
            <div className="flex items-center gap-0.5 shrink-0">{panelActions}</div>
          </div>

          {/* The site's own scrollbar; the layer tree runs almost edge to edge (4px), as in Figma. */}
          <ScrollArea
            className="flex-1 min-h-0"
            viewportClassName={cn("h-full overflow-x-hidden flex flex-col gap-3", tab === "layers" ? "px-1 py-4" : "p-4")}
            inset={8}
            edge={2}
          >
            {tab === "layers" && (
              <OpenComponentsContext.Provider value={{ open: openComponents, toggle: toggleComponent }}>
              <LayersPanel
                project={project}
                selection={selection}
                collapsed={collapsedLayers}
                onToggle={(id) =>
                  setCollapsedLayers((prev) => {
                    const next = new Set(prev);
                    if (next.has(id)) next.delete(id);
                    else next.add(id);
                    return next;
                  })
                }
                actions={actions}
                onSelect={(next, { scroll = true } = {}) => select(next, { scroll })}
                onAddBlock={(groupId) => setPicker({ groupId })}
              />
              </OpenComponentsContext.Provider>
            )}

            {tab === "components" && <CatalogPanel target={catalogTarget} onAdd={addFromCatalog} />}

            {tab === "theme" && (
              <ProjectThemeFields header={false} theme={project.theme} onChange={(theme) => actions.updateMeta({ theme })} />
            )}

            {tab === "variables" && (
              <VariablesPanel
                variables={variables}
                selectedId={selection.kind === "variable" ? selection.variableId : null}
                onSelect={(variableId) => select({ kind: "variable", variableId })}
                onAdd={(kind) => select({ kind: "variable", variableId: onAddVariable(kind) })}
              />
            )}

            {tab === "publish" && <PublishPanel project={project} slug={slug} onLoadTemplate={onLoadTemplate} />}

          </ScrollArea>
        </aside>

        {/* ── Canvas ── */}
        <div
          {...projectThemeAttrs(project.theme)}
          // The site's design variables apply inside it (DesignVariablesStyle), as on the project page.
          data-design-scope=""
          // No press-and-drag text selection on the canvas (it fights with hold-to-drag);
          // the field being edited opts back in. The settings panel stays selectable.
          className="flex-1 min-w-0 h-full overflow-y-auto bg-[var(--bg-1)] transition-colors duration-200 select-none"
          onClick={() => setSelection({ kind: "none" })}
          // Links stay put while editing; the click still reaches the text underneath.
          onClickCapture={(e) => { if ((e.target as Element).closest("a[href]")) e.preventDefault(); }}
          // No native image / link dragging — reordering is done with dnd-kit.
          onDragStart={(e) => e.preventDefault()}
        >
          <DesignVariablesStyle />
          {/* `relative`: the size badge (SizeBadge) is placed in it; `isolate`: the canvas's layers stay above its background. */}
          <main
            className={cn("relative isolate flex flex-col items-start w-full max-w-[720px] mx-auto px-6 pt-20 pb-40", reordering && REORDER_ROOM)}
            // A press selects a layer beside the selection at once, so whatever gets dragged is the selection
            // (capture phase: before the draggables under the pointer see it); inside it, the click goes a level down.
            onPointerDownCapture={(e) => {
              if (!isPrimaryPress(e)) return;
              const found = pressOn(e.target as Element, pickedLayers, deepSelect(e));
              press.current = { drill: found?.drill?.selection ?? null, armed: found?.armed ?? false, armedBefore: press.current.armed };
              if (!found) return;
              setDragTarget(e.nativeEvent, found.layer.el);
              if (!found.drill) select(found.layer.selection);
            }}
            // (No click follows a drag: dnd-kit swallows it.)
            onClickCapture={(e) => {
              const { drill, armed } = press.current;
              press.current.drill = null;
              if (drill && layerKey(drill) !== layerKey(picked)) select(drill);
              // A click that picks a component (or a layer above it) stops there: its texts, checkboxes,
              // "add item" buttons… answer the next one.
              const target = e.target as Element;
              if (!armed && target.closest("[data-live-block], [data-overview-part]") && !target.closest("[data-no-drag]")) e.stopPropagation();
            }}
            // A double-click edits a text only in the component selected before it — not in one its clicks just
            // picked — or straight away with Cmd / Ctrl held (deep select).
            onDoubleClickCapture={(e) => { if (!press.current.armedBefore && !deepSelect(e)) e.stopPropagation(); }}
            onPointerOver={(e) => {
              pointerOn.current = e.target as Element;
              if (deepSelect(e) !== deep) setDeep(deepSelect(e));
              showHover(hoverOn(e.target as Element, pickedLayers, deepSelect(e)));
            }}
            // Ctrl-click is the Mac's right click: on the canvas it deep-selects instead of opening the menu.
            onContextMenu={(e) => { if (e.ctrlKey) e.preventDefault(); }}
            onPointerLeave={() => {
              pointerOn.current = null;
              showHover(null);
            }}
          >
            {/*
              While reordering, the rows are as wide as the section outlines (10px into
              the gutter, like SECTION_BOX) and the list box sits another 14px outside them.
            */}
            {/* The page's frame (PageFrame): its sections and dividers, sized and aligned as set — the plain list while reordering. */}
            <div
              data-page-frame={reordering ? undefined : ""}
              className={
                reordering
                  ? cn(REORDER_LIST, "-mx-[24px] w-[calc(100%+48px)]")
                  : cn(pageFrame.className, PAGE_LINE, selection.kind === "page" ? "before:border-[var(--edit-accent)]" : PAGE_LINE_HOVER)
              }
              style={reordering ? undefined : pageFrame.style}
            >
              {/* While a section is dragged the page is just the compact list of sections. */}
              {!reordering && (
                <LiveOverview
                  project={project}
                  lang={lang}
                  actions={actions}
                  selection={selection}
                />
              )}
              {project.items.map((item) =>
                item.kind === "divider" ? (
                  <LiveDivider
                    key={item.id}
                    divider={item}
                    selected={selection.kind === "divider" && selection.dividerId === item.id}
                  />
                ) : (
                  <LiveSection
                    key={item.id}
                    section={item}
                    index={sectionIndex++}
                    lang={lang}
                    actions={actions}
                    selected={selection.kind === "section" && selection.sectionId === item.id}
                    active={activeSectionId === item.id}
                    selectedGroupId={selection.kind === "group" ? selection.groupId : null}
                    activeGroupId={activeGroupId}
                    selectedBlockId={selectedBlock?.block.id ?? null}
                    selectedItemId={selectedItemId}
                    selectedText={selectedText}
                    onSelect={(next) => select(next)}
                    onInsert={setPicker}
                  />
                )
              )}
            </div>

            {/* An empty page: under its header. */}
            {project.items.length === 0 && (
              <div className="flex flex-col items-center gap-3 w-full mt-10 py-12 rounded-[28px] border border-dashed border-[var(--border-hover)] text-center">
                <p className="text-sm text-[var(--text-subtitle)] select-none">Sayfa henüz boş</p>
                <div className="flex items-center gap-2">
                  <PillButton size="md" onClick={(e) => { e.stopPropagation(); onLoadTemplate(); }}>Şablondan başla</PillButton>
                  <PillButton size="md" onClick={(e) => { e.stopPropagation(); actions.addSection(); }}>Bölüm ekle</PillButton>
                </div>
              </div>
            )}

            {project.items.length > 0 && !reordering && (
              <div className="flex items-center justify-center gap-2 w-full mt-16">
                <PillButton size="md" startIcon={Icons.plus} onClick={(e) => { e.stopPropagation(); actions.addSection(); }}>
                  Bölüm ekle
                </PillButton>
                <PillButton size="md" startIcon={Icons.plus} onClick={(e) => { e.stopPropagation(); actions.addDivider(); }}>
                  Ayırıcı ekle
                </PillButton>
              </div>
            )}

            {badge && <SizeBadge {...badge} />}
          </main>
        </div>

        {/* ── Inspector (Düzenle): whatever is selected, the project when nothing is — as Figma's right panel ── */}
        <aside aria-label="Düzenle" className="w-[300px] shrink-0 h-full flex flex-col border-l border-[var(--border)] bg-[var(--bg-1)] z-10">
          <div className="shrink-0 flex items-center justify-between gap-2 h-11 pl-4 pr-2 border-b border-[var(--border)]">
            <h2 className="min-w-0 truncate text-[13px] font-semibold leading-4 text-[var(--text-title)] select-none">{inspectorTitle}</h2>
            <div className="flex items-center gap-0.5 shrink-0">
              {inspectorActions}
              {selection.kind !== "none" && (
                <LayerButton label="Seçimi kaldır (Esc)" onClick={() => setSelection({ kind: "none" })}>{Icons.close}</LayerButton>
              )}
            </div>
          </div>
          {/* Sections run full width, as in Figma's properties panel. */}
          <ScrollArea className="flex-1 min-h-0" viewportClassName="h-full overflow-x-hidden flex flex-col" inset={8} edge={2}>
            {selectedBlock ? (
              <div className="flex flex-col">
                <Crumbs items={blockCrumbs(selectedBlock, selectedItemId)} />
                {selectedItemId && selectedText && blockDesign ? (
                  <TextLayerInspector
                    block={selectedBlock.block}
                    itemId={selectedItemId}
                    field={selectedText}
                    design={blockDesign}
                    lang={lang}
                    onDesign={(layer) => setMain({ texts: { ...designs[selectedBlock.block.type]?.texts, [selectedText]: layer } })}
                    onChange={(u) => actions.updateBlock(selectedBlock.block.id, u)}
                  />
                ) : selectedItemId ? (
                  <ItemInspector
                    block={selectedBlock.block}
                    itemId={selectedItemId}
                    lang={lang}
                    projectSlug={slug}
                    layout={blockDesign && <ItemLayoutGroup block={selectedBlock.block} itemId={selectedItemId} design={blockDesign} onChange={(item) => setMain({ item })} />}
                    onChange={(u) => actions.updateBlock(selectedBlock.block.id, u)}
                  />
                ) : (
                  <BlockInspector
                    block={selectedBlock.block}
                    lang={lang}
                    projectSlug={slug}
                    placement={
                      <>
                        <PlacementGroup
                          measure={`[data-block-id="${selectedBlock.block.id}"]`}
                          absolute={selectedBlock.block.absolute}
                          onAbsolute={(absolute, was) =>
                            actions.updateBlock(selectedBlock.block.id, { absolute, ...(absolute ? { size: freeSize(selectedBlock.block.size, was) } : {}) })
                          }
                          index={selectedBlock.index}
                          siblings={selectedBlock.group.blocks}
                          labels={selectedBlock.group.blocks.map(blockName)}
                          parent={selectedBlock.group.grid}
                          onPlace={(row, col) => actions.placeBlock(selectedBlock.block.id, selectedBlock.group.id, row, col)}
                          onSwap={(otherId) => actions.swapBlocks(selectedBlock.group.id, selectedBlock.block.id, otherId)}
                          onSpan={(span) => actions.updateBlock(selectedBlock.block.id, { span })}
                        />
                        <SizeGroup
                          size={selectedBlock.block.size}
                          measure={`[data-block-id="${selectedBlock.block.id}"]`}
                          onChange={(size) => actions.updateBlock(selectedBlock.block.id, { size })}
                        />
                        {blockDesign && <ComponentLayoutGroup block={selectedBlock.block} design={blockDesign} onChange={(layout) => setMain({ layout })} />}
                      </>
                    }
                    onChange={(u) => actions.updateBlock(selectedBlock.block.id, u)}
                    onSelectEntry={(itemId) => select({ kind: "block", blockId: selectedBlock.block.id, itemId }, { scroll: true })}
                  />
                )}
              </div>
            ) : selectedGroup ? (
              <div className="flex flex-col">
                <Crumbs items={[sectionCrumb(selectedGroup.section, true)]} />
                <GroupInspector
                  group={selectedGroup.group}
                  section={selectedGroup.section}
                  lang={lang}
                  onChange={(patch) => actions.updateGroup(selectedGroup.group.id, patch)}
                  onPlace={(row, col) => actions.placeGroup(selectedGroup.group.id, selectedGroup.section.id, row, col)}
                  onSwap={(otherId) => actions.swapGroups(selectedGroup.section.id, selectedGroup.group.id, otherId)}
                  onAlign={(justify, align) => actions.alignGroup(selectedGroup.group.id, justify, align)}
                  onSelectBlock={(blockId) => select({ kind: "block", blockId }, { scroll: true })}
                  onAddBlock={() => setPicker({ groupId: selectedGroup.group.id })}
                />
              </div>
            ) : selectedSection ? (
              <div className="flex flex-col">
                <SectionInspector
                  section={selectedSection.section}
                  onChange={(patch) => actions.updateSection(selectedSection.section.id, patch)}
                  onAlign={(justify, align) => actions.alignSection(selectedSection.section.id, justify, align)}
                  onSelectGroup={(groupId) => select({ kind: "group", groupId }, { scroll: true })}
                  onAddGroup={() => select({ kind: "group", groupId: actions.addGroup(selectedSection.section.id) }, { scroll: true })}
                />
              </div>
            ) : selection.kind === "page" ? (
              <PageFrameInspector project={project} onChange={(frame) => actions.updateMeta({ frame })} />
            ) : selection.kind === "divider" ? (
              <p className="px-4 py-3 text-[11px] leading-4 text-[var(--text-subtitle)]">Bölümler arasındaki çizgi. Seçip sürükleyerek taşıyabilirsin.</p>
            ) : selectedVariable ? (
              <VariableInspector variable={selectedVariable} variables={variables} onChange={onVariable} />
            ) : (
              // Nothing selected: the inspector is never empty — it shows the project settings.
              <ProjectInspector project={project} lang={lang} slug={slug} companies={companies} onChange={actions.updateMeta} />
            )}
          </ScrollArea>
        </aside>

        {picker && (
          <BlockPickerDialog
            onPick={(type: BlockType, extras) => {
              const blockId = actions.addBlock(picker.groupId, type, extras, picker.afterBlockId);
              if (picker.cell) actions.placeBlock(blockId, picker.groupId, picker.cell.row, picker.cell.col);
              select({ kind: "block", blockId });
            }}
            onClose={() => setPicker(null)}
          />
        )}
      </div>
    </DragActivationContext.Provider>
  );
}
