"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Block, BlockType, Group, PageDivider, PageItem, PageSection, ProjectData } from "@/types/project";
import { cn } from "@/lib/utils";
import { findBlock, findGroup, layoutName, gridColumns, sectionBlocks, sectionsOf } from "@/lib/projectLayout";
import { IconButton, PillButton } from "@/components/Button";
import { Input } from "@/components/Input";
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
  blockSummary,
  canMoveItem,
  duplicateItem,
  groupSummary,
  hasItem,
  itemName,
  moveItem,
  plainText,
  removeItem,
} from "@/components/admin/LiveInspector";
import { BLOCK_LABELS, BlockPickerDialog, GROUP_TONE, blockTone } from "@/components/admin/blockCatalog";
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
  useSortableGroup,
  useSortablePageItem,
} from "@/components/admin/ProjectDnd";
import type { EditorActions } from "@/components/admin/editorActions";

/**
 * Live editor ("Canlı Düzenleyici"): the project page itself, editable.
 *
 * Layout: icon rail → settings panel → canvas.
 * - Rail: Katmanlar (page outline), Düzenle (selected element), Proje (meta),
 *   Tema (radius / colors), Yayın (link, content status, template).
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
type Tab = "sections" | "inspect" | "theme" | "publish";
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
  layers: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path d="M10 3l7 3.5-7 3.5-7-3.5L10 3z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M3 10l7 3.5 7-3.5M3 13.5L10 17l7-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  inspect: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path d="M4 5.5h7M15 5.5h1M4 10h2M10 10h6M4 14.5h8M16 14.5h0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="13" cy="5.5" r="1.75" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="8" cy="10" r="1.75" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="14" cy="14.5" r="1.75" stroke="currentColor" strokeWidth="1.5" />
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

/** Row inside a panel card: a white pill like the form inputs. */
function PanelRow({ active, onClick, children, actions }: {
  active?: boolean;
  onClick?: () => void;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(e) => { if (onClick && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onClick(); } }}
      className={cn(
        "group/row flex items-center justify-between gap-2 h-10 pl-4 pr-1.5 rounded-full border bg-[var(--bg-1)] text-[14px] leading-5 transition-colors duration-150",
        onClick && "cursor-pointer",
        active ? "border-[var(--edit-accent)] text-[var(--text-title)]" : "border-transparent text-[var(--text-p)] hover:border-[var(--border-hover)]"
      )}
    >
      <div className="flex items-center gap-2.5 min-w-0">{children}</div>
      {actions && (
        <div className="flex items-center opacity-0 group-hover/row:opacity-100 focus-within:opacity-100 transition-opacity">{actions}</div>
      )}
    </div>
  );
}

// ── Rail ──────────────────────────────────────────────────────────────────────

function RailButton({ icon, label, active, indicator, onClick }: {
  icon: ReactNode;
  label: string;
  active: boolean;
  indicator?: boolean;
  onClick: () => void;
}) {
  return (
    <div className="relative group/rail">
      <IconButton
        size="md"
        aria-label={label}
        aria-pressed={active}
        onClick={onClick}
        className={cn(
          active
            ? "bg-[var(--bg-4)] border-[var(--border-hover)] text-[var(--text-title)]"
            : "border-transparent bg-transparent text-[var(--text-subtitle)] hover:text-[var(--text-title)]"
        )}
      >
        {icon}
      </IconButton>
      {indicator && (
        <span aria-hidden className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[var(--edit-accent)] ring-2 ring-[var(--bg-1)] pointer-events-none" />
      )}
      <span className="pointer-events-none absolute left-[calc(100%+10px)] top-1/2 -translate-y-1/2 z-50 hidden group-hover/rail:inline-flex items-center h-8 px-3 rounded-full border border-[var(--border)] bg-[var(--bg-1)] text-[13px] font-medium text-[var(--text-title)] shadow-[0_8px_24px_rgba(0,0,0,0.08)] whitespace-nowrap">
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
        : "outline-transparent hover:outline-[color-mix(in_srgb,var(--edit-accent)_40%,transparent)]"
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
            "has-[[data-live-block]:hover]:outline-transparent"
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
          : "border-transparent group-hover/block:border-[color-mix(in_srgb,var(--edit-tone,var(--edit-accent))_40%,transparent)]",
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

function LiveBlock({ block, group, lang, actions, selected, selectedItemId, onSelect, onInsertAfter }: {
  block: Block;
  /** Its Blok: where it sits for drag & drop, and the grid it covers columns of */
  group: Group;
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
  const cell = cellProps(block.span, group.grid);

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
      style={{ ...cell.style, ...sortableStyle(transform, transition), "--edit-tone": blockTone(block.type) } as CSSProperties}
      {...listeners}
      onPointerEnter={fitFrame}
      onClick={(e) => {
        e.stopPropagation();
        const item = (e.target as Element).closest("[data-entry-id]");
        onSelect(item && e.currentTarget.contains(item) ? item.getAttribute("data-entry-id") ?? undefined : undefined);
      }}
      // Dragged: lifted above the page (a stacking context, so the frame's card sits right behind it).
      className={cn("group/block relative w-full", cell.className, HOVER_RING_BLOCK, isDragging && "z-30 cursor-grabbing")}
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
            {BLOCK_LABELS[block.type]}
          </ChromeLabel>
          {addItemLabel && (
            <ToolButton label={addItemLabel} onClick={() => addItem(block, edit, update)}>{Icons.plus}</ToolButton>
          )}
          <ToolButton label="Altına bileşen ekle" onClick={onInsertAfter}>{Icons.insertBelow}</ToolButton>
          <ToolButton label="Çoğalt" onClick={() => actions.duplicateBlock(block)}>{Icons.duplicate}</ToolButton>
          <ToolButton label="Sil" onClick={() => actions.deleteBlock(block.id)}>{Icons.trash}</ToolButton>
        </ChromeBar>
      </SelectionFrame>
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
function LiveGroup({ group, index, section, lang, actions, selected, active, selectedBlockId, selectedItemId, onSelect, onSelectBlock, onInsert }: {
  group: Group;
  /** Its place in the section (Blok 1, 2…) */
  index: number;
  section: PageSection;
  lang: Lang;
  actions: EditorActions;
  selected: boolean;
  /** One of its components is selected */
  active: boolean;
  selectedBlockId: string | null;
  selectedItemId: string | null;
  onSelect: () => void;
  onSelectBlock: (blockId: string, itemId?: string) => void;
  /** Opens the component picker for this Blok: after a component, else at its end */
  onInsert: (afterBlockId?: string) => void;
}) {
  const { setNodeRef, setActivatorNodeRef, listeners, transform, transition, isDragging } = useSortableGroup(group, section.id);
  const cell = cellProps(group.span, section.grid);
  const grid = gridProps(group.grid);
  const columns = gridColumns(group.grid);

  return (
    <div
      ref={setNodeRef}
      data-live-group
      data-group-id={group.id}
      style={{ ...cell.style, ...grid.style, ...sortableStyle(transform, transition), "--edit-tone": GROUP_TONE } as CSSProperties}
      {...listeners}
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
      className={cn(
        "group/blok relative",
        cell.className,
        grid.className,
        groupOutline(selected || isDragging, active),
        isDragging && cn(DRAG_LIFT, "bg-[var(--bg-1)]")
      )}
    >
      <ChromeBar accent className={cn(groupChromeClass(selected), isDragging && "hidden")}>
        <DragHandle activatorRef={setActivatorNodeRef} label="Bloğu sürükle" className={handleClass} />
        <ChromeLabel onClick={onSelect}>
          {groupLabel(index)}
          {columns.length > 1 && <span className="font-normal opacity-80 tabular-nums">{layoutName(columns)}</span>}
        </ChromeLabel>
        <ToolButton label="Bloğa bileşen ekle" onClick={() => onInsert()}>{Icons.plus}</ToolButton>
        <ToolButton label="Bloğu çoğalt" onClick={() => actions.duplicateGroup(group.id)}>{Icons.duplicate}</ToolButton>
        <ToolButton label="Bloğu sil" onClick={() => actions.deleteGroup(group.id)}>{Icons.trash}</ToolButton>
      </ChromeBar>

      <GroupBlocks group={group}>
        {group.blocks.map((block) => (
          <LiveBlock
            key={block.id}
            block={block}
            group={group}
            lang={lang}
            actions={actions}
            selected={selectedBlockId === block.id}
            selectedItemId={selectedBlockId === block.id ? selectedItemId : null}
            onSelect={(itemId) => onSelectBlock(block.id, itemId)}
            onInsertAfter={() => onInsert(block.id)}
          />
        ))}
      </GroupBlocks>

      {group.blocks.length === 0 && (
        // An empty Blok: add its first component — or drop one here (the Blok itself is the drop target).
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
  /** Opens the component picker for a Blok: after a component, else at its end */
  onInsert: (groupId: string, afterBlockId?: string) => void;
}) {
  const { setNodeRef, setActivatorNodeRef, listeners, transform, transition, isDragging } = useSortablePageItem(section);
  const reordering = usePageReorder();
  const dropRef = useKeepDropPosition(isDragging, SECTION_LABEL_OFFSET, SECTION_LABEL);
  const ref = (el: HTMLElement | null) => { setNodeRef(el); dropRef(el); };
  const selectSection = () => onSelect({ kind: "section", sectionId: section.id });
  const addGroup = () => onSelect({ kind: "group", groupId: actions.addGroup(section.id) });

  if (reordering) {
    const heading = sectionBlocks(section).find((b) => b.type === "heading");
    return (
      <section ref={ref} style={sortableStyle(transform, transition)} {...listeners} className={cn("relative w-full", isDragging && "z-30")}>
        <ReorderRow
          label={sectionLabel(index)}
          detail={heading ? localizeBlock(heading, lang).content : undefined}
          dragging={isDragging}
          activatorRef={setActivatorNodeRef}
        />
      </section>
    );
  }

  const grid = gridProps(section.grid);

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
        <ChromeLabel onClick={selectSection}>{sectionLabel(index)}</ChromeLabel>
        <ToolButton label="Bölüme blok ekle" onClick={addGroup}>{Icons.plus}</ToolButton>
        <ToolButton label="Bölümü sil" onClick={() => actions.deleteItem(section.id)}>{Icons.trash}</ToolButton>
      </ChromeBar>

      {section.groups.length > 0 && (
        <div className={grid.className} style={grid.style}>
          <SectionGroups section={section}>
            {section.groups.map((group, i) => (
              <LiveGroup
                key={group.id}
                group={group}
                index={i}
                section={section}
                lang={lang}
                actions={actions}
                selected={selectedGroupId === group.id}
                active={activeGroupId === group.id}
                selectedBlockId={selectedBlockId}
                selectedItemId={selectedItemId}
                onSelect={() => onSelect({ kind: "group", groupId: group.id })}
                onSelectBlock={(blockId, itemId) => onSelect({ kind: "block", blockId, itemId })}
                onInsert={(afterBlockId) => onInsert(group.id, afterBlockId)}
              />
            ))}
          </SectionGroups>
        </div>
      )}

      {section.groups.length === 0 && (
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
        selected ? "outline-[var(--edit-accent)]" : "outline-transparent",
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

/** Where the selection lives ("02 Bölüm › Blok 1 › Süreç"); each step selects that level. */
function Crumbs({ items }: { items: { label: string; detail?: string; onClick: () => void }[] }) {
  return (
    <nav aria-label="Konum" className="flex items-center gap-1 min-w-0 flex-wrap">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1 min-w-0">
          {i > 0 && (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden className="shrink-0 text-[var(--text-subtitle)]">
              <path d="M4.5 3l3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
          <button
            type="button"
            onClick={item.onClick}
            className="flex items-center gap-1.5 min-w-0 h-8 px-3 rounded-full bg-[var(--bg-4)] text-[13px] leading-5 text-[var(--text-subtitle)] hover:text-[var(--text-title)] transition-colors cursor-pointer"
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

/** The section holding the selected Blok or component. */
function activeSectionOf(items: PageItem[], selection: Selection): string | null {
  if (selection.kind === "block") return findBlock(items, selection.blockId)?.section.id ?? null;
  if (selection.kind === "group") return findGroup(items, selection.groupId)?.section.id ?? null;
  return null;
}

type SelectFromPanel = (next: Selection, opts?: { inspect?: boolean; scroll?: boolean }) => void;

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

function LayerBlock({ block, group, lang, selection, actions, onSelect }: {
  block: Block;
  /** Its Blok */
  group: Group;
  lang: Lang;
  selection: Selection;
  actions: EditorActions;
  onSelect: SelectFromPanel;
}) {
  const { setNodeRef, setActivatorNodeRef, listeners, transform, transition, isDragging } = useSortableBlock(block, group.id);
  const summary = blockSummary(block, lang);
  const selected = selection.kind === "block" && selection.blockId === block.id && !selection.itemId;
  return (
    <div
      ref={setNodeRef}
      data-layer-id={block.id}
      data-layer-kind="block"
      style={{ ...sortableStyle(transform, transition), "--edit-tone": blockTone(block.type) } as CSSProperties}
      {...listeners}
      onClick={(e) => { e.stopPropagation(); onSelect({ kind: "block", blockId: block.id }); }}
      onDoubleClick={(e) => { e.stopPropagation(); onSelect({ kind: "block", blockId: block.id }, { inspect: true }); }}
      className={cn(
        "group/row flex items-center gap-1 h-9 pl-0.5 pr-1 rounded-full border bg-[var(--bg-1)] text-[13px] leading-5 cursor-pointer select-none transition-colors",
        selected || isDragging ? "border-[var(--edit-tone)]" : "border-transparent hover:border-[color-mix(in_srgb,var(--edit-tone)_40%,transparent)]",
        isDragging && DRAG_LIFT
      )}
    >
      <DragHandle activatorRef={setActivatorNodeRef} label="Bileşeni sürükle" className={handleClass} />
      <ToneDot />
      <span className="shrink-0 font-medium text-[var(--text-title)]">{BLOCK_LABELS[block.type]}</span>
      {summary && <span className="min-w-0 truncate text-[var(--text-subtitle)]">{summary}</span>}
      <div className="ml-auto flex items-center opacity-0 group-hover/row:opacity-100 focus-within:opacity-100 transition-opacity">
        <ToolButton label="Düzenle" onClick={() => onSelect({ kind: "block", blockId: block.id }, { inspect: true })}>{Icons.edit}</ToolButton>
        <ToolButton label="Sil" onClick={() => actions.deleteBlock(block.id)}>{Icons.trash}</ToolButton>
      </div>
    </div>
  );
}

/** A Blok in the sections panel: its components, droppable and sortable. */
function LayerGroup({ group, index, sectionId, lang, selection, actions, onSelect, onAddBlock }: {
  group: Group;
  index: number;
  sectionId: string;
  lang: Lang;
  selection: Selection;
  actions: EditorActions;
  onSelect: SelectFromPanel;
  onAddBlock: (groupId: string) => void;
}) {
  const { setNodeRef, setActivatorNodeRef, listeners, transform, transition, isDragging } = useSortableGroup(group, sectionId);
  const selected = selection.kind === "group" && selection.groupId === group.id;
  const columns = gridColumns(group.grid);
  const select = (inspect = false) => onSelect({ kind: "group", groupId: group.id }, inspect ? { inspect } : undefined);
  return (
    <div
      ref={setNodeRef}
      data-layer-id={group.id}
      data-layer-kind="group"
      style={{ ...sortableStyle(transform, transition), "--edit-tone": GROUP_TONE } as CSSProperties}
      {...listeners}
      className={cn("flex flex-col gap-1", isDragging && cn(DRAG_LIFT, "rounded-[18px] bg-[var(--bg-4)]"))}
    >
      <div
        onClick={(e) => { e.stopPropagation(); select(); }}
        onDoubleClick={(e) => { e.stopPropagation(); select(true); }}
        className={cn(
          "group/row flex items-center gap-1 h-8 pl-0.5 pr-1 rounded-full border text-[12px] leading-4 cursor-pointer select-none transition-colors",
          selected || isDragging ? "border-[var(--edit-group)] bg-[var(--bg-1)]" : "border-transparent hover:bg-[var(--bg-1)]"
        )}
      >
        <DragHandle activatorRef={setActivatorNodeRef} label="Bloğu sürükle" className={handleClass} />
        <ToneDot />
        <span className="shrink-0 font-medium text-[var(--text-title)]">{groupLabel(index)}</span>
        {columns.length > 1 && <span className="tabular-nums text-[var(--text-subtitle)]">{layoutName(columns)}</span>}
        <div className="ml-auto flex items-center opacity-0 group-hover/row:opacity-100 focus-within:opacity-100 transition-opacity">
          <ToolButton label="Bloğa bileşen ekle" onClick={() => onAddBlock(group.id)}>{Icons.plus}</ToolButton>
          <ToolButton label="Düzenle" onClick={() => select(true)}>{Icons.edit}</ToolButton>
          <ToolButton label="Bloğu sil" onClick={() => actions.deleteGroup(group.id)}>{Icons.trash}</ToolButton>
        </div>
      </div>
      <div className="flex flex-col gap-1 ml-3.5 pl-2.5 border-l border-dashed border-[var(--border-hover)]">
        <GroupBlocks group={group}>
          {group.blocks.map((block) => (
            <LayerBlock
              key={block.id}
              block={block}
              group={group}
              lang={lang}
              selection={selection}
              actions={actions}
              onSelect={onSelect}
            />
          ))}
        </GroupBlocks>
        {group.blocks.length === 0 && <p className="px-2.5 py-1 text-[12px] leading-4 text-[var(--text-subtitle)]">Boş — buraya bir bileşen sürükle.</p>}
      </div>
    </div>
  );
}

function LayerSection({ section, index, lang, selection, active, collapsed, onToggle, actions, onSelect, onAddBlock }: {
  section: PageSection;
  index: number;
  lang: Lang;
  selection: Selection;
  /** One of its Bloks or components is selected */
  active: boolean;
  collapsed: boolean;
  onToggle: () => void;
  actions: EditorActions;
  onSelect: SelectFromPanel;
  onAddBlock: (groupId: string) => void;
}) {
  const { setNodeRef, setActivatorNodeRef, listeners, transform, transition, isDragging } = useSortablePageItem(section);
  const reordering = usePageReorder();
  const dropRef = useKeepDropPosition(isDragging);
  const ref = (el: HTMLElement | null) => { setNodeRef(el); dropRef(el); };
  const label = sectionLabel(index);
  const title = sectionTitle(section, lang);
  const selected = selection.kind === "section" && selection.sectionId === section.id;
  // A section holding the selection always shows its Bloks.
  const open = !collapsed || active;

  if (reordering) {
    return (
      <div ref={ref} style={sortableStyle(transform, transition)} {...listeners} className={cn("relative w-full", isDragging && "z-30")}>
        <ReorderRow label={label} detail={title} dragging={isDragging} activatorRef={setActivatorNodeRef} />
      </div>
    );
  }

  return (
    <div
      ref={ref}
      data-layer-id={section.id}
      data-layer-kind="section"
      style={sortableStyle(transform, transition)}
      {...listeners}
      className={cn(
        "flex flex-col gap-1 p-1.5 rounded-[18px] border bg-[var(--bg-4)] transition-colors",
        selected ? "border-[var(--edit-accent)]" : active ? "border-[color-mix(in_srgb,var(--edit-accent)_40%,transparent)]" : "border-[var(--border)]",
        isDragging && cn(DRAG_LIFT, "border-[var(--edit-accent)]")
      )}
    >
      <div
        onClick={() => onSelect({ kind: "section", sectionId: section.id })}
        onDoubleClick={() => onSelect({ kind: "section", sectionId: section.id }, { inspect: true })}
        className="group/row flex items-center gap-1 h-9 pl-0.5 pr-1 rounded-full text-[14px] leading-5 cursor-pointer select-none"
      >
        <DragHandle activatorRef={setActivatorNodeRef} label="Bölümü sürükle" className={handleClass} />
        <button
          type="button"
          aria-label={open ? "Blokları gizle" : "Blokları göster"}
          aria-expanded={open}
          onClick={(e) => { e.stopPropagation(); onToggle(); }}
          className="flex items-center justify-center w-6 h-6 rounded-full text-[var(--text-subtitle)] hover:text-[var(--text-title)] hover:bg-[var(--bg-1)] cursor-pointer transition-colors"
        >
          <span className={cn("transition-transform duration-150", !open && "-rotate-90")}>{Icons.chevron}</span>
        </button>
        <span className="shrink-0 font-medium text-[var(--text-title)] tabular-nums">{sectionNumber(index)}</span>
        <span className={cn("min-w-0 truncate", title ? "text-[var(--text-p)]" : "text-[var(--text-subtitle)]")}>{title ?? "Başlıksız bölüm"}</span>
        <span className="ml-auto shrink-0 px-1 text-[12px] text-[var(--text-subtitle)] tabular-nums group-hover/row:hidden">
          {section.groups.length} blok
        </span>
        <div className="ml-auto hidden group-hover/row:flex items-center">
          <ToolButton label="Bölüme blok ekle" onClick={() => onSelect({ kind: "group", groupId: actions.addGroup(section.id) })}>{Icons.plus}</ToolButton>
          <ToolButton label="Düzenle" onClick={() => onSelect({ kind: "section", sectionId: section.id }, { inspect: true })}>{Icons.edit}</ToolButton>
          <ToolButton label="Bölümü sil" onClick={() => actions.deleteItem(section.id)}>{Icons.trash}</ToolButton>
        </div>
      </div>

      {open && (
        <SectionGroups section={section}>
          {section.groups.map((group, i) => (
            <LayerGroup
              key={group.id}
              group={group}
              index={i}
              sectionId={section.id}
              lang={lang}
              selection={selection}
              actions={actions}
              onSelect={onSelect}
              onAddBlock={onAddBlock}
            />
          ))}
          {section.groups.length === 0 && (
            <p className="px-3 py-2 text-[12px] leading-5 text-[var(--text-subtitle)]">Boş bölüm — buraya bir blok sürükle ya da ekle.</p>
          )}
        </SectionGroups>
      )}
    </div>
  );
}

function LayerDivider({ divider, selected, actions, onSelect }: {
  divider: PageDivider;
  selected: boolean;
  actions: EditorActions;
  onSelect: SelectFromPanel;
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
      data-layer-id={divider.id}
      data-layer-kind="divider"
      style={sortableStyle(transform, transition)}
      {...listeners}
      onClick={() => onSelect({ kind: "divider", dividerId: divider.id })}
      className={cn(
        "group/row flex items-center gap-2 h-8 pl-0.5 pr-1 rounded-full border border-dashed cursor-pointer select-none transition-colors",
        selected ? "border-[var(--edit-accent)]" : "border-transparent hover:border-[var(--border-hover)]",
        isDragging && cn(DRAG_LIFT, "bg-[var(--bg-1)] border-[var(--edit-accent)]")
      )}
    >
      <DragHandle activatorRef={setActivatorNodeRef} label="Ayırıcıyı sürükle" className={handleClass} />
      <div className="flex-1 h-px bg-[var(--border-hover)]" />
      <span className="text-[12px] text-[var(--text-subtitle)]">Ayırıcı</span>
      <div className="flex-1 h-px bg-[var(--border-hover)]" />
      <div className="w-7 flex items-center justify-center opacity-0 group-hover/row:opacity-100 transition-opacity">
        <ToolButton label="Ayırıcıyı sil" onClick={() => actions.deleteItem(divider.id)}>{Icons.trash}</ToolButton>
      </div>
    </div>
  );
}

/** The page outline inside its own drag & drop context (see SectionsPanel). */
function SectionsList({ project, lang, selection, collapsed, onToggle, onToggleAll, actions, onSelect, onAddBlock }: {
  project: ProjectData;
  lang: Lang;
  selection: Selection;
  collapsed: Set<string>;
  onToggle: (sectionId: string) => void;
  onToggleAll: (collapse: boolean) => void;
  actions: EditorActions;
  onSelect: SelectFromPanel;
  /** Opens the component picker for a Blok */
  onAddBlock: (groupId: string) => void;
}) {
  const reordering = usePageReorder();
  const sections = sectionsOf(project.items);
  const allCollapsed = sections.length > 0 && sections.every((s) => collapsed.has(s.id));
  const activeSectionId = activeSectionOf(project.items, selection);
  let sectionIndex = 0;

  return (
    <div
      className={cn("flex flex-col gap-1.5", reordering && REORDER_ROOM)}
      // Whatever gets pressed (and maybe dragged) is selected at once; capture phase, so drag handling is untouched.
      onPointerDownCapture={(e) => {
        const next = isPrimaryPress(e) ? layerPressTarget(e.target as Element) : null;
        if (next) onSelect(next, { scroll: false });
      }}
    >
      {!reordering && (
        <div className="flex items-center justify-between gap-2 px-1 pb-1">
          <span className="text-[13px] text-[var(--text-subtitle)]">
            {sections.length} bölüm · basılı tut ya da tutamaçtan sürükle
          </span>
          {sections.length > 0 && (
            <PillButton size="sm" variant="ghost" onClick={() => onToggleAll(!allCollapsed)}>
              {allCollapsed ? "Tümünü aç" : "Tümünü kapat"}
            </PillButton>
          )}
        </div>
      )}

      {!reordering && (
        <PanelRow active={selection.kind === "meta"} onClick={() => onSelect({ kind: "meta" })}>
          <span className="font-medium text-[var(--text-title)]">Proje bilgileri</span>
          <span className="truncate text-[var(--text-subtitle)]">{project.title}</span>
        </PanelRow>
      )}

      {project.items.map((item) =>
        item.kind === "divider" ? (
          <LayerDivider
            key={item.id}
            divider={item}
            selected={selection.kind === "divider" && selection.dividerId === item.id}
            actions={actions}
            onSelect={onSelect}
          />
        ) : (
          <LayerSection
            key={item.id}
            section={item}
            index={sectionIndex++}
            lang={lang}
            selection={selection}
            active={activeSectionId === item.id}
            collapsed={collapsed.has(item.id)}
            onToggle={() => onToggle(item.id)}
            actions={actions}
            onSelect={onSelect}
            onAddBlock={onAddBlock}
          />
        )
      )}

      {project.items.length === 0 && (
        <p className="px-2 py-4 text-[13px] text-center text-[var(--text-subtitle)]">Sayfada henüz bölüm yok.</p>
      )}

      {!reordering && (
        <div className="grid grid-cols-2 gap-2 pt-1.5">
          <PillButton size="md" onClick={() => actions.addSection()} startIcon={Icons.plus} className="justify-center">Bölüm ekle</PillButton>
          <PillButton size="md" onClick={() => actions.addDivider()} startIcon={Icons.plus} className="justify-center">Ayırıcı ekle</PillButton>
        </div>
      )}
    </div>
  );
}

/**
 * Page outline: sections › Bloks › components. Click to go to one on the
 * canvas, double-click (or ✎) to edit it. Everything reorders by drag & drop
 * here too — in a drag context of its own, so the canvas stays as it is.
 */
function SectionsPanel(props: Parameters<typeof SectionsList>[0]) {
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

  return (
    <ProjectDndProvider items={project.items} onItemsChange={actions.setItems}>
      <SectionsList {...props} />
    </ProjectDndProvider>
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
  sections: "Bölümler",
  inspect: "Düzenle",
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
  const [tab, setTab] = useState<Tab>("inspect");
  const [rawSelection, setSelection] = useState<Selection>({ kind: "none" });
  // Where the block picker adds: a section (after a block, or at its end) or a row column.
  const [picker, setPicker] = useState<{ sectionId?: string; afterBlockId?: string; containerId?: string } | null>(null);
  // Sections folded in the sections panel (kept across tab switches).
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(() => new Set());
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
  const selectedSection = rawSelection.kind === "section" ? findSection(project.items, rawSelection.sectionId) : null;
  const selectedDivider = rawSelection.kind === "divider" && project.items.some((i) => i.id === rawSelection.dividerId);
  const selection: Selection =
    (rawSelection.kind === "block" && !selectedBlock) ||
    (rawSelection.kind === "section" && !selectedSection) ||
    (rawSelection.kind === "divider" && !selectedDivider)
      ? { kind: "none" }
      : rawSelection;
  // An item that no longer exists (deleted, undone) falls back to its block.
  const selectedItemId =
    selection.kind === "block" && selection.itemId && selectedBlock && hasItem(selectedBlock.block, selection.itemId)
      ? selection.itemId
      : null;

  /** Selecting something on the canvas or in the layers shows it in the inspector. */
  /**
   * Selecting shows the element in the inspector (unless `inspect` is false —
   * the sections panel stays open) and, with `scroll`, brings it into view.
   */
  function select(next: Selection, { scroll = false, inspect = true } = {}) {
    setSelection(next);
    if (inspect) setTab("inspect");
    if (!scroll) return;
    const target =
      next.kind === "block" && next.itemId ? document.querySelector(`[data-block-id="${next.blockId}"] [data-entry-id="${next.itemId}"]`)
      : next.kind === "block" ? document.querySelector(`[data-block-id="${next.blockId}"]`)
      : next.kind === "section" ? document.querySelector(`[data-section-id="${next.sectionId}"]`)
      : next.kind === "divider" ? document.querySelector(`[data-divider-id="${next.dividerId}"]`)
      : next.kind === "meta" ? document.getElementById("live-overview")
      : null;
    target?.scrollIntoView({ behavior: "smooth", block: next.kind === "section" || next.kind === "meta" ? "start" : "center" });
  }

  /**
   * Where the selected block / item sits: section › (row › column) › block —
   * each step selects that level.
   */
  function blockCrumbs(found: NonNullable<typeof selectedBlock>, itemId: string | null) {
    const { section, block, containerId } = found;
    const crumbs: { label: string; detail?: string; onClick: () => void }[] = [
      {
        label: `${sectionNumber(findSection(project.items, section.id)?.index ?? 0)} Bölüm`,
        detail: itemId || containerId !== section.id ? undefined : sectionTitle(section, lang),
        onClick: () => select({ kind: "section", sectionId: section.id }, { scroll: true }),
      },
    ];
    const row = containerId !== section.id ? rowOfColumn(section, containerId) : null;
    if (row) {
      const columnIndex = (row.rowColumns ?? []).findIndex((c) => c.id === containerId);
      crumbs.push(
        { label: BLOCK_LABELS.row, onClick: () => select({ kind: "block", blockId: row.id }, { scroll: true }) },
        { label: `Sütun ${columnIndex + 1}`, onClick: () => select({ kind: "block", blockId: row.id, itemId: containerId }, { scroll: true }) }
      );
    }
    if (itemId) crumbs.push({ label: BLOCK_LABELS[block.type], onClick: () => select({ kind: "block", blockId: block.id }, { scroll: true }) });
    return crumbs;
  }

  // Inspector header: what is selected and what can be done with it.
  let panelTitle = TAB_TITLES[tab];
  let panelActions: ReactNode = null;
  if (tab === "theme" && project.theme) {
    panelActions = <PillButton size="sm" variant="ghost" onClick={() => actions.updateMeta({ theme: undefined })}>Varsayılana dön</PillButton>;
  }
  if (tab === "inspect") {
    if (selectedBlock && selectedItemId) {
      const { section, block } = selectedBlock;
      const itemId = selectedItemId;
      const update = (patch: Partial<Block>) => actions.updateBlock(section.id, block.id, patch);
      panelTitle = itemName(block, itemId);
      panelActions = (
        <>
          <ToolButton label="Yukarı taşı" disabled={!canMoveItem(block, itemId, -1)} onClick={() => update(moveItem(block, itemId, -1))}>{Icons.arrowUp}</ToolButton>
          <ToolButton label="Aşağı taşı" disabled={!canMoveItem(block, itemId, 1)} onClick={() => update(moveItem(block, itemId, 1))}>{Icons.arrowDown}</ToolButton>
          <ToolButton
            label="Çoğalt"
            onClick={() => {
              const { patch, id } = duplicateItem(block, itemId);
              update(patch);
              select({ kind: "block", blockId: block.id, itemId: id });
            }}
          >
            {Icons.duplicate}
          </ToolButton>
          <ToolButton label="Sil" onClick={() => update(removeItem(block, itemId))}>{Icons.trash}</ToolButton>
        </>
      );
    } else if (selectedBlock) {
      const { section, block } = selectedBlock;
      panelTitle = BLOCK_LABELS[block.type];
      panelActions = (
        <>
          <ToolButton label="Çoğalt" onClick={() => actions.duplicateBlock(section.id, block)}>{Icons.duplicate}</ToolButton>
          <ToolButton label="Sil" onClick={() => actions.deleteBlock(section.id, block.id)}>{Icons.trash}</ToolButton>
        </>
      );
    } else if (selectedSection) {
      const { section, index } = selectedSection;
      panelTitle = `${sectionNumber(index)} Bölüm`;
      panelActions = (
        <>
          <PillButton size="sm" variant="ghost" startIcon={Icons.plus} onClick={() => setPicker({ sectionId: section.id })}>Blok ekle</PillButton>
          <ToolButton label="Bölümü sil" onClick={() => actions.deleteItem(section.id)}>{Icons.trash}</ToolButton>
        </>
      );
    } else if (selection.kind === "divider") {
      const dividerId = selection.dividerId;
      panelTitle = "Ayırıcı";
      panelActions = <ToolButton label="Ayırıcıyı sil" onClick={() => actions.deleteItem(dividerId)}>{Icons.trash}</ToolButton>;
    } else {
      panelTitle = "Proje bilgileri";
    }
  }

  let sectionIndex = 0;

  return (
    // Drags start as soon as the pointer moves (no press-and-hold wait) — for the
    // cards inside blocks and the sections panel too.
    <DragActivationContext.Provider value="press">
      <div className="flex h-full min-h-0">
        {/* ── Icon rail ── */}
        <nav aria-label="Editör araçları" className="w-16 shrink-0 h-full flex flex-col items-center gap-2 py-3 border-r border-[var(--border)] bg-[var(--bg-1)] z-20 select-none">
          <RailButton icon={RailIcons.layers} label="Bölümler" active={tab === "sections"} onClick={() => setTab("sections")} />
          <RailButton
            icon={RailIcons.inspect}
            label="Düzenle"
            active={tab === "inspect"}
            indicator={selection.kind !== "none" && selection.kind !== "meta"}
            onClick={() => setTab("inspect")}
          />
          <RailButton icon={RailIcons.theme} label="Tema" active={tab === "theme"} onClick={() => setTab("theme")} />
          <RailButton icon={RailIcons.publish} label="Yayın" active={tab === "publish"} onClick={() => setTab("publish")} />
        </nav>

        {/* ── Settings panel ── */}
        <aside className="w-[360px] shrink-0 h-full flex flex-col border-r border-[var(--border)] bg-[var(--bg-1)] z-10">
          <div className="shrink-0 flex items-center justify-between gap-2 h-16 px-4 border-b border-[var(--border)]">
            <PillLabel>{panelTitle}</PillLabel>
            <div className="flex items-center gap-0.5 shrink-0">
              {panelActions}
              {tab === "inspect" && selection.kind !== "none" && (
                <ToolButton label="Seçimi kaldır (Esc)" onClick={() => setSelection({ kind: "none" })}>{Icons.close}</ToolButton>
              )}
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-4 flex flex-col gap-3">
            {tab === "sections" && (
              <SectionsPanel
                project={project}
                lang={lang}
                selection={selection}
                collapsed={collapsedSections}
                onToggle={(sectionId) =>
                  setCollapsedSections((prev) => {
                    const next = new Set(prev);
                    if (next.has(sectionId)) next.delete(sectionId);
                    else next.add(sectionId);
                    return next;
                  })
                }
                onToggleAll={(collapse) =>
                  setCollapsedSections(collapse ? new Set(project.items.filter((i) => i.kind === "section").map((i) => i.id)) : new Set())
                }
                actions={actions}
                onSelect={(next, { inspect = false, scroll = true } = {}) => select(next, { scroll, inspect })}
                onAddBlock={(sectionId) => setPicker({ sectionId })}
              />
            )}

            {tab === "theme" && (
              <ProjectThemeFields header={false} theme={project.theme} onChange={(theme) => actions.updateMeta({ theme })} />
            )}

            {tab === "publish" && <PublishPanel project={project} slug={slug} onLoadTemplate={onLoadTemplate} />}

            {tab === "inspect" && (
              selectedBlock ? (
                <div className="flex flex-col gap-3">
                  <Crumbs items={blockCrumbs(selectedBlock, selectedItemId)} />
                  {selectedItemId ? (
                    <ItemInspector
                      block={selectedBlock.block}
                      itemId={selectedItemId}
                      lang={lang}
                      projectSlug={slug}
                      onChange={(u) => actions.updateBlock(selectedBlock.section.id, selectedBlock.block.id, u)}
                      onSelectBlock={(blockId) => select({ kind: "block", blockId }, { scroll: true })}
                      onAddBlock={() => setPicker({ containerId: selectedItemId })}
                    />
                  ) : (
                    <BlockInspector
                      block={selectedBlock.block}
                      lang={lang}
                      projectSlug={slug}
                      onChange={(u) => actions.updateBlock(selectedBlock.section.id, selectedBlock.block.id, u)}
                      onSelectEntry={(itemId) => select({ kind: "block", blockId: selectedBlock.block.id, itemId }, { scroll: true })}
                    />
                  )}
                </div>
              ) : selectedSection ? (
                <div className="flex flex-col gap-3">
                  {sectionTitle(selectedSection.section, lang) && (
                    <p className="px-3 text-[16px] font-medium leading-6 text-[var(--text-title)]">{sectionTitle(selectedSection.section, lang)}</p>
                  )}
                  {selectedSection.section.blocks.length > 0 ? (
                    <div className="p-1 rounded-[18px] bg-[var(--bg-4)]">
                      <BlockTypeRows
                        blocks={selectedSection.section.blocks}
                        lang={lang}
                        selectedBlockId={null}
                        onSelect={(blockId) => select({ kind: "block", blockId }, { scroll: true })}
                        onDelete={(blockId) => actions.deleteBlock(selectedSection.section.id, blockId)}
                      />
                    </div>
                  ) : (
                    <EmptyNote>Bu bölümde henüz blok yok. Yukarıdaki “Blok ekle” ile başla ya da başka bölümden bir blok sürükle.</EmptyNote>
                  )}
                  <EmptyNote>Bloğa tıklayınca ayarları açılır. Sıralamak için sayfada ya da Bölümler panelinde sürükle.</EmptyNote>
                </div>
              ) : selection.kind === "divider" ? (
                <EmptyNote>Bölümler arasındaki çizgi. Tutamacından ya da basılı tutarak sürükleyip taşıyabilirsin.</EmptyNote>
              ) : (
                // Nothing selected: the inspector is never empty — it shows the project settings.
                <ProjectInspector project={project} lang={lang} slug={slug} companies={companies} onChange={actions.updateMeta} />
              )
            )}
          </div>
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
                    selectedBlockId={selectedBlock?.block.id ?? null}
                    onSelectSection={() => select({ kind: "section", sectionId: item.id })}
                    selectedItemId={selectedItemId}
                    onSelectBlock={(blockId, itemId) => select({ kind: "block", blockId, itemId })}
                    onInsert={(sectionId, afterBlockId) => setPicker({ sectionId, afterBlockId })}
                    onAddToColumn={(containerId) => setPicker({ containerId })}
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

        {picker && (
          <BlockPickerDialog
            onPick={(type: BlockType, extras) => {
              const blockId = picker.containerId
                ? actions.addBlockToContainer(picker.containerId, type, extras)
                : actions.addBlock(picker.sectionId ?? "", type, extras, picker.afterBlockId);
              select({ kind: "block", blockId });
            }}
            onClose={() => setPicker(null)}
            // Rows don't nest: no İç Bölüm into a column (or right after a block inside one).
            exclude={
              picker.containerId ||
              (picker.afterBlockId && picker.sectionId && containerOfBlock(project.items, picker.afterBlockId) !== picker.sectionId)
                ? ["row"]
                : undefined
            }
          />
        )}
      </div>
    </DragActivationContext.Provider>
  );
}
