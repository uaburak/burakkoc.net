import type { BlendMode, DesignVariable, InteractionAnimation, InteractionEasing, InteractionTrigger, VariableValue } from "@/types/design";

/**
 * The Figma editor's file, as Figma's own: a canvas holding frames, shapes
 * and texts, components (with their variants in component sets) and
 * instances of them. A project's page is one of the top-level frames
 * (`FigmaDocument.pageId`): what the site shows at /projects/<slug>.
 *
 * Every node has its place (x, y — from its parent's top left; a top-level
 * one's from the canvas's origin) and size. A frame with auto layout lays its
 * children out itself (their x, y are ignored); its children then size as
 * Fixed, Hug or Fill.
 */

export type NodeType = "frame" | "rectangle" | "ellipse" | "line" | "text" | "component" | "componentSet" | "instance";

/** A gradient's stop: a colour at a place along it (0–100). */
export interface GradientStop {
  color: string;
  position: number;
}

/**
 * A fill: solid — a colour of its own (#rrggbb) or a colour variable's — or,
 * as Figma's, a linear gradient or an image; at an opacity (0–100).
 */
export interface Paint {
  type?: "solid" | "gradient" | "image";
  color: VariableValue;
  opacity?: number;
  visible?: boolean;
  gradient?: { angle: number; stops: GradientStop[] };
  image?: { url: string; fit: "fill" | "fit" | "tile" };
}

export const PAINT_LABEL: Record<NonNullable<Paint["type"]>, string> = { solid: "Solid", gradient: "Gradient", image: "Image" };

/** Figma's layout grids: columns, rows or a square grid drawn over a frame in the editor. */
export interface LayoutGrid {
  type: "columns" | "rows" | "grid";
  visible?: boolean;
  count: number;
  gutter: number;
  margin: number;
  /** The square grid's cell (px) */
  size: number;
  color: string;
  opacity: number;
}

export const newLayoutGrid = (type: LayoutGrid["type"]): LayoutGrid => ({ type, count: type === "grid" ? 0 : 5, gutter: 20, margin: 0, size: 8, color: "#ff0000", opacity: 10 });
export const LAYOUT_GRID_LABEL: Record<LayoutGrid["type"], string> = { columns: "Columns", rows: "Rows", grid: "Grid" };

/** An effect style: effects kept under a name, applied to layers. */
export interface EffectStyle {
  id: string;
  name: string;
  effects: Effect[];
}

/** Figma's Export settings on a layer. */
export interface ExportSetting {
  scale: 1 | 2 | 3 | 4;
  format: "png" | "jpg" | "svg";
}

export const BLEND_MODES: { value: BlendMode; label: string }[] = [
  { value: "pass-through", label: "Pass through" },
  { value: "normal", label: "Normal" },
  { value: "darken", label: "Darken" },
  { value: "multiply", label: "Multiply" },
  { value: "color-burn", label: "Color burn" },
  { value: "lighten", label: "Lighten" },
  { value: "screen", label: "Screen" },
  { value: "color-dodge", label: "Color dodge" },
  { value: "overlay", label: "Overlay" },
  { value: "soft-light", label: "Soft light" },
  { value: "hard-light", label: "Hard light" },
  { value: "difference", label: "Difference" },
  { value: "exclusion", label: "Exclusion" },
  { value: "hue", label: "Hue" },
  { value: "saturation", label: "Saturation" },
  { value: "color", label: "Color" },
  { value: "luminosity", label: "Luminosity" },
];

export type StrokeAlign = "inside" | "center" | "outside";

export interface StrokeStyle {
  color: VariableValue;
  opacity?: number;
  visible?: boolean;
  /** px — or a number variable */
  weight: VariableValue;
  align: StrokeAlign;
  /** Which sides it is drawn on (all when unset) */
  sides?: { top: boolean; right: boolean; bottom: boolean; left: boolean };
  /** Dashed */
  dashed?: boolean;
}

/** Figma's effects: a drop or inner shadow, a layer or background blur. */
export type Effect =
  | { type: "dropShadow" | "innerShadow"; visible?: boolean; x: number; y: number; blur: number; spread: number; color: string; opacity: number }
  | { type: "layerBlur" | "backgroundBlur"; visible?: boolean; radius: number };
/** (The drop shadow's shape, as effects were first stored.) */
export type Shadow = Extract<Effect, { type: "dropShadow" | "innerShadow" }>;

export const EFFECT_LABEL: Record<Effect["type"], string> = { dropShadow: "Drop shadow", innerShadow: "Inner shadow", layerBlur: "Layer blur", backgroundBlur: "Background blur" };
export const newEffect = (type: Effect["type"]): Effect =>
  type === "layerBlur" || type === "backgroundBlur" ? { type, radius: 4 } : { type, x: 0, y: 4, blur: 4, spread: 0, color: "#000000", opacity: 25 };

export type LayoutMode = "none" | "horizontal" | "vertical" | "grid";
export type SizingMode = "fixed" | "hug" | "fill";
export type PrimaryAlign = "min" | "center" | "max" | "spaceBetween";
export type CounterAlign = "min" | "center" | "max";
export type TextAlign = "left" | "center" | "right";
export type TextAutoResize = "widthHeight" | "height" | "none";

/** A variant's value of one of its set's properties ("State=Hover"). */
export interface VariantValue {
  property: string;
  value: string;
}

/** A prototype interaction of a variant: what turns its instances into another variant, and how it animates. */
export interface Reaction {
  id: string;
  trigger: InteractionTrigger;
  /** After a delay: how long (ms) */
  delay?: number;
  /** The variant it changes to (a node id in the same set) */
  target: string;
  animation: InteractionAnimation;
  easing: InteractionEasing;
  duration: number;
}

export type Corners = [VariableValue, VariableValue, VariableValue, VariableValue];

/**
 * Figma's component properties (besides the variant ones, which are the
 * set's variants' values): a boolean shows or hides a layer, a text gives a
 * text its words, an instance swap picks a nested instance's component.
 * They are defined on the main component — on the set, for its variants —
 * and layers bind to them (visibleProp, charactersProp, mainProp); each
 * instance keeps its own values (props).
 */
export type PropertyType = "boolean" | "text" | "instanceSwap";

export interface ComponentProperty {
  id: string;
  name: string;
  type: PropertyType;
  /** Its default: on / off, the words, or a component's id */
  value: string | boolean;
  /** Instance swap: the components offered first (ids) */
  preferred?: string[];
}

export const PROPERTY_LABEL: Record<PropertyType, string> = { boolean: "Boolean", text: "Text", instanceSwap: "Instance swap" };

export type PropertyValues = Record<string, string | boolean>;

interface BaseNode {
  id: string;
  name: string;
  type: NodeType;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Degrees, clockwise */
  rotation?: number;
  /** Shown (true when unset) */
  visible?: boolean;
  locked?: boolean;
  /** 0–100 (100 when unset) */
  opacity?: number;
  /** How it sizes in a frame with auto layout — Fixed when unset; a frame's own Hug sizes it to its content anywhere */
  sizingH?: SizingMode;
  sizingV?: SizingMode;
  /** Figma's blend mode (pass-through when unset) */
  blendMode?: BlendMode;
  /** Constrain proportions: W and H change together */
  lockAspect?: boolean;
  /** In a frame with auto layout: kept at its own x, y (Figma's absolute position) */
  absolute?: boolean;
  /** Its export settings (Figma's Export section) */
  exports?: ExportSetting[];
  /** Mirrored (Figma's Flip horizontal / vertical) */
  flipH?: boolean;
  flipV?: boolean;
  /** Figma's min / max width and height (px) */
  minWidth?: number;
  maxWidth?: number;
  minHeight?: number;
  maxHeight?: number;
  /** W / H from a number variable ("Apply variable…") */
  widthVar?: VariableValue;
  heightVar?: VariableValue;
  /** Inside a main component: shown or hidden by this boolean property (its id) */
  visibleProp?: string;
}

interface Geometry {
  fills: Paint[];
  strokes: StrokeStyle[];
  cornerRadius?: VariableValue;
  /** Each corner on its own (top left, top right, bottom right, bottom left) — wins over cornerRadius */
  corners?: Corners;
  effects?: Effect[];
}

export interface ShapeNode extends BaseNode, Geometry {
  type: "rectangle" | "ellipse" | "line";
  effectStyle?: string;
}

export interface TextNode extends BaseNode {
  type: "text";
  characters: string;
  /** Its English text, when the site shows English */
  charactersEn?: string;
  fontSize: VariableValue;
  fontWeight: VariableValue;
  /** px — auto when unset */
  lineHeight?: VariableValue;
  /** px */
  letterSpacing?: VariableValue;
  textAlign: TextAlign;
  /** Grows with its text (both ways), down only (fixed width), or neither */
  textAutoResize: TextAutoResize;
  fills: Paint[];
  /** One of the site's text styles — its typography over the node's own */
  textStyle?: string;
  /** Inside a main component: its words from this text property (its id) */
  charactersProp?: string;
  /** Figma's type settings */
  textCase?: "upper" | "lower" | "title";
  textDecoration?: "underline" | "strikethrough";
  /** Where the text sits in a fixed-height box */
  verticalAlign?: "top" | "middle" | "bottom";
  /** px between paragraphs (blank lines) */
  paragraphSpacing?: number;
}

export interface FrameNode extends BaseNode, Geometry {
  type: "frame" | "component" | "componentSet" | "instance";
  children: SceneNode[];
  clipsContent?: boolean;
  layoutMode: LayoutMode;
  /** px — or a number variable */
  itemSpacing: VariableValue;
  paddingTop: VariableValue;
  paddingRight: VariableValue;
  paddingBottom: VariableValue;
  paddingLeft: VariableValue;
  primaryAlign: PrimaryAlign;
  counterAlign: CounterAlign;
  layoutWrap?: boolean;
  /** Grid auto layout: its columns and rows */
  gridColumns?: number;
  gridRows?: number;
  /** The gap across the rows of a wrapping layout (the item spacing when unset) */
  counterSpacing?: VariableValue;
  /** Figma's advanced layout settings */
  strokesInLayout?: boolean;
  /** Canvas stacking: the first layer on top (the last, when unset) */
  firstOnTop?: boolean;
  /** Text baseline alignment */
  baselineAlign?: boolean;
  /** Figma's layout grids, drawn over it in the editor */
  layoutGrids?: LayoutGrid[];
  /** The effect style its effects come from */
  effectStyle?: string;
  /** A component in a set: its values of the set's properties */
  variant?: VariantValue[];
  /** A variant's prototype: what its instances do */
  reactions?: Reaction[];
  /** A main component's (or a set's, for its variants) properties */
  properties?: ComponentProperty[];
  /** An instance: its main component's id (a variant's, in a set) */
  mainId?: string;
  /** An instance's values of its component's properties (by property id) — the defaults where unset */
  props?: PropertyValues;
  /** An instance's English words for its text properties */
  propsEn?: Record<string, string>;
  /** An instance inside a main component: its component from this instance swap property (its id) */
  mainProp?: string;
  /**
   * An instance's overrides, by the overridden layer's name path inside the
   * main component ("Label", "Card›Title") — "" for the instance's own frame.
   */
  overrides?: Record<string, NodeOverride>;
}

/** What an instance may change of a layer of its main component. */
export interface NodeOverride {
  characters?: string;
  charactersEn?: string;
  fills?: Paint[];
  strokes?: StrokeStyle[];
  visible?: boolean;
  opacity?: number;
  cornerRadius?: VariableValue;
  /** A nested instance's own overrides (a Card's texts inside a Project info instance) */
  overrides?: Record<string, NodeOverride>;
}

export type SceneNode = FrameNode | ShapeNode | TextNode;

/** One of the file's other pages (the first page — the document itself — is the project's page on the site). */
export interface DocumentPage {
  id: string;
  name: string;
  nodes: SceneNode[];
  background?: string;
}

export interface FigmaDocument {
  version: 1;
  /** The canvas's top-level nodes, back to front */
  nodes: SceneNode[];
  /** The top-level frame that is the project's page on the site */
  pageId: string;
  /** The canvas's own colour (Figma's page background) */
  background?: string;
  /** The first page's name (the project's) */
  pageName?: string;
  /** The file's other pages, as Figma's: their own canvases */
  pages?: DocumentPage[];
  /** Which page is open in the editor (the first when unset) */
  currentPage?: string;
  /** The file's effect styles */
  effectStyles?: EffectStyle[];
  /** Which starting library its Components page was seeded from (see library.ts) */
  libraryVersion?: number;
}

/** A file as stored, brought up to date: effects made before they had a type are drop shadows. */
export function upgradeDocument(doc: FigmaDocument): FigmaDocument {
  const fix = (node: SceneNode): SceneNode => {
    const next = node.type === "text" ? node : { ...node, effects: node.effects?.map((e) => ("type" in e && e.type ? e : { ...(e as object), type: "dropShadow" } as Effect)) };
    return isFrameLike(next) ? { ...next, children: next.children.map(fix) } : next;
  };
  return { ...doc, nodes: doc.nodes.map(fix) };
}

/** Every node of the file, the open page's first — where components are found, whichever page they sit on (Figma's local components). */
export function libraryOf(doc: FigmaDocument): SceneNode[] {
  const current = doc.currentPage ? doc.pages?.find((p) => p.id === doc.currentPage) : undefined;
  const others = (doc.pages ?? []).filter((p) => p !== current).flatMap((p) => p.nodes);
  return current ? [...current.nodes, ...doc.nodes, ...others] : [...doc.nodes, ...others];
}

/** The page node `id` sits on: "" for the project's page, a page's id otherwise, null when it is nowhere. */
export function pageOfNode(doc: FigmaDocument, id: string): string | null {
  if (findNode(doc.nodes, id)) return "";
  return doc.pages?.find((p) => findNode(p.nodes, id))?.id ?? null;
}

/** The file with node `id` changed by `update`, whichever page it sits on. */
export function updateAnywhere(doc: FigmaDocument, id: string, update: (node: SceneNode) => SceneNode): FigmaDocument {
  const nodes = updateNode(doc.nodes, id, update);
  let pages = doc.pages;
  if (pages) {
    const next = pages.map((p) => {
      const n = updateNode(p.nodes, id, update);
      return n === p.nodes ? p : { ...p, nodes: n };
    });
    if (next.some((p, i) => p !== pages![i])) pages = next;
  }
  return nodes === doc.nodes && pages === doc.pages ? doc : { ...doc, nodes, pages };
}

export const isFrameLike = (node: SceneNode): node is FrameNode =>
  node.type === "frame" || node.type === "component" || node.type === "componentSet" || node.type === "instance";
export const isGeometry = (node: SceneNode): node is FrameNode | ShapeNode => node.type !== "text";
export const isShown = (node: SceneNode) => node.visible !== false;

// ── Ids and factories ─────────────────────────────────────────────────────────

let counter = 0;
export function nid(prefix = "n") {
  counter += 1;
  return `${prefix}${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 5)}`;
}

const own = (value: string | number): VariableValue => ({ value });

const baseFrame = (name: string, x: number, y: number, width: number, height: number): FrameNode => ({
  id: nid(),
  name,
  type: "frame",
  x: Math.round(x),
  y: Math.round(y),
  width: Math.round(width),
  height: Math.round(height),
  children: [],
  fills: [{ color: own("#ffffff") }],
  strokes: [],
  clipsContent: true,
  layoutMode: "none",
  itemSpacing: own(0),
  paddingTop: own(0),
  paddingRight: own(0),
  paddingBottom: own(0),
  paddingLeft: own(0),
  primaryAlign: "min",
  counterAlign: "min",
});

export const makeFrame = (name: string, x: number, y: number, width: number, height: number): FrameNode => baseFrame(name, x, y, width, height);

export const makeShape = (type: ShapeNode["type"], name: string, x: number, y: number, width: number, height: number): ShapeNode => ({
  id: nid(),
  name,
  type,
  x: Math.round(x),
  y: Math.round(y),
  width: Math.round(width),
  height: type === "line" ? 0 : Math.round(height),
  fills: type === "line" ? [] : [{ color: own("#d9d9d9") }],
  strokes: type === "line" ? [{ color: own("#000000"), weight: own(1), align: "center" }] : [],
});

export const makeText = (x: number, y: number, characters = ""): TextNode => ({
  id: nid(),
  name: characters || "Text",
  type: "text",
  x: Math.round(x),
  y: Math.round(y),
  width: 100,
  height: 24,
  characters,
  fontSize: own(16),
  fontWeight: own(400),
  textAlign: "left",
  textAutoResize: "widthHeight",
  fills: [{ color: own("#000000") }],
});

/** A new file: the project's page — a 1440 × 1024 frame, white, stacking what is put in it (set its height to Sar to grow with it). */
export function newDocument(title: string): FigmaDocument {
  const page = baseFrame(title || "Page", 0, 0, 1440, 1024);
  page.layoutMode = "vertical";
  page.clipsContent = false;
  return { version: 1, nodes: [page], pageId: page.id };
}

// ── The tree ──────────────────────────────────────────────────────────────────

export interface Found {
  node: SceneNode;
  parent: FrameNode | null;
  index: number;
  /** The ids from the top-level node down to it */
  path: string[];
}

/** Every node, depth first, parents before children. */
export function walk(nodes: readonly SceneNode[], visit: (node: SceneNode, parent: FrameNode | null, path: string[]) => void, parent: FrameNode | null = null, path: string[] = []) {
  for (const node of nodes) {
    const here = [...path, node.id];
    visit(node, parent, here);
    if (isFrameLike(node)) walk(node.children, visit, node, here);
  }
}

export function findNode(nodes: readonly SceneNode[], id: string): Found | null {
  const search = (list: readonly SceneNode[], parent: FrameNode | null, path: string[]): Found | null => {
    for (let index = 0; index < list.length; index++) {
      const node = list[index];
      const here = [...path, node.id];
      if (node.id === id) return { node, parent, index, path: here };
      if (isFrameLike(node)) {
        const found = search(node.children, node, here);
        if (found) return found;
      }
    }
    return null;
  };
  return search(nodes, null, []);
}

export const getNode = (nodes: readonly SceneNode[], id: string) => findNode(nodes, id)?.node ?? null;

/** The tree with node `id` replaced by `update(node)` — the same arrays where nothing changed. */
export function updateNode(nodes: SceneNode[], id: string, update: (node: SceneNode) => SceneNode): SceneNode[] {
  let changed = false;
  const next = nodes.map((node) => {
    if (node.id === id) {
      const updated = update(node);
      if (updated !== node) changed = true;
      return updated;
    }
    if (isFrameLike(node)) {
      const children = updateNode(node.children, id, update);
      if (children !== node.children) {
        changed = true;
        return { ...node, children };
      }
    }
    return node;
  });
  return changed ? next : nodes;
}

/** Several nodes changed at once. */
export function updateNodes(nodes: SceneNode[], ids: readonly string[], update: (node: SceneNode) => SceneNode): SceneNode[] {
  return ids.reduce((list, id) => updateNode(list, id, update), nodes);
}

export function removeNodes(nodes: SceneNode[], ids: ReadonlySet<string>): SceneNode[] {
  return nodes
    .filter((node) => !ids.has(node.id))
    .map((node) => (isFrameLike(node) ? { ...node, children: removeNodes(node.children, ids) } : node));
}

/** `node` put into `parentId`'s children (null: the canvas) at `index` (the end when unset). */
export function insertNode(nodes: SceneNode[], parentId: string | null, node: SceneNode, index?: number): SceneNode[] {
  const put = (list: SceneNode[]) => {
    const next = [...list];
    next.splice(index === undefined || index < 0 || index > list.length ? list.length : index, 0, node);
    return next;
  };
  if (!parentId) return put(nodes);
  return updateNode(nodes, parentId, (parent) => (isFrameLike(parent) ? { ...parent, children: put(parent.children) } : parent));
}

/** A copy with fresh ids, everywhere in it. */
export function cloneNode<T extends SceneNode>(node: T): T {
  const copy = structuredClone(node) as T;
  const rename = (n: SceneNode) => {
    n.id = nid();
    if (isFrameLike(n)) n.children.forEach(rename);
  };
  rename(copy);
  return copy;
}

/** The nodes in `ids` that have no ancestor in `ids` — what a multi-selection moves as one. */
export function topmost(nodes: readonly SceneNode[], ids: readonly string[]): Found[] {
  const set = new Set(ids);
  return ids
    .map((id) => findNode(nodes, id))
    .filter((f): f is Found => Boolean(f))
    .filter((f) => !f.path.slice(0, -1).some((ancestor) => set.has(ancestor)));
}

/** All of a node's ancestors' ids, the top-level one first. */
export const ancestorsOf = (nodes: readonly SceneNode[], id: string) => findNode(nodes, id)?.path.slice(0, -1) ?? [];

/** Is `node` (or a frame it sits in) locked? */
export function isLocked(nodes: readonly SceneNode[], id: string) {
  const found = findNode(nodes, id);
  if (!found) return false;
  return found.path.some((pid) => getNode(nodes, pid)?.locked);
}

/** `base`, or `base 2`, `base 3`… — a name no sibling has. */
export function freeName(base: string, siblings: readonly SceneNode[]) {
  const names = new Set(siblings.map((s) => s.name));
  if (!names.has(base)) return base;
  for (let n = 2; ; n++) if (!names.has(`${base} ${n}`)) return `${base} ${n}`;
}

/** The next "Frame 3" after "Frame 2", counting the whole file — as Figma numbers what it draws. */
export function nextName(nodes: readonly SceneNode[], base: string) {
  let max = 0;
  const re = new RegExp(`^${base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} (\\d+)$`);
  walk(nodes, (node) => {
    const m = node.name.match(re);
    if (m) max = Math.max(max, Number(m[1]));
  });
  return `${base} ${max + 1}`;
}

// ── Components ────────────────────────────────────────────────────────────────

/** Every component in the file (a set's variants included), with the set holding it. */
export function allComponents(nodes: readonly SceneNode[]): { component: FrameNode; set: FrameNode | null }[] {
  const out: { component: FrameNode; set: FrameNode | null }[] = [];
  walk(nodes, (node, parent) => {
    if (node.type === "component") out.push({ component: node, set: parent?.type === "componentSet" ? parent : null });
  });
  return out;
}

export const findComponent = (nodes: readonly SceneNode[], id: string): FrameNode | null => {
  const node = getNode(nodes, id);
  return node && node.type === "component" ? node : null;
};

/** The set a variant is in, or null. */
export function setOf(nodes: readonly SceneNode[], componentId: string): FrameNode | null {
  const found = findNode(nodes, componentId);
  return found?.parent?.type === "componentSet" ? found.parent : null;
}

/** A set's variants, in their order. */
export const variantsOf = (set: FrameNode) => set.children.filter((c): c is FrameNode => c.type === "component");

export const variantValue = (variant: FrameNode, property: string) => variant.variant?.find((v) => v.property === property)?.value ?? "";

/** A set's properties and each one's values, from its variants (in the order they appear). */
export function variantProperties(set: FrameNode): { name: string; values: string[] }[] {
  const props: { name: string; values: string[] }[] = [];
  for (const v of variantsOf(set)) {
    for (const { property, value } of v.variant ?? []) {
      let p = props.find((x) => x.name === property);
      if (!p) {
        p = { name: property, values: [] };
        props.push(p);
      }
      if (!p.values.includes(value)) p.values.push(value);
    }
  }
  return props;
}

/** Where a component's properties are defined: its set, when it is a variant; itself otherwise. */
export function propertyHolder(nodes: readonly SceneNode[], componentId: string): FrameNode | null {
  const component = findComponent(nodes, componentId);
  if (!component) return null;
  return setOf(nodes, component.id) ?? component;
}

/** A component's properties (its set's, for a variant). */
export const propertiesOf = (nodes: readonly SceneNode[], componentId: string): ComponentProperty[] => propertyHolder(nodes, componentId)?.properties ?? [];

/** An instance's values of its component's properties: the defaults, the instance's own over them. */
export function propertyValues(nodes: readonly SceneNode[], main: FrameNode, instance: Pick<FrameNode, "props">): PropertyValues {
  const values: PropertyValues = {};
  for (const p of propertiesOf(nodes, main.id)) values[p.id] = p.value;
  for (const [id, v] of Object.entries(instance.props ?? {})) if (id in values) values[id] = v;
  return values;
}

/** The main component a node sits in (itself, when it is one), with where its properties live — null outside main components. */
export function componentAround(nodes: readonly SceneNode[], id: string): { component: FrameNode; holder: FrameNode } | null {
  const found = findNode(nodes, id);
  if (!found) return null;
  for (let i = found.path.length - 1; i >= 0; i--) {
    const n = getNode(nodes, found.path[i]);
    if (n?.type === "component") return { component: n, holder: setOf(nodes, n.id) ?? n };
  }
  return null;
}

/** A property name no other of the holder's has: `base`, else `base 2`, `base 3`… */
export function freePropertyName(holder: FrameNode, base: string) {
  const names = new Set((holder.properties ?? []).map((p) => p.name));
  for (const p of variantProperties(holder)) names.add(p.name);
  if (!names.has(base)) return base;
  for (let n = 2; ; n++) if (!names.has(`${base} ${n}`)) return `${base} ${n}`;
}

/** `holder` with every layer bound to property `id` given `value`: shown or hidden, its words, its component. */
export function applyPropertyValue(holder: FrameNode, id: string, value: string | boolean): FrameNode {
  const visit = (n: SceneNode): SceneNode => {
    let next = n;
    if (n.visibleProp === id) next = { ...next, visible: value ? undefined : false };
    if (next.type === "text" && next.charactersProp === id && typeof value === "string") next = { ...next, characters: value };
    if (next.type === "instance" && next.mainProp === id && typeof value === "string") next = { ...next, mainId: value };
    return isFrameLike(next) ? { ...next, children: next.children.map(visit) } : next;
  };
  return visit(holder) as FrameNode;
}

/** `holder` with its layers' bindings to properties not in `keep` taken off. */
export function pruneBindings(holder: FrameNode, keep: ReadonlySet<string>): FrameNode {
  const visit = (n: SceneNode): SceneNode => {
    let next = n;
    if (n.visibleProp && !keep.has(n.visibleProp)) next = { ...next, visibleProp: undefined };
    if (next.type === "text" && next.charactersProp && !keep.has(next.charactersProp)) next = { ...next, charactersProp: undefined };
    if (next.type === "instance" && next.mainProp && !keep.has(next.mainProp)) next = { ...next, mainProp: undefined };
    return isFrameLike(next) ? { ...next, children: next.children.map(visit) } : next;
  };
  return visit(holder) as FrameNode;
}

/** A variant's name, as Figma shows it: "State=Hover, Size=Large". */
export const variantName = (variant: FrameNode) => (variant.variant?.length ? variant.variant.map((v) => `${v.property}=${v.value}`).join(", ") : variant.name);

/** The variant of `set` closest to `current` with `property` set to `value` (the one sharing the most other values). */
export function pickVariant(set: FrameNode, current: FrameNode, property: string, value: string): FrameNode {
  const variants = variantsOf(set);
  const scored = variants
    .filter((v) => variantValue(v, property) === value)
    .map((v) => ({ v, score: (current.variant ?? []).filter((cv) => cv.property !== property && variantValue(v, cv.property) === cv.value).length }))
    .sort((a, b) => b.score - a.score);
  return scored[0]?.v ?? current;
}

/** A layer's path of names inside a component ("Card›Title"), the key its overrides are kept under. */
export const PATH_SEP = "›";
export function namePath(component: FrameNode, id: string): string | null {
  const search = (list: SceneNode[], path: string[]): string | null => {
    for (const child of list) {
      const here = [...path, child.name];
      if (child.id === id) return here.join(PATH_SEP);
      if (isFrameLike(child)) {
        const found = search(child.children, here);
        if (found) return found;
      }
    }
    return null;
  };
  return search(component.children, []);
}

/**
 * An instance drawn: its main component's frame (the instance's own place,
 * size and sizing over it) and children, the instance's overrides applied by
 * name path. `mainId` may name a set's variant the instance turned into.
 */
export function resolveInstance(nodes: readonly SceneNode[], instance: FrameNode, shownId?: string): FrameNode | null {
  const main = findComponent(nodes, shownId ?? instance.mainId ?? "");
  if (!main) return null;
  const overrides = instance.overrides ?? {};
  const values = propertyValues(nodes, main, instance);
  const valuesEn = instance.propsEn ?? {};
  // A layer bound to a property: shown by a boolean, worded by a text, swapped by an instance swap.
  const applyProps = <T extends SceneNode>(node: T): T => {
    let next = node;
    if (node.visibleProp && node.visibleProp in values) next = { ...next, visible: Boolean(values[node.visibleProp]) };
    if (next.type === "text" && next.charactersProp && typeof values[next.charactersProp] === "string") {
      next = { ...next, characters: values[next.charactersProp] as string, charactersEn: valuesEn[next.charactersProp] } as T;
    }
    if (next.type === "instance" && (next as FrameNode).mainProp) {
      const id = values[(next as FrameNode).mainProp!];
      if (typeof id === "string" && findComponent(nodes, id)) next = { ...next, mainId: id } as T;
    }
    return next;
  };
  const applyOverride = <T extends SceneNode>(node: T, key: string): T => {
    const o = overrides[key];
    if (!o) return node;
    const next = { ...node } as T;
    if (o.visible !== undefined) next.visible = o.visible;
    if (o.opacity !== undefined) next.opacity = o.opacity;
    if (next.type === "text") {
      if (o.characters !== undefined) (next as TextNode).characters = o.characters;
      if (o.charactersEn !== undefined) (next as TextNode).charactersEn = o.charactersEn;
      if (o.fills) (next as TextNode).fills = o.fills;
    } else {
      if (o.fills) (next as FrameNode | ShapeNode).fills = o.fills;
      if (o.strokes) (next as FrameNode | ShapeNode).strokes = o.strokes;
      if (o.cornerRadius) (next as FrameNode | ShapeNode).cornerRadius = o.cornerRadius;
      // A nested instance: the outer instance's overrides of it over its own.
      if (o.overrides && next.type === "instance") (next as FrameNode).overrides = mergeOverrides((next as FrameNode).overrides, o.overrides);
    }
    return next;
  };
  const children = (list: SceneNode[], path: string): SceneNode[] =>
    list.map((child) => {
      const key = path ? `${path}${PATH_SEP}${child.name}` : child.name;
      const applied = applyOverride(applyProps(child), key);
      return isFrameLike(applied) && applied.type !== "instance" ? { ...applied, children: children(applied.children, key) } : applied;
    });
  const self = applyOverride(main, "");
  return {
    ...self,
    id: instance.id,
    name: instance.name,
    type: "instance",
    x: instance.x,
    y: instance.y,
    width: instance.width,
    height: instance.height,
    rotation: instance.rotation,
    flipH: instance.flipH,
    flipV: instance.flipV,
    opacity: instance.opacity ?? self.opacity,
    blendMode: instance.blendMode ?? self.blendMode,
    absolute: instance.absolute,
    lockAspect: instance.lockAspect,
    locked: instance.locked,
    visible: instance.visible,
    sizingH: instance.sizingH,
    sizingV: instance.sizingV,
    minWidth: instance.minWidth,
    maxWidth: instance.maxWidth,
    minHeight: instance.minHeight,
    maxHeight: instance.maxHeight,
    widthVar: instance.widthVar,
    heightVar: instance.heightVar,
    variant: undefined,
    reactions: undefined,
    mainId: instance.mainId,
    overrides: instance.overrides,
    children: children(main.children, ""),
  };
}

/** `over` on top of `base`, key by key (nested maps merged too). */
export function mergeOverrides(base: Record<string, NodeOverride> | undefined, over: Record<string, NodeOverride>): Record<string, NodeOverride> {
  const out: Record<string, NodeOverride> = { ...(base ?? {}) };
  for (const [key, o] of Object.entries(over)) {
    const b = out[key];
    out[key] = b ? { ...b, ...o, ...(b.overrides || o.overrides ? { overrides: mergeOverrides(b.overrides, o.overrides ?? {}) } : {}) } : o;
  }
  return out;
}

/**
 * An instance's overrides with `patch` on the layer at `keys` — a name path,
 * then one more per nested instance ("Card" → "Label" for the Label of a
 * Card inside a Project info). Cleared values (undefined) come off; an
 * emptied override goes.
 */
export function withOverride(overrides: Record<string, NodeOverride> | undefined, keys: readonly string[], patch: NodeOverride): Record<string, NodeOverride> | undefined {
  const [key, ...rest] = keys;
  const current = { ...(overrides?.[key] ?? {}) } as Record<string, unknown>;
  if (rest.length) current.overrides = withOverride(current.overrides as Record<string, NodeOverride> | undefined, rest, patch);
  else Object.assign(current, patch);
  Object.keys(current).forEach((k) => current[k] === undefined && delete current[k]);
  const next = { ...overrides, [key]: current as NodeOverride };
  if (!Object.keys(current).length) delete next[key];
  return Object.keys(next).length ? next : undefined;
}

/**
 * The layer a composite id names — "instanceId/Kart›Etiket", one "/" more per
 * nested instance ("instanceId/Kart/Etiket") — as it is drawn (its overrides
 * applied), with the instance holding it and the keys its override sits under.
 */
export function layerAt(nodes: readonly SceneNode[], compositeId: string): { instance: FrameNode; node: SceneNode; keys: string[] } | null {
  const slash = compositeId.indexOf("/");
  if (slash < 0) return null;
  const instance = getNode(nodes, compositeId.slice(0, slash));
  if (!instance || instance.type !== "instance") return null;
  const keys = compositeId.slice(slash + 1).split("/");
  let holder: FrameNode | null = resolveInstance(nodes, instance);
  let node: SceneNode | null = null;
  for (let i = 0; i < keys.length && holder; i++) {
    let list: SceneNode[] = holder.children;
    node = null;
    for (const name of keys[i].split(PATH_SEP)) {
      node = list.find((c) => c.name === name) ?? null;
      list = node && isFrameLike(node) ? node.children : [];
    }
    holder = node?.type === "instance" && i < keys.length - 1 ? resolveInstance(nodes, node) : null;
  }
  return node ? { instance, node, keys } : null;
}

/** An instance of `component`, at `x`, `y` — its size the component's. */
export function makeInstance(component: FrameNode, x: number, y: number): FrameNode {
  return {
    ...baseFrame(component.name, x, y, component.width, component.height),
    type: "instance",
    mainId: component.id,
    sizingH: component.sizingH,
    sizingV: component.sizingV,
    fills: [],
    strokes: [],
    layoutMode: component.layoutMode,
  };
}

/** Where a main component's overridable layers sit: the names an instance's overrides are keyed by. */
export function overridableLayers(component: FrameNode): { key: string; node: SceneNode }[] {
  const out: { key: string; node: SceneNode }[] = [];
  const visit = (list: SceneNode[], path: string) => {
    for (const child of list) {
      const key = path ? `${path}${PATH_SEP}${child.name}` : child.name;
      out.push({ key, node: child });
      if (isFrameLike(child) && child.type !== "instance") visit(child.children, key);
    }
  };
  visit(component.children, "");
  return out;
}

// ── Variables ─────────────────────────────────────────────────────────────────

export const byIdMap = (variables: readonly DesignVariable[]) => new Map(variables.map((v) => [v.id, v]));

/** A value's own number (a bound one resolved, in the light theme) — for the editor's arithmetic. */
export function numberOf(value: VariableValue | undefined, byId: Map<string, DesignVariable>, fallback = 0): number {
  if (!value) return fallback;
  if (!("alias" in value)) return Number(value.value) || 0;
  const v = byId.get(value.alias);
  if (!v) return fallback;
  const seen = new Set<string>();
  let current: VariableValue = v.light;
  while ("alias" in current) {
    if (seen.has(current.alias)) return fallback;
    seen.add(current.alias);
    const next = byId.get(current.alias);
    if (!next) return fallback;
    current = next.light;
  }
  return Number(current.value) || 0;
}
