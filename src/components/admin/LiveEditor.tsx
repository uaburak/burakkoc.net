"use client";

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useDndMonitor } from "@dnd-kit/core";
import { Block, BlockEntry, BlockType, GridSettings, Group, ItemTextField, PageDivider, PageItem, PageSection, ProjectData } from "@/types/project";
import type { DesignComponent, FrameLook, InstanceLayer, InstanceOverrides, TextLayer } from "@/types/design";
import { cn } from "@/lib/utils";
import { FigmaIcon, fi } from "@/components/admin/figmaIcons";
import { findBlock, findGroup, freeCells, gridColumns, gridFlow, gridRows, layoutCells, rowCount, sectionBlocks, sectionsOf, type Cell } from "@/lib/projectLayout";
import { PillButton } from "@/components/Button";
import { ScrollArea } from "@/components/ScrollArea";
import { FillHeightContext, ProjectBlock, ProjectDivider } from "@/components/project/CoreBlocks";
import { absoluteProps, cellProps, gridProps, pageFrameProps, sectionFrameProps, sizeProps } from "@/components/project/LayoutGrid";
import { EditableText } from "@/components/project/Editable";
import { DRAG_LIFT, DragActivationContext, setDragTarget } from "@/components/project/Sortable";
import { createBlockEditApi, localizeBlock } from "@/components/project/editing";
import { projectThemeAttrs } from "@/components/project/projectTheme";
import { createCaseStudyBlockDefaults } from "@/components/admin/CaseStudyBlockEditor";
import {
  BlockInspector,
  ComponentInspector,
  ComponentTextInspector,
  GridFields,
  GroupInspector,
  InstanceGroup,
  InstanceLayerInspector,
  ItemInspector,
  PageFrameInspector,
  ProjectInspector,
  SectionInspector,
  SquareButton,
  SizeGroup,
  TextLayerInspector,
  InspectorHeader,
  LookFields,
  Group as PanelGroup,
  Glyphs,
  clipOf,
  type MenuItem,
  type DesignUse,
  canMoveItem,
  duplicateItem,
  hasItem,
  itemName,
  moveItem,
  removeItem,
  addEntry,
  itemNoun,
} from "@/components/admin/LiveInspector";
import {
  boxLook,
  cleanOverrides,
  componentUses,
  fitsItems,
  hasOverrides,
  itemHasOverrides,
  layerComponent,
  layoutOverride,
  lookOverride,
  mainComponent,
  pushInstance,
  pushItem,
  resetInstance,
  resolveInstance,
  resolveItem,
  sizeOverride,
  swapsFor,
  textStyleUses,
  useDesignComponents,
  useInstance,
  type ResolvedInstance,
} from "@/components/project/components";
import { DesignSystemStyle } from "@/components/project/designSystem";
import { frameLookStyle, useFrameLook } from "@/components/project/frameLook";
import { VariablesModal } from "@/components/admin/VariablesModal";
import { AssetsPanel } from "@/components/admin/AssetsPanel";
import { PageDesignPanel, TextStylePopover } from "@/components/admin/DesignPanel";
import { ComponentLayers, ComponentsCanvas, mainFrameSelector, mainSelector, type MainSelection } from "@/components/admin/ComponentsCanvas";
import { CanvasToolbar } from "@/components/admin/CanvasToolbar";
import { DropLine, Icons, LayerButton, LayerRow, SizeBadge, layerNode, type BadgeTarget } from "@/components/admin/layerTree";
import type { DesignSystem } from "@/components/admin/useDesignSystem";
import { BLOCK_LABELS, BlockPickerDialog, COMPONENT_TONE, FRAME_TONE, layerIcon, layerKind, layerTone } from "@/components/admin/blockCatalog";
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
  useSortableGroup,
  useSortablePageItem,
  useTreeDrop,
} from "@/components/admin/ProjectDnd";
import type { EditorActions } from "@/components/admin/editorActions";

/**
 * Live editor ("Canlı Düzenleyici"): the project page itself, editable — laid
 * out as Figma's (UI3):
 * - Left: the file — the project, its pages (the project's page and the
 *   Bileşenler page: the site's main components) and the layers of the page
 *   shown (Dosya); the components to put on the page (Varlıklar).
 * - Canvas: the page. It is Bölüm (section) › Blok (group) › its layers —
 *   every Bölüm and Blok a frame with auto layout; a heading or a text is a
 *   text layer, an image an image; everything else an instance of a component
 *   (`Block` in code). As in Figma, each click goes a level deeper: the
 *   section, its Blok, the layer, an item inside it (see pressOn) — its
 *   properties open in the design panel; double-click a text of the selected
 *   layer to type in place. With Cmd / Ctrl held a click picks the innermost
 *   layer at once, and a double-click types in any text. Drag what is
 *   selected to reorder it; layers move between Bloks, Bloks between
 *   sections; with Alt held the drop leaves a copy where it was (see
 *   ProjectDnd). Under the selection, a badge shows its size (SizeBadge). At
 *   the bottom, the toolbar (CanvasToolbar).
 * - Right: the design panel (Tasarım) — whatever is selected; with nothing
 *   selected, the page's theme, the site's variables and text styles — and
 *   the publishing details (Yayın).
 * An instance changes only itself (its overrides — see InstanceOverrides);
 * its main component, on the Bileşenler page, changes every instance.
 * Links never navigate here, images never open the lightbox.
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
      /** An item clicked inside the block (card, step, list item… — an instance, in a component drawn from its main one) */
      itemId?: string;
      /** A text layer of that item (see TextLayer) */
      text?: ItemTextField;
    }
  | { kind: "divider"; dividerId: string }
  /** On the Bileşenler page: a main component, or one of its layers */
  | ({ kind: "component" } & MainSelection);

/** The file's pages, as Figma's: the project's, and the one holding the site's main components. */
type Page = "project" | "components";
/** The left panel's tabs (Figma's File / Assets) and the right one's (Design / Prototype — here, Yayın). */
type LeftTab = "file" | "assets";
type RightTab = "design" | "publish";
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

/** Layer names: the one given in the layer tree, else the default ("01 Bölüm", "Blok 1"…). */
const sectionName = (section: PageSection, index: number) => section.name?.trim() || sectionLabel(index);
const groupName = (group: Group, index: number) => group.name?.trim() || groupLabel(index);

/**
 * A layer's name on the page, as Figma names them: the one given in the layer
 * tree, else — a text — its words; an instance, its main component's name
 * (the type's, for one the site's code draws).
 */
function blockName(block: Block, components?: readonly DesignComponent[]) {
  if (block.name?.trim()) return block.name.trim();
  if (layerKind(block.type) === "text") {
    const words = (block.content ?? "").replace(/\*\*|\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/\s+/g, " ").trim();
    if (words) return words.length > 40 ? `${words.slice(0, 40)}…` : words;
  }
  const main = components ? mainComponent(block.type, components, block.component) : null;
  return main?.name ?? BLOCK_LABELS[block.type];
}

/** A frame's icon in the layer tree, as Figma's: its auto layout — stacked, side by side (wrapping), on a grid. */
function frameIcon(grid?: GridSettings) {
  const flow = gridFlow(grid);
  if (flow === "vertical") return fi("16.autolayout.vertical");
  if (flow === "horizontal") return fi(grid?.wrap ? "16.autolayout.wrap" : "16.autolayout.horizontal");
  return fi("16.autolayout.grid");
}

// ── Shared chrome ─────────────────────────────────────────────────────────────

/** A tab of a panel's header, as Figma's (File / Assets, Design / Prototype): its name, bold while shown. */
function PanelTab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "h-7 px-2 rounded-[6px] text-[12px] transition-colors cursor-pointer",
        active ? "font-semibold text-[var(--text-title)] bg-[var(--bg-4)]" : "font-medium text-[var(--text-subtitle)] hover:text-[var(--text-title)]"
      )}
    >
      {label}
    </button>
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
      ? "outline-solid outline-[var(--edit-accent)]"
      : active
        ? "outline-dashed outline-[color-mix(in_srgb,var(--edit-accent)_40%,transparent)]"
        : cn(
            "outline-dashed outline-transparent data-[canvas-hover]:outline-[color-mix(in_srgb,var(--edit-accent)_40%,transparent)]",
            // Hovered in the layer tree.
            "data-[layer-hover]:outline-[color-mix(in_srgb,var(--edit-accent)_70%,transparent)]"
          )
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
        // Full colour when selected (or dragged), a lighter one while a click would select it (--edit-tone: the layer's — blue for a text or an image, purple for an instance).
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
  // An instance drawn from its main component draws its look on its frame (see boxLook).
  const look = useFrameLook(boxLook(block));
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
      // --edit-tone: the layer's colour (see layerTone) — its frame, cards and hovered text.
      style={{ ...place.style, ...size.style, ...free.style, ...look, ...sortableStyle(transform, transition), "--edit-tone": layerTone(block.type) } as CSSProperties}
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
          style={{ background: layerTone(line.blockType) }}
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
  const look = useFrameLook(group.look);
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
      style={{ ...place.style, ...grid.style, ...size.style, ...free.style, ...look, ...sortableStyle(transform, transition), "--edit-tone": FRAME_TONE } as CSSProperties}
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
  const look = useFrameLook(section.look);
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
        isDragging && cn(DRAG_LIFT, "bg-[var(--bg-1)]"),
        // Hidden (its eye): no room on the canvas either, as in Figma — the layers keep it.
        section.look?.hidden && "hidden"
      )}
    >
      {(!empty || showCells) && (
        <div data-section-frame className={grid.className} style={{ ...grid.style, ...look }}>
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

// ── Sections panel ────────────────────────────────────────────────────────────

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

/**
 * Components and items open in the layer tree (see LayerBlock) — they start
 * closed, as in Figma; a selection inside opens them (revealLayer).
 */
const OpenComponentsContext = createContext<{ open: ReadonlySet<string>; toggle: (id: string) => void }>({ open: new Set(), toggle: () => {} });

/**
 * A layer of a Blok: a text, an image or an instance (Figma's purple — see
 * layerKind). An instance drawn from its main component opens on its items,
 * each an instance of the component it repeats.
 */
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
  const instance = useInstance(block);
  const components = useDesignComponents();
  const select = () => onSelect({ kind: "block", blockId: block.id });
  const drop = useTreeDrop(block.id);
  const { open: opened, toggle } = useContext(OpenComponentsContext);
  // Drawn from its main component: its items, and their text layers, are layers too.
  const open = instance?.item ? opened.has(block.id) : undefined;
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
        tone={layerTone(block.type)}
        nameTone={layerKind(block.type) === "instance" ? COMPONENT_TONE : undefined}
        icon={layerIcon(block.type)}
        name={blockName(block, components)}
        selected={selected}
        open={open}
        onToggle={() => toggle(block.id)}
        hover={`[data-block-id="${block.id}"]`}
        onSelect={select}
        onInspect={select}
        onRename={(name) => actions.updateBlock(block.id, { name })}
        hidden={Boolean(block.look?.hidden)}
        onToggleHidden={() => actions.updateBlock(block.id, { look: { ...block.look, hidden: block.look?.hidden ? undefined : true } })}
      >
        {noun && (
          <LayerButton label={`${noun} ekle`} onClick={addItem}>{Icons.plus}</LayerButton>
        )}
      </LayerRow>
      {open && instance?.item && (block.entries ?? []).map((entry) => (
        <LayerItem key={entry.id} block={block} entry={entry} instance={instance} selection={selection} onSelect={onSelect} />
      ))}
    </div>
  );
}

/**
 * An item of an instance — an instance itself, of the component its main one
 * repeats (a Kart) — in the layer tree, with its text layers. Items are
 * reordered on the canvas: its rows don't drag.
 */
function LayerItem({ block, entry, instance, selection, onSelect }: {
  block: Block;
  entry: BlockEntry;
  instance: ResolvedInstance;
  selection: Selection;
  onSelect: SelectFromPanel;
}) {
  const inside = selection.kind === "block" && selection.blockId === block.id && selection.itemId === entry.id;
  const { open: opened, toggle } = useContext(OpenComponentsContext);
  const component = instance.item!.component;
  const texts = component.layers.filter((layer): layer is TextLayer => layer.kind === "text");
  const open = opened.has(entry.id);
  const item = `[data-block-id="${block.id}"] [data-entry-id="${entry.id}"]`;
  const select = () => onSelect({ kind: "block", blockId: block.id, itemId: entry.id });
  return (
    <div data-layer-id={entry.id} data-layer-kind="item" data-no-drag className={layerNode(inside, false)}>
      <LayerRow
        depth={3}
        tone={COMPONENT_TONE}
        nameTone={COMPONENT_TONE}
        icon={fi("16.instance")}
        name={component.name}
        selected={inside && !selection.text}
        open={texts.length > 0 ? open : undefined}
        onToggle={() => toggle(entry.id)}
        hover={item}
        onSelect={select}
        onInspect={select}
        hidden={Boolean(entry.overrides?.look?.hidden)}
      />
      {open && texts.map((layer) => {
        const pick = () => onSelect({ kind: "block", blockId: block.id, itemId: entry.id, text: layer.field });
        return (
          <div key={layer.id} data-layer-id={`${entry.id}:${layer.field}`} data-layer-kind="text" data-no-drag>
            <LayerRow
              depth={4}
              tone={FRAME_TONE}
              icon={fi("16.text")}
              name={layer.name}
              selected={inside && selection.text === layer.field}
              hover={`${item} [data-text-layer="${layer.field}"]`}
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
        tone={FRAME_TONE}
        icon={frameIcon(group.grid)}
        name={groupName(group, index)}
        selected={selected}
        open={open}
        onToggle={() => onToggle(group.id)}
        hover={`[data-group-id="${group.id}"]`}
        onSelect={select}
        onInspect={select}
        onRename={(name) => actions.updateGroup(group.id, { name })}
        hidden={Boolean(group.look?.hidden)}
        onToggleHidden={() => actions.updateGroup(group.id, { look: { ...group.look, hidden: group.look?.hidden ? undefined : true } })}
      >
        <LayerButton label="Bloğa ekle" onClick={() => onAddBlock(group.id)}>{Icons.plus}</LayerButton>
      </LayerRow>
      {open && (
        <GroupBlocks group={group}>
          {group.blocks.map((block) => (
            <LayerBlock key={block.id} block={block} group={group} selection={selection} actions={actions} onSelect={onSelect} />
          ))}
          {group.blocks.length === 0 && (
            <p className="h-7 flex items-center pl-[56px] text-[12px] text-[var(--text-subtitle)] select-none">Boş — varlıklardan sürükle</p>
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
        tone={FRAME_TONE}
        icon={frameIcon(section.grid)}
        name={sectionName(section, index)}
        selected={selected}
        open={open}
        onToggle={() => onToggle(section.id)}
        hover={`[data-section-id="${section.id}"]`}
        onSelect={select}
        onInspect={select}
        onRename={(name) => actions.updateSection(section.id, { name })}
        hidden={Boolean(section.look?.hidden)}
        onToggleHidden={() => actions.updateSection(section.id, { look: { ...section.look, hidden: section.look?.hidden ? undefined : true } })}
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
        tone={FRAME_TONE}
        icon={fi("16.line")}
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
        tone={FRAME_TONE}
        icon={fi("16.autolayout.vertical")}
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
          tone={FRAME_TONE}
          icon={fi("16.autolayout.vertical")}
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

    </div>
  );
}

/**
 * Katmanlar — the page as a tree, as in Figma: its frame › Bölüm › Blok ›
 * texts, images and instances (an instance › its items › their texts), each
 * folding open. Click to select (the canvas follows),
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

// ── Publishing (Yayın) ────────────────────────────────────────────────────────

/** A line of the publishing panel: what it is, and whether the project has it. */
function StatusRow({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between h-7 text-[12px]">
      <span className="text-[var(--text-subtitle)]">{label}</span>
      <span className={ok ? "font-medium text-[var(--text-title)]" : "text-[var(--text-subtitle)]"}>{ok ? "Var" : "Eksik"}</span>
    </div>
  );
}

/** A small action of the panel, as Figma's secondary buttons. */
function PanelButton({ icon, children, onClick }: { icon?: ReactNode; children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center justify-center gap-1.5 h-7 px-2.5 rounded-[6px] bg-[var(--bg-4)] text-[12px] font-medium text-[var(--text-title)] hover:bg-[var(--bg-5)] transition-colors cursor-pointer"
    >
      {icon}
      {children}
    </button>
  );
}

/** The design panel's Yayın tab: the page's address, what it holds and what it misses, and the case-study template. */
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
    <div className="flex flex-col">
      <PanelGroup title="Bağlantı">
        <div className="flex items-center h-7 px-2 rounded-[6px] bg-[var(--bg-4)] text-[12px] text-[var(--text-title)] tabular-nums truncate select-all">{path}</div>
        <div className="grid grid-cols-2 gap-2">
          <PanelButton icon={Icons.copy} onClick={copy}>{copied ? "Kopyalandı" : "Kopyala"}</PanelButton>
          <PanelButton icon={Icons.external} onClick={() => window.open(path, "_blank")}>Yeni sekmede aç</PanelButton>
        </div>
      </PanelGroup>

      <PanelGroup title="İçerik">
        <div className="grid grid-cols-4 gap-1.5">
          {[
            { value: sections.length, label: "Bölüm" },
            { value: groups, label: "Blok" },
            { value: blocks, label: "Katman" },
            { value: dividers, label: "Ayırıcı" },
          ].map((s) => (
            <div key={s.label} className="flex flex-col items-center gap-0.5 py-2 rounded-[6px] bg-[var(--bg-4)]">
              <span className="text-[16px] font-medium leading-6 text-[var(--text-title)] tabular-nums">{s.value}</span>
              <span className="text-[11px] leading-4 text-[var(--text-subtitle)]">{s.label}</span>
            </div>
          ))}
        </div>
        <div className="flex flex-col">
          <StatusRow label="Başlık (TR)" ok={Boolean(project.title)} />
          <StatusRow label="Başlık (EN)" ok={Boolean(project.titleEn)} />
          <StatusRow label="Açıklama (TR)" ok={Boolean(project.description)} />
          <StatusRow label="Açıklama (EN)" ok={Boolean(project.descriptionEn)} />
          <StatusRow label="Kapak görseli" ok={Boolean(project.coverImage)} />
        </div>
      </PanelGroup>

      <PanelGroup title="Şablon">
        <p className="text-[11px] leading-4 text-[var(--text-subtitle)]">
          Sayfanın içeriğini, bütün bileşenleri kullanan vaka çalışması şablonuyla değiştirir.
        </p>
        <PanelButton
          onClick={() => {
            if (window.confirm("Sayfanın mevcut içeriği şablonla değiştirilecek. Devam edilsin mi?")) onLoadTemplate();
          }}
        >
          Şablonu yükle
        </PanelButton>
      </PanelGroup>
    </div>
  );
}

// ── Live editor ───────────────────────────────────────────────────────────────

/** What a page component's main shows on the Bileşenler page when the project has no instance of it. */
const SAMPLE_ENTRIES: Partial<Record<BlockType, Omit<BlockEntry, "id">[]>> = {
  info: [
    { label: "Rol", value: "Ürün tasarımcısı" },
    { label: "Süre", value: "6 ay" },
    { label: "Ekip", value: "4 kişi" },
    { label: "Platform", value: "iOS · Android" },
  ],
};

/** A page of the file in the left panel's list, as Figma's: its name, ticked while shown. */
function PageRow({ label, icon, active, onClick }: { label: string; icon: ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-1.5 h-7 mx-1 px-2 rounded-[6px] text-left text-[12px] transition-colors cursor-pointer",
        active ? "bg-[var(--bg-4)] font-medium text-[var(--text-title)]" : "text-[var(--text-p)] hover:bg-[color-mix(in_srgb,var(--bg-4)_60%,transparent)]"
      )}
    >
      <span className="flex w-4 shrink-0 text-[var(--text-title)]">{active && <FigmaIcon name="16.check" />}</span>
      <span className="flex shrink-0 text-[var(--text-subtitle)]">{icon}</span>
      <span className="min-w-0 truncate">{label}</span>
    </button>
  );
}

export function LiveEditor({ project, lang, slug, companies, actions, system, onLoadTemplate }: {
  project: ProjectData;
  lang: Lang;
  slug: string;
  companies: string[];
  actions: EditorActions;
  /** The site's design system: its variables, text styles and components — changes go to every page */
  system: DesignSystem;
  onLoadTemplate: () => void;
}) {
  const { variables, textStyles, components } = system;
  const [page, setPage] = useState<Page>("project");
  const [leftTab, setLeftTab] = useState<LeftTab>("file");
  const [rightTab, setRightTab] = useState<RightTab>("design");
  const [rawSelection, setSelection] = useState<Selection>({ kind: "none" });
  // Where the component picker adds: a Blok, after one of its layers or at its end.
  const [picker, setPicker] = useState<PickerTarget | null>(null);
  // Sections and Bloks folded in the layer tree (kept across tab switches).
  const [collapsedLayers, setCollapsedLayers] = useState<Set<string>>(() => new Set());
  // Instances (and their items) open in the layer tree — they start closed, as in Figma.
  const [openComponents, setOpenComponents] = useState<Set<string>>(() => new Set());
  // Main components folded in the Bileşenler page's tree — they start open: their layers are what is there.
  const [closedMains, setClosedMains] = useState<Set<string>>(() => new Set());
  const [variablesOpen, setVariablesOpen] = useState(false);
  // The text style being edited in its popover, and where it opened.
  const [styleEditor, setStyleEditor] = useState<{ id: string; anchor: { top: number; left: number } } | null>(null);
  const toggleIn = (set: (update: (prev: Set<string>) => Set<string>) => void) => (id: string) =>
    set((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleComponent = useCallback((id: string) => toggleIn(setOpenComponents)(id), []);
  const layerSections = sectionsOf(project.items);
  const allLayersCollapsed = layerSections.length > 0 && layerSections.every((s) => collapsedLayers.has(s.id));
  /** Folds every section (the selected one too) — or opens everything, Bloks included. */
  const toggleAllLayers = (collapse: boolean) => setCollapsedLayers(collapse ? new Set(layerSections.map((s) => s.id)) : new Set());
  const reordering = usePageReorder();

  // Escape clears the selection (text fields handle their own Escape first; a popover or window closes itself).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape" || (document.activeElement as HTMLElement | null)?.isContentEditable || styleEditor || variablesOpen) return;
      setSelection({ kind: "none" });
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [styleEditor, variablesOpen]);

  // A deleted (or undone) element clears the selection.
  const selectedBlock = rawSelection.kind === "block" ? findBlock(project.items, rawSelection.blockId) : null;
  const selectedGroup = rawSelection.kind === "group" ? findGroup(project.items, rawSelection.groupId) : null;
  const selectedSection = rawSelection.kind === "section" ? findSection(project.items, rawSelection.sectionId) : null;
  const selectedDivider = rawSelection.kind === "divider" && project.items.some((i) => i.id === rawSelection.dividerId);
  const selectedMain = rawSelection.kind === "component" ? components.find((c) => c.id === rawSelection.componentId) ?? null : null;
  const selectedMainLayer = selectedMain && rawSelection.kind === "component" && rawSelection.layerId ? selectedMain.layers.find((l) => l.id === rawSelection.layerId) ?? null : null;
  const selection: Selection =
    (rawSelection.kind === "block" && !selectedBlock) ||
    (rawSelection.kind === "group" && !selectedGroup) ||
    (rawSelection.kind === "section" && !selectedSection) ||
    (rawSelection.kind === "divider" && !selectedDivider) ||
    (rawSelection.kind === "component" && !selectedMain)
      ? { kind: "none" }
      : rawSelection.kind === "component" && rawSelection.layerId && !selectedMainLayer
        ? { kind: "component", componentId: rawSelection.componentId }
        : rawSelection;
  const mainSelection: MainSelection | null = selection.kind === "component" ? { componentId: selection.componentId, layerId: selection.layerId } : null;
  // An item that no longer exists (deleted, undone) falls back to its block.
  const selectedItemId =
    selection.kind === "block" && selection.itemId && selectedBlock && hasItem(selectedBlock.block, selection.itemId)
      ? selection.itemId
      : null;
  // The selected instance, drawn from its main component — null for a layer the site's code draws.
  const instance = selectedBlock ? resolveInstance(selectedBlock.block, components, variables, textStyles) : null;
  const selectedEntry = selectedBlock && selectedItemId ? selectedBlock.block.entries?.find((e) => e.id === selectedItemId) ?? null : null;
  const itemTexts = instance?.item ? instance.item.component.layers.filter((layer): layer is TextLayer => layer.kind === "text") : [];
  // A text layer of that item.
  const selectedTextLayer = selection.kind === "block" && selectedItemId && selection.text ? itemTexts.find((layer) => layer.field === selection.text) ?? null : null;
  const selectedText = selectedTextLayer?.field ?? null;
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
   * A new selection opens the layers holding it in the layer tree — once:
   * they fold again at will (also while it stays selected).
   */
  function revealLayer(next: Selection) {
    if (next.kind === "component") {
      setClosedMains((prev) => (prev.has(next.componentId) ? new Set([...prev].filter((id) => id !== next.componentId)) : prev));
      return;
    }
    const block = next.kind === "block" ? findBlock(project.items, next.blockId) : null;
    const group = next.kind === "group" ? findGroup(project.items, next.groupId) : null;
    const ids = block ? [block.section.id, block.group.id] : group ? [group.section.id] : [];
    setCollapsedLayers((prev) => {
      if (!ids.some((id) => prev.has(id))) return prev;
      const open = new Set(prev);
      ids.forEach((id) => open.delete(id));
      return open;
    });
    // An item or text layer: its instance (and item) open too — they start closed.
    if (next.kind !== "block" || !next.itemId) return;
    const inner = next.text ? [next.blockId, next.itemId] : [next.blockId];
    setOpenComponents((prev) => (inner.every((id) => prev.has(id)) ? prev : new Set([...prev, ...inner])));
  }

  /**
   * Selecting shows the element in the design panel (right) — on its page,
   * which comes up — and, with `scroll`, brings it into view on the canvas.
   */
  function select(next: Selection, { scroll = false } = {}) {
    setSelection(next);
    revealLayer(next);
    const on: Page | null = next.kind === "component" ? "components" : next.kind === "none" ? null : "project";
    if (on && on !== page) setPage(on);
    if (!scroll) return;
    // Next frames: the element may have just been added, or its page come up.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const target =
        next.kind === "component" ? document.querySelector(`main ${mainSelector(next, components)}`)
        : next.kind === "block" && next.text ? document.querySelector(`[data-block-id="${next.blockId}"] [data-entry-id="${next.itemId}"] [data-text-layer="${next.text}"]`)
        : next.kind === "block" && next.itemId ? document.querySelector(`[data-block-id="${next.blockId}"] [data-entry-id="${next.itemId}"]`)
        : next.kind === "block" ? document.querySelector(`[data-block-id="${next.blockId}"]`)
        : next.kind === "group" ? document.querySelector(`[data-group-id="${next.groupId}"]`)
        : next.kind === "section" ? document.querySelector(`[data-section-id="${next.sectionId}"]`)
        : next.kind === "divider" ? document.querySelector(`[data-divider-id="${next.dividerId}"]`)
        : next.kind === "meta" ? document.getElementById("live-overview")
        : null;
      target?.scrollIntoView({ behavior: "smooth", block: next.kind === "section" || next.kind === "meta" ? "start" : "center" });
    }));
  }

  /** Figma's "Go to main component": its page, the main component (or a layer of it) selected, the layer tree showing it. */
  function goToMain(componentId: string, layerId?: string) {
    setLeftTab("file");
    select({ kind: "component", componentId, layerId }, { scroll: true });
  }

  /** Another page of the file: its canvas and layers, nothing selected. */
  function showPage(next: Page) {
    if (next === page) return;
    setPage(next);
    setSelection({ kind: "none" });
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

  /**
   * An asset click adds it where the selection is: after the selected layer,
   * into the selected Blok or section, else at the page's end — an instance
   * of `componentId`, when it is one of the site's components.
   */
  function addFromCatalog(type: BlockType, componentId?: string) {
    const extras = componentId ? { component: componentId } : undefined;
    const blockId = selectedBlock
      ? actions.addBlock(selectedBlock.group.id, type, extras, selectedBlock.block.id)
      : selectedGroup
        ? actions.addBlock(selectedGroup.group.id, type, extras)
        : selectedSection
          ? actions.addBlockToSection(selectedSection.section.id, type, extras)
          : actions.addBlockToEnd(type, extras);
    select({ kind: "block", blockId }, { scroll: true });
  }
  const catalogTarget = selectedBlock
    ? "seçili katmanın arkasına"
    : selectedGroup
      ? `${groupName(selectedGroup.group, selectedGroup.index)} içine`
      : selectedSection
        ? `${sectionName(selectedSection.section, selectedSection.index)} içine`
        : "sayfanın sonuna";

  /** The toolbar's frame: a Blok in the selected (or selection's) Bölüm, after the selected Blok — else a new Bölüm. */
  const frameSection = selectedBlock?.section.id ?? selectedGroup?.section.id ?? selectedSection?.section.id ?? null;
  function addFrame() {
    if (frameSection) select({ kind: "group", groupId: actions.addGroup(frameSection, selectedBlock?.group.id ?? selectedGroup?.group.id) }, { scroll: true });
    else select({ kind: "section", sectionId: actions.addSection() }, { scroll: true });
  }

  // A layer dropped from the assets becomes the selection (when it landed somewhere).
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

  /**
   * The layers holding the selection, for the header's menu (Figma's "select
   * a parent"): the page, its section, Blok, layer, item — each selects that layer.
   */
  function holders(at: { section?: PageSection; group?: Group; block?: Block; itemId?: string }): MenuItem[] {
    const items: MenuItem[] = [{ label: project.title?.trim() || "Sayfa", hint: "Sayfa", onSelect: () => select({ kind: "page" }, { scroll: true }) }];
    const { section, group, block, itemId } = at;
    if (section) {
      const index = findSection(project.items, section.id)?.index ?? 0;
      items.push({ label: sectionName(section, index), hint: "Bölüm", onSelect: () => select({ kind: "section", sectionId: section.id }, { scroll: true }) });
    }
    if (section && group) {
      const index = section.groups.findIndex((g) => g.id === group.id);
      items.push({ label: groupName(group, index), hint: "Blok", onSelect: () => select({ kind: "group", groupId: group.id }, { scroll: true }) });
    }
    if (block) items.push({ label: blockName(block, components), hint: layerKind(block.type) === "instance" ? "Örnek" : BLOCK_LABELS[block.type], onSelect: () => select({ kind: "block", blockId: block.id }, { scroll: true }) });
    if (block && itemId) items.push({ label: itemName(block, itemId), hint: itemNoun(block), onSelect: () => select({ kind: "block", blockId: block.id, itemId }, { scroll: true }) });
    return items;
  }

  // ── Overrides: what an instance, or an item of one, changes of its main component ──

  /** An item's overrides, `patch` over them — null: back to its component's (it stays hidden if it was). */
  function setItemOverrides(block: Block, itemId: string, patch: Partial<InstanceOverrides> | null) {
    actions.updateBlock(block.id, {
      entries: (block.entries ?? []).map((e) =>
        e.id !== itemId ? e : { ...e, overrides: patch ? cleanOverrides({ ...e.overrides, ...patch }) : e.overrides?.look?.hidden ? { look: { hidden: true } } : undefined }
      ),
    });
  }
  /** Figma's "Push changes to main component": an instance's overrides go to its main one — every instance — and it has none left. */
  function pushBlock(block: Block, resolved: ResolvedInstance) {
    system.setComponent(pushInstance(resolved.main, block));
    actions.updateBlock(block.id, resetInstance(block));
  }
  /** The same for an item: to the component it is (its size to the layer repeating it). */
  function pushEntry(block: Block, entry: BlockEntry, resolved: ResolvedInstance) {
    const item = resolved.item;
    if (!item || !entry.overrides) return;
    system.setComponent(pushItem(item.component, entry.overrides));
    const { size } = entry.overrides;
    if (size) system.setComponent({ ...resolved.main, layers: resolved.main.layers.map((layer) => (layer.id === item.layer.id ? { ...layer, size } : layer)) });
    setItemOverrides(block, entry.id, null);
  }

  // ── Uses: where a main component and a text style are ──

  /** Where a main component is: a page component's instances on this page; one used inside others, the components repeating it. */
  function mainUses(component: DesignComponent): DesignUse[] {
    if (component.type) {
      return sectionsOf(project.items).flatMap((section, index) =>
        sectionBlocks(section)
          .filter((b) => b.type === component.type && mainComponent(b.type, components, b.component)?.id === component.id)
          .map((b) => ({
            key: b.id,
            icon: fi("16.instance"),
            tone: COMPONENT_TONE,
            label: blockName(b, components),
            detail: sectionName(section, index),
            onSelect: () => select({ kind: "block", blockId: b.id }, { scroll: true }),
          }))
      );
    }
    return (componentUses(components).get(component.id) ?? []).map(({ component: holder, layer }) => ({
      key: `${holder.id}:${layer.id}`,
      icon: fi("16.component"),
      tone: COMPONENT_TONE,
      label: holder.name,
      detail: layer.name,
      onSelect: () => select({ kind: "component", componentId: holder.id, layerId: layer.id }, { scroll: true }),
    }));
  }
  /** Where a text style is: the components' text layers in it — each selected on the Bileşenler page. */
  function styleUses(styleId: string): DesignUse[] {
    return (textStyleUses(components).get(styleId) ?? []).map(({ component, layer }) => ({
      key: `${component.id}:${layer.id}`,
      icon: fi("16.text"),
      tone: FRAME_TONE,
      label: layer.name,
      detail: component.name,
      onSelect: () => {
        setStyleEditor(null);
        goToMain(component.id, layer.id);
      },
    }));
  }
  /** Opens a text style's popover beside the design panel, at `under`'s height. */
  function openStyle(id: string, under: Element) {
    const top = under.getBoundingClientRect().top;
    const left = document.querySelector("[data-design-panel]")?.getBoundingClientRect().left ?? under.getBoundingClientRect().left;
    setStyleEditor({ id, anchor: { top, left } });
  }

  /** Items for a page component's main to show: its first instance's on this page, else samples. */
  const sampleEntries = (type: BlockType): BlockEntry[] => {
    const block = sectionsOf(project.items).flatMap(sectionBlocks).find((b) => b.type === type && (b.entries?.length ?? 0) > 0);
    if (block) return localizeBlock(block, lang).entries ?? [];
    return (SAMPLE_ENTRIES[type] ?? createCaseStudyBlockDefaults(type).entries ?? []).map((e, i) => ({ id: `sample-${i}`, ...e }));
  };

  // ── The design panel (right), as Figma's: the selection's header — its kind, name and menu — its actions and properties ──
  let header: { icon?: ReactNode; tone?: string; title: string; menu?: MenuItem[] } | null = null;
  let inspectorActions: ReactNode = null;
  let content: ReactNode = null;

  if (selectedBlock && selectedEntry && selectedTextLayer && instance?.item) {
    // A text of an item of an instance.
    const { section, group, block } = selectedBlock;
    const item = instance.item;
    const layer = selectedTextLayer;
    const entry = selectedEntry;
    const own = resolveItem(item, entry.overrides, instance.knownStyle);
    header = {
      icon: fi("16.text"),
      tone: FRAME_TONE,
      title: layer.name,
      menu: [
        ...holders({ section, group, block, itemId: entry.id }),
        { label: "Ana bileşene git", hint: item.component.name, divided: true, onSelect: () => goToMain(item.component.id, layer.id) },
      ],
    };
    content = (
      <TextLayerInspector
        block={block}
        itemId={entry.id}
        layer={layer}
        styleId={own.style(layer)}
        overridden={Boolean(entry.overrides?.styles?.[layer.field])}
        styles={textStyles}
        variables={variables}
        lang={lang}
        onStyle={(id) => setItemOverrides(block, entry.id, { styles: { ...entry.overrides?.styles, [layer.field]: id === layer.style ? undefined : id } })}
        onEditStyle={openStyle}
        onChange={(u) => actions.updateBlock(block.id, u)}
      />
    );
  } else if (selectedBlock && selectedItemId) {
    // An item of a layer (a card, a step, a list item…) — of an instance drawn from its main component, an instance itself.
    const { section, group, block } = selectedBlock;
    const itemId = selectedItemId;
    const update = (patch: Partial<Block>) => actions.updateBlock(block.id, patch);
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
    if (instance?.item && selectedEntry) {
      const item = instance.item;
      const entry = selectedEntry;
      const own = resolveItem(item, entry.overrides, instance.knownStyle);
      const overridden = itemHasOverrides(entry);
      const setLayout = (next: GridSettings) => setItemOverrides(block, itemId, { layout: layoutOverride(item.layout, next) });
      const setLook = (next: FrameLook) => setItemOverrides(block, itemId, { look: lookOverride(item.look, next) });
      header = {
        icon: fi("16.instance"),
        tone: COMPONENT_TONE,
        title: item.component.name,
        menu: [
          ...holders({ section, group, block }),
          { label: "Ana bileşene git", hint: item.component.name, divided: true, onSelect: () => goToMain(item.component.id) },
          ...(overridden
            ? [
                { label: "Tüm değişiklikleri sıfırla", onSelect: () => setItemOverrides(block, itemId, null) },
                { label: "Ana bileşene uygula", hint: "her örneğe", onSelect: () => pushEntry(block, entry, instance) },
              ]
            : []),
        ],
      };
      content = (
        <div className="flex flex-col">
          <InstanceGroup name={item.component.name} onGoToMain={() => goToMain(item.component.id)} overridden={overridden} onReset={() => setItemOverrides(block, itemId, null)} />
          <ItemInspector
            block={block}
            itemId={itemId}
            lang={lang}
            projectSlug={slug}
            layout={
              <>
                <GridFields
                  grid={own.layout}
                  measure={`[data-block-id="${block.id}"] [data-entry-id="${itemId}"]`}
                  size={own.size}
                  onSize={(size) => setItemOverrides(block, itemId, { size: sizeOverride(item.layer.size, size) })}
                  cells={layoutCells(itemTexts.map(() => ({})), gridColumns(own.layout).length, gridRows(own.layout))}
                  onAlign={(justify, align) => setLayout({ ...own.layout, justify, align })}
                  onChange={setLayout}
                  clip={clipOf(own.look, setLook)}
                />
                <LookFields look={own.look} variables={variables} canHide onChange={setLook} />
              </>
            }
            onChange={update}
          />
        </div>
      );
    } else {
      header = { icon: fi("16.frame"), tone: layerTone(block.type), title: itemNoun(block) ?? "Öğe", menu: holders({ section, group, block }) };
      content = <ItemInspector block={block} itemId={itemId} lang={lang} projectSlug={slug} onChange={update} />;
    }
  } else if (selectedBlock) {
    // A layer: a text, an image or an instance.
    const { section, group, block } = selectedBlock;
    const kind = layerKind(block.type);
    const update = (patch: Partial<Block>) => actions.updateBlock(block.id, patch);
    const overridden = instance ? hasOverrides(block) : false;
    const reset = () => update(resetInstance(block));
    header = {
      icon: layerIcon(block.type),
      tone: layerTone(block.type),
      title: instance ? instance.main.name : kind === "text" ? "Metin" : kind === "image" ? "Görsel" : BLOCK_LABELS[block.type],
      menu: [
        ...holders({ section, group }),
        ...(instance
          ? [
              { label: "Ana bileşene git", hint: instance.main.name, divided: true, onSelect: () => goToMain(instance.main.id) },
              ...(overridden
                ? [
                    { label: "Tüm değişiklikleri sıfırla", onSelect: reset },
                    { label: "Ana bileşene uygula", hint: "her örneğe", onSelect: () => pushBlock(block, instance) },
                  ]
                : []),
            ]
          : []),
      ],
    };
    inspectorActions = (
      <>
        {instance && <LayerButton label="Ana bileşene git" onClick={() => goToMain(instance.main.id)}>{Icons.goTo}</LayerButton>}
        <LayerButton label="Çoğalt" onClick={() => select({ kind: "block", blockId: actions.duplicateBlock(block) })}>{Icons.duplicate}</LayerButton>
        <LayerButton label="Sil" onClick={() => actions.deleteBlock(block.id)}>{Icons.trash}</LayerButton>
      </>
    );
    const setLayout = (next: GridSettings) => instance && update({ layout: layoutOverride(instance.base.layout, next) });
    const setLook = (next: FrameLook) => instance && update({ look: lookOverride(instance.base.look, next) });
    content = (
      <div className="flex flex-col">
        {kind === "instance" &&
          (instance ? (
            <InstanceGroup
              name={instance.main.name}
              swaps={swapsFor(block.type, components).map((c) => ({ id: c.id, name: c.name }))}
              current={instance.main.id}
              onSwap={(id) => update({ component: id })}
              onGoToMain={() => goToMain(instance.main.id)}
              overridden={overridden}
              onReset={reset}
            />
          ) : (
            <InstanceGroup name={BLOCK_LABELS[block.type]} note="Sitenin kodunun çizdiği bir bileşen: bir kütüphanenin gibi, ana bileşeni burada açılmaz." />
          ))}
        <BlockInspector
          block={block}
          lang={lang}
          projectSlug={slug}
          onChange={update}
          onSelectEntry={(itemId) => select({ kind: "block", blockId: block.id, itemId }, { scroll: true })}
        />
        {instance ? (
          <GridFields
            grid={instance.layout}
            measure={`[data-block-id="${block.id}"] [data-component-frame]`}
            size={block.size}
            onSize={(size) => update({ size })}
            cells={layoutCells((block.entries ?? []).map(() => ({})), gridColumns(instance.layout).length, gridRows(instance.layout))}
            onAlign={(justify, align) => setLayout({ ...instance.layout, justify, align })}
            onChange={setLayout}
            clip={clipOf(instance.look, setLook)}
          />
        ) : (
          <SizeGroup
            size={block.size}
            measure={`[data-block-id="${block.id}"]`}
            onChange={(size) => update({ size })}
            clip={{ checked: Boolean(block.look?.clip), onChange: (clip) => update({ look: { ...block.look, clip: clip || undefined } }) }}
          />
        )}
        <LookFields look={instance ? instance.look : block.look} variables={variables} canHide onChange={instance ? setLook : (look) => update({ look })} />
      </div>
    );
  } else if (selectedGroup) {
    const { group, section } = selectedGroup;
    header = { icon: frameIcon(group.grid), tone: FRAME_TONE, title: "Blok", menu: holders({ section }) };
    inspectorActions = (
      <>
        <LayerButton label="Bloğa ekle" onClick={() => setPicker({ groupId: group.id })}>{Icons.plus}</LayerButton>
        <LayerButton label="Bloğu çoğalt" onClick={() => select({ kind: "group", groupId: actions.duplicateGroup(group.id) })}>{Icons.duplicate}</LayerButton>
        <LayerButton label="Bloğu sil" onClick={() => actions.deleteGroup(group.id)}>{Icons.trash}</LayerButton>
      </>
    );
    content = (
      <GroupInspector
        group={group}
        variables={variables}
        onChange={(patch) => actions.updateGroup(group.id, patch)}
        onAlign={(justify, align) => actions.alignGroup(group.id, justify, align)}
      />
    );
  } else if (selectedSection) {
    const { section } = selectedSection;
    header = { icon: frameIcon(section.grid), tone: FRAME_TONE, title: "Bölüm", menu: holders({}) };
    inspectorActions = (
      <>
        <LayerButton label="Blok ekle" onClick={() => select({ kind: "group", groupId: actions.addGroup(section.id) })}>{Icons.plus}</LayerButton>
        <LayerButton label="Bölümü sil" onClick={() => actions.deleteItem(section.id)}>{Icons.trash}</LayerButton>
      </>
    );
    content = (
      <SectionInspector
        section={section}
        variables={variables}
        onChange={(patch) => actions.updateSection(section.id, patch)}
        onAlign={(justify, align) => actions.alignSection(section.id, justify, align)}
      />
    );
  } else if (selection.kind === "page") {
    header = { icon: fi("16.autolayout.vertical"), tone: FRAME_TONE, title: "Sayfa" };
    content = <PageFrameInspector project={project} variables={variables} onChange={(frame) => actions.updateMeta({ frame })} />;
  } else if (selection.kind === "meta") {
    header = { icon: fi("16.autolayout.vertical"), tone: FRAME_TONE, title: "Proje bilgileri", menu: holders({}) };
    content = <ProjectInspector project={project} lang={lang} slug={slug} companies={companies} onChange={actions.updateMeta} />;
  } else if (selection.kind === "divider") {
    const dividerId = selection.dividerId;
    header = { icon: fi("16.line"), tone: FRAME_TONE, title: "Ayırıcı", menu: holders({}) };
    inspectorActions = <LayerButton label="Ayırıcıyı sil" onClick={() => actions.deleteItem(dividerId)}>{Icons.trash}</LayerButton>;
    content = <p className="px-4 py-3 text-[11px] leading-4 text-[var(--text-subtitle)]">Bölümler arasındaki çizgi. Seçip sürükleyerek taşıyabilirsin.</p>;
  } else if (selectedMain && selectedMainLayer?.kind === "text") {
    // On the Bileşenler page: a text of a main component.
    const main = selectedMain;
    const layer = selectedMainLayer;
    header = { icon: fi("16.text"), tone: FRAME_TONE, title: layer.name, menu: [{ label: main.name, hint: "Ana bileşen", onSelect: () => select({ kind: "component", componentId: main.id }) }] };
    content = (
      <ComponentTextInspector
        layer={layer}
        measure={mainSelector({ componentId: main.id, layerId: layer.id }, components)}
        styles={textStyles}
        variables={variables}
        onChange={(next) => system.setComponent({ ...main, layers: main.layers.map((l) => (l.id === next.id ? next : l)) })}
        onEditStyle={openStyle}
      />
    );
  } else if (selectedMain && selectedMainLayer?.kind === "instance") {
    // …the instances one repeats.
    const main = selectedMain;
    const layer: InstanceLayer = selectedMainLayer;
    const repeated = layerComponent(layer, components);
    header = {
      icon: fi("16.instance"),
      tone: COMPONENT_TONE,
      title: layer.name,
      menu: [
        { label: main.name, hint: "Ana bileşen", onSelect: () => select({ kind: "component", componentId: main.id }) },
        { label: "Ana bileşene git", hint: repeated.name, divided: true, onSelect: () => goToMain(repeated.id) },
      ],
    };
    inspectorActions = <LayerButton label="Ana bileşene git" onClick={() => goToMain(repeated.id)}>{Icons.goTo}</LayerButton>;
    content = (
      <InstanceLayerInspector
        layer={layer}
        component={repeated}
        swaps={components.filter((c) => (main.type ? fitsItems(c, main.type) : !c.type && c.id !== main.id))}
        measure={mainSelector({ componentId: main.id, layerId: layer.id }, components)}
        onChange={(next) => system.setComponent({ ...main, layers: main.layers.map((l) => (l.id === next.id ? next : l)) })}
        onGoToMain={goToMain}
      />
    );
  } else if (selectedMain) {
    // …a main component.
    const main = selectedMain;
    header = { icon: fi("16.component"), tone: COMPONENT_TONE, title: main.name };
    inspectorActions = (
      <>
        <LayerButton label="Çoğalt" onClick={() => select({ kind: "component", componentId: system.copyComponent(main.id) }, { scroll: true })}>{Icons.duplicate}</LayerButton>
        {system.isStartingComponent(main.id) ? (
          <LayerButton label="Sitenin görünüşüne dön" onClick={() => system.removeComponent(main.id)}>{Icons.reset}</LayerButton>
        ) : (
          <LayerButton label="Bileşeni sil" onClick={() => { system.removeComponent(main.id); setSelection({ kind: "none" }); }}>{Icons.trash}</LayerButton>
        )}
      </>
    );
    content = (
      <ComponentInspector
        component={main}
        variables={variables}
        measure={mainFrameSelector(main)}
        kind={main.type ? "Sayfa bileşeni" : "İç bileşen — başka bileşenlerin öğesi"}
        uses={mainUses(main)}
        onChange={system.setComponent}
      />
    );
  } else {
    // Nothing selected: what the page is made with, as Figma's design panel shows it.
    content = (
      <PageDesignPanel
        project={project}
        slug={slug}
        companies={companies}
        variables={variables}
        textStyles={textStyles}
        onMeta={actions.updateMeta}
        onOpenVariables={() => setVariablesOpen(true)}
        onAddTextStyle={() => {
          const id = system.addTextStyle();
          const panel = document.querySelector("[data-design-panel]")?.getBoundingClientRect();
          setStyleEditor({ id, anchor: { top: 120, left: panel?.left ?? window.innerWidth - 300 } });
        }}
        onEditTextStyle={openStyle}
      />
    );
  }

  // The selection's size under its line (SizeBadge), in its layer's colour — not while the page is the compact list.
  let badge: BadgeTarget | null = null;
  if (reordering || page !== "project") badge = null;
  else if (selectedBlock) {
    const { id, type } = selectedBlock.block;
    const item = `[data-block-id="${id}"] [data-entry-id="${selectedItemId}"]`;
    badge = selectedItemId
      ? { selector: selectedText ? `${item} [data-text-layer="${selectedText}"]` : item, tone: selectedText ? FRAME_TONE : instance ? COMPONENT_TONE : layerTone(type) }
      : { selector: `[data-block-id="${id}"]`, tone: layerTone(type), frame: true };
  } else if (selectedGroup) badge = { selector: `[data-group-id="${selectedGroup.group.id}"]`, tone: FRAME_TONE, below: 5 };
  else if (selectedSection) badge = { selector: `[data-section-id="${selectedSection.section.id}"]`, tone: FRAME_TONE, padded: true };
  else if (selection.kind === "meta") {
    badge = selection.part
      ? { selector: `[data-overview-part="${selection.part}"]`, tone: FRAME_TONE, frame: true }
      : { selector: "#live-overview", tone: FRAME_TONE, padded: true };
  } else if (selection.kind === "divider") badge = { selector: `[data-divider-id="${selection.dividerId}"]`, tone: FRAME_TONE, below: 5 };
  else if (selection.kind === "page") badge = { selector: "[data-page-frame]", tone: FRAME_TONE, below: 5 };

  const editedStyle = styleEditor ? textStyles.find((s) => s.id === styleEditor.id) ?? null : null;
  let sectionIndex = 0;
  const pageFrame = pageFrameProps(project.frame);

  return (
    // Drags start as soon as the pointer moves (no press-and-hold wait) — for the
    // cards inside blocks and the layer tree too.
    <DragActivationContext.Provider value="press">
      <div className="flex h-full min-h-0">
        {/* ── Left: the file — its pages and layers (Dosya), the components to put on the page (Varlıklar) ── */}
        <aside aria-label="Dosya" className="w-[260px] shrink-0 h-full flex flex-col border-r border-[var(--border)] bg-[var(--bg-1)] z-10">
          <div className="shrink-0 flex items-center gap-2 h-12 px-3 border-b border-[var(--border)]">
            <span className="flex shrink-0 text-[var(--text-subtitle)]">{fi("16.page")}</span>
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-[13px] font-semibold leading-4 text-[var(--text-title)]">{project.title?.trim() || slug}</span>
              <span className="text-[11px] leading-4 text-[var(--text-subtitle)]">Proje · /{slug}</span>
            </div>
          </div>
          <div role="tablist" aria-label="Sol panel" className="shrink-0 flex items-center gap-1 h-10 px-2 border-b border-[var(--border)]">
            <PanelTab label="Dosya" active={leftTab === "file"} onClick={() => setLeftTab("file")} />
            <PanelTab label="Varlıklar" active={leftTab === "assets"} onClick={() => setLeftTab("assets")} />
          </div>

          {leftTab === "file" ? (
            <>
              <section aria-label="Sayfalar" className="shrink-0 flex flex-col pb-2 border-b border-[var(--border)]">
                <h3 className="h-9 flex items-center px-3 text-[12px] font-semibold text-[var(--text-title)] select-none">Sayfalar</h3>
                <PageRow label="Proje sayfası" icon={fi("16.page")} active={page === "project"} onClick={() => showPage("project")} />
                <PageRow label="Bileşenler" icon={fi("16.component")} active={page === "components"} onClick={() => showPage("components")} />
              </section>
              <div className="shrink-0 flex items-center justify-between h-9 pl-3 pr-1">
                <h3 className="text-[12px] font-semibold text-[var(--text-title)] select-none">Katmanlar</h3>
                {page === "project" && (
                  <LayerButton label={allLayersCollapsed ? "Katmanları aç" : "Katmanları daralt"} onClick={() => toggleAllLayers(!allLayersCollapsed)}>
                    {allLayersCollapsed ? Icons.expandLayers : Icons.collapseLayers}
                  </LayerButton>
                )}
              </div>
              {/* The site's own scrollbar; the layer tree runs almost edge to edge (4px), as in Figma. */}
              <ScrollArea className="flex-1 min-h-0" viewportClassName="h-full overflow-x-hidden flex flex-col gap-3 px-1 pb-4" inset={8} edge={2}>
                {page === "project" ? (
                  <OpenComponentsContext.Provider value={{ open: openComponents, toggle: toggleComponent }}>
                    <LayersPanel
                      project={project}
                      selection={selection}
                      collapsed={collapsedLayers}
                      onToggle={toggleIn(setCollapsedLayers)}
                      actions={actions}
                      onSelect={(next, { scroll = true } = {}) => select(next, { scroll })}
                      onAddBlock={(groupId) => setPicker({ groupId })}
                    />
                  </OpenComponentsContext.Provider>
                ) : (
                  <ComponentLayers
                    components={components}
                    selection={mainSelection}
                    open={new Set(components.map((c) => c.id).filter((id) => !closedMains.has(id)))}
                    onToggle={toggleIn(setClosedMains)}
                    onSelect={(next) => select({ kind: "component", ...next }, { scroll: true })}
                    onRename={(componentId, layerId, name) => {
                      const main = components.find((c) => c.id === componentId);
                      if (!main) return;
                      if (!layerId) {
                        if (name) system.setComponent({ ...main, name });
                        return;
                      }
                      system.setComponent({
                        ...main,
                        layers: main.layers.map((l) => (l.id !== layerId ? l : { ...l, name: name ?? (l.kind === "instance" ? layerComponent(l, components).name : l.field) })),
                      });
                    }}
                  />
                )}
              </ScrollArea>
            </>
          ) : (
            <ScrollArea className="flex-1 min-h-0" viewportClassName="h-full overflow-x-hidden flex flex-col px-1 py-3" inset={8} edge={2}>
              <AssetsPanel components={components} target={catalogTarget} onAdd={addFromCatalog} onGoToMain={(id) => goToMain(id)} />
            </ScrollArea>
          )}
        </aside>

        {/* ── Canvas ── */}
        <div className="relative flex-1 min-w-0 h-full">
          <div
            {...(page === "project" ? projectThemeAttrs(project.theme) : {})}
            // The site's design variables apply inside it (DesignSystemStyle), as on the project page.
            data-design-scope=""
            // No press-and-drag text selection on the canvas (it fights with hold-to-drag);
            // the field being edited opts back in. The design panel stays selectable.
            className="h-full overflow-y-auto bg-[var(--bg-1)] transition-colors duration-200 select-none"
            onClick={() => setSelection({ kind: "none" })}
            // Links stay put while editing; the click still reaches the text underneath.
            onClickCapture={(e) => { if ((e.target as Element).closest("a[href]")) e.preventDefault(); }}
            // No native image / link dragging — reordering is done with dnd-kit.
            onDragStart={(e) => e.preventDefault()}
          >
            <DesignSystemStyle />
            {page === "components" ? (
              <main className="relative isolate flex flex-col items-start w-full max-w-[720px] mx-auto px-6 pt-20 pb-40">
                <ComponentsCanvas
                  components={components}
                  sampleEntries={sampleEntries}
                  selection={mainSelection}
                  onSelect={(next) => (next ? select({ kind: "component", ...next }) : setSelection({ kind: "none" }))}
                />
              </main>
            ) : (
              // `relative`: the size badge (SizeBadge) is placed in it; `isolate`: the canvas's layers stay above its background.
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
                  // A click that picks a layer (or one above it) stops there: its texts, checkboxes,
                  // "add item" buttons… answer the next one.
                  const target = e.target as Element;
                  if (!armed && target.closest("[data-live-block], [data-overview-part]") && !target.closest("[data-no-drag]")) e.stopPropagation();
                }}
                // A double-click edits a text only in the layer selected before it — not in one its clicks just
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
                  style={reordering ? undefined : { ...pageFrame.style, ...frameLookStyle(project.frame?.look, variables) }}
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
            )}
          </div>

          {!reordering && (
            <CanvasToolbar
              onPage={page === "project"}
              frameLabel={frameSection ? "Çerçeve — bölüme blok ekle" : "Çerçeve — yeni bölüm"}
              onFrame={addFrame}
              onText={() => addFromCatalog("text")}
              onImage={() => addFromCatalog("image")}
              onLine={() => actions.addDivider(frameSection ?? undefined)}
              onAssets={() => setLeftTab("assets")}
            />
          )}
        </div>

        {/* ── Right: the design panel (Tasarım) — whatever is selected; with nothing selected, the page's styles — and Yayın ── */}
        <aside data-design-panel="" aria-label="Tasarım" className="w-[300px] shrink-0 h-full flex flex-col border-l border-[var(--border)] bg-[var(--bg-1)] z-10">
          <div role="tablist" aria-label="Sağ panel" className="shrink-0 flex items-center gap-1 h-10 px-2 border-b border-[var(--border)]">
            <PanelTab label="Tasarım" active={rightTab === "design"} onClick={() => setRightTab("design")} />
            <PanelTab label="Yayın" active={rightTab === "publish"} onClick={() => setRightTab("publish")} />
          </div>
          {rightTab === "design" && header && <InspectorHeader {...header} actions={inspectorActions} />}
          {/*
            Figma's sections, in its order, full width: an instance's first (the component it is, its properties),
            then its Yerleşim (auto layout, W / H), Görünüş, Dolgu, Kenar çizgisi — every frame has them.
          */}
          <ScrollArea className="flex-1 min-h-0" viewportClassName="h-full overflow-x-hidden flex flex-col" inset={8} edge={2}>
            {rightTab === "design" ? content : <PublishPanel project={project} slug={slug} onLoadTemplate={onLoadTemplate} />}
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

        {variablesOpen && (
          <VariablesModal
            variables={variables}
            isStarting={system.isStartingVariable}
            onChange={system.setVariable}
            onAdd={system.addVariable}
            onRemove={system.removeVariable}
            onClose={() => setVariablesOpen(false)}
          />
        )}

        {styleEditor && editedStyle && (
          <TextStylePopover
            style={editedStyle}
            variables={variables}
            uses={styleUses(editedStyle.id)}
            anchor={styleEditor.anchor}
            actions={
              system.isStartingTextStyle(editedStyle.id) ? (
                <SquareButton label="Sitenin görünüşüne dön" onClick={() => system.removeTextStyle(editedStyle.id)}>{Glyphs.reset}</SquareButton>
              ) : (
                <SquareButton label="Metin stilini sil" onClick={() => { system.removeTextStyle(editedStyle.id); setStyleEditor(null); }}>{Glyphs.trash}</SquareButton>
              )
            }
            onChange={system.setTextStyle}
            onClose={() => setStyleEditor(null)}
          />
        )}
      </div>
    </DragActivationContext.Provider>
  );
}
