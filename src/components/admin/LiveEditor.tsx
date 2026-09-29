"use client";

import { createContext, memo, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useDndMonitor } from "@dnd-kit/core";
import { useRouter } from "next/navigation";
import { useTheme } from "@/context/ThemeContext";
import { useEditorContext } from "@/components/admin/EditorNavControls";
import { Block, BlockEntry, BlockType, GridSettings, Group, PageDivider, PageItem, PageSection, ProjectData, Sizing } from "@/types/project";
import type { CanvasNode, ComponentLayer, DesignComponent, FrameLayer, FrameLook, InstanceLayer, InstanceOverrides, ShapeLayer, StaticTextLayer, TextField, TextLayer } from "@/types/design";
import { cn } from "@/lib/utils";
import { fi } from "@/components/admin/figmaIcons";
import { findBlock, findGroup, freeCells, gridColumns, gridFlow, gridRows, layoutCells, rowCount, sectionBlocks, sectionsOf, type Cell } from "@/lib/projectLayout";
import { PillButton } from "@/components/Button";
import { ScrollArea } from "@/components/ScrollArea";
import { ProjectDivider } from "@/components/project/CoreBlocks";
import { FillHeightContext } from "@/components/project/fillHeight";
import { ProjectBlock } from "@/components/project/ComponentView";
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
  InstanceTextsGroup,
  FrameLayerInspector,
  FieldRow,
  PartLayerInspector,
  InspectorHeader,
  LookFields,
  Group as PanelGroup,
  Glyphs,
  clipOf,
  type MenuItem,
  type DesignUse,
  type InstanceProperty,
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
  STARTING_COMPONENTS,
  allLayers,
  boxLook,
  componentLook,
  insertLayer,
  insertLayerAfter,
  layerPath,
  removeLayer,
  withFreshIds,
  cleanOverrides,
  componentUses,
  copyComponent,
  copySet,
  fitsItems,
  hasOverrides,
  isComponentSet,
  isVariant,
  itemHasOverrides,
  layerComponent,
  layoutOverride,
  lookOverride,
  mainComponent,
  parseVariantName,
  pickVariant,
  pushInstance,
  pushItem,
  resetInstance,
  resolveInstance,
  resolveItem,
  sameValues,
  setIdOf,
  sizeOverride,
  swapsFor,
  textStyleUses,
  textLayersOf,
  topComponents,
  findLayer,
  findRepeat,
  updateLayer,
  useDesignComponents,
  useInstance,
  variantName,
  variantProperties,
  variantValue,
  variantsOf,
  withNewProperty,
  withNewVariant,
  withPropertyRenamed,
  withSetName,
  withValueRenamed,
  withVariantValue,
  withoutProperty,
  withoutVariant,
  type ResolvedInstance,
} from "@/components/project/components";
import { ContextMenu, keys, type ContextMenuItem, type MenuEntry } from "@/components/admin/ContextMenu";
import { ComponentSetInspector, VariantGroup } from "@/components/admin/VariantPanels";
import { PreviewGroup, PrototypePanel, PrototypePreview } from "@/components/admin/PrototypePanel";
import { newInteraction } from "@/components/project/interactions";
import { DesignSystemStyle } from "@/components/project/designSystem";
import { frameLookStyle, useFrameLook } from "@/components/project/frameLook";
import { VariablesModal } from "@/components/admin/VariablesModal";
import { AssetsPanel } from "@/components/admin/AssetsPanel";
import { PageDesignPanel, TextStylePopover, TextStylesPanel, ThemeFields, VariablesPanel } from "@/components/admin/DesignPanel";
import {
  ComponentLayers,
  ComponentsCanvas,
  canvasSelector,
  layerIconOf,
  layerLabel,
  layerRowKey,
  mainFrameSelector,
  mainSelector,
  nodeRowKey,
  nodeSelector,
  setRowKey,
  type CanvasSelection,
  type MainSelection,
  type NodeSelection,
} from "@/components/admin/ComponentsCanvas";
import { WorkspaceCanvas } from "@/components/admin/WorkspaceCanvas";
import { SET_INSET, canvasPlaces, canvasWidth, isDrawing, setLayoutOf, isNodeSelection, nodeLayer, zoomAround, type CanvasTool, type CanvasView, type DrawParent, type ZoomActions } from "@/components/admin/canvasModel";
import { PositionGroup, ShapeInspector, StaticTextInspector } from "@/components/admin/CanvasInspector";
import { CanvasToolbar } from "@/components/admin/CanvasToolbar";
import { DropLine, Icons, LayerButton, LayerRow, SizeBadge, TREE_TONE, layerNode, requestRename, type BadgeTarget } from "@/components/admin/layerTree";
import type { DesignSystem } from "@/components/admin/useDesignSystem";
import { BLOCK_LABELS, BlockPickerDialog, COMPONENT_TONE, FRAME_TONE, cloneBlock, cloneGroup, cloneItem, layerIcon, layerKind, layerTone, uid } from "@/components/admin/blockCatalog";
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
import type { UndoHistory } from "@/components/admin/useUndo";

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
      text?: TextField;
    }
  | { kind: "divider"; dividerId: string }
  /** On the Bileşenler page: a main component, or one of its layers */
  | ({ kind: "component" } & MainSelection)
  /** …or something drawn on it on its own, or one of its layers */
  | ({ kind: "node" } & NodeSelection);

/** A layer copied, as it was: a component, a Blok or a section (see LiveEditor's paste). */
type Clip = { kind: "block"; block: Block } | { kind: "group"; group: Group } | { kind: "section"; section: PageSection };

/** The file's pages, as Figma's: the project's, the one holding the site's main components, and a bare canvas of its own. */
type Page = "project" | "components" | "workspace";
/**
 * The icon rail's panels, beside the layers: the file (its pages and layers),
 * the assets, the variables, the text styles, the project's theme and its
 * publishing details.
 */
type LeftTab = "file" | "assets" | "variables" | "styles" | "theme" | "publish";
/** Pieces of the project overview that behave like blocks. */
type OverviewPart = "title" | "description" | "cover";
const OVERVIEW_NAMES: Record<OverviewPart, string> = { title: "Başlık", description: "Açıklama", cover: "Kapak görseli" };

function findSection(items: PageItem[], sectionId: string): { section: PageSection; index: number } | null {
  const sections = sectionsOf(items);
  const index = sections.findIndex((s) => s.id === sectionId);
  return index >= 0 ? { section: sections[index], index } : null;
}

const NONE: Selection = { kind: "none" };

/** Toggles `id` in a set kept in state (the folded layers, the open instances…). */
const toggleIn = (set: (update: (prev: Set<string>) => Set<string>) => void) => (id: string) =>
  set((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

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
  if (block.type === "heading" || block.type === "subheading" || block.type === "text") {
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

/**
 * Figma's own colours (its UI3 kit's) over the site's tokens, for the
 * editor's chrome — the panels, the navigation bar, the toolbar. The page
 * itself gets the site's tokens back inside its frame (DesignSystemStyle),
 * so it looks as it does on the site.
 */
const FIGMA_TOKENS: Record<"light" | "dark", CSSProperties> = {
  light: {
    "--bg-1": "#ffffff", "--bg-2": "#ffffff", "--bg-3": "#ffffff", "--bg-4": "#f5f5f5", "--bg-5": "#e6e6e6",
    "--border": "#e6e6e6", "--border-hover": "#b3b3b3",
    "--text-title": "#1e1e1e", "--text-p": "#1e1e1e", "--text-subtitle": "#757575",
    "--edit-canvas": "#f5f5f5", "--edit-selected": "#e5f4ff",
  } as CSSProperties,
  dark: {
    "--bg-1": "#2c2c2c", "--bg-2": "#2c2c2c", "--bg-3": "#2c2c2c", "--bg-4": "#383838", "--bg-5": "#444444",
    "--border": "#444444", "--border-hover": "#5c5c5c",
    "--text-title": "#ffffff", "--text-p": "#e6e6e6", "--text-subtitle": "#a3a3a3",
    "--edit-canvas": "#1e1e1e", "--edit-selected": "#1f3d5b",
  } as CSSProperties,
};

/** A tab of a panel's header, as Figma's (Design / Prototype): its name, bold in a grey pill while shown. */
function PanelTab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "h-7 px-2 rounded-[5px] text-[11px] transition-colors cursor-pointer",
        active ? "font-semibold text-[var(--text-title)] bg-[var(--bg-4)]" : "font-medium text-[var(--text-subtitle)] hover:text-[var(--text-title)]"
      )}
    >
      {label}
    </button>
  );
}

/**
 * The navigation bar's tabs, as Figma's (its labels on): the file (pages and
 * layers), the assets, the variables; under them the text styles, the
 * project's theme and its publishing — what Figma keeps in its menus.
 */
const NAV: { id: LeftTab; label: string; icon: ReactNode }[] = [
  { id: "file", label: "Dosya", icon: fi("16.page", 20) },
  { id: "assets", label: "Varlıklar", icon: fi("library") },
  { id: "variables", label: "Değişkenler", icon: fi("variable.small") },
  { id: "styles", label: "Stiller", icon: fi("text.library") },
  { id: "theme", label: "Tema", icon: fi("swatch.small") },
  { id: "publish", label: "Yayın", icon: fi("public.small") },
];

/** A tab of the navigation bar: its icon in a grey square while shown, its label under it. */
function NavTab({ icon, label, active, onClick }: { icon: ReactNode; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className="group/nav flex w-12 flex-col items-center gap-0.5 pt-1.5 pb-1 cursor-pointer select-none"
    >
      <span
        className={cn(
          "flex items-center justify-center w-7 h-7 rounded-[6px] transition-colors",
          active ? "bg-[var(--bg-4)] text-[var(--text-title)]" : "text-[var(--text-subtitle)] group-hover/nav:text-[var(--text-title)]"
        )}
      >
        {icon}
      </span>
      <span className={cn("text-[9px] leading-3", active ? "text-[var(--text-title)]" : "text-[var(--text-subtitle)]")}>{label}</span>
    </button>
  );
}

/** The chrome's own glyphs, drawn after Figma's: the menu, minimize, present, the modes. */
const Chrome = {
  menu: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h11" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
    </svg>
  ),
  chevron: (
    <svg width="8" height="8" viewBox="0 0 8 8" fill="none" aria-hidden>
      <path d="M1.5 3l2.5 2.5L6.5 3" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  minimize: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="2.5" y="3.5" width="11" height="9" rx="1.5" stroke="currentColor" />
      <path d="M6 3.5v9" stroke="currentColor" />
      <path d="M10.5 6.5L9 8l1.5 1.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  present: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M4 3.2v9.6L12.4 8 4 3.2z" stroke="currentColor" strokeLinejoin="round" />
    </svg>
  ),
};

/** Figma's Share button, as Kaydet: blue, its state in it (saving, saved, an error). */
function SaveButton() {
  const { saveStatus, triggerSave } = useEditorContext();
  const label = saveStatus === "saving" ? "Kaydediliyor…" : saveStatus === "saved" ? "Kaydedildi" : saveStatus === "error" ? "Hata" : "Kaydet";
  return (
    <button
      type="button"
      disabled={saveStatus === "saving" || !triggerSave}
      onClick={() => triggerSave?.()}
      className={cn(
        "flex items-center h-8 px-3 rounded-[6px] text-[11px] font-semibold text-white transition-colors cursor-pointer disabled:cursor-default",
        saveStatus === "error" ? "bg-[var(--edit-active)]" : "bg-[var(--edit-accent)] hover:brightness-105 disabled:opacity-70"
      )}
    >
      {label}
    </button>
  );
}

/** The language, as a small pair of tabs in the design panel's top row. */
function LangSwitch() {
  const { editLang, setEditLang } = useEditorContext();
  return (
    <div role="radiogroup" aria-label="Düzenleme dili" className="flex h-7 p-0.5 rounded-[5px] bg-[var(--bg-4)]">
      {(["tr", "en"] as const).map((l) => (
        <button
          key={l}
          type="button"
          role="radio"
          aria-checked={editLang === l}
          onClick={() => setEditLang(l)}
          className={cn("px-2 rounded-[4px] text-[11px] font-medium cursor-pointer", editLang === l ? "bg-[var(--bg-1)] text-[var(--text-title)] shadow-[0_1px_2px_rgba(0,0,0,0.08)]" : "text-[var(--text-subtitle)] hover:text-[var(--text-title)]")}
        >
          {l.toUpperCase()}
        </button>
      ))}
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
const LiveOverview = memo(function LiveOverview({ project, lang, actions, selection }: {
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
});

// ── Canvas: component (Bileşen) ───────────────────────────────────────────────

const LiveBlock = memo(function LiveBlock({ block, group, cell, lang, actions, selected, selectedItemId, selectedText }: {
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
  selectedText: TextField | null;
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
});

// ── Canvas: Blok (group) ──────────────────────────────────────────────────────

/**
 * A Blok on its section's grid, laying out its components on a grid of its
 * own. A click in its selected section selects it (see pressOn); drag it once
 * it is selected.
 */
const LiveGroup = memo(function LiveGroup({ group, section, cell, lang, actions, selected, active, selectedBlockId, selectedItemId, selectedText, onInsert }: {
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
  selectedText: TextField | null;
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
  // The same cells while the layers are the same (each layer is memoized on its cell).
  const blockCells = useMemo(() => layoutCells(group.blocks, count, rows), [group.blocks, count, rows]);
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
});

// ── Canvas: section & divider ─────────────────────────────────────────────────

const LiveSection = memo(function LiveSection({ section, index, lang, actions, selected, active, selectedGroupId, activeGroupId, selectedBlockId, selectedItemId, selectedText, onSelect, onInsert }: {
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
  selectedText: TextField | null;
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
  const count = gridColumns(section.grid).length;
  const rows = gridRows(section.grid);
  // The same cells while the Bloks are the same (each Blok is memoized on its cell).
  const groupCells = useMemo(() => layoutCells(section.groups, count, rows), [section.groups, count, rows]);

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
});

const LiveDivider = memo(function LiveDivider({ divider, selected }: {
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
});

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
    if (text?.dataset.textLayer && item.contains(text)) layers.push({ selection: { kind: "block", blockId, itemId, text: text.dataset.textLayer as TextField }, el: text });
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

/** The layer a row of the sections panel is — the page's, an item's and its texts' too — for a right click. */
function layerRowTarget(target: Element): Selection | null {
  const row = target.closest<HTMLElement>("[data-layer-kind]");
  if (!row) return null;
  const blockId = row.closest<HTMLElement>("[data-layer-kind='block']")?.dataset.layerId;
  const itemId = row.closest<HTMLElement>("[data-layer-kind='item']")?.dataset.layerId;
  switch (row.dataset.layerKind) {
    case "page": return { kind: "page" };
    case "meta": return { kind: "meta" };
    case "item": return blockId && itemId ? { kind: "block", blockId, itemId } : null;
    case "text": return blockId && itemId && row.dataset.layerId ? { kind: "block", blockId, itemId, text: row.dataset.layerId.slice(itemId.length + 1) as TextField } : null;
    default: return layerPressTarget(target);
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
const LayerBlock = memo(function LayerBlock({ block, group, selection, actions, onSelect }: {
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
        tone={layerKind(block.type) === "instance" ? COMPONENT_TONE : TREE_TONE}
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
        renameKey={block.id}
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
});

/**
 * An item of an instance — an instance itself, of the component its main one
 * repeats (a Kart) — in the layer tree, with its text layers. Items are
 * reordered on the canvas: its rows don't drag.
 */
const LayerItem = memo(function LayerItem({ block, entry, instance, selection, onSelect }: {
  block: Block;
  entry: BlockEntry;
  instance: ResolvedInstance;
  selection: Selection;
  onSelect: SelectFromPanel;
}) {
  const inside = selection.kind === "block" && selection.blockId === block.id && selection.itemId === entry.id;
  const { open: opened, toggle } = useContext(OpenComponentsContext);
  // The variant it is (see BlockEntry.component).
  const component = resolveItem(instance.item!, entry, instance.knownStyle).component;
  const texts = textLayersOf(component);
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
              tone={TREE_TONE}
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
});

const LayerGroup = memo(function LayerGroup({ group, index, section, selection, collapsed, onToggle, actions, onSelect, onAddBlock }: {
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
        tone={TREE_TONE}
        icon={frameIcon(group.grid)}
        name={groupName(group, index)}
        selected={selected}
        open={open}
        onToggle={() => onToggle(group.id)}
        hover={`[data-group-id="${group.id}"]`}
        onSelect={select}
        onInspect={select}
        onRename={(name) => actions.updateGroup(group.id, { name })}
        renameKey={group.id}
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
            <p className="h-7 flex items-center pl-[56px] text-[11px] text-[var(--text-subtitle)] select-none">Boş — varlıklardan sürükle</p>
          )}
        </GroupBlocks>
      )}
    </div>
  );
});

const LayerSection = memo(function LayerSection({ section, index, selection, collapsed, onToggle, actions, onSelect, onAddBlock }: {
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
        tone={TREE_TONE}
        icon={frameIcon(section.grid)}
        name={sectionName(section, index)}
        selected={selected}
        open={open}
        onToggle={() => onToggle(section.id)}
        hover={`[data-section-id="${section.id}"]`}
        onSelect={select}
        onInspect={select}
        onRename={(name) => actions.updateSection(section.id, { name })}
        renameKey={section.id}
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
            <p className="h-7 flex items-center pl-[40px] text-[11px] text-[var(--text-subtitle)] select-none">Boş — bir blok sürükle ya da ekle</p>
          )}
        </SectionGroups>
      )}
    </div>
  );
});

const LayerDivider = memo(function LayerDivider({ divider, selected, onSelect }: {
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
        tone={TREE_TONE}
        icon={fi("16.line")}
        name="Ayırıcı"
        selected={selected}
        hover={`[data-divider-id="${divider.id}"]`}
        onSelect={() => onSelect({ kind: "divider", dividerId: divider.id })}
        onInspect={() => onSelect({ kind: "divider", dividerId: divider.id })}
      />
    </div>
  );
});

/** The root layer's key in the folded set (see LayersList). */
const PAGE_LAYER = "page";

/** The layer tree inside its own drag & drop context (see LayersPanel). */
function LayersList({ project, selection, collapsed, onToggle, actions, onSelect, onAddBlock, onContextMenu }: {
  project: ProjectData;
  selection: Selection;
  /** Folded sections and Bloks */
  collapsed: Set<string>;
  onToggle: (id: string) => void;
  actions: EditorActions;
  onSelect: SelectFromPanel;
  /** Opens the component picker for a Blok */
  onAddBlock: (groupId: string) => void;
  /** A right click on a row: its layer, and where */
  onContextMenu: (target: Selection, e: React.MouseEvent) => void;
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
      onContextMenu={(e) => {
        const target = layerRowTarget(e.target as Element);
        if (target) onContextMenu(target, e);
      }}
    >
      {/* The page's frame, named after the project — everything on the page sits in it, as in a Figma frame. */}
      <div data-layer-kind="page">
        <LayerRow
          depth={0}
          tone={TREE_TONE}
          icon={fi("16.autolayout.vertical")}
          name={project.title?.trim() || "Sayfa"}
          selected={selection.kind === "page"}
          open={!collapsed.has(PAGE_LAYER)}
          onToggle={() => onToggle(PAGE_LAYER)}
          hover="[data-page-frame]"
          onSelect={() => onSelect({ kind: "page" })}
          onInspect={() => onSelect({ kind: "page" })}
        />
      </div>

      {!collapsed.has(PAGE_LAYER) && (
      <div className="flex flex-col gap-px pl-4">
      <div data-layer-kind="meta">
        <LayerRow
          depth={0}
          tone={TREE_TONE}
          icon={fi("16.autolayout.vertical")}
          name="Proje bilgileri"
          selected={selection.kind === "meta"}
          hover="#live-overview"
          onSelect={() => onSelect({ kind: "meta" })}
          onInspect={() => onSelect({ kind: "meta" })}
        />
      </div>

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
        <p className="px-2 py-4 text-[11px] text-center text-[var(--text-subtitle)]">Sayfada henüz bölüm yok.</p>
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
  const { project, actions } = props;
  // (The selected row is kept in view by the editor — see LiveEditor.)
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

/** What a page component's main shows on the Bileşenler page when the project has no instance of it with content. */
const SAMPLE_BLOCKS: Partial<Record<BlockType, Partial<Block>>> = {
  heading: { content: "Bölüm başlığı", subheading: "Kısa bir alt başlık" },
  subheading: { content: "Alt başlık" },
  text: { content: "Projenin bu bölümünü birkaç cümleyle anlatan bir paragraf." },
  list: { listStyle: "bullet", listItems: [{ id: "s0", text: "Birinci madde" }, { id: "s1", text: "İkinci madde" }] },
  info: { entries: [{ id: "s0", label: "Rol", value: "Ürün tasarımcısı" }, { id: "s1", label: "Süre", value: "6 ay" }, { id: "s2", label: "Ekip", value: "4 kişi" }, { id: "s3", label: "Platform", value: "iOS · Android" }] },
  stats: { entries: [{ id: "s0", value: "%40", label: "Dönüşüm artışı" }, { id: "s1", value: "3x", label: "Daha hızlı" }, { id: "s2", value: "12", label: "Ekran" }] },
  cards: { entries: [{ id: "s0", eyebrow: "01", title: "Sorun", text: "Kullanıcılar aradıklarını bulamıyordu." }, { id: "s1", eyebrow: "02", title: "Çözüm", text: "Arama ve filtreler yeniden kuruldu." }] },
  steps: { entries: [{ id: "s0", title: "Araştırma", eyebrow: "Hafta 1", text: "Görüşmeler ve analiz." }, { id: "s1", title: "Tasarım", eyebrow: "Hafta 2", text: "Akışlar ve ekranlar." }] },
  accordion: { entries: [{ id: "s0", title: "Neden?", text: "Kısa bir açıklama." }, { id: "s1", title: "Nasıl?", text: "Kısa bir açıklama." }] },
  links: { entries: [{ id: "s0", label: "Web sitesi", href: "https://burakkoc.net", icon: "web" }, { id: "s1", label: "GitHub", href: "https://github.com", icon: "github" }] },
  tags: { entries: [{ id: "s0", label: "UX" }, { id: "s1", label: "UI" }, { id: "s2", label: "Araştırma" }] },
  team: { entries: [{ id: "s0", title: "Ayşe Yılmaz", text: "Tasarımcı" }, { id: "s1", title: "Mehmet Kaya", text: "Geliştirici" }] },
  palette: {
    columns: 4,
    entries: [
      { id: "s0", label: "Siyah", value: "#1A1A1A", text: "Metin" },
      { id: "s1", label: "Mavi", value: "#2F6BFF", text: "Vurgu" },
      { id: "s2", label: "Gri", value: "#F2F2F2", text: "Kartlar" },
      { id: "s3", label: "Beyaz", value: "#FFFFFF", text: "Arka plan" },
    ],
  },
  quote: { content: "Tasarım, nasıl göründüğü değil, nasıl çalıştığıdır.", author: "Ad Soyad", authorRole: "Unvan · Şirket" },
  callout: { variant: "insight", content: "Kullanıcıların çoğu mobilden geliyordu." },
  split: { title: "Başlık", content: "Görseli destekleyen kısa bir metin." },
  persona: {
    title: "Ayşe, 34",
    subheading: "Ürün yöneticisi · İstanbul",
    content: "Hızlı karar vermek için net veriye ihtiyaç duyuyor.",
    entries: [{ id: "s0", label: "Hedefler", text: "Net raporlar\nHızlı kararlar" }, { id: "s1", label: "Zorluklar", text: "Dağınık veri\nZaman baskısı" }],
  },
  gallery: { entries: [{ id: "s0", caption: "Görsel altı" }, { id: "s1", caption: "Görsel altı" }] },
  compare: { entries: [{ id: "s0", label: "Önce" }, { id: "s1", label: "Sonra" }] },
  mockup: { variant: "phone", entries: [{ id: "s0" }, { id: "s1" }] },
  table: {
    tableHeader: true,
    tableRows: [
      { id: "s0", cells: ["Özellik", "Biz", "Rakip"] },
      { id: "s1", cells: ["Arama", "✓", "✗"] },
      { id: "s2", cells: ["Filtre", "✓", "✓"] },
    ],
  },
  bars: { title: "Ürünü tavsiye eder misiniz?", entries: [{ id: "s0", label: "Evet", value: "72" }, { id: "s1", label: "Hayır", value: "28" }] },
};

/** Does a layer of the page have content enough to show its main component with: a few filled items, or a text, an image, a list, a table? */
function hasSampleContent(block: Block) {
  const filled = (block.entries ?? []).filter((e) => [e.label, e.value, e.title, e.text, e.src].some((v) => v?.trim()));
  if (block.entries?.length) return filled.length >= 2;
  return Boolean(block.content?.trim() || block.title?.trim() || block.src || (block.listItems ?? []).some((i) => i.text.trim()) || (block.tableRows ?? []).some((r) => r.cells.some((c) => c.trim())));
}

/** A page of the file in the Pages list, as Figma's: the page icon and its name, the shown one in a grey pill. */
function PageRow({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-2 h-7 mx-2 px-2 rounded-[5px] text-left text-[11px] transition-colors cursor-pointer",
        active ? "bg-[var(--bg-4)] font-medium text-[var(--text-title)]" : "text-[var(--text-p)] hover:bg-[color-mix(in_srgb,var(--bg-4)_60%,transparent)]"
      )}
    >
      <span className="flex shrink-0 text-[var(--text-subtitle)]">{fi("16.page")}</span>
      <span className="min-w-0 truncate">{label}</span>
    </button>
  );
}

export function LiveEditor({ project, lang, slug, companies, actions, system, history, onLoadTemplate, isPublished, onAdd, onSwitchToForm }: {
  project: ProjectData;
  lang: Lang;
  slug: string;
  companies: string[];
  actions: EditorActions;
  /** The site's design system: its variables, text styles and components — changes go to every page */
  system: DesignSystem;
  /** Undo / redo (⌘Z, ⇧⌘Z) — the menus offer them too */
  history: UndoHistory;
  onLoadTemplate: () => void;
  /** The project is on the site: Figma's Present opens it */
  isPublished: boolean;
  /** The Ekle menu (a section, a component, a divider) */
  onAdd: () => void;
  /** Figma's Dev Mode switch: the block editor */
  onSwitchToForm: () => void;
}) {
  const { variables, textStyles, components } = system;
  const router = useRouter();
  const { theme, toggle: toggleTheme } = useTheme();
  // Figma's minimized UI (⇧⌘\): the navigation bar and both sidebars away, the canvas alone.
  const [minimized, setMinimized] = useState(false);
  // The Bileşenler canvas's zoom, for the design panel's zoom menu.
  const zoomActions = useRef<ZoomActions | null>(null);
  const [page, setPage] = useState<Page>("project");
  const [leftTab, setLeftTab] = useState<LeftTab>("file");
  const [rawSelection, setSelection] = useState<Selection>({ kind: "none" });
  // Where the component picker adds: a Blok, after one of its layers or at its end.
  const [picker, setPicker] = useState<PickerTarget | null>(null);
  // Sections and Bloks folded in the layer tree (kept across tab switches).
  const [collapsedLayers, setCollapsedLayers] = useState<Set<string>>(() => new Set());
  // Instances (and their items) open in the layer tree — they start closed, as in Figma.
  const [openComponents, setOpenComponents] = useState<Set<string>>(() => new Set());
  // Rows open in the Bileşenler page's tree (components, sets, drawings, their frames) — they start closed, as in Figma.
  const [openMains, setOpenMains] = useState<Set<string>>(() => new Set());
  // The Bileşenler page's canvas: where the view is, the tool, the heights of the components in their columns, the text just made.
  const [view, setView] = useState<CanvasView>({ x: 64, y: 72, zoom: 0.75 });
  const [tool, setTool] = useState<CanvasTool>("move");
  const [heights, setHeights] = useState<Record<string, number>>({});
  const [autoEdit, setAutoEdit] = useState<string | null>(null);
  // Çalışma Alanı: a bare canvas of its own — nothing saved (see WorkspaceCanvas), so it stays while
  // the file is open, gone on reload; its own view, tool and selection, the Bileşenler page's apart.
  const [workspaceNodes, setWorkspaceNodes] = useState<CanvasNode[]>([]);
  const [workspaceView, setWorkspaceView] = useState<CanvasView>({ x: 64, y: 72, zoom: 0.75 });
  const [workspaceTool, setWorkspaceTool] = useState<CanvasTool>("move");
  const [workspaceSelection, setWorkspaceSelection] = useState<CanvasSelection | null>(null);
  // The design panel's tab (Figma's Design / Prototype) and the prototype previewed (a variant to start from).
  const [rightTab, setRightTab] = useState<"design" | "prototype">("design");
  const [previewing, setPreviewing] = useState<string | null>(null);
  const { nodes } = system;
  const [variablesOpen, setVariablesOpen] = useState(false);
  // The text style being edited in its popover, and where it opened.
  const [styleEditor, setStyleEditor] = useState<{ id: string; anchor: { top: number; left: number } } | null>(null);
  // The context menu (Figma's right click): where it opened, and what it holds.
  const [menu, setMenu] = useState<{ x: number; y: number; entries: MenuEntry[] } | null>(null);
  const closeMenu = useCallback(() => setMenu(null), []);
  // A layer copied (⌘C, "Kopyala"): pasted as a fresh copy where the selection is (⌘V).
  const [clip, setClip] = useState<Clip | null>(null);
  const toggleComponent = useCallback((id: string) => toggleIn(setOpenComponents)(id), []);
  const toggleLayer = useCallback((id: string) => toggleIn(setCollapsedLayers)(id), []);
  const toggleMain = useCallback((id: string) => toggleIn(setOpenMains)(id), []);
  const openComponentsContext = useMemo(() => ({ open: openComponents, toggle: toggleComponent }), [openComponents, toggleComponent]);
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
  const selectedMainLayer = selectedMain && rawSelection.kind === "component" && rawSelection.layerId ? findLayer(selectedMain, rawSelection.layerId) : null;
  const selectedNode = rawSelection.kind === "node" ? nodes.find((n) => n.id === rawSelection.nodeId) ?? null : null;
  const selectedNodeLayer = selectedNode && rawSelection.kind === "node" ? nodeLayer(selectedNode, rawSelection.layerId) : null;
  const selection: Selection =
    (rawSelection.kind === "block" && !selectedBlock) ||
    (rawSelection.kind === "group" && !selectedGroup) ||
    (rawSelection.kind === "section" && !selectedSection) ||
    (rawSelection.kind === "divider" && !selectedDivider) ||
    (rawSelection.kind === "component" && !selectedMain) ||
    (rawSelection.kind === "node" && !selectedNode)
      ? { kind: "none" }
      : rawSelection.kind === "component" && ((rawSelection.layerId && !selectedMainLayer) || (rawSelection.set && selectedMain && !isComponentSet(selectedMain, components)))
        ? { kind: "component", componentId: rawSelection.componentId }
        : rawSelection.kind === "node" && !selectedNodeLayer
          ? { kind: "node", nodeId: rawSelection.nodeId }
          : rawSelection;
  const mainSelection: MainSelection | null = selection.kind === "component" ? { componentId: selection.componentId, layerId: selection.layerId, set: selection.set } : null;
  // What is selected on the Bileşenler page's canvas.
  const canvasSelection: CanvasSelection | null = mainSelection ?? (selection.kind === "node" ? { nodeId: selection.nodeId, layerId: selection.layerId } : null);
  /** A canvas selection as the editor's. */
  const fromCanvas = (at: CanvasSelection): Selection => (isNodeSelection(at) ? { kind: "node", ...at } : { kind: "component", ...at });
  // A component set selected: its variants (see DesignComponent).
  const selectedSet = selection.kind === "component" && selection.set && selectedMain ? variantsOf(selectedMain.id, components) : null;
  // An item that no longer exists (deleted, undone) falls back to its block.
  const selectedItemId =
    selection.kind === "block" && selection.itemId && selectedBlock && hasItem(selectedBlock.block, selection.itemId)
      ? selection.itemId
      : null;
  // The selected instance, drawn from its main component — null for a layer the site's code draws.
  const instance = selectedBlock ? resolveInstance(selectedBlock.block, components, variables, textStyles) : null;
  const selectedEntry = selectedBlock && selectedItemId ? selectedBlock.block.entries?.find((e) => e.id === selectedItemId) ?? null : null;
  // The selected item's texts: its variant's (see BlockEntry.component).
  const itemTexts = instance?.item ? textLayersOf(resolveItem(instance.item, selectedEntry ?? undefined, instance.knownStyle).component) : [];
  // A text layer of that item.
  const selectedTextLayer = selection.kind === "block" && selectedItemId && selection.text ? itemTexts.find((layer) => layer.field === selection.text) ?? null : null;
  const selectedText = selectedTextLayer?.field ?? null;
  /**
   * ⌫ on the Bileşenler page: a drawing (or a layer of one) goes, and so does
   * a shape, a text or a frame drawn into a main component — its other
   * layers are its data's. False when nothing could.
   */
  const deleteOnCanvas = useRef<(at: Selection) => boolean>(() => false);
  useEffect(() => {
    deleteOnCanvas.current = (at) => {
      if (at.kind === "node") {
        const node = nodes.find((n) => n.id === at.nodeId);
        if (!node) return false;
        if (at.layerId && at.layerId !== node.id) {
          system.setNodes((list) => list.map((n) => (n.id === node.id && n.kind === "frame" ? removeLayer(n, at.layerId!) : n)));
          setSelection({ kind: "node", nodeId: node.id });
        } else {
          system.setNodes((list) => list.filter((n) => n.id !== node.id));
          setSelection({ kind: "none" });
        }
        return true;
      }
      if (at.kind !== "component" || !at.layerId) return false;
      const main = components.find((c) => c.id === at.componentId);
      const layer = main ? findLayer(main, at.layerId) : null;
      if (!main || !layer || !isDrawing(layer)) return false;
      system.setComponent(removeLayer(main, layer.id));
      setSelection({ kind: "component", componentId: main.id });
      return true;
    };
  });

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
      else if (current.kind === "node" || current.kind === "component") {
        if (!deleteOnCanvas.current(current)) return;
      } else return;
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
    if (next.kind === "component" || next.kind === "node") {
      // On the Bileşenler page: the component (a variant's set too) or the drawing, and the frames holding the layer.
      const rows: string[] = [];
      if (next.kind === "component") {
        const component = components.find((c) => c.id === next.componentId);
        const frames = component && next.layerId ? layerPath(component, next.layerId) ?? [] : [];
        rows.push(setRowKey(component ? setIdOf(component) : next.componentId));
        if (next.layerId) rows.push(next.componentId, ...frames.flatMap((f) => (f ? [layerRowKey(next.componentId, f.id)] : [])));
      } else {
        const node = nodes.find((n) => n.id === next.nodeId);
        const frames = node?.kind === "frame" && next.layerId && next.layerId !== node.id ? layerPath(node, next.layerId) ?? [] : [];
        if (next.layerId && next.layerId !== next.nodeId) rows.push(nodeRowKey(next.nodeId), ...frames.flatMap((f) => (f ? [nodeRowKey(next.nodeId, f.id)] : [])));
      }
      setOpenMains((prev) => (rows.every((key) => prev.has(key)) ? prev : new Set([...prev, ...rows])));
      return;
    }
    const block = next.kind === "block" ? findBlock(project.items, next.blockId) : null;
    const group = next.kind === "group" ? findGroup(project.items, next.groupId) : null;
    // Every layer is in the page's frame: it opens too.
    const inPage = next.kind === "none" || next.kind === "page" ? [] : [PAGE_LAYER];
    const ids = [...inPage, ...(block ? [block.section.id, block.group.id] : group ? [group.section.id] : [])];
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
    setAutoEdit(null);
    revealLayer(next);
    const on: Page | null = next.kind === "component" || next.kind === "node" ? "components" : next.kind === "none" ? null : "project";
    if (on && on !== page) setPage(on);
    if (!scroll) return;
    // Next frames: the element may have just been added, or its page come up.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      // The Bileşenler page's canvas: the view moves to it (it never scrolls).
      if (next.kind === "component" || next.kind === "node") return showOnCanvas(next.kind === "node" ? { nodeId: next.nodeId, layerId: next.layerId } : next);
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
    }));
  }

  /** Moves the Bileşenler page's view to what is selected there, when it is out of sight — its zoom stays. */
  function showOnCanvas(at: CanvasSelection) {
    const viewport = document.querySelector<HTMLElement>("[data-components-canvas]");
    const el = viewport?.querySelector(canvasSelector(at, components));
    if (!viewport || !el) return;
    const box = viewport.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const inSight = r.left >= box.left && r.top >= box.top && r.right <= box.right && r.bottom <= box.bottom;
    if (inSight) return;
    // Its middle to the view's — its top to the view's top (with room) when taller than the view.
    const dx = box.left + box.width / 2 - (r.left + r.width / 2);
    const dy = r.height > box.height - 96 ? box.top + 72 - r.top : box.top + box.height / 2 - (r.top + r.height / 2);
    setView((v) => ({ ...v, x: v.x + dx, y: v.y + dy }));
  }

  // The same, as stable functions: the canvas's sections and the layer tree's rows are memoized on
  // their props, so a keystroke in one layer re-renders that layer alone (see LiveSection, LayerSection).
  const latest = useRef({ select, projectMenu, openMenu, items: project.items });
  useLayoutEffect(() => {
    latest.current = { select, projectMenu, openMenu, items: project.items };
  });
  const selectStable = useCallback((next: Selection, opts?: { scroll?: boolean }) => latest.current.select(next, opts), []);
  const selectFromPanel = useCallback<SelectFromPanel>((next, { scroll = true } = {}) => latest.current.select(next, { scroll }), []);
  const openPickerFor = useCallback((groupId: string) => setPicker({ groupId }), []);
  // A right click on a row selects its layer and opens its menu; "Katmanı seç" lists the ones holding it.
  const onLayerContextMenu = useCallback((target: Selection, e: React.MouseEvent) => {
    const { select, projectMenu, openMenu, items } = latest.current;
    select(target);
    const holding: Selection[] = target.kind === "page" ? [] : [{ kind: "page" }, ...selectionLayers(target, items)];
    openMenu(e, projectMenu(target, holding.reverse()));
  }, []);

  // The selected row stays in sight in the layer tree, whichever layer it is and however it was selected.
  const selectionKey = JSON.stringify(selection);
  useEffect(() => {
    requestAnimationFrame(() => document.querySelector("[data-left-panel] [data-selected-row]")?.scrollIntoView({ block: "nearest" }));
  }, [selectionKey, leftTab, page]);

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

  // The toolbar's keys, as Figma's: F a frame, T a text (on the project's page) — never while typing, or with a modifier held.
  const tools = useRef({ frame: addFrame, text: () => addFromCatalog("text"), page });
  useEffect(() => {
    tools.current = { frame: addFrame, text: () => addFromCatalog("text"), page };
  });
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = document.activeElement as HTMLElement | null;
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat || (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)))) return;
      if (tools.current.page !== "project") return;
      const key = e.key.toLowerCase();
      if (key === "f") tools.current.frame();
      else if (key === "t") tools.current.text();
      else return;
      e.preventDefault();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Figma's own keys for the chrome: ⇧D switches the mode (the block editor), ⇧⌘\ minimizes the UI — never while typing.
  const shell = useRef({ onSwitchToForm });
  useEffect(() => {
    shell.current = { onSwitchToForm };
  });
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      if (e.key === "\\" && e.shiftKey && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setMinimized((m) => !m);
      } else if (e.code === "KeyD" && e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey && !e.repeat) {
        e.preventDefault();
        shell.current.onSwitchToForm();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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
  /** On the Bileşenler page, the main component holding a layer, for its header's menu — a variant by its values. */
  const mainHolder = (main: DesignComponent): MenuItem => ({
    label: variantName(main),
    hint: isVariant(main, components) ? "Varyant" : "Ana bileşen",
    onSelect: () => select({ kind: "component", componentId: main.id }),
  });

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
  /** The same for an item: to the component it is — the variant it was set to (its size to the layer repeating it). */
  function pushEntry(block: Block, entry: BlockEntry, resolved: ResolvedInstance) {
    const item = resolved.item;
    if (!item || !entry.overrides) return;
    system.setComponent(pushItem(resolveItem(item, entry, resolved.knownStyle).component, entry.overrides));
    const { size } = entry.overrides;
    if (size) system.setComponent({ ...resolved.main, layers: resolved.main.layers.map((layer) => (layer.id === item.layer.id ? { ...layer, size } : layer)) });
    setItemOverrides(block, entry.id, null);
  }

  /** An item set to a variant of its component's set — none of its own when it is the one its layer repeats. */
  function setEntryVariant(block: Block, itemId: string, variantId: string) {
    const repeated = resolveInstance(block, components, variables, textStyles)?.item?.component.id;
    actions.updateBlock(block.id, {
      entries: (block.entries ?? []).map((e) => (e.id === itemId ? { ...e, component: variantId === repeated ? undefined : variantId } : e)),
    });
  }

  // ── Variants: component sets (see DesignComponent) ──

  /** An instance's variant properties: its component set's, with its values — none when its component is in no set. */
  function instanceProperties(component: DesignComponent): InstanceProperty[] {
    if (!isVariant(component, components)) return [];
    return variantProperties(variantsOf(setIdOf(component), components)).map((p) => ({ name: p.name, value: variantValue(component, p.name), values: p.values }));
  }
  /** `base`, or `base 2`, `base 3`… — a component name no other has. */
  function freeComponentName(base: string) {
    let name = base;
    for (let n = 2; components.some((c) => c.name === name); n++) name = `${base} ${n}`;
    return name;
  }
  /** Changed variants stored (nothing when nothing changed). */
  const storeVariants = (changed: DesignComponent[]) => {
    if (changed.length) system.setComponents(changed);
  };
  /** Figma's "Add variant": a copy of `fromId` in its set — a component in none becomes one — selected. */
  function addVariant(fromId: string) {
    const from = components.find((c) => c.id === fromId);
    if (!from) return;
    const id = uid();
    system.setComponents(withNewVariant(from, components, id));
    select({ kind: "component", componentId: id }, { scroll: true });
  }
  /** A set's "+": a copy of its last variant. */
  const addVariantToSet = (setId: string) => addVariant(variantsOf(setId, components).at(-1)?.id ?? setId);
  /**
   * A main component deleted: a variant leaves its set (the next one becomes
   * the set when it was the first); a starting one only goes back to the
   * site's look — in its set still, with its values.
   */
  function removeMain(component: DesignComponent) {
    if (system.isStartingComponent(component.id)) {
      const starting = STARTING_COMPONENTS.find((c) => c.id === component.id);
      if (starting && component.variant) system.setComponent({ ...starting, variant: component.variant });
      else system.removeComponent(component.id);
      return;
    }
    if (isVariant(component, components)) {
      const { remove, update } = withoutVariant(component, components);
      system.removeComponents(remove);
      storeVariants(update);
    } else system.removeComponent(component.id);
    setSelection({ kind: "none" });
  }
  /** A whole set deleted — its starting first variant stays, back to the site's look and in no set. */
  function removeSet(setId: string) {
    system.removeComponents(variantsOf(setId, components).map((v) => v.id));
    setSelection(system.isStartingComponent(setId) ? { kind: "component", componentId: setId } : { kind: "none" });
  }
  /** Figma's ⌘D on the Bileşenler page: a set whole, a variant as one more of its set, a component as a copy of its own. */
  function duplicateMain(at: MainSelection) {
    const component = components.find((c) => c.id === at.componentId);
    if (!component || at.layerId) return;
    if (at.set) {
      const copies = copySet(variantsOf(component.id, components), freeComponentName(`${component.name} kopyası`), uid);
      // Beside the original on the canvas, not over it.
      const place = places.get(component.id);
      if (place) copies[0] = { ...copies[0], canvas: { ...copies[0].canvas, x: place.x + canvasWidth(component) + SET_INSET * 2 + 80, y: place.y } };
      system.setComponents(copies);
      select({ kind: "component", componentId: copies[0].id, set: true }, { scroll: true });
    } else if (isVariant(component, components)) addVariant(component.id);
    else {
      // A copy of its own — beside the original on the canvas, not over it.
      const place = places.get(component.id);
      const copy = copyComponent(component, uid(), freeComponentName(`${component.name} kopyası`));
      system.setComponent(place ? { ...copy, canvas: { ...component.canvas, x: place.x + canvasWidth(component) + 80, y: place.y } } : copy);
      select({ kind: "component", componentId: copy.id }, { scroll: true });
    }
  }
  /**
   * A name typed in the tree: a component's, a set's (every variant's), a
   * variant's — its values, "Durum=Vurgulu" — or a layer's (empty: back to
   * its default: the component it repeats', its field's, its id).
   */
  function renameMain(at: MainSelection, name: string | undefined) {
    const main = components.find((c) => c.id === at.componentId);
    if (!main) return;
    if (at.layerId) {
      system.setComponent(updateLayer(main, at.layerId, (l) => ({ ...l, name: name ?? (l.kind === "instance" ? layerComponent(l, components).name : l.kind === "text" ? l.field : l.id) })));
      return;
    }
    if (!name) return;
    if (at.set) storeVariants(withSetName(variantsOf(main.id, components), name));
    else if (isVariant(main, components)) {
      const values = parseVariantName(name);
      if (values) system.setComponent({ ...main, variant: values });
    } else system.setComponent({ ...main, name });
  }
  /** Where a set's variants are used, each place once. */
  const setUses = (variants: DesignComponent[]) => variants.flatMap(mainUses).filter((use, i, all) => all.findIndex((u) => u.key === use.key) === i);

  // ── The Bileşenler page's canvas: what is drawn, moved, sized ──

  /** Their heights as drawn: the places of the components in their columns follow them. */
  const measureTops = (next: Record<string, number>) => setHeights((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
  /** Where each top-level main component sits (see canvasPlaces). */
  const places = useMemo(() => canvasPlaces(components, heights), [components, heights]);

  /** A drawing changed. */
  const updateNode = (nodeId: string, update: (node: CanvasNode) => CanvasNode) => system.setNodes((list) => list.map((n) => (n.id === nodeId ? update(n) : n)));
  /** A drawing's layer changed — or the drawing itself (a shape or a text on its own is its only layer). */
  function setNodeLayer(nodeId: string, layerId: string, update: (layer: ComponentLayer) => ComponentLayer) {
    updateNode(nodeId, (node) => {
      if (layerId === node.id) return { ...(update(node) as FrameLayer | ShapeLayer | StaticTextLayer), canvas: node.canvas };
      return node.kind === "frame" ? updateLayer(node, layerId, update) : node;
    });
  }

  /** Moved on the canvas: a drawing, a component or a set to `place`. */
  function moveOnCanvas(target: { componentId: string } | { nodeId: string }, place: { x: number; y: number }) {
    if ("nodeId" in target) return updateNode(target.nodeId, (n) => ({ ...n, canvas: { ...n.canvas, ...place } }));
    const component = components.find((c) => c.id === target.componentId);
    if (component) system.setComponent({ ...component, canvas: { ...component.canvas, ...place } });
  }

  /**
   * Sized with its handles: its size Fixed on the axes that changed — a
   * drawing on its own moves with its top left, a component (or a set) gets
   * its width on the canvas.
   */
  function resizeOnCanvas(at: CanvasSelection, rect: { x: number; y: number; w: number; h: number }, changed: { x: boolean; y: boolean }) {
    const sized = (size: Sizing | undefined): Sizing => ({
      ...size,
      ...(changed.x ? { width: "fixed" as const, widthPx: rect.w } : {}),
      ...(changed.y ? { height: "fixed" as const, heightPx: rect.h, ratio: undefined } : {}),
    });
    if (isNodeSelection(at)) {
      if (!at.layerId || at.layerId === at.nodeId) return updateNode(at.nodeId, (n) => ({ ...n, size: sized(n.size), canvas: { ...n.canvas, x: rect.x, y: rect.y } }));
      return setNodeLayer(at.nodeId, at.layerId, (l) => ({ ...l, size: sized(l.size) }));
    }
    const component = components.find((c) => c.id === at.componentId);
    if (!component || at.set) return;
    if (at.layerId) return system.setComponent(updateLayer(component, at.layerId, (l) => ({ ...l, size: sized(l.size) })));
    sizeComponent(component, { ...(changed.x ? { width: rect.w } : {}), ...(changed.y ? { height: rect.h } : {}) }, { x: rect.x, y: rect.y });
  }

  /**
   * A main component's size on the canvas (Fixed W, Fixed or Hug H — see
   * CanvasPlace): one on its own moves to `place` too (its top left, when a
   * top or left handle sized it); a variant stays in its set's layout (the
   * set's place is its first variant's).
   */
  function sizeComponent(component: DesignComponent, size: { width?: number; height?: number | null }, place?: { x: number; y: number }) {
    const inSet = isVariant(component, components);
    const at = !inSet && place ? place : component.canvas ?? places.get(setIdOf(component)) ?? { x: 0, y: 0 };
    const height = size.height === null ? undefined : size.height ?? component.canvas?.height;
    system.setComponent({ ...component, canvas: { ...component.canvas, x: at.x, y: at.y, width: Math.max(40, Math.round(size.width ?? canvasWidth(component))), height: height && Math.max(8, Math.round(height)) } });
  }

  /** The next name of a kind drawn: "Çerçeve 3" after "Çerçeve 2", as Figma numbers them. */
  function drawnName(base: string) {
    const drawn = [...nodes.flatMap((n) => (n.kind === "frame" ? [n, ...allLayers(n.layers)] : [n])), ...components.flatMap((c) => allLayers(c.layers))];
    const numbers = drawn.map((l) => Number(l.name.match(new RegExp(`^${base} (\\d+)$`))?.[1] ?? 0));
    return `${base} ${Math.max(0, ...numbers) + 1}`;
  }

  /**
   * Drawn with a tool — a frame (a white one, stacking its layers), a
   * rectangle or an ellipse (Figma's grey), a text typed in at once — on the
   * canvas, or into the frame it was drawn in; selected, the move tool back.
   */
  function drawOnCanvas(drawn: CanvasTool, rect: { x: number; y: number; w: number; h: number }, parent: DrawParent) {
    const id = uid();
    const size: Sizing = drawn === "text" ? { width: "hug" } : { width: "fixed", widthPx: rect.w, height: "fixed", heightPx: rect.h };
    const layer: FrameLayer | ShapeLayer | StaticTextLayer =
      drawn === "frame"
        ? { kind: "frame", id, name: drawnName("Çerçeve"), layout: { flow: "vertical" }, layers: [], fill: { color: { value: "#FFFFFF" } }, size }
        : drawn === "text"
          ? { kind: "static-text", id, name: "", text: "", style: "text", size }
          : { kind: "shape", shape: drawn === "ellipse" ? "ellipse" : "rectangle", id, name: drawnName(drawn === "ellipse" ? "Elips" : "Dikdörtgen"), fill: { color: { value: "#D9D9D9" } }, size };
    setTool("move");
    if (!parent) {
      system.setNodes((list) => [...list, { ...layer, canvas: { x: rect.x, y: rect.y } }]);
      select({ kind: "node", nodeId: id });
    } else if ("nodeId" in parent) {
      updateNode(parent.nodeId, (n) => (n.kind === "frame" ? { ...insertLayer(n, parent.frameId, layer), canvas: n.canvas } : n));
      select({ kind: "node", nodeId: parent.nodeId, layerId: id });
    } else {
      const component = components.find((c) => c.id === parent.componentId);
      if (!component) return;
      system.setComponent(insertLayer(component, parent.frameId, layer));
      select({ kind: "component", componentId: component.id, layerId: id });
    }
    if (drawn === "text") setAutoEdit(id);
  }

  /** A text of its own typed in on the canvas: a drawing's, or a main component's. */
  function typeOnCanvas(target: { componentId: string } | { nodeId: string }, layerId: string, text: string) {
    const typed = (l: ComponentLayer): ComponentLayer => (l.kind === "static-text" ? { ...l, text } : l);
    if ("nodeId" in target) return setNodeLayer(target.nodeId, layerId, typed);
    const component = components.find((c) => c.id === target.componentId);
    if (component) system.setComponent(updateLayer(component, layerId, typed));
  }

  /**
   * Figma's "Create component" (⌥⌘K): a drawing becomes a main component,
   * where it is — a frame with its auto layout, look and layers; a shape or a
   * text as the only layer of one.
   */
  function componentFromNode(nodeId: string) {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;
    const { canvas, ...layer } = node;
    const id = uid();
    const width = layer.size?.width === "fixed" ? layer.size.widthPx : undefined;
    const component: DesignComponent =
      layer.kind === "frame"
        ? { id, name: freeComponentName(layer.name || "Bileşen"), layout: layer.layout, ...(layer.spacing ? { spacing: layer.spacing } : {}), layers: layer.layers, ...componentLook(layer), canvas: { x: canvas.x, y: canvas.y, width } }
        : { id, name: freeComponentName(layerLabel(layer)), layout: { flow: "vertical" }, layers: [{ ...layer, size: { ...layer.size, width: "fill" } }], canvas: { x: canvas.x, y: canvas.y, width } };
    system.setComponent(component);
    system.setNodes((list) => list.filter((n) => n.id !== nodeId));
    select({ kind: "component", componentId: id });
  }

  /** ⌘D on the canvas: a drawing copied 20px down and right, a drawn layer copied after itself — a main component as duplicateMain does. */
  function duplicateOnCanvas(at: CanvasSelection) {
    if (!isNodeSelection(at)) {
      const main = components.find((c) => c.id === at.componentId);
      const layer = main && at.layerId ? findLayer(main, at.layerId) : null;
      if (!at.layerId) return duplicateMain(at);
      if (!main || !layer || !isDrawing(layer)) return;
      const copy = withFreshIds(layer, uid);
      system.setComponent(insertLayerAfter(main, layer.id, copy));
      return select({ kind: "component", componentId: main.id, layerId: copy.id });
    }
    const node = nodes.find((n) => n.id === at.nodeId);
    if (!node) return;
    if (at.layerId && at.layerId !== node.id) {
      const layer = node.kind === "frame" ? findLayer(node, at.layerId) : null;
      if (!layer) return;
      const copy = withFreshIds(layer, uid);
      updateNode(node.id, (n) => (n.kind === "frame" ? { ...insertLayerAfter(n, layer.id, copy), canvas: n.canvas } : n));
      return select({ kind: "node", nodeId: node.id, layerId: copy.id });
    }
    const copy = { ...(withFreshIds(node, uid) as FrameLayer | ShapeLayer | StaticTextLayer), canvas: { ...node.canvas, x: node.canvas.x + 20, y: node.canvas.y + 20 } };
    system.setNodes((list) => [...list, copy]);
    select({ kind: "node", nodeId: copy.id });
  }

  /** A drawing's (or its layer's) name typed in the tree — a text's back to its words when emptied. */
  const renameNode = (at: NodeSelection, name: string | undefined) =>
    setNodeLayer(at.nodeId, at.layerId ?? at.nodeId, (l) => ({ ...l, name: name ?? (l.kind === "static-text" ? "" : l.name) }));
  /** A drawing's eye (⇧⌘H): a frame or a shape shown or hidden. */
  const toggleNodeHidden = (at: NodeSelection) =>
    setNodeLayer(at.nodeId, at.layerId ?? at.nodeId, (l) => (l.kind === "frame" || l.kind === "shape" ? { ...l, hidden: l.hidden ? undefined : true } : l));

  // ── Çalışma Alanı: its own nodes, its layer tree's rename and eye — see WorkspaceCanvas for its canvas itself ──
  const setWorkspaceNodeLayer = (nodeId: string, layerId: string, update: (layer: ComponentLayer) => ComponentLayer) =>
    setWorkspaceNodes((list) =>
      list.map((node) => {
        if (node.id !== nodeId) return node;
        if (layerId === node.id) return { ...(update(node) as FrameLayer | ShapeLayer | StaticTextLayer), canvas: node.canvas };
        return node.kind === "frame" ? updateLayer(node, layerId, update) : node;
      })
    );
  const renameWorkspaceNode = (at: NodeSelection, name: string | undefined) =>
    setWorkspaceNodeLayer(at.nodeId, at.layerId ?? at.nodeId, (l) => ({ ...l, name: name ?? (l.kind === "static-text" ? "" : l.name) }));
  const toggleWorkspaceNodeHidden = (at: NodeSelection) =>
    setWorkspaceNodeLayer(at.nodeId, at.layerId ?? at.nodeId, (l) => (l.kind === "frame" || l.kind === "shape" ? { ...l, hidden: l.hidden ? undefined : true } : l));

  // ── Layer actions — the context menu's, and their keys, as Figma's ──

  const canCopy = (t: Selection) => (t.kind === "block" && !t.itemId) || t.kind === "group" || t.kind === "section";
  const canDuplicate = (t: Selection) => (t.kind === "block" && !t.text) || t.kind === "group" || t.kind === "section" || t.kind === "divider";
  const canRename = (t: Selection) => (t.kind === "block" && !t.itemId) || t.kind === "group" || t.kind === "section" || t.kind === "component" || t.kind === "node";

  /** ⌘C: the layer as it is now — a component, a Blok or a section. */
  function copyLayer(t: Selection) {
    if (t.kind === "block" && !t.itemId) {
      const found = findBlock(project.items, t.blockId);
      if (found) setClip({ kind: "block", block: structuredClone(found.block) });
    } else if (t.kind === "group") {
      const found = findGroup(project.items, t.groupId);
      if (found) setClip({ kind: "group", group: structuredClone(found.group) });
    } else if (t.kind === "section") {
      const found = findSection(project.items, t.sectionId);
      if (found) setClip({ kind: "section", section: structuredClone(found.section) });
    }
  }

  /**
   * ⌘V: a fresh copy of what was copied, where `t` is — a component after the
   * selected one (or at the end of the selected Blok, of the selected
   * section's last Blok, of the page); a Blok after the selected one's (or at
   * the end of the selected section, of the page); a section after the
   * selected one (or the page's end) — and selected.
   */
  function pasteAt(t: Selection) {
    if (!clip) return;
    const block = t.kind === "block" ? findBlock(project.items, t.blockId) : null;
    const group = t.kind === "group" ? findGroup(project.items, t.groupId) : null;
    const section = t.kind === "section" ? findSection(project.items, t.sectionId)?.section ?? null : block?.section ?? group?.section ?? null;
    if (clip.kind === "block") {
      const copy = cloneBlock(clip.block);
      if (block) actions.insertBlock(block.group.id, copy, block.block.id);
      else if (group) actions.insertBlock(group.group.id, copy);
      else if (section) actions.insertBlockInSection(section.id, copy);
      else actions.insertBlockAtEnd(copy);
      select({ kind: "block", blockId: copy.id }, { scroll: true });
    } else if (clip.kind === "group") {
      const copy = cloneGroup(clip.group);
      if (section) actions.insertGroup(section.id, copy, block?.group.id ?? group?.group.id);
      else actions.insertGroupAtEnd(copy);
      select({ kind: "group", groupId: copy.id }, { scroll: true });
    } else {
      const copy = cloneItem(clip.section);
      actions.insertItem(copy, section?.id ?? (t.kind === "divider" ? t.dividerId : undefined));
      select({ kind: "section", sectionId: copy.id }, { scroll: true });
    }
  }

  /** ⌘D: a copy right after it — a component, an item, a Blok, a section or a divider — selected. */
  function duplicateLayer(t: Selection) {
    if (t.kind === "block" && !t.text) {
      const found = findBlock(project.items, t.blockId);
      if (!found) return;
      if (!t.itemId) return select({ kind: "block", blockId: actions.duplicateBlock(found.block) });
      const { patch, id } = duplicateItem(found.block, t.itemId);
      actions.updateBlock(found.block.id, patch);
      select({ kind: "block", blockId: found.block.id, itemId: id });
    } else if (t.kind === "group") select({ kind: "group", groupId: actions.duplicateGroup(t.groupId) });
    else if (t.kind === "section") select({ kind: "section", sectionId: actions.duplicateItem(t.sectionId) });
    else if (t.kind === "divider") select({ kind: "divider", dividerId: actions.duplicateItem(t.dividerId) });
  }

  /** ⌫: the layer — or the item picked inside a component — goes; a text belongs to its main component: nothing. */
  function deleteLayer(t: Selection) {
    if (t.kind === "block") {
      if (t.text) return;
      const found = t.itemId ? findBlock(project.items, t.blockId) : null;
      if (found && t.itemId) actions.updateBlock(found.block.id, removeItem(found.block, t.itemId));
      else actions.deleteBlock(t.blockId);
    } else if (t.kind === "group") actions.deleteGroup(t.groupId);
    else if (t.kind === "section") actions.deleteItem(t.sectionId);
    else if (t.kind === "divider") actions.deleteItem(t.dividerId);
  }

  /** Is the layer hidden (its eye) — null for one that can't be (a text, a divider, a list's item…)? */
  function isHidden(t: Selection): boolean | null {
    if (t.kind === "block" && !t.text) {
      const found = findBlock(project.items, t.blockId);
      if (!found) return null;
      if (!t.itemId) return Boolean(found.block.look?.hidden);
      const entry = found.block.entries?.find((e) => e.id === t.itemId);
      return entry ? Boolean(entry.overrides?.look?.hidden) : null;
    }
    if (t.kind === "group") return Boolean(findGroup(project.items, t.groupId)?.group.look?.hidden);
    if (t.kind === "section") return Boolean(findSection(project.items, t.sectionId)?.section.look?.hidden);
    return null;
  }
  /** ⇧⌘H: shown, or hidden. */
  function toggleHidden(t: Selection) {
    const hidden = isHidden(t);
    if (hidden === null) return;
    const flip = (look?: FrameLook): FrameLook => ({ ...look, hidden: hidden ? undefined : true });
    if (t.kind === "block") {
      const found = findBlock(project.items, t.blockId);
      const entry = t.itemId ? found?.block.entries?.find((e) => e.id === t.itemId) : null;
      if (found && entry) setItemOverrides(found.block, entry.id, { look: flip(entry.overrides?.look) });
      else if (found) actions.updateBlock(found.block.id, { look: flip(found.block.look) });
    } else if (t.kind === "group") {
      const found = findGroup(project.items, t.groupId);
      if (found) actions.updateGroup(found.group.id, { look: flip(found.group.look) });
    } else if (t.kind === "section") {
      const found = findSection(project.items, t.sectionId);
      if (found) actions.updateSection(found.section.id, { look: flip(found.section.look) });
    }
  }

  /** Can it move one earlier (-1) / later (+1) in its list? */
  function canMove(t: Selection, dir: -1 | 1): boolean {
    const within = (index: number, length: number) => index >= 0 && index + dir >= 0 && index + dir < length;
    if (t.kind === "block" && !t.text) {
      const found = findBlock(project.items, t.blockId);
      if (!found) return false;
      return t.itemId ? canMoveItem(found.block, t.itemId, dir) : within(found.index, found.group.blocks.length);
    }
    if (t.kind === "group") {
      const found = findGroup(project.items, t.groupId);
      return found ? within(found.index, found.section.groups.length) : false;
    }
    if (t.kind === "section" || t.kind === "divider") {
      const id = t.kind === "section" ? t.sectionId : t.dividerId;
      return within(project.items.findIndex((i) => i.id === id), project.items.length);
    }
    return false;
  }
  /** One earlier (-1) / later (+1) in its list — a grid laid out by hand swaps cells (see stepBy). */
  function moveLayer(t: Selection, dir: -1 | 1) {
    if (t.kind === "block" && t.itemId) {
      const found = findBlock(project.items, t.blockId);
      if (found) actions.updateBlock(found.block.id, moveItem(found.block, t.itemId, dir));
    } else if (t.kind === "block") actions.moveBlockBy(t.blockId, dir);
    else if (t.kind === "group") actions.moveGroupBy(t.groupId, dir);
    else if (t.kind === "section") actions.moveItemBy(t.sectionId, dir);
    else if (t.kind === "divider") actions.moveItemBy(t.dividerId, dir);
  }

  /** ⌘R: its name, typed in the layer tree — its row shown first. */
  function renameLayer(t: Selection) {
    const key =
      t.kind === "block" && !t.itemId ? t.blockId
      : t.kind === "group" ? t.groupId
      : t.kind === "section" ? t.sectionId
      : t.kind === "component" ? (t.layerId ? layerRowKey(t.componentId, t.layerId) : t.set ? setRowKey(t.componentId) : t.componentId)
      : t.kind === "node" ? nodeRowKey(t.nodeId, t.layerId)
      : null;
    if (!key) return;
    setLeftTab("file");
    select(t);
    // Next frames: the tree is back, the rows holding it open.
    requestAnimationFrame(() => requestAnimationFrame(() => requestRename(key)));
  }

  // ── The context menu (Figma's right click) ──

  /** A layer's name and what it is, as the menus show it. */
  function describe(t: Selection): { label: string; hint?: string } {
    switch (t.kind) {
      case "page":
        return { label: project.title?.trim() || "Sayfa", hint: "Sayfa" };
      case "meta":
        return t.part ? { label: OVERVIEW_NAMES[t.part], hint: "Proje bilgileri" } : { label: "Proje bilgileri", hint: "Çerçeve" };
      case "section": {
        const found = findSection(project.items, t.sectionId);
        return { label: found ? sectionName(found.section, found.index) : "Bölüm", hint: "Bölüm" };
      }
      case "group": {
        const found = findGroup(project.items, t.groupId);
        return { label: found ? groupName(found.group, found.index) : "Blok", hint: "Blok" };
      }
      case "block": {
        const found = findBlock(project.items, t.blockId);
        if (!found) return { label: "Katman" };
        if (t.itemId && t.text) {
          const resolved = resolveInstance(found.block, components, variables, textStyles);
          const entry = found.block.entries?.find((e) => e.id === t.itemId);
          const component = resolved?.item ? resolveItem(resolved.item, entry, resolved.knownStyle).component : null;
          return { label: (component && textLayersOf(component).find((l) => l.field === t.text)?.name) || "Metin", hint: "Metin" };
        }
        if (t.itemId) return { label: itemName(found.block, t.itemId), hint: itemNoun(found.block) };
        return { label: blockName(found.block, components), hint: "Örnek" };
      }
      case "divider":
        return { label: "Ayırıcı", hint: "Çizgi" };
      default:
        return { label: "" };
    }
  }

  /** "Katmanı seç ›": the layers under the pointer (or holding the layer), the innermost first — `t` ticked. */
  const selectLayerEntry = (layers: Selection[], t: Selection): ContextMenuItem => ({
    label: "Katmanı seç",
    disabled: layers.length === 0,
    items: layers.map((layer) => ({ ...describe(layer), checked: layerKey(layer) === layerKey(t), onSelect: () => select(layer, { scroll: true }) })),
  });

  /** An instance's entries: its main component, its variants, the components it can be, its overrides. */
  function instanceEntries(block: Block): MenuEntry[] {
    const resolved = resolveInstance(block, components, variables, textStyles);
    if (!resolved) return [];
    const main = resolved.main;
    const update = (patch: Partial<Block>) => actions.updateBlock(block.id, patch);
    const variants = variantsOf(setIdOf(main), components);
    const swaps = swapsFor(block.type, components);
    const entries: MenuEntry[] = ["-", { label: "Ana bileşene git", hint: variantName(main), onSelect: () => goToMain(main.id) }];
    if (variants.length > 1) entries.push({ label: "Varyant", items: variants.map((v) => ({ label: variantName(v), checked: v.id === main.id, onSelect: () => update({ component: v.id }) })) });
    if (swaps.length > 1) entries.push({ label: "Bileşeni değiştir", items: swaps.map((c) => ({ label: c.name, checked: c.id === setIdOf(main), onSelect: () => update({ component: c.id }) })) });
    if (hasOverrides(block)) {
      entries.push(
        { label: "Tüm değişiklikleri sıfırla", onSelect: () => update(resetInstance(block)) },
        { label: "Ana bileşene uygula", hint: "her örneğe", onSelect: () => pushBlock(block, resolved) }
      );
    }
    return entries;
  }

  /** An item's: the component it is (the variant), its set's variants, its overrides. */
  function itemEntries(block: Block, itemId: string): MenuEntry[] {
    const resolved = resolveInstance(block, components, variables, textStyles);
    const entry = block.entries?.find((e) => e.id === itemId);
    if (!resolved?.item || !entry) return [];
    const own = resolveItem(resolved.item, entry, resolved.knownStyle).component;
    const variants = resolved.item.variants.map((v) => v.component);
    const entries: MenuEntry[] = ["-", { label: "Ana bileşene git", hint: variantName(own), onSelect: () => goToMain(own.id) }];
    if (variants.length > 1) entries.push({ label: "Varyant", items: variants.map((v) => ({ label: variantName(v), checked: v.id === own.id, onSelect: () => setEntryVariant(block, itemId, v.id) })) });
    if (itemHasOverrides(entry)) {
      entries.push(
        { label: "Tüm değişiklikleri sıfırla", onSelect: () => setItemOverrides(block, itemId, null) },
        { label: "Ana bileşene uygula", hint: "her örneğe", onSelect: () => pushEntry(block, entry, resolved) }
      );
    }
    return entries;
  }

  /** The menu of a layer of the project's page (`under`: the layers for "Katmanı seç", the innermost first). */
  function projectMenu(t: Selection, under: Selection[]): MenuEntry[] {
    const paste: ContextMenuItem = { label: "Yapıştır", shortcut: keys("mod", "v"), disabled: !clip, onSelect: () => pasteAt(t) };
    const copy: MenuEntry[] = [{ label: "Kopyala", shortcut: keys("mod", "c"), disabled: !canCopy(t), onSelect: () => copyLayer(t) }, paste];
    const edit: MenuEntry[] = [
      { label: "Çoğalt", shortcut: keys("mod", "d"), onSelect: () => duplicateLayer(t) },
      { label: "Sil", shortcut: keys("backspace"), onSelect: () => deleteLayer(t) },
    ];
    const order: MenuEntry[] = [
      { label: "Yukarı taşı", disabled: !canMove(t, -1), onSelect: () => moveLayer(t, -1) },
      { label: "Aşağı taşı", disabled: !canMove(t, 1), onSelect: () => moveLayer(t, 1) },
    ];
    const hidden = isHidden(t);
    const view: MenuEntry[] = [
      ...(hidden === null ? [] : [{ label: hidden ? "Göster" : "Gizle", shortcut: keys("shift", "mod", "h"), onSelect: () => toggleHidden(t) }]),
      ...(canRename(t) ? [{ label: "Yeniden adlandır", shortcut: keys("mod", "r"), onSelect: () => renameLayer(t) }] : []),
    ];
    const selectLayer = selectLayerEntry(under, t);
    switch (t.kind) {
      case "block": {
        const found = findBlock(project.items, t.blockId);
        if (!found) return [];
        if (t.itemId && t.text) {
          // A text of an item: it belongs to the component the item is.
          const resolved = resolveInstance(found.block, components, variables, textStyles);
          const entry = found.block.entries?.find((e) => e.id === t.itemId);
          const component = resolved?.item ? resolveItem(resolved.item, entry, resolved.knownStyle).component : null;
          const layer = component ? textLayersOf(component).find((l) => l.field === t.text) : null;
          return [selectLayer, ...(component ? ["-" as const, { label: "Ana bileşene git", hint: variantName(component), onSelect: () => goToMain(component.id, layer?.id) }] : [])];
        }
        if (t.itemId) return [...edit, "-", selectLayer, ...order, "-", ...view, ...itemEntries(found.block, t.itemId)];
        return [...copy, ...edit, "-", selectLayer, ...order, "-", ...view, ...instanceEntries(found.block)];
      }
      case "group":
        return [...copy, ...edit, "-", selectLayer, ...order, "-", { label: "Bileşen ekle", onSelect: () => setPicker({ groupId: t.groupId }) }, "-", ...view];
      case "section":
        return [
          ...copy,
          ...edit,
          "-",
          selectLayer,
          ...order,
          "-",
          { label: "Blok ekle", onSelect: () => select({ kind: "group", groupId: actions.addGroup(t.sectionId) }, { scroll: true }) },
          "-",
          ...view,
        ];
      case "divider":
        return [...edit, "-", selectLayer, ...order];
      case "meta":
        return [selectLayer];
      default:
        // The page, or nothing under the pointer.
        return [
          ...undoEntries(),
          "-",
          paste,
          "-",
          { label: "Bölüm ekle", onSelect: () => select({ kind: "section", sectionId: actions.addSection() }, { scroll: true }) },
          { label: "Ayırıcı ekle", onSelect: () => actions.addDivider() },
        ];
    }
  }

  /** The menu of the Bileşenler page's selection: a component, a set, a variant, a layer of one. */
  function mainMenu(at: MainSelection): MenuEntry[] {
    const component = components.find((c) => c.id === at.componentId);
    if (!component) return [];
    const rename: ContextMenuItem = { label: "Yeniden adlandır", shortcut: keys("mod", "r"), onSelect: () => renameLayer({ kind: "component", ...at }) };
    const inSet = isVariant(component, components);
    if (at.layerId) {
      const layer = findLayer(component, at.layerId);
      const repeated = layer?.kind === "instance" ? layerComponent(layer, components) : null;
      const drawn = layer ? isDrawing(layer) : false;
      return [
        { label: inSet ? "Varyantı seç" : "Ana bileşeni seç", hint: variantName(component), onSelect: () => select({ kind: "component", componentId: component.id }) },
        ...(repeated ? [{ label: "Ana bileşene git", hint: variantName(repeated), onSelect: () => goToMain(repeated.id) }] : []),
        "-",
        ...(drawn
          ? [
              { label: "Çoğalt", shortcut: keys("mod", "d"), onSelect: () => duplicateOnCanvas(at) },
              { label: "Sil", shortcut: keys("backspace"), onSelect: () => deleteOnCanvas.current({ kind: "component", ...at }) },
            ]
          : []),
        rename,
      ];
    }
    const starting = system.isStartingComponent(component.id);
    if (at.set) {
      return [
        { label: "Varyant ekle", onSelect: () => addVariantToSet(component.id) },
        { label: "Özellik ekle", onSelect: () => storeVariants(withNewProperty(variantsOf(component.id, components))) },
        { label: "Çoğalt", shortcut: keys("mod", "d"), onSelect: () => duplicateMain(at) },
        "-",
        rename,
        "-",
        { label: starting ? "Varyantları kaldır" : "Bileşen setini sil", onSelect: () => removeSet(component.id) },
      ];
    }
    if (inSet) {
      return [
        { label: "Çoğalt", hint: "yeni varyant", shortcut: keys("mod", "d"), onSelect: () => addVariant(component.id) },
        { label: "Bileşen setini seç", hint: component.name, onSelect: () => select({ kind: "component", componentId: setIdOf(component), set: true }) },
        "-",
        rename,
        "-",
        { label: starting ? "Sitenin görünüşüne dön" : "Varyantı sil", onSelect: () => removeMain(component) },
      ];
    }
    return [
      { label: "Varyant ekle", onSelect: () => addVariant(component.id) },
      { label: "Çoğalt", shortcut: keys("mod", "d"), onSelect: () => duplicateMain(at) },
      "-",
      rename,
      "-",
      { label: starting ? "Sitenin görünüşüne dön" : "Bileşeni sil", onSelect: () => removeMain(component) },
    ];
  }

  /** The menu of something drawn on the Bileşenler page, or of a layer of it. */
  function nodeMenu(at: NodeSelection): MenuEntry[] {
    const node = nodes.find((n) => n.id === at.nodeId);
    const layer = node ? nodeLayer(node, at.layerId) : null;
    if (!node || !layer) return [];
    const top = layer.id === node.id;
    return [
      ...(top
        ? [{ label: "Bileşen oluştur", shortcut: keys("alt", "mod", "k"), onSelect: () => componentFromNode(node.id) }]
        : [{ label: "Üst katmanı seç", hint: layerLabel(node), onSelect: () => select({ kind: "node", nodeId: node.id }) }]),
      "-",
      { label: "Çoğalt", shortcut: keys("mod", "d"), onSelect: () => duplicateOnCanvas(at) },
      { label: "Sil", shortcut: keys("backspace"), onSelect: () => deleteOnCanvas.current({ kind: "node", ...at }) },
      "-",
      ...(layer.kind === "frame" || layer.kind === "shape"
        ? [{ label: layer.hidden ? "Göster" : "Gizle", shortcut: keys("shift", "mod", "h"), onSelect: () => toggleNodeHidden(at) }]
        : []),
      { label: "Yeniden adlandır", shortcut: keys("mod", "r"), onSelect: () => renameLayer({ kind: "node", ...at }) },
    ];
  }

  /** Figma's main menu (the navigation bar's top): the file, adding, the modes, the theme, the UI. */
  const shellMenu = (): MenuEntry[] => [
    { label: "Projeler", hint: "listeye dön", onSelect: () => router.push("/admin/projects") },
    "-",
    ...undoEntries(),
    "-",
    { label: "Ekle…", hint: "bölüm, bileşen, ayırıcı", onSelect: onAdd },
    { label: "Şablonu yükle", onSelect: () => { if (window.confirm("Sayfanın mevcut içeriği şablonla değiştirilecek. Devam edilsin mi?")) onLoadTemplate(); } },
    "-",
    { label: "Blok Düzenleyici", hint: "Dev Mode", shortcut: keys("shift", "d"), onSelect: onSwitchToForm },
    { label: "Yayında görüntüle", disabled: !isPublished, onSelect: () => window.open(`/projects/${slug}`, "_blank") },
    "-",
    { label: theme === "dark" ? "Açık tema" : "Koyu tema", onSelect: toggleTheme },
    { label: minimized ? "Panelleri göster" : "Panelleri gizle", shortcut: keys("shift", "mod", "\\"), onSelect: () => setMinimized((m) => !m) },
  ];
  /** Opens a menu under a button of the chrome. */
  function openMenuUnder(el: HTMLElement, entries: MenuEntry[], align: "left" | "right" = "left") {
    const r = el.getBoundingClientRect();
    setMenu({ x: align === "left" ? r.left : r.right - 200, y: r.bottom + 4, entries });
  }
  /** The Bileşenler canvas's zoom, as Figma's zoom menu in the design panel's top. */
  const zoomMenu = (): MenuEntry[] => {
    const z = zoomActions.current;
    const to = (zoom: number) => () => (z ? z.zoomTo(zoom) : setView((v) => zoomAround(v, zoom, { x: 400, y: 300 })));
    return [
      { label: "Yakınlaştır", shortcut: keys("mod", "+"), onSelect: to(view.zoom * 2) },
      { label: "Uzaklaştır", shortcut: keys("mod", "-"), onSelect: to(view.zoom / 2) },
      "-",
      { label: "Hepsini sığdır", shortcut: keys("shift", "1"), disabled: !z, onSelect: () => z?.fitAll() },
      { label: "Seçime yakınlaştır", shortcut: keys("shift", "2"), disabled: !z || !canvasSelection, onSelect: () => z?.fitSelection() },
      "-",
      { label: "%50", onSelect: to(0.5) },
      { label: "%100", shortcut: keys("shift", "0"), onSelect: to(1) },
      { label: "%200", onSelect: to(2) },
    ];
  };

  /** Undo and redo, as the menus offer them — greyed when there is no step. */
  function undoEntries(): MenuEntry[] {
    const { undo, redo } = history.counts();
    return [
      { label: "Geri al", shortcut: keys("mod", "z"), disabled: undo === 0, onSelect: () => history.undo() },
      { label: "Yinele", shortcut: keys("shift", "mod", "z"), disabled: redo === 0, onSelect: () => history.redo() },
    ];
  }

  /** The Bileşenler page's canvas itself: undo, and its tools. */
  const canvasMenu = (): MenuEntry[] => [
    ...undoEntries(),
    "-",
    { label: "Çerçeve çiz", shortcut: "F", onSelect: () => setTool("frame") },
    { label: "Dikdörtgen çiz", shortcut: "R", onSelect: () => setTool("rectangle") },
    { label: "Elips çiz", shortcut: "O", onSelect: () => setTool("ellipse") },
    { label: "Metin yaz", shortcut: "T", onSelect: () => setTool("text") },
  ];

  /** The menu of a selection on the Bileşenler page. */
  const canvasSelectionMenu = (at: CanvasSelection | null) => (!at ? canvasMenu() : isNodeSelection(at) ? nodeMenu(at) : mainMenu(at));

  /** Opens the menu at the pointer (the browser's own stays shut). */
  function openMenu(e: React.MouseEvent, entries: MenuEntry[]) {
    e.preventDefault();
    if (entries.length) setMenu({ x: e.clientX, y: e.clientY, entries });
  }

  // Figma's keys for the selection: ⌘C / ⌘V copy and paste it, ⌘D duplicates, ⇧⌘H hides, ⌘R renames — never while typing.
  const shortcut = useRef<(e: KeyboardEvent) => boolean>(() => false);
  useEffect(() => {
    shortcut.current = (e) => {
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return false;
      if (menu || styleEditor || variablesOpen || picker || reordering) return false;
      const key = e.key.toLowerCase();
      const mod = e.metaKey || e.ctrlKey;
      if (page === "components") {
        const at = canvasSelection;
        // The arrows (their nudge, held or not) are the canvas's own, not this — it only minds ⌘'s.
        if (!at) return false;
        if (!mod || e.repeat) return false;
        if (e.altKey && e.code === "KeyK" && isNodeSelection(at) && (!at.layerId || at.layerId === at.nodeId)) componentFromNode(at.nodeId);
        else if (e.altKey) return false;
        else if (key === "d" && !e.shiftKey) duplicateOnCanvas(at);
        else if (key === "r" && !e.shiftKey) renameLayer(selection);
        else if (key === "h" && e.shiftKey && isNodeSelection(at)) toggleNodeHidden(at);
        else return false;
        return true;
      }
      if (!mod || e.altKey || e.repeat) return false;
      const t = picked;
      if (key === "c" && !e.shiftKey) {
        // Text selected on the page (or in a panel) is copied as text.
        if (!canCopy(t) || window.getSelection()?.toString()) return false;
        copyLayer(t);
      } else if (key === "v" && !e.shiftKey) {
        if (!clip) return false;
        pasteAt(t);
      } else if (key === "d" && !e.shiftKey) {
        if (!canDuplicate(t)) return false;
        duplicateLayer(t);
      } else if (key === "h" && e.shiftKey) {
        if (isHidden(t) === null) return false;
        toggleHidden(t);
      } else if (key === "r" && !e.shiftKey) {
        if (!canRename(t)) return false;
        renameLayer(t);
      } else return false;
      return true;
    };
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (shortcut.current(e)) e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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
  /** Where a text style is: this page's texts in it, and the components' text layers — each selected where it is. */
  function styleUses(styleId: string): DesignUse[] {
    // An instance's own texts in it: its main component's text layers, in the style — or in its own.
    const inStyle = (b: Block) => {
      const main = mainComponent(b.type, components, b.component);
      return Boolean(main && textLayersOf(main).some((layer) => (b.styles?.[layer.field] ?? layer.style) === styleId));
    };
    const onPage = sectionsOf(project.items).flatMap((section, index) =>
      sectionBlocks(section)
        .filter(inStyle)
        .map((b) => ({
          key: b.id,
          icon: fi("16.text"),
          tone: FRAME_TONE,
          label: blockName(b),
          detail: sectionName(section, index),
          onSelect: () => {
            setStyleEditor(null);
            select({ kind: "block", blockId: b.id }, { scroll: true });
          },
        }))
    );
    return [...onPage, ...(textStyleUses(components).get(styleId) ?? []).map(({ component, layer }) => ({
      key: `${component.id}:${layer.id}`,
      icon: fi("16.text"),
      tone: FRAME_TONE,
      label: layer.name,
      detail: component.name,
      onSelect: () => {
        setStyleEditor(null);
        goToMain(component.id, layer.id);
      },
    }))];
  }
  /** Opens a text style's popover beside the design panel, at `under`'s height. */
  function openStyle(id: string, under: Element) {
    const top = under.getBoundingClientRect().top;
    // Beside the panel it was opened from: the design panel's left, or the rail's panel's right (the popover sits on the anchor's left).
    const leftPanel = under.closest("[data-left-panel]")?.getBoundingClientRect();
    const left = leftPanel ? leftPanel.right + 296 : document.querySelector("[data-design-panel]")?.getBoundingClientRect().left ?? under.getBoundingClientRect().left;
    setStyleEditor({ id, anchor: { top, left } });
  }

  /** What a page component's main shows: an instance's content on this page, else samples. */
  const sampleBlock = useCallback((type: BlockType): Block => {
    const own = sectionsOf(project.items).flatMap(sectionBlocks).find((b) => b.type === type && hasSampleContent(b));
    return own ? localizeBlock(own, lang) : { id: `sample-${type}`, type, ...createCaseStudyBlockDefaults(type), ...SAMPLE_BLOCKS[type] };
  }, [project.items, lang]);

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
    const own = resolveItem(item, entry, instance.knownStyle);
    header = {
      icon: fi("16.text"),
      tone: FRAME_TONE,
      title: layer.name,
      menu: [
        ...holders({ section, group, block, itemId: entry.id }),
        { label: "Ana bileşene git", hint: variantName(own.component), divided: true, onSelect: () => goToMain(own.component.id, layer.id) },
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
      // The variant it is (see BlockEntry.component), its overrides measured against it.
      const own = resolveItem(item, entry, instance.knownStyle);
      const overridden = itemHasOverrides(entry);
      const setLayout = (next: GridSettings) => setItemOverrides(block, itemId, { layout: layoutOverride(own.base.layout, next) });
      const setLook = (next: FrameLook) => setItemOverrides(block, itemId, { look: lookOverride(own.base.look, next) });
      header = {
        icon: fi("16.instance"),
        tone: COMPONENT_TONE,
        title: own.component.name,
        menu: [
          ...holders({ section, group, block }),
          { label: "Ana bileşene git", hint: variantName(own.component), divided: true, onSelect: () => goToMain(own.component.id) },
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
          <InstanceGroup
            name={own.component.name}
            properties={instanceProperties(own.component)}
            onProperty={(name, value) => setEntryVariant(block, itemId, pickVariant(own.component, name, value, item.variants.map((v) => v.component)).id)}
            onGoToMain={() => goToMain(own.component.id)}
            overridden={overridden}
            onReset={() => setItemOverrides(block, itemId, null)}
          />
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
      title: instance ? instance.main.name : BLOCK_LABELS[block.type],
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
              // A set once (its first variant); its properties pick the others.
              swaps={swapsFor(block.type, components).map((c) => {
                const count = variantsOf(c.id, components).length;
                return { id: c.id, name: c.name, hint: count > 1 ? `${count} varyant` : undefined };
              })}
              current={setIdOf(instance.main)}
              onSwap={(id) => update({ component: id })}
              properties={instanceProperties(instance.main)}
              onProperty={(name, value) => update({ component: pickVariant(instance.main, name, value, variantsOf(setIdOf(instance.main), components)).id })}
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
        {instance && (
          <InstanceTextsGroup
            texts={textLayersOf(instance.main).map((layer) => ({ layer, styleId: block.styles?.[layer.field] ?? layer.style, overridden: Boolean(block.styles?.[layer.field]) }))}
            styles={textStyles}
            variables={variables}
            onStyle={(layer, id) => {
              const styles = { ...block.styles, [layer.field]: id === layer.style ? undefined : id };
              update({ styles: Object.values(styles).some(Boolean) ? styles : undefined });
            }}
            onEditStyle={openStyle}
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
  } else if (selectedNode && selectedNodeLayer && selection.kind === "node") {
    // On the Bileşenler page: something drawn on its own — or a layer of it.
    const node = selectedNode;
    const layer = selectedNodeLayer;
    const top = layer.id === node.id;
    const at: NodeSelection = { nodeId: node.id, layerId: top ? undefined : layer.id };
    const measure = nodeSelector(at);
    const change = (next: ComponentLayer) => setNodeLayer(node.id, layer.id, () => next);
    header = {
      icon: layerIconOf(layer),
      tone: FRAME_TONE,
      title: layerLabel(layer),
      menu: top ? undefined : [{ label: layerLabel(node), hint: "Üst katman", onSelect: () => select({ kind: "node", nodeId: node.id }) }],
    };
    inspectorActions = (
      <>
        {top && <LayerButton label="Bileşen oluştur (⌥⌘K)" onClick={() => componentFromNode(node.id)}>{fi("component.small", undefined, "-m-1.5 shrink-0")}</LayerButton>}
        <LayerButton label="Çoğalt" onClick={() => duplicateOnCanvas(at)}>{Icons.duplicate}</LayerButton>
        <LayerButton label="Sil" onClick={() => deleteOnCanvas.current({ kind: "node", ...at })}>{Icons.trash}</LayerButton>
      </>
    );
    content = (
      <div className="flex flex-col">
        {top && <PositionGroup x={node.canvas.x} y={node.canvas.y} onChange={(place) => moveOnCanvas({ nodeId: node.id }, place)} />}
        {layer.kind === "frame" ? (
          <FrameLayerInspector frame={layer} variables={variables} measure={measure} onChange={change} />
        ) : layer.kind === "shape" ? (
          <ShapeInspector layer={layer} measure={measure} variables={variables} onChange={change} />
        ) : layer.kind === "static-text" ? (
          <StaticTextInspector layer={layer} measure={measure} styles={textStyles} variables={variables} onChange={change} onEditStyle={openStyle} />
        ) : null}
      </div>
    );
  } else if (selectedMain && (selectedMainLayer?.kind === "shape" || selectedMainLayer?.kind === "static-text")) {
    // …a shape or a text of its own drawn into a main component.
    const main = selectedMain;
    const layer = selectedMainLayer;
    const measure = mainSelector({ componentId: main.id, layerId: layer.id }, components);
    const change = (next: ComponentLayer) => system.setComponent(updateLayer(main, layer.id, () => next));
    const at: MainSelection = { componentId: main.id, layerId: layer.id };
    header = { icon: layerIconOf(layer), tone: FRAME_TONE, title: layerLabel(layer), menu: [mainHolder(main)] };
    inspectorActions = (
      <>
        <LayerButton label="Çoğalt" onClick={() => duplicateOnCanvas(at)}>{Icons.duplicate}</LayerButton>
        <LayerButton label="Sil" onClick={() => deleteOnCanvas.current({ kind: "component", ...at })}>{Icons.trash}</LayerButton>
      </>
    );
    content =
      layer.kind === "shape" ? (
        <ShapeInspector layer={layer} measure={measure} variables={variables} onChange={change} />
      ) : (
        <StaticTextInspector
          layer={layer}
          measure={measure}
          styles={textStyles}
          variables={variables}
          // Figma's text property: the text shows one of its instances' texts instead.
          bind={{
            page: Boolean(main.type),
            onBind: (field) => {
              const bound: TextLayer = { kind: "text", id: layer.id, name: layer.name || layerLabel(layer), field, style: layer.style, textAlign: layer.textAlign, opacity: layer.opacity, size: layer.size, align: layer.align };
              change(bound);
            },
          }}
          onChange={change}
          onEditStyle={openStyle}
        />
      );
  } else if (selectedMain && selectedMainLayer?.kind === "text") {
    // On the Bileşenler page: a text of a main component.
    const main = selectedMain;
    const layer = selectedMainLayer;
    header = { icon: fi("16.text"), tone: FRAME_TONE, title: layer.name, menu: [mainHolder(main)] };
    content = (
      <ComponentTextInspector
        layer={layer}
        measure={mainSelector({ componentId: main.id, layerId: layer.id }, components)}
        styles={textStyles}
        variables={variables}
        onChange={(next) => system.setComponent(updateLayer(main, next.id, () => next))}
        onEditStyle={openStyle}
      />
    );
  } else if (selectedMain && selectedMainLayer?.kind === "frame") {
    // …a frame inside one.
    const main = selectedMain;
    const frame = selectedMainLayer;
    header = { icon: frameIcon(frame.layout), tone: FRAME_TONE, title: frame.name, menu: [mainHolder(main)] };
    content = (
      <FrameLayerInspector
        frame={frame}
        variables={variables}
        measure={mainSelector({ componentId: main.id, layerId: frame.id }, components)}
        onChange={(next) => system.setComponent(updateLayer(main, next.id, () => next))}
      />
    );
  } else if (selectedMain && selectedMainLayer?.kind === "part") {
    // …a part the site's code draws.
    const main = selectedMain;
    const part = selectedMainLayer;
    header = { icon: fi("16.instance"), tone: COMPONENT_TONE, title: part.name, menu: [mainHolder(main)] };
    content = (
      <PartLayerInspector
        layer={part}
        measure={mainSelector({ componentId: main.id, layerId: part.id }, components)}
        onChange={(next) => system.setComponent(updateLayer(main, next.id, () => next))}
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
        mainHolder(main),
        { label: "Ana bileşene git", hint: repeated.name, divided: true, onSelect: () => goToMain(repeated.id) },
      ],
    };
    inspectorActions = <LayerButton label="Ana bileşene git" onClick={() => goToMain(repeated.id)}>{Icons.goTo}</LayerButton>;
    content = (
      <InstanceLayerInspector
        layer={layer}
        component={repeated}
        // A set once (its first variant); its properties pick the others. Never the component's own set.
        swaps={topComponents(components).filter((c) => (main.type ? fitsItems(c, main.type) : !c.type && c.id !== setIdOf(main)))}
        current={setIdOf(repeated)}
        properties={instanceProperties(repeated)}
        onProperty={(name, value) =>
          system.setComponent(updateLayer(main, layer.id, () => ({ ...layer, component: pickVariant(repeated, name, value, variantsOf(setIdOf(repeated), components)).id })))
        }
        measure={mainSelector({ componentId: main.id, layerId: layer.id }, components)}
        onChange={(next) => system.setComponent(updateLayer(main, next.id, () => next))}
        onGoToMain={goToMain}
      />
    );
  } else if (selectedMain && selectedSet) {
    // …a component set: its properties and variants.
    const main = selectedMain;
    const variants = selectedSet;
    const starting = system.isStartingComponent(main.id);
    header = { icon: fi("16.component"), tone: COMPONENT_TONE, title: main.name };
    inspectorActions = (
      <>
        <LayerButton label="Varyant ekle" onClick={() => addVariantToSet(main.id)}>{Icons.plus}</LayerButton>
        <LayerButton label="Bileşen setini çoğalt" onClick={() => duplicateMain({ componentId: main.id, set: true })}>{Icons.duplicate}</LayerButton>
        <LayerButton label={starting ? "Varyantları kaldır" : "Bileşen setini sil"} onClick={() => removeSet(main.id)}>{starting ? Icons.reset : Icons.trash}</LayerButton>
      </>
    );
    content = (
      <ComponentSetInspector
        name={main.name}
        kind={main.type ? "Sayfa bileşeni seti" : "İç bileşen seti — başka bileşenlerin öğesi"}
        variants={variants}
        properties={variantProperties(variants)}
        placement={<PositionGroup {...(places.get(main.id) ?? { x: 0, y: 0 })} onChange={(place) => moveOnCanvas({ componentId: main.id }, place)} />}
        frame={
          // The set is a frame too: how it lays out its variants, and its look.
          <>
            <GridFields
              grid={setLayoutOf(main)}
              measure={`[data-component-set="${main.id}"] > [data-set-frame]`}
              cells={layoutCells(variants.map(() => ({})), gridColumns(setLayoutOf(main)).length, gridRows(setLayoutOf(main)))}
              onAlign={(justify, align) => system.setComponent({ ...main, setFrame: { ...main.setFrame, layout: { ...setLayoutOf(main), justify, align } } })}
              onChange={(layout) => system.setComponent({ ...main, setFrame: { ...main.setFrame, layout } })}
              clip={clipOf(main.setFrame?.look, (look) => system.setComponent({ ...main, setFrame: { ...main.setFrame, look } }))}
            />
            <LookFields look={main.setFrame?.look} variables={variables} onChange={(look) => system.setComponent({ ...main, setFrame: { ...main.setFrame, look } })} />
          </>
        }
        uses={setUses(variants)}
        onRename={(name) => storeVariants(withSetName(variants, name))}
        onAddProperty={() => storeVariants(withNewProperty(variants))}
        onRenameProperty={(from, to) => storeVariants(withPropertyRenamed(variants, from, to))}
        onRemoveProperty={(name) => storeVariants(withoutProperty(variants, name))}
        onRenameValue={(property, from, to) => storeVariants(withValueRenamed(variants, property, from, to))}
        onAddVariant={() => addVariantToSet(main.id)}
        onSelectVariant={(id) => select({ kind: "component", componentId: id }, { scroll: true })}
      />
    );
  } else if (selectedMain) {
    // …a main component — or a variant of a set, told apart by its values.
    const main = selectedMain;
    const inSet = isVariant(main, components);
    const variants = inSet ? variantsOf(setIdOf(main), components) : [];
    const properties = variantProperties(variants);
    const starting = system.isStartingComponent(main.id);
    const selectSet = () => select({ kind: "component", componentId: setIdOf(main), set: true });
    header = {
      icon: fi("16.component"),
      tone: COMPONENT_TONE,
      title: variantName(main),
      menu: inSet ? [{ label: main.name, hint: "Bileşen seti", onSelect: selectSet }] : undefined,
    };
    inspectorActions = (
      <>
        {inSet ? (
          <LayerButton label="Varyantı çoğalt" onClick={() => addVariant(main.id)}>{Icons.duplicate}</LayerButton>
        ) : (
          <>
            <LayerButton label="Varyant ekle" onClick={() => addVariant(main.id)}>{Icons.plus}</LayerButton>
            <LayerButton label="Çoğalt" onClick={() => duplicateMain({ componentId: main.id })}>{Icons.duplicate}</LayerButton>
          </>
        )}
        {starting ? (
          <LayerButton label="Sitenin görünüşüne dön" onClick={() => removeMain(main)}>{Icons.reset}</LayerButton>
        ) : (
          <LayerButton label={inSet ? "Varyantı sil" : "Bileşeni sil"} onClick={() => removeMain(main)}>{Icons.trash}</LayerButton>
        )}
      </>
    );
    content = (
      <ComponentInspector
        component={main}
        variables={variables}
        measure={mainFrameSelector(main)}
        kind={main.type ? "Sayfa bileşeni" : "İç bileşen — başka bileşenlerin öğesi"}
        identity={
          inSet ? (
            <VariantGroup
              setName={main.name}
              variant={main}
              properties={properties}
              conflict={variants.some((o) => o.id !== main.id && sameValues(o, main, properties))}
              onValue={(property, value) => system.setComponent({ ...main, variant: withVariantValue(main.variant, property, value) })}
              onSelectSet={selectSet}
            />
          ) : undefined
        }
        placement={!inSet ? <PositionGroup {...(places.get(main.id) ?? { x: 0, y: 0 })} onChange={(place) => moveOnCanvas({ componentId: main.id }, place)} /> : undefined}
        // Its W / H on the canvas, as a frame's: Fixed W, Fixed or Hug H.
        size={{ width: "fixed", widthPx: canvasWidth(main), height: main.canvas?.height ? "fixed" : "hug", heightPx: main.canvas?.height }}
        onSize={(size) => sizeComponent(main, { width: size.widthPx, height: size.height === "fixed" ? size.heightPx ?? null : null })}
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

  // ── The Prototip tab (Figma's Prototype panel): a variant's interactions, the preview ──
  let prototypeContent: ReactNode;
  if (selectedMain && !selectedMainLayer && isVariant(selectedMain, components)) {
    const set = variantsOf(setIdOf(selectedMain), components);
    const first = set[0] ?? selectedMain;
    prototypeContent = selectedSet ? (
      <PreviewGroup
        note="Etkileşimler varyantlarda: birini seç, ya da kanvasta varyantın sağındaki mavi noktayı başka bir varyanta sürükle."
        onPreview={() => setPreviewing(first.id)}
      />
    ) : (
      <PrototypePanel
        variant={selectedMain}
        variants={set}
        onChange={(interactions) => system.setComponent({ ...selectedMain, interactions: interactions.length ? interactions : undefined })}
        onAdd={() => {
          const others = set.filter((v) => v.id !== selectedMain.id);
          const target = others[0] ?? selectedMain;
          system.setComponent({ ...selectedMain, interactions: [...(selectedMain.interactions ?? []), newInteraction(uid(), target.id)] });
        }}
        onPreview={() => setPreviewing(selectedMain.id)}
      />
    );
  } else if (selectedMain && !selectedMainLayer) {
    const main = selectedMain;
    prototypeContent = (
      <PanelGroup title="Etkileşimler">
        <p className="text-[11px] leading-4 text-[var(--text-subtitle)]">
          Figma&apos;daki gibi etkileşimler bir bileşen setinin varyantları arasında kurulur: tıklayınca, üzerine gelince, basılıyken ya da bir süre sonra başka bir varyanta dönüşür — animasyonla.
        </p>
        <FieldRow wide>
          <button
            type="button"
            onClick={() => addVariant(main.id)}
            className="flex items-center justify-center gap-1.5 h-7 rounded-[6px] bg-[var(--bg-4)] text-[12px] font-medium text-[var(--text-title)] hover:bg-[var(--bg-5)] transition-colors cursor-pointer"
          >
            {Icons.plus} Varyant ekle
          </button>
        </FieldRow>
      </PanelGroup>
    );
    // Its items may play theirs (a set's variants it repeats): the preview shows them.
    prototypeContent = (
      <>
        {prototypeContent}
        <PreviewGroup onPreview={() => setPreviewing(main.id)} />
      </>
    );
  } else {
    prototypeContent = (
      <p className="px-4 py-3 text-[11px] leading-4 text-[var(--text-subtitle)]">
        Prototip, Bileşenler sayfasında kurulur: bir bileşen setinin varyantını seç, sağındaki mavi noktayı başka bir varyanta sürükle — ya da buradan &quot;+&quot; ile ekle. Sitede her örnek bu etkileşimleri oynatır.
      </p>
    );
  }
  /** Connected on the canvas (Prototype mode): `from` changes to `to` on a click — only between variants of one set, as Figma's. */
  function connectVariants(fromId: string, toId: string | null, at: { x: number; y: number }) {
    const from = components.find((c) => c.id === fromId);
    const to = toId ? components.find((c) => c.id === toId) : null;
    if (!from || !to || to.id === from.id) return;
    if (!isVariant(from, components) || setIdOf(from) !== setIdOf(to)) {
      setMenu({ x: at.x, y: at.y, entries: [{ label: "Yalnızca aynı setin varyantları birbirine bağlanır", disabled: true }] });
      return;
    }
    system.setComponent({ ...from, interactions: [...(from.interactions ?? []), newInteraction(uid(), to.id)] });
    select({ kind: "component", componentId: from.id });
  }
  const previewed = previewing ? components.find((c) => c.id === previewing) ?? null : null;
  /** A component used inside others: the page component repeating its set (its items give it its texts). */
  const holderTypeOf = (component: DesignComponent) =>
    components.find((c) => {
      const repeated = c.type ? findRepeat(c)?.layer.component : undefined;
      const other = repeated ? components.find((o) => o.id === repeated) : undefined;
      return other ? setIdOf(other) === setIdOf(component) : false;
    })?.type;

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
      <div
        className="relative flex h-full min-h-0 text-[11px] leading-4 text-[var(--text-title)]"
        // Figma's colours and its 11px Inter, for the chrome.
        style={{ ...FIGMA_TOKENS[theme], fontFamily: "var(--font-inter), Inter, ui-sans-serif, system-ui, sans-serif" }}
      >
        {/* ── The navigation bar (A), as Figma's: the menu, then the tabs with their labels; the file's other panels at its bottom ── */}
        {!minimized && (
        <nav aria-label="Gezinme çubuğu" className="w-12 shrink-0 h-full flex flex-col items-center border-r border-[var(--border)] bg-[var(--bg-1)] z-20 select-none">
          <button
            type="button"
            aria-label="Ana menü"
            aria-haspopup="menu"
            onClick={(e) => openMenuUnder(e.currentTarget, shellMenu())}
            className="flex items-center justify-center gap-0.5 w-12 h-12 text-[var(--text-title)] hover:bg-[var(--bg-4)] transition-colors cursor-pointer"
          >
            {Chrome.menu}
            <span className="text-[var(--text-subtitle)]">{Chrome.chevron}</span>
          </button>
          {NAV.slice(0, 3).map((tab) => (
            <NavTab key={tab.id} icon={tab.icon} label={tab.label} active={leftTab === tab.id} onClick={() => setLeftTab(tab.id)} />
          ))}
          <div className="mt-auto flex flex-col items-center pb-1">
            {NAV.slice(3).map((tab) => (
              <NavTab key={tab.id} icon={tab.icon} label={tab.label} active={leftTab === tab.id} onClick={() => setLeftTab(tab.id)} />
            ))}
          </div>
        </nav>
        )}

        {/* ── The left sidebar (B): the file — its pages and layers — or what the navigation bar opened ── */}
        {!minimized && (
        <aside data-left-panel="" aria-label={NAV.find((t) => t.id === leftTab)?.label} className="w-[240px] shrink-0 h-full flex flex-col border-r border-[var(--border)] bg-[var(--bg-1)] z-10">
          {leftTab === "file" ? (
            <div className="shrink-0 flex items-center gap-1 h-12 pl-4 pr-2 border-b border-[var(--border)]">
              <div className="min-w-0 flex-1 flex flex-col">
                <button
                  type="button"
                  aria-haspopup="menu"
                  onClick={(e) => openMenuUnder(e.currentTarget, shellMenu())}
                  className="flex items-center gap-1 min-w-0 text-left cursor-pointer"
                >
                  <span className="min-w-0 truncate font-semibold text-[var(--text-title)]">{project.title?.trim() || slug}</span>
                  <span className="shrink-0 text-[var(--text-subtitle)]">{Chrome.chevron}</span>
                </button>
                <span className="truncate text-[var(--text-subtitle)]">Proje · /{slug}</span>
              </div>
              <LayerButton label="Panelleri gizle (⇧⌘\\)" onClick={() => setMinimized(true)}>{Chrome.minimize}</LayerButton>
            </div>
          ) : (
            <div className="shrink-0 flex items-center justify-between gap-2 h-12 pl-4 pr-2 border-b border-[var(--border)]">
              <h2 className="min-w-0 truncate text-[11px] font-semibold leading-4 text-[var(--text-title)] select-none">{NAV.find((t) => t.id === leftTab)?.label}</h2>
              <div className="flex items-center gap-0.5 shrink-0">
                {leftTab === "variables" && <LayerButton label="Değişkenleri tabloda aç" onClick={() => setVariablesOpen(true)}>{Icons.external}</LayerButton>}
                {leftTab === "styles" && (
                  <LayerButton
                    label="Metin stili oluştur"
                    onClick={() => {
                      const id = system.addTextStyle();
                      const panel = document.querySelector("[data-left-panel]")?.getBoundingClientRect();
                      setStyleEditor({ id, anchor: { top: 120, left: (panel?.right ?? 320) + 296 } });
                    }}
                  >
                    {Icons.plus}
                  </LayerButton>
                )}
                {leftTab === "theme" && project.theme && <LayerButton label="Varsayılana dön" onClick={() => actions.updateMeta({ theme: undefined })}>{Icons.reset}</LayerButton>}
              </div>
            </div>
          )}

          {leftTab === "file" && (
            <>
              <section aria-label="Sayfalar" className="shrink-0 flex flex-col pb-2 border-b border-[var(--border)]">
                <h3 className="h-10 flex items-center px-4 text-[11px] font-semibold text-[var(--text-title)] select-none">Sayfalar</h3>
                <PageRow label="Proje sayfası" active={page === "project"} onClick={() => showPage("project")} />
                <PageRow label="Bileşenler" active={page === "components"} onClick={() => showPage("components")} />
                <PageRow label="Çalışma Alanı" active={page === "workspace"} onClick={() => showPage("workspace")} />
              </section>
              <div className="shrink-0 flex items-center justify-between h-10 pl-4 pr-2">
                <h3 className="text-[11px] font-semibold text-[var(--text-title)] select-none">Katmanlar</h3>
                {page === "project" && (
                  <LayerButton label={allLayersCollapsed ? "Katmanları aç" : "Katmanları daralt"} onClick={() => toggleAllLayers(!allLayersCollapsed)}>
                    {allLayersCollapsed ? Icons.expandLayers : Icons.collapseLayers}
                  </LayerButton>
                )}
                {page === "components" && openMains.size > 0 && (
                  <LayerButton label="Katmanları daralt" onClick={() => setOpenMains(new Set())}>{Icons.collapseLayers}</LayerButton>
                )}
              </div>
              {/* The site's own scrollbar; the layer tree runs almost edge to edge (4px), as in Figma. */}
              <ScrollArea className="flex-1 min-h-0" viewportClassName="h-full overflow-x-hidden flex flex-col gap-3 px-2 pb-4" inset={8} edge={2}>
                {page === "workspace" ? (
                  <ComponentLayers
                    components={[]}
                    nodes={workspaceNodes}
                    selection={workspaceSelection}
                    open={openMains}
                    onToggle={toggleMain}
                    onSelect={setWorkspaceSelection}
                    onRename={(at, name) => isNodeSelection(at) && renameWorkspaceNode(at, name)}
                    onAddVariant={() => {}}
                    onToggleHidden={(at) => isNodeSelection(at) && toggleWorkspaceNodeHidden(at)}
                    onContextMenu={(at) => setWorkspaceSelection(at)}
                  />
                ) : page === "project" ? (
                  <OpenComponentsContext.Provider value={openComponentsContext}>
                    <LayersPanel
                      project={project}
                      selection={selection}
                      collapsed={collapsedLayers}
                      onToggle={toggleLayer}
                      actions={actions}
                      onSelect={selectFromPanel}
                      onAddBlock={openPickerFor}
                      onContextMenu={onLayerContextMenu}
                    />
                  </OpenComponentsContext.Provider>
                ) : (
                  <ComponentLayers
                    components={components}
                    nodes={nodes}
                    selection={canvasSelection}
                    open={openMains}
                    onToggle={toggleMain}
                    onSelect={(next) => select(fromCanvas(next), { scroll: true })}
                    onRename={(at, name) => (isNodeSelection(at) ? renameNode(at, name) : renameMain(at, name))}
                    onAddVariant={addVariantToSet}
                    onToggleHidden={toggleNodeHidden}
                    onContextMenu={(at, e) => {
                      select(fromCanvas(at));
                      openMenu(e, canvasSelectionMenu(at));
                    }}
                  />
                )}
              </ScrollArea>
            </>
          )}
          {leftTab !== "file" && (
            <ScrollArea className="flex-1 min-h-0" viewportClassName={cn("h-full overflow-x-hidden flex flex-col", leftTab === "assets" ? "px-1 py-3" : "")} inset={8} edge={2}>
              {leftTab === "assets" && <AssetsPanel components={components} target={catalogTarget} onAdd={addFromCatalog} onGoToMain={(id) => goToMain(id)} />}
              {leftTab === "variables" && (
                <VariablesPanel
                  variables={variables}
                  onOpen={() => setVariablesOpen(true)}
                  onAdd={(kind) => {
                    system.addVariable(kind);
                    setVariablesOpen(true);
                  }}
                />
              )}
              {leftTab === "styles" && <TextStylesPanel textStyles={textStyles} variables={variables} onEdit={openStyle} />}
              {leftTab === "theme" && (
                <PanelGroup title="Proje teması">
                  <ThemeFields theme={project.theme} onChange={(theme) => actions.updateMeta({ theme })} />
                </PanelGroup>
              )}
              {leftTab === "publish" && (
                <>
                  <PublishPanel project={project} slug={slug} onLoadTemplate={onLoadTemplate} />
                  <ProjectInspector project={project} lang={lang} slug={slug} companies={companies} onChange={actions.updateMeta} />
                </>
              )}
            </ScrollArea>
          )}
        </aside>
        )}

        {/* ── The canvas (C) ── */}
        <div className="relative flex-1 min-w-0 h-full">
          {minimized && (
            <button
              type="button"
              onClick={() => setMinimized(false)}
              className="absolute top-3 left-3 z-30 flex items-center gap-1.5 h-8 px-2.5 rounded-[6px] border border-[var(--border)] bg-[var(--bg-1)] text-[11px] font-medium text-[var(--text-title)] shadow-sm cursor-pointer"
            >
              {Chrome.menu} Panelleri göster
            </button>
          )}
          {page === "components" && (
            // The Bileşenler page: Figma's endless canvas, the site's design variables applying in it.
            <div data-design-scope="" className="absolute inset-0">
              <DesignSystemStyle />
              <ComponentsCanvas
                components={components}
                nodes={nodes}
                places={places}
                onMeasure={measureTops}
                sampleBlock={sampleBlock}
                selection={canvasSelection}
                view={view}
                onView={setView}
                tool={tool}
                onTool={setTool}
                onSelect={(next) => (next ? select(fromCanvas(next)) : setSelection({ kind: "none" }))}
                onAddVariant={addVariantToSet}
                // A right click: its selection's menu — on the canvas itself, the tools.
                onContextMenu={(at, e) => {
                  if (at) select(fromCanvas(at));
                  else setSelection({ kind: "none" });
                  openMenu(e, canvasSelectionMenu(at));
                }}
                onMove={moveOnCanvas}
                onResize={resizeOnCanvas}
                onDraw={(drawn, rect, parent) => drawOnCanvas(drawn, rect, parent)}
                onStaticText={typeOnCanvas}
                autoEdit={autoEdit}
                prototype={rightTab === "prototype"}
                onConnect={connectVariants}
                zoomActionsRef={zoomActions}
              />
            </div>
          )}
          {page === "workspace" && (
            // Çalışma Alanı: the same endless canvas, bare — its own nodes, nothing saved.
            <WorkspaceCanvas
              nodes={workspaceNodes}
              onNodes={setWorkspaceNodes}
              view={workspaceView}
              onView={setWorkspaceView}
              tool={workspaceTool}
              onTool={setWorkspaceTool}
              selection={workspaceSelection}
              onSelect={setWorkspaceSelection}
            />
          )}
          {page === "project" && (
          <div
            // Figma's canvas: grey, the page's frame on it as an artboard (the `main` below). No press-and-drag
            // text selection on it (it fights with hold-to-drag); the field being edited opts back in.
            className="h-full overflow-y-auto bg-[var(--edit-canvas)] transition-colors duration-200 select-none"
            onClick={() => setSelection({ kind: "none" })}
            // A right click on the empty canvas beside the page: nothing selected, the page's menu (paste, add).
            onContextMenu={(e) => {
              if (reordering || e.defaultPrevented || (e.target as Element).closest("main")) return;
              setSelection({ kind: "none" });
              openMenu(e, projectMenu({ kind: "none" }, []));
            }}
            // Links stay put while editing; the click still reaches the text underneath.
            onClickCapture={(e) => { if ((e.target as Element).closest("a[href]")) e.preventDefault(); }}
            // No native image / link dragging — reordering is done with dnd-kit.
            onDragStart={(e) => e.preventDefault()}
          >
            <DesignSystemStyle />
            {/* Room around the artboard, as on Figma's canvas; its name over its top left corner (a click selects the page). */}
            <div className={cn("flex flex-col items-center w-full min-h-full px-10", reordering ? "py-6" : "pt-14 pb-24")}>
              <div className="relative w-full max-w-[720px]">
              {!reordering && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); select({ kind: "page" }); }}
                  className={cn(
                    "absolute -top-5 left-0 flex items-center h-4 max-w-full text-[11px] leading-4 whitespace-nowrap cursor-default select-none",
                    selection.kind === "page" ? "text-[var(--edit-accent)]" : "text-[var(--text-subtitle)] hover:text-[var(--edit-accent)]"
                  )}
                >
                  <span className="truncate">{project.title?.trim() || "Sayfa"}</span>
                </button>
              )}
              {/*
                The artboard: the page as on the site — its theme and the site's design variables apply inside it
                (DesignSystemStyle). `relative`: the size badge (SizeBadge) is placed in it; `isolate`: the canvas's
                layers stay above its background.
              */}
              <main
                {...projectThemeAttrs(project.theme)}
                data-design-scope=""
                className={cn("relative isolate flex flex-col items-start w-full px-6 pt-20 pb-40 bg-[var(--bg-1)] shadow-[0_0_0_1px_var(--border)]", reordering && REORDER_ROOM)}
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
                // A right click, as Figma's: inside the selection it stays; elsewhere what a click would select is
                // selected — then its menu opens. Ctrl-click is the Mac's right click: on the canvas it deep-selects instead.
                onContextMenu={(e) => {
                  const target = e.target as Element;
                  if (e.ctrlKey || reordering) return e.preventDefault();
                  // Text being typed in keeps the browser's own menu (spelling, paste…).
                  if (target.closest("[contenteditable='true'], input, textarea")) return;
                  const found = pressOn(target, pickedLayers);
                  const under = layersAt(target).map((layer) => layer.selection);
                  const t: Selection = found?.drill ? picked : found?.layer.selection ?? under.at(-1) ?? { kind: "none" };
                  if (t.kind === "none") setSelection(t);
                  else if (layerKey(t) !== layerKey(picked)) select(t);
                  openMenu(e, projectMenu(t, under.length ? [{ kind: "page" } as Selection, ...under].reverse() : []));
                }}
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
                      selection={selection.kind === "meta" ? selection : NONE}
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
                        // Only what is selected inside it — so the other sections' props stay the same, and they don't redraw.
                        selectedGroupId={selectedGroup?.section.id === item.id ? selectedGroup.group.id : null}
                        activeGroupId={activeSectionId === item.id ? activeGroupId : null}
                        selectedBlockId={activeSectionId === item.id ? selectedBlock?.block.id ?? null : null}
                        selectedItemId={activeSectionId === item.id ? selectedItemId : null}
                        selectedText={activeSectionId === item.id ? selectedText : null}
                        onSelect={selectStable}
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
            </div>
          </div>
          )}

          {!reordering && (
            <CanvasToolbar
              onPage={page === "project"}
              canvas={page === "components" ? { tool, onTool: setTool } : undefined}
              frameLabel={frameSection ? "Çerçeve — bölüme blok ekle" : "Çerçeve — yeni bölüm"}
              onFrame={addFrame}
              onText={() => addFromCatalog("text")}
              onImage={() => addFromCatalog("image")}
              onLine={() => actions.addDivider(frameSection ?? undefined)}
              onDevMode={onSwitchToForm}
            />
          )}
        </div>

        {/* ── The right sidebar (D): Figma's top row (the language, Present, Share as Kaydet), the Design / Prototype tabs with the zoom, then the properties ── */}
        {!minimized && (
        <aside data-design-panel="" aria-label="Tasarım" className="w-[240px] shrink-0 h-full flex flex-col border-l border-[var(--border)] bg-[var(--bg-1)] z-10">
          <div className="shrink-0 flex items-center justify-end gap-2 h-12 px-2">
            <LangSwitch />
            <button
              type="button"
              aria-label="Yayında görüntüle"
              title={isPublished ? "Yayında görüntüle" : "Henüz yayında değil — önce kaydet"}
              disabled={!isPublished}
              onClick={() => window.open(`/projects/${slug}`, "_blank")}
              className="flex items-center justify-center w-8 h-8 rounded-[6px] text-[var(--text-title)] hover:bg-[var(--bg-4)] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-default"
            >
              {Chrome.present}
            </button>
            <SaveButton />
          </div>
          <div role="tablist" aria-label="Sağ panel" className="shrink-0 flex items-center gap-1 h-10 pl-2 pr-2 border-b border-[var(--border)]">
            <PanelTab label="Tasarım" active={rightTab === "design"} onClick={() => setRightTab("design")} />
            <PanelTab label="Prototip" active={rightTab === "prototype"} onClick={() => setRightTab("prototype")} />
            <button
              type="button"
              aria-haspopup="menu"
              disabled={page !== "components"}
              onClick={(e) => openMenuUnder(e.currentTarget, zoomMenu(), "right")}
              className="ml-auto flex items-center gap-1 h-7 pl-2 pr-1.5 rounded-[5px] text-[11px] text-[var(--text-title)] tabular-nums hover:bg-[var(--bg-4)] transition-colors cursor-pointer disabled:cursor-default disabled:hover:bg-transparent"
            >
              {page === "components" ? `${Math.round(view.zoom * 100)}%` : page === "workspace" ? `${Math.round(workspaceView.zoom * 100)}%` : "100%"}
              <span className="text-[var(--text-subtitle)]">{Chrome.chevron}</span>
            </button>
          </div>
          {header && <InspectorHeader {...header} actions={inspectorActions} />}
          {/*
            Figma's sections, in its order, full width: an instance's first (the component it is, its properties),
            then its Yerleşim (auto layout, W / H), Görünüş, Dolgu, Kenar çizgisi — every frame has them.
          */}
          <ScrollArea className="flex-1 min-h-0" viewportClassName="h-full overflow-x-hidden flex flex-col" inset={8} edge={2}>
            {rightTab === "design" ? content : prototypeContent}
          </ScrollArea>
        </aside>
        )}

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

        {menu && <ContextMenu at={menu} entries={menu.entries} onClose={closeMenu} />}

        {previewed && (
          <PrototypePreview
            component={previewed}
            holderType={holderTypeOf(previewed)}
            width={canvasWidth(previewed)}
            sampleBlock={sampleBlock}
            onClose={() => setPreviewing(null)}
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
