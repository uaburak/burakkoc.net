"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useDndMonitor } from "@dnd-kit/core";
import { Block, BlockType, Group, PageDivider, PageItem, PageSection, ProjectData } from "@/types/project";
import { cn } from "@/lib/utils";
import { findBlock, findGroup, freeCells, gridColumns, layoutCells, layoutName, sectionBlocks, sectionsOf, type Cell } from "@/lib/projectLayout";
import { IconButton, PillButton } from "@/components/Button";
import { Input } from "@/components/Input";
import { ScrollArea } from "@/components/ScrollArea";
import { ProjectBlock, ProjectDivider } from "@/components/project/CoreBlocks";
import { cellProps, gridProps } from "@/components/project/LayoutGrid";
import { EditableText } from "@/components/project/Editable";
import { DRAG_LIFT, DragActivationContext, DragHandle } from "@/components/project/Sortable";
import { createBlockEditApi, editorUid, localizeBlock, type BlockEditApi } from "@/components/project/editing";
import { projectThemeAttrs } from "@/components/project/projectTheme";
import { PillLabel } from "@/components/admin/FormEditor";
import { ProjectThemeFields } from "@/components/admin/ProjectThemeFields";
import {
  BlockInspector,
  GroupInspector,
  ItemInspector,
  PlacementGroup,
  ProjectInspector,
  SectionInspector,
  canMoveItem,
  duplicateItem,
  hasItem,
  itemName,
  moveItem,
  plainText,
  removeItem,
} from "@/components/admin/LiveInspector";
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
 *   components. Click a text to type in place, click a component, a Blok or a
 *   section to select it (its settings open in the panel). Press and hold
 *   cards, components, Bloks and sections — or use their grip — to reorder
 *   them; components can move between Bloks, Bloks between sections.
 * - Links never navigate here, images never open the lightbox.
 */

type Lang = "tr" | "en";
type Selection =
  | { kind: "none" }
  | { kind: "meta"; part?: OverviewPart }
  | { kind: "section"; sectionId: string }
  | { kind: "group"; groupId: string }
  | { kind: "block"; blockId: string; /** An item clicked inside the block (card, step, list item…) */ itemId?: string }
  | { kind: "divider"; dividerId: string };
/** The left panel's tabs; the inspector (Düzenle) has a panel of its own, on the right. */
type Tab = "layers" | "components" | "theme" | "publish";
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

// ── Entry blocks: what "+" adds ───────────────────────────────────────────────

const ADD_ITEM_LABEL: Partial<Record<BlockType, string>> = {
  links: "Bağlantı ekle", tags: "Etiket ekle", info: "Satır ekle", stats: "Metrik ekle",
  cards: "Kart ekle", steps: "Adım ekle", gallery: "Görsel ekle", accordion: "Madde ekle",
  bars: "Çubuk ekle", persona: "Grup ekle", team: "Kişi ekle", palette: "Renk ekle",
  mockup: "Ekran ekle", list: "Öğe ekle", table: "Satır ekle",
};

/** Adds an empty card / row / item at the end of an entry, list or table block. */
function addItem(block: Block, edit: BlockEditApi, onChange: (patch: Partial<Block>) => void) {
  if (block.type === "list") edit.addListItem();
  else if (block.type === "table") {
    const rows = block.tableRows ?? [];
    const cols = Math.max(1, ...rows.map((r) => r.cells.length));
    onChange({ tableRows: [...rows, { id: editorUid("row"), cells: Array(cols).fill("") }] });
  } else edit.addEntry();
}

// ── Icons (20px rail / 14px toolbar, 1.5 stroke like the rest of the site) ─────

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
  publish: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
      <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.5" />
      <path d="M3 10h14M10 3c1.8 1.9 2.7 4.2 2.7 7s-.9 5.1-2.7 7c-1.8-1.9-2.7-4.2-2.7-7S8.2 4.9 10 3z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  ),
};

const Icons = {
  plus: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M7 2.5v9M2.5 7h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  insertBelow: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <rect x="2" y="1.75" width="10" height="4.5" rx="1.25" stroke="currentColor" strokeWidth="1.4" />
      <path d="M7 8.25v4M5 10.25h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
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

/** Borderless icon button for toolbars and card headers (IconButton, xs). */
function ToolButton({ label, onClick, disabled = false, children }: { label: string; onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <IconButton
      size="xs"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className="border-transparent bg-transparent text-[var(--text-subtitle)] hover:text-[var(--text-title)] disabled:opacity-30 disabled:pointer-events-none"
    >
      {children}
    </IconButton>
  );
}

const handleClass = "w-7 h-7 rounded-full text-[var(--text-subtitle)] hover:text-[var(--text-title)] hover:bg-[var(--bg-4)]";

/** Floating pill toolbar used above blocks and sections on the canvas. */
function ChromeBar({ className, accent = false, children }: { className?: string; accent?: boolean; children: ReactNode }) {
  return (
    <div
      data-no-drag
      onClick={(e) => e.stopPropagation()}
      className={cn(
        "flex items-center gap-0.5 h-9 p-1 rounded-full border shadow-[0_8px_24px_rgba(0,0,0,0.08)] transition-opacity duration-150",
        accent
          // Section / Blok label: the level's colour (blue, or green inside a Blok), white content.
          ? "border-transparent bg-[var(--edit-tone,var(--edit-accent))] text-white [&_button]:text-white [&_button:hover]:bg-white/15 [&_button:hover]:border-transparent"
          : "border-[var(--border)] bg-[var(--bg-1)]",
        className
      )}
    >
      {children}
    </div>
  );
}

/** Name in a canvas toolbar; clicking it selects that block / section. */
function ChromeLabel({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className="inline-flex items-center gap-1.5 h-7 px-2 rounded-full text-[13px] font-medium leading-5 text-[var(--text-title)] whitespace-nowrap hover:bg-[var(--bg-4)] transition-colors cursor-pointer"
    >
      {children}
    </button>
  );
}

/** The colour of the level / component kind it sits in (--edit-tone). */
function ToneDot() {
  return <span aria-hidden className="w-2 h-2 shrink-0 rounded-full bg-[var(--edit-tone,var(--edit-accent))]" />;
}

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

/** Corner radius around plain text (it has no surface of its own). */
const TEXT_RADIUS = 8;
/**
 * The block frame sits 5px outside the component (+ its 1px border): blocks are
 * 16px apart, so two frames keep 4px between them — and 4px to the section
 * outline (SECTION_BOX's 10px padding).
 */
const FRAME_GAP = 6;
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
 * Fits a component's selection frame to its visible surface (and the project
 * theme's radius). Refits on hover and on every render while selected.
 * Returns [root ref, frame ref, fit].
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
    const t = top.radius + FRAME_GAP;
    const b = bottom.radius + FRAME_GAP;
    f.style.top = `${top.inset - FRAME_GAP}px`;
    f.style.bottom = `${bottom.inset - FRAME_GAP}px`;
    f.style.borderRadius = `${t}px ${t}px ${b}px ${b}px`;
  }, []);
  useLayoutEffect(() => {
    if (selected) fit();
  });
  return [setRoot, setFrame, fit] as const;
}

/**
 * Invisible hit area reaching out to where a block's frame is drawn, so hovering
 * or clicking right on the line already counts. It sits at z -1 (inside the
 * canvas's isolated `main`): any neighbouring content stays on top.
 */
const HOVER_RING_BLOCK = "before:content-[''] before:absolute before:-inset-[6px] before:-z-10";

/**
 * Box of a section on the canvas (the project overview counts as one): its
 * dashed outline is drawn on the box edge, 10px around the blocks on every side
 * (the box reaches 10px into the page gutter, so the blocks stay where they are
 * on the live page).
 */
const SECTION_BOX = "relative -mx-[10px] w-[calc(100%+20px)] p-[10px]";
/**
 * Room above a section for its label, in place of the live page's 40px gap
 * between sections — so the label never covers the content above it.
 */
const SECTION_GAP = "mt-[52px]";

/**
 * Dashed outline of a section: full blue when selected, the lighter hover blue
 * while it or one of its blocks is hovered, or while one of its blocks is selected.
 */
function sectionOutline(selected: boolean, active: boolean) {
  return cn(
    "rounded-[24px] outline-dashed outline-1 -outline-offset-1 transition-[outline-color]",
    selected
      ? "outline-[var(--edit-accent)]"
      : active
        ? "outline-[color-mix(in_srgb,var(--edit-accent)_40%,transparent)]"
        : "outline-transparent hover:outline-[color-mix(in_srgb,var(--edit-accent)_40%,transparent)] data-[layer-hover]:outline-[color-mix(in_srgb,var(--edit-accent)_70%,transparent)]"
  );
}

/** The section label's top, relative to the section box (h-9 label + 4px gap above it). */
const SECTION_LABEL_OFFSET = -40;

/**
 * Section label, just above the dashed outline (top left), in the room left by
 * SECTION_GAP. A small bridge under it keeps the section hovered while the
 * pointer moves up onto it. It shows at once on hover and lingers for 2s after
 * the pointer leaves (still clickable), then fades out.
 */
const sectionChromeClass = (active: boolean) =>
  cn(
    "absolute left-0 -top-1 -translate-y-full z-30",
    "after:content-[''] after:absolute after:inset-x-0 after:top-full after:h-[5px]",
    "transition-[opacity,visibility] duration-150",
    active
      ? "visible opacity-100"
      : "invisible opacity-0 delay-[2000ms] group-hover/section:visible group-hover/section:opacity-100 group-hover/section:delay-0"
  );

/** The section label inside a section (see useKeepDropPosition's `linger`). */
const SECTION_LABEL = ":scope > [data-no-drag]";

/**
 * Dashed outline of a Blok, 8px around its components — between their frames
 * (6px) and the section outline (10px). Green when selected, lighter while one
 * of its components is selected or its own area (not a component) is hovered.
 */
function groupOutline(selected: boolean, active: boolean) {
  return cn(
    "rounded-[20px] outline-dashed outline-1 outline-offset-[7px] transition-[outline-color]",
    selected
      ? "outline-[var(--edit-group)]"
      : active
        ? "outline-[color-mix(in_srgb,var(--edit-group)_40%,transparent)]"
        : cn(
            "outline-transparent hover:outline-[color-mix(in_srgb,var(--edit-group)_40%,transparent)]",
            "has-[[data-live-block]:hover]:outline-transparent",
            // Hovered in the layer tree.
            "data-[layer-hover]:outline-[color-mix(in_srgb,var(--edit-group)_70%,transparent)]"
          )
  );
}

/**
 * A Blok's label, under its outline (bottom left) — the section label is top
 * left and the components' toolbars top right. A bridge above it keeps the Blok
 * hovered on the way down. It shows while the Blok's own area is hovered.
 */
const groupChromeClass = (visible: boolean) =>
  cn(
    "absolute -left-[8px] top-[calc(100%+12px)] z-30",
    "before:content-[''] before:absolute before:inset-x-0 before:bottom-full before:h-[13px]",
    visible
      ? "opacity-100 pointer-events-auto"
      : cn(
          "opacity-0 pointer-events-none group-hover/blok:opacity-100 group-hover/blok:pointer-events-auto",
          "group-has-[[data-live-block]:hover]/blok:opacity-0 group-has-[[data-live-block]:hover]/blok:pointer-events-none"
        )
  );

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
        "group/cell hidden md:flex items-center justify-center self-stretch rounded-[12px] border border-dashed cursor-pointer transition-colors",
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

/**
 * The free cells of a grid laid out as `cells` — those of one more row too
 * when `newRow` (a row of its own, so it only shows when asked for).
 */
function FreeCells({ level, containerId, cells, count, newRow, noun, onAdd }: {
  level: "section" | "group";
  containerId: string;
  cells: Cell[];
  count: number;
  newRow: boolean;
  noun: string;
  onAdd: (row: number, col: number) => void;
}) {
  const lastRow = Math.max(0, ...cells.map((c) => c.row));
  return freeCells(cells, count)
    .filter((f) => newRow || f.row <= lastRow)
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

/** 1px frame around a canvas component, in its kind's colour; it also anchors the component's toolbar. */
function SelectionFrame({ frameRef, selected, dragging = false, dashed = false, children }: {
  frameRef: (el: HTMLDivElement | null) => void;
  selected: boolean;
  /** Being dragged: the frame becomes the lifted card behind the component */
  dragging?: boolean;
  /** An item inside is the actual selection: the block's frame turns dashed */
  dashed?: boolean;
  children?: ReactNode;
}) {
  return (
    <div
      ref={frameRef}
      className={cn(
        "pointer-events-none absolute -inset-[6px] z-20 border transition-colors duration-150",
        // Full colour when selected (or dragged), a lighter one on hover (--edit-tone: the component's kind).
        selected || dragging
          ? cn("border-[var(--edit-tone,var(--edit-accent))]", dashed && !dragging && "border-dashed")
          : cn(
              "border-transparent group-hover/block:border-[color-mix(in_srgb,var(--edit-tone,var(--edit-accent))_40%,transparent)]",
              // Hovered in the layer tree.
              "group-data-[layer-hover]/block:border-[color-mix(in_srgb,var(--edit-tone,var(--edit-accent))_70%,transparent)]"
            ),
        dragging && "-z-10 bg-[var(--bg-1)] shadow-[0_18px_40px_rgba(0,0,0,0.18)]"
      )}
    >
      {!dragging && children}
    </div>
  );
}

/** A piece of the overview with a block's hover frame and label (no drag / actions). */
function OverviewBlock({ label, selected, onSelect, className, children }: {
  label: string;
  selected: boolean;
  onSelect: () => void;
  className?: string;
  children: ReactNode;
}) {
  const [rootRef, frameRef, fitFrame] = useSelectionFrame(selected);
  return (
    <div
      ref={rootRef}
      onPointerEnter={fitFrame}
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
      className={cn("group/block relative w-full", HOVER_RING_BLOCK, className)}
    >
      <SelectionFrame frameRef={frameRef} selected={selected}>
        <ChromeBar
          className={cn(
            "absolute -top-1 -right-px -translate-y-full",
            selected ? "opacity-100 pointer-events-auto" : "opacity-0 group-hover/block:opacity-100 group-hover/block:pointer-events-auto"
          )}
        >
          <ChromeLabel onClick={onSelect}>{label}</ChromeLabel>
        </ChromeBar>
      </SelectionFrame>
      {children}
    </div>
  );
}

/** The project overview (title, description, cover) — edited like a section of blocks. */
function LiveOverview({ project, lang, actions, selection, onSelect }: {
  project: ProjectData;
  lang: Lang;
  actions: EditorActions;
  selection: Selection;
  onSelect: (part?: OverviewPart) => void;
}) {
  const en = lang === "en";
  const active = selection.kind === "meta";
  const part = selection.kind === "meta" ? selection.part : undefined;
  return (
    <section
      id="live-overview"
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
      className={cn("group/section flex flex-col items-start scroll-mt-[64px]", SECTION_BOX, sectionOutline(active && !part, active))}
    >
      <ChromeBar accent className={sectionChromeClass(active)}>
        <ChromeLabel onClick={() => onSelect()}>Proje bilgileri</ChromeLabel>
      </ChromeBar>

      <OverviewBlock label="Başlık" selected={part === "title"} onSelect={() => onSelect("title")}>
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

      <OverviewBlock label="Açıklama" selected={part === "description"} onSelect={() => onSelect("description")} className="mt-6">
        <EditableText
          as="p"
          multiline
          className="text-base font-light leading-7 text-[var(--text-p)] whitespace-pre-wrap"
          value={en ? project.descriptionEn : project.description}
          onChange={(v) => actions.updateMeta(en ? { descriptionEn: v } : { description: v })}
          placeholder={en ? "Project description…" : "Projeyi kısaca anlat…"}
        />
      </OverviewBlock>

      <OverviewBlock label="Kapak görseli" selected={part === "cover"} onSelect={() => onSelect("cover")} className="mt-12">
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

function LiveBlock({ block, group, cell, lang, actions, selected, selectedItemId, onSelect, onInsertAfter }: {
  block: Block;
  /** Its Blok: where it sits for drag & drop */
  group: Group;
  /** Its cell of the Blok's grid */
  cell: Cell;
  lang: Lang;
  actions: EditorActions;
  selected: boolean;
  /** Item selected inside this block */
  selectedItemId: string | null;
  /** Select the block — or, when a card / step / list item was clicked, that item */
  onSelect: (itemId?: string) => void;
  onInsertAfter: () => void;
}) {
  const { setNodeRef, setActivatorNodeRef, listeners, transform, transition, isDragging } = useSortableBlock(block, group.id);
  const display = useMemo(() => localizeBlock(block, lang), [block, lang]);
  const edit = useMemo(
    () => createBlockEditApi(block, lang, (patch) => actions.updateBlock(block.id, patch)),
    [block, lang, actions]
  );
  const update = (patch: Partial<Block>) => actions.updateBlock(block.id, patch);
  const addItemLabel = ADD_ITEM_LABEL[block.type];
  const [rootRef, frameRef, fitFrame] = useSelectionFrame(selected);
  const blockEl = useRef<HTMLDivElement | null>(null);
  const place = cellProps(cell, block);
  // A catalog component dragged over it: the line shows on which side it goes.
  const insertion = useInsertion();
  const line = insertion?.blockId === block.id ? insertion : null;

  // Mark the selected item (SortableItem draws an outline in the block's colour for `data-selected`).
  useLayoutEffect(() => {
    const root = blockEl.current;
    if (!root) return;
    root.querySelectorAll("[data-entry-id][data-selected]").forEach((el) => {
      if (el.getAttribute("data-entry-id") !== selectedItemId) el.removeAttribute("data-selected");
    });
    if (selectedItemId) root.querySelector(`[data-entry-id="${selectedItemId}"]`)?.setAttribute("data-selected", "");
  });

  return (
    <div
      ref={(el) => { setNodeRef(el); rootRef(el); blockEl.current = el; }}
      data-live-block
      data-block-id={block.id}
      // --edit-tone: the colour of the component's kind — its frame, toolbar dot, cards and hovered text.
      style={{ ...place.style, ...sortableStyle(transform, transition), "--edit-tone": blockTone(block.type) } as CSSProperties}
      {...listeners}
      onPointerEnter={fitFrame}
      onClick={(e) => {
        e.stopPropagation();
        const item = (e.target as Element).closest("[data-entry-id]");
        onSelect(item && e.currentTarget.contains(item) ? item.getAttribute("data-entry-id") ?? undefined : undefined);
      }}
      // Dragged: lifted above the page (a stacking context, so the frame's card sits right behind it).
      className={cn("group/block relative", place.className, HOVER_RING_BLOCK, isDragging && "z-30 cursor-grabbing")}
    >
      <SelectionFrame frameRef={frameRef} selected={selected} dragging={isDragging} dashed={Boolean(selectedItemId)}>
        <ChromeBar
          className={cn(
            // The frame ignores the pointer; the toolbar opts back in while visible.
            "absolute -top-1 -right-px -translate-y-full",
            selected ? "opacity-100 pointer-events-auto" : "opacity-0 group-hover/block:opacity-100 group-hover/block:pointer-events-auto"
          )}
        >
          <DragHandle activatorRef={setActivatorNodeRef} label="Bileşeni sürükle" className={handleClass} />
          <ChromeLabel onClick={() => onSelect()}>
            <ToneDot />
            {blockName(block)}
          </ChromeLabel>
          {addItemLabel && (
            <ToolButton label={addItemLabel} onClick={() => addItem(block, edit, update)}>{Icons.plus}</ToolButton>
          )}
          <ToolButton label="Altına bileşen ekle" onClick={onInsertAfter}>{Icons.insertBelow}</ToolButton>
          <ToolButton label="Çoğalt" onClick={() => actions.duplicateBlock(block)}>{Icons.duplicate}</ToolButton>
          <ToolButton label="Sil" onClick={() => actions.deleteBlock(block.id)}>{Icons.trash}</ToolButton>
        </ChromeBar>
      </SelectionFrame>
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
      <ProjectBlock block={display} edit={edit} lang={lang} />
    </div>
  );
}

// ── Canvas: Blok (group) ──────────────────────────────────────────────────────

/**
 * A Blok on its section's grid, laying out its components on a grid of its
 * own. Click its empty area (between components) to select it; drag it by its
 * label's grip, or press and hold that area.
 */
function LiveGroup({ group, index, section, cell, lang, actions, selected, active, selectedBlockId, selectedItemId, onSelect, onSelectBlock, onInsert }: {
  group: Group;
  /** Its place in the section (Blok 1, 2…) */
  index: number;
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
  onSelect: () => void;
  onSelectBlock: (blockId: string, itemId?: string) => void;
  /** Opens the component picker for this Blok: after a component, in a free cell, else at its end */
  onInsert: (at?: { afterBlockId?: string; cell?: { row: number; col: number } }) => void;
}) {
  const { setNodeRef, setActivatorNodeRef, listeners, transform, transition, isDragging } = useSortableGroup(group, section.id);
  const place = cellProps(cell, group);
  const grid = gridProps(group.grid);
  const columns = gridColumns(group.grid);
  const count = columns.length;
  const blockCells = layoutCells(group.blocks, count);
  // Free cells: drop targets while a component is dragged, "+" while selected — or the empty Blok's placeholder.
  const drag = useActiveDrag();
  const dragged = drag?.kind === "block" || drag?.kind === "new";
  const empty = group.blocks.length === 0;
  const showCells = count > 1 && (selected || dragged || empty);

  return (
    <div
      ref={setNodeRef}
      data-live-group
      data-group-id={group.id}
      style={{ ...place.style, ...grid.style, ...sortableStyle(transform, transition), "--edit-tone": GROUP_TONE } as CSSProperties}
      {...listeners}
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
      className={cn(
        "group/blok relative",
        place.className,
        grid.className,
        groupOutline(selected || isDragging, active),
        isDragging && cn(DRAG_LIFT, "bg-[var(--bg-1)]")
      )}
    >
      <ChromeBar accent className={cn(groupChromeClass(selected), isDragging && "hidden")}>
        <DragHandle activatorRef={setActivatorNodeRef} label="Bloğu sürükle" className={handleClass} />
        <ChromeLabel onClick={onSelect}>
          {groupName(group, index)}
          {columns.length > 1 && <span className="font-normal opacity-80 tabular-nums">{layoutName(columns)}</span>}
        </ChromeLabel>
        <ToolButton label="Bloğa bileşen ekle" onClick={() => onInsert()}>{Icons.plus}</ToolButton>
        <ToolButton label="Bloğu çoğalt" onClick={() => actions.duplicateGroup(group.id)}>{Icons.duplicate}</ToolButton>
        <ToolButton label="Bloğu sil" onClick={() => actions.deleteGroup(group.id)}>{Icons.trash}</ToolButton>
      </ChromeBar>

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
            onSelect={(itemId) => onSelectBlock(block.id, itemId)}
            onInsertAfter={() => onInsert({ afterBlockId: block.id })}
          />
        ))}
      </GroupBlocks>

      {showCells && (
        <FreeCells
          level="group"
          containerId={group.id}
          cells={blockCells}
          count={count}
          // A new row only on demand: while selected, empty, or while a component is dragged over it.
          newRow={selected || empty || (dragged && drag?.overGroupId === group.id)}
          noun="bileşen"
          onAdd={(row, col) => onInsert({ cell: { row, col } })}
        />
      )}

      {empty && count === 1 && (
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

function LiveSection({ section, index, lang, actions, selected, active, selectedGroupId, activeGroupId, selectedBlockId, selectedItemId, onSelect, onInsert }: {
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
  onSelect: (next: Selection) => void;
  /** Opens the component picker for a Blok */
  onInsert: (target: PickerTarget) => void;
}) {
  const { setNodeRef, setActivatorNodeRef, listeners, transform, transition, isDragging } = useSortablePageItem(section);
  const reordering = usePageReorder();
  const dropRef = useKeepDropPosition(isDragging, SECTION_LABEL_OFFSET, SECTION_LABEL);
  const ref = (el: HTMLElement | null) => { setNodeRef(el); dropRef(el); };
  const selectSection = () => onSelect({ kind: "section", sectionId: section.id });
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

  const grid = gridProps(section.grid);
  const count = gridColumns(section.grid).length;
  const groupCells = layoutCells(section.groups, count);
  // Free cells: drop targets while a Blok or component is dragged, "+" while selected — or the empty section's placeholder.
  const dragged = drag?.kind === "block" || drag?.kind === "group" || drag?.kind === "new";
  const empty = section.groups.length === 0;
  const showCells = count > 1 && (selected || dragged || empty);

  return (
    <section
      ref={ref}
      data-section-id={section.id}
      style={sortableStyle(transform, transition)}
      {...listeners}
      onClick={(e) => { e.stopPropagation(); selectSection(); }}
      className={cn(
        // scroll-mt: room for the label when the sections panel scrolls here.
        "group/section flex flex-col gap-4 items-start scroll-mt-[64px]",
        SECTION_BOX,
        SECTION_GAP,
        sectionOutline(selected || isDragging, active),
        isDragging && cn(DRAG_LIFT, "bg-[var(--bg-1)]")
      )}
    >
      <ChromeBar accent className={cn(sectionChromeClass(selected || active), isDragging && "hidden")}>
        <DragHandle activatorRef={setActivatorNodeRef} label="Bölümü sürükle" className={handleClass} />
        <ChromeLabel onClick={selectSection}>{sectionName(section, index)}</ChromeLabel>
        <ToolButton label="Bölüme blok ekle" onClick={addGroup}>{Icons.plus}</ToolButton>
        <ToolButton label="Bölümü sil" onClick={() => actions.deleteItem(section.id)}>{Icons.trash}</ToolButton>
      </ChromeBar>

      {(!empty || showCells) && (
        <div className={cn("w-full", grid.className)} style={grid.style}>
          <SectionGroups section={section}>
            {section.groups.map((group, i) => (
              <LiveGroup
                key={group.id}
                group={group}
                index={i}
                section={section}
                cell={groupCells[i]}
                lang={lang}
                actions={actions}
                selected={selectedGroupId === group.id}
                active={activeGroupId === group.id}
                selectedBlockId={selectedBlockId}
                selectedItemId={selectedItemId}
                onSelect={() => onSelect({ kind: "group", groupId: group.id })}
                onSelectBlock={(blockId, itemId) => onSelect({ kind: "block", blockId, itemId })}
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
              // A new row only on demand: while selected, empty, or while something is dragged over it.
              newRow={selected || empty || (dragged && drag?.overSectionId === section.id)}
              noun="blok"
              onAdd={addGroupAt}
            />
          )}
        </div>
      )}

      {empty && count === 1 && (
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

function LiveDivider({ divider, actions, selected, onSelect }: {
  divider: PageDivider;
  actions: EditorActions;
  selected: boolean;
  onSelect: () => void;
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
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
      className={cn(
        "group/divider relative w-full py-3 rounded-full outline-dashed outline-1 outline-offset-4 cursor-pointer transition-[outline-color]",
        selected ? "outline-[var(--edit-accent)]" : "outline-transparent data-[layer-hover]:outline-[color-mix(in_srgb,var(--edit-accent)_70%,transparent)]",
        isDragging && cn(DRAG_LIFT, "bg-[var(--bg-1)] outline-[var(--edit-accent)]")
      )}
    >
      <ProjectDivider />
      <ChromeBar
        className={cn(
          "absolute right-0 top-1/2 -translate-y-1/2",
          selected ? "opacity-100" : "opacity-0 group-hover/divider:opacity-100",
          isDragging && "hidden"
        )}
      >
        <DragHandle activatorRef={setActivatorNodeRef} label="Ayırıcıyı sürükle" className={handleClass} />
        <ToolButton label="Ayırıcıyı sil" onClick={() => actions.deleteItem(divider.id)}>{Icons.trash}</ToolButton>
      </ChromeBar>
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

/**
 * What a press lands on, if it should become the selection: the item inside a
 * component, the component, the Blok, the section or the divider. Toolbar
 * buttons don't select (their drag handles do — they belong to the thing they drag).
 */
function pressTarget(target: Element): Selection | null {
  if (target.closest("[data-no-drag]") && !target.closest("[data-drag-handle]")) return null;
  const block = target.closest<HTMLElement>("[data-live-block]");
  if (block?.dataset.blockId) {
    const item = target.closest<HTMLElement>("[data-entry-id]");
    const itemId = item && block.contains(item) ? item.dataset.entryId : undefined;
    return { kind: "block", blockId: block.dataset.blockId, itemId };
  }
  const group = target.closest<HTMLElement>("[data-live-group]");
  if (group?.dataset.groupId) return { kind: "group", groupId: group.dataset.groupId };
  const section = target.closest<HTMLElement>("[data-section-id]");
  if (section?.dataset.sectionId) return { kind: "section", sectionId: section.dataset.sectionId };
  const divider = target.closest<HTMLElement>("[data-divider-id]");
  if (divider?.dataset.dividerId) return { kind: "divider", dividerId: divider.dataset.dividerId };
  return null;
}

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

function LayerBlock({ block, group, selection, actions, onSelect }: {
  block: Block;
  /** Its Blok */
  group: Group;
  selection: Selection;
  actions: EditorActions;
  onSelect: SelectFromPanel;
}) {
  const { setNodeRef, listeners, isDragging } = useSortableBlock(block, group.id);
  const selected = selection.kind === "block" && selection.blockId === block.id;
  const tone = blockTone(block.type);
  const select = () => onSelect({ kind: "block", blockId: block.id });
  const drop = useTreeDrop(block.id);
  return (
    <div
      ref={setNodeRef}
      data-layer-id={block.id}
      data-layer-kind="block"
      {...listeners}
      className={cn("relative rounded-[8px]", isDragging && "opacity-40")}
    >
      <DropLine place={drop} depth={2} />
      <LayerRow
        depth={2}
        tone={tone}
        icon={blockIcon(block.type)}
        name={blockName(block)}
        selected={selected}
        hover={`[data-block-id="${block.id}"]`}
        onSelect={select}
        onInspect={select}
        onRename={(name) => actions.updateBlock(block.id, { name })}
      />
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
  theme: "Tema",
  publish: "Yayın",
};

export function LiveEditor({ project, lang, slug, companies, actions, onLoadTemplate }: {
  project: ProjectData;
  lang: Lang;
  slug: string;
  companies: string[];
  actions: EditorActions;
  onLoadTemplate: () => void;
}) {
  const [tab, setTab] = useState<Tab>("layers");
  const [rawSelection, setSelection] = useState<Selection>({ kind: "none" });
  // Where the component picker adds: a Blok, after one of its components or at its end.
  const [picker, setPicker] = useState<PickerTarget | null>(null);
  // Sections and Bloks folded in the layer tree (kept across tab switches).
  const [collapsedLayers, setCollapsedLayers] = useState<Set<string>>(() => new Set());
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
  }, [rawSelection, selectedItemId, project.items, actions]);

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
  }

  /** Selecting shows the element in the inspector (right) and, with `scroll`, brings it into view on the canvas. */
  function select(next: Selection, { scroll = false } = {}) {
    setSelection(next);
    revealLayer(next);
    if (!scroll) return;
    // Next frame: the element may have just been added.
    requestAnimationFrame(() => {
      const target =
        next.kind === "block" && next.itemId ? document.querySelector(`[data-block-id="${next.blockId}"] [data-entry-id="${next.itemId}"]`)
        : next.kind === "block" ? document.querySelector(`[data-block-id="${next.blockId}"]`)
        : next.kind === "group" ? document.querySelector(`[data-group-id="${next.groupId}"]`)
        : next.kind === "section" ? document.querySelector(`[data-section-id="${next.sectionId}"]`)
        : next.kind === "divider" ? document.querySelector(`[data-divider-id="${next.dividerId}"]`)
        : next.kind === "meta" ? document.getElementById("live-overview")
        : null;
      target?.scrollIntoView({ behavior: "smooth", block: next.kind === "section" || next.kind === "meta" ? "start" : "center" });
    });
  }

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
  if (selectedBlock && selectedItemId) {
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
  } else if (selection.kind === "divider") {
    const dividerId = selection.dividerId;
    inspectorTitle = "Ayırıcı";
    inspectorActions = <LayerButton label="Ayırıcıyı sil" onClick={() => actions.deleteItem(dividerId)}>{Icons.trash}</LayerButton>;
  }

  let sectionIndex = 0;

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
            )}

            {tab === "components" && <CatalogPanel target={catalogTarget} onAdd={addFromCatalog} />}

            {tab === "theme" && (
              <ProjectThemeFields header={false} theme={project.theme} onChange={(theme) => actions.updateMeta({ theme })} />
            )}

            {tab === "publish" && <PublishPanel project={project} slug={slug} onLoadTemplate={onLoadTemplate} />}

          </ScrollArea>
        </aside>

        {/* ── Canvas ── */}
        <div
          {...projectThemeAttrs(project.theme)}
          // No press-and-drag text selection on the canvas (it fights with hold-to-drag);
          // the field being edited opts back in. The settings panel stays selectable.
          className="flex-1 min-w-0 h-full overflow-y-auto bg-[var(--bg-1)] transition-colors duration-200 select-none"
          onClick={() => setSelection({ kind: "none" })}
          // Links stay put while editing; the click still reaches the text underneath.
          onClickCapture={(e) => { if ((e.target as Element).closest("a[href]")) e.preventDefault(); }}
          // No native image / link dragging — reordering is done with dnd-kit.
          onDragStart={(e) => e.preventDefault()}
        >
          {/* `isolate`: the hover rings below (z -1) stay above the canvas background but under all content. */}
          <main
            className={cn("isolate flex flex-col items-start w-full max-w-[720px] mx-auto px-6 pt-20 pb-40", reordering && REORDER_ROOM)}
            // Pressing selects at once, so whatever gets dragged is the selection (capture phase: drag handling untouched).
            onPointerDownCapture={(e) => {
              const next = isPrimaryPress(e) ? pressTarget(e.target as Element) : null;
              if (next) select(next);
            }}
          >
            {/* While a section is dragged the page is just the compact list of sections. */}
            {!reordering && (
              <LiveOverview
                project={project}
                lang={lang}
                actions={actions}
                selection={selection}
                onSelect={(part) => select({ kind: "meta", part })}
              />
            )}

            {project.items.length === 0 && (
              <div className="flex flex-col items-center gap-3 w-full mt-10 py-12 rounded-[28px] border border-dashed border-[var(--border-hover)] text-center">
                <p className="text-sm text-[var(--text-subtitle)] select-none">Sayfa henüz boş</p>
                <div className="flex items-center gap-2">
                  <PillButton size="md" onClick={(e) => { e.stopPropagation(); onLoadTemplate(); }}>Şablondan başla</PillButton>
                  <PillButton size="md" onClick={(e) => { e.stopPropagation(); actions.addSection(); }}>Bölüm ekle</PillButton>
                </div>
              </div>
            )}

            {/*
              While reordering, the rows are as wide as the section outlines (10px into
              the gutter, like SECTION_BOX) and the list box sits another 14px outside them.
            */}
            <div className={reordering ? cn(REORDER_LIST, "-mx-[24px] w-[calc(100%+48px)]") : "contents"}>
              {project.items.map((item) =>
                item.kind === "divider" ? (
                  <LiveDivider
                    key={item.id}
                    divider={item}
                    actions={actions}
                    selected={selection.kind === "divider" && selection.dividerId === item.id}
                    onSelect={() => select({ kind: "divider", dividerId: item.id })}
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
                    onSelect={(next) => select(next)}
                    onInsert={setPicker}
                  />
                )
              )}
            </div>

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
                {selectedItemId ? (
                  <ItemInspector
                    block={selectedBlock.block}
                    itemId={selectedItemId}
                    lang={lang}
                    projectSlug={slug}
                    onChange={(u) => actions.updateBlock(selectedBlock.block.id, u)}
                  />
                ) : (
                  <BlockInspector
                    block={selectedBlock.block}
                    lang={lang}
                    projectSlug={slug}
                    placement={
                      <PlacementGroup
                        item={selectedBlock.block}
                        index={selectedBlock.index}
                        siblings={selectedBlock.group.blocks}
                        labels={selectedBlock.group.blocks.map(blockName)}
                        parent={selectedBlock.group.grid}
                        tone={blockTone(selectedBlock.block.type)}
                        onPlace={(row, col) => actions.placeBlock(selectedBlock.block.id, selectedBlock.group.id, row, col)}
                        onSpan={(span) => actions.updateBlock(selectedBlock.block.id, { span })}
                        onFit={(fit) => actions.updateBlock(selectedBlock.block.id, fit)}
                      />
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
                  onSelectBlock={(blockId) => select({ kind: "block", blockId }, { scroll: true })}
                  onAddBlock={() => setPicker({ groupId: selectedGroup.group.id })}
                />
              </div>
            ) : selectedSection ? (
              <div className="flex flex-col">
                <SectionInspector
                  section={selectedSection.section}
                  onChange={(patch) => actions.updateSection(selectedSection.section.id, patch)}
                  onSelectGroup={(groupId) => select({ kind: "group", groupId }, { scroll: true })}
                  onAddGroup={() => select({ kind: "group", groupId: actions.addGroup(selectedSection.section.id) }, { scroll: true })}
                />
              </div>
            ) : selection.kind === "divider" ? (
              <p className="px-4 py-3 text-[11px] leading-4 text-[var(--text-subtitle)]">Bölümler arasındaki çizgi. Tutamacından ya da basılı tutarak sürükleyip taşıyabilirsin.</p>
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
