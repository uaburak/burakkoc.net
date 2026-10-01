"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useTheme } from "@/context/ThemeContext";
import { useEditorContext } from "@/components/admin/EditorNavControls";
import { FigmaIcon, fi } from "@/components/admin/figmaIcons";
import { ScrollArea } from "@/components/ScrollArea";
import { ContextMenu, keys, type MenuEntry } from "@/components/admin/ContextMenu";
import { DesignSystemStyle } from "@/components/project/designSystem";
import type { CanvasTool, CanvasView, ZoomActions } from "@/components/admin/canvasModel";
import type { DesignSystem } from "@/components/admin/useDesignSystem";
import type { MenuItem } from "@/components/admin/LiveInspector";
import { Canvas, type Rect } from "./Canvas";
import { VariablesTable } from "./VariablesTable";
import { colorsIn } from "./ColorPicker";
import { copyElementAs, exportElement } from "./exportNode";
import { nodeCss } from "./css";
import { fileExt, uploadFile } from "@/lib/storage";
import { Inspector, type EditorOps } from "./Inspector";
import { Layers, layerIcon, requestRename, type TreePlace } from "./Layers";
import { BrandButton, CollapseHeader, EDITOR_CSS, IconButton, Tab, TextInput } from "./ui";
import { MotionStyle, NodeView, RenderProvider, type RenderContext } from "./NodeView";
import { fixedIds, withSitePage } from "./overview";
import { COMPONENTS_PAGE_ID } from "./library";
import { ImagesPanel } from "./ImagesPanel";
import {
  allComponents,
  applyPropertyValue,
  byIdMap,
  cloneNode,
  findComponent,
  findNode,
  getNode,
  insertNode,
  isFrameLike,
  PATH_SEP,
  layerAt,
  libraryOf,
  makeFrame,
  makeInstance,
  makeShape,
  makeText,
  nextName,
  nid,
  numberOf,
  pageOfNode,
  pickVariant,
  pruneBindings,
  removeNodes,
  resolveInstance,
  setOf,
  updateAnywhere,
  withOverride,
  topmost,
  updateNode,
  updateNodes,
  variantProperties,
  variantsOf,
  type FigmaDocument,
  type FrameNode,
  type NodeOverride,
  type Paint,
  type SceneNode,
  type TextNode,
} from "./model";

/** Where the editor uploads a file: the project's folder, under the time (a path of its own — see uploadFile). */
const uploadPath = (slug: string, f: File) => `projects/${slug}/figma/${Date.now()}.${fileExt(f)}`;

/**
 * Where a picture goes in an instance (`list`: its layers, as drawn): the
 * first layer in sight showing one (the Overview's cover) — else the first
 * shape in sight, a picture's placeholder (an Image's grey box). Its key: its
 * name path. An instance's own layers only, not a nested instance's.
 */
function pictureIn(list: readonly SceneNode[]): { key: string; fills: Paint[] } | null {
  const layers: { key: string; node: SceneNode }[] = [];
  const visit = (nodes: readonly SceneNode[], path: string) => {
    for (const child of nodes) {
      if (child.visible === false) continue;
      const key = path ? `${path}${PATH_SEP}${child.name}` : child.name;
      layers.push({ key, node: child });
      if (isFrameLike(child) && child.type !== "instance") visit(child.children, key);
    }
  };
  visit(list, "");
  const found = layers.find(({ node }) => node.type !== "text" && node.type !== "instance" && node.fills.some((p) => p.type === "image")) ??
    layers.find(({ node }) => node.type === "rectangle" || node.type === "ellipse");
  return found && found.node.type !== "text" ? { key: found.key, fills: found.node.fills } : null;
}

/** Is it the page's Overview (the instance — not its component)? */
const isPageOverview = (node: SceneNode | undefined) => node?.fixed === "overview" && node.type === "instance";
/** Do `siblings` start with the page's Overview (the page frame's)? */
const leadsWithOverview = (siblings: readonly SceneNode[]) => isPageOverview(siblings[0]);

/**
 * The editor — Figma, for the project's page: the navigation bar (the
 * menu; File, Assets, Variables), the left sidebar (the file, its
 * page, the layers), the canvas, the right sidebar (Design / Prototype,
 * Save), the toolbar. Everything edits `doc`; Save writes it with the
 * project. Undo is the project's (see AdminEditorClient).
 */

type LeftTab = "file" | "assets" | "components" | "images" | "variables";

/**
 * The editor's three views of the same file, switched at the toolbar's end:
 * the canvas (Figma's, endless), the page (the site's page as a page: at
 * its own width, scrolled up and down — the same panels, menus and
 * components around it), the code (to come).
 */
type EditorMode = "canvas" | "page" | "code";
const EDITOR_MODES: { id: EditorMode; label: string }[] = [
  { id: "canvas", label: "Canvas Editor" },
  { id: "page", label: "Page Editor" },
  { id: "code", label: "Code" },
];
const EDITOR_MODE_KEY = "figma-editor-mode";

/** Figma's colours, as its UI kit's variables resolve (Light / Dark) — the chrome's tokens, and the site's ones over them for shared pieces. */
const PANEL_WIDTHS_KEY = "figma-panel-widths";

const FIGMA_TOKENS: Record<"light" | "dark", CSSProperties> = {
  light: {
    "--f-bg": "#ffffff", "--f-bg-secondary": "#f5f5f5", "--f-bg-hover": "#f5f5f5", "--f-bg-selected": "#e5f4ff", "--f-bg-selected-secondary": "#f2f9ff", "--f-bg-brand": "#0d99ff", "--f-bg-menu": "#1e1e1e",
    // The layers' and pages' rows: the site's bg/3 hovered, bg/4 selected (the user's choice — grey, light, not Figma's blue)
    "--f-bg-row-hover": "#f5f5f5", "--f-bg-row-selected": "#f0f0f0", "--f-bg-row-selected-secondary": "#f7f7f7",
    "--f-border": "#e6e6e6", "--f-border-translucent": "rgba(0,0,0,0.1)", "--f-border-selected": "#0d99ff",
    "--f-text": "rgba(0,0,0,0.9)", "--f-text-secondary": "rgba(0,0,0,0.5)", "--f-text-tertiary": "rgba(0,0,0,0.3)", "--f-text-brand": "#007be5", "--f-text-component": "#8638e5",
    "--f-icon": "rgba(0,0,0,0.9)", "--f-icon-secondary": "rgba(0,0,0,0.5)", "--f-icon-tertiary": "rgba(0,0,0,0.3)",
    "--bg-1": "#ffffff", "--bg-2": "#ffffff", "--bg-3": "#ffffff", "--bg-4": "#f5f5f5", "--bg-5": "#e6e6e6",
    "--border": "#e6e6e6", "--border-hover": "#b3b3b3",
    "--text-title": "rgba(0,0,0,0.9)", "--text-p": "rgba(0,0,0,0.9)", "--text-subtitle": "rgba(0,0,0,0.5)",
    "--edit-component": "#8638e5", "--edit-canvas": "#f5f5f5", "--edit-selected": "#e5f4ff",
  } as CSSProperties,
  dark: {
    "--f-bg": "#2c2c2c", "--f-bg-secondary": "#383838", "--f-bg-hover": "#383838", "--f-bg-selected": "#4a5878", "--f-bg-selected-secondary": "#394360", "--f-bg-brand": "#0c8ce9", "--f-bg-menu": "#1e1e1e",
    "--f-bg-row-hover": "#262626", "--f-bg-row-selected": "#1e1e1e", "--f-bg-row-selected-secondary": "#232323",
    "--f-border": "#444444", "--f-border-translucent": "rgba(255,255,255,0.1)", "--f-border-selected": "#0c8ce9",
    "--f-text": "#ffffff", "--f-text-secondary": "rgba(255,255,255,0.7)", "--f-text-tertiary": "rgba(255,255,255,0.4)", "--f-text-brand": "#7cc4f8", "--f-text-component": "#c9a5ff",
    "--f-icon": "#ffffff", "--f-icon-secondary": "rgba(255,255,255,0.7)", "--f-icon-tertiary": "rgba(255,255,255,0.4)",
    "--bg-1": "#2c2c2c", "--bg-2": "#2c2c2c", "--bg-3": "#2c2c2c", "--bg-4": "#383838", "--bg-5": "#444444",
    "--border": "#444444", "--border-hover": "#5c5c5c",
    "--text-title": "#ffffff", "--text-p": "rgba(255,255,255,0.9)", "--text-subtitle": "rgba(255,255,255,0.7)",
    "--edit-component": "#c9a5ff", "--edit-canvas": "#1e1e1e", "--edit-selected": "#4a5878",
  } as CSSProperties,
};

function NavTab({ icon, label, active, onClick }: { icon: ReactNode; label: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" aria-label={label} aria-pressed={active} onClick={onClick} className="group/nav flex w-16 flex-col items-center gap-1 pt-2 pb-1.5 cursor-pointer select-none">
      <span className={cn("flex items-center justify-center w-8 h-8 rounded-[5px] transition-colors", active ? "bg-[var(--f-bg-selected)] text-[var(--f-text-brand)]" : "text-[var(--f-icon)] group-hover/nav:bg-[var(--f-bg-hover)]")}>{icon}</span>
      <span className={cn("text-[10px] leading-3 tracking-[0.05px] whitespace-nowrap", active ? "text-[var(--f-text)]" : "text-[var(--f-text-secondary)]")}>{label}</span>
    </button>
  );
}

function SaveButton() {
  const { saveStatus, triggerSave } = useEditorContext();
  const label = saveStatus === "saving" ? "Saving…" : saveStatus === "saved" ? "Saved" : saveStatus === "error" ? "Error" : "Save";
  return (
    <BrandButton disabled={saveStatus === "saving" || !triggerSave} onClick={() => triggerSave?.()} className={cn(saveStatus === "error" && "bg-[#f24822]")}>
      {label}
    </BrandButton>
  );
}

function LangSwitch() {
  const { editLang, setEditLang } = useEditorContext();
  return (
    <div role="radiogroup" aria-label="Language" className="flex items-center gap-1">
      {(["tr", "en"] as const).map((l) => (
        <Tab key={l} label={l.toUpperCase()} active={editLang === l} onClick={() => setEditLang(l)} />
      ))}
    </div>
  );
}

/** One of the editor's views at the toolbar's end: a tab as the panels' (Design / Prototype), as tall as the tools. */
function ModeTab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" role="tab" aria-selected={active} onClick={onClick} className={cn("h-8 px-2.5 rounded-[5px] text-[11px] leading-4 tracking-[0.055px] whitespace-nowrap cursor-pointer transition-colors", active ? "font-[550] text-[var(--f-text)] bg-[var(--f-bg-secondary)]" : "font-[450] text-[var(--f-text-secondary)] hover:text-[var(--f-text)] hover:bg-[var(--f-bg-hover)]")}>
      {label}
    </button>
  );
}

/** A toolbar tool, as the kit's: a 24px icon in a 32px box, blue while in use; a 16px chevron opens its menu. */
function Tool({ icon, label, shortcut, active = false, onClick, menu, menuLabel }: { icon: ReactNode; label: string; shortcut?: string; active?: boolean; onClick: () => void; menu?: (el: HTMLElement) => void; menuLabel?: string }) {
  return (
    <div className="relative group/tool flex items-center gap-px">
      <button type="button" aria-label={label} aria-pressed={active} onClick={onClick} className={cn("flex items-center justify-center w-8 h-8 rounded-[5px] transition-colors cursor-pointer", active ? "bg-[var(--f-bg-brand)] text-white" : "text-[var(--f-icon)] hover:bg-[var(--f-bg-hover)]")}>
        {icon}
      </button>
      {menu && (
        <button type="button" aria-label={menuLabel ?? `${label} menu`} onClick={(e) => menu(e.currentTarget)} className="flex items-center justify-center w-4 h-8 rounded-[5px] text-[var(--f-icon-secondary)] hover:bg-[var(--f-bg-hover)] cursor-pointer">
          {fi("16.chevron.down")}
        </button>
      )}
      <span className="pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 -translate-x-1/2 z-50 hidden group-hover/tool:inline-flex items-center gap-2 h-7 px-2.5 rounded-[6px] bg-[var(--f-bg-menu)] text-[11px] font-medium text-white whitespace-nowrap">
        {label}
        {shortcut && <span className="text-white/50">{shortcut}</span>}
      </span>
    </div>
  );
}

/** A canvas rect of a node as drawn (canvas px) — read from the canvas's DOM. */
function domRect(id: string): { x: number; y: number; w: number; h: number } | null {
  const canvas = document.querySelector<HTMLElement>("[data-figma-canvas]");
  const el = canvas?.querySelector<HTMLElement>(`[data-node-id="${CSS.escape(id)}"]`);
  const world = canvas?.querySelector<HTMLElement>("[data-design-scope]");
  if (!canvas || !el || !world) return null;
  const w = world.getBoundingClientRect();
  // The world's probe (see Canvas): a 1000px span whose drawn width is the zoom — the world itself has no width of its own (everything in it is placed absolutely).
  const probe = world.querySelector<HTMLElement>("[data-zoom-probe]");
  const pw = probe?.getBoundingClientRect().width ?? 0;
  const zoom = pw > 0 ? pw / 1000 : w.width / Math.max(1, world.offsetWidth || 1);
  const r = el.getBoundingClientRect();
  const scale = Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
  return { x: (r.left - w.left) / scale, y: (r.top - w.top) / scale, w: r.width / scale, h: r.height / scale };
}

/** What only a text, a shape or frame, or only a frame can take — for edits made to several layers at once. */
const TEXT_ONLY = new Set(["characters", "charactersEn", "fontSize", "fontWeight", "lineHeight", "letterSpacing", "textAlign", "textAutoResize", "textStyle", "textCase", "textDecoration", "verticalAlign", "paragraphSpacing"]);
const GEOMETRY_ONLY = new Set(["strokes", "cornerRadius", "corners", "effects", "effectStyle"]);
const FRAME_ONLY = new Set(["children", "clipsContent", "layoutMode", "itemSpacing", "counterSpacing", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft", "primaryAlign", "counterAlign", "layoutWrap", "gridColumns", "gridRows", "layoutGrids", "strokesInLayout", "firstOnTop", "baselineAlign", "variant", "reactions", "mainId", "overrides"]);

const KIND_HINT: Record<SceneNode["type"], string> = { frame: "frame", rectangle: "rectangle", ellipse: "ellipse", line: "line", text: "text", component: "component", componentSet: "component set", instance: "instance" };

const isTyping = () => {
  const el = document.activeElement as HTMLElement | null;
  return Boolean(el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)));
};

export function FigmaEditor({ doc: file, onDoc, title, slug, system, isPublished, undo, redo, onRebuildPage }: {
  doc: FigmaDocument;
  onDoc: (update: (doc: FigmaDocument) => FigmaDocument) => void;
  title: string;
  slug: string;
  system: DesignSystem;
  isPublished: boolean;
  undo: () => void;
  redo: () => void;
  /** The page frame made again from the project's page as it was before the Figma editor (a project that has one) */
  onRebuildPage?: () => void;
}) {
  const router = useRouter();
  const { theme, toggle: toggleTheme } = useTheme();
  const { editLang } = useEditorContext();
  const lang = editLang;
  const [selection, setSelectionState] = useState<string[]>([]);
  // The view picked at the toolbar's end, kept in the browser. Only the project's own page is a page: the file's other pages always open on the canvas.
  const [pickedMode, setPickedMode] = useState<EditorMode>(() => {
    try { const saved = localStorage.getItem(EDITOR_MODE_KEY); if (saved === "canvas" || saved === "page" || saved === "code") return saved; } catch { /* the canvas */ }
    return "canvas";
  });
  const mode: EditorMode = pickedMode === "page" && file.currentPage ? "canvas" : pickedMode;
  const paged = mode === "page";
  // Each view keeps its own place: the canvas its pan and zoom, the page its scroll.
  const [canvasView, setCanvasView] = useState<CanvasView>({ x: 120, y: 80, zoom: 0.5 });
  const [pageView, setPageView] = useState<CanvasView>({ x: 0, y: 0, zoom: 1 });
  const view = paged ? pageView : canvasView;
  const setView = paged ? setPageView : setCanvasView;
  const [tool, setTool] = useState<CanvasTool>("move");
  const [leftTab, setLeftTab] = useState<LeftTab>("file");
  const [rightTab, setRightTab] = useState<"design" | "prototype">("design");
  const [open, setOpen] = useState<Set<string>>(() => new Set([file.pageId]));
  const [editing, setEditing] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; entries: MenuEntry[] } | null>(null);
  const [minimized, setMinimized] = useState(false);
  const [previewing, setPreviewing] = useState<string | null>(null);
  const [variablesOpen, setVariablesOpen] = useState(false);
  // The Images panel, mounted the first time it is opened and kept: its pictures load once (see ImagesPanel).
  const [imagesOpened, setImagesOpened] = useState(false);
  // A padding / gap field focused in the panel: what the canvas highlights.
  const [layoutFocus, setLayoutFocus] = useState<{ pads?: ("top" | "right" | "bottom" | "left")[]; gap?: boolean } | null>(null);
  // The sidebars' widths: dragged at their inner edge (Figma lets both be resized), kept in the browser.
  const [panelWidths, setPanelWidths] = useState<{ left: number; right: number }>(() => {
    try { const saved = JSON.parse(localStorage.getItem(PANEL_WIDTHS_KEY) ?? ""); if (saved && typeof saved.left === "number" && typeof saved.right === "number") return saved; } catch { /* the defaults */ }
    return { left: 240, right: 240 };
  });
  const resizePanel = (side: "left" | "right") => (e: React.PointerEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = panelWidths[side];
    const move = (ev: PointerEvent) => {
      const w = Math.round(Math.max(200, Math.min(480, side === "left" ? startW + ev.clientX - startX : startW - (ev.clientX - startX))));
      setPanelWidths((p) => (p[side] === w ? p : { ...p, [side]: w }));
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setPanelWidths((p) => { try { localStorage.setItem(PANEL_WIDTHS_KEY, JSON.stringify(p)); } catch { /* ignore */ } return p; });
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  // Figma's Find in the layers: the rows whose names match.
  const [query, setQuery] = useState<string | null>(null);
  const clipboard = useRef<SceneNode[]>([]);
  const zoomActions = useRef<ZoomActions | null>(null);
  const { variables, textStyles } = system;
  const byId = useMemo(() => byIdMap(variables), [variables]);
  // The open page: the file itself (the project's page) or one of its other pages — `doc` is what the editor draws and edits.
  const doc = useMemo<FigmaDocument>(() => {
    const pg = file.currentPage ? file.pages?.find((x) => x.id === file.currentPage) : undefined;
    return pg ? { ...file, nodes: pg.nodes, background: pg.background } : file;
  }, [file]);
  const nodes = doc.nodes;
  // The Page Editor's page: the frame the site shows. It stays whole and in its place there — it can't be deleted, moved, grouped or copied.
  const pageRoot = paged ? doc.pageId : null;
  const notRoot = (id: string) => !id.includes("/") && id !== pageRoot;
  // The project's own layers — the site's page frame, its Overview and the Overview's component (see overview.ts): never deleted, wrapped,
  // unwrapped, detached or moved off.
  const stays = useMemo(() => fixedIds(file), [file]);
  const removable = (id: string) => notRoot(id) && !stays.has(id);
  /** Where a layer may go among `siblings`: never before the page's Overview, its first. */
  const fromIndex = (siblings: readonly SceneNode[], index?: number) => (index !== undefined && index < 1 && leadsWithOverview(siblings) ? 1 : index);
  // Every page's nodes: where instances find their main components (the Components page's too).
  const library = useMemo(() => libraryOf(file), [file]);
  const setNodes = useCallback((update: (nodes: SceneNode[]) => SceneNode[]) => onDoc((d) => {
    const pg = d.currentPage ? d.pages?.find((x) => x.id === d.currentPage) : undefined;
    if (pg) {
      const next = update(pg.nodes);
      return next === pg.nodes ? d : { ...d, pages: d.pages!.map((x) => (x.id === pg.id ? { ...x, nodes: next } : x)) };
    }
    const next = update(d.nodes);
    return next === d.nodes ? d : { ...d, nodes: next };
  }), [onDoc]);
  const pages = useMemo(() => [{ id: "", name: file.pageName ?? getNode(file.nodes, file.pageId)?.name ?? title ?? "Page 1" }, ...(file.pages ?? []).map((pg) => ({ id: pg.id, name: pg.name }))], [file, title]);
  const [renamingPage, setRenamingPage] = useState<string | null>(null);
  // The components aren't a page of the list: the Components tab opens them (their page — the canvas they are edited on), as Variables opens the variables.
  const onComponents = (file.currentPage ?? "") === COMPONENTS_PAGE_ID;
  const tab: LeftTab = onComponents && leftTab === "file" ? "components" : !onComponents && leftTab === "components" ? "file" : leftTab;
  const lastPage = useRef("");
  useEffect(() => {
    if (!onComponents) lastPage.current = file.currentPage ?? "";
  });
  const openTab = (next: LeftTab) => {
    setLeftTab(next);
    if (next === "images") setImagesOpened(true);
    if (next === "components" && !onComponents) switchPage(COMPONENTS_PAGE_ID);
    // Back from the components: the page that was open.
    if (next === "file" && onComponents) switchPage(lastPage.current);
  };
  const switchPage = (id: string) => {
    setSelectionState([]);
    setEditing(null);
    onDoc((d) => ({ ...d, currentPage: id || undefined }));
    // The components are edited on the canvas (a page other than the project's shows it in the Page Editor too: see `mode`).
    if (id === COMPONENTS_PAGE_ID && mode === "code") setMode("canvas");
  };
  const setMode = (next: EditorMode) => {
    setPickedMode(next);
    try { localStorage.setItem(EDITOR_MODE_KEY, next); } catch { /* ignore */ }
    setEditing(null);
    setTool("move");
    if (next !== "page") return;
    // The Page Editor shows the project's page: it opens it — on it, what sits beside the page frame (not shown there) leaves the selection.
    if (file.currentPage) switchPage("");
    else setSelectionState((sel) => sel.filter((id) => findNode(file.nodes, id.split("/")[0])?.path[0] === file.pageId));
  };
  const addPage = () => {
    const id = nid("p");
    // Numbered after the pages listed (the Components page isn't one).
    let n = pages.filter((pg) => pg.id !== COMPONENTS_PAGE_ID).length + 1;
    while (pages.some((pg) => pg.name === `Page ${n}`)) n++;
    onDoc((d) => ({ ...d, pages: [...(d.pages ?? []), { id, name: `Page ${n}`, nodes: [] }], currentPage: id }));
    setSelectionState([]);
  };
  const renamePage = (id: string, name: string) => {
    const clean = name.trim();
    if (!clean) return;
    onDoc((d) => (id ? { ...d, pages: d.pages?.map((pg) => (pg.id === id ? { ...pg, name: clean } : pg)) } : { ...d, pageName: clean }));
  };
  const removePage = (id: string) => {
    if (!id) return;
    onDoc((d) => ({ ...d, pages: d.pages?.filter((pg) => pg.id !== id), currentPage: d.currentPage === id ? undefined : d.currentPage }));
    setSelectionState([]);
  };

  // A gone node leaves the selection.
  const selected = useMemo(() => selection.filter((id) => (id.includes("/") ? getNode(nodes, id.split("/")[0]) : getNode(nodes, id))), [selection, nodes]);
  const setSelection = useCallback((ids: string[]) => {
    setSelectionState(ids);
    setEditing(null);
    // The layers holding it open — inside an instance, the instance and every holder down to it too.
    setOpen((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        const slash = id.indexOf("/");
        const own = slash < 0 ? id : id.slice(0, slash);
        findNode(nodes, own)?.path.slice(0, -1).forEach((p) => next.add(p));
        if (slash < 0) continue;
        next.add(own);
        const rest = id.slice(slash + 1);
        for (let i = 0; i < rest.length; i++) if (rest[i] === "/" || rest[i] === PATH_SEP) next.add(`${own}/${rest.slice(0, i)}`);
      }
      return next.size === prev.size ? prev : next;
    });
  }, [nodes]);

  // The selected row stays in sight in the layers.
  useEffect(() => {
    requestAnimationFrame(() => document.querySelector("[data-left-panel] [data-selected-row]")?.scrollIntoView({ block: "nearest" }));
  }, [selected]);

  const latest = useRef({ selected, nodes, doc, tool, editing, lang, previewing, mode, pageRoot });
  useEffect(() => {
    latest.current = { selected, nodes, doc, tool, editing, lang, previewing, mode, pageRoot };
  });

  // ── Editing ──
  // A node changed wherever it sits — a main component on the Components page from an instance's panel too.
  const patch = useCallback((id: string, p: Partial<SceneNode>) => {
    if (id.includes("/")) return;
    onDoc((d) => updateAnywhere(d, id, (n) => ({ ...n, ...p } as SceneNode)));
  }, [onDoc]);
  const override = useCallback((compositeId: string, p: NodeOverride) => {
    const slash = compositeId.indexOf("/");
    const instanceId = compositeId.slice(0, slash);
    const keys = compositeId.slice(slash + 1).split("/");
    setNodes((list) => updateNode(list, instanceId, (n) => (n.type !== "instance" ? n : { ...n, overrides: withOverride(n.overrides, keys, p) })));
  }, [setNodes]);

  /**
   * Typing a text inside an instance: its words — the instance's value of the
   * text property they come from, as Figma's (an override of them, which
   * would hide the property's, taken off) — or else the instance's override.
   */
  const typeInInstance = useCallback((compositeId: string, text: string, en: boolean) => onDoc((d) => {
    const at = layerAt(libraryOf(d), compositeId);
    if (!at) return d;
    const prop = at.keys.length === 1 && at.node.type === "text" ? at.node.charactersProp : undefined;
    const field = en ? "charactersEn" : "characters";
    return updateAnywhere(d, at.instance.id, (n) => {
      if (n.type !== "instance") return n;
      if (!prop) return { ...n, overrides: withOverride(n.overrides, at.keys, { [field]: text }) };
      const key = at.keys[0];
      const overrides = { ...n.overrides };
      const own = overrides[key] ? { ...overrides[key] } : undefined;
      if (own) {
        delete own[field];
        if (Object.keys(own).length) overrides[key] = own;
        else delete overrides[key];
      }
      return { ...n, ...(en ? { propsEn: { ...n.propsEn, [prop]: text } } : { props: { ...n.props, [prop]: text } }), overrides: Object.keys(overrides).length ? overrides : undefined };
    });
  }), [onDoc]);

  const deleteSelection = () => {
    const ids = new Set(latest.current.selected.filter(removable));
    if (!ids.size) return;
    setNodes((list) => removeNodes(list, ids));
    setSelection([]);
  };

  /** A copy of each selected top, right after it — a main component's copy is an instance (as Figma's ⌘D). */
  const duplicateSelection = () => {
    const tops = topmost(nodes, latest.current.selected.filter(notRoot));
    if (!tops.length) return;
    const made: string[] = [];
    setNodes((list) => {
      let next = list;
      for (const t of tops) {
        const found = findNode(next, t.node.id);
        if (!found) continue;
        const copy = found.node.type === "component" ? makeInstance(found.node, found.node.x, found.node.y + found.node.height + 24) : cloneNode(found.node);
        if (found.node.type === "component" && found.parent?.type === "componentSet") continue;
        made.push(copy.id);
        next = insertNode(next, found.parent?.id ?? null, copy, found.index + 1);
      }
      return next;
    });
    if (made.length) setSelection(made);
  };

  const copySelection = () => {
    const tops = topmost(nodes, latest.current.selected.filter((id) => !id.includes("/")));
    clipboard.current = tops.map((t) => structuredClone(t.node));
  };
  const paste = () => {
    if (!clipboard.current.length) return;
    const target = selected[0] && !selected[0].includes("/") ? findNode(nodes, selected[0]) : null;
    const into = target && (target.node.type === "frame" || target.node.type === "component") ? target.node.id : target?.parent?.id ?? pageRoot;
    const copies = clipboard.current.map((n) => cloneNode(n));
    setNodes((list) => copies.reduce((acc, c) => insertNode(acc, into, c), list));
    setSelection(copies.map((c) => c.id));
  };

  /** ⌘G a group, ⌥⌘G a frame — or ⇧A: a frame with auto layout inferred from how the layers sit (their direction and gaps), hugging them, as Figma's. Its id — null when nothing was grouped. */
  const groupSelection = (kind: "group" | "frame" | "auto"): string | null => {
    const tops = topmost(nodes, latest.current.selected.filter((id) => !id.includes("/")));
    if (!tops.length || tops.some((t) => t.node.id === pageRoot || stays.has(t.node.id))) return null;
    const parentId = tops[0].parent?.id ?? null;
    if (tops.some((t) => (t.parent?.id ?? null) !== parentId)) return null;
    const rects = tops.map((t) => ({ t, r: domRect(t.node.id) })).filter((x) => x.r) as { t: (typeof tops)[number]; r: Rect }[];
    if (!rects.length) return null;
    const parentRect = parentId ? domRect(parentId) : { x: 0, y: 0, w: 0, h: 0 };
    const x = Math.min(...rects.map((x) => x.r.x));
    const y = Math.min(...rects.map((x) => x.r.y));
    const right = Math.max(...rects.map((x) => x.r.x + x.r.w));
    const bottom = Math.max(...rects.map((x) => x.r.y + x.r.h));
    const frame = makeFrame(kind === "group" ? nextName(nodes, "Group") : nextName(nodes, "Frame"), x - (parentRect?.x ?? 0), y - (parentRect?.y ?? 0), right - x, bottom - y);
    if (kind !== "frame") frame.fills = [];
    frame.clipsContent = false;
    frame.children = rects.map(({ t, r }) => ({ ...t.node, x: Math.round(r.x - x), y: Math.round(r.y - y), sizingH: undefined, sizingV: undefined }));
    if (kind === "auto") {
      // The direction the layers spread in; the gap as the mean space between them along it.
      const mode: "horizontal" | "vertical" = right - x >= bottom - y || rects.length === 1 ? "horizontal" : "vertical";
      const sorted = [...frame.children].sort((a, b) => (mode === "vertical" ? a.y - b.y : a.x - b.x));
      const gaps = sorted.slice(1).map((c, i) => (mode === "vertical" ? c.y - (sorted[i].y + sorted[i].height) : c.x - (sorted[i].x + sorted[i].width)));
      const gap = gaps.length ? Math.max(0, Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length)) : 10;
      frame.children = sorted;
      frame.layoutMode = mode;
      frame.itemSpacing = { value: gap };
      frame.sizingH = "hug";
      frame.sizingV = "hug";
    }
    const ids = new Set(tops.map((t) => t.node.id));
    const index = Math.min(...tops.map((t) => t.index));
    setNodes((list) => insertNode(removeNodes(list, ids), parentId, frame, index));
    setSelection([frame.id]);
    return frame.id;
  };

  const ungroup = () => {
    const id = selected[0];
    const found = id && !id.includes("/") ? findNode(nodes, id) : null;
    if (!found || !isFrameLike(found.node) || found.node.type === "instance" || id === pageRoot || stays.has(id)) return;
    const frameRect = domRect(id);
    const parentRect = found.parent ? domRect(found.parent.id) : { x: 0, y: 0, w: 0, h: 0 };
    const children = found.node.children.map((c) => {
      const r = domRect(c.id);
      return r && frameRect && parentRect ? { ...c, x: Math.round(r.x - parentRect.x), y: Math.round(r.y - parentRect.y), width: Math.round(r.w), height: Math.round(r.h), sizingH: undefined, sizingV: undefined } : c;
    });
    setNodes((list) => children.reduce((acc, c, i) => insertNode(acc, found.parent?.id ?? null, c, found.index + i), removeNodes(list, new Set([id]))));
    setSelection(children.map((c) => c.id));
  };

  const createComponent = () => {
    const tops = topmost(nodes, latest.current.selected.filter((id) => !id.includes("/")));
    if (!tops.length || tops.some((t) => stays.has(t.node.id))) return;
    if (tops.length === 1 && tops[0].node.type === "frame") {
      patch(tops[0].node.id, { type: "component" } as Partial<SceneNode>);
      return;
    }
    // The frame just made (none: nothing becomes a component) is the component.
    const made = groupSelection("frame");
    if (made) requestAnimationFrame(() => patch(made, { type: "component" } as Partial<SceneNode>));
  };

  const detach = () => {
    const id = selected[0];
    const node = id && !id.includes("/") ? getNode(nodes, id) : null;
    if (!node || node.type !== "instance" || stays.has(id)) return;
    const resolved = resolveInstance(library, node);
    if (!resolved) return patch(id, { type: "frame", mainId: undefined, overrides: undefined } as Partial<SceneNode>);
    const detached = cloneNode({ ...resolved, type: "frame", mainId: undefined, overrides: undefined } as FrameNode);
    detached.id = node.id;
    setNodes((list) => updateNode(list, id, () => detached));
  };

  const addVariant = (id: string) => {
    const found = findNode(nodes, id);
    if (!found) return;
    const node = found.node;
    if (node.type === "componentSet") {
      const last = variantsOf(node).at(-1);
      if (!last) return;
      // The Overview's parts stay its in a new variant (see overview.ts).
      const copy = cloneNode(last, true);
      copy.variant = (last.variant ?? []).map((v, i) => (i === 0 ? { ...v, value: nextValue(node, v.property) } : v));
      copy.reactions = undefined;
      setNodes((list) => insertNode(list, node.id, copy));
      setSelection([copy.id]);
      return;
    }
    if (node.type !== "component") return;
    if (found.parent?.type === "componentSet") return addVariant(found.parent.id);
    // A component on its own: it becomes the first variant of a new set, with a copy as the second.
    const set = makeFrame(node.name, node.x, node.y, node.width + 32, node.height * 2 + 48);
    set.type = "componentSet";
    set.fills = [];
    set.clipsContent = false;
    set.layoutMode = "vertical";
    set.itemSpacing = { value: 16 };
    set.paddingTop = set.paddingRight = set.paddingBottom = set.paddingLeft = { value: 16 };
    set.sizingH = "hug";
    set.sizingV = "hug";
    // Its properties become the set's: what every variant's instances are set by (see propertyHolder).
    if (node.properties?.length) set.properties = node.properties;
    const first: FrameNode = { ...node, x: 0, y: 0, properties: undefined, variant: [{ property: "Property 1", value: "Default" }] };
    const second = cloneNode(first, true);
    second.variant = [{ property: "Property 1", value: "Variant 2" }];
    set.children = [first, second];
    setNodes((list) => insertNode(removeNodes(list, new Set([node.id])), found.parent?.id ?? null, set, found.index));
    setSelection([second.id]);
  };
  const nextValue = (set: FrameNode, property: string) => {
    const values = variantProperties(set).find((p) => p.name === property)?.values ?? [];
    let n = values.length + 1;
    while (values.includes(`Variant ${n}`)) n++;
    return `Variant ${n}`;
  };

  const combineAsVariants = () => {
    const tops = topmost(nodes, latest.current.selected.filter((id) => !id.includes("/"))).filter((t) => t.node.type === "component" && t.parent?.type !== "componentSet");
    if (tops.length < 2) return;
    const parentId = tops[0].parent?.id ?? null;
    const x = Math.min(...tops.map((t) => t.node.x));
    const y = Math.min(...tops.map((t) => t.node.y));
    const set = makeFrame(tops[0].node.name, x, y, 100, 100);
    set.type = "componentSet";
    set.fills = [];
    set.clipsContent = false;
    set.layoutMode = "vertical";
    set.itemSpacing = { value: 16 };
    set.paddingTop = set.paddingRight = set.paddingBottom = set.paddingLeft = { value: 16 };
    set.sizingH = "hug";
    set.sizingV = "hug";
    // The components' properties, each once, become the set's (see propertyHolder).
    const properties = tops.flatMap((t) => (t.node as FrameNode).properties ?? []).filter((p, i, all) => all.findIndex((q) => q.id === p.id) === i);
    if (properties.length) set.properties = properties;
    set.children = tops.map((t) => ({ ...(t.node as FrameNode), x: 0, y: 0, properties: undefined, variant: [{ property: "Property 1", value: t.node.name }] }));
    setNodes((list) => insertNode(removeNodes(list, new Set(tops.map((t) => t.node.id))), parentId, set, Math.min(...tops.map((t) => t.index))));
    setSelection([set.id]);
  };

  const pageColors = useMemo(() => colorsIn(nodes).slice(0, 32), [nodes]);
  const ops: EditorOps = {
    patch,
    // Several layers at once: each takes what applies to its kind (a text no strokes, a shape no typography, a shape no layout).
    patchMany: (ids, p) => setNodes((list) => updateNodes(list, ids.filter((id) => !id.includes("/")), (n) => {
      const next: Record<string, unknown> = { ...n };
      for (const [k, v] of Object.entries(p)) {
        if (n.type === "text" ? TEXT_ONLY.has(k) || !(GEOMETRY_ONLY.has(k) || FRAME_ONLY.has(k)) : !TEXT_ONLY.has(k) && (isFrameLike(n) || !FRAME_ONLY.has(k))) next[k] = v;
      }
      return next as unknown as SceneNode;
    })),
    override,
    align: (kind) => {
      const tops = topmost(nodes, latest.current.selected.filter((id) => !id.includes("/")));
      if (!tops.length) return;
      const parent = tops[0].parent;
      const bounds = tops.length > 1
        ? { x: Math.min(...tops.map((t) => t.node.x)), y: Math.min(...tops.map((t) => t.node.y)), w: Math.max(...tops.map((t) => t.node.x + t.node.width)) - Math.min(...tops.map((t) => t.node.x)), h: Math.max(...tops.map((t) => t.node.y + t.node.height)) - Math.min(...tops.map((t) => t.node.y)) }
        : parent ? { x: 0, y: 0, w: parent.width, h: parent.height } : null;
      if (!bounds) return;
      setNodes((list) => tops.reduce((acc, t) => updateNode(acc, t.node.id, (n) => {
        const p: Partial<SceneNode> = {};
        if (kind === "left") p.x = bounds.x;
        if (kind === "hcenter") p.x = Math.round(bounds.x + (bounds.w - n.width) / 2);
        if (kind === "right") p.x = bounds.x + bounds.w - n.width;
        if (kind === "top") p.y = bounds.y;
        if (kind === "vcenter") p.y = Math.round(bounds.y + (bounds.h - n.height) / 2);
        if (kind === "bottom") p.y = bounds.y + bounds.h - n.height;
        return { ...n, ...p } as SceneNode;
      }), list));
    },
    setAutoLayout: (id, mode) => {
      const found = findNode(nodes, id);
      if (!found || !isFrameLike(found.node)) return;
      const frame = found.node;
      if (mode === "none") {
        // Their places as drawn stay.
        const frameRect = domRect(id);
        const pad = { l: numberOf(frame.paddingLeft, byId), t: numberOf(frame.paddingTop, byId) };
        void pad;
        const children = frame.children.map((c) => {
          const r = domRect(c.id);
          return r && frameRect ? { ...c, x: Math.round(r.x - frameRect.x), y: Math.round(r.y - frameRect.y), width: Math.round(r.w), height: Math.round(r.h), sizingH: c.sizingH === "fill" ? undefined : c.sizingH, sizingV: c.sizingV === "fill" ? undefined : c.sizingV } : c;
        });
        const r = domRect(id);
        patch(id, { layoutMode: "none", children, sizingH: frame.sizingH === "hug" ? undefined : frame.sizingH, sizingV: frame.sizingV === "hug" ? undefined : frame.sizingV, width: r ? Math.round(r.w) : frame.width, height: r ? Math.round(r.h) : frame.height } as Partial<SceneNode>);
        return;
      }
      // In the order they sit — the page's Overview kept first.
      const head = leadsWithOverview(frame.children) ? frame.children.slice(0, 1) : [];
      const sorted = [...head, ...frame.children.slice(head.length).sort((a, b) => (mode === "vertical" ? a.y - b.y : a.x - b.x))];
      const gap = sorted.length > 1 ? Math.max(0, Math.round(sorted.slice(1).reduce((sum, c, i) => sum + (mode === "vertical" ? c.y - (sorted[i].y + sorted[i].height) : c.x - (sorted[i].x + sorted[i].width)), 0) / (sorted.length - 1))) : 10;
      const minX = sorted.length ? Math.min(...sorted.map((c) => c.x)) : 0;
      const minY = sorted.length ? Math.min(...sorted.map((c) => c.y)) : 0;
      patch(id, { layoutMode: mode, children: sorted, itemSpacing: { value: gap }, paddingLeft: { value: Math.max(0, minX) }, paddingTop: { value: Math.max(0, minY) }, paddingRight: { value: Math.max(0, minX) }, paddingBottom: { value: Math.max(0, minY) } } as Partial<SceneNode>);
    },
    createComponent,
    detach,
    resetOverrides: () => selected[0] && patch(selected[0], { overrides: undefined, props: undefined, propsEn: undefined } as Partial<SceneNode>),
    goToMain: () => {
      const node = selected[0] ? getNode(nodes, selected[0].split("/")[0]) : null;
      if (node?.type === "instance" && node.mainId && findComponent(library, node.mainId)) {
        // On another page (the Components page): the editor opens it first.
        const page = pageOfNode(file, node.mainId);
        const current = file.currentPage ?? "";
        if (page !== null && page !== current) switchPage(page);
        // The code's view open, or the Page Editor opening on a main component beside the page frame: the canvas shows it.
        const opensPaged = pickedMode === "page" && (page ?? current) === "";
        if (mode === "code" || (opensPaged && findNode(file.nodes, node.mainId)?.path[0] !== file.pageId)) setMode("canvas");
        setSelection([node.mainId]);
        // Its holders (a variant's set) open in the layers — found on its own page: `nodes` are still the page left.
        const its = page === null ? [] : page ? file.pages?.find((pg) => pg.id === page)?.nodes ?? [] : file.nodes;
        const holders = findNode(its, node.mainId)?.path.slice(0, -1) ?? [];
        if (holders.length) setOpen((prev) => new Set([...prev, ...holders]));
        setLeftTab("file");
        requestAnimationFrame(() => requestAnimationFrame(() => zoomActions.current?.fitSelection()));
      }
    },
    addVariant,
    combineAsVariants,
    setVariantValue: (variantId, property, value) => patch(variantId, { variant: (getNode(nodes, variantId) as FrameNode).variant?.map((v) => (v.property === property ? { ...v, value } : v)) } as Partial<SceneNode>),
    renameProperty: (setId, from, to) => setNodes((list) => updateNode(list, setId, (set) => (set.type === "componentSet" ? { ...set, children: set.children.map((c) => (c.type === "component" ? { ...c, variant: c.variant?.map((v) => (v.property === from ? { ...v, property: to } : v)) } : c)) } : set))),
    renameValue: (setId, property, from, to) => setNodes((list) => updateNode(list, setId, (set) => (set.type === "componentSet" ? { ...set, children: set.children.map((c) => (c.type === "component" ? { ...c, variant: c.variant?.map((v) => (v.property === property && v.value === from ? { ...v, value: to } : v)) } : c)) } : set))),
    addProperty: (setId) => setNodes((list) => updateNode(list, setId, (set) => {
      if (set.type !== "componentSet") return set;
      const count = variantProperties(set).length + 1;
      return { ...set, children: set.children.map((c) => (c.type === "component" ? { ...c, variant: [...(c.variant ?? []), { property: `Property ${count}`, value: "Default" }] } : c)) };
    })),
    removeProperty: (setId, name) => setNodes((list) => updateNode(list, setId, (set) => (set.type === "componentSet" ? { ...set, children: set.children.map((c) => (c.type === "component" ? { ...c, variant: c.variant?.filter((v) => v.property !== name) } : c)) } : set))),
    // Component properties (booleans, texts, instance swaps): defined on the main component or its set, bound to its layers, valued on each instance.
    setComponentProperties: (holderId, properties) => onDoc((d) => updateAnywhere(d, holderId, (n) => {
      if (!isFrameLike(n)) return n;
      return { ...pruneBindings(n, new Set(properties.map((p) => p.id))), properties: properties.length ? properties : undefined };
    })),
    setPropertyValue: (holderId, propId, value) => onDoc((d) => updateAnywhere(d, holderId, (n) => {
      if (!isFrameLike(n)) return n;
      return { ...applyPropertyValue(n, propId, value), properties: (n.properties ?? []).map((p) => (p.id === propId ? { ...p, value } : p)) };
    })),
    bindProperty: (nodeId, kind, propId) => patch(nodeId, { [kind === "visible" ? "visibleProp" : kind === "text" ? "charactersProp" : "mainProp"]: propId } as Partial<SceneNode>),
    typeInInstance,
    setInstanceProp: (instanceId, propId, value, en) => onDoc((d) => updateAnywhere(d, instanceId, (n) => {
      if (n.type !== "instance") return n;
      if (en && typeof value === "string") return { ...n, propsEn: { ...n.propsEn, [propId]: value } };
      return { ...n, props: { ...n.props, [propId]: value } };
    })),
    swapVariant: (instanceId, property, value) => {
      const instance = getNode(nodes, instanceId);
      const main = instance?.type === "instance" && instance.mainId ? findComponent(library, instance.mainId) : null;
      const set = main ? setOf(library, main.id) : null;
      if (!main || !set) return;
      patch(instanceId, { mainId: pickVariant(set, main, property, value).id } as Partial<SceneNode>);
    },
    setReactions: (variantId, reactions) => patch(variantId, { reactions: reactions.length ? reactions : undefined } as Partial<SceneNode>),
    setLayoutFocus,
    preview: (id) => setPreviewing(id ?? previewTarget()),
    openVariables: () => setVariablesOpen(true),
    setBackground: (color) => onDoc((d) => {
      const pg = d.currentPage ? d.pages?.find((x) => x.id === d.currentPage) : undefined;
      return pg ? { ...d, pages: d.pages!.map((x) => (x.id === pg.id ? { ...x, background: color || undefined } : x)) } : { ...d, background: color || undefined };
    }),
    fitToContent: (id) => {
      const f = getNode(nodes, id);
      if (!f || !isFrameLike(f) || !f.children.length) return;
      const kids = f.children;
      const minX = Math.min(...kids.map((c) => c.x));
      const minY = Math.min(...kids.map((c) => c.y));
      const maxX = Math.max(...kids.map((c) => c.x + c.width));
      const maxY = Math.max(...kids.map((c) => c.y + c.height));
      setNodes((list) => updateNode(list, id, (n) => (isFrameLike(n) ? { ...n, x: n.x + minX, y: n.y + minY, width: Math.max(1, maxX - minX), height: Math.max(1, maxY - minY), children: n.children.map((c) => ({ ...c, x: c.x - minX, y: c.y - minY })) } : n)));
    },
    distribute: (axis) => {
      const tops = topmost(nodes, latest.current.selected.filter((id) => !id.includes("/")));
      if (tops.length < 3) return;
      const sorted = [...tops].sort((a, b) => (axis === "h" ? a.node.x - b.node.x : a.node.y - b.node.y));
      const size = (n: SceneNode) => (axis === "h" ? n.width : n.height);
      const first = sorted[0].node;
      const last = sorted[sorted.length - 1].node;
      const span = (axis === "h" ? last.x + last.width - first.x : last.y + last.height - first.y) - sorted.reduce((sum, t) => sum + size(t.node), 0);
      const gap = span / (sorted.length - 1);
      let at = axis === "h" ? first.x : first.y;
      const places = new Map<string, number>();
      for (const t of sorted) { places.set(t.node.id, Math.round(at)); at += size(t.node) + gap; }
      setNodes((list) => updateNodes(list, sorted.map((t) => t.node.id), (n) => ({ ...n, [axis === "h" ? "x" : "y"]: places.get(n.id) ?? (axis === "h" ? n.x : n.y) })));
    },
    tidy: () => {
      const tops = topmost(nodes, latest.current.selected.filter((id) => !id.includes("/")));
      if (tops.length < 2) return;
      const cols = Math.ceil(Math.sqrt(tops.length));
      const cellW = Math.max(...tops.map((t) => t.node.width)) + 16;
      const cellH = Math.max(...tops.map((t) => t.node.height)) + 16;
      const x0 = Math.min(...tops.map((t) => t.node.x));
      const y0 = Math.min(...tops.map((t) => t.node.y));
      const sorted = [...tops].sort((a, b) => a.node.y - b.node.y || a.node.x - b.node.x);
      const places = new Map(sorted.map((t, i) => [t.node.id, { x: x0 + (i % cols) * cellW, y: y0 + Math.floor(i / cols) * cellH }]));
      setNodes((list) => updateNodes(list, sorted.map((t) => t.node.id), (n) => ({ ...n, ...places.get(n.id) })));
    },
    effectStyles: file.effectStyles ?? [],
    createEffectStyle: (nodeId) => {
      const n = getNode(nodes, nodeId);
      if (!n || n.type === "text" || !n.effects?.length) return;
      const id = nid("es");
      const taken = file.effectStyles ?? [];
      let k = taken.length + 1;
      while (taken.some((st) => st.name === `Effect style ${k}`)) k++;
      onDoc((d) => ({ ...d, effectStyles: [...(d.effectStyles ?? []), { id, name: `Effect style ${k}`, effects: n.effects! }] }));
      patch(nodeId, { effectStyle: id } as Partial<SceneNode>);
    },
    applyEffectStyle: (nodeId, styleId) => {
      const st = file.effectStyles?.find((x) => x.id === styleId);
      if (st) patch(nodeId, { effects: st.effects, effectStyle: st.id } as Partial<SceneNode>);
    },
    detachEffectStyle: (nodeId) => patch(nodeId, { effectStyle: undefined } as Partial<SceneNode>),
    removeEffectStyle: (styleId) => onDoc((d) => ({ ...d, effectStyles: d.effectStyles?.filter((x) => x.id !== styleId) })),
    createTextStyle: (nodeId) => {
      const id = system.addTextStyle();
      const n = nodeId ? getNode(nodes, nodeId) : null;
      if (n && n.type === "text") {
        const size = numberOf(n.fontSize, byId, 16);
        let k = textStyles.length + 1;
        while (textStyles.some((st) => st.name === `${n.name} ${k}`)) k++;
        system.setTextStyle({ id, name: `${n.name} ${k}`, fontSize: n.fontSize, fontWeight: n.fontWeight, lineHeight: n.lineHeight ?? { value: Math.round(size * 1.25) }, letterSpacing: n.letterSpacing, color: n.fills[0]?.color ?? { value: "#000000" } });
        patch(n.id, { textStyle: id } as Partial<SceneNode>);
      }
    },
    setTextStyle: (st) => system.setTextStyle(st),
    removeTextStyle: (id) => system.removeTextStyle(id),
    createColorStyle: (hex) => {
      const id = system.addVariable("color");
      let k = variables.filter((v) => v.kind === "color").length + 1;
      while (variables.some((v) => v.name === `Color ${k}`)) k++;
      system.setVariable({ id, name: `Color ${k}`, kind: "color", light: { value: hex } });
      setVariablesOpen(true);
    },
    exportNode: (id, setting) => {
      const el = document.querySelector<HTMLElement>(`[data-figma-canvas] [data-node-id="${CSS.escape(id)}"]`);
      const n = getNode(nodes, id);
      if (el && n) exportElement(el, n.name, setting).catch((err) => console.warn("Could not export:", err));
    },
    upload: (f) => uploadFile(f, uploadPath(slug, f)),
    pageId: doc.pageId,
    addAutoLayout: () => autoLayout(),
    lockProportions: (id, on) => {
      if (!on) return patch(id, { lockAspect: undefined });
      // Its size as drawn (a Fill or Hug side's stored size may be an old one): the ratio kept is the one seen.
      const r = domRect(id);
      patch(id, { lockAspect: true, ...(r && r.w > 0 && r.h > 0 ? { width: Math.round(r.w), height: Math.round(r.h) } : {}) });
    },
    more: (el) => openMenuUnder(el, nodeMenu(selected[0] ?? null), "right"),
    maskWith: (id) => maskWith(id),
    // Several layers put at their places at once (the panel's spacing between selected layers).
    placeMany: (moves) => setNodes((list) => moves.reduce((l, m) => updateNode(l, m.id, (n) => ({ ...n, ...(m.x !== undefined ? { x: m.x } : {}), ...(m.y !== undefined ? { y: m.y } : {}) })), list)),
    menu: (el, entries) => openMenuUnder(el, entries, "right"),
    replaceColor: (from, to, opacity) => {
      const ids = latest.current.selected.filter((id) => !id.includes("/"));
      const swap = <P extends Paint>(p: P): P =>
        !("alias" in p.color) && String(p.color.value).toLowerCase() === from.toLowerCase() ? { ...p, color: { value: to }, ...(opacity !== undefined ? { opacity: opacity >= 100 ? undefined : opacity } : {}) } : p;
      const fix = (n: SceneNode): SceneNode => {
        const next = { ...n, fills: n.fills?.map(swap) } as SceneNode;
        if (next.type !== "text") (next as FrameNode).strokes = (next as FrameNode).strokes?.map(swap);
        return isFrameLike(next) ? { ...next, children: next.children.map(fix) } : next;
      };
      setNodes((list) => updateNodes(list, ids, fix));
    },
    pageColors: pageColors,
  };

  /** What the preview plays: the selected top-level frame, else the page. */
  const previewTarget = () => {
    const id = latest.current.selected[0]?.split("/")[0];
    const top = id ? findNode(nodes, id)?.path[0] : undefined;
    return top ?? doc.pageId;
  };

  // ── The canvas's callbacks ──
  const onMove = (moves: { id: string; x: number; y: number }[], copy = false) => {
    if (!copy) return setNodes((list) => moves.reduce((acc, m) => updateNode(acc, m.id, (n) => ({ ...n, x: m.x, y: m.y })), list));
    // Dragged with ⌥: the originals stay, their copies land where the drag ended.
    const made: string[] = [];
    setNodes((list) =>
      moves.reduce((acc, m) => {
        const found = findNode(acc, m.id);
        if (!found) return acc;
        const clone = { ...cloneNode(found.node), x: m.x, y: m.y };
        made.push(clone.id);
        return insertNode(acc, found.parent?.id ?? null, clone, found.index + 1);
      }, list)
    );
    setSelection(made);
  };
  const onReparent = (id: string, parentId: string | null, x: number, y: number, index?: number, copy = false) => {
    const found = findNode(nodes, id);
    if (!found || (!copy && isPageOverview(found.node))) return;
    const target = parentId ? getNode(nodes, parentId) : null;
    if (target && isFrameLike(target)) index = fromIndex(target.children, index);
    const auto = target && isFrameLike(target) && target.layoutMode !== "none";
    const source = copy ? cloneNode(found.node) : found.node;
    const moved: SceneNode = { ...source, x, y, ...(auto ? {} : { sizingH: found.node.sizingH === "fill" ? undefined : found.node.sizingH, sizingV: found.node.sizingV === "fill" ? undefined : found.node.sizingV }) };
    setNodes((list) => insertNode(copy ? list : removeNodes(list, new Set([id])), parentId, moved, index));
    if (copy) setSelection([moved.id]);
  };
  const onReorder = (id: string, index: number) => {
    const found = findNode(nodes, id);
    if (!found || !found.parent || isPageOverview(found.node)) return;
    const parent = found.parent;
    const rest = parent.children.filter((c) => c.id !== id);
    rest.splice(Math.min(fromIndex(rest, index) ?? index, rest.length), 0, found.node);
    patch(parent.id, { children: rest } as Partial<SceneNode>);
  };
  const onResize = (id: string, rect: Rect, changed: { x: boolean; y: boolean }) => {
    const found = findNode(nodes, id);
    if (!found) return;
    const inAuto = found.parent && found.parent.layoutMode !== "none";
    const p: Partial<SceneNode> = { width: rect.w, height: rect.h };
    if (!inAuto) { p.x = rect.x; p.y = rect.y; }
    // Proportions kept: both sides change, so both become Fixed (as Figma's).
    const lock = Boolean(found.node.lockAspect);
    if (changed.x || lock) p.sizingH = found.node.sizingH === "fill" || found.node.sizingH === "hug" ? undefined : found.node.sizingH;
    if (changed.y || lock) p.sizingV = found.node.sizingV === "fill" || found.node.sizingV === "hug" ? undefined : found.node.sizingV;
    if (found.node.type === "text") {
      const t = found.node;
      (p as Partial<SceneNode> & { textAutoResize?: string }).textAutoResize = changed.y ? "none" : t.textAutoResize === "widthHeight" && changed.x ? "height" : t.textAutoResize;
    }
    patch(id, p);
  };
  const onDraw = (drawn: CanvasTool, parentId: string | null, rect: Rect, clicked: boolean, index?: number) => {
    let node: SceneNode;
    if (drawn === "frame") node = makeFrame(nextName(nodes, "Frame"), rect.x, rect.y, rect.w, rect.h);
    else if (drawn === "text") { node = makeText(rect.x, rect.y, ""); if (!clicked) { node.width = rect.w; node.textAutoResize = "height"; } }
    else node = makeShape(drawn === "ellipse" ? "ellipse" : drawn === "line" ? "line" : "rectangle", nextName(nodes, drawn === "ellipse" ? "Ellipse" : drawn === "line" ? "Line" : "Rectangle"), rect.x, rect.y, rect.w, rect.h);
    const parent = parentId ? getNode(nodes, parentId) : null;
    setNodes((list) => insertNode(list, parentId, node, parent && isFrameLike(parent) ? fromIndex(parent.children, index) : index));
    setTool("move");
    setSelection([node.id]);
    if (drawn === "text") setEditing(node.id);
  };
  const onDoubleClick = (id: string) => {
    const node = getNode(nodes, id.split("/")[0]);
    const target = id.includes("/") ? null : node;
    if (target?.type === "text") {
      setSelection([id]);
      setEditing(id);
      return;
    }
    if (id.includes("/")) {
      // A text inside an instance: its override typed in place.
      setSelection([id]);
      if (layerAt(library, id)?.node.type === "text") setEditing(id);
      return;
    }
    setSelection([id]);
  };

  // Typing in a text in place: its words (the instance's, when it is an instance's — see typeInInstance).
  const editingCtx = useMemo<RenderContext["editing"]>(() => editing ? {
    id: editing,
    onInput: (id, text) => {
      if (editing.includes("/")) typeInInstance(editing, text, latest.current.lang === "en");
      else if (latest.current.lang === "en") patch(id, { charactersEn: text } as Partial<SceneNode>);
      // A text is named after its words — the project's own (the Overview's) keep their names.
      else patch(id, (getNode(latest.current.nodes, id)?.fixed ? { characters: text } : { characters: text, name: text.trim().slice(0, 40) || "Text" }) as Partial<SceneNode>);
    },
    onDone: () => setEditing(null),
  } : null, [editing, typeInInstance, patch]);
  const render = useMemo<RenderContext>(() => ({ nodes: library, byId, lang, play: false, editing: editingCtx }), [library, byId, lang, editingCtx]);

  // ── Layers ──
  const moveInTree = (id: string, targetId: string, where: TreePlace) => {
    // The Page Editor: nothing lands beside the page — above or below its row is into it.
    const place: TreePlace = targetId === pageRoot ? "inside" : where;
    const found = findNode(nodes, id);
    const target = findNode(nodes, targetId);
    if (!found || !target || target.path.includes(id) || isPageOverview(found.node)) return;
    const without = removeNodes(nodes, new Set([id]));
    if (place === "inside") {
      setNodes(() => insertNode(without, targetId, found.node));
      setOpen((prev) => new Set([...prev, targetId]));
      return;
    }
    const t2 = findNode(without, targetId)!;
    // The tree lists front first: "before" a row is after it in the list.
    const index = fromIndex(t2.parent ? t2.parent.children : without, place === "before" ? t2.index + 1 : t2.index);
    setNodes(() => insertNode(without, t2.parent?.id ?? null, found.node, index));
  };

  const reorder = (dir: "forward" | "backward" | "front" | "back") => {
    const id = selected[0];
    const found = id && !id.includes("/") ? findNode(nodes, id) : null;
    if (!found || isPageOverview(found.node)) return;
    const siblings = found.parent ? found.parent.children : nodes;
    const first = fromIndex(siblings, 0) ?? 0;
    const to = dir === "front" ? siblings.length - 1 : dir === "back" ? first : Math.max(first, Math.min(siblings.length - 1, found.index + (dir === "forward" ? 1 : -1)));
    if (to === found.index) return;
    setNodes((list) => insertNode(removeNodes(list, new Set([id])), found.parent?.id ?? null, found.node, to));
  };

  // ── Menus ──
  const openMenu = (e: React.MouseEvent, entries: MenuEntry[]) => {
    e.preventDefault();
    if (entries.length) setMenu({ x: e.clientX, y: e.clientY, entries });
  };
  const openMenuUnder = (el: HTMLElement, entries: MenuEntry[], align: "left" | "right" = "left") => {
    const r = el.getBoundingClientRect();
    setMenu({ x: align === "left" ? r.left : r.right - 200, y: r.bottom + 4, entries });
  };
  const nodeMenu = (id: string | null, at?: { x: number; y: number }): MenuEntry[] => {
    const node = id && !id.includes("/") ? getNode(nodes, id) : null;
    const pasteHere = { label: "Paste here", disabled: !clipboard.current.length, onSelect: () => (at ? pasteAt(at.x, at.y, id) : paste()) };
    if (!node) {
      return [
        pasteHere,
        "-",
        { label: "Undo", shortcut: keys("mod", "z"), onSelect: undo },
        { label: "Redo", shortcut: keys("shift", "mod", "z"), onSelect: redo },
        "-",
        ...(paged
          ? [{ label: "Scroll to top", shortcut: keys("shift", "1"), onSelect: () => zoomActions.current?.fitAll() }]
          : [
              { label: "Zoom to fit", shortcut: keys("shift", "1"), onSelect: () => zoomActions.current?.fitAll() },
              { label: "Zoom to 100%", shortcut: keys("shift", "0"), onSelect: () => zoomActions.current?.zoomTo(1) },
            ]),
        "-",
        { label: "Place image…", shortcut: keys("shift", "mod", "k"), onSelect: placeImage },
      ];
    }
    const found = findNode(nodes, id!);
    const top = found?.path.length === 1;
    const frame = isFrameLike(node);
    const variantSet = node.type === "component" ? setOf(nodes, node.id) : null;
    const chain = (found?.path ?? []).map((pid) => getNode(nodes, pid)).filter((n): n is SceneNode => Boolean(n));
    const otherPages = pages.filter((pg) => pg.id !== (file.currentPage ?? ""));
    const many = selected.filter((s) => !s.includes("/")).length > 1;
    // The Page Editor's page stays whole and in its place; so do the project's own layers (the page frame, its Overview).
    const fixed = node.id === pageRoot || stays.has(node.id);
    const own = Boolean(node.fixed);
    const alwaysShown = node.fixed === "overview" || node.fixed === "header" || node.fixed === "title";
    return [
      { label: "Copy", shortcut: keys("mod", "c"), onSelect: copySelection },
      pasteHere,
      { label: "Paste to replace", shortcut: keys("shift", "mod", "r"), disabled: fixed || !clipboard.current.length, onSelect: pasteToReplace },
      { label: "Copy/Paste as", items: [
        { label: "Copy as CSS", onSelect: () => void copyAs("css") },
        { label: "Copy as SVG", onSelect: () => void copyAs("svg") },
        { label: "Copy as PNG", onSelect: () => void copyAs("png") },
        "-",
        { label: "Copy properties", shortcut: keys("alt", "mod", "c"), onSelect: copyProperties },
        { label: "Paste properties", shortcut: keys("alt", "mod", "v"), disabled: !propsClipboard.current, onSelect: pasteProperties },
      ] },
      { label: "Duplicate", shortcut: keys("mod", "d"), disabled: node.id === pageRoot, onSelect: duplicateSelection },
      { label: "Delete", shortcut: keys("backspace"), disabled: fixed, onSelect: deleteSelection },
      { label: "Add motion", items: variantSet ? [
        { label: "On click → next variant", onSelect: () => addMotion(node.id, "click") },
        { label: "While hovering → next variant", onSelect: () => addMotion(node.id, "hover") },
        { label: "While pressing → next variant", onSelect: () => addMotion(node.id, "press") },
        "-",
        { label: "Open Prototype tab", onSelect: () => setRightTab("prototype") },
      ] : [
        { label: "Open Prototype tab", hint: "between variants", onSelect: () => setRightTab("prototype") },
      ] },
      "-",
      { label: "Select layer", items: chain.map((n) => ({ label: n.name, hint: KIND_HINT[n.type], checked: selected.includes(n.id), onSelect: () => setSelection([n.id]) })) },
      { label: "Move to page", disabled: fixed, items: otherPages.length ? otherPages.map((pg) => ({ label: pg.name, onSelect: () => moveToPage(pg.id) })) : [{ label: "No other pages", disabled: true }, { label: "Add new page", onSelect: addPage }] },
      { label: "Bring to front", shortcut: "]", disabled: isPageOverview(node), onSelect: () => reorder("front") },
      { label: "Send to back", shortcut: "[", disabled: isPageOverview(node), onSelect: () => reorder("back") },
      { label: "Bring forward", shortcut: keys("mod", "]"), disabled: isPageOverview(node), onSelect: () => reorder("forward") },
      { label: "Send backward", shortcut: keys("mod", "["), disabled: isPageOverview(node), onSelect: () => reorder("backward") },
      "-",
      { label: "Group selection", shortcut: keys("mod", "g"), disabled: fixed, onSelect: () => groupSelection("group") },
      { label: "Frame selection", shortcut: keys("alt", "mod", "g"), disabled: fixed, onSelect: () => groupSelection("frame") },
      { label: "Ungroup", shortcut: keys("mod", "backspace"), disabled: fixed || !(frame && node.type !== "instance"), onSelect: ungroup },
      { label: "Use as mask", shortcut: "^" + keys("mod", "m"), disabled: fixed || node.type === "text" || many, onSelect: () => maskWith(node.id) },
      "-",
      { label: frame && node.type !== "instance" && node.type !== "componentSet" && node.layoutMode !== "none" && !many ? "Remove auto layout" : "Add auto layout", shortcut: keys("shift", "a"), onSelect: () => autoLayout() },
      { label: "More layout options", items: [
        { label: "Width: Hug contents", checked: node.sizingH === "hug", onSelect: () => patch(node.id, { sizingH: "hug" }) },
        { label: "Width: Fill container", checked: node.sizingH === "fill", onSelect: () => patch(node.id, { sizingH: "fill" }) },
        { label: "Width: Fixed", checked: !node.sizingH, onSelect: () => patch(node.id, { sizingH: undefined }) },
        "-",
        { label: "Height: Hug contents", checked: node.sizingV === "hug", onSelect: () => patch(node.id, { sizingV: "hug" }) },
        { label: "Height: Fill container", checked: node.sizingV === "fill", onSelect: () => patch(node.id, { sizingV: "fill" }) },
        { label: "Height: Fixed", checked: !node.sizingV, onSelect: () => patch(node.id, { sizingV: undefined }) },
        ...(frame && node.layoutMode !== "none" ? ["-" as const,
          { label: "Wrap", checked: Boolean(node.layoutWrap), disabled: node.layoutMode !== "horizontal", onSelect: () => patch(node.id, { layoutWrap: node.layoutWrap ? undefined : true } as Partial<SceneNode>) },
          { label: "Clip content", checked: Boolean(node.clipsContent), onSelect: () => patch(node.id, { clipsContent: !node.clipsContent } as Partial<SceneNode>) },
        ] : []),
        ...(found?.parent && found.parent.layoutMode !== "none" ? ["-" as const, { label: "Absolute position", checked: Boolean(node.absolute), onSelect: () => patch(node.id, { absolute: node.absolute ? undefined : true }) }] : []),
      ] },
      ...(node.type === "frame" ? [{ label: "Create component", shortcut: keys("alt", "mod", "k"), disabled: fixed, onSelect: createComponent }] : []),
      ...(node.type === "component" || node.type === "componentSet" ? [{ label: "Add variant", onSelect: () => addVariant(node.id) }] : []),
      ...(node.type === "component" && selected.length > 1 ? [{ label: "Combine as variants", onSelect: combineAsVariants }] : []),
      ...(node.type === "instance" ? [
        { label: "Go to main component", onSelect: ops.goToMain },
        { label: "Reset all changes", disabled: !node.overrides, onSelect: ops.resetOverrides },
        { label: "Detach instance", shortcut: keys("alt", "mod", "b"), disabled: fixed, onSelect: detach },
      ] : []),
      ...(top && frame && node.type !== "componentSet" ? [{ label: "Set as site page", hint: "shown on the site", checked: doc.pageId === node.id, onSelect: () => onDoc((d) => withSitePage(d, node.id)) }] : []),
      "-",
      { label: node.visible === false ? "Show" : "Hide", shortcut: keys("shift", "mod", "h"), disabled: alwaysShown, onSelect: () => patch(node.id, { visible: node.visible === false ? undefined : false }) },
      { label: node.locked ? "Unlock" : "Lock", shortcut: keys("shift", "mod", "l"), onSelect: () => patch(node.id, { locked: node.locked ? undefined : true }) },
      { label: "Rename", shortcut: keys("mod", "r"), disabled: own, onSelect: () => { setLeftTab("file"); requestAnimationFrame(() => requestRename(node.id)); } },
      "-",
      { label: "Flip horizontal", shortcut: keys("shift", "h"), checked: Boolean(node.flipH), onSelect: () => flip("H") },
      { label: "Flip vertical", shortcut: keys("shift", "v"), checked: Boolean(node.flipV), onSelect: () => flip("V") },
    ];
  };
  const shellMenu = (): MenuEntry[] => [
    { label: "Back to projects", onSelect: () => router.push("/admin/projects") },
    "-",
    { label: "Undo", shortcut: keys("mod", "z"), onSelect: undo },
    { label: "Redo", shortcut: keys("shift", "mod", "z"), onSelect: redo },
    "-",
    { label: "View on site", disabled: !isPublished, onSelect: () => window.open(`/projects/${slug}`, "_blank") },
    { label: "Present", onSelect: () => setPreviewing(previewTarget()) },
    ...(onRebuildPage ? ["-" as const, { label: "Rebuild page from old editor", hint: "replaces the page", onSelect: () => { setSelectionState([]); setEditing(null); if (file.currentPage) switchPage(""); onRebuildPage(); } }] : []),
    "-",
    { label: theme === "dark" ? "Light theme" : "Dark theme", onSelect: toggleTheme },
    { label: minimized ? "Show UI" : "Hide UI", shortcut: keys("mod", "\\"), onSelect: () => setMinimized((m) => !m) },
    ...(mode === "canvas" ? [{ label: rulers ? "Hide rulers" : "Show rulers", shortcut: keys("shift", "r"), onSelect: () => setRulers((r) => !r) }] : []),
  ];
  const zoomMenu = (): MenuEntry[] => paged ? [
    // The page is at its own scale (100%, or what fits the view's width): its menu scrolls.
    { label: "Scroll to top", shortcut: keys("shift", "1"), onSelect: () => zoomActions.current?.fitAll() },
    { label: "Scroll to selection", shortcut: keys("shift", "2"), disabled: !selected.length, onSelect: () => zoomActions.current?.fitSelection() },
  ] : [
    { label: "Zoom in", shortcut: keys("mod", "+"), onSelect: () => zoomActions.current?.zoomTo(view.zoom * 2) },
    { label: "Zoom out", shortcut: keys("mod", "-"), onSelect: () => zoomActions.current?.zoomTo(view.zoom / 2) },
    "-",
    { label: "Zoom to fit", shortcut: keys("shift", "1"), onSelect: () => zoomActions.current?.fitAll() },
    { label: "Zoom to selection", shortcut: keys("shift", "2"), disabled: !selected.length, onSelect: () => zoomActions.current?.fitSelection() },
    "-",
    { label: "Zoom to 50%", onSelect: () => zoomActions.current?.zoomTo(0.5) },
    { label: "Zoom to 100%", shortcut: keys("shift", "0"), onSelect: () => zoomActions.current?.zoomTo(1) },
    { label: "Zoom to 200%", onSelect: () => zoomActions.current?.zoomTo(2) },
  ];
  const headerMenu = (node: SceneNode): MenuItem[] => {
    const found = findNode(nodes, node.id);
    return (found?.path.slice(0, -1) ?? []).map((id) => {
      const n = getNode(nodes, id)!;
      return { label: n.name, hint: n.type, onSelect: () => setSelection([id]) };
    });
  };

  // ── Keys ──
  /** Paste here: the clipboard's layers put where the pointer is (into the frame under it). */
  const pasteAt = (clientX: number, clientY: number, targetId: string | null) => {
    if (!clipboard.current.length) return;
    const canvasEl = document.querySelector<HTMLElement>("[data-figma-canvas]");
    const base = canvasEl?.getBoundingClientRect() ?? { left: 0, top: 0 };
    const at = { x: (clientX - base.left - view.x) / view.zoom, y: (clientY - base.top - view.y) / view.zoom };
    const target = targetId ? findNode(nodes, targetId) : null;
    const into = target && (target.node.type === "frame" || target.node.type === "component") ? target.node.id : target?.parent?.id ?? pageRoot;
    const originEl = into ? document.querySelector<HTMLElement>(`[data-figma-canvas] [data-node-id="${CSS.escape(into)}"]`) : null;
    const or = originEl?.getBoundingClientRect();
    const origin = or ? { x: (or.left - base.left - view.x) / view.zoom, y: (or.top - base.top - view.y) / view.zoom } : { x: 0, y: 0 };
    const first = clipboard.current[0];
    const copies = clipboard.current.map((n) => ({ ...cloneNode(n), x: Math.round(at.x - origin.x + (n.x - first.x)), y: Math.round(at.y - origin.y + (n.y - first.y)) }));
    setNodes((list) => copies.reduce((acc, c) => insertNode(acc, into, c), list));
    setSelection(copies.map((c) => c.id));
  };
  /** Paste to replace (⇧⌘R): each selected layer swapped for the clipboard's first, at its place. */
  const pasteToReplace = () => {
    const source = clipboard.current[0];
    if (!source) return;
    const tops = topmost(nodes, latest.current.selected.filter(removable));
    if (!tops.length) return;
    const made: string[] = [];
    setNodes((list) => tops.reduce((acc, t) => {
      const found = findNode(acc, t.node.id);
      if (!found) return acc;
      const copy = { ...cloneNode(source), x: found.node.x, y: found.node.y };
      made.push(copy.id);
      return insertNode(removeNodes(acc, new Set([found.node.id])), found.parent?.id ?? null, copy, found.index);
    }, list));
    setSelection(made);
  };
  const copyAs = async (kind: "css" | "svg" | "png") => {
    const id = latest.current.selected[0]?.split("/")[0];
    const n = id ? getNode(nodes, id) : null;
    if (!id || !n) return;
    if (kind === "css") {
      const css = nodeCss(n, "none", byId);
      const text = Object.entries(css).map(([k, v]) => `${k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}: ${typeof v === "number" && !/opacity|weight|grow|shrink|z-index/i.test(k) ? `${v}px` : v};`).join("\n");
      return navigator.clipboard.writeText(text);
    }
    const el = document.querySelector<HTMLElement>(`[data-figma-canvas] [data-node-id="${CSS.escape(id)}"]`);
    if (el) await copyElementAs(el, kind).catch((err) => console.warn("Could not copy:", err));
  };
  /** Move to page: the layers taken out of this page and put on another, at their places. */
  const moveToPage = (pageId: string) => {
    const tops = topmost(nodes, latest.current.selected.filter(removable));
    if (!tops.length) return;
    const ids = new Set(tops.map((t) => t.node.id));
    const moving = tops.map((t) => t.node);
    onDoc((d) => {
      const from = d.currentPage ?? "";
      if (from === pageId) return d;
      let next = d;
      // Out of the open page…
      next = from ? { ...next, pages: next.pages?.map((pg) => (pg.id === from ? { ...pg, nodes: removeNodes(pg.nodes, ids) } : pg)) } : { ...next, nodes: removeNodes(next.nodes, ids) };
      // …and onto the other.
      next = pageId ? { ...next, pages: next.pages?.map((pg) => (pg.id === pageId ? { ...pg, nodes: [...pg.nodes, ...moving] } : pg)) } : { ...next, nodes: [...next.nodes, ...moving] };
      return next;
    });
    setSelection([]);
  };
  /** Use as mask (^⌘M): the layer becomes a clipping frame around the layers above it in its parent — Figma's mask, as the DOM can draw it. */
  const maskWith = (id: string) => {
    const found = findNode(nodes, id);
    if (!found || found.node.type === "text" || id === pageRoot) return;
    const mask = found.node;
    const siblings = found.parent ? found.parent.children : nodes;
    const above = siblings.slice(found.index + 1);
    if ([mask, ...above].some((n) => stays.has(n.id))) return;
    const frame = makeFrame(`${mask.name} (mask group)`, mask.x, mask.y, mask.width, mask.height);
    frame.fills = [];
    frame.clipsContent = true;
    if (mask.type === "ellipse") frame.cornerRadius = { value: 9999 };
    else if (mask.type !== "line" && (mask.cornerRadius || mask.corners)) { frame.cornerRadius = mask.cornerRadius; frame.corners = mask.corners; }
    frame.children = [{ ...mask, x: 0, y: 0, visible: false, name: `${mask.name} (mask)` }, ...above.map((n) => ({ ...n, x: n.x - mask.x, y: n.y - mask.y }))];
    const gone = new Set([mask.id, ...above.map((n) => n.id)]);
    setNodes((list) => insertNode(removeNodes(list, gone), found.parent?.id ?? null, frame, found.index));
    setSelection([frame.id]);
  };
  /** Add motion: a variant's reaction to its set's next variant (Figma's quick prototyping). */
  const addMotion = (id: string, trigger: "click" | "hover" | "press") => {
    const set = setOf(nodes, id);
    const node = getNode(nodes, id);
    if (!set || !node || node.type !== "component") { setRightTab("prototype"); return; }
    const variants = variantsOf(set);
    const i = variants.findIndex((v) => v.id === id);
    const target = variants[(i + 1) % variants.length];
    if (!target || target.id === id) { setRightTab("prototype"); return; }
    ops.setReactions(id, [...(node.reactions ?? []), { id: nid("r"), trigger, target: target.id, animation: "smart", easing: "ease-out", duration: 300 }]);
    setRightTab("prototype");
  };
  /** ⇧A as Figma's: one frame → its auto layout on or off (⌥⇧A: off); anything else — several layers, a shape, a text, an instance — wrapped in a new auto layout frame. */
  const autoLayout = (remove = false) => {
    const tops = topmost(nodes, latest.current.selected.filter((id) => !id.includes("/")));
    if (!tops.length) return;
    const only = tops.length === 1 ? tops[0].node : null;
    if (only && isFrameLike(only) && only.type !== "instance") return ops.setAutoLayout(only.id, remove || only.layoutMode !== "none" ? "none" : "vertical");
    if (!remove) groupSelection("auto");
  };
  const flip = (axis: "H" | "V") => {
    const ids = latest.current.selected.filter((id) => !id.includes("/"));
    if (!ids.length) return;
    setNodes((list) => updateNodes(list, ids, (n) => (axis === "H" ? { ...n, flipH: n.flipH ? undefined : true } : { ...n, flipV: n.flipV ? undefined : true })));
  };

  // ⇧⌘K: a picture from the disk, placed as a rectangle filled with it, in the middle of the view.
  /** A picture placed as a rectangle of its own proportions (800px wide at most), in the middle of the view — in the Page Editor, into the page, at its flow's end. */
  const placeImageUrl = async (url: string, name: string) => {
    const img = new Image();
    await new Promise<void>((resolve) => { img.onload = () => resolve(); img.onerror = () => resolve(); img.src = url; });
    const scale = Math.min(1, 800 / Math.max(1, img.naturalWidth || 800));
    const w = Math.round((img.naturalWidth || 400) * scale);
    const h = Math.round((img.naturalHeight || 300) * scale);
    const canvas = document.querySelector<HTMLElement>("[data-figma-canvas]");
    const cx = ((canvas?.clientWidth ?? 800) / 2 - view.x) / view.zoom;
    const cy = ((canvas?.clientHeight ?? 600) / 2 - view.y) / view.zoom;
    const shape = makeShape("rectangle", name || "Image", pageRoot ? 0 : cx - w / 2, pageRoot ? 0 : cy - h / 2, w, h);
    shape.fills = [{ type: "image", color: { value: "#d9d9d9" }, image: { url, fit: "fill" } }];
    setNodes((list) => insertNode(list, pageRoot, shape));
    setSelection([shape.id]);
  };
  const placeImage = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) return;
      const url = await uploadFile(f, uploadPath(slug, f));
      await placeImageUrl(url, f.name.replace(/\.[^.]+$/, ""));
    };
    input.click();
  };
  /**
   * An image of the bucket put to use (the Images panel): the picture of the
   * selected layers' fills — their image fill's, or a new one on top; inside
   * an instance, its override — or, nothing that takes a fill selected, a
   * picture placed on the canvas.
   */
  const putImage = (url: string, name: string) => {
    const paint: Paint = { type: "image", color: { value: "#d9d9d9" }, image: { url, fit: "fill" } };
    const pictured = (fills: Paint[]): Paint[] => {
      const i = fills.findIndex((p) => p.type === "image");
      return i < 0 ? [paint, ...fills] : fills.map((p, j) => (j === i ? { ...p, visible: undefined, image: { url, fit: p.image?.fit ?? "fill" } } : p));
    };
    // Where each selected layer's picture goes: its own fills — an instance's (or a layer's inside one), as an override: of the layer of
    // its component that shows a picture (the Overview's cover), else of its own fills. A text takes none.
    const { selected: sel, nodes: list } = latest.current;
    const own: string[] = [];
    const overrides: { id: string; fills: Paint[] }[] = [];
    for (const id of sel) {
      const node = id.includes("/") ? layerAt(library, id)?.node : getNode(list, id);
      if (!node || node.type === "text") continue;
      if (node.type === "instance") {
        const resolved = resolveInstance(library, node);
        const at = resolved ? pictureIn(resolved.children) : null;
        overrides.push(at ? { id: `${id}/${at.key}`, fills: at.fills } : { id: `${id}/`, fills: resolved?.fills ?? node.fills });
      } else if (id.includes("/")) overrides.push({ id, fills: node.fills });
      else own.push(id);
    }
    if (!own.length && !overrides.length) return void placeImageUrl(url, name);
    if (own.length) setNodes((ns) => updateNodes(ns, own, (n) => (n.type === "text" ? n : { ...n, fills: pictured(n.fills) })));
    overrides.forEach((o) => override(o.id, { fills: pictured(o.fills) }));
  };
  // The Images panel's: stable (it is memoized, mounted while hidden), the latest putImage behind it.
  const putImageRef = useRef(putImage);
  useEffect(() => {
    putImageRef.current = putImage;
  });
  const onUseImage = useCallback((url: string, name: string) => putImageRef.current(url, name), []);

  // ⌥⌘C / ⌥⌘V: a layer's look (fills, strokes, effects, corners, opacity) carried to others.
  const propsClipboard = useRef<Partial<SceneNode> | null>(null);
  const copyProperties = () => {
    const n = latest.current.selected[0] ? getNode(nodes, latest.current.selected[0].split("/")[0]) : null;
    if (!n) return;
    const look: Record<string, unknown> = { fills: n.fills, opacity: n.opacity };
    if (n.type !== "text") Object.assign(look, { strokes: n.strokes, effects: n.effects, cornerRadius: n.cornerRadius, corners: n.corners });
    else Object.assign(look, { fontSize: n.fontSize, fontWeight: n.fontWeight, lineHeight: n.lineHeight, letterSpacing: n.letterSpacing, textAlign: n.textAlign, textStyle: n.textStyle });
    propsClipboard.current = look as Partial<SceneNode>;
  };
  const pasteProperties = () => {
    const look = propsClipboard.current;
    if (!look) return;
    setNodes((list) => updateNodes(list, latest.current.selected.filter((id) => !id.includes("/")), (n) => {
      const next = { ...n } as Record<string, unknown>;
      for (const [k, v] of Object.entries(look)) {
        if (k === "fills" || k === "opacity") next[k] = v;
        else if (n.type === "text" ? ["fontSize", "fontWeight", "lineHeight", "letterSpacing", "textAlign", "textStyle"].includes(k) : ["strokes", "effects", "cornerRadius", "corners"].includes(k)) next[k] = v;
      }
      return next as unknown as SceneNode;
    }));
  };
  const [rulers, setRulers] = useState(true);
  const actions = useRef({ deleteSelection, duplicateSelection, copySelection, paste, groupSelection, ungroup, createComponent, detach, reorder, ops, undo, redo, copyProperties, pasteProperties, placeImage, pasteToReplace, flip, maskWith, autoLayout });
  useEffect(() => {
    actions.current = { deleteSelection, duplicateSelection, copySelection, paste, groupSelection, ungroup, createComponent, detach, reorder, ops, undo, redo, copyProperties, pasteProperties, placeImage, pasteToReplace, flip, maskWith, autoLayout };
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // The prototype's window has its own keys (Esc closes it).
      if (isTyping() || latest.current.previewing || document.querySelector("[role=menu]")) return;
      const { selected: sel, nodes: list, tool: current, mode: shownMode, pageRoot: root } = latest.current;
      // The code's view has nothing to pick or draw: only the UI's own key.
      if (shownMode === "code") {
        const mod = e.metaKey || e.ctrlKey;
        if (mod && e.code === "Backslash") { e.preventDefault(); setMinimized((m) => !m); }
        // (Its panels still edit: their changes undo as anywhere.)
        else if (mod && e.code === "KeyZ") { e.preventDefault(); if (e.shiftKey) actions.current.redo(); else actions.current.undo(); }
        else if (mod && e.code === "KeyY") { e.preventDefault(); actions.current.redo(); }
        return;
      }
      const a = actions.current;
      const mod = e.metaKey || e.ctrlKey;
      const { shiftKey: shift, altKey: alt, code } = e;
      const first = sel[0];
      const own = sel.filter((id) => !id.includes("/"));
      const handled = () => e.preventDefault();
      // The top level as shown: in the Page Editor, the page frame alone (what sits beside it isn't drawn there).
      const tops = root ? list.filter((n) => n.id === root) : list;
      // Matched by the key's code: with ⌥ held a Mac changes e.key ("˚" for K), the code stays.
      const is = (...codes: string[]) => codes.includes(code);
      const texts = own.map((id) => getNode(list, id)).filter((n): n is TextNode => n?.type === "text");
      const bump = (field: "fontSize" | "fontWeight" | "letterSpacing" | "lineHeight", by: number, min: number, max: number) => {
        if (!texts.length) return false;
        handled();
        setNodes((ns) => updateNodes(ns, texts.map((t) => t.id), (n) => {
          if (n.type !== "text") return n;
          const v = n[field];
          const base = v && "value" in v ? Number(v.value) : field === "fontSize" ? 16 : field === "fontWeight" ? 400 : field === "lineHeight" ? Math.round(numberOf(n.fontSize, byId) * 1.2) : 0;
          return { ...n, [field]: { value: Math.min(max, Math.max(min, base + by)) } };
        }));
        return true;
      };

      if (is("Escape")) {
        handled();
        if (current !== "move") return setTool("move");
        const found = first && !first.includes("/") ? findNode(list, first) : null;
        if (first?.includes("/")) return setSelection([first.split("/")[0]]);
        return setSelection(found?.parent ? [found.parent.id] : []);
      }
      if (is("Enter", "NumpadEnter")) {
        const node = first && !first.includes("/") ? getNode(list, first) : null;
        if (shift) {
          const found = node ? findNode(list, node.id) : null;
          if (found?.parent) { handled(); setSelection([found.parent.id]); }
          return;
        }
        if (node && isFrameLike(node) && node.children.length) { handled(); setSelection([node.children[node.children.length - 1].id]); }
        else if (node?.type === "text") { handled(); setEditing(node.id); }
        return;
      }
      // Tab: the next layer beside it (⇧: the one before).
      if (is("Tab") && !mod && !alt) {
        const found = first && !first.includes("/") ? findNode(list, first) : null;
        const sibs = found ? (found.parent ? found.parent.children : tops) : tops;
        if (!sibs.length) return;
        handled();
        const i = found ? sibs.findIndex((n) => n.id === found.node.id) : -1;
        return setSelection([sibs[((i < 0 ? (shift ? 0 : -1) : i) + (shift ? -1 : 1) + sibs.length) % sibs.length].id]);
      }
      if (is("Backspace", "Delete") && !mod) { handled(); return a.deleteSelection(); }
      if (e.key.startsWith("Arrow") && !mod) {
        const step = shift ? 10 : 1;
        const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
        const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
        const tops = topmost(list, own).filter((t) => t.node.id !== root);
        if (!tops.length) return;
        handled();
        return setNodes((ns) => updateNodes(ns, tops.map((t) => t.node.id), (n) => ({ ...n, x: n.x + dx, y: n.y + dy })));
      }

      // ── The view ──
      if (mod && !alt && is("Equal", "NumpadAdd", "Minus", "NumpadSubtract")) { handled(); return zoomActions.current?.zoomTo(is("Minus", "NumpadSubtract") ? view.zoom / 2 : view.zoom * 2); }
      if (shift && !mod && !alt && is("Digit0", "Digit1", "Digit2")) {
        handled();
        if (is("Digit0")) zoomActions.current?.zoomTo(1);
        else if (is("Digit1")) zoomActions.current?.fitAll();
        else zoomActions.current?.fitSelection();
        return;
      }
      if (mod && is("Backslash")) { handled(); return setMinimized((m) => !m); }
      if (shift && !mod && !alt && is("KeyR")) { handled(); return setRulers((r) => !r); }

      // ── Undo, the clipboard ──
      if (mod && is("KeyZ")) { handled(); return shift ? a.redo() : a.undo(); }
      if (mod && is("KeyY")) { handled(); return a.redo(); }
      if (mod && !shift && !alt && is("KeyD")) { handled(); return a.duplicateSelection(); }
      if (mod && alt && is("KeyC")) { handled(); return a.copyProperties(); }
      if (mod && alt && is("KeyV")) { handled(); return a.pasteProperties(); }
      if (mod && !shift && is("KeyC") && !window.getSelection()?.toString()) { handled(); return a.copySelection(); }
      if (mod && !shift && is("KeyX")) { handled(); a.copySelection(); return a.deleteSelection(); }
      if (mod && !shift && is("KeyV")) { handled(); return a.paste(); }
      if (mod && !shift && !alt && is("KeyA")) {
        handled();
        const found = first && !first.includes("/") ? findNode(list, first) : null;
        return setSelection((found?.parent ? found.parent.children : tops).map((n) => n.id));
      }

      // ── Alignment: ⌥A D W S H V ──
      if (alt && !mod && !shift && own.length) {
        const how = ({ KeyA: "left", KeyD: "right", KeyW: "top", KeyS: "bottom", KeyH: "hcenter", KeyV: "vcenter" } as const)[code as "KeyA"];
        if (how) { handled(); return a.ops.align(how); }
      }

      // ── Groups, components, order, auto layout ──
      if (mod && alt && is("KeyG")) { handled(); return a.groupSelection("frame"); }
      if (mod && shift && is("KeyG")) { handled(); return a.ungroup(); }
      if (mod && !shift && is("KeyG")) { handled(); return a.groupSelection("group"); }
      if (mod && alt && is("KeyK")) { handled(); return a.createComponent(); }
      if (mod && shift && is("KeyK")) { handled(); return a.placeImage(); }
      if (mod && shift && is("KeyR")) { handled(); return a.pasteToReplace(); }
      if (mod && !shift && !alt && is("Backspace")) { handled(); return a.ungroup(); }
      if (e.ctrlKey && e.metaKey && is("KeyM") && first) { handled(); return a.maskWith(first.split("/")[0]); }
      // Figma's ^⌥T / ^⌥V / ^⌥H: tidy up, distribute vertical / horizontal spacing.
      if (e.ctrlKey && alt && !mod && is("KeyT", "KeyV", "KeyH") && own.length > 1) { handled(); return is("KeyT") ? a.ops.tidy() : a.ops.distribute(is("KeyV") ? "v" : "h"); }
      if (!mod && !alt && is("BracketRight", "BracketLeft")) { handled(); return a.reorder(is("BracketRight") ? "front" : "back"); }
      if (!mod && shift && !alt && is("KeyH", "KeyV") && own.length) { handled(); return a.flip(is("KeyH") ? "H" : "V"); }
      if (mod && alt && is("KeyB")) { handled(); return a.detach(); }
      if (mod && shift && is("KeyH") && first) { handled(); const n = getNode(list, first.split("/")[0]); return n && patch(n.id, { visible: n.visible === false ? undefined : false }); }
      if (mod && shift && is("KeyL") && first) { handled(); const n = getNode(list, first.split("/")[0]); return n && patch(n.id, { locked: n.locked ? undefined : true }); }
      if (mod && !shift && !alt && is("KeyR") && first) { handled(); setLeftTab("file"); return requestAnimationFrame(() => requestRename(first.split("/")[0])); }
      if (mod && is("BracketRight", "BracketLeft")) { handled(); return a.reorder(alt ? (is("BracketRight") ? "front" : "back") : is("BracketRight") ? "forward" : "backward"); }
      if (!mod && shift && is("KeyA") && own.length) { handled(); return a.autoLayout(alt); }

      // ── Text: ⇧⌘< > size, ⌥< > letter spacing, ⇧⌥< > line height, ⌥⌘< > weight, ⌘B bold ──
      if (texts.length && is("Comma", "Period")) {
        const up = is("Period") ? 1 : -1;
        if (mod && shift && !alt) return bump("fontSize", up, 1, 400);
        if (mod && alt && !shift) return bump("fontWeight", up * 100, 100, 900);
        if (alt && shift && !mod) return bump("lineHeight", up, 1, 1000);
        if (alt && !mod && !shift) return bump("letterSpacing", up * 0.1, -20, 100);
      }
      if (mod && !shift && !alt && is("KeyB") && texts.length) {
        handled();
        return setNodes((ns) => updateNodes(ns, texts.map((t) => t.id), (n) => (n.type === "text" ? { ...n, fontWeight: { value: numberOf(n.fontWeight, byId) >= 600 ? 400 : 700 } } : n)));
      }

      // ── Opacity: 1…9 → 10…90 %, 0 → 100 % ──
      if (!mod && !alt && !shift && own.length && /^Digit[0-9]$/.test(code)) {
        handled();
        const digit = Number(code.slice(5));
        return setNodes((ns) => updateNodes(ns, own, (n) => ({ ...n, opacity: digit === 0 ? undefined : digit * 10 })));
      }

      if (mod || alt || shift || e.repeat) return;
      const tools: Partial<Record<string, CanvasTool>> = { KeyV: "move", KeyH: "hand", KeyF: "frame", KeyA: "frame", KeyR: "rectangle", KeyO: "ellipse", KeyL: "line", KeyT: "text" };
      const next = tools[code];
      if (next) { handled(); setTool(next); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [view.zoom, patch, setNodes, setSelection, byId]);

  // ── Assets: the file's components, an instance put on the canvas with a click ──
  const components = useMemo(() => allComponents(library), [library]);
  const insertInstance = (component: FrameNode) => {
    const canvas = document.querySelector<HTMLElement>("[data-figma-canvas]");
    const w = canvas?.clientWidth ?? 800;
    const h = canvas?.clientHeight ?? 600;
    const cx = (w / 2 - view.x) / view.zoom;
    const cy = (h / 2 - view.y) / view.zoom;
    const instance = makeInstance(component, Math.round(cx - component.width / 2), Math.round(cy - component.height / 2));
    // On the project's page: into its page frame (at the end of its flow), as a section of the site.
    const page = !file.currentPage ? getNode(nodes, doc.pageId) : null;
    const into = page && isFrameLike(page) && page.id !== component.id ? page : null;
    setNodes((list) => insertNode(list, into?.id ?? null, into ? { ...instance, x: 0, y: 0 } : instance));
    setSelection([instance.id]);
  };

  // The layers listed: the open page's — in the Page Editor, the page frame's own tree (what sits beside it on the canvas isn't drawn there).
  const layerNodes = useMemo(() => (pageRoot ? nodes.filter((n) => n.id === pageRoot) : nodes), [nodes, pageRoot]);
  const previewNode = previewing ? getNode(nodes, previewing) : null;
  const previewCtx = useMemo<RenderContext>(() => ({ nodes: library, byId, lang, play: true }), [library, byId, lang]);

  return (
    <div className="relative flex h-full min-h-0 text-[11px] leading-4 text-[var(--text-title)]" style={{ ...FIGMA_TOKENS[theme], fontFamily: "var(--font-inter), Inter, ui-sans-serif, system-ui, sans-serif" }}>
      <style>{EDITOR_CSS}</style>
      {/* ── The navigation bar: the menu, then the tabs with their labels ── */}
      {/* (64px wide: room for its longest label, "Components", at the labels' 10px.) */}
      {!minimized && (
        <nav aria-label="Navigation" className="w-16 shrink-0 h-full flex flex-col items-center border-r border-[var(--f-border)] bg-[var(--f-bg)] z-20 select-none">
          <button type="button" aria-label="Main menu" aria-haspopup="menu" onClick={(e) => openMenuUnder(e.currentTarget, shellMenu())} className="flex items-center justify-center w-16 h-12 text-[var(--f-icon)] hover:bg-[var(--f-bg-hover)] transition-colors cursor-pointer">
            <span className="flex items-center">{fi("24.figma")}<span className="-ml-1 text-[var(--f-icon-secondary)]">{fi("16.chevron.down")}</span></span>
          </button>
          <span className="w-6 h-px my-1 bg-[var(--f-border)]" />
          <NavTab icon={fi("24.page")} label="File" active={tab === "file"} onClick={() => openTab("file")} />
          <NavTab icon={fi("24.library")} label="Assets" active={tab === "assets"} onClick={() => openTab("assets")} />
          <NavTab icon={fi("24.component")} label="Components" active={tab === "components"} onClick={() => openTab("components")} />
          <NavTab icon={fi("24.image")} label="Images" active={tab === "images"} onClick={() => openTab("images")} />
          <NavTab icon={fi("variable.small")} label="Variables" active={variablesOpen} onClick={() => setVariablesOpen(true)} />
        </nav>
      )}

      {/* ── The left sidebar ── */}
      {!minimized && (
        <aside data-left-panel="" className="relative shrink-0 h-full flex flex-col border-r border-[var(--f-border)] bg-[var(--f-bg)] z-10" style={{ width: panelWidths.left }}>
          <div role="separator" aria-orientation="vertical" aria-label="Resize sidebar" onPointerDown={resizePanel("left")} className="absolute top-0 bottom-0 -right-[3px] w-[6px] z-30 cursor-col-resize hover:bg-[var(--f-border-selected)]/40 active:bg-[var(--f-border-selected)]/40" />
          <div className="shrink-0 flex items-start gap-1 h-14 pl-4 pr-2 pt-2 border-b border-[var(--f-border)]">
            <div className="min-w-0 flex-1 flex flex-col">
              <button type="button" aria-haspopup="menu" onClick={(e) => openMenuUnder(e.currentTarget, shellMenu())} className="flex items-center gap-1 min-w-0 h-[22px] text-left cursor-pointer">
                <span className="min-w-0 truncate text-[13px] font-[550] leading-[22px] tracking-[-0.0325px] text-[var(--f-text)]">{title || slug}</span>
                <span className="shrink-0 text-[var(--f-icon-secondary)]">{fi("16.chevron.down")}</span>
              </button>
              <span className="truncate text-[11px] leading-4 tracking-[0.055px] text-[var(--f-text-secondary)]">Projects</span>
            </div>
            <IconButton label="Hide UI (⌘\\)" icon={fi("24.sidebar.closed")} onClick={() => setMinimized(true)} />
          </div>
          {(tab === "file" || tab === "components") && (
            <>
              {tab === "file" && (
              <section aria-label="Pages" className="shrink-0 flex flex-col pb-2 border-b border-[var(--f-border)]">
                <CollapseHeader
                  label="Pages"
                  icons={
                    <>
                      <IconButton label="Find" icon={fi("24.search.small")} active={query !== null} onClick={() => setQuery((q) => (q === null ? "" : null))} />
                      <IconButton label="Add new page" icon={fi("plus.small")} onClick={addPage} />
                    </>
                  }
                />
                <div className="flex flex-col px-2 py-1">
                  {pages.filter((pg) => pg.id !== COMPONENTS_PAGE_ID).map((pg) => {
                    const current = (file.currentPage ?? "") === pg.id;
                    return (
                      <div
                        key={pg.id || "main"}
                        onClick={() => !current && switchPage(pg.id)}
                        onDoubleClick={() => setRenamingPage(pg.id)}
                        onContextMenu={(e) => openMenu(e, [{ label: "Rename page", onSelect: () => setRenamingPage(pg.id) }, { label: "Delete page", disabled: !pg.id, onSelect: () => removePage(pg.id) }])}
                        className={cn("flex items-center h-8 pl-2 pr-1 rounded-[5px] text-[11px] font-[450] leading-4 text-[var(--f-text)] cursor-pointer", current ? "bg-[var(--f-bg-row-selected)]" : "hover:bg-[var(--f-bg-row-hover)]")}
                      >
                        {renamingPage === pg.id ? (
                          <input autoFocus aria-label="Page name" defaultValue={pg.name} onFocus={(e) => e.currentTarget.select()} onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Enter") { renamePage(pg.id, e.currentTarget.value); setRenamingPage(null); } if (e.key === "Escape") setRenamingPage(null); }} onBlur={(e) => { renamePage(pg.id, e.currentTarget.value); setRenamingPage(null); }} className="min-w-0 flex-1 h-5 px-1 rounded-[3px] bg-[var(--f-bg)] border border-[var(--f-border-selected)] outline-none" />
                        ) : (
                          <>
                            <span className="min-w-0 flex-1 truncate">{pg.name}</span>
                            {!pg.id && <span className="text-[var(--f-text-secondary)]" title="Shown on the site">{fi("16.page")}</span>}
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
              )}
              <CollapseHeader
                label={tab === "components" ? "Components" : "Layers"}
                icons={
                  <>
                    {tab === "components" && <IconButton label="Find" icon={fi("24.search.small")} active={query !== null} onClick={() => setQuery((q) => (q === null ? "" : null))} />}
                    <IconButton label="Collapse layers" icon={fi("collapse-layers.small")} onClick={() => setOpen(new Set())} />
                  </>
                }
              />
              {query !== null && (
                <div className="shrink-0 px-2 pb-2">
                  <TextInput label="Find" value={query} placeholder="Find…" onChange={setQuery} />
                </div>
              )}
              <ScrollArea className="flex-1 min-h-0" viewportClassName="h-full overflow-x-hidden flex flex-col pb-4" inset={8} edge={2}>
                <Layers
                  nodes={layerNodes}
                  library={library}
                  filter={query || undefined}
                  selection={selected}
                  open={open}
                  onToggle={(id) => setOpen((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; })}
                  onToggleMany={(ids, on) => setOpen((prev) => { const next = new Set(prev); ids.forEach((id) => (on ? next.add(id) : next.delete(id))); return next; })}
                  onSelect={(id, additive) => {
                    setSelection(additive ? (selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]) : [id]);
                    // The Page Editor: the page scrolls to the layer picked (when it is out of sight).
                    if (paged && !additive) window.setTimeout(() => zoomActions.current?.fitSelection(), 60);
                  }}
                  onSelectMany={(ids) => setSelection(ids)}
                  onLocate={(id) => { setSelection([id]); window.setTimeout(() => zoomActions.current?.fitSelection(), 60); }}
                  onRename={(id, name) => patch(id, { name })}
                  onToggleHidden={(id) => {
                    if (id.includes("/")) {
                      // Inside an instance: the instance's override of the layer.
                      const l = layerAt(library, id);
                      if (l) override(id, { visible: l.node.visible === false ? undefined : false });
                      return;
                    }
                    const n = getNode(nodes, id);
                    if (n) patch(id, { visible: n.visible === false ? undefined : false });
                  }}
                  onToggleLocked={(id) => { const n = getNode(nodes, id); if (n) patch(id, { locked: n.locked ? undefined : true }); }}
                  onMoveInTree={moveInTree}
                  onContextMenu={(id, e) => { if (!selected.includes(id)) setSelection([id]); openMenu(e, nodeMenu(id)); }}
                />
              </ScrollArea>
            </>
          )}
          {tab === "assets" && (
            <ScrollArea className="flex-1 min-h-0" viewportClassName="h-full overflow-x-hidden flex flex-col pb-3" inset={8} edge={2}>
              <CollapseHeader label="Local components" />
              {components.length === 0 && <p className="px-4 py-1 text-[11px] leading-4 text-[var(--f-text-secondary)]">No components yet. Select a frame and press ⌥⌘K.</p>}
              {components.map(({ component, set }) => (
                <div key={component.id} className="px-2 py-0.5">
                  <button type="button" onClick={() => insertInstance(component)} className="flex items-center gap-2 w-full h-8 px-2 rounded-[5px] text-left hover:bg-[var(--f-bg-hover)] cursor-pointer">
                    <span className="flex shrink-0 text-[var(--f-text-component)]"><FigmaIcon name="16.component" /></span>
                    <span className="min-w-0 flex-1 truncate text-[11px] text-[var(--f-text)]">{set ? `${set.name} / ${(component.variant ?? []).map((v) => v.value).join(", ")}` : component.name}</span>
                  </button>
                </div>
              ))}
            </ScrollArea>
          )}
          {imagesOpened && (
            <div className={cn("flex flex-col flex-1 min-h-0", tab !== "images" && "hidden")}>
              <ImagesPanel
                slug={slug}
                file={tab === "images" ? file : null}
                active={tab === "images"}
                canFill={tab === "images" && selected.some((id) => { const n = id.includes("/") ? layerAt(library, id)?.node : getNode(nodes, id); return Boolean(n && n.type !== "text"); })}
                onUse={onUseImage}
              />
            </div>
          )}
        </aside>
      )}

      {/* ── The canvas ── */}
      <div className="relative flex-1 min-w-0 h-full">
        {minimized && (
          <>
            <div className="absolute top-3 left-3 z-30 flex items-center gap-1 h-12 pl-2 pr-2 rounded-[13px] bg-[var(--f-bg)] shadow-[0_0_0.5px_rgba(0,0,0,0.3),0_1px_3px_rgba(0,0,0,0.15)] select-none">
              <button type="button" aria-label="Main menu" onClick={(e) => openMenuUnder(e.currentTarget, shellMenu())} className="flex items-center justify-center w-8 h-8 rounded-[5px] text-[var(--f-icon)] hover:bg-[var(--f-bg-hover)] cursor-pointer">{fi("24.figma")}</button>
              <span className="px-1 text-[13px] font-[550] leading-[22px] tracking-[-0.0325px] text-[var(--f-text)]">{title || slug}</span>
              <IconButton label="Show UI (⌘\\)" icon={fi("24.sidebar.closed")} onClick={() => setMinimized(false)} />
            </div>
            <div className="absolute top-3 right-3 z-30 flex items-center gap-2 h-12 pl-2 pr-2 rounded-[13px] bg-[var(--f-bg)] shadow-[0_0_0.5px_rgba(0,0,0,0.3),0_1px_3px_rgba(0,0,0,0.15)] select-none">
              {mode !== "code" && (
                <button type="button" aria-haspopup="menu" onClick={(e) => openMenuUnder(e.currentTarget, zoomMenu(), "right")} className="flex items-center h-8 px-2 rounded-[5px] text-[11px] text-[var(--f-text)] tabular-nums hover:bg-[var(--f-bg-hover)] cursor-pointer">
                  {Math.round(view.zoom * 100)}%<span className="text-[var(--f-icon-secondary)]">{fi("16.chevron.down")}</span>
                </button>
              )}
              <button type="button" aria-label="Present" onClick={() => setPreviewing(previewTarget())} className="flex items-center justify-center w-8 h-8 rounded-[5px] text-[var(--f-icon)] hover:bg-[var(--f-bg-hover)] cursor-pointer">{fi("24.play")}</button>
              <SaveButton />
            </div>
          </>
        )}
        {/* The canvas stays under the code's view: the panels' edits that measure layers as drawn (grouping, ungrouping, removing an auto layout) still can. */}
        <Canvas
          // Each view its own canvas: nothing of a drag or a hover is carried from one to the other.
          key={paged ? "page" : "canvas"}
          doc={doc}
          render={render}
          selection={selected}
          onSelect={setSelection}
          view={view}
          onView={setView}
          tool={tool}
          onTool={setTool}
          onMove={onMove}
          onReparent={onReparent}
          onReorder={onReorder}
          onResize={onResize}
          onDraw={onDraw}
          onDoubleClick={onDoubleClick}
          onContextMenu={(id, e) => { if (id && !selected.includes(id)) setSelection([id]); openMenu(e, nodeMenu(id, { x: e.clientX, y: e.clientY })); }}
          onLayoutEdit={(id, p) => patch(id, p as Partial<SceneNode>)}
          layoutFocus={layoutFocus}
          zoomActionsRef={zoomActions}
          rulers={rulers}
          background={doc.background}
          pageId={pageRoot}
        />
        {mode === "code" && (
          // The code's view: to come — over the canvas, taking its pointer and its wheel.
          <div data-code-view="" className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-1 bg-[var(--edit-canvas)] select-none">
            <span className="flex items-center justify-center w-10 h-10 mb-2 rounded-[8px] bg-[var(--f-bg)] text-[var(--f-icon-secondary)] shadow-[0_0_0.5px_rgba(0,0,0,0.3),0_1px_3px_rgba(0,0,0,0.15)]">{fi("24.dev-brackets")}</span>
            <p className="text-[13px] font-[550] leading-[22px] tracking-[-0.0325px] text-[var(--f-text)]">Code</p>
            <p className="text-[11px] leading-4 tracking-[0.055px] text-[var(--f-text-secondary)]">Coming soon</p>
          </div>
        )}
        {paged && !getNode(nodes, doc.pageId) && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1 select-none">
            <p className="text-[13px] font-[550] leading-[22px] tracking-[-0.0325px] text-[var(--f-text)]">No page frame</p>
            <p className="text-[11px] leading-4 tracking-[0.055px] text-[var(--f-text-secondary)]">In the Canvas Editor, right-click a frame and choose “Set as site page”.</p>
          </div>
        )}
        {/* The toolbar, as the kit's: 8px in, the tools 8px apart, a line before the end. */}
        <div role="toolbar" aria-label="Tools" onClick={(e) => e.stopPropagation()} className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 h-12 px-2 rounded-[13px] bg-[var(--f-bg)] shadow-[0_0_0.5px_rgba(0,0,0,0.3),0_1px_3px_rgba(0,0,0,0.15)] select-none">
          {/* The tools: the canvas's and the page's (the code's view has nothing to draw on). */}
          <div aria-disabled={mode === "code" || undefined} className={cn("flex items-center gap-2", mode === "code" && "opacity-40 pointer-events-none")}>
            <Tool icon={<FigmaIcon name={tool === "hand" ? "24.hand" : "24.move"} />} label={tool === "hand" ? "Hand" : "Move"} shortcut={tool === "hand" ? "H" : "V"} active={tool === "move" || tool === "hand"} onClick={() => setTool("move")} menuLabel="Move tools" menu={(el) => openMenuUnder(el, [{ label: "Move", shortcut: "V", checked: tool === "move", onSelect: () => setTool("move") }, { label: "Hand", shortcut: "H", checked: tool === "hand", onSelect: () => setTool("hand") }])} />
            <Tool icon={<FigmaIcon name="24.frame" />} label="Frame" shortcut="F" active={tool === "frame"} onClick={() => setTool("frame")} />
            <Tool icon={<FigmaIcon name={tool === "ellipse" ? "24.ellipse" : tool === "line" ? "24.line" : "24.rectangle"} />} label={tool === "ellipse" ? "Ellipse" : tool === "line" ? "Line" : "Rectangle"} shortcut={tool === "ellipse" ? "O" : tool === "line" ? "L" : "R"} active={tool === "rectangle" || tool === "ellipse" || tool === "line"} onClick={() => setTool("rectangle")} menuLabel="Shape tools" menu={(el) => openMenuUnder(el, [{ label: "Rectangle", shortcut: "R", checked: tool === "rectangle", onSelect: () => setTool("rectangle") }, { label: "Ellipse", shortcut: "O", checked: tool === "ellipse", onSelect: () => setTool("ellipse") }, { label: "Line", shortcut: "L", checked: tool === "line", onSelect: () => setTool("line") }, "-", { label: "Place image…", shortcut: keys("shift", "mod", "k"), onSelect: placeImage }])} />
            <Tool icon={<FigmaIcon name="24.text" />} label="Text" shortcut="T" active={tool === "text"} onClick={() => setTool("text")} />
            <span aria-hidden className="w-px h-12 -my-2 bg-[var(--f-border)]" />
            <Tool icon={<FigmaIcon name="24.component" />} label="Create component" shortcut="⌥⌘K" onClick={createComponent} />
            <Tool icon={<FigmaIcon name="24.prototyping" />} label="Present" onClick={() => setPreviewing(previewTarget())} />
          </div>
          {/* The editor's views, at the toolbar's end. */}
          <span aria-hidden className="w-px h-12 -my-2 bg-[var(--f-border)]" />
          <div role="tablist" aria-label="Editor" className="flex items-center gap-1">
            {EDITOR_MODES.map((m) => (
              <ModeTab key={m.id} label={m.label} active={mode === m.id} onClick={() => setMode(m.id)} />
            ))}
          </div>
        </div>
      </div>

      {/* ── The right sidebar: the header (the language, present, Save), the tabs with the zoom, the properties ── */}
      {!minimized && (
        <aside data-design-panel="" className="relative shrink-0 h-full flex flex-col border-l border-[var(--f-border)] bg-[var(--f-bg)] z-10" style={{ width: panelWidths.right }}>
          <div role="separator" aria-orientation="vertical" aria-label="Resize panel" onPointerDown={resizePanel("right")} className="absolute top-0 bottom-0 -left-[3px] w-[6px] z-30 cursor-col-resize hover:bg-[var(--f-border-selected)]/40 active:bg-[var(--f-border-selected)]/40" />
          <div className="shrink-0 flex flex-col gap-2 p-2 border-b border-[var(--f-border)]">
            <div className="flex items-center justify-between pl-1">
              <LangSwitch />
              <div className="flex items-center gap-2">
                <div className="flex items-center rounded-[5px] hover:bg-[var(--f-bg-hover)]">
                  <button type="button" aria-label="View on site" title={isPublished ? "View on site" : "Save first"} disabled={!isPublished} onClick={() => window.open(`/projects/${slug}`, "_blank")} className="flex items-center justify-center w-8 h-8 rounded-[5px] text-[var(--f-icon)] cursor-pointer disabled:opacity-40 disabled:cursor-default">
                    {fi("24.play")}
                  </button>
                  <button type="button" aria-label="Present options" onClick={(e) => openMenuUnder(e.currentTarget, [{ label: "View on site", disabled: !isPublished, onSelect: () => window.open(`/projects/${slug}`, "_blank") }, { label: "Present", onSelect: () => setPreviewing(previewTarget()) }], "right")} className="flex items-center justify-center w-4 h-8 text-[var(--f-icon-secondary)] cursor-pointer">
                    {fi("16.chevron.down")}
                  </button>
                </div>
                <SaveButton />
              </div>
            </div>
            <div role="tablist" className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <Tab label="Design" active={rightTab === "design"} onClick={() => setRightTab("design")} />
                <Tab label="Prototype" active={rightTab === "prototype"} onClick={() => setRightTab("prototype")} />
              </div>
              {/* (The code's view has no canvas to zoom.) */}
              {mode !== "code" && (
                <button type="button" aria-haspopup="menu" onClick={(e) => openMenuUnder(e.currentTarget, zoomMenu(), "right")} className="flex items-center justify-end w-[60px] h-6 pl-1 rounded-[5px] text-[11px] leading-4 text-[var(--f-text)] tabular-nums hover:bg-[var(--f-bg-hover)] cursor-pointer">
                  {Math.round(view.zoom * 100)}%
                  <span className="text-[var(--f-icon-secondary)]">{fi("16.chevron.down")}</span>
                </button>
              )}
            </div>
          </div>
          <ScrollArea className="flex-1 min-h-0" viewportClassName="h-full overflow-x-hidden flex flex-col" inset={8} edge={2}>
            <Inspector nodes={library} pageNodes={nodes} selection={selected} tab={rightTab} ops={ops} variables={variables} byId={byId} mode={theme} textStyles={textStyles} lang={lang} background={doc.background ?? "#f5f5f5"} header={headerMenu} />
          </ScrollArea>
        </aside>
      )}

      {menu && <ContextMenu at={menu} entries={menu.entries} onClose={() => setMenu(null)} />}

      {variablesOpen && <VariablesTable system={system} onClose={() => setVariablesOpen(false)} />}

      {previewNode && isFrameLike(previewNode) && (
        <Preview node={previewNode} render={previewCtx} onClose={() => setPreviewing(null)} />
      )}
    </div>
  );
}

/** Figma's prototype preview: the frame, its prototypes playing, in a window over the editor. */
function Preview({ node, render, onClose }: { node: FrameNode; render: RenderContext; onClose: () => void }) {
  const [run, setRun] = useState(0);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const scale = Math.min(1, (window.innerWidth - 120) / node.width, (window.innerHeight - 140) / Math.max(1, node.height));
  return (
    <div role="dialog" aria-label="Prototype" className="fixed inset-0 z-50 flex flex-col bg-[#1e1e1e]" onClick={onClose}>
      <div className="shrink-0 flex items-center justify-between h-12 px-4 text-[11px] text-white" onClick={(e) => e.stopPropagation()}>
        <span className="font-semibold">{node.name} — Prototype</span>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setRun((r) => r + 1)} className="h-7 px-2.5 rounded-[5px] bg-white/10 hover:bg-white/20 cursor-pointer">Restart</button>
          <button type="button" onClick={onClose} className="h-7 px-2.5 rounded-[5px] bg-white/10 hover:bg-white/20 cursor-pointer">Close (Esc)</button>
        </div>
      </div>
      {/* A link clicked in the prototype goes nowhere (leaving the editor would lose what isn't saved). */}
      <div className="flex-1 min-h-0 overflow-auto flex items-start justify-center p-8" onClick={(e) => e.stopPropagation()} onClickCapture={(e) => { if ((e.target as Element).closest("a[href]")) e.preventDefault(); }}>
        <div data-design-scope="" style={{ width: node.width * scale, height: (node.sizingV === "hug" ? undefined : node.height * scale) }}>
          <DesignSystemStyle />
          <MotionStyle />
          <div style={{ transform: `scale(${scale})`, transformOrigin: "top left", width: node.width }}>
            <RenderProvider value={render}>
              <NodeView key={run} node={{ ...node, x: 0, y: 0 }} parentLayout="none" />
            </RenderProvider>
          </div>
        </div>
      </div>
    </div>
  );
}

export { layerIcon };
