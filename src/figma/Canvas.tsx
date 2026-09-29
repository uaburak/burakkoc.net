"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { FigmaIcon } from "@/components/admin/figmaIcons";
import { DesignSystemStyle } from "@/components/project/designSystem";
import { MIN_ZOOM, clampZoom, fitView, zoomAround, type CanvasTool, type CanvasView, type ZoomActions } from "@/components/admin/canvasModel";
import { findNode, getNode, isFrameLike, isLocked, topmost, type FigmaDocument, type SceneNode } from "./model";
import { MotionStyle, NodeView, RenderProvider, type RenderContext } from "./NodeView";

/**
 * Figma's canvas: endless, the file's nodes drawn on it at the view's pan and
 * zoom (a CSS transform — nothing is laid out again while it moves). Over
 * it, at the screen's scale, the lines: the selection's box and handles, the
 * hover outline, top-level frames' names, the size, the marquee, the smart
 * guides, the rulers.
 *
 * Picking, as Figma's: a click selects a top-level node — or, inside a
 * top-level frame, one of its direct children; inside the selection a click
 * goes one level deeper; ⌘ picks the innermost layer at once. Dragging a
 * selection moves it (into another frame, if it is let go there; along an
 * auto layout, it reorders); the handles size it; the tools draw into the
 * frame under the pointer; a drag on the empty canvas (or in a frame's empty
 * area) is a marquee.
 */

export type Rect = { x: number; y: number; w: number; h: number };
type Handle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";
const ALL_HANDLES: Handle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];
const HANDLE_CURSOR: Record<Handle, string> = { n: "ns-resize", s: "ns-resize", e: "ew-resize", w: "ew-resize", ne: "nesw-resize", sw: "nesw-resize", nw: "nwse-resize", se: "nwse-resize" };
const DRAW_TOOLS = new Set<CanvasTool>(["frame", "rectangle", "ellipse", "line", "text"]);
const RULER = 20;

export interface CanvasProps {
  doc: FigmaDocument;
  render: RenderContext;
  selection: readonly string[];
  onSelect: (ids: string[]) => void;
  view: CanvasView;
  onView: (update: (view: CanvasView) => CanvasView) => void;
  tool: CanvasTool;
  /** Nodes moved: each to its new place in its parent (canvas px) */
  onMove: (moves: { id: string; x: number; y: number }[], copy?: boolean) => void;
  /** A node let go in another frame (null: on the canvas), at its place there — `index` inside an auto layout; `copy`: dragged with ⌥, the original stays */
  onReparent: (id: string, parentId: string | null, x: number, y: number, index?: number, copy?: boolean) => void;
  /** A node of an auto layout let go at another place in it */
  onReorder: (id: string, index: number) => void;
  /** A node sized: its rect in its parent now, and which axes changed */
  onResize: (id: string, rect: Rect, changed: { x: boolean; y: boolean }) => void;
  /** (The tool is set by the editor's keys and toolbar.) */
  onTool?: (tool: CanvasTool) => void;
  /** Drawn with a tool into `parentId` (null: the canvas), at `rect` in it; `clicked`: no drag (a default size); `index`: its place in an auto layout's flow */
  onDraw: (tool: CanvasTool, parentId: string | null, rect: Rect, clicked: boolean, index?: number) => void;
  /** A double click: a text starts typing, a frame opens (the layer under the pointer) */
  onDoubleClick: (id: string) => void;
  onContextMenu: (id: string | null, e: React.MouseEvent) => void;
  zoomActionsRef?: React.RefObject<ZoomActions | null>;
  rulers?: boolean;
  /** The canvas's own colour (Figma's page background) */
  background?: string;
}

/** The ids from the top-level node down to the innermost element under `target` (locked ones and what is under them left out). */
function pathAt(target: Element, root: Element, doc: FigmaDocument): { id: string; el: HTMLElement }[] {
  const path: { id: string; el: HTMLElement }[] = [];
  let el = target.closest<HTMLElement>("[data-node-id]");
  while (el && root.contains(el)) {
    path.unshift({ id: el.dataset.nodeId!, el });
    el = el.parentElement?.closest<HTMLElement>("[data-node-id]") ?? null;
  }
  // A locked node can't be picked, nor what is inside it.
  const locked = path.findIndex((p) => !p.id.includes("/") && getNode(doc.nodes, p.id)?.locked);
  return locked >= 0 ? path.slice(0, locked) : path;
}

/**
 * What a press picks, as Figma's: the top-level node; inside a top-level frame, its
 * direct child; inside a selected node, the next level down; `deep`, the innermost.
 */
function pickFrom(path: { id: string; el: HTMLElement }[], selection: readonly string[], deep: boolean): { id: string; el: HTMLElement } | null {
  if (!path.length) return null;
  if (deep) return path[path.length - 1];
  // Already selected (or an ancestor of the selection is the innermost): the same.
  const exact = path.findIndex((p) => selection.includes(p.id));
  if (exact >= 0) {
    // The innermost selected along the path: a click on it keeps it; a click inside it goes one level down.
    let deepest = exact;
    for (let i = path.length - 1; i >= 0; i--) if (selection.includes(path[i].id)) { deepest = i; break; }
    if (deepest === path.length - 1) return path[deepest];
    return path[deepest + 1];
  }
  return path[Math.min(1, path.length - 1)];
}

/** Figma's measurement red. */
const MEASURE = "#f24822";

/** Figma's ⌥ measurement: both boxes outlined in red, the gaps between them drawn as red lines with their distance (canvas px). */
function Measure({ a, b, zoom }: { a: Rect; b: Rect; zoom: number }) {
  const lines: { x: number; y: number; w: number; h: number; label: number }[] = [];
  // Along x: the gap between their nearer vertical edges, at the height where they overlap (or a's middle).
  const gapX = b.x >= a.x + a.w ? { from: a.x + a.w, to: b.x } : a.x >= b.x + b.w ? { from: b.x + b.w, to: a.x } : null;
  const gapY = b.y >= a.y + a.h ? { from: a.y + a.h, to: b.y } : a.y >= b.y + b.h ? { from: b.y + b.h, to: a.y } : null;
  const midY = Math.max(a.y, b.y) < Math.min(a.y + a.h, b.y + b.h) ? (Math.max(a.y, b.y) + Math.min(a.y + a.h, b.y + b.h)) / 2 : b.y + b.h / 2;
  const midX = Math.max(a.x, b.x) < Math.min(a.x + a.w, b.x + b.w) ? (Math.max(a.x, b.x) + Math.min(a.x + a.w, b.x + b.w)) / 2 : b.x + b.w / 2;
  if (gapX && gapX.to - gapX.from > 0.5) lines.push({ x: gapX.from, y: midY, w: gapX.to - gapX.from, h: 0, label: Math.round((gapX.to - gapX.from) / zoom) });
  if (gapY && gapY.to - gapY.from > 0.5) lines.push({ x: midX, y: gapY.from, w: 0, h: gapY.to - gapY.from, label: Math.round((gapY.to - gapY.from) / zoom) });
  return (
    <>
      <div aria-hidden className="pointer-events-none absolute border" style={{ left: b.x, top: b.y, width: b.w, height: b.h, borderColor: MEASURE }} />
      {lines.map((l, i) => (
        <div key={i} aria-hidden className="pointer-events-none absolute" style={{ left: l.x, top: l.y, width: l.w || 1, height: l.h || 1, background: MEASURE, transform: l.w ? "translateY(-0.5px)" : "translateX(-0.5px)" }}>
          <span className="absolute px-1 rounded-[3px] text-[11px] font-medium leading-4 text-white tabular-nums whitespace-nowrap" style={{ background: MEASURE, left: l.w ? l.w / 2 : 4, top: l.h ? l.h / 2 : 4, transform: l.w ? "translate(-50%, 0)" : "translate(0, -50%)" }}>
            {l.label}
          </span>
        </div>
      ))}
    </>
  );
}

/** The world's probe: a 1000px span whose drawn width is the zoom. */
const PROBE = 1000;

const rectOf = (el: Element, base: DOMRect): Rect => {
  const r = el.getBoundingClientRect();
  return { x: r.left - base.left, y: r.top - base.top, w: r.width, h: r.height };
};

/** One ruler drawn: its ticks at the view's zoom, the selection's span in blue (as Figma's). */
function drawRuler(canvas: HTMLCanvasElement | null, view: CanvasView, length: number, vertical: boolean, selected: Rect | null) {
  if (!canvas) return;
  const dpr = window.devicePixelRatio || 1;
  const steps = [1, 2, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000];
  const step = steps.find((st) => st * view.zoom >= 60) ?? 5000;
  canvas.width = (vertical ? RULER : length) * dpr;
  canvas.height = (vertical ? length : RULER) * dpr;
  const g = canvas.getContext("2d");
  if (!g) return;
  g.scale(dpr, dpr);
  g.clearRect(0, 0, length, length);
  g.font = "9px Inter, ui-sans-serif, system-ui";
  const origin = vertical ? view.y : view.x;
  const span = selected ? { from: (vertical ? selected.y : selected.x) - RULER, size: vertical ? selected.h : selected.w } : null;
  if (span) {
    g.fillStyle = "rgba(13, 153, 255, 0.12)";
    if (vertical) g.fillRect(0, span.from, RULER, span.size);
    else g.fillRect(span.from, 0, span.size, RULER);
  }
  g.fillStyle = "#b3b3b3";
  g.strokeStyle = "#e6e6e6";
  const first = Math.floor(-origin / view.zoom / step) * step;
  for (let v = first; v * view.zoom + origin < length; v += step) {
    const at = Math.round(v * view.zoom + origin) + 0.5;
    g.beginPath();
    if (vertical) { g.moveTo(RULER - 6, at); g.lineTo(RULER, at); } else { g.moveTo(at, RULER - 6); g.lineTo(at, RULER); }
    g.stroke();
    if (vertical) {
      g.save();
      g.translate(4, at - 3);
      g.rotate(-Math.PI / 2);
      g.fillText(String(v), 0, 8);
      g.restore();
    } else g.fillText(String(v), at + 3, 9);
  }
  if (span) {
    const a = Math.round((span.from - origin) / view.zoom);
    const b = Math.round((span.from + span.size - origin) / view.zoom);
    g.fillStyle = "#0d99ff";
    g.font = "600 9px Inter, ui-sans-serif, system-ui";
    if (vertical) {
      for (const [val, at] of [[a, span.from], [b, span.from + span.size]] as const) {
        g.save();
        g.translate(4, at - 3);
        g.rotate(-Math.PI / 2);
        g.fillText(String(val), 0, 8);
        g.restore();
      }
    } else {
      g.fillText(String(a), span.from - g.measureText(String(a)).width - 3, 9);
      g.fillText(String(b), span.from + span.size + 3, 9);
    }
  }
}

/** Figma's rulers: a strip along the top and the left. */
function Rulers({ view, width, height, selected }: { view: CanvasView; width: number; height: number; selected: Rect | null }) {
  const top = useRef<HTMLCanvasElement>(null);
  const left = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    drawRuler(top.current, view, width, false, selected);
    drawRuler(left.current, view, height, true, selected);
  }, [view, width, height, selected]);
  return (
    <>
      <canvas ref={top} aria-hidden className="pointer-events-none absolute top-0 z-20" style={{ left: RULER, width: width, height: RULER }} />
      <canvas ref={left} aria-hidden className="pointer-events-none absolute left-0 z-20" style={{ top: RULER, width: RULER, height: height }} />
      <div aria-hidden className="pointer-events-none absolute left-0 top-0 z-20" style={{ width: RULER, height: RULER }} />
    </>
  );
}

/** The world: the nodes at their places — memoized, so a pan or a zoom redraws nothing in it. */
const World = memo(function World({ doc, render }: { doc: FigmaDocument; render: RenderContext }) {
  return (
    <RenderProvider value={render}>
      {doc.nodes.map((node) => (
        <NodeView key={node.id} node={node} parentLayout="none" />
      ))}
    </RenderProvider>
  );
});

export function Canvas({ doc, render, selection, onSelect, view, onView, tool, onMove, onReparent, onReorder, onResize, onDraw, onDoubleClick, onContextMenu, zoomActionsRef, rulers = true, background }: CanvasProps) {
  const viewport = useRef<HTMLDivElement>(null);
  const world = useRef<HTMLDivElement>(null);
  const [space, setSpace] = useState(false);
  const [dragging, setDragging] = useState<"pan" | "move" | "resize" | "draw" | "marquee" | null>(null);
  const [marquee, setMarquee] = useState<Rect | null>(null);
  const [drawRect, setDrawRect] = useState<Rect | null>(null);
  const [guides, setGuides] = useState<{ axis: "x" | "y"; at: number }[]>([]);
  // Where a dragged node would land: the frame's box (none for the canvas) and the line along an auto layout.
  const [drop, setDrop] = useState<{ rect: Rect | null; line?: Rect } | null>(null);
  const [size, setSize] = useState({ width: 800, height: 600 });
  const [shown, setShown] = useState<{ boxes: Rect[]; hover: Rect | null; parent: Rect | null; labels: { id: string; name: string; rect: Rect; kind: string }[]; measure: { a: Rect; b: Rect } | null; origins: Rect[] }>({ boxes: [], hover: null, parent: null, labels: [], measure: null, origins: [] });

  const probe = useRef<HTMLSpanElement>(null);
  // ⌥ held: a copy drag's ghosts follow the pointer (the originals stay), and distances to what is hovered are measured in red, as Figma's.
  const [alt, setAlt] = useState(false);
  const altRef = useRef(false);
  useEffect(() => { altRef.current = alt; }, [alt]);
  const ghosts = useRef<Map<string, HTMLElement>>(new Map());
  const [copying, setCopying] = useState(false);
  useEffect(() => {
    const down = (e: KeyboardEvent) => { if (e.key === "Alt") setAlt(true); };
    const up = (e: KeyboardEvent) => { if (e.key === "Alt") setAlt(false); };
    const clear = () => setAlt(false);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", clear);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); window.removeEventListener("blur", clear); };
  }, []);
  const hovered = useRef<HTMLElement | null>(null);
  const latest = useRef({ view, selection, tool, space, doc, dragging });
  useEffect(() => {
    latest.current = { view, selection, tool, space, doc, dragging };
  });

  // The viewport's size (the rulers, fitting).
  useEffect(() => {
    const el = viewport.current;
    if (!el) return;
    const measure = () => setSize({ width: el.clientWidth, height: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const toCanvas = useCallback((clientX: number, clientY: number) => {
    const r = viewport.current!.getBoundingClientRect();
    const { view: v } = latest.current;
    return { x: (clientX - r.left - v.x) / v.zoom, y: (clientY - r.top - v.y) / v.zoom };
  }, []);
  /** An element's rect in canvas px. */
  const canvasRect = useCallback((el: Element): Rect => {
    const base = viewport.current!.getBoundingClientRect();
    const { view: v } = latest.current;
    const r = el.getBoundingClientRect();
    return { x: (r.left - base.left - v.x) / v.zoom, y: (r.top - base.top - v.y) / v.zoom, w: r.width / v.zoom, h: r.height / v.zoom };
  }, []);
  const elOf = useCallback((id: string) => world.current?.querySelector<HTMLElement>(`[data-node-id="${CSS.escape(id)}"]`) ?? null, []);
  /**
   * An element's rect in the world's own units (canvas px), read against the
   * world as it is drawn right now — its probe's width says the zoom — so the
   * lines over the canvas can be drawn from the same view as the world itself.
   */
  const worldRect = useCallback((el: Element): Rect => {
    const w = world.current!;
    const wr = w.getBoundingClientRect();
    const pw = probe.current?.getBoundingClientRect().width ?? 0;
    const z = pw > 0 ? pw / PROBE : latest.current.view.zoom;
    const r = el.getBoundingClientRect();
    return { x: (r.left - wr.left) / z, y: (r.top - wr.top) / z, w: r.width / z, h: r.height / z };
  }, []);

  // The lines over the canvas follow what they outline, every frame — measured in canvas units, so a pan or a zoom never leaves them behind.
  useEffect(() => {
    let raf = 0;
    let last = "";
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const vp = viewport.current;
      const w = world.current;
      if (!vp || !w) return;
      const { selection: sel, doc: d } = latest.current;
      const elFor = (id: string) => ghosts.current.get(id) ?? elOf(id);
      const boxes = sel.map((id) => elFor(id)).filter((el): el is HTMLElement => Boolean(el)).map((el) => worldRect(el));
      const over = hovered.current?.isConnected ? hovered.current : w.querySelector("[data-layer-hover]");
      const hover = over && !sel.includes((over as HTMLElement).dataset.nodeId ?? "") ? worldRect(over) : null;
      // Figma's red measurement: a copy drag measures the ghost against its original; ⌥ over another layer measures the selection against it.
      let measure: { a: Rect; b: Rect } | null = null;
      const ghost = sel.length === 1 ? ghosts.current.get(sel[0]) : undefined;
      const original = sel.length === 1 ? elOf(sel[0]) : null;
      if (ghost && original) measure = { a: worldRect(original), b: worldRect(ghost) };
      else if (altRef.current && hover && boxes.length === 1) measure = { a: boxes[0], b: hover };
      // A copy drag: the originals stay outlined in red too.
      const origins = [...ghosts.current.keys()].map((id) => elOf(id)).filter((el): el is HTMLElement => Boolean(el)).map((el) => worldRect(el));
      // The frame holding a single selected layer: outlined faintly.
      let parent: Rect | null = null;
      if (sel.length === 1) {
        const found = sel[0].includes("/") ? null : findNode(d.nodes, sel[0]);
        const pel = found?.parent ? elOf(found.parent.id) : null;
        if (pel) parent = worldRect(pel);
      }
      const labels = d.nodes.flatMap((n) => {
        const el = elOf(n.id);
        if (!el || !isFrameLike(n)) return [];
        return [{ id: n.id, name: n.name, rect: worldRect(el), kind: n.type }];
      });
      // Components anywhere carry their name too, as Figma's purple labels — only top-level ones (nested read from the tree).
      const next = { boxes, hover, parent, labels, measure, origins };
      const key = JSON.stringify(next);
      if (key === last) return;
      last = key;
      setShown(next);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [elOf, worldRect]);

  // The wheel moves the view; with ⌘ / Ctrl (a pinch) it zooms around the pointer.
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

  // ── Zoom actions, for the chrome and the keys ──
  const boundsOf = useCallback((els: Element[]): Rect | null => {
    if (!els.length) return null;
    const rects = els.map((el) => canvasRect(el));
    const x = Math.min(...rects.map((r) => r.x));
    const y = Math.min(...rects.map((r) => r.y));
    const right = Math.max(...rects.map((r) => r.x + r.w));
    const bottom = Math.max(...rects.map((r) => r.y + r.h));
    return { x, y, w: right - x, h: bottom - y };
  }, [canvasRect]);
  const zoomActions = useMemo<ZoomActions>(() => ({
    zoomTo: (zoom) => onView((v) => zoomAround(v, clampZoom(zoom), { x: size.width / 2, y: size.height / 2 })),
    fitAll: () => {
      const bounds = boundsOf(Array.from(world.current?.children ?? []));
      if (bounds) onView(() => fitView(bounds, size.width, size.height));
    },
    fitSelection: () => {
      const els = latest.current.selection.map((id) => elOf(id)).filter((el): el is HTMLElement => Boolean(el));
      const bounds = boundsOf(els);
      if (bounds) onView(() => fitView(bounds, size.width, size.height, false));
      else zoomActions.fitAll();
    },
  }), [onView, size, boundsOf, elOf]);
  useEffect(() => {
    if (zoomActionsRef) zoomActionsRef.current = zoomActions;
    return () => { if (zoomActionsRef) zoomActionsRef.current = null; };
  }, [zoomActions, zoomActionsRef]);

  // Space held: the hand.
  useEffect(() => {
    const typing = () => {
      const el = document.activeElement as HTMLElement | null;
      return Boolean(el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)));
    };
    const down = (e: KeyboardEvent) => { if (e.key === " " && !typing() && !e.metaKey && !e.ctrlKey) { e.preventDefault(); setSpace(true); } };
    const up = (e: KeyboardEvent) => { if (e.key === " ") setSpace(false); };
    const blur = () => setSpace(false);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); window.removeEventListener("blur", blur); };
  }, []);

  /** Follows the pointer until it lets go, then `end`. */
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
    follow("pan", (ev) => onView(() => ({ ...start.view, x: start.view.x + ev.clientX - start.x, y: start.view.y + ev.clientY - start.y })), () => {});
  };

  /** The other top-level nodes' edges and centers (canvas px), to snap a lone move to. */
  const snapTargets = (excluded: Set<string>) => {
    const xs: number[] = [];
    const ys: number[] = [];
    for (const n of latest.current.doc.nodes) {
      if (excluded.has(n.id)) continue;
      const el = elOf(n.id);
      if (!el) continue;
      const r = canvasRect(el);
      xs.push(r.x, r.x + r.w / 2, r.x + r.w);
      ys.push(r.y, r.y + r.h / 2, r.y + r.h);
    }
    return { xs, ys };
  };

  /** The frame under the pointer that could take a dropped node — none of `excluded` or what is inside them. */
  const frameUnder = (clientX: number, clientY: number, excluded: Set<string>): { id: string | null; el: HTMLElement | null } => {
    const w = world.current!;
    const els = document.elementsFromPoint(clientX, clientY);
    for (const el of els) {
      const node = (el as HTMLElement).closest?.<HTMLElement>("[data-node-id]");
      if (!node || !w.contains(node)) continue;
      // Every frame from it up: the innermost one that isn't excluded.
      let cur: HTMLElement | null = node;
      while (cur && w.contains(cur)) {
        const id = cur.dataset.nodeId!;
        const model = id.includes("/") ? null : getNode(latest.current.doc.nodes, id);
        const inside = pathAt(cur, w, latest.current.doc).some((p) => excluded.has(p.id));
        if (model && (model.type === "frame" || model.type === "component") && !inside && !isLocked(latest.current.doc.nodes, id)) return { id, el: cur };
        cur = cur.parentElement?.closest<HTMLElement>("[data-node-id]") ?? null;
      }
      return { id: null, el: null };
    }
    return { id: null, el: null };
  };

  /** Where, among an auto layout frame's children, a point lands. */
  const indexIn = (frameEl: HTMLElement, frameId: string, clientX: number, clientY: number, excluded: Set<string>): number => {
    const frame = getNode(latest.current.doc.nodes, frameId);
    if (!frame || !isFrameLike(frame) || frame.layoutMode === "none") return -1;
    const horizontal = frame.layoutMode === "horizontal";
    const kids = frame.children.filter((c) => !excluded.has(c.id));
    let index = kids.length;
    for (let i = 0; i < kids.length; i++) {
      const el = frameEl.querySelector<HTMLElement>(`:scope > [data-node-id="${CSS.escape(kids[i].id)}"]`);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      const mid = horizontal ? r.left + r.width / 2 : r.top + r.height / 2;
      if ((horizontal ? clientX : clientY) < mid) { index = i; break; }
    }
    return index;
  };

  const startMove = (e: React.PointerEvent, primaryId: string) => {
    const { doc: d, selection: sel } = latest.current;
    const ids = sel.includes(primaryId) ? sel : [primaryId];
    const tops = topmost(d.nodes, ids.filter((id) => !id.includes("/")));
    if (!tops.length) return;
    const excluded = new Set(tops.map((t) => t.node.id));
    const els = tops.map((t) => ({ found: t, el: elOf(t.node.id)! })).filter((t) => t.el);
    const start = { x: e.clientX, y: e.clientY };
    // ⌥, at any moment of the drag: a ghost of each layer follows the pointer and the layer itself stays (Figma's copy drag); let go of ⌥ and the layer moves again.
    let copy = false;
    let ghostEls: HTMLElement[] = [];
    const originals = els.map(({ el }) => el);
    let delta: { dx: number; dy: number } | null = null;
    const place = (list: HTMLElement[]) => {
      for (const el of list) {
        el.style.translate = delta ? `${delta.dx}px ${delta.dy}px` : "";
        el.style.pointerEvents = delta ? "none" : "";
        el.style.zIndex = delta ? "1000" : "";
      }
    };
    const rest = (list: HTMLElement[]) => { for (const el of list) { el.style.translate = ""; el.style.pointerEvents = ""; el.style.zIndex = ""; } };
    const setCopy = (on: boolean) => {
      if (on === copy) return;
      copy = on;
      setCopying(on);
      if (on) {
        rest(originals);
        ghostEls = els.map(({ found, el }) => {
          const ghost = el.cloneNode(true) as HTMLElement;
          ghost.dataset.dragClone = found.node.id;
          ghost.style.position = "absolute";
          ghost.style.left = `${el.offsetLeft}px`;
          ghost.style.top = `${el.offsetTop}px`;
          ghost.style.width = `${el.offsetWidth}px`;
          ghost.style.height = `${el.offsetHeight}px`;
          ghost.style.margin = "0";
          ghost.style.flex = "none";
          el.after(ghost);
          ghosts.current.set(found.node.id, ghost);
          return ghost;
        });
        place(ghostEls);
      } else {
        ghostEls.forEach((g) => g.remove());
        ghostEls = [];
        ghosts.current.clear();
        place(originals);
      }
    };
    const onAlt = (ev: KeyboardEvent) => { if (ev.key === "Alt") setCopy(ev.type === "keydown"); };
    window.addEventListener("keydown", onAlt);
    window.addEventListener("keyup", onAlt);
    if (e.altKey) setCopy(true);
    const single = els.length === 1 ? els[0] : null;
    const snap = single ? snapTargets(excluded) : null;
    const singleRect = single ? canvasRect(single.el) : null;
    let target: { id: string | null; el: HTMLElement | null } | null = null;
    follow(
      "move",
      (ev) => {
        const zoom = latest.current.view.zoom;
        if (!delta && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) < 3) return;
        let dx = (ev.clientX - start.x) / zoom;
        let dy = (ev.clientY - start.y) / zoom;
        const nextGuides: { axis: "x" | "y"; at: number }[] = [];
        if (snap && singleRect && !ev.altKey) {
          const threshold = 6 / zoom;
          const rx = singleRect.x + dx;
          const ry = singleRect.y + dy;
          let bestX: { diff: number; at: number } | null = null;
          for (const edge of [rx, rx + singleRect.w / 2, rx + singleRect.w])
            for (const at of snap.xs) {
              const diff = at - edge;
              if (Math.abs(diff) <= threshold && (!bestX || Math.abs(diff) < Math.abs(bestX.diff))) bestX = { diff, at };
            }
          if (bestX) { dx += bestX.diff; nextGuides.push({ axis: "x", at: bestX.at }); }
          let bestY: { diff: number; at: number } | null = null;
          for (const edge of [ry, ry + singleRect.h / 2, ry + singleRect.h])
            for (const at of snap.ys) {
              const diff = at - edge;
              if (Math.abs(diff) <= threshold && (!bestY || Math.abs(diff) < Math.abs(bestY.diff))) bestY = { diff, at };
            }
          if (bestY) { dy += bestY.diff; nextGuides.push({ axis: "y", at: bestY.at }); }
        }
        if (ev.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }
        delta = { dx: Math.round(dx), dy: Math.round(dy) };
        setGuides(nextGuides);
        setCopy(ev.altKey);
        place(copy ? ghostEls : originals);
        // Where it would land: the frame under the pointer, and its place along an auto layout.
        if (single) {
          target = frameUnder(ev.clientX, ev.clientY, excluded);
          const parentId = single.found.parent?.id ?? null;
          if (target.id && target.el) {
            const index = indexIn(target.el, target.id, ev.clientX, ev.clientY, excluded);
            const frame = getNode(latest.current.doc.nodes, target.id);
            const base = viewport.current!.getBoundingClientRect();
            let line: Rect | undefined;
            if (frame && isFrameLike(frame) && frame.layoutMode !== "none") {
              const kids = frame.children.filter((c) => !excluded.has(c.id));
              const horizontal = frame.layoutMode === "horizontal";
              const at = kids[index] ? target.el.querySelector<HTMLElement>(`:scope > [data-node-id="${CSS.escape(kids[index].id)}"]`) : null;
              const before = kids[index - 1] ? target.el.querySelector<HTMLElement>(`:scope > [data-node-id="${CSS.escape(kids[index - 1].id)}"]`) : null;
              const ref = at ?? before;
              if (ref) {
                const r = rectOf(ref, base);
                line = horizontal ? { x: at ? r.x - 2 : r.x + r.w, y: r.y, w: 2, h: r.h } : { x: r.x, y: at ? r.y - 2 : r.y + r.h, w: r.w, h: 2 };
              }
            }
            setDrop(target.id !== parentId || line ? { rect: rectOf(target.el, base), line } : null);
          } else setDrop(parentId ? { rect: null } : null);
        }
      },
      (ev) => {
        setGuides([]);
        setDrop(null);
        window.removeEventListener("keydown", onAlt);
        window.removeEventListener("keyup", onAlt);
        ghostEls.forEach((g) => g.remove());
        ghostEls = [];
        ghosts.current.clear();
        setCopying(false);
        rest(originals);
        if (!delta) return;
        const d2 = latest.current.doc;
        if (single && target) {
          const found = findNode(d2.nodes, single.found.node.id);
          if (!found) return;
          const parentId = found.parent?.id ?? null;
          const targetFrame = target.id ? getNode(d2.nodes, target.id) : null;
          const targetAuto = targetFrame && isFrameLike(targetFrame) && targetFrame.layoutMode !== "none";
          const rect = canvasRect(single.el);
          const moved = { x: rect.x + delta.dx, y: rect.y + delta.dy };
          if (target.id === parentId) {
            if (targetAuto && target.el) {
              const index = indexIn(target.el, target.id!, ev.clientX, ev.clientY, excluded);
              return copy ? onReparent(found.node.id, target.id, 0, 0, index, true) : onReorder(found.node.id, index);
            }
            const origin = found.parent ? canvasRect(elOf(found.parent.id)!) : { x: 0, y: 0 };
            return onMove([{ id: found.node.id, x: Math.round(moved.x - origin.x), y: Math.round(moved.y - origin.y) }], copy);
          }
          const origin = target.el ? canvasRect(target.el) : { x: 0, y: 0 };
          const index = targetAuto && target.el ? indexIn(target.el, target.id!, ev.clientX, ev.clientY, excluded) : undefined;
          return onReparent(found.node.id, target.id, Math.round(moved.x - origin.x), Math.round(moved.y - origin.y), index, copy);
        }
        onMove(
          els.map(({ found, el }) => {
            const rect = canvasRect(el);
            const origin = found.parent ? canvasRect(elOf(found.parent.id)!) : { x: 0, y: 0 };
            return { id: found.node.id, x: Math.round(rect.x + delta!.dx - origin.x), y: Math.round(rect.y + delta!.dy - origin.y) };
          }),
          copy
        );
      }
    );
  };

  const startResize = (e: React.PointerEvent, handle: Handle) => {
    e.preventDefault();
    e.stopPropagation();
    const id = latest.current.selection[0];
    const el = id ? elOf(id) : null;
    const found = id ? findNode(latest.current.doc.nodes, id) : null;
    if (!id || !el || !found) return;
    const from = canvasRect(el);
    const origin = found.parent ? canvasRect(elOf(found.parent.id)!) : { x: 0, y: 0 };
    const start = { x: e.clientX, y: e.clientY };
    const changed = { x: handle.includes("e") || handle.includes("w"), y: handle.includes("n") || handle.includes("s") };
    const ratio = from.h ? from.w / from.h : 1;
    follow(
      "resize",
      (ev) => {
        const zoom = latest.current.view.zoom;
        const dx = (ev.clientX - start.x) / zoom;
        const dy = (ev.clientY - start.y) / zoom;
        const rect = { ...from };
        if (handle.includes("e")) rect.w = from.w + dx;
        if (handle.includes("w")) { rect.w = from.w - dx; rect.x = from.x + dx; }
        if (handle.includes("s")) rect.h = from.h + dy;
        if (handle.includes("n")) { rect.h = from.h - dy; rect.y = from.y + dy; }
        // ⇧ on a corner, or the node's own constrained proportions: W and H change together.
        if ((ev.shiftKey && changed.x && changed.y) || found.node.lockAspect) {
          if (changed.x) rect.h = rect.w / ratio;
          else rect.w = rect.h * ratio;
          if (handle.includes("n")) rect.y = from.y + from.h - rect.h;
          if (handle.includes("w") && !changed.x) rect.x = from.x + from.w - rect.w;
        }
        const w = Math.max(1, Math.round(rect.w));
        const h = Math.max(found.node.type === "line" ? 0 : 1, Math.round(rect.h));
        onResize(id, { x: Math.round((handle.includes("w") ? from.x + from.w - w : rect.x) - origin.x), y: Math.round((handle.includes("n") ? from.y + from.h - h : rect.y) - origin.y), w, h }, changed);
      },
      () => {}
    );
  };

  const startDraw = (e: React.PointerEvent) => {
    e.preventDefault();
    const drawing = latest.current.tool;
    const start = toCanvas(e.clientX, e.clientY);
    const under = frameUnder(e.clientX, e.clientY, new Set());
    const origin = under.el ? canvasRect(under.el) : { x: 0, y: 0 };
    let rect: Rect = { x: start.x, y: start.y, w: 0, h: 0 };
    follow(
      "draw",
      (ev) => {
        const at = toCanvas(ev.clientX, ev.clientY);
        let w = at.x - start.x;
        let h = at.y - start.y;
        if (ev.shiftKey) { const s = Math.max(Math.abs(w), Math.abs(h)); w = Math.sign(w || 1) * s; h = Math.sign(h || 1) * s; }
        rect = { x: Math.min(start.x, start.x + w), y: Math.min(start.y, start.y + h), w: Math.abs(w), h: Math.abs(h) };
        if (drawing !== "text") setDrawRect(rect);
      },
      () => {
        setDrawRect(null);
        const zoom = latest.current.view.zoom;
        const clicked = drawing === "text" || (rect.w * zoom < 3 && rect.h * zoom < 3);
        const r = clicked ? { x: start.x, y: start.y, w: 100, h: 100 } : rect;
        // Into an auto layout: at the pointer's place in its flow (Figma's), not at its end.
        const index = under.id && under.el ? (() => { const i = indexIn(under.el, under.id, e.clientX, e.clientY, new Set()); return i >= 0 ? i : undefined; })() : undefined;
        onDraw(drawing, under.id, { x: Math.round(r.x - origin.x), y: Math.round(r.y - origin.y), w: Math.max(1, Math.round(r.w)), h: Math.max(drawing === "line" ? 0 : 1, Math.round(r.h)) }, clicked, index);
      }
    );
  };

  /** A drag on the empty canvas, or in a frame's empty area: what it lands on (the frame's direct children there) is the selection. */
  const startMarquee = (e: React.PointerEvent, within: { id: string; el: HTMLElement } | null) => {
    const start = toCanvas(e.clientX, e.clientY);
    let box: Rect = { x: start.x, y: start.y, w: 0, h: 0 };
    const additive = e.shiftKey;
    const before = latest.current.selection;
    // What the box takes, as Figma's: a layer it touches — whole, it is selected; a frame it only crosses opens up, its layers inside are taken instead.
    // (Only the canvas's top-level frames open up, as in Figma; a frame inside one is taken whole when the box touches it.)
    const hitsIn = (list: SceneNode[], topLevel: boolean): string[] =>
      list.flatMap((n) => {
        if (n.locked || n.visible === false) return [];
        const el = elOf(n.id);
        if (!el) return [];
        const r = canvasRect(el);
        const touches = r.x < box.x + box.w && r.x + r.w > box.x && r.y < box.y + box.h && r.y + r.h > box.y;
        if (!touches) return [];
        const whole = r.x >= box.x && r.y >= box.y && r.x + r.w <= box.x + box.w && r.y + r.h <= box.y + box.h;
        const container = topLevel && isFrameLike(n) && n.type !== "instance" && n.children.length > 0;
        if (whole || !container) return [n.id];
        return hitsIn(n.children, false);
      });
    let lastHits = "";
    const select = (hits: string[]) => onSelect(additive ? Array.from(new Set([...before, ...hits])) : hits);
    follow(
      "marquee",
      (ev) => {
        const at = toCanvas(ev.clientX, ev.clientY);
        box = { x: Math.min(start.x, at.x), y: Math.min(start.y, at.y), w: Math.abs(at.x - start.x), h: Math.abs(at.y - start.y) };
        setMarquee(box);
        // Selected as the box grows, not only when it is let go.
        if (box.w < 2 && box.h < 2) return;
        const d = latest.current.doc;
        const candidates: SceneNode[] = within ? (getNode(d.nodes, within.id) as { children?: SceneNode[] } | null)?.children ?? [] : d.nodes;
        const hits = hitsIn(candidates, !within);
        const key = hits.join(",");
        if (key !== lastHits) { lastHits = key; select(hits); }
      },
      () => {
        setMarquee(null);
        if (box.w < 2 && box.h < 2) {
          // A click: the frame itself, or nothing.
          if (within) onSelect(additive ? [...before, within.id] : [within.id]);
          else if (!additive) onSelect([]);
          return;
        }
        const d = latest.current.doc;
        const candidates: SceneNode[] = within ? (getNode(d.nodes, within.id) as { children?: SceneNode[] } | null)?.children ?? [] : d.nodes;
        select(hitsIn(candidates, !within));
      }
    );
  };

  const onPointerDown = (e: React.PointerEvent) => {
    const target = e.target as Element;
    if (target.closest("[data-editing], [data-canvas-ui]")) return;
    const { tool: current, space: hand, doc: d, selection: sel } = latest.current;
    if (e.button === 1 || (e.button === 0 && (hand || current === "hand"))) return startPan(e);
    if (e.button !== 0) return;
    if (DRAW_TOOLS.has(current)) return startDraw(e);
    const path = pathAt(target, world.current!, d);
    const picked = pickFrom(path, sel, e.metaKey || e.ctrlKey);
    // The empty canvas, or a top-level frame's own area (not one of its children): a marquee — a click selects the frame.
    const onTopFrame = path.length === 1 && path[0].el === target.closest("[data-node-id]") && !sel.includes(path[0].id) && !e.metaKey && !e.ctrlKey;
    if (!picked || onTopFrame) return startMarquee(e, onTopFrame ? path[0] : null);
    if (e.shiftKey) {
      onSelect(sel.includes(picked.id) ? sel.filter((id) => id !== picked.id) : [...sel, picked.id]);
      return;
    }
    if (!sel.includes(picked.id)) onSelect([picked.id]);
    if (!picked.id.includes("/")) startMove(e, picked.id);
  };

  const onDoubleClickCanvas = (e: React.MouseEvent) => {
    const target = e.target as Element;
    if (target.closest("[data-editing], [data-canvas-ui]")) return;
    const { doc: d, selection: sel } = latest.current;
    const path = pathAt(target, world.current!, d);
    if (!path.length) return;
    // The next level down from the selection, or the innermost text.
    const deepest = [...path].reverse().find((p) => sel.includes(p.id));
    const at = deepest ? path[Math.min(path.length - 1, path.indexOf(deepest) + 1)] : path[Math.min(1, path.length - 1)];
    onDoubleClick(at.id);
  };

  /** A top-level frame's name over it: a press selects it — and a drag moves it. */
  const labelDown = (e: React.PointerEvent, id: string) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    if (e.shiftKey) {
      const sel = latest.current.selection;
      onSelect(sel.includes(id) ? sel.filter((s) => s !== id) : [...sel, id]);
      return;
    }
    if (!latest.current.selection.includes(id)) onSelect([id]);
    startMove(e, id);
  };

  // The lines, at the screen's scale — from the same view the world is drawn with.
  const S = (r: Rect): Rect => ({ x: view.x + r.x * view.zoom, y: view.y + r.y * view.zoom, w: r.w * view.zoom, h: r.h * view.zoom });
  const boxes = shown.boxes.map(S);
  const hoverBox = shown.hover ? S(shown.hover) : null;
  const parentBox = shown.parent ? S(shown.parent) : null;
  const box = boxes.length === 1 ? boxes[0] : null;
  const multiBounds = boxes.length > 1
    ? (() => {
        const x = Math.min(...boxes.map((b) => b.x));
        const y = Math.min(...boxes.map((b) => b.y));
        return { x, y, w: Math.max(...boxes.map((b) => b.x + b.w)) - x, h: Math.max(...boxes.map((b) => b.y + b.h)) - y };
      })()
    : null;
  const selectedNode = selection.length === 1 && !selection[0].includes("/") ? getNode(doc.nodes, selection[0]) : null;
  const purple = selection.some((id) => { const n = id.includes("/") ? null : getNode(doc.nodes, id); return n && (n.type === "component" || n.type === "componentSet" || n.type === "instance"); }) || selection.some((id) => id.includes("/"));
  const tone = purple ? "var(--edit-component)" : "var(--edit-accent)";
  const resizable = selectedNode && !selectedNode.locked;
  const cursor = dragging === "pan" || (dragging === null && (space || tool === "hand")) ? (dragging === "pan" ? "grabbing" : "grab") : tool === "text" ? "text" : DRAW_TOOLS.has(tool) ? "crosshair" : undefined;
  const inset = rulers ? RULER : 0;

  return (
    <div
      ref={viewport}
      data-figma-canvas=""
      className="absolute inset-0 overflow-hidden select-none touch-none"
      style={{ cursor, background: background ?? "var(--edit-canvas, #f5f5f5)" }}
      onPointerDown={onPointerDown}
      onDoubleClick={onDoubleClickCanvas}
      onPointerOver={(e) => {
        if (dragging || DRAW_TOOLS.has(tool)) { hovered.current = null; return; }
        const path = pathAt(e.target as Element, world.current!, doc);
        hovered.current = pickFrom(path, selection, e.metaKey || e.ctrlKey)?.el ?? null;
      }}
      onPointerLeave={() => { hovered.current = null; }}
      onContextMenu={(e) => {
        const target = e.target as Element;
        if (target.closest("[data-editing]")) return;
        const path = pathAt(target, world.current!, doc);
        const inSelection = path.find((p) => selection.includes(p.id));
        onContextMenu(inSelection ? inSelection.id : pickFrom(path, selection, false)?.id ?? null, e);
      }}
      onClickCapture={(e) => { if ((e.target as Element).closest("a[href]")) e.preventDefault(); }}
      onDragStart={(e) => e.preventDefault()}
    >
      {/* Figma's pixel grid past 800%. */}
      {view.zoom >= 8 && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: "linear-gradient(to right, rgba(0,0,0,0.12) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.12) 1px, transparent 1px)",
            backgroundSize: `${view.zoom}px ${view.zoom}px`,
            backgroundPosition: `${view.x}px ${view.y}px`,
          }}
        />
      )}
      {/* The world: the nodes at their places, the view's pan (translate) and zoom (scale) on it. The site's variables apply in it. */}
      <div className="absolute left-0 top-0" style={{ transform: `translate(${view.x}px, ${view.y}px)` }}>
        <div ref={world} data-design-scope="" className="absolute left-0 top-0 origin-top-left" style={{ transform: `scale(${view.zoom})` }}>
          <span ref={probe} data-zoom-probe="" aria-hidden className="pointer-events-none absolute left-0 top-0 h-0" style={{ width: PROBE }} />
          <DesignSystemStyle />
          <MotionStyle />
          <World doc={doc} render={render} />
        </div>
      </div>

      {/* ── The lines over the canvas ── */}
      {shown.labels.map(({ rect: r, ...label }) => (
        <div
          key={label.id}
          data-canvas-ui=""
          onPointerDown={(e) => labelDown(e, label.id)}
          onDoubleClick={(e) => { e.stopPropagation(); onDoubleClick(label.id); }}
          style={{ left: S(r).x, top: S(r).y - 18, maxWidth: Math.max(40, S(r).w) }}
          className={cn(
            "absolute flex items-center gap-1 h-4 text-[11px] leading-4 whitespace-nowrap overflow-hidden cursor-default",
            label.kind === "component" || label.kind === "componentSet" ? "text-[var(--edit-component)]" : selection.includes(label.id) ? "text-[var(--edit-accent)]" : "text-[var(--text-subtitle)] hover:text-[var(--edit-accent)]"
          )}
        >
          {(label.kind === "component" || label.kind === "componentSet") && <FigmaIcon name="16.component" size={12} />}
          <span className="truncate">{label.name}</span>
        </div>
      ))}
      {parentBox && !dragging && (
        <div aria-hidden className="pointer-events-none absolute border border-[var(--edit-accent)] opacity-25" style={{ left: parentBox.x, top: parentBox.y, width: parentBox.w, height: parentBox.h }} />
      )}
      {hoverBox && !dragging && (!box || JSON.stringify(hoverBox) !== JSON.stringify(box)) && (
        <div aria-hidden className="pointer-events-none absolute border-2 border-[var(--edit-accent)] opacity-70" style={{ left: hoverBox.x, top: hoverBox.y, width: hoverBox.w, height: hoverBox.h }} />
      )}
      {boxes.map((b, i) => (
        <div key={i} aria-hidden className="pointer-events-none absolute border" style={{ left: b.x, top: b.y, width: b.w, height: b.h, borderColor: shown.measure || copying ? MEASURE : tone }} />
      ))}
      {copying && shown.origins.map((o, i) => {
        const r = S(o);
        return <div key={`o${i}`} aria-hidden className="pointer-events-none absolute border" style={{ left: r.x, top: r.y, width: r.w, height: r.h, borderColor: MEASURE }} />;
      })}
      {shown.measure && <Measure a={S(shown.measure.a)} b={S(shown.measure.b)} zoom={view.zoom} />}
      {multiBounds && (
        <div aria-hidden className="pointer-events-none absolute border border-dashed" style={{ left: multiBounds.x, top: multiBounds.y, width: multiBounds.w, height: multiBounds.h, borderColor: tone }} />
      )}
      {drop && dragging === "move" && (
        <>
          {drop.rect && <div aria-hidden className="pointer-events-none absolute border-2 border-[var(--edit-accent)]" style={{ left: drop.rect.x, top: drop.rect.y, width: drop.rect.w, height: drop.rect.h }} />}
          {drop.line && <div aria-hidden className="pointer-events-none absolute bg-[var(--edit-accent)] rounded-full" style={{ left: drop.line.x, top: drop.line.y, width: drop.line.w, height: drop.line.h }} />}
        </>
      )}
      {marquee && (
        <div aria-hidden className="pointer-events-none absolute border border-[var(--edit-accent)] bg-[color-mix(in_srgb,var(--edit-accent)_12%,transparent)]" style={{ left: view.x + marquee.x * view.zoom, top: view.y + marquee.y * view.zoom, width: marquee.w * view.zoom, height: marquee.h * view.zoom }} />
      )}
      {guides.map((g, i) =>
        g.axis === "x" ? (
          <div key={`gx${i}`} aria-hidden className="pointer-events-none absolute top-0 bottom-0 w-px" style={{ left: view.x + g.at * view.zoom, background: "var(--edit-snap, #ff00ff)" }} />
        ) : (
          <div key={`gy${i}`} aria-hidden className="pointer-events-none absolute left-0 right-0 h-px" style={{ top: view.y + g.at * view.zoom, background: "var(--edit-snap, #ff00ff)" }} />
        )
      )}
      {box && resizable && dragging !== "move" &&
        ALL_HANDLES.map((handle) => (
          <span
            key={handle}
            data-canvas-ui=""
            onPointerDown={(e) => e.button === 0 && startResize(e, handle)}
            className="absolute w-2 h-2 -ml-1 -mt-1 bg-white border rounded-[1px]"
            style={{ left: box.x + (handle.includes("w") ? 0 : handle.includes("e") ? box.w : box.w / 2), top: box.y + (handle.includes("n") ? 0 : handle.includes("s") ? box.h : box.h / 2), borderColor: tone, cursor: HANDLE_CURSOR[handle] }}
          />
        ))}
      {(box ?? multiBounds) && dragging !== "resize" && (
        <span aria-hidden className="pointer-events-none absolute -translate-x-1/2 px-1 rounded-[3px] text-[11px] font-medium leading-4 text-white tabular-nums whitespace-nowrap" style={{ left: (box ?? multiBounds)!.x + (box ?? multiBounds)!.w / 2, top: (box ?? multiBounds)!.y + (box ?? multiBounds)!.h + 6, background: tone }}>
          {Math.round((box ?? multiBounds)!.w / view.zoom)} × {Math.round((box ?? multiBounds)!.h / view.zoom)}
        </span>
      )}
      {drawRect && (
        <div aria-hidden className="pointer-events-none absolute border border-[var(--edit-accent)]" style={{ left: view.x + drawRect.x * view.zoom, top: view.y + drawRect.y * view.zoom, width: drawRect.w * view.zoom, height: drawRect.h * view.zoom }} />
      )}
      {rulers && <Rulers view={{ ...view, x: view.x - inset, y: view.y - inset }} width={size.width - inset} height={size.height - inset} selected={box ?? multiBounds} />}
    </div>
  );
}

export { DRAW_TOOLS };
export type { CanvasTool, CanvasView };
export { MIN_ZOOM };
export type CanvasChild = ReactNode;
