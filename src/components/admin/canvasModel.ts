import type { CanvasNode, ComponentLayer, DesignComponent } from "@/types/design";
import type { GridSettings } from "@/types/project";
import { findLayer, isComponentSet, topComponents } from "@/components/project/components";

/**
 * The Bileşenler page as Figma's canvas (see CanvasPlace): what can be
 * selected on it, its tools, where the view is, and where each main
 * component sits — its own place, or its column's next free one.
 */

/** A main component, or one of its layers — or, with `set`, the component set `componentId` is the first variant of. */
export type MainSelection = { componentId: string; layerId?: string; set?: boolean };
/** Something drawn on the page on its own (see CanvasNode), or one of its layers. */
export type NodeSelection = { nodeId: string; layerId?: string };
export type CanvasSelection = MainSelection | NodeSelection;

export const isNodeSelection = (s: CanvasSelection): s is NodeSelection => "nodeId" in s;

/** Figma's tools: move (V), hand (H), frame (F), rectangle (R), ellipse (O), text (T). */
export type CanvasTool = "move" | "hand" | "frame" | "rectangle" | "ellipse" | "line" | "text";

/** The tools that draw. */
export const DRAW_TOOLS: ReadonlySet<CanvasTool> = new Set(["frame", "rectangle", "ellipse", "line", "text"]);

/** Where the view is: the canvas's origin on the screen (px from the viewport's top left) and its zoom. */
export interface CanvasView {
  x: number;
  y: number;
  zoom: number;
}

/** What the canvas's zoom does, for the chrome's zoom menu (see ComponentsCanvas.zoomActionsRef). */
export interface ZoomActions {
  zoomTo: (zoom: number) => void;
  fitAll: () => void;
  fitSelection: () => void;
}

export const MIN_ZOOM = 0.02;
export const MAX_ZOOM = 256;
export const clampZoom = (zoom: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));

/** The view zoomed to `zoom`, the canvas point under `at` (screen px in the viewport) staying there. */
export function zoomAround(view: CanvasView, zoom: number, at: { x: number; y: number }): CanvasView {
  const next = clampZoom(zoom);
  const px = (at.x - view.x) / view.zoom;
  const py = (at.y - view.y) / view.zoom;
  return { zoom: next, x: at.x - px * next, y: at.y - py * next };
}

/** The view fitting a canvas rect in a viewport of `width` × `height`, with room around it — never over 100% when `upTo100`. */
export function fitView(rect: { x: number; y: number; w: number; h: number }, width: number, height: number, upTo100 = true): CanvasView {
  const room = 64;
  const zoom = clampZoom(Math.min((width - room * 2) / Math.max(1, rect.w), (height - room * 2) / Math.max(1, rect.h), upTo100 ? 1 : Infinity));
  return { zoom, x: (width - rect.w * zoom) / 2 - rect.x * zoom, y: (height - rect.h * zoom) / 2 - rect.y * zoom };
}

/** A main component's width on the canvas: its own, else a page component's column (640) or a card's (320). */
export const canvasWidth = (component: DesignComponent) => component.canvas?.width ?? (component.type ? 640 : 320);

/** A set's frame around its variants: 20px in, a 1px dashed line. */
export const SET_INSET = 21;

/** A set's auto layout unless it has its own (see DesignComponent.setFrame): its variants stacked 24px apart, 20px in. */
export const SET_LAYOUT: GridSettings = { flow: "vertical", rowGap: 24, columnGap: 24, paddingX: 20, paddingY: 20 };
export const setLayoutOf = (first: DesignComponent): GridSettings => first.setFrame?.layout ?? SET_LAYOUT;

/** The columns main components without a place of their own stand in: page components, then the ones used inside others. */
const COLUMNS = { page: 0, inner: 800 };
const COLUMN_GAP = 96;

/**
 * Where each of the page's top-level main components (a set once) sits: its
 * own place, else the next one down its column — the column keeps every
 * component's room (a moved one leaves its gap), so moving one moves no other.
 * `heights`: their heights as drawn (px), measured.
 */
export function canvasPlaces(components: readonly DesignComponent[], heights: Readonly<Record<string, number>>): Map<string, { x: number; y: number }> {
  const places = new Map<string, { x: number; y: number }>();
  const down = { page: 0, inner: 0 };
  for (const component of topComponents(components)) {
    const column = component.type ? "page" : "inner";
    const auto = { x: COLUMNS[column], y: down[column] };
    down[column] += (heights[component.id] ?? 240) + COLUMN_GAP;
    places.set(component.id, component.canvas ? { x: component.canvas.x, y: component.canvas.y } : auto);
  }
  return places;
}

/** A top-level main component's width as drawn — a set's with its frame around its variants. */
export const topWidth = (component: DesignComponent, components: readonly DesignComponent[]) =>
  canvasWidth(component) + (isComponentSet(component, components) ? SET_INSET * 2 : 0);

/** A drawing's layer (itself for a shape or a text on its own). */
export function nodeLayer(node: CanvasNode, layerId?: string): ComponentLayer | null {
  if (!layerId || layerId === node.id) return node;
  return node.kind === "frame" ? findLayer(node, layerId) : null;
}

/** Is it drawn on the canvas — a shape, a text of its own, a frame of only such — so it can go (a main component's other layers are its data's)? */
export const isDrawing = (layer: ComponentLayer): boolean =>
  layer.kind === "shape" || layer.kind === "static-text" || (layer.kind === "frame" && layer.layers.every(isDrawing));

/** Can layers be drawn into it — a frame repeating no instances (their frame holds only them)? */
export const canHoldDrawings = (frame: { layers: readonly ComponentLayer[] }) => !frame.layers.some((l) => l.kind === "instance");

/** Where a drawing goes: into a drawing's frame, into a main component's frame (null: its own), or on the canvas. */
export type DrawParent = { nodeId: string; frameId: string | null } | { componentId: string; frameId: string | null } | null;
