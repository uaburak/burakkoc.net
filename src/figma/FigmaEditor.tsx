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
import { uploadFile } from "@/lib/storage";
import { Inspector, type EditorOps } from "./Inspector";
import { Layers, layerIcon, requestRename, type TreePlace } from "./Layers";
import { BrandButton, CollapseHeader, IconButton, Tab, TextInput } from "./ui";
import { MotionStyle, NodeView, RenderProvider, type RenderContext } from "./NodeView";
import {
  PATH_SEP,
  allComponents,
  byIdMap,
  cloneNode,
  findComponent,
  findNode,
  getNode,
  insertNode,
  isFrameLike,
  makeFrame,
  makeInstance,
  makeShape,
  makeText,
  nextName,
  nid,
  numberOf,
  pickVariant,
  removeNodes,
  resolveInstance,
  setOf,
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

/**
 * The editor — Figma, for the project's page: the navigation bar (the
 * menu; Dosya, Varlıklar, Değişkenler), the left sidebar (the file, its
 * page, the layers), the canvas, the right sidebar (Tasarım / Prototip,
 * Kaydet), the toolbar. Everything edits `doc`; Kaydet writes it with the
 * project. Undo is the project's (see AdminEditorClient).
 */

type LeftTab = "file" | "assets" | "variables";

/** Figma's colours, as its UI kit's variables resolve (Light / Dark) — the chrome's tokens, and the site's ones over them for shared pieces. */
const FIGMA_TOKENS: Record<"light" | "dark", CSSProperties> = {
  light: {
    "--f-bg": "#ffffff", "--f-bg-secondary": "#f5f5f5", "--f-bg-hover": "#f5f5f5", "--f-bg-selected": "#e5f4ff", "--f-bg-selected-secondary": "#f2f9ff", "--f-bg-brand": "#0d99ff", "--f-bg-menu": "#1e1e1e",
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
    <button type="button" aria-label={label} aria-pressed={active} onClick={onClick} className="group/nav flex w-12 flex-col items-center gap-1 pt-2 pb-1.5 cursor-pointer select-none">
      <span className={cn("flex items-center justify-center w-8 h-8 rounded-[5px] transition-colors", active ? "bg-[var(--f-bg-selected)] text-[var(--f-text-brand)]" : "text-[var(--f-icon)] group-hover/nav:bg-[var(--f-bg-hover)]")}>{icon}</span>
      <span className={cn("text-[10px] leading-3 tracking-[0.05px]", active ? "text-[var(--f-text)]" : "text-[var(--f-text-secondary)]")}>{label}</span>
    </button>
  );
}

function SaveButton() {
  const { saveStatus, triggerSave } = useEditorContext();
  const label = saveStatus === "saving" ? "Kaydediliyor…" : saveStatus === "saved" ? "Kaydedildi" : saveStatus === "error" ? "Hata" : "Kaydet";
  return (
    <BrandButton disabled={saveStatus === "saving" || !triggerSave} onClick={() => triggerSave?.()} className={cn(saveStatus === "error" && "bg-[#f24822]")}>
      {label}
    </BrandButton>
  );
}

function LangSwitch() {
  const { editLang, setEditLang } = useEditorContext();
  return (
    <div role="radiogroup" aria-label="Dil" className="flex items-center gap-1">
      {(["tr", "en"] as const).map((l) => (
        <Tab key={l} label={l.toUpperCase()} active={editLang === l} onClick={() => setEditLang(l)} />
      ))}
    </div>
  );
}

/** A toolbar tool, as the kit's: a 24px icon in a 32px box, blue while in use; a 16px chevron opens its menu. */
function Tool({ icon, label, shortcut, active = false, onClick, menu }: { icon: ReactNode; label: string; shortcut?: string; active?: boolean; onClick: () => void; menu?: (el: HTMLElement) => void }) {
  return (
    <div className="relative group/tool flex items-center gap-px">
      <button type="button" aria-label={label} aria-pressed={active} onClick={onClick} className={cn("flex items-center justify-center w-8 h-8 rounded-[5px] transition-colors cursor-pointer", active ? "bg-[var(--f-bg-brand)] text-white" : "text-[var(--f-icon)] hover:bg-[var(--f-bg-hover)]")}>
        {icon}
      </button>
      {menu && (
        <button type="button" aria-label={`${label} menüsü`} onClick={(e) => menu(e.currentTarget)} className="flex items-center justify-center w-4 h-8 rounded-[5px] text-[var(--f-icon-secondary)] hover:bg-[var(--f-bg-hover)] cursor-pointer">
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

const KIND_HINT: Record<SceneNode["type"], string> = { frame: "çerçeve", rectangle: "dikdörtgen", ellipse: "elips", line: "çizgi", text: "metin", component: "bileşen", componentSet: "bileşen seti", instance: "örnek" };

const isTyping = () => {
  const el = document.activeElement as HTMLElement | null;
  return Boolean(el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)));
};

export function FigmaEditor({ doc: file, onDoc, title, slug, system, isPublished, undo, redo }: {
  doc: FigmaDocument;
  onDoc: (update: (doc: FigmaDocument) => FigmaDocument) => void;
  title: string;
  slug: string;
  system: DesignSystem;
  isPublished: boolean;
  undo: () => void;
  redo: () => void;
}) {
  const router = useRouter();
  const { theme, toggle: toggleTheme } = useTheme();
  const { editLang } = useEditorContext();
  const lang = editLang;
  const [selection, setSelectionState] = useState<string[]>([]);
  const [view, setView] = useState<CanvasView>({ x: 120, y: 80, zoom: 0.5 });
  const [tool, setTool] = useState<CanvasTool>("move");
  const [leftTab, setLeftTab] = useState<LeftTab>("file");
  const [rightTab, setRightTab] = useState<"design" | "prototype">("design");
  const [open, setOpen] = useState<Set<string>>(() => new Set([file.pageId]));
  const [editing, setEditing] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; entries: MenuEntry[] } | null>(null);
  const [minimized, setMinimized] = useState(false);
  const [previewing, setPreviewing] = useState<string | null>(null);
  const [variablesOpen, setVariablesOpen] = useState(false);
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
  const setNodes = useCallback((update: (nodes: SceneNode[]) => SceneNode[]) => onDoc((d) => {
    const pg = d.currentPage ? d.pages?.find((x) => x.id === d.currentPage) : undefined;
    if (pg) {
      const next = update(pg.nodes);
      return next === pg.nodes ? d : { ...d, pages: d.pages!.map((x) => (x.id === pg.id ? { ...x, nodes: next } : x)) };
    }
    const next = update(d.nodes);
    return next === d.nodes ? d : { ...d, nodes: next };
  }), [onDoc]);
  const pages = useMemo(() => [{ id: "", name: file.pageName ?? getNode(file.nodes, file.pageId)?.name ?? title ?? "Sayfa 1" }, ...(file.pages ?? []).map((pg) => ({ id: pg.id, name: pg.name }))], [file, title]);
  const [renamingPage, setRenamingPage] = useState<string | null>(null);
  const switchPage = (id: string) => { setSelectionState([]); setEditing(null); onDoc((d) => ({ ...d, currentPage: id || undefined })); };
  const addPage = () => {
    const id = nid("p");
    let n = pages.length + 1;
    while (pages.some((pg) => pg.name === `Sayfa ${n}`)) n++;
    onDoc((d) => ({ ...d, pages: [...(d.pages ?? []), { id, name: `Sayfa ${n}`, nodes: [] }], currentPage: id }));
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
    // The layers holding it open.
    setOpen((prev) => {
      const next = new Set(prev);
      for (const id of ids) findNode(nodes, id.split("/")[0])?.path.slice(0, -1).forEach((p) => next.add(p));
      return next.size === prev.size ? prev : next;
    });
  }, [nodes]);

  // The selected row stays in sight in the layers.
  useEffect(() => {
    requestAnimationFrame(() => document.querySelector("[data-left-panel] [data-selected-row]")?.scrollIntoView({ block: "nearest" }));
  }, [selected]);

  const latest = useRef({ selected, nodes, doc, tool, editing, lang, previewing });
  useEffect(() => {
    latest.current = { selected, nodes, doc, tool, editing, lang, previewing };
  });

  // ── Editing ──
  const patch = useCallback((id: string, p: Partial<SceneNode>) => {
    if (id.includes("/")) return;
    setNodes((list) => updateNode(list, id, (n) => ({ ...n, ...p } as SceneNode)));
  }, [setNodes]);
  const override = useCallback((compositeId: string, p: NodeOverride) => {
    const [instanceId, key] = compositeId.split("/");
    setNodes((list) => updateNode(list, instanceId, (n) => {
      if (n.type !== "instance") return n;
      const current = { ...(n.overrides?.[key] ?? {}), ...p } as Record<string, unknown>;
      Object.keys(current).forEach((k) => current[k] === undefined && delete current[k]);
      const overrides = { ...n.overrides, [key]: current as NodeOverride };
      if (!Object.keys(current).length) delete overrides[key];
      return { ...n, overrides: Object.keys(overrides).length ? overrides : undefined };
    }));
  }, [setNodes]);

  const deleteSelection = () => {
    const ids = new Set(latest.current.selected.filter((id) => !id.includes("/")));
    if (!ids.size) return;
    setNodes((list) => removeNodes(list, ids));
    setSelection([]);
  };

  /** A copy of each selected top, right after it — a main component's copy is an instance (as Figma's ⌘D). */
  const duplicateSelection = () => {
    const tops = topmost(nodes, latest.current.selected.filter((id) => !id.includes("/")));
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
    const into = target && (target.node.type === "frame" || target.node.type === "component") ? target.node.id : target?.parent?.id ?? null;
    const copies = clipboard.current.map((n) => cloneNode(n));
    setNodes((list) => copies.reduce((acc, c) => insertNode(acc, into, c), list));
    setSelection(copies.map((c) => c.id));
  };

  /** ⌘G a group, ⌥⌘G a frame — or ⇧A: a frame with auto layout inferred from how the layers sit (their direction and gaps), hugging them, as Figma's. */
  const groupSelection = (kind: "group" | "frame" | "auto") => {
    const tops = topmost(nodes, latest.current.selected.filter((id) => !id.includes("/")));
    if (!tops.length) return;
    const parentId = tops[0].parent?.id ?? null;
    if (tops.some((t) => (t.parent?.id ?? null) !== parentId)) return;
    const rects = tops.map((t) => ({ t, r: domRect(t.node.id) })).filter((x) => x.r) as { t: (typeof tops)[number]; r: Rect }[];
    if (!rects.length) return;
    const parentRect = parentId ? domRect(parentId) : { x: 0, y: 0, w: 0, h: 0 };
    const x = Math.min(...rects.map((x) => x.r.x));
    const y = Math.min(...rects.map((x) => x.r.y));
    const right = Math.max(...rects.map((x) => x.r.x + x.r.w));
    const bottom = Math.max(...rects.map((x) => x.r.y + x.r.h));
    const frame = makeFrame(kind === "group" ? nextName(nodes, "Grup") : nextName(nodes, "Çerçeve"), x - (parentRect?.x ?? 0), y - (parentRect?.y ?? 0), right - x, bottom - y);
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
  };

  const ungroup = () => {
    const id = selected[0];
    const found = id && !id.includes("/") ? findNode(nodes, id) : null;
    if (!found || !isFrameLike(found.node) || found.node.type === "instance") return;
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
    if (!tops.length) return;
    if (tops.length === 1 && tops[0].node.type === "frame") {
      patch(tops[0].node.id, { type: "component" } as Partial<SceneNode>);
      return;
    }
    groupSelection("frame");
    // The frame just made becomes the component (the next render has it selected).
    requestAnimationFrame(() => {
      const id = latest.current.selected[0];
      if (id) patch(id, { type: "component" } as Partial<SceneNode>);
    });
  };

  const detach = () => {
    const id = selected[0];
    const node = id && !id.includes("/") ? getNode(nodes, id) : null;
    if (!node || node.type !== "instance") return;
    const resolved = resolveInstance(nodes, node);
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
      const copy = cloneNode(last);
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
    const first: FrameNode = { ...node, x: 0, y: 0, variant: [{ property: "Özellik 1", value: "Varsayılan" }] };
    const second = cloneNode(first);
    second.variant = [{ property: "Özellik 1", value: "Varyant 2" }];
    set.children = [first, second];
    setNodes((list) => insertNode(removeNodes(list, new Set([node.id])), found.parent?.id ?? null, set, found.index));
    setSelection([second.id]);
  };
  const nextValue = (set: FrameNode, property: string) => {
    const values = variantProperties(set).find((p) => p.name === property)?.values ?? [];
    let n = values.length + 1;
    while (values.includes(`Varyant ${n}`)) n++;
    return `Varyant ${n}`;
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
    set.children = tops.map((t) => ({ ...(t.node as FrameNode), x: 0, y: 0, variant: [{ property: "Özellik 1", value: t.node.name }] }));
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
      const sorted = [...frame.children].sort((a, b) => (mode === "vertical" ? a.y - b.y : a.x - b.x));
      const gap = sorted.length > 1 ? Math.max(0, Math.round(sorted.slice(1).reduce((sum, c, i) => sum + (mode === "vertical" ? c.y - (sorted[i].y + sorted[i].height) : c.x - (sorted[i].x + sorted[i].width)), 0) / (sorted.length - 1))) : 10;
      const minX = sorted.length ? Math.min(...sorted.map((c) => c.x)) : 0;
      const minY = sorted.length ? Math.min(...sorted.map((c) => c.y)) : 0;
      patch(id, { layoutMode: mode, children: sorted, itemSpacing: { value: gap }, paddingLeft: { value: Math.max(0, minX) }, paddingTop: { value: Math.max(0, minY) }, paddingRight: { value: Math.max(0, minX) }, paddingBottom: { value: Math.max(0, minY) } } as Partial<SceneNode>);
    },
    createComponent,
    detach,
    resetOverrides: () => selected[0] && patch(selected[0], { overrides: undefined } as Partial<SceneNode>),
    goToMain: () => {
      const node = selected[0] ? getNode(nodes, selected[0].split("/")[0]) : null;
      if (node?.type === "instance" && node.mainId && findComponent(nodes, node.mainId)) {
        setSelection([node.mainId]);
        setLeftTab("file");
        requestAnimationFrame(() => zoomActions.current?.fitSelection());
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
      return { ...set, children: set.children.map((c) => (c.type === "component" ? { ...c, variant: [...(c.variant ?? []), { property: `Özellik ${count}`, value: "Varsayılan" }] } : c)) };
    })),
    removeProperty: (setId, name) => setNodes((list) => updateNode(list, setId, (set) => (set.type === "componentSet" ? { ...set, children: set.children.map((c) => (c.type === "component" ? { ...c, variant: c.variant?.filter((v) => v.property !== name) } : c)) } : set))),
    swapVariant: (instanceId, property, value) => {
      const instance = getNode(nodes, instanceId);
      const main = instance?.type === "instance" && instance.mainId ? findComponent(nodes, instance.mainId) : null;
      const set = main ? setOf(nodes, main.id) : null;
      if (!main || !set) return;
      patch(instanceId, { mainId: pickVariant(set, main, property, value).id } as Partial<SceneNode>);
    },
    setReactions: (variantId, reactions) => patch(variantId, { reactions: reactions.length ? reactions : undefined } as Partial<SceneNode>),
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
      while (taken.some((st) => st.name === `Efekt stili ${k}`)) k++;
      onDoc((d) => ({ ...d, effectStyles: [...(d.effectStyles ?? []), { id, name: `Efekt stili ${k}`, effects: n.effects! }] }));
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
    createColorStyle: (hex) => {
      const id = system.addVariable("color");
      let k = variables.filter((v) => v.kind === "color").length + 1;
      while (variables.some((v) => v.name === `Renk ${k}`)) k++;
      system.setVariable({ id, name: `Renk ${k}`, kind: "color", light: { value: hex } });
      setVariablesOpen(true);
    },
    exportNode: (id, setting) => {
      const el = document.querySelector<HTMLElement>(`[data-figma-canvas] [data-node-id="${CSS.escape(id)}"]`);
      const n = getNode(nodes, id);
      if (el && n) exportElement(el, n.name, setting).catch((err) => console.warn("Dışa aktarılamadı:", err));
    },
    upload: (f) => uploadFile(f, `projects/${slug}/figma/${Date.now()}.${f.name.split(".").pop() ?? "bin"}`),
    pageId: doc.pageId,
    addAutoLayout: () => autoLayout(),
    more: (el) => openMenuUnder(el, nodeMenu(selected[0] ?? null), "right"),
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
    if (!found) return;
    const target = parentId ? getNode(nodes, parentId) : null;
    const auto = target && isFrameLike(target) && target.layoutMode !== "none";
    const source = copy ? cloneNode(found.node) : found.node;
    const moved: SceneNode = { ...source, x, y, ...(auto ? {} : { sizingH: found.node.sizingH === "fill" ? undefined : found.node.sizingH, sizingV: found.node.sizingV === "fill" ? undefined : found.node.sizingV }) };
    setNodes((list) => insertNode(copy ? list : removeNodes(list, new Set([id])), parentId, moved, index));
    if (copy) setSelection([moved.id]);
  };
  const onReorder = (id: string, index: number) => {
    const found = findNode(nodes, id);
    if (!found || !found.parent) return;
    const parent = found.parent;
    const rest = parent.children.filter((c) => c.id !== id);
    rest.splice(Math.min(index, rest.length), 0, found.node);
    patch(parent.id, { children: rest } as Partial<SceneNode>);
  };
  const onResize = (id: string, rect: Rect, changed: { x: boolean; y: boolean }) => {
    const found = findNode(nodes, id);
    if (!found) return;
    const inAuto = found.parent && found.parent.layoutMode !== "none";
    const p: Partial<SceneNode> = { width: rect.w, height: rect.h };
    if (!inAuto) { p.x = rect.x; p.y = rect.y; }
    if (changed.x) p.sizingH = found.node.sizingH === "fill" || found.node.sizingH === "hug" ? undefined : found.node.sizingH;
    if (changed.y) p.sizingV = found.node.sizingV === "fill" || found.node.sizingV === "hug" ? undefined : found.node.sizingV;
    if (found.node.type === "text") {
      const t = found.node;
      (p as Partial<SceneNode> & { textAutoResize?: string }).textAutoResize = changed.y ? "none" : t.textAutoResize === "widthHeight" && changed.x ? "height" : t.textAutoResize;
    }
    patch(id, p);
  };
  const onDraw = (drawn: CanvasTool, parentId: string | null, rect: Rect, clicked: boolean, index?: number) => {
    let node: SceneNode;
    if (drawn === "frame") node = makeFrame(nextName(nodes, "Çerçeve"), rect.x, rect.y, rect.w, rect.h);
    else if (drawn === "text") { node = makeText(rect.x, rect.y, ""); if (!clicked) { node.width = rect.w; node.textAutoResize = "height"; } }
    else node = makeShape(drawn === "ellipse" ? "ellipse" : drawn === "line" ? "line" : "rectangle", nextName(nodes, drawn === "ellipse" ? "Elips" : drawn === "line" ? "Çizgi" : "Dikdörtgen"), rect.x, rect.y, rect.w, rect.h);
    setNodes((list) => insertNode(list, parentId, node, index));
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
      const [instanceId, key] = id.split("/");
      const instance = getNode(nodes, instanceId);
      const main = instance?.type === "instance" && instance.mainId ? findComponent(nodes, instance.mainId) : null;
      let list: SceneNode[] = main?.children ?? [];
      let leaf: SceneNode | null = null;
      for (const name of key.split(PATH_SEP)) {
        leaf = list.find((c) => c.name === name) ?? null;
        list = leaf && isFrameLike(leaf) ? leaf.children : [];
      }
      if (leaf?.type === "text") setEditing(id);
      return;
    }
    setSelection([id]);
  };

  // Typing in a text in place: its words (the instance's override when it is an instance's).
  const editingCtx = useMemo<RenderContext["editing"]>(() => editing ? {
    id: editing,
    onInput: (id, text) => {
      if (editing.includes("/")) override(editing, latest.current.lang === "en" ? { charactersEn: text } : { characters: text });
      else patch(id, (latest.current.lang === "en" ? { charactersEn: text } : { characters: text, name: text.trim().slice(0, 40) || "Metin" }) as Partial<SceneNode>);
    },
    onDone: () => setEditing(null),
  } : null, [editing, override, patch]);
  const render = useMemo<RenderContext>(() => ({ nodes, byId, lang, play: false, editing: editingCtx }), [nodes, byId, lang, editingCtx]);

  // ── Layers ──
  const moveInTree = (id: string, targetId: string, place: TreePlace) => {
    const found = findNode(nodes, id);
    const target = findNode(nodes, targetId);
    if (!found || !target || target.path.includes(id)) return;
    const without = removeNodes(nodes, new Set([id]));
    if (place === "inside") {
      setNodes(() => insertNode(without, targetId, found.node));
      setOpen((prev) => new Set([...prev, targetId]));
      return;
    }
    const t2 = findNode(without, targetId)!;
    // The tree lists front first: "before" a row is after it in the list.
    const index = place === "before" ? t2.index + 1 : t2.index;
    setNodes(() => insertNode(without, t2.parent?.id ?? null, found.node, index));
  };

  const reorder = (dir: "forward" | "backward" | "front" | "back") => {
    const id = selected[0];
    const found = id && !id.includes("/") ? findNode(nodes, id) : null;
    if (!found) return;
    const siblings = found.parent ? found.parent.children : nodes;
    const to = dir === "front" ? siblings.length - 1 : dir === "back" ? 0 : Math.max(0, Math.min(siblings.length - 1, found.index + (dir === "forward" ? 1 : -1)));
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
    const pasteHere = { label: "Buraya yapıştır", disabled: !clipboard.current.length, onSelect: () => (at ? pasteAt(at.x, at.y, id) : paste()) };
    if (!node) {
      return [
        pasteHere,
        "-",
        { label: "Geri al", shortcut: keys("mod", "z"), onSelect: undo },
        { label: "Yinele", shortcut: keys("shift", "mod", "z"), onSelect: redo },
        "-",
        { label: "Hepsini sığdır", shortcut: keys("shift", "1"), onSelect: () => zoomActions.current?.fitAll() },
        { label: "%100", shortcut: keys("shift", "0"), onSelect: () => zoomActions.current?.zoomTo(1) },
        "-",
        { label: "Görsel yerleştir…", shortcut: keys("shift", "mod", "k"), onSelect: placeImage },
      ];
    }
    const found = findNode(nodes, id!);
    const top = found?.path.length === 1;
    const frame = isFrameLike(node);
    const variantSet = node.type === "component" ? setOf(nodes, node.id) : null;
    const chain = (found?.path ?? []).map((pid) => getNode(nodes, pid)).filter((n): n is SceneNode => Boolean(n));
    const otherPages = pages.filter((pg) => pg.id !== (file.currentPage ?? ""));
    const many = selected.filter((s) => !s.includes("/")).length > 1;
    return [
      { label: "Kopyala", shortcut: keys("mod", "c"), onSelect: copySelection },
      pasteHere,
      { label: "Değiştirerek yapıştır", shortcut: keys("shift", "mod", "r"), disabled: !clipboard.current.length, onSelect: pasteToReplace },
      { label: "Şu şekilde kopyala/yapıştır", items: [
        { label: "CSS olarak kopyala", onSelect: () => void copyAs("css") },
        { label: "SVG olarak kopyala", onSelect: () => void copyAs("svg") },
        { label: "PNG olarak kopyala", onSelect: () => void copyAs("png") },
        "-",
        { label: "Özellikleri kopyala", shortcut: keys("alt", "mod", "c"), onSelect: copyProperties },
        { label: "Özellikleri yapıştır", shortcut: keys("alt", "mod", "v"), disabled: !propsClipboard.current, onSelect: pasteProperties },
      ] },
      { label: "Çoğalt", shortcut: keys("mod", "d"), onSelect: duplicateSelection },
      { label: "Sil", shortcut: keys("backspace"), onSelect: deleteSelection },
      { label: "Hareket ekle", items: variantSet ? [
        { label: "Tıklayınca → sonraki varyant", onSelect: () => addMotion(node.id, "click") },
        { label: "Üzerine gelince → sonraki varyant", onSelect: () => addMotion(node.id, "hover") },
        { label: "Basılıyken → sonraki varyant", onSelect: () => addMotion(node.id, "press") },
        "-",
        { label: "Prototip sekmesini aç", onSelect: () => setRightTab("prototype") },
      ] : [
        { label: "Prototip sekmesini aç", hint: "varyantlar arasında", onSelect: () => setRightTab("prototype") },
      ] },
      "-",
      { label: "Katman seç", items: chain.map((n) => ({ label: n.name, hint: KIND_HINT[n.type], checked: selected.includes(n.id), onSelect: () => setSelection([n.id]) })) },
      { label: "Sayfaya taşı", items: otherPages.length ? otherPages.map((pg) => ({ label: pg.name, onSelect: () => moveToPage(pg.id) })) : [{ label: "Başka sayfa yok", disabled: true }, { label: "Sayfa ekle", onSelect: addPage }] },
      { label: "En öne getir", shortcut: "]", onSelect: () => reorder("front") },
      { label: "En arkaya gönder", shortcut: "[", onSelect: () => reorder("back") },
      { label: "Öne getir", shortcut: keys("mod", "]"), onSelect: () => reorder("forward") },
      { label: "Arkaya gönder", shortcut: keys("mod", "["), onSelect: () => reorder("backward") },
      "-",
      { label: "Grupla", shortcut: keys("mod", "g"), onSelect: () => groupSelection("group") },
      { label: "Seçimi çerçevele", shortcut: keys("alt", "mod", "g"), onSelect: () => groupSelection("frame") },
      { label: "Grubu çöz", shortcut: keys("mod", "backspace"), disabled: !(frame && node.type !== "instance"), onSelect: ungroup },
      { label: "Maske olarak kullan", shortcut: "^" + keys("mod", "m"), disabled: node.type === "text" || many, onSelect: () => maskWith(node.id) },
      "-",
      { label: frame && node.type !== "instance" && node.type !== "componentSet" && node.layoutMode !== "none" && !many ? "Auto layout'u kaldır" : "Auto layout ekle", shortcut: keys("shift", "a"), onSelect: () => autoLayout() },
      { label: "Diğer yerleşim seçenekleri", items: [
        { label: "Genişlik: İçeriği sar", checked: node.sizingH === "hug", onSelect: () => patch(node.id, { sizingH: "hug" }) },
        { label: "Genişlik: Kabı doldur", checked: node.sizingH === "fill", onSelect: () => patch(node.id, { sizingH: "fill" }) },
        { label: "Genişlik: Sabit", checked: !node.sizingH, onSelect: () => patch(node.id, { sizingH: undefined }) },
        "-",
        { label: "Yükseklik: İçeriği sar", checked: node.sizingV === "hug", onSelect: () => patch(node.id, { sizingV: "hug" }) },
        { label: "Yükseklik: Kabı doldur", checked: node.sizingV === "fill", onSelect: () => patch(node.id, { sizingV: "fill" }) },
        { label: "Yükseklik: Sabit", checked: !node.sizingV, onSelect: () => patch(node.id, { sizingV: undefined }) },
        ...(frame && node.layoutMode !== "none" ? ["-" as const,
          { label: "Sar (wrap)", checked: Boolean(node.layoutWrap), disabled: node.layoutMode !== "horizontal", onSelect: () => patch(node.id, { layoutWrap: node.layoutWrap ? undefined : true } as Partial<SceneNode>) },
          { label: "İçeriği kırp", checked: Boolean(node.clipsContent), onSelect: () => patch(node.id, { clipsContent: !node.clipsContent } as Partial<SceneNode>) },
        ] : []),
        ...(found?.parent && found.parent.layoutMode !== "none" ? ["-" as const, { label: "Auto layout'tan bağımsız konum", checked: Boolean(node.absolute), onSelect: () => patch(node.id, { absolute: node.absolute ? undefined : true }) }] : []),
      ] },
      ...(node.type === "frame" ? [{ label: "Bileşen oluştur", shortcut: keys("alt", "mod", "k"), onSelect: createComponent }] : []),
      ...(node.type === "component" || node.type === "componentSet" ? [{ label: "Varyant ekle", onSelect: () => addVariant(node.id) }] : []),
      ...(node.type === "component" && selected.length > 1 ? [{ label: "Varyant olarak birleştir", onSelect: combineAsVariants }] : []),
      ...(node.type === "instance" ? [
        { label: "Ana bileşene git", onSelect: ops.goToMain },
        { label: "Değişiklikleri sıfırla", disabled: !node.overrides, onSelect: ops.resetOverrides },
        { label: "Örneği ayır", shortcut: keys("alt", "mod", "b"), onSelect: detach },
      ] : []),
      ...(top && frame && node.type !== "componentSet" ? [{ label: "Sayfa olarak ayarla", hint: "sitede bu görünür", checked: doc.pageId === node.id, onSelect: () => onDoc((d) => ({ ...d, pageId: node.id })) }] : []),
      "-",
      { label: node.visible === false ? "Göster" : "Gizle", shortcut: keys("shift", "mod", "h"), onSelect: () => patch(node.id, { visible: node.visible === false ? undefined : false }) },
      { label: node.locked ? "Kilidi aç" : "Kilitle", shortcut: keys("shift", "mod", "l"), onSelect: () => patch(node.id, { locked: node.locked ? undefined : true }) },
      { label: "Yeniden adlandır", shortcut: keys("mod", "r"), onSelect: () => { setLeftTab("file"); requestAnimationFrame(() => requestRename(node.id)); } },
      "-",
      { label: "Yatay çevir", shortcut: keys("shift", "h"), checked: Boolean(node.flipH), onSelect: () => flip("H") },
      { label: "Dikey çevir", shortcut: keys("shift", "v"), checked: Boolean(node.flipV), onSelect: () => flip("V") },
    ];
  };
  const shellMenu = (): MenuEntry[] => [
    { label: "Projeler", hint: "listeye dön", onSelect: () => router.push("/admin/projects") },
    "-",
    { label: "Geri al", shortcut: keys("mod", "z"), onSelect: undo },
    { label: "Yinele", shortcut: keys("shift", "mod", "z"), onSelect: redo },
    "-",
    { label: "Yayında görüntüle", disabled: !isPublished, onSelect: () => window.open(`/projects/${slug}`, "_blank") },
    { label: "Prototipi oynat", onSelect: () => setPreviewing(previewTarget()) },
    "-",
    { label: theme === "dark" ? "Açık tema" : "Koyu tema", onSelect: toggleTheme },
    { label: minimized ? "Panelleri göster" : "Panelleri gizle", shortcut: keys("mod", "\\"), onSelect: () => setMinimized((m) => !m) },
    { label: rulers ? "Cetvelleri gizle" : "Cetvelleri göster", shortcut: keys("shift", "r"), onSelect: () => setRulers((r) => !r) },
  ];
  const zoomMenu = (): MenuEntry[] => [
    { label: "Yakınlaştır", shortcut: keys("mod", "+"), onSelect: () => zoomActions.current?.zoomTo(view.zoom * 2) },
    { label: "Uzaklaştır", shortcut: keys("mod", "-"), onSelect: () => zoomActions.current?.zoomTo(view.zoom / 2) },
    "-",
    { label: "Hepsini sığdır", shortcut: keys("shift", "1"), onSelect: () => zoomActions.current?.fitAll() },
    { label: "Seçime yakınlaştır", shortcut: keys("shift", "2"), disabled: !selected.length, onSelect: () => zoomActions.current?.fitSelection() },
    "-",
    { label: "%50", onSelect: () => zoomActions.current?.zoomTo(0.5) },
    { label: "%100", shortcut: keys("shift", "0"), onSelect: () => zoomActions.current?.zoomTo(1) },
    { label: "%200", onSelect: () => zoomActions.current?.zoomTo(2) },
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
    const into = target && (target.node.type === "frame" || target.node.type === "component") ? target.node.id : target?.parent?.id ?? null;
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
    const tops = topmost(nodes, latest.current.selected.filter((id) => !id.includes("/")));
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
    if (el) await copyElementAs(el, kind).catch((err) => console.warn("Kopyalanamadı:", err));
  };
  /** Move to page: the layers taken out of this page and put on another, at their places. */
  const moveToPage = (pageId: string) => {
    const tops = topmost(nodes, latest.current.selected.filter((id) => !id.includes("/")));
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
    if (!found || found.node.type === "text") return;
    const mask = found.node;
    const siblings = found.parent ? found.parent.children : nodes;
    const above = siblings.slice(found.index + 1);
    const frame = makeFrame(`${mask.name} (maske)`, mask.x, mask.y, mask.width, mask.height);
    frame.fills = [];
    frame.clipsContent = true;
    if (mask.type === "ellipse") frame.cornerRadius = { value: 9999 };
    else if (mask.type !== "line" && (mask.cornerRadius || mask.corners)) { frame.cornerRadius = mask.cornerRadius; frame.corners = mask.corners; }
    frame.children = [{ ...mask, x: 0, y: 0, visible: false, name: `${mask.name} (maske şekli)` }, ...above.map((n) => ({ ...n, x: n.x - mask.x, y: n.y - mask.y }))];
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
  const placeImage = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) return;
      const url = await uploadFile(f, `projects/${slug}/figma/${Date.now()}.${f.name.split(".").pop() ?? "bin"}`);
      const img = new Image();
      await new Promise<void>((resolve) => { img.onload = () => resolve(); img.onerror = () => resolve(); img.src = url; });
      const scale = Math.min(1, 800 / Math.max(1, img.naturalWidth || 800));
      const w = Math.round((img.naturalWidth || 400) * scale);
      const h = Math.round((img.naturalHeight || 300) * scale);
      const canvas = document.querySelector<HTMLElement>("[data-figma-canvas]");
      const cx = ((canvas?.clientWidth ?? 800) / 2 - view.x) / view.zoom;
      const cy = ((canvas?.clientHeight ?? 600) / 2 - view.y) / view.zoom;
      const shape = makeShape("rectangle", f.name.replace(/\.[^.]+$/, "") || "Görsel", cx - w / 2, cy - h / 2, w, h);
      shape.fills = [{ type: "image", color: { value: "#d9d9d9" }, image: { url, fit: "fill" } }];
      setNodes((list) => insertNode(list, null, shape));
      setSelection([shape.id]);
    };
    input.click();
  };

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
      const { selected: sel, nodes: list, tool: current } = latest.current;
      const a = actions.current;
      const mod = e.metaKey || e.ctrlKey;
      const { shiftKey: shift, altKey: alt, code } = e;
      const first = sel[0];
      const own = sel.filter((id) => !id.includes("/"));
      const handled = () => e.preventDefault();
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
        const sibs = found ? (found.parent ? found.parent.children : list) : list;
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
        const tops = topmost(list, own);
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
        return setSelection((found?.parent ? found.parent.children : list).map((n) => n.id));
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
  const components = useMemo(() => allComponents(nodes), [nodes]);
  const insertInstance = (component: FrameNode) => {
    const canvas = document.querySelector<HTMLElement>("[data-figma-canvas]");
    const w = canvas?.clientWidth ?? 800;
    const h = canvas?.clientHeight ?? 600;
    const cx = (w / 2 - view.x) / view.zoom;
    const cy = (h / 2 - view.y) / view.zoom;
    const instance = makeInstance(component, Math.round(cx - component.width / 2), Math.round(cy - component.height / 2));
    setNodes((list) => insertNode(list, null, instance));
    setSelection([instance.id]);
  };

  const previewNode = previewing ? getNode(nodes, previewing) : null;
  const previewCtx = useMemo<RenderContext>(() => ({ nodes, byId, lang, play: true }), [nodes, byId, lang]);

  return (
    <div className="relative flex h-full min-h-0 text-[11px] leading-4 text-[var(--text-title)]" style={{ ...FIGMA_TOKENS[theme], fontFamily: "var(--font-inter), Inter, ui-sans-serif, system-ui, sans-serif" }}>
      {/* ── The navigation bar: the menu, then the tabs with their labels ── */}
      {!minimized && (
        <nav aria-label="Gezinme çubuğu" className="w-12 shrink-0 h-full flex flex-col items-center border-r border-[var(--f-border)] bg-[var(--f-bg)] z-20 select-none">
          <button type="button" aria-label="Ana menü" aria-haspopup="menu" onClick={(e) => openMenuUnder(e.currentTarget, shellMenu())} className="flex items-center justify-center w-12 h-12 text-[var(--f-icon)] hover:bg-[var(--f-bg-hover)] transition-colors cursor-pointer">
            <span className="flex items-center">{fi("24.figma")}<span className="-ml-1 text-[var(--f-icon-secondary)]">{fi("16.chevron.down")}</span></span>
          </button>
          <span className="w-6 h-px my-1 bg-[var(--f-border)]" />
          <NavTab icon={fi("24.page")} label="Dosya" active={leftTab === "file"} onClick={() => setLeftTab("file")} />
          <NavTab icon={fi("24.library")} label="Varlıklar" active={leftTab === "assets"} onClick={() => setLeftTab("assets")} />
          <NavTab icon={fi("variable.small")} label="Değişkenler" active={variablesOpen} onClick={() => setVariablesOpen(true)} />
        </nav>
      )}

      {/* ── The left sidebar ── */}
      {!minimized && (
        <aside data-left-panel="" className="w-[240px] shrink-0 h-full flex flex-col border-r border-[var(--f-border)] bg-[var(--f-bg)] z-10">
          <div className="shrink-0 flex items-start gap-1 h-14 pl-4 pr-2 pt-2 border-b border-[var(--f-border)]">
            <div className="min-w-0 flex-1 flex flex-col">
              <button type="button" aria-haspopup="menu" onClick={(e) => openMenuUnder(e.currentTarget, shellMenu())} className="flex items-center gap-1 min-w-0 h-[22px] text-left cursor-pointer">
                <span className="min-w-0 truncate text-[13px] font-[550] leading-[22px] tracking-[-0.0325px] text-[var(--f-text)]">{title || slug}</span>
                <span className="shrink-0 text-[var(--f-icon-secondary)]">{fi("16.chevron.down")}</span>
              </button>
              <span className="truncate text-[11px] leading-4 tracking-[0.055px] text-[var(--f-text-secondary)]">Projeler</span>
            </div>
            <IconButton label="Panelleri gizle (⌘\\)" icon={fi("24.sidebar.closed")} onClick={() => setMinimized(true)} />
          </div>
          {leftTab === "file" && (
            <>
              <section aria-label="Sayfalar" className="shrink-0 flex flex-col pb-2 border-b border-[var(--f-border)]">
                <CollapseHeader
                  label="Sayfalar"
                  icons={
                    <>
                      <IconButton label="Katmanlarda bul" icon={fi("24.search.small")} active={query !== null} onClick={() => setQuery((q) => (q === null ? "" : null))} />
                      <IconButton label="Sayfa ekle" icon={fi("plus.small")} onClick={addPage} />
                    </>
                  }
                />
                <div className="flex flex-col px-2 py-1">
                  {pages.map((pg) => {
                    const current = (file.currentPage ?? "") === pg.id;
                    return (
                      <div
                        key={pg.id || "main"}
                        onClick={() => !current && switchPage(pg.id)}
                        onDoubleClick={() => setRenamingPage(pg.id)}
                        onContextMenu={(e) => openMenu(e, [{ label: "Yeniden adlandır", onSelect: () => setRenamingPage(pg.id) }, { label: "Sayfayı sil", disabled: !pg.id, onSelect: () => removePage(pg.id) }])}
                        className={cn("flex items-center h-6 pl-2 pr-1 rounded-[5px] text-[11px] font-[450] leading-4 text-[var(--f-text)] cursor-pointer", current ? "bg-[var(--f-bg-hover)]" : "hover:bg-[var(--f-bg-hover)]")}
                      >
                        {renamingPage === pg.id ? (
                          <input autoFocus aria-label="Sayfa adı" defaultValue={pg.name} onFocus={(e) => e.currentTarget.select()} onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Enter") { renamePage(pg.id, e.currentTarget.value); setRenamingPage(null); } if (e.key === "Escape") setRenamingPage(null); }} onBlur={(e) => { renamePage(pg.id, e.currentTarget.value); setRenamingPage(null); }} className="min-w-0 flex-1 h-5 px-1 rounded-[3px] bg-[var(--f-bg)] border border-[var(--f-border-selected)] outline-none" />
                        ) : (
                          <>
                            <span className="min-w-0 flex-1 truncate">{pg.name}</span>
                            {!pg.id && <span className="text-[var(--f-text-secondary)]" title="Sitede görünen sayfa">{fi("16.page")}</span>}
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
              <CollapseHeader label="Katmanlar" icons={<IconButton label="Katmanları daralt" icon={fi("collapse-layers.small")} onClick={() => setOpen(new Set())} />} />
              {query !== null && (
                <div className="shrink-0 px-2 pb-2">
                  <TextInput label="Katmanlarda bul" value={query} placeholder="Bul…" onChange={setQuery} />
                </div>
              )}
              <ScrollArea className="flex-1 min-h-0" viewportClassName="h-full overflow-x-hidden flex flex-col pb-4" inset={8} edge={2}>
                <Layers
                  nodes={nodes}
                  filter={query || undefined}
                  selection={selected}
                  open={open}
                  onToggle={(id) => setOpen((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; })}
                  onToggleMany={(ids, on) => setOpen((prev) => { const next = new Set(prev); ids.forEach((id) => (on ? next.add(id) : next.delete(id))); return next; })}
                  onSelect={(id, additive) => setSelection(additive ? (selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]) : [id])}
                  onSelectMany={(ids) => setSelection(ids)}
                  onRename={(id, name) => patch(id, { name })}
                  onToggleHidden={(id) => { const n = getNode(nodes, id); if (n) patch(id, { visible: n.visible === false ? undefined : false }); }}
                  onToggleLocked={(id) => { const n = getNode(nodes, id); if (n) patch(id, { locked: n.locked ? undefined : true }); }}
                  onMoveInTree={moveInTree}
                  onContextMenu={(id, e) => { if (!selected.includes(id)) setSelection([id]); openMenu(e, nodeMenu(id)); }}
                />
              </ScrollArea>
            </>
          )}
          {leftTab === "assets" && (
            <ScrollArea className="flex-1 min-h-0" viewportClassName="h-full overflow-x-hidden flex flex-col pb-3" inset={8} edge={2}>
              <CollapseHeader label="Yerel bileşenler" />
              {components.length === 0 && <p className="px-4 py-1 text-[11px] leading-4 text-[var(--f-text-secondary)]">Henüz bileşen yok. Bir çerçeve seç, ⌥⌘K.</p>}
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
        </aside>
      )}

      {/* ── The canvas ── */}
      <div className="relative flex-1 min-w-0 h-full">
        {minimized && (
          <>
            <div className="absolute top-3 left-3 z-30 flex items-center gap-1 h-12 pl-2 pr-2 rounded-[13px] bg-[var(--f-bg)] shadow-[0_0_0.5px_rgba(0,0,0,0.3),0_1px_3px_rgba(0,0,0,0.15)] select-none">
              <button type="button" aria-label="Ana menü" onClick={(e) => openMenuUnder(e.currentTarget, shellMenu())} className="flex items-center justify-center w-8 h-8 rounded-[5px] text-[var(--f-icon)] hover:bg-[var(--f-bg-hover)] cursor-pointer">{fi("24.figma")}</button>
              <span className="px-1 text-[13px] font-[550] leading-[22px] tracking-[-0.0325px] text-[var(--f-text)]">{title || slug}</span>
              <IconButton label="Panelleri göster (⌘\\)" icon={fi("24.sidebar.closed")} onClick={() => setMinimized(false)} />
            </div>
            <div className="absolute top-3 right-3 z-30 flex items-center gap-2 h-12 pl-2 pr-2 rounded-[13px] bg-[var(--f-bg)] shadow-[0_0_0.5px_rgba(0,0,0,0.3),0_1px_3px_rgba(0,0,0,0.15)] select-none">
              <button type="button" aria-haspopup="menu" onClick={(e) => openMenuUnder(e.currentTarget, zoomMenu(), "right")} className="flex items-center h-8 px-2 rounded-[5px] text-[11px] text-[var(--f-text)] tabular-nums hover:bg-[var(--f-bg-hover)] cursor-pointer">
                {Math.round(view.zoom * 100)}%<span className="text-[var(--f-icon-secondary)]">{fi("16.chevron.down")}</span>
              </button>
              <button type="button" aria-label="Prototipi oynat" onClick={() => setPreviewing(previewTarget())} className="flex items-center justify-center w-8 h-8 rounded-[5px] text-[var(--f-icon)] hover:bg-[var(--f-bg-hover)] cursor-pointer">{fi("24.play")}</button>
              <SaveButton />
            </div>
          </>
        )}
        <Canvas
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
          zoomActionsRef={zoomActions}
          rulers={rulers}
          background={doc.background}
        />
        {/* The toolbar, as the kit's: 8px in, the tools 8px apart, a line before the end. */}
        <div role="toolbar" aria-label="Araçlar" onClick={(e) => e.stopPropagation()} className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 h-12 px-2 rounded-[13px] bg-[var(--f-bg)] shadow-[0_0_0.5px_rgba(0,0,0,0.3),0_1px_3px_rgba(0,0,0,0.15)] select-none">
          <Tool icon={<FigmaIcon name={tool === "hand" ? "24.hand" : "24.move"} />} label={tool === "hand" ? "El" : "Taşı"} shortcut={tool === "hand" ? "H" : "V"} active={tool === "move" || tool === "hand"} onClick={() => setTool("move")} menu={(el) => openMenuUnder(el, [{ label: "Taşı", shortcut: "V", checked: tool === "move", onSelect: () => setTool("move") }, { label: "El", shortcut: "H", checked: tool === "hand", onSelect: () => setTool("hand") }])} />
          <Tool icon={<FigmaIcon name="24.frame" />} label="Çerçeve" shortcut="F" active={tool === "frame"} onClick={() => setTool("frame")} />
          <Tool icon={<FigmaIcon name={tool === "ellipse" ? "24.ellipse" : tool === "line" ? "24.line" : "24.rectangle"} />} label={tool === "ellipse" ? "Elips" : tool === "line" ? "Çizgi" : "Dikdörtgen"} shortcut={tool === "ellipse" ? "O" : tool === "line" ? "L" : "R"} active={tool === "rectangle" || tool === "ellipse" || tool === "line"} onClick={() => setTool("rectangle")} menu={(el) => openMenuUnder(el, [{ label: "Dikdörtgen", shortcut: "R", checked: tool === "rectangle", onSelect: () => setTool("rectangle") }, { label: "Elips", shortcut: "O", checked: tool === "ellipse", onSelect: () => setTool("ellipse") }, { label: "Çizgi", shortcut: "L", checked: tool === "line", onSelect: () => setTool("line") }, "-", { label: "Görsel yerleştir…", shortcut: keys("shift", "mod", "k"), onSelect: placeImage }])} />
          <Tool icon={<FigmaIcon name="24.text" />} label="Metin" shortcut="T" active={tool === "text"} onClick={() => setTool("text")} />
          <span aria-hidden className="w-px h-12 -my-2 bg-[var(--f-border)]" />
          <Tool icon={<FigmaIcon name="24.component" />} label="Bileşen oluştur" shortcut="⌥⌘K" onClick={createComponent} />
          <Tool icon={<FigmaIcon name="24.prototyping" />} label="Prototipi oynat" onClick={() => setPreviewing(previewTarget())} />
        </div>
      </div>

      {/* ── The right sidebar: the header (the language, present, Kaydet), the tabs with the zoom, the properties ── */}
      {!minimized && (
        <aside data-design-panel="" className="w-[240px] shrink-0 h-full flex flex-col border-l border-[var(--f-border)] bg-[var(--f-bg)] z-10">
          <div className="shrink-0 flex flex-col gap-2 p-2 border-b border-[var(--f-border)]">
            <div className="flex items-center justify-between pl-1">
              <LangSwitch />
              <div className="flex items-center gap-2">
                <div className="flex items-center rounded-[5px] hover:bg-[var(--f-bg-hover)]">
                  <button type="button" aria-label="Yayında görüntüle" title={isPublished ? "Yayında görüntüle" : "Önce kaydet"} disabled={!isPublished} onClick={() => window.open(`/projects/${slug}`, "_blank")} className="flex items-center justify-center w-8 h-8 rounded-[5px] text-[var(--f-icon)] cursor-pointer disabled:opacity-40 disabled:cursor-default">
                    {fi("24.play")}
                  </button>
                  <button type="button" aria-label="Sunum menüsü" onClick={(e) => openMenuUnder(e.currentTarget, [{ label: "Yayında görüntüle", disabled: !isPublished, onSelect: () => window.open(`/projects/${slug}`, "_blank") }, { label: "Prototipi oynat", onSelect: () => setPreviewing(previewTarget()) }], "right")} className="flex items-center justify-center w-4 h-8 text-[var(--f-icon-secondary)] cursor-pointer">
                    {fi("16.chevron.down")}
                  </button>
                </div>
                <SaveButton />
              </div>
            </div>
            <div role="tablist" className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <Tab label="Tasarım" active={rightTab === "design"} onClick={() => setRightTab("design")} />
                <Tab label="Prototip" active={rightTab === "prototype"} onClick={() => setRightTab("prototype")} />
              </div>
              <button type="button" aria-haspopup="menu" onClick={(e) => openMenuUnder(e.currentTarget, zoomMenu(), "right")} className="flex items-center justify-end w-[60px] h-6 pl-1 rounded-[5px] text-[11px] leading-4 text-[var(--f-text)] tabular-nums hover:bg-[var(--f-bg-hover)] cursor-pointer">
                {Math.round(view.zoom * 100)}%
                <span className="text-[var(--f-icon-secondary)]">{fi("16.chevron.down")}</span>
              </button>
            </div>
          </div>
          <ScrollArea className="flex-1 min-h-0" viewportClassName="h-full overflow-x-hidden flex flex-col" inset={8} edge={2}>
            <Inspector nodes={nodes} selection={selected} tab={rightTab} ops={ops} variables={variables} byId={byId} mode={theme} textStyles={textStyles} lang={lang} background={doc.background ?? "#f5f5f5"} header={headerMenu} />
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
    <div role="dialog" aria-label="Prototip" className="fixed inset-0 z-50 flex flex-col bg-[#1e1e1e]" onClick={onClose}>
      <div className="shrink-0 flex items-center justify-between h-12 px-4 text-[11px] text-white" onClick={(e) => e.stopPropagation()}>
        <span className="font-semibold">{node.name} — Prototip</span>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setRun((r) => r + 1)} className="h-7 px-2.5 rounded-[5px] bg-white/10 hover:bg-white/20 cursor-pointer">Baştan</button>
          <button type="button" onClick={onClose} className="h-7 px-2.5 rounded-[5px] bg-white/10 hover:bg-white/20 cursor-pointer">Kapat (Esc)</button>
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-auto flex items-start justify-center p-8" onClick={(e) => e.stopPropagation()}>
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
