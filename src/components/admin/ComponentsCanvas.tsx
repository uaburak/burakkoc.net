"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Block, BlockType } from "@/types/project";
import type { CanvasNode, ComponentLayer, DesignComponent } from "@/types/design";
import { cn } from "@/lib/utils";
import { gridFlow } from "@/lib/projectLayout";
import { CanvasNodeView, ItemComponentView, ProjectBlock, StaticTextEditContext } from "@/components/project/ComponentView";
import { FillHeightContext } from "@/components/project/fillHeight";
import { componentFrameProps } from "@/components/project/LayoutGrid";
import { frameLookStyle } from "@/components/project/frameLook";
import { useDesignVariables } from "@/components/project/designVariables";
import { findLayer, findRepeat, isComponentSet, isVariant, setIdOf, topComponents, variantName, variantsOf } from "@/components/project/components";
import { FigmaIcon, fi } from "@/components/admin/figmaIcons";
import { TRIGGERS } from "@/components/project/interactions";
import { Icons, LayerButton, LayerRow, TREE_TONE, layerNode } from "@/components/admin/layerTree";
import {
  DRAW_TOOLS,
  SET_INSET,
  canHoldDrawings,
  canvasWidth,
  fitView,
  isNodeSelection,
  setLayoutOf,
  zoomAround,
  type CanvasSelection,
  type CanvasTool,
  type CanvasView,
  type DrawParent,
  type MainSelection,
  type NodeSelection,
  type ZoomActions,
} from "@/components/admin/canvasModel";

export type { CanvasSelection, MainSelection, NodeSelection } from "@/components/admin/canvasModel";

/**
 * The live editor's Bileşenler page — a Figma page: an endless canvas. The
 * site's main components float on it, each where it was put (a set — its
 * variants in a dashed purple frame — as one), and frames, rectangles,
 * ellipses and texts are drawn anywhere on it (CanvasNode), or into a frame
 * — a drawing's, or a main component's. As in Figma:
 * - the wheel (two fingers) moves the view, Cmd / Ctrl with it (a pinch)
 *   zooms; Space held, the hand (H) or the middle button drag it; ⇧0 is
 *   100%, ⇧1 fits everything, ⇧2 the selection, ⌘+ / ⌘− zoom;
 * - a click selects what is on the canvas — a component (a variant, inside
 *   a set; the set on its own frame or name) or a drawing — and the next one
 *   a layer inside it (Cmd / Ctrl: the layer at once); dragging moves it;
 *   its handles size it;
 * - F (or A), R, O and T draw: drag out a frame, a rectangle, an ellipse, or
 *   click (100 × 100 — a text, typed in at once); then the move tool is back.
 * The lines (hover, selection, handles, size, names) are drawn over the
 * canvas at the screen's scale, whatever the zoom; the canvas itself is
 * drawn at its zoom (CSS zoom), so it stays sharp as vectors do.
 */

// ── Selections on the canvas ──────────────────────────────────────────────────

/** The elements on the canvas a main selection is — a repeated layer is every one of its instances. */
export function mainSelector(selection: MainSelection, components: readonly DesignComponent[]): string {
  if (selection.set) return `[data-component-set="${selection.componentId}"] > [data-set-frame]`;
  const root = `[data-main-component="${selection.componentId}"]`;
  if (!selection.layerId) return `${root} [data-main-frame]`;
  const component = components.find((c) => c.id === selection.componentId);
  return component && findRepeat(component)?.layer.id === selection.layerId ? `${root} [data-component]` : `${root} [data-layer-id="${selection.layerId}"]`;
}

/** …and a drawing, or a layer of one. */
export const nodeSelector = (selection: NodeSelection) =>
  selection.layerId && selection.layerId !== selection.nodeId ? `[data-canvas-node="${selection.nodeId}"] [data-layer-id="${selection.layerId}"]` : `[data-canvas-node="${selection.nodeId}"]`;

/** The elements any selection on the canvas is. */
export const canvasSelector = (selection: CanvasSelection, components: readonly DesignComponent[]) =>
  isNodeSelection(selection) ? nodeSelector(selection) : mainSelector(selection, components);

/** The element whose auto layout a main component's frame is (its columns and rows are measured there). */
export function mainFrameSelector(component: DesignComponent) {
  return `[data-main-component="${component.id}"] [data-component-frame]`;
}

/** What moves with the selection when it is dragged: a drawing, a component or a set — on the canvas itself, not inside another. */
type TopTarget = { componentId: string } | { nodeId: string };

function topOf(selection: CanvasSelection, components: readonly DesignComponent[]): TopTarget | null {
  if (isNodeSelection(selection)) return selection.layerId && selection.layerId !== selection.nodeId ? null : { nodeId: selection.nodeId };
  if (selection.layerId) return null;
  if (selection.set) return { componentId: selection.componentId };
  const component = components.find((c) => c.id === selection.componentId);
  return component && !isVariant(component, components) ? { componentId: component.id } : null;
}

/**
 * What a press at `target` selects: a drawing, or — inside the selected one,
 * or `deep` — its layer there; the main component under it (a variant,
 * inside a set; the set, on its own frame), or — inside the selected one, or
 * `deep` — its layer there: an item (one of the instances it repeats), else
 * the innermost of its own layers.
 */
export function pickAt(
  target: Element,
  components: readonly DesignComponent[],
  nodes: readonly CanvasNode[],
  selection: CanvasSelection | null,
  deep: boolean
): { selection: CanvasSelection; el: HTMLElement } | null {
  const nodeEl = target.closest<HTMLElement>("[data-canvas-node]");
  if (nodeEl?.dataset.canvasNode) {
    const nodeId = nodeEl.dataset.canvasNode;
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return null;
    const layerEl = target.closest<HTMLElement>("[data-layer-id]");
    const layerId = layerEl && nodeEl.contains(layerEl) ? layerEl.dataset.layerId : undefined;
    const inside = Boolean(selection && isNodeSelection(selection) && selection.nodeId === nodeId);
    if (layerEl && layerId && layerId !== nodeId && node.kind === "frame" && (inside || deep)) return { selection: { nodeId, layerId }, el: layerEl };
    return { selection: { nodeId }, el: nodeEl };
  }
  const root = target.closest<HTMLElement>("[data-main-component]");
  const component = components.find((c) => c.id === root?.dataset.mainComponent);
  if (!root || !component) {
    // The set's own frame, the room around its variants: the set.
    const set = target.closest<HTMLElement>("[data-component-set]");
    const frame = set?.querySelector<HTMLElement>(":scope > [data-set-frame]");
    return set?.dataset.componentSet && frame ? { selection: { componentId: set.dataset.componentSet, set: true }, el: frame } : null;
  }
  const frame = root.querySelector<HTMLElement>("[data-main-frame]");
  const repeat = findRepeat(component);
  const item = repeat ? target.closest<HTMLElement>("[data-component]") : null;
  const own = target.closest<HTMLElement>("[data-layer-id]:not([data-layer-id^='item:'])");
  const layerEl = item && root.contains(item) ? item : own && root.contains(own) ? own : null;
  const layerId = layerEl === item && repeat ? repeat.layer.id : layerEl?.dataset.layerId;
  const inside = Boolean(selection && !isNodeSelection(selection) && selection.componentId === component.id && !selection.set);
  if (layerEl && layerId && (inside || deep)) return { selection: { componentId: component.id, layerId }, el: layerEl };
  return frame ? { selection: { componentId: component.id }, el: frame } : null;
}

/** Where a drawing started at `target` goes: the innermost frame under it that can hold one — a drawing's, a main component's — or the canvas. */
function drawParentAt(target: Element, components: readonly DesignComponent[], nodes: readonly CanvasNode[]): DrawParent {
  const inFrames = <H extends { layers: ComponentLayer[] }>(holder: H, root: Element, selector: string): string | null | undefined => {
    let el = target.closest<HTMLElement>(selector);
    while (el && root.contains(el)) {
      const layer = el.dataset.layerId ? findLayer(holder, el.dataset.layerId) : null;
      if (layer?.kind === "frame" && canHoldDrawings(layer)) return layer.id;
      el = el.parentElement?.closest<HTMLElement>(selector) ?? null;
    }
    // Its own frame, when it can hold one (undefined: it can't).
    return canHoldDrawings(holder) ? null : undefined;
  };
  const nodeEl = target.closest<HTMLElement>("[data-canvas-node]");
  if (nodeEl) {
    const node = nodes.find((n) => n.id === nodeEl.dataset.canvasNode);
    if (!node || node.kind !== "frame") return null;
    const frameId = inFrames(node, nodeEl, "[data-layer-id]");
    return frameId === undefined ? null : { nodeId: node.id, frameId };
  }
  const root = target.closest<HTMLElement>("[data-main-component]");
  const component = components.find((c) => c.id === root?.dataset.mainComponent);
  if (!root || !component) return null;
  const frameId = inFrames(component, root, "[data-layer-id]:not([data-layer-id^='item:'])");
  return frameId === undefined ? null : { componentId: component.id, frameId };
}

// ── Drawing on the canvas ─────────────────────────────────────────────────────

/** A main component on the canvas: its frame — a page component on the page's background — drawn with a sample instance's content. */
function MainFrame({ component, holder, sampleBlock }: { component: DesignComponent; holder?: DesignComponent; sampleBlock: (type: BlockType) => Block }) {
  // A Fixed height on the canvas: its frame fills it.
  const fill = Boolean(component.canvas?.height);
  return (
    <div data-main-frame="" className={cn("w-full", component.type && "bg-[var(--bg-1)]", fill && "flex-1 min-h-0 flex flex-col")}>
      <FillHeightContext.Provider value={fill}>
        {component.type ? (
          <ProjectBlock block={{ ...sampleBlock(component.type), id: `main-${component.id}`, component: component.id }} sample />
        ) : (
          <ItemComponentView component={component} type={holder?.type} entry={holder?.type ? sampleBlock(holder.type).entries?.[0] : undefined} fill={fill} />
        )}
      </FillHeightContext.Provider>
    </div>
  );
}

type Rect = { x: number; y: number; w: number; h: number };
const ORIGIN = { x: 0, y: 0 };
type StaticTextHandler = (target: TopTarget, layerId: string, text: string) => void;

/** The page component repeating a component used inside others — one of its set's variants: its type's items give it its texts. */
function holderOf(component: DesignComponent, components: readonly DesignComponent[]) {
  return components.find((c) => {
    const repeated = c.type ? findRepeat(c)?.layer.component : undefined;
    const other = repeated ? components.find((o) => o.id === repeated) : undefined;
    return other ? setIdOf(other) === setIdOf(component) : false;
  });
}

/** One top's own texts typed in place (see StaticTextEditContext) — its handler the same object while nothing changed. */
function StaticEdit({ target, onStaticText, autoEdit, children }: { target: TopTarget; onStaticText: StaticTextHandler; autoEdit: string | null; children: ReactNode }) {
  const value = useMemo(() => ({ onChange: (layerId: string, text: string) => onStaticText(target, layerId, text), autoEdit }), [target, onStaticText, autoEdit]);
  return <StaticTextEditContext.Provider value={value}>{children}</StaticTextEditContext.Provider>;
}

/** A variant in its set's frame: its values over it, then the component itself. */
function VariantView({ variant, components, sampleBlock, onStaticText, autoEdit }: {
  variant: DesignComponent;
  components: readonly DesignComponent[];
  sampleBlock: (type: BlockType) => Block;
  onStaticText: StaticTextHandler;
  autoEdit: string | null;
}) {
  const target = useMemo(() => ({ componentId: variant.id }), [variant.id]);
  return (
    <div data-main-component={variant.id} className="flex flex-col gap-1.5" style={{ width: canvasWidth(variant), height: variant.canvas?.height }}>
      <span className="shrink-0 text-[11px] leading-4 text-[color-mix(in_srgb,var(--edit-component)_75%,transparent)]">{variantName(variant)}</span>
      <StaticEdit target={target} onStaticText={onStaticText} autoEdit={autoEdit}>
        <MainFrame component={variant} holder={holderOf(variant, components)} sampleBlock={sampleBlock} />
      </StaticEdit>
    </div>
  );
}

/**
 * A top-level main component at its place on the canvas — or a component
 * set: its variants in its dashed frame, laid out by its own auto layout,
 * with its own look. Memoized: the view moving (a pan, a zoom) or another
 * top moving redraws nothing in it — only its own props do.
 */
const TopComponentView = memo(function TopComponentView({ component, components, place, dx, dy, sampleBlock, onStaticText, autoEdit }: {
  component: DesignComponent;
  components: DesignComponent[];
  place: { x: number; y: number };
  /** How far a drag (or a nudge) under way has moved it */
  dx: number;
  dy: number;
  sampleBlock: (type: BlockType) => Block;
  onStaticText: StaticTextHandler;
  autoEdit: string | null;
}) {
  const variables = useDesignVariables();
  const target = useMemo(() => ({ componentId: component.id }), [component.id]);
  const style = { left: place.x + dx, top: place.y + dy } as const;
  if (!isComponentSet(component, components)) {
    return (
      <div data-top="" data-top-component={component.id} data-main-component={component.id} className="absolute flex flex-col" style={{ ...style, width: canvasWidth(component), height: component.canvas?.height }}>
        <StaticEdit target={target} onStaticText={onStaticText} autoEdit={autoEdit}>
          <MainFrame component={component} holder={holderOf(component, components)} sampleBlock={sampleBlock} />
        </StaticEdit>
      </div>
    );
  }
  const frame = componentFrameProps(setLayoutOf(component));
  return (
    <div data-top="" data-top-component={component.id} data-component-set={component.id} className="absolute w-max" style={style}>
      <div
        data-set-frame=""
        className={cn("rounded-[5px] border border-dashed border-[var(--edit-component)]", frame.className)}
        style={{ ...frame.style, ...frameLookStyle(component.setFrame?.look, variables) }}
      >
        {variantsOf(component.id, components).map((variant) => (
          <VariantView key={variant.id} variant={variant} components={components} sampleBlock={sampleBlock} onStaticText={onStaticText} autoEdit={autoEdit} />
        ))}
      </div>
    </div>
  );
});

/** Something drawn on the canvas on its own, at its place — memoized as a main component is. */
const TopNodeView = memo(function TopNodeView({ node, dx, dy, onStaticText, autoEdit }: {
  node: CanvasNode;
  dx: number;
  dy: number;
  onStaticText: StaticTextHandler;
  autoEdit: string | null;
}) {
  const target = useMemo(() => ({ nodeId: node.id }), [node.id]);
  const width = node.size?.width === "fixed" && node.size.widthPx ? node.size.widthPx : undefined;
  const height = node.size?.height === "fixed" && node.size.heightPx ? node.size.heightPx : undefined;
  return (
    <div data-top="" data-canvas-node={node.id} className="absolute flex flex-col" style={{ left: node.canvas.x + dx, top: node.canvas.y + dy, width: width ?? "max-content", height }}>
      <StaticEdit target={target} onStaticText={onStaticText} autoEdit={autoEdit}>
        <CanvasNodeView node={node} />
      </StaticEdit>
    </div>
  );
});

/** Resize handles: the sides and corners they move. */
type Handle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";
const ALL_HANDLES: Handle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];
const HANDLE_CURSOR: Record<Handle, string> = { n: "ns-resize", s: "ns-resize", e: "ew-resize", w: "ew-resize", ne: "nesw-resize", sw: "nesw-resize", nw: "nwse-resize", se: "nwse-resize" };

/** A prototype's connection on the canvas: from a variant to the one it changes to, with its trigger. */
type Link = { key: string; from: Rect; to: Rect; label: string; source: string };
/** What the lines over the canvas show, in the viewport's pixels. */
type Shown = { boxes: Rect[]; hover: Rect | null; set: Rect | null; links: Link[]; multi: Rect[] };
/** A smart guide (Figma's pink line): the canvas coordinate a dragged thing's edge or center snapped to. */
type Guide = { axis: "x" | "y"; at: number };

/** A connection's curve, as Figma's noodles: out of the source's right side into the target's left — or, one under the other, round into its right side. */
function noodle(from: Rect, to: { x: number; y: number; w: number; h: number }) {
  const start = { x: from.x + from.w, y: from.y + from.h / 2 };
  const beside = to.x > start.x + 24;
  const end = beside ? { x: to.x, y: to.y + to.h / 2 } : { x: to.x + to.w, y: to.y + to.h / 2 };
  const reach = beside ? Math.max(40, (end.x - start.x) / 2) : 72;
  const c1 = { x: start.x + reach, y: start.y };
  const c2 = beside ? { x: end.x - reach, y: end.y } : { x: end.x + reach, y: end.y };
  const mid = { x: 0.125 * start.x + 0.375 * c1.x + 0.375 * c2.x + 0.125 * end.x, y: 0.125 * start.y + 0.375 * c1.y + 0.375 * c2.y + 0.125 * end.y };
  return { d: `M ${start.x} ${start.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${end.x} ${end.y}`, mid };
}

const ORIGIN_MOVE = { dx: 0, dy: 0 };
const TOOL_KEYS: Record<string, CanvasTool> = { v: "move", h: "hand", f: "frame", a: "frame", r: "rectangle", o: "ellipse", t: "text" };

export function ComponentsCanvas({
  components,
  nodes,
  places,
  onMeasure,
  sampleBlock,
  selection,
  view,
  onView,
  tool,
  onTool,
  onSelect,
  onAddVariant,
  onContextMenu,
  onMove,
  onResize,
  onDraw,
  onStaticText,
  autoEdit,
  prototype = false,
  onConnect,
  zoomActionsRef,
}: {
  components: DesignComponent[];
  nodes: CanvasNode[];
  /** Where each top-level main component sits (see canvasPlaces) */
  places: Map<string, { x: number; y: number }>;
  /** Their heights as drawn (for the places of the ones in their columns) */
  onMeasure: (heights: Record<string, number>) => void;
  /** What a type's main component shows: its first instance's content on the project, else samples */
  sampleBlock: (type: BlockType) => Block;
  selection: CanvasSelection | null;
  view: CanvasView;
  onView: (update: (view: CanvasView) => CanvasView) => void;
  tool: CanvasTool;
  onTool: (tool: CanvasTool) => void;
  onSelect: (next: CanvasSelection | null) => void;
  /** A set's "+": a variant more */
  onAddVariant: (setId: string) => void;
  /** A right click: what it selects (null: the canvas itself) and where */
  onContextMenu: (at: CanvasSelection | null, e: React.MouseEvent) => void;
  /** Moved: where a top-level one goes */
  onMove: (target: TopTarget, place: { x: number; y: number }) => void;
  /** Sized with a handle: its rect now (canvas px) and which of its axes changed */
  onResize: (target: CanvasSelection, rect: Rect, changed: { x: boolean; y: boolean }) => void;
  /** Drawn: the tool, its rect (canvas px), where it goes, and whether it was a click (a default size) */
  onDraw: (tool: CanvasTool, rect: Rect, parent: DrawParent, clicked: boolean) => void;
  /** A text of its own typed in: in a component's layer or a drawing's */
  onStaticText: (target: TopTarget, layerId: string, text: string) => void;
  /** The text just made, typed in at once */
  autoEdit: string | null;
  /** Figma's Prototype mode: the connections between variants shown, a new one dragged out of the selected variant */
  prototype?: boolean;
  /** A connection dragged from `from` and let go over `to` (null: over nothing), where it was let go */
  onConnect?: (from: string, to: string | null, at: { x: number; y: number }) => void;
  /** The zoom's actions, for the chrome's zoom menu (the design panel's top) */
  zoomActionsRef?: React.RefObject<ZoomActions | null>;
}) {
  const viewport = useRef<HTMLElement>(null);
  const world = useRef<HTMLDivElement>(null);
  const hovered = useRef<HTMLElement | null>(null);
  const [space, setSpace] = useState(false);
  // A pan, a move, a resize, a drawing or a marquee (a rubber-band select) under way.
  const [dragging, setDragging] = useState<"pan" | "move" | "resize" | "draw" | "marquee" | null>(null);
  // What is moving now (a drag, or a nudge held down) — every top it carries, the same delta.
  const [moved, setMoved] = useState<{ keys: ReadonlySet<string>; dx: number; dy: number } | null>(null);
  const [drawRect, setDrawRect] = useState<Rect | null>(null);
  // The marquee's own rect while it is dragged out (canvas px) — what is under it, once let go, is the selection.
  const [marquee, setMarquee] = useState<Rect | null>(null);
  // More than one top selected by a marquee (or held onto through a group move): their own keys ("c:id" / "n:id") — the single `selection` stays null while it holds more than one.
  const [multi, setMulti] = useState<ReadonlySet<string>>(new Set());
  // The smart guides (Figma's pink lines) a single drag is snapped to right now.
  const [guides, setGuides] = useState<Guide[]>([]);
  const [shown, setShown] = useState<Shown>({ boxes: [], hover: null, set: null, links: [], multi: [] });
  // A connection being dragged out (Prototype mode): from the handle to the pointer, in the viewport's pixels.
  const [connecting, setConnecting] = useState<{ from: Rect; to: { x: number; y: number } } | null>(null);

  // The tops' texts typed in: the latest handler, behind one function that never changes (the tops are memoized on it).
  const staticTextRef = useRef(onStaticText);
  useEffect(() => {
    staticTextRef.current = onStaticText;
  });
  const staticText = useCallback<StaticTextHandler>((target, layerId, text) => staticTextRef.current(target, layerId, text), []);

  const selector = selection ? canvasSelector(selection, components) : null;
  const selectedSet = selection && !isNodeSelection(selection) ? setIdOf({ id: selection.componentId, set: components.find((c) => c.id === selection.componentId)?.set }) : null;
  const setSelector = selectedSet && components.some((c) => c.set === selectedSet || (c.id === selectedSet && c.variant?.length)) ? `[data-component-set="${selectedSet}"] > [data-set-frame]` : null;

  // The latest of everything, for the listeners set up once.
  const latest = useRef({ view, selector, setSelector, tool, space, components, nodes, selection, prototype, multi });
  useEffect(() => {
    latest.current = { view, selector, setSelector, tool, space, components, nodes, selection, prototype, multi };
  });

  /** A top's own element, by its key ("c:id" / "n:id" — see keyOf). */
  const topAttrSelector = (key: string) => (key.startsWith("n:") ? `[data-canvas-node="${key.slice(2)}"]` : `[data-top-component="${key.slice(2)}"]`);

  // The lines over the canvas follow what they outline, every frame (moves, zooms, typing, images loading).
  useEffect(() => {
    let raf = 0;
    let last = "";
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const vp = viewport.current;
      if (!vp) return;
      const base = vp.getBoundingClientRect();
      const rel = (r: DOMRect): Rect => ({ x: Math.round(r.left - base.left), y: Math.round(r.top - base.top), w: Math.round(r.width), h: Math.round(r.height) });
      const { selector: sel, setSelector: setSel, multi: multiKeys } = latest.current;
      const boxes = sel ? Array.from(vp.querySelectorAll(sel)).map((el) => rel(el.getBoundingClientRect())) : [];
      // A marquee's own group: every one of its tops, its own outline.
      const multi = Array.from(multiKeys).flatMap((key) => {
        const el = vp.querySelector(topAttrSelector(key));
        return el ? [rel(el.getBoundingClientRect())] : [];
      });
      // What the pointer is over — or the layer hovered in the tree.
      const over = hovered.current?.isConnected ? hovered.current : vp.querySelector("[data-layer-hover]");
      const hover = over ? rel(over.getBoundingClientRect()) : null;
      const setEl = setSel ? vp.querySelector(setSel) : null;
      // Prototype mode: every interaction's connection, from its variant to the one it changes to.
      const frameOf = (id: string) => vp.querySelector(`[data-main-component="${id}"] > [data-main-frame]`);
      const links: Link[] = latest.current.prototype
        ? latest.current.components.flatMap((c) =>
            (c.interactions ?? []).flatMap((i) => {
              const a = frameOf(c.id);
              const b = frameOf(i.target);
              return a && b ? [{ key: `${c.id}:${i.id}`, from: rel(a.getBoundingClientRect()), to: rel(b.getBoundingClientRect()), label: TRIGGERS[i.trigger], source: c.id }] : [];
            })
          )
        : [];
      const next: Shown = { boxes, hover, set: setEl ? rel(setEl.getBoundingClientRect()) : null, links, multi };
      const key = JSON.stringify(next);
      if (key === last) return;
      last = key;
      setShown(next);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // The heights of the main components as drawn: their columns' places follow them.
  const measureRef = useRef(onMeasure);
  useEffect(() => {
    measureRef.current = onMeasure;
  });
  useEffect(() => {
    const root = world.current;
    if (!root) return;
    const measure = () => {
      const heights: Record<string, number> = {};
      root.querySelectorAll<HTMLElement>("[data-top-component]").forEach((el) => {
        if (el.dataset.topComponent) heights[el.dataset.topComponent] = el.offsetHeight;
      });
      measureRef.current(heights);
    };
    const observer = new ResizeObserver(measure);
    root.querySelectorAll("[data-top-component]").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [components]);

  // The wheel moves the view; with Cmd / Ctrl (a pinch) it zooms around the pointer.
  useEffect(() => {
    const el = viewport.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if ((e.target as Element).closest("[role=menu]")) return;
      e.preventDefault();
      const r = el.getBoundingClientRect();
      if (e.ctrlKey || e.metaKey) {
        const factor = Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.01));
        onView((v) => zoomAround(v, v.zoom * factor, { x: e.clientX - r.left, y: e.clientY - r.top }));
      } else {
        const sideways = e.shiftKey && !e.deltaX;
        onView((v) => ({ ...v, x: v.x - (sideways ? e.deltaY : e.deltaX), y: v.y - (sideways ? 0 : e.deltaY) }));
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [onView]);

  // ── The view ──
  const viewportSize = () => {
    const r = viewport.current?.getBoundingClientRect();
    return { width: r?.width ?? 800, height: r?.height ?? 600 };
  };
  const zoomTo = (zoom: number) => {
    const { width, height } = viewportSize();
    onView((v) => zoomAround(v, zoom, { x: width / 2, y: height / 2 }));
  };
  /** The canvas rect around these elements. */
  const boundsOf = (els: Element[]): Rect | null => {
    const vp = viewport.current;
    if (!vp || els.length === 0) return null;
    const base = vp.getBoundingClientRect();
    const { view: v } = latest.current;
    const rects = els.map((el) => el.getBoundingClientRect());
    const left = Math.min(...rects.map((r) => r.left));
    const top = Math.min(...rects.map((r) => r.top));
    const right = Math.max(...rects.map((r) => r.right));
    const bottom = Math.max(...rects.map((r) => r.bottom));
    return { x: (left - base.left - v.x) / v.zoom, y: (top - base.top - v.y) / v.zoom, w: (right - left) / v.zoom, h: (bottom - top) / v.zoom };
  };
  const fitAll = () => {
    const bounds = boundsOf(Array.from(world.current?.querySelectorAll("[data-top]") ?? []));
    const { width, height } = viewportSize();
    if (bounds) onView(() => fitView(bounds, width, height));
  };
  const fitSelection = () => {
    const sel = latest.current.selector;
    const bounds = sel ? boundsOf(Array.from(viewport.current?.querySelectorAll(sel) ?? [])) : null;
    const { width, height } = viewportSize();
    if (bounds) onView(() => fitView(bounds, width, height, false));
    else fitAll();
  };
  const zoomActions = useRef({ zoomTo, fitAll, fitSelection });
  useEffect(() => {
    zoomActions.current = { zoomTo, fitAll, fitSelection };
    if (zoomActionsRef) zoomActionsRef.current = zoomActions.current;
    return () => { if (zoomActionsRef) zoomActionsRef.current = null; };
  });

  /** Where a top-level one sits now. */
  const placeOf = (target: TopTarget) => {
    if ("nodeId" in target) {
      const node = nodes.find((n) => n.id === target.nodeId);
      return node ? { x: node.canvas.x, y: node.canvas.y } : null;
    }
    return places.get(target.componentId) ?? null;
  };
  const keyOf = (target: TopTarget) => ("nodeId" in target ? `n:${target.nodeId}` : `c:${target.componentId}`);
  /** …and back: the target a marquee's (or a group move's) own key is. */
  const targetOfKey = (key: string): TopTarget | null => (key.startsWith("n:") ? { nodeId: key.slice(2) } : key.startsWith("c:") ? { componentId: key.slice(2) } : null);

  // Arrow keys (Figma's nudge): the selection, or a marquee's group, by 1px (Shift: 10px) — held
  // down, it keeps going as one move, committed once on keyup (not a history entry per repeat).
  const nudgeSession = useRef<{ keys: ReadonlySet<string>; origins: Map<string, { x: number; y: number }>; dx: number; dy: number } | null>(null);
  const nudgeStep = (dx: number, dy: number): boolean => {
    let session = nudgeSession.current;
    if (!session) {
      const { selection: sel, multi: group, components: comps } = latest.current;
      const keys = group.size > 1 ? group : (() => {
        const top = sel ? topOf(sel, comps) : null;
        return top ? new Set([keyOf(top)]) : new Set<string>();
      })();
      if (keys.size === 0) return false;
      const origins = new Map<string, { x: number; y: number }>();
      for (const key of keys) {
        const t = targetOfKey(key);
        const o = t && placeOf(t);
        if (t && o) origins.set(key, o);
      }
      session = { keys, origins, dx: 0, dy: 0 };
      nudgeSession.current = session;
    }
    session.dx += dx;
    session.dy += dy;
    setMoved({ keys: session.keys, dx: session.dx, dy: session.dy });
    return true;
  };
  const commitNudge = () => {
    const session = nudgeSession.current;
    nudgeSession.current = null;
    if (!session) return;
    setMoved(null);
    for (const [key, origin] of session.origins) {
      const t = targetOfKey(key);
      if (t) onMove(t, { x: Math.round(origin.x + session.dx), y: Math.round(origin.y + session.dy) });
    }
  };
  const moveActions = useRef({ nudgeStep, commitNudge });
  useEffect(() => {
    moveActions.current = { nudgeStep, commitNudge };
  });

  // Keys, as Figma's: the tools, Space for the hand, the zoom — never while typing.
  useEffect(() => {
    const typing = () => {
      const el = document.activeElement as HTMLElement | null;
      return Boolean(el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)));
    };
    const onDown = (e: KeyboardEvent) => {
      if (typing() || document.querySelector("[role=menu]")) return;
      const key = e.key.toLowerCase();
      const { view: v } = latest.current;
      if (e.key === " " && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setSpace(true);
        return;
      }
      if ((e.metaKey || e.ctrlKey) && !e.altKey && (key === "=" || key === "+" || key === "-")) {
        e.preventDefault();
        zoomActions.current.zoomTo(key === "-" ? v.zoom / 2 : v.zoom * 2);
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key.startsWith("Arrow")) {
        const step = e.shiftKey ? 10 : 1;
        const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
        const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
        if (moveActions.current.nudgeStep(dx, dy)) e.preventDefault();
        return;
      }
      if (e.shiftKey && (e.code === "Digit0" || e.code === "Digit1" || e.code === "Digit2")) {
        e.preventDefault();
        if (e.code === "Digit0") zoomActions.current.zoomTo(1);
        else if (e.code === "Digit1") zoomActions.current.fitAll();
        else zoomActions.current.fitSelection();
        return;
      }
      if (e.shiftKey || e.repeat) return;
      if (e.key === "Escape" && latest.current.tool !== "move") {
        onTool("move");
        return;
      }
      const next = TOOL_KEYS[key];
      if (next) {
        e.preventDefault();
        onTool(next);
      }
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.key === " ") setSpace(false);
      if (e.key.startsWith("Arrow")) moveActions.current.commitNudge();
    };
    const reset = () => {
      setSpace(false);
      moveActions.current.commitNudge();
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    window.addEventListener("blur", reset);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      window.removeEventListener("blur", reset);
    };
  }, [onTool]);

  // ── Pointer: pan, move, resize, draw ──
  /** A canvas point from a pointer's. */
  const toCanvas = (clientX: number, clientY: number) => {
    const r = viewport.current!.getBoundingClientRect();
    const { view: v } = latest.current;
    return { x: (clientX - r.left - v.x) / v.zoom, y: (clientY - r.top - v.y) / v.zoom };
  };
  /** Follows the pointer until it lets go (whatever it is over), then `end`. */
  const follow = (kind: NonNullable<typeof dragging>, move: (e: PointerEvent) => void, end: (e: PointerEvent) => void) => {
    setDragging(kind);
    const onMovePointer = (e: PointerEvent) => move(e);
    const onUp = (e: PointerEvent) => {
      window.removeEventListener("pointermove", onMovePointer);
      window.removeEventListener("pointerup", onUp);
      setDragging(null);
      end(e);
    };
    window.addEventListener("pointermove", onMovePointer);
    window.addEventListener("pointerup", onUp);
  };
  const startPan = (e: React.PointerEvent) => {
    e.preventDefault();
    const start = { x: e.clientX, y: e.clientY, view: latest.current.view };
    follow(
      "pan",
      (ev) => onView(() => ({ ...start.view, x: start.view.x + ev.clientX - start.x, y: start.view.y + ev.clientY - start.y })),
      () => {}
    );
  };
  /** A key's full selection — a set's frame selects the set. */
  const selectionOfKey = (key: string): CanvasSelection | null => {
    if (key.startsWith("n:")) return { nodeId: key.slice(2) };
    if (!key.startsWith("c:")) return null;
    const id = key.slice(2);
    const component = components.find((c) => c.id === id);
    return component && isComponentSet(component, components) ? { componentId: id, set: true } : { componentId: id };
  };
  /** Every top's own rect on the canvas, as drawn (its place, its measured size) — for a marquee's hit test and a drag's smart guides. */
  const topRects = (): { key: string; rect: Rect }[] => {
    const vp = viewport.current;
    if (!vp) return [];
    const list: { key: string; rect: Rect }[] = [];
    for (const c of tops) {
      const place = places.get(c.id);
      const el = vp.querySelector<HTMLElement>(`[data-top-component="${c.id}"]`);
      if (place && el) list.push({ key: `c:${c.id}`, rect: { x: place.x, y: place.y, w: el.offsetWidth, h: el.offsetHeight } });
    }
    for (const n of nodes) {
      const el = vp.querySelector<HTMLElement>(`[data-canvas-node="${n.id}"]`);
      if (el) list.push({ key: `n:${n.id}`, rect: { x: n.canvas.x, y: n.canvas.y, w: el.offsetWidth, h: el.offsetHeight } });
    }
    return list;
  };
  const intersects = (a: Rect, b: Rect) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  /** The other tops' edges and centers, to snap a lone drag to (Figma's smart guides). */
  const snapCandidates = (excludeKey: string) => {
    const xs: number[] = [];
    const ys: number[] = [];
    for (const { key, rect } of topRects()) {
      if (key === excludeKey) continue;
      xs.push(rect.x, rect.x + rect.w / 2, rect.x + rect.w);
      ys.push(rect.y, rect.y + rect.h / 2, rect.y + rect.h);
    }
    return { xs, ys };
  };
  /** Moved by a drag — `group`, held together, else `target` alone; snapped to its siblings' edges when it is alone. */
  const startMove = (e: React.PointerEvent, target: TopTarget, group?: ReadonlySet<string>) => {
    const primaryKey = keyOf(target);
    const keys = group && group.size > 1 ? group : new Set([primaryKey]);
    const origins = new Map<string, { x: number; y: number }>();
    for (const key of keys) {
      const t = targetOfKey(key);
      const o = t && placeOf(t);
      if (t && o) origins.set(key, o);
    }
    const primaryOrigin = origins.get(primaryKey);
    if (!primaryOrigin) return;
    const elSelector = "nodeId" in target ? `[data-canvas-node="${target.nodeId}"]` : `[data-top-component="${target.componentId}"]`;
    const el = keys.size === 1 ? viewport.current?.querySelector<HTMLElement>(elSelector) : null;
    const size = el ? { w: el.offsetWidth, h: el.offsetHeight } : null;
    const siblings = size ? snapCandidates(primaryKey) : null;
    const start = { x: e.clientX, y: e.clientY };
    let delta: { dx: number; dy: number } | null = null;
    follow(
      "move",
      (ev) => {
        const zoom = latest.current.view.zoom;
        let dx = (ev.clientX - start.x) / zoom;
        let dy = (ev.clientY - start.y) / zoom;
        // A move once past 3px on the screen — a click stays a click.
        if (!delta && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) < 3) return;
        const nextGuides: Guide[] = [];
        if (siblings && size) {
          const threshold = 6 / zoom;
          const rx = primaryOrigin.x + dx;
          const ry = primaryOrigin.y + dy;
          let bestX: { diff: number; at: number } | null = null;
          for (const edge of [rx, rx + size.w / 2, rx + size.w])
            for (const at of siblings.xs) {
              const diff = at - edge;
              if (Math.abs(diff) <= threshold && (!bestX || Math.abs(diff) < Math.abs(bestX.diff))) bestX = { diff, at };
            }
          if (bestX) {
            dx += bestX.diff;
            nextGuides.push({ axis: "x", at: bestX.at });
          }
          let bestY: { diff: number; at: number } | null = null;
          for (const edge of [ry, ry + size.h / 2, ry + size.h])
            for (const at of siblings.ys) {
              const diff = at - edge;
              if (Math.abs(diff) <= threshold && (!bestY || Math.abs(diff) < Math.abs(bestY.diff))) bestY = { diff, at };
            }
          if (bestY) {
            dy += bestY.diff;
            nextGuides.push({ axis: "y", at: bestY.at });
          }
        }
        setGuides(nextGuides);
        delta = { dx: Math.round(dx), dy: Math.round(dy) };
        setMoved({ keys, ...delta });
      },
      () => {
        setMoved(null);
        setGuides([]);
        if (!delta) return;
        for (const [key, origin] of origins) {
          const t = targetOfKey(key);
          if (t) onMove(t, { x: Math.round(origin.x + delta!.dx), y: Math.round(origin.y + delta!.dy) });
        }
      }
    );
  };
  /** A drag out on the bare canvas (Figma's marquee): what it lands on, once let go, is the selection. */
  const startMarquee = (e: React.PointerEvent) => {
    const start = toCanvas(e.clientX, e.clientY);
    let box: Rect = { x: start.x, y: start.y, w: 0, h: 0 };
    follow(
      "marquee",
      (ev) => {
        const at = toCanvas(ev.clientX, ev.clientY);
        box = { x: Math.min(start.x, at.x), y: Math.min(start.y, at.y), w: Math.abs(at.x - start.x), h: Math.abs(at.y - start.y) };
        setMarquee(box);
      },
      () => {
        setMarquee(null);
        if (box.w < 2 && box.h < 2) return onSelect(null);
        const hits = topRects()
          .filter((t) => intersects(box, t.rect))
          .map((t) => t.key);
        if (hits.length <= 1) {
          setMulti(new Set());
          onSelect(hits[0] ? selectionOfKey(hits[0]) : null);
        } else {
          setMulti(new Set(hits));
          onSelect(null);
        }
      }
    );
  };
  const startResize = (e: React.PointerEvent, handle: Handle) => {
    e.preventDefault();
    e.stopPropagation();
    const current = latest.current.selection;
    const sel = current && latest.current.selector;
    const el = sel ? viewport.current?.querySelector<HTMLElement>(sel) : null;
    if (!current || !el) return;
    const top = topOf(current, components);
    const origin = (top && placeOf(top)) ?? { x: 0, y: 0 };
    const from: Rect = { x: origin.x, y: origin.y, w: el.offsetWidth, h: el.offsetHeight };
    const start = { x: e.clientX, y: e.clientY };
    const changed = { x: handle.includes("e") || handle.includes("w"), y: handle.includes("n") || handle.includes("s") };
    follow(
      "resize",
      (ev) => {
        const zoom = latest.current.view.zoom;
        const dx = (ev.clientX - start.x) / zoom;
        const dy = (ev.clientY - start.y) / zoom;
        const rect = { ...from };
        if (handle.includes("e")) rect.w = from.w + dx;
        if (handle.includes("w")) {
          rect.w = from.w - dx;
          rect.x = from.x + dx;
        }
        if (handle.includes("s")) rect.h = from.h + dy;
        if (handle.includes("n")) {
          rect.h = from.h - dy;
          rect.y = from.y + dy;
        }
        const w = Math.max(1, Math.round(rect.w));
        const h = Math.max(1, Math.round(rect.h));
        onResize(current, { x: Math.round(handle.includes("w") ? from.x + from.w - w : rect.x), y: Math.round(handle.includes("n") ? from.y + from.h - h : rect.y), w, h }, changed);
      },
      () => {}
    );
  };
  const startDraw = (e: React.PointerEvent) => {
    e.preventDefault();
    const drawing = latest.current.tool;
    const start = toCanvas(e.clientX, e.clientY);
    const parent = drawParentAt(e.target as Element, components, nodes);
    let rect: Rect = { x: start.x, y: start.y, w: 0, h: 0 };
    follow(
      "draw",
      (ev) => {
        const at = toCanvas(ev.clientX, ev.clientY);
        rect = { x: Math.min(start.x, at.x), y: Math.min(start.y, at.y), w: Math.abs(at.x - start.x), h: Math.abs(at.y - start.y) };
        if (drawing !== "text") setDrawRect(rect);
      },
      () => {
        setDrawRect(null);
        const zoom = latest.current.view.zoom;
        const clicked = drawing === "text" || (rect.w * zoom < 3 && rect.h * zoom < 3);
        const round = (r: Rect): Rect => ({ x: Math.round(r.x), y: Math.round(r.y), w: Math.max(1, Math.round(r.w)), h: Math.max(1, Math.round(r.h)) });
        onDraw(drawing, round(clicked ? { x: start.x, y: start.y, w: 100, h: 100 } : rect), parent, clicked);
      }
    );
  };

  /** Prototype mode: a connection dragged out of the selected variant's handle, let go over another. */
  const startConnect = (e: React.PointerEvent, source: string, from: Rect) => {
    e.preventDefault();
    e.stopPropagation();
    const base = viewport.current!.getBoundingClientRect();
    follow(
      "draw",
      (ev) => setConnecting({ from, to: { x: ev.clientX - base.left, y: ev.clientY - base.top } }),
      (ev) => {
        setConnecting(null);
        const over = document.elementFromPoint(ev.clientX, ev.clientY)?.closest<HTMLElement>("[data-main-component]");
        onConnect?.(source, over?.dataset.mainComponent ?? null, { x: ev.clientX, y: ev.clientY });
      }
    );
  };

  const onPointerDown = (e: React.PointerEvent) => {
    const target = e.target as Element;
    // Typing in a text, or the canvas's own buttons: theirs.
    if (target.closest("[contenteditable='true'], [data-canvas-ui]")) return;
    const { tool: current, space: hand } = latest.current;
    if (e.button === 1 || (e.button === 0 && (hand || current === "hand"))) return startPan(e);
    if (e.button !== 0) return;
    if (DRAW_TOOLS.has(current)) return startDraw(e);
    const picked = pickAt(target, components, nodes, selection, e.metaKey || e.ctrlKey);
    const top = picked ? topOf(picked.selection, components) : null;
    // A press on one of a marquee's group: the whole group drags together, its selection untouched.
    if (top && multi.size > 1 && multi.has(keyOf(top))) return startMove(e, top, multi);
    if (multi.size) setMulti(new Set());
    if (!picked) return startMarquee(e);
    onSelect(picked.selection);
    if (top) startMove(e, top);
  };

  /** A top-level one's name over it (Figma's frame names): a press selects it — and a drag moves it. */
  const labelDown = (e: React.PointerEvent, next: CanvasSelection) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const top = topOf(next, components);
    if (top && multi.size > 1 && multi.has(keyOf(top))) return startMove(e, top, multi);
    if (multi.size) setMulti(new Set());
    onSelect(next);
    if (top) startMove(e, top);
  };

  const moveOf = (key: string) => (moved?.keys.has(key) ? moved : ORIGIN_MOVE);
  const tops = topComponents(components);

  // Figma's selection lines: a component's (and its instances') purple, a layer's and a drawing's blue.
  const componentTone = selection && !isNodeSelection(selection) && (!selection.layerId || components.some((c) => c.id === selection.componentId && findRepeat(c)?.layer.id === selection.layerId));
  const tone = componentTone ? "var(--edit-component)" : "var(--edit-accent)";
  const resizable: Handle[] = (() => {
    if (!selection) return [];
    if (isNodeSelection(selection)) return ALL_HANDLES;
    // A component (a variant too) sizes on the canvas; a set hugs its variants.
    if (!selection.layerId) return selection.set ? [] : ALL_HANDLES;
    const component = components.find((c) => c.id === selection.componentId);
    const layer = component ? findLayer(component, selection.layerId) : null;
    return layer && (layer.kind === "frame" || layer.kind === "shape" || layer.kind === "static-text") ? ALL_HANDLES : [];
  })();
  const box = shown.boxes[0];
  const cursor = dragging === "pan" || (dragging === null && (space || tool === "hand")) ? (dragging === "pan" ? "grabbing" : "grab") : DRAW_TOOLS.has(tool) ? "crosshair" : undefined;

  const labels: { key: string; name: string; icon: ReactNode; purple: boolean; x: number; y: number; width: number; select: CanvasSelection }[] = [
    ...tops.map((c) => {
      const place = places.get(c.id) ?? { x: 0, y: 0 };
      const m = moveOf(`c:${c.id}`);
      const set = isComponentSet(c, components);
      return { key: `c:${c.id}`, name: c.name, icon: <FigmaIcon name="16.component" />, purple: true, x: place.x + m.dx, y: place.y + m.dy, width: canvasWidth(c) + (set ? SET_INSET * 2 : 0), select: set ? { componentId: c.id, set: true } : { componentId: c.id } };
    }),
    ...nodes
      .filter((n) => n.kind === "frame")
      .map((n) => {
        const m = moveOf(`n:${n.id}`);
        return { key: `n:${n.id}`, name: n.name, icon: null, purple: false, x: n.canvas.x + m.dx, y: n.canvas.y + m.dy, width: n.size?.widthPx ?? 100, select: { nodeId: n.id } };
      }),
  ];

  return (
    <main
      ref={viewport}
      data-components-canvas=""
      aria-label="Bileşenler sayfası"
      className="absolute inset-0 overflow-hidden bg-[var(--edit-canvas,var(--bg-5))] select-none touch-none"
      style={{ cursor }}
      onPointerDown={onPointerDown}
      onPointerOver={(e) => {
        if (dragging || DRAW_TOOLS.has(tool)) return;
        hovered.current = pickAt(e.target as Element, components, nodes, selection, e.metaKey || e.ctrlKey)?.el ?? null;
      }}
      onPointerLeave={() => {
        hovered.current = null;
      }}
      onContextMenu={(e) => {
        const target = e.target as Element;
        if (target.closest("[contenteditable='true']")) return;
        const inSelection = selector && Array.from(viewport.current?.querySelectorAll(selector) ?? []).some((el) => el.contains(target));
        onContextMenu(inSelection ? selection : pickAt(target, components, nodes, selection, false)?.selection ?? null, e);
      }}
      // Nothing on the canvas navigates or follows a link.
      onClickCapture={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
    >
      {/*
        Figma's pixel grid: past 800%, the canvas's own 1×1 units — its space, not just what is
        drawn on it. A screen-space background (not the world's, scaled): its cell is `zoom` screen
        px wide (one canvas unit, however far in), its line stays a crisp 1 screen px regardless.
      */}
      {view.zoom >= 8 && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(to right, color-mix(in srgb, var(--text-title) 12%, transparent) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in srgb, var(--text-title) 12%, transparent) 1px, transparent 1px)",
            backgroundSize: `${view.zoom}px ${view.zoom}px`,
            backgroundPosition: `${view.x}px ${view.y}px`,
          }}
        />
      )}
      {/* The canvas itself: everything at its place, the view's pan and zoom on it. */}
      {/* Moved on the screen by the view (translate), scaled by its zoom (transform, one factor on both axes — it cannot warp it) — never re-laid-out, so it never stalls or pops mid-gesture, as Figma's own canvas doesn't. */}
      <div className="absolute left-0 top-0" style={{ transform: `translate(${view.x}px, ${view.y}px)` }}>
      <div ref={world} className="absolute left-0 top-0 origin-top-left" style={{ transform: `scale(${view.zoom})` }}>
        {tops.map((component) => {
          const m = moveOf(`c:${component.id}`);
          return (
            <TopComponentView
              key={component.id}
              component={component}
              components={components}
              place={places.get(component.id) ?? ORIGIN}
              dx={m.dx}
              dy={m.dy}
              sampleBlock={sampleBlock}
              onStaticText={staticText}
              autoEdit={autoEdit}
            />
          );
        })}
        {nodes.map((node) => {
          const m = moveOf(`n:${node.id}`);
          return <TopNodeView key={node.id} node={node} dx={m.dx} dy={m.dy} onStaticText={staticText} autoEdit={autoEdit} />;
        })}
      </div>
      </div>

      {/* ── The lines over the canvas, at the screen's scale ── */}
      {labels.map((label) => (
        <div
          key={label.key}
          data-canvas-ui=""
          onPointerDown={(e) => labelDown(e, label.select)}
          style={{ left: view.x + label.x * view.zoom, top: view.y + label.y * view.zoom - 20, maxWidth: Math.max(24, label.width * view.zoom) }}
          className={cn(
            "absolute flex items-center gap-1 h-4 text-[11px] font-medium leading-4 whitespace-nowrap overflow-hidden cursor-default",
            label.purple ? "text-[var(--edit-component)]" : "text-[var(--text-subtitle)]"
          )}
        >
          {label.icon}
          <span className="truncate">{label.name}</span>
        </div>
      ))}
      {shown.hover && !dragging && (!box || JSON.stringify(shown.hover) !== JSON.stringify(box)) && (
        <div aria-hidden className="pointer-events-none absolute border border-[var(--edit-accent)] opacity-60" style={{ left: shown.hover.x, top: shown.hover.y, width: shown.hover.w, height: shown.hover.h }} />
      )}
      {shown.boxes.map((b, i) => (
        <div key={i} aria-hidden className="pointer-events-none absolute border" style={{ left: b.x, top: b.y, width: b.w, height: b.h, borderColor: tone }} />
      ))}
      {/* A marquee's own group: every one of its tops, its own outline. */}
      {shown.multi.map((b, i) => (
        <div key={`multi:${i}`} aria-hidden className="pointer-events-none absolute border-2 border-[var(--edit-accent)]" style={{ left: b.x, top: b.y, width: b.w, height: b.h }} />
      ))}
      {/* A drag out on the bare canvas: what is under it, once let go, is the selection. */}
      {marquee && (
        <div
          aria-hidden
          className="pointer-events-none absolute border border-[var(--edit-accent)] bg-[color-mix(in_srgb,var(--edit-accent)_12%,transparent)]"
          style={{ left: view.x + marquee.x * view.zoom, top: view.y + marquee.y * view.zoom, width: marquee.w * view.zoom, height: marquee.h * view.zoom }}
        />
      )}
      {/* Smart guides (Figma's pink lines): what a lone drag just snapped to. */}
      {guides.map((g, i) =>
        g.axis === "x" ? (
          <div key={`gx:${i}`} aria-hidden className="pointer-events-none absolute top-0 bottom-0 w-px" style={{ left: view.x + g.at * view.zoom, background: "var(--edit-snap)" }} />
        ) : (
          <div key={`gy:${i}`} aria-hidden className="pointer-events-none absolute left-0 right-0 h-px" style={{ top: view.y + g.at * view.zoom, background: "var(--edit-snap)" }} />
        )
      )}
      {box && dragging !== "move" && !prototype &&
        resizable.map((handle) => (
          <span
            key={handle}
            data-canvas-ui=""
            onPointerDown={(e) => e.button === 0 && startResize(e, handle)}
            className="absolute w-2 h-2 -ml-1 -mt-1 bg-white border rounded-[1px]"
            style={{
              left: box.x + (handle.includes("w") ? 0 : handle.includes("e") ? box.w : box.w / 2),
              top: box.y + (handle.includes("n") ? 0 : handle.includes("s") ? box.h : box.h / 2),
              borderColor: tone,
              cursor: HANDLE_CURSOR[handle],
            }}
          />
        ))}
      {box && selection && (
        <span
          aria-hidden
          className="pointer-events-none absolute -translate-x-1/2 px-1 rounded-[3px] text-[11px] font-medium leading-4 text-white tabular-nums whitespace-nowrap"
          style={{ left: box.x + box.w / 2, top: box.y + box.h + 6, background: tone }}
        >
          {Math.round(box.w / view.zoom)} × {Math.round(box.h / view.zoom)}
        </span>
      )}
      {/* Figma's "+" on a set: a variant more — on its bottom right corner. */}
      {shown.set && selectedSet && (
        <button
          type="button"
          data-canvas-ui=""
          aria-label="Varyant ekle"
          title="Varyant ekle"
          onClick={() => onAddVariant(selectedSet)}
          className="absolute flex items-center justify-center w-6 h-6 -ml-3 -mt-3 rounded-full bg-[var(--edit-component)] text-white shadow-sm cursor-pointer"
          style={{ left: shown.set.x + shown.set.w, top: shown.set.y + shown.set.h }}
        >
          {Icons.plus}
        </button>
      )}
      {/* Prototype mode: the connections (Figma's noodles), their triggers, and the handle to drag a new one out of the selected variant. */}
      {prototype && (
        <svg aria-hidden className="pointer-events-none absolute inset-0 w-full h-full overflow-visible">
          <defs>
            <marker id="prototype-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--edit-accent)" />
            </marker>
          </defs>
          {shown.links.map((link) => (
            <path key={link.key} d={noodle(link.from, link.to).d} fill="none" stroke="var(--edit-accent)" strokeWidth={1.5} markerEnd="url(#prototype-arrow)" />
          ))}
          {connecting && (
            <path d={noodle(connecting.from, { ...connecting.to, w: 0, h: 0 }).d} fill="none" stroke="var(--edit-accent)" strokeWidth={1.5} strokeDasharray="4 3" markerEnd="url(#prototype-arrow)" />
          )}
        </svg>
      )}
      {prototype &&
        shown.links.map((link) => {
          const { mid } = noodle(link.from, link.to);
          return (
            <button
              key={`label:${link.key}`}
              type="button"
              data-canvas-ui=""
              onClick={() => onSelect({ componentId: link.source })}
              className="absolute -translate-x-1/2 -translate-y-1/2 h-5 px-1.5 rounded-full bg-[var(--edit-accent)] text-[10px] font-medium leading-5 text-white whitespace-nowrap cursor-pointer"
              style={{ left: mid.x, top: mid.y }}
            >
              {link.label}
            </button>
          );
        })}
      {prototype && box && selection && !isNodeSelection(selection) && !selection.layerId && !selection.set && (
        <span
          data-canvas-ui=""
          title="Başka bir varyanta sürükle: etkileşim"
          onPointerDown={(e) => e.button === 0 && startConnect(e, selection.componentId, box)}
          className="absolute flex items-center justify-center w-4 h-4 -ml-2 -mt-2 rounded-full bg-[var(--bg-1)] border-2 border-[var(--edit-accent)] cursor-crosshair shadow-sm"
          style={{ left: box.x + box.w, top: box.y + box.h / 2 }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--edit-accent)]" />
        </span>
      )}
      {drawRect && (
        <div
          aria-hidden
          className="pointer-events-none absolute border border-[var(--edit-accent)]"
          style={{ left: view.x + drawRect.x * view.zoom, top: view.y + drawRect.y * view.zoom, width: drawRect.w * view.zoom, height: drawRect.h * view.zoom }}
        />
      )}

    </main>
  );
}

// ── The layer tree ────────────────────────────────────────────────────────────

/** A layer's icon in the tree: a frame's auto layout, a text, a shape, an instance (the ones it repeats, a part the code draws). */
export function layerIconOf(layer: ComponentLayer): ReactNode {
  if (layer.kind === "text" || layer.kind === "static-text") return fi("16.text");
  if (layer.kind === "shape") return fi(layer.shape === "ellipse" ? "16.ellipse" : "16.rectangle");
  if (layer.kind === "frame") {
    const flow = gridFlow(layer.layout);
    return fi(flow === "vertical" ? "16.autolayout.vertical" : flow === "horizontal" ? (layer.layout.wrap ? "16.autolayout.wrap" : "16.autolayout.horizontal") : "16.autolayout.grid");
  }
  return fi("16.instance");
}

/** A layer's name in the tree — a text of its own, its words until it is named. */
export const layerLabel = (layer: ComponentLayer) => (layer.kind === "static-text" ? layer.name || layer.text.replace(/\s+/g, " ").trim().slice(0, 40) || "Metin" : layer.name);

/** The key a set's row has in the open set and for requestRename — a component's own is its id. */
export const setRowKey = (setId: string) => `set:${setId}`;
/** …a layer's row. */
export const layerRowKey = (componentId: string, layerId: string) => `${componentId}:${layerId}`;
/** …a drawing's (and its layers'). */
export const nodeRowKey = (nodeId: string, layerId?: string) => (layerId && layerId !== nodeId ? `node:${nodeId}:${layerId}` : `node:${nodeId}`);

/** Which selection a row of the tree is (see its data attributes). */
function rowSelection(target: Element): CanvasSelection | null {
  const nodeRow = target.closest<HTMLElement>("[data-node-row]");
  if (nodeRow?.dataset.nodeRow) return { nodeId: nodeRow.dataset.nodeRow, layerId: nodeRow.dataset.nodeLayer || undefined };
  const row = target.closest<HTMLElement>("[data-main-row]");
  if (!row?.dataset.mainRow) return null;
  return { componentId: row.dataset.mainRow, layerId: row.dataset.mainLayer || undefined, set: row.dataset.mainSet === "" ? true : undefined };
}

/**
 * The Bileşenler page in the layer tree: what is drawn on it (newest first)
 * and each main component (Figma's purple mark) — a set with its variants
 * under it — each opening on its layers. They start closed, as in Figma; the
 * selection opens the rows holding it. Click selects (the canvas follows),
 * double-click renames (a variant: its values, "Durum=Vurgulu"), hover
 * outlines it on the canvas, a right click opens its menu.
 */
export function ComponentLayers({ components, nodes, selection, open, onToggle, onSelect, onRename, onAddVariant, onToggleHidden, onContextMenu }: {
  components: DesignComponent[];
  nodes: CanvasNode[];
  selection: CanvasSelection | null;
  /** Rows open in the tree: components' ids, sets' (setRowKey), drawings' (nodeRowKey) */
  open: ReadonlySet<string>;
  onToggle: (key: string) => void;
  onSelect: (next: CanvasSelection) => void;
  /** A name typed (undefined: back to the default) */
  onRename: (at: CanvasSelection, name: string | undefined) => void;
  /** A set's "+" */
  onAddVariant: (setId: string) => void;
  /** A drawing's eye */
  onToggleHidden: (at: NodeSelection) => void;
  onContextMenu: (at: CanvasSelection, e: React.MouseEvent) => void;
}) {
  const nodeSelected = selection && isNodeSelection(selection) ? selection : null;
  const mainSelected = selection && !isNodeSelection(selection) ? selection : null;

  /** A drawing's layers' rows, at `depth`. */
  const nodeRows = (node: CanvasNode, layers: ComponentLayer[], depth: number): ReactNode[] =>
    layers.flatMap((layer) => {
      const key = nodeRowKey(node.id, layer.id);
      const row = (
        <div key={layer.id} data-node-row={node.id} data-node-layer={layer.id}>
          <LayerRow
            depth={depth}
            tone={TREE_TONE}
            icon={layerIconOf(layer)}
            name={layerLabel(layer)}
            selected={nodeSelected?.nodeId === node.id && nodeSelected.layerId === layer.id}
            open={layer.kind === "frame" && layer.layers.length > 0 ? open.has(key) : undefined}
            onToggle={() => onToggle(key)}
            hover={`[data-canvas-node="${node.id}"] [data-layer-id="${layer.id}"]`}
            onSelect={() => onSelect({ nodeId: node.id, layerId: layer.id })}
            onInspect={() => onSelect({ nodeId: node.id, layerId: layer.id })}
            onRename={(name) => onRename({ nodeId: node.id, layerId: layer.id }, name)}
            renameKey={key}
          />
        </div>
      );
      return layer.kind === "frame" && open.has(key) ? [row, ...nodeRows(node, layer.layers, depth + 1)] : [row];
    });

  /** A main component's row and, open, its layers' — at `depth` (a variant's, one deeper than its set). */
  const componentRows = (component: DesignComponent, depth: number, label: string) => {
    const root = `[data-main-component="${component.id}"]`;
    const isOpen = open.has(component.id);
    const selected = mainSelected?.componentId === component.id && !mainSelected.set;
    const repeat = findRepeat(component);
    const rows = (layers: ComponentLayer[], at: number): ReactNode[] =>
      layers.flatMap((layer) => {
        const instance = layer.kind === "instance" || layer.kind === "part";
        const key = layerRowKey(component.id, layer.id);
        const row = (
          <div key={layer.id} data-main-row={component.id} data-main-layer={layer.id}>
            <LayerRow
              depth={at}
              tone={instance ? "var(--edit-component)" : TREE_TONE}
              nameTone={instance ? "var(--edit-component)" : undefined}
              icon={layerIconOf(layer)}
              name={layerLabel(layer)}
              selected={selected && mainSelected?.layerId === layer.id}
              open={layer.kind === "frame" && layer.layers.length > 0 ? open.has(key) : undefined}
              onToggle={() => onToggle(key)}
              hover={layer.id === repeat?.layer.id ? `${root} [data-component]` : `${root} [data-layer-id="${layer.id}"]`}
              onSelect={() => onSelect({ componentId: component.id, layerId: layer.id })}
              onInspect={() => onSelect({ componentId: component.id, layerId: layer.id })}
              onRename={(name) => onRename({ componentId: component.id, layerId: layer.id }, name)}
              renameKey={key}
            />
          </div>
        );
        return layer.kind === "frame" && open.has(key) ? [row, ...rows(layer.layers, at + 1)] : [row];
      });
    return (
      <div key={component.id} className={layerNode(selected, false)}>
        <div data-main-row={component.id}>
          <LayerRow
            depth={depth}
            tone="var(--edit-component)"
            nameTone="var(--edit-component)"
            icon={<FigmaIcon name="16.component" />}
            name={label}
            selected={selected && !mainSelected?.layerId}
            open={component.layers.length > 0 ? isOpen : undefined}
            onToggle={() => onToggle(component.id)}
            hover={`${root} [data-main-frame]`}
            onSelect={() => onSelect({ componentId: component.id })}
            onInspect={() => onSelect({ componentId: component.id })}
            onRename={(name) => onRename({ componentId: component.id }, name)}
            renameKey={component.id}
          />
        </div>
        {isOpen && rows(component.layers, depth + 1)}
      </div>
    );
  };

  return (
    <div
      className="flex flex-col gap-px"
      onContextMenu={(e) => {
        const at = rowSelection(e.target as Element);
        if (at) onContextMenu(at, e);
      }}
    >
      {[...nodes].reverse().map((node) => {
        const key = nodeRowKey(node.id);
        const selected = nodeSelected?.nodeId === node.id;
        const hidden = node.kind !== "static-text" && Boolean(node.hidden);
        return (
          <div key={node.id} className={layerNode(selected, false)}>
            <div data-node-row={node.id}>
              <LayerRow
                depth={0}
                tone={TREE_TONE}
                icon={layerIconOf(node)}
                name={layerLabel(node)}
                selected={selected && (!nodeSelected?.layerId || nodeSelected.layerId === node.id)}
                open={node.kind === "frame" && node.layers.length > 0 ? open.has(key) : undefined}
                onToggle={() => onToggle(key)}
                hover={`[data-canvas-node="${node.id}"]`}
                onSelect={() => onSelect({ nodeId: node.id })}
                onInspect={() => onSelect({ nodeId: node.id })}
                onRename={(name) => onRename({ nodeId: node.id }, name)}
                renameKey={key}
                hidden={hidden}
                onToggleHidden={node.kind !== "static-text" ? () => onToggleHidden({ nodeId: node.id }) : undefined}
              />
            </div>
            {node.kind === "frame" && open.has(key) && nodeRows(node, node.layers, 1)}
          </div>
        );
      })}
      {topComponents(components).map((component) => {
        if (!isComponentSet(component, components)) return componentRows(component, 0, component.name);
        const key = setRowKey(component.id);
        const isOpen = open.has(key);
        const selected = mainSelected?.componentId === component.id && Boolean(mainSelected.set);
        return (
          <div key={key} className={layerNode(selected, false)}>
            <div data-main-row={component.id} data-main-set="">
              <LayerRow
                depth={0}
                tone="var(--edit-component)"
                nameTone="var(--edit-component)"
                icon={<FigmaIcon name="16.component" />}
                name={component.name}
                selected={selected}
                open={isOpen}
                onToggle={() => onToggle(key)}
                hover={`[data-component-set="${component.id}"] > [data-set-frame]`}
                onSelect={() => onSelect({ componentId: component.id, set: true })}
                onInspect={() => onSelect({ componentId: component.id, set: true })}
                onRename={(name) => onRename({ componentId: component.id, set: true }, name)}
                renameKey={key}
              >
                <LayerButton label="Varyant ekle" onClick={() => onAddVariant(component.id)}>{Icons.plus}</LayerButton>
              </LayerRow>
            </div>
            {isOpen && variantsOf(component.id, components).map((variant) => componentRows(variant, 1, variantName(variant)))}
          </div>
        );
      })}
    </div>
  );
}
