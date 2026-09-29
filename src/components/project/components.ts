"use client";

import { createContext, useContext } from "react";
import type { Block, BlockEntry, BlockType, GridSettings } from "@/types/project";
import type { ComponentLayer, DesignComponent, DesignVariable, FrameLayer, FrameLook, InstanceLayer, InstanceOverrides, SpacingKey, TextField, TextLayer, TextStyle } from "@/types/design";
import { resolvedValue, useDesignVariables } from "./designVariables";
import { startingStyle, useTextStyles } from "./textStyles";
import { STARTING_COMPONENTS } from "./startingComponents";

export { STARTING_COMPONENTS };

/**
 * The site's components (see DesignComponent): the starting ones — the frames
 * the site's cards already have — and the ones added in the editor (copies of
 * another, to change). An instance on the page is drawn from its main
 * component with its overrides over it (resolveInstance); what isn't set keeps
 * the type's built-in look.
 */

/** Every kind of layer the page holds is an instance of a main component. */
export const DESIGNED_TYPES: ReadonlySet<BlockType> = new Set<BlockType>(STARTING_COMPONENTS.flatMap((c) => (c.type ? [c.type] : [])));

/** The texts a type's items have (see BlockEntry, ListItem) — the ones a component its items are can show. */
const ITEM_TEXTS: Partial<Record<BlockType, TextField[]>> = {
  info: ["label", "value"],
  list: ["text"],
  stats: ["value", "label"],
  cards: ["eyebrow", "title", "text"],
  steps: ["title", "eyebrow", "text"],
  accordion: ["title", "text"],
  links: ["label"],
  tags: ["label"],
  team: ["title", "text"],
  palette: ["label", "value", "text"],
  persona: ["label", "text"],
  gallery: ["caption"],
  bars: ["label", "value", "text"],
};

// ── Layers ────────────────────────────────────────────────────────────────────

/** Every layer of a component, frames' layers included, depth first. */
export function allLayers(layers: readonly ComponentLayer[]): ComponentLayer[] {
  return layers.flatMap((layer) => (layer.kind === "frame" ? [layer, ...allLayers(layer.layers)] : [layer]));
}

/** A component's text layers, wherever they are in it. */
export const textLayersOf = (component: Pick<DesignComponent, "layers">) => allLayers(component.layers).filter((l): l is TextLayer => l.kind === "text");

/** A layer of a component, by id (wherever it is). */
export const findLayer = (component: Pick<DesignComponent, "layers">, id: string) => allLayers(component.layers).find((l) => l.id === id) ?? null;

/** The component with layer `id` changed by `update` (wherever it is). */
export function updateLayer<C extends { layers: ComponentLayer[] }>(component: C, id: string, update: (layer: ComponentLayer) => ComponentLayer): C {
  const walk = (layers: ComponentLayer[]): ComponentLayer[] =>
    layers.map((layer) => (layer.id === id ? update(layer) : layer.kind === "frame" ? { ...layer, layers: walk(layer.layers) } : layer));
  return { ...component, layers: walk(component.layers) };
}

/** `layer` put at the end of frame `frameId` (null: the holder's own layers). */
export function insertLayer<C extends { layers: ComponentLayer[] }>(holder: C, frameId: string | null, layer: ComponentLayer): C {
  if (!frameId) return { ...holder, layers: [...holder.layers, layer] };
  return updateLayer(holder, frameId, (frame) => (frame.kind === "frame" ? { ...frame, layers: [...frame.layers, layer] } : frame));
}

/** The holder without layer `id` (wherever it is). */
export function removeLayer<C extends { layers: ComponentLayer[] }>(holder: C, id: string): C {
  const walk = (layers: ComponentLayer[]): ComponentLayer[] =>
    layers.filter((layer) => layer.id !== id).map((layer) => (layer.kind === "frame" ? { ...layer, layers: walk(layer.layers) } : layer));
  return { ...holder, layers: walk(holder.layers) };
}

/** The holder with `layer` right after layer `afterId` (in the frame holding it). */
export function insertLayerAfter<C extends { layers: ComponentLayer[] }>(holder: C, afterId: string, layer: ComponentLayer): C {
  const walk = (layers: ComponentLayer[]): ComponentLayer[] =>
    layers.flatMap((l) => (l.id === afterId ? [l, layer] : [l.kind === "frame" ? { ...l, layers: walk(l.layers) } : l]));
  return { ...holder, layers: walk(holder.layers) };
}

/** A layer and its frames' layers with fresh ids (a copy — see freshId). */
export function withFreshIds(layer: ComponentLayer, freshId: () => string): ComponentLayer {
  return layer.kind === "frame" ? { ...layer, id: freshId(), layers: layer.layers.map((l) => withFreshIds(l, freshId)) } : { ...layer, id: freshId() };
}

/** The instances a component repeats, one per item, and the frame holding them (null: the component's own). */
export function findRepeat(component: Pick<DesignComponent, "layers">): { layer: InstanceLayer; frame: FrameLayer | null } | null {
  const walk = (layers: readonly ComponentLayer[], frame: FrameLayer | null): { layer: InstanceLayer; frame: FrameLayer | null } | null => {
    for (const layer of layers) {
      if (layer.kind === "instance") return { layer, frame };
      if (layer.kind === "frame") {
        const found = walk(layer.layers, layer);
        if (found) return found;
      }
    }
    return null;
  };
  return walk(component.layers, null);
}

/** The path of frames down to layer `id`: the component's own frame first (null), then each frame holding it. */
export function layerPath(component: Pick<DesignComponent, "layers">, id: string): (FrameLayer | null)[] | null {
  const walk = (layers: readonly ComponentLayer[], path: (FrameLayer | null)[]): (FrameLayer | null)[] | null => {
    for (const layer of layers) {
      if (layer.id === id) return path;
      if (layer.kind === "frame") {
        const found = walk(layer.layers, [...path, layer]);
        if (found) return found;
      }
    }
    return null;
  };
  return walk(component.layers, [null]);
}

export const isStartingComponent = (id: string) => STARTING_COMPONENTS.some((c) => c.id === id);

/** The site's components: the starting ones — as stored, when changed — in their place, then the added ones. */
export function withStartingComponents(stored: DesignComponent[]): DesignComponent[] {
  const byId = new Map(stored.map((c) => [c.id, c]));
  return [...STARTING_COMPONENTS.map((c) => byId.get(c.id) ?? c), ...stored.filter((c) => !isStartingComponent(c.id))];
}

/** A copy of a component, under its own id and name — to change without changing the one it came from (a variant's: a component of its own, in no set). */
export function copyComponent(component: DesignComponent, id: string, name: string): DesignComponent {
  const { set: _set, variant: _variant, ...copy } = structuredClone(component);
  void _set;
  void _variant;
  return { ...copy, id, name };
}

// ── Variants (Figma's component sets) ─────────────────────────────────────────

/** The id of the component set a component is in: its first variant's — its own id when it is that one, or in none. */
export const setIdOf = (component: Pick<DesignComponent, "id" | "set">) => component.set ?? component.id;

/** A component set's variants, its first one first — none when there is no such component. */
export function variantsOf(setId: string, components: readonly DesignComponent[]): DesignComponent[] {
  const first = components.find((c) => c.id === setId);
  return first ? [first, ...components.filter((c) => c.set === setId && c.id !== setId)] : [];
}

/** Is it a component set — the first of its variants (it has values of its properties, or others name it)? */
export const isComponentSet = (component: DesignComponent, components: readonly DesignComponent[]) =>
  !component.set && (Boolean(component.variant?.length) || components.some((c) => c.set === component.id));

/** Is it one of a component set's variants (its first one too)? */
export const isVariant = (component: DesignComponent, components: readonly DesignComponent[]) =>
  Boolean(component.set && components.some((c) => c.id === component.set)) || isComponentSet(component, components);

/** The components shown on their own — a set once, as its first variant (a variant whose set is gone shows on its own too). */
export const topComponents = (components: readonly DesignComponent[]) => components.filter((c) => !c.set || !components.some((o) => o.id === c.set));

/** A variant's value of a property ("" when it has none). */
export const variantValue = (component: Pick<DesignComponent, "variant">, property: string) => component.variant?.find((v) => v.property === property)?.value ?? "";

/** A variant's values with `property` set to `value` — at the end when it had none. */
export function withVariantValue(values: readonly { property: string; value: string }[] = [], property: string, value: string) {
  return values.some((v) => v.property === property) ? values.map((v) => (v.property === property ? { property, value } : v)) : [...values, { property, value }];
}

/** A variant's name, as Figma's: its values — "Durum=Vurgulu, Boyut=Büyük" — or its component's name when it has none. */
export const variantName = (component: Pick<DesignComponent, "name" | "variant">) =>
  component.variant?.length ? component.variant.map((v) => `${v.property}=${v.value}`).join(", ") : component.name;

/** "Durum=Vurgulu, Boyut=Büyük" as values — null when it isn't that. */
export function parseVariantName(name: string): { property: string; value: string }[] | null {
  const pairs = name.split(",").map((part) => part.split("=").map((s) => s.trim()));
  if (!pairs.every((p) => p.length === 2 && p[0] && p[1])) return null;
  return pairs.map(([property, value]) => ({ property, value }));
}

/** A property of a component set (Figma's variant property): its name and the values its variants have, in their order. */
export interface VariantProperty {
  name: string;
  values: string[];
}

/** A set's properties: its variants' ones, in the order they first have them. */
export function variantProperties(variants: readonly DesignComponent[]): VariantProperty[] {
  const properties = new Map<string, string[]>();
  for (const variant of variants) {
    for (const { property, value } of variant.variant ?? []) {
      const values = properties.get(property) ?? [];
      if (!values.includes(value)) values.push(value);
      properties.set(property, values);
    }
  }
  return [...properties].map(([name, values]) => ({ name, values }));
}

/**
 * The variant an instance becomes when one of its properties is set to
 * `value`, as in Figma: the one with that value and the instance's other
 * values — else the one with that value sharing the most of them.
 */
export function pickVariant(current: DesignComponent, property: string, value: string, variants: readonly DesignComponent[]): DesignComponent {
  const wanted = withVariantValue(current.variant, property, value);
  const shared = (c: DesignComponent) => wanted.filter((w) => variantValue(c, w.property) === w.value).length;
  return variants.filter((c) => variantValue(c, property) === value).sort((a, b) => shared(b) - shared(a))[0] ?? current;
}

/** Do two variants of a set have the same values (Figma's conflicting variants)? */
export const sameValues = (a: DesignComponent, b: DesignComponent, properties: readonly VariantProperty[]) =>
  properties.every((p) => variantValue(a, p.name) === variantValue(b, p.name));

/** `base n`, `base n+1`… — the first one not `taken`, from `from`. */
function freeLabel(base: string, taken: readonly string[], from: number) {
  let n = from;
  while (taken.includes(`${base} ${n}`)) n++;
  return `${base} ${n}`;
}

/**
 * A new variant of `from`'s set — a copy of it, with a value of the set's
 * first property no other has ("Varyant 3"), as Figma's "Add variant". A
 * component in no set becomes one: it gets the first property ("Özellik 1 =
 * Varsayılan") and the copy its "Varyant 2". Returns what changed: the
 * components to store.
 */
export function withNewVariant(from: DesignComponent, components: readonly DesignComponent[], id: string): DesignComponent[] {
  const setId = setIdOf(from);
  const variants = variantsOf(setId, components);
  const copy = (base: DesignComponent, variant: DesignComponent["variant"]): DesignComponent => {
    const { set: _set, ...rest } = structuredClone(base);
    void _set;
    return { ...rest, id, set: setId, variant };
  };
  if (!isVariant(from, components)) {
    const first: DesignComponent = { ...from, variant: [{ property: "Özellik 1", value: "Varsayılan" }] };
    return [first, copy(first, [{ property: "Özellik 1", value: "Varyant 2" }])];
  }
  const [property] = variantProperties(variants);
  if (!property) {
    // A set whose values are gone: its first property again, each variant a value of its own.
    const named = variants.map((v, i) => ({ ...v, variant: [{ property: "Özellik 1", value: i === 0 ? "Varsayılan" : `Varyant ${i + 1}` }] }));
    return [...named, copy(from, [{ property: "Özellik 1", value: `Varyant ${variants.length + 1}` }])];
  }
  return [copy(from, withVariantValue(from.variant, property.name, freeLabel("Varyant", property.values, variants.length + 1)))];
}

/** A set with a property more (Figma's "Create component property" › Variant): every variant has its value "Varsayılan". */
export function withNewProperty(variants: readonly DesignComponent[]): DesignComponent[] {
  const name = freeLabel("Özellik", variantProperties(variants).map((p) => p.name), variantProperties(variants).length + 1);
  return variants.map((v) => ({ ...v, variant: [...(v.variant ?? []), { property: name, value: "Varsayılan" }] }));
}

/** A property renamed on every variant — none when the name is taken. */
export function withPropertyRenamed(variants: readonly DesignComponent[], from: string, to: string): DesignComponent[] {
  const name = to.trim();
  if (!name || name === from || variantProperties(variants).some((p) => p.name === name)) return [];
  return variants.map((v) => ({ ...v, variant: v.variant?.map((p) => (p.property === from ? { property: name, value: p.value } : p)) }));
}

/** A property taken off every variant. */
export const withoutProperty = (variants: readonly DesignComponent[], property: string): DesignComponent[] =>
  variants.map((v) => ({ ...v, variant: v.variant?.filter((p) => p.property !== property) }));

/** A value of a property renamed on every variant that has it (Figma renames it across the set). */
export function withValueRenamed(variants: readonly DesignComponent[], property: string, from: string, to: string): DesignComponent[] {
  const value = to.trim();
  if (!value || value === from) return [];
  return variants.filter((v) => variantValue(v, property) === from).map((v) => ({ ...v, variant: withVariantValue(v.variant, property, value) }));
}

/** A set renamed: every variant has its name. */
export const withSetName = (variants: readonly DesignComponent[], name: string): DesignComponent[] => variants.map((v) => ({ ...v, name }));

/**
 * A variant taken out of its set: its id to remove, and the others that
 * change — the set's first variant gone, the next one is the set.
 */
export function withoutVariant(variant: DesignComponent, components: readonly DesignComponent[]): { remove: string[]; update: DesignComponent[] } {
  const setId = setIdOf(variant);
  if (variant.id !== setId) return { remove: [variant.id], update: [] };
  const [next, ...others] = variantsOf(setId, components).slice(1);
  if (!next) return { remove: [variant.id], update: [] };
  const { set: _set, ...promoted } = next;
  void _set;
  return { remove: [variant.id], update: [promoted, ...others.map((o) => ({ ...o, set: next.id }))] };
}

/** A copy of a whole set under new ids (`newId` for each) — named "`name`". */
export function copySet(variants: readonly DesignComponent[], name: string, newId: () => string): DesignComponent[] {
  const setId = newId();
  return variants.map((v, i) => {
    const { set: _set, ...rest } = structuredClone(v);
    void _set;
    return i === 0 ? { ...rest, id: setId, name } : { ...rest, id: newId(), name, set: setId };
  });
}

const LOOK_KEYS = ["hidden", "blend", "opacity", "radius", "corners", "fill", "stroke", "clip"] as const satisfies readonly (keyof FrameLook)[];

/** Only the values that are set. */
function defined<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as Partial<T>;
}

/** Is anything set in it? */
const isSet = (value?: object) => Boolean(value && Object.values(value).some((v) => v !== undefined));

/** A component's frame's look (its FrameLook values) — or a frame's inside it. */
export function componentLook(component: FrameLook): FrameLook {
  return defined(Object.fromEntries(LOOK_KEYS.map((key) => [key, component[key]])) as FrameLook);
}

/** Its layout with the spacing bound to variables at their values — a component's, or a frame's inside it. */
export function componentLayout(component: Pick<DesignComponent, "layout" | "spacing">, byId: Map<string, DesignVariable>): GridSettings {
  const layout: GridSettings = { ...component.layout };
  for (const [key, id] of Object.entries(component.spacing ?? {}) as [SpacingKey, string][]) {
    const variable = byId.get(id);
    const value = variable ? Number(resolvedValue(variable, "light", byId)) : NaN;
    if (Number.isFinite(value)) layout[key] = value;
  }
  return layout;
}

/**
 * The main component an instance of that type is: the one it was swapped to
 * (when it is one of that type), else the type's own — null for a type the
 * site's code draws.
 */
export function mainComponent(type: BlockType, components: readonly DesignComponent[], id?: string): DesignComponent | null {
  if (!DESIGNED_TYPES.has(type)) return null;
  const ofType = components.filter((c) => c.type === type);
  return ofType.find((c) => c.id === id) ?? ofType.find((c) => isStartingComponent(c.id)) ?? ofType[0] ?? STARTING_COMPONENTS.find((c) => c.type === type) ?? null;
}

/** The component an instance layer repeats — its starting one when that one is gone. */
export function layerComponent(layer: InstanceLayer, components: readonly DesignComponent[]): DesignComponent {
  return (
    components.find((c) => c.id === layer.component) ??
    STARTING_COMPONENTS.find((c) => c.id === layer.component) ??
    STARTING_COMPONENTS.find((c) => c.id === "card")!
  );
}

/** Can a type's items be instances of that component — does it repeat nothing, and do its texts show only texts they have? */
export function fitsItems(component: DesignComponent, type: BlockType) {
  const texts = ITEM_TEXTS[type] ?? [];
  return !component.type && !findRepeat(component) && textLayersOf(component).every((layer) => texts.includes(layer.field));
}

/** The components an instance of that type can be swapped to — a set once, as its first variant (its properties pick the others). */
export const swapsFor = (type: BlockType, components: readonly DesignComponent[]) => topComponents(components).filter((c) => c.type === type);

/** A component an item can be, drawn: its texts' styles known, its frame's auto layout (bound spacing at its values) and look. */
export interface ResolvedVariant {
  component: DesignComponent;
  layout: GridSettings;
  look: FrameLook;
}

export interface ResolvedItem extends ResolvedVariant {
  /** The instance layer repeating it */
  layer: InstanceLayer;
  /** The frame holding the instances — null: the component's own */
  frame: FrameLayer | null;
  /** Its component (the layer's) and, in a component set, its set's other variants — the ones an item can be (BlockEntry.component) */
  variants: ResolvedVariant[];
}

export interface ResolvedInstance {
  main: DesignComponent;
  /** The main one's own frame — what the instance's overrides are measured against */
  base: { layout: GridSettings; look: FrameLook };
  /** Its frame: the main one's auto layout (bound spacing at its values), the instance's own values over it */
  layout: GridSettings;
  /** …and its look */
  look: FrameLook;
  /** The instances it repeats, one per item — null when it repeats none */
  item: ResolvedItem | null;
  /** Is this one of the site's text styles (a gone one isn't)? */
  knownStyle: (id?: string) => boolean;
}

/**
 * An instance: its main component with its overrides over it — the main
 * one's auto layout and look with the instance's own values (Block.layout,
 * Block.look) over them, and the component it repeats. A text layer whose
 * style is gone gets its field's starting style back. Null for a type the
 * site's code draws.
 */
export function resolveInstance(
  block: Pick<Block, "type" | "component" | "layout" | "look" | "columns">,
  components: readonly DesignComponent[],
  variables: DesignVariable[],
  styles?: readonly TextStyle[]
): ResolvedInstance | null {
  const main = mainComponent(block.type, components, block.component);
  if (!main) return null;
  const byId = new Map(variables.map((v) => [v.id, v]));
  const knownStyle = (id?: string) => Boolean(id) && (!styles || styles.some((s) => s.id === id));
  const withStyles = (component: DesignComponent): DesignComponent =>
    textLayersOf(component).every((layer) => knownStyle(layer.style))
      ? component
      : { ...component, layers: textLayersOf(component).reduce<ComponentLayer[]>((layers, layer) => (knownStyle(layer.style) ? layers : updateLayer({ layers }, layer.id, () => ({ ...layer, style: startingStyle(layer.field) })).layers), component.layers) };
  const repeat = findRepeat(main);
  const resolve = (component: DesignComponent): ResolvedVariant => {
    const styled = withStyles(component);
    return { component: styled, layout: componentLayout(styled, byId), look: componentLook(styled) };
  };
  const repeated = repeat ? layerComponent(repeat.layer, components) : null;
  const siblings = repeated ? variantsOf(setIdOf(repeated), components) : [];
  const variants = repeated ? (siblings.some((c) => c.id === repeated.id) ? siblings : [repeated]).map(resolve) : [];
  const own = variants.find((v) => v.component.id === repeated?.id);
  const base = { layout: componentLayout(main, byId), look: componentLook(main) };
  // Its items' columns (a property of the instance, see Block.columns), when the component's own frame holds them.
  const columns = repeat && !repeat.frame && block.columns ? withColumns(base.layout, block.columns) : base.layout;
  return {
    main: withStyles(main),
    base,
    layout: { ...columns, ...block.layout },
    look: { ...base.look, ...defined(block.look ?? {}) },
    item: repeat && own ? { ...own, layer: repeat.layer, frame: repeat.frame, variants } : null,
    knownStyle,
  };
}

/** A layout with `count` even Fill columns (a grid — its items' columns set on the instance). */
export function withColumns(layout: GridSettings, count: number): GridSettings {
  return { ...layout, flow: undefined, columns: undefined, columnTracks: Array.from({ length: count }, () => ({ size: "fill" as const })) };
}

/**
 * An item of an instance — one of the instances it repeats: the variant it is
 * (its own, or the layer's component), with its overrides over it.
 */
export function resolveItem(item: ResolvedItem, entry: Pick<BlockEntry, "overrides" | "component"> | undefined, knownStyle: (id?: string) => boolean) {
  const variant = item.variants.find((v) => v.component.id === entry?.component) ?? item;
  const overrides = entry?.overrides;
  return {
    /** The component it is — the variant it was set to */
    component: variant.component,
    /** Its component's own frame: what its overrides are measured against */
    base: { layout: variant.layout, look: variant.look },
    layout: { ...variant.layout, ...overrides?.layout },
    look: { ...variant.look, ...defined(overrides?.look ?? {}) },
    size: overrides?.size ?? item.layer.size,
    /** A text layer's style in this item: its own one, over the layer's */
    style: (layer: TextLayer) => {
      const own = overrides?.styles?.[layer.field];
      return own && knownStyle(own) ? own : layer.style;
    },
  };
}

/**
 * The look an instance's box on the page gets: one drawn from its main
 * component draws its look on its frame (see InstanceView) — its box only
 * hides with it.
 */
export function boxLook(block: Pick<Block, "type" | "look">): FrameLook | undefined {
  if (!DESIGNED_TYPES.has(block.type)) return block.look;
  return block.look?.hidden ? { hidden: true } : undefined;
}

// ── Overrides (Figma's "Reset all changes", "Push changes to main component") ─

/** Are two values the same (data, compared as JSON)? */
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * What a frame's auto layout set to `next` changes of `base` — only the values
 * that differ, as an instance's overrides. A value `next` lets go of stays as
 * the value that means nothing is set (no wrap, one Fill column…), so the
 * main one's doesn't come back. Undefined when nothing differs.
 */
export function layoutOverride(base: GridSettings, next: GridSettings): GridSettings | undefined {
  const unset: Partial<Record<keyof GridSettings, unknown>> = {
    flow: "grid",
    spread: false,
    wrap: false,
    columns: [],
    columnTracks: [{ size: "fill" }],
    rowTracks: [],
    rows: 0,
    gap: "md",
    columnGap: 16,
    rowGap: 16,
    paddingX: 0,
    paddingY: 0,
    paddingTop: 0,
    paddingRight: 0,
    paddingBottom: 0,
    paddingLeft: 0,
    justify: "start",
    align: "start",
  };
  const out: Record<string, unknown> = {};
  for (const key of new Set([...Object.keys(base), ...Object.keys(next)]) as Set<keyof GridSettings>) {
    const value = next[key] ?? (base[key] !== undefined ? unset[key] : undefined);
    if (value !== undefined && !same(value, base[key])) out[key] = value;
  }
  return Object.keys(out).length > 0 ? (out as GridSettings) : undefined;
}

/**
 * The same for a frame's look: only what differs from `base`. A fill or
 * stroke `next` removes stays as a hidden one, corners given one by one and
 * then let go of as the radius on each (see radiusCss). Its `hidden` is the
 * layer's own: it stays as set.
 */
export function lookOverride(base: FrameLook, next: FrameLook): FrameLook | undefined {
  const radius = next.radius ?? { value: 0 };
  const unset: Partial<Record<keyof FrameLook, unknown>> = {
    blend: "pass-through",
    opacity: 100,
    radius: { value: 0 },
    corners: [radius, radius, radius, radius],
    fill: { color: { value: "#000000" }, hidden: true },
    stroke: { color: { value: "#000000" }, weight: { value: 0 }, align: "inside", hidden: true },
    clip: false,
  };
  const out: Record<string, unknown> = {};
  for (const key of new Set([...Object.keys(base), ...Object.keys(next)]) as Set<keyof FrameLook>) {
    if (key === "hidden") {
      if (next.hidden) out.hidden = true;
      continue;
    }
    const value = next[key] ?? (base[key] !== undefined ? unset[key] : undefined);
    if (value !== undefined && !same(value, base[key])) out[key] = value;
  }
  return Object.keys(out).length > 0 ? (out as FrameLook) : undefined;
}

/** An item's size set to `next`: its own only when it differs from the one its layer gives it. */
export const sizeOverride = (base: InstanceLayer["size"], next: InstanceLayer["size"]) => (same(base ?? {}, next ?? {}) ? undefined : next);

/** Overrides with nothing left in them are none at all. */
export function cleanOverrides(overrides: InstanceOverrides): InstanceOverrides | undefined {
  const styles = overrides.styles && Object.fromEntries(Object.entries(overrides.styles).filter(([, v]) => v));
  const out = defined({ ...overrides, styles: styles && Object.keys(styles).length > 0 ? styles : undefined });
  return Object.keys(out).length > 0 ? out : undefined;
}


/** Does an instance change anything of its main component (its look, its auto layout)? */
export const hasOverrides = (block: Pick<Block, "type" | "layout" | "look" | "styles">) =>
  DESIGNED_TYPES.has(block.type) && (isSet(block.layout) || isSet({ ...block.look, hidden: undefined }) || isSet(block.styles));

/** Does an item change anything of its component? */
export const itemHasOverrides = (entry: Pick<BlockEntry, "overrides">) => Boolean(entry.overrides && Object.values(entry.overrides).some((v) => isSet(v)));

/** An instance without its overrides — its look and auto layout its main component's again (hidden stays: that is the layer's). */
export function resetInstance(block: Pick<Block, "look">): Partial<Block> {
  return { layout: undefined, styles: undefined, look: block.look?.hidden ? { hidden: true } : undefined };
}

/** Spacing bound on the main one that an override sets: pushed, the bound variable gives way to the value. */
function unbind(spacing: DesignComponent["spacing"], layout?: GridSettings) {
  if (!spacing || !layout) return spacing;
  return Object.fromEntries(Object.entries(spacing).filter(([key]) => (layout as Record<string, unknown>)[key] === undefined));
}

/** The main component with an instance's overrides pushed to it — every instance gets them. */
export function pushInstance(main: DesignComponent, block: Pick<Block, "layout" | "look" | "styles">): DesignComponent {
  const { hidden: _hidden, ...look } = defined(block.look ?? {});
  void _hidden;
  const layers = textLayersOf(main).reduce<ComponentLayer[]>(
    (all, layer) => (block.styles?.[layer.field] ? updateLayer({ layers: all }, layer.id, () => ({ ...layer, style: block.styles![layer.field] })).layers : all),
    main.layers
  );
  return { ...main, ...look, layout: { ...main.layout, ...block.layout }, spacing: unbind(main.spacing, block.layout), layers };
}

/** An item's component with the item's overrides pushed to it (its size goes to the instance layer repeating it — see pushItemSize). */
export function pushItem(component: DesignComponent, overrides: InstanceOverrides): DesignComponent {
  const { hidden: _hidden, ...look } = defined(overrides.look ?? {});
  void _hidden;
  return {
    ...component,
    ...look,
    layout: { ...component.layout, ...overrides.layout },
    spacing: unbind(component.spacing, overrides.layout),
    layers: textLayersOf(component).reduce<ComponentLayer[]>(
      (layers, layer) => (overrides.styles?.[layer.field] ? updateLayer({ layers }, layer.id, () => ({ ...layer, style: overrides.styles![layer.field] })).layers : layers),
      component.layers
    ),
  };
}

// ── Uses ──────────────────────────────────────────────────────────────────────

/** Where each component is used inside others: the instance layers repeating it, by component. */
export function componentUses(components: readonly DesignComponent[]): Map<string, { component: DesignComponent; layer: InstanceLayer }[]> {
  const uses = new Map<string, { component: DesignComponent; layer: InstanceLayer }[]>();
  for (const component of components) {
    for (const layer of allLayers(component.layers)) {
      if (layer.kind === "instance") uses.set(layer.component, [...(uses.get(layer.component) ?? []), { component, layer }]);
    }
  }
  return uses;
}

/** Where each text style is used: the components' text layers in it, by style. */
export function textStyleUses(components: readonly DesignComponent[]): Map<string, { component: DesignComponent; layer: TextLayer }[]> {
  const uses = new Map<string, { component: DesignComponent; layer: TextLayer }[]>();
  for (const component of components) {
    for (const layer of textLayersOf(component)) {
      if (layer.style) uses.set(layer.style, [...(uses.get(layer.style) ?? []), { component, layer }]);
    }
  }
  return uses;
}

// ── Context ───────────────────────────────────────────────────────────────────

/** The site's components — the editor's working copy while editing. */
export const DesignComponentsContext = createContext<DesignComponent[]>(STARTING_COMPONENTS);

export const useDesignComponents = () => useContext(DesignComponentsContext);

/** An instance, resolved with the site's components, variables and text styles (see resolveInstance). */
export function useInstance(block: Pick<Block, "type" | "component" | "layout" | "look" | "columns">): ResolvedInstance | null {
  return resolveInstance(block, useDesignComponents(), useDesignVariables(), useTextStyles());
}
