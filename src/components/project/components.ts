"use client";

import { createContext, useContext, type CSSProperties } from "react";
import type { Block, BlockEntry, BlockType, GridSettings, ItemTextField } from "@/types/project";
import type { DesignComponent, DesignVariable, FrameLook, InstanceLayer, InstanceOverrides, SpacingKey, TextLayer, TextStyle } from "@/types/design";
import { gridFlow } from "@/lib/projectLayout";
import { resolvedValue, useDesignVariables } from "./designVariables";
import { frameLookStyle } from "./frameLook";
import { innerChildStyle, innerLayoutStyle } from "./LayoutGrid";
import { startingStyle, useTextStyles } from "./textStyles";

/**
 * The site's components (see DesignComponent): the starting ones — the frames
 * the site's cards already have — and the ones added in the editor (copies of
 * another, to change). An instance on the page is drawn from its main
 * component with its overrides over it (resolveInstance); what isn't set keeps
 * the type's built-in look.
 */

/**
 * The first components: the Proje Künyesi as it was — two columns of Kart's
 * 10px apart, each as tall as its row — and its Kart: its label (Etiket) over
 * its value (Değer), 12 / 16px in, 2px apart, 22px corners, filled with the
 * bg-4 grey. Pages only change once one of them is edited.
 */
export const STARTING_COMPONENTS: DesignComponent[] = [
  {
    id: "project-info",
    name: "Proje Künyesi",
    type: "info",
    layout: { columnTracks: [{ size: "fill" }, { size: "fill" }], columnGap: 10, rowGap: 10 },
    layers: [{ kind: "instance", id: "item", name: "Kart", component: "card", size: { height: "fill" } }],
  },
  {
    id: "card",
    name: "Kart",
    layout: { flow: "vertical", paddingX: 16, paddingY: 12, rowGap: 2 },
    radius: { alias: "radius-card" },
    fill: { color: { alias: "bg-4" } },
    layers: [
      { kind: "text", id: "label", name: "Etiket", field: "label", style: "label" },
      { kind: "text", id: "value", name: "Değer", field: "value", style: "value" },
    ],
  },
];

/** Types the site's code draws from their main component — the others keep their built-in look for now. */
export const DESIGNED_TYPES: ReadonlySet<BlockType> = new Set<BlockType>(["info"]);

/** The texts a type's items have (see BlockEntry). */
const ITEM_TEXTS: Partial<Record<BlockType, ItemTextField[]>> = { info: ["label", "value"] };

export const isStartingComponent = (id: string) => STARTING_COMPONENTS.some((c) => c.id === id);

/** The site's components: the starting ones — as stored, when changed — in their place, then the added ones. */
export function withStartingComponents(stored: DesignComponent[]): DesignComponent[] {
  const byId = new Map(stored.map((c) => [c.id, c]));
  return [...STARTING_COMPONENTS.map((c) => byId.get(c.id) ?? c), ...stored.filter((c) => !isStartingComponent(c.id))];
}

/** A copy of a component, under its own id and name — to change without changing the one it came from. */
export function copyComponent(component: DesignComponent, id: string, name: string): DesignComponent {
  return { ...structuredClone(component), id, name };
}

const LOOK_KEYS = ["hidden", "blend", "opacity", "radius", "corners", "fill", "stroke", "clip"] as const satisfies readonly (keyof FrameLook)[];

/** Only the values that are set. */
function defined<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as Partial<T>;
}

/** Is anything set in it? */
const isSet = (value?: object) => Boolean(value && Object.values(value).some((v) => v !== undefined));

/** A component's frame's look (its FrameLook values). */
export function componentLook(component: DesignComponent): FrameLook {
  return defined(Object.fromEntries(LOOK_KEYS.map((key) => [key, component[key]])) as FrameLook);
}

/** Its layout with the spacing bound to variables at their values. */
export function componentLayout(component: DesignComponent, byId: Map<string, DesignVariable>): GridSettings {
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

/** The component an instance layer repeats — the starting card when that one is gone. */
export function layerComponent(layer: InstanceLayer, components: readonly DesignComponent[]): DesignComponent {
  return components.find((c) => c.id === layer.component) ?? components.find((c) => c.id === "card") ?? STARTING_COMPONENTS[1];
}

/** Can a type's items be instances of that component — does it repeat nothing, and do its texts show only texts they have? */
export function fitsItems(component: DesignComponent, type: BlockType) {
  const texts = ITEM_TEXTS[type] ?? [];
  return !component.type && component.layers.every((layer) => layer.kind === "text" && texts.includes(layer.field));
}

/** The components an instance of that type can be swapped to. */
export const swapsFor = (type: BlockType, components: readonly DesignComponent[]) => components.filter((c) => c.type === type);

export interface ResolvedItem {
  /** The instance layer repeating it */
  layer: InstanceLayer;
  /** Its main component (its texts' styles known — see resolveInstance) */
  component: DesignComponent;
  /** Its frame's auto layout (bound spacing at its values) */
  layout: GridSettings;
  look: FrameLook;
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
  block: Pick<Block, "type" | "component" | "layout" | "look">,
  components: readonly DesignComponent[],
  variables: DesignVariable[],
  styles?: readonly TextStyle[]
): ResolvedInstance | null {
  const main = mainComponent(block.type, components, block.component);
  if (!main) return null;
  const byId = new Map(variables.map((v) => [v.id, v]));
  const knownStyle = (id?: string) => Boolean(id) && (!styles || styles.some((s) => s.id === id));
  const withStyles = (component: DesignComponent): DesignComponent =>
    component.layers.every((layer) => layer.kind !== "text" || knownStyle(layer.style))
      ? component
      : { ...component, layers: component.layers.map((layer) => (layer.kind !== "text" || knownStyle(layer.style) ? layer : { ...layer, style: startingStyle(layer.field) })) };
  const repeat = main.layers.find((layer): layer is InstanceLayer => layer.kind === "instance");
  const itemComponent = repeat ? withStyles(layerComponent(repeat, components)) : null;
  const base = { layout: componentLayout(main, byId), look: componentLook(main) };
  return {
    main,
    base,
    layout: { ...base.layout, ...block.layout },
    look: { ...base.look, ...defined(block.look ?? {}) },
    item: repeat && itemComponent ? { layer: repeat, component: itemComponent, layout: componentLayout(itemComponent, byId), look: componentLook(itemComponent) } : null,
    knownStyle,
  };
}

/** An item of an instance — one of the instances it repeats — with its overrides over its component. */
export function resolveItem(item: ResolvedItem, overrides: InstanceOverrides | undefined, knownStyle: (id?: string) => boolean) {
  return {
    layout: { ...item.layout, ...overrides?.layout },
    look: { ...item.look, ...defined(overrides?.look ?? {}) },
    size: overrides?.size ?? item.layer.size,
    /** A text layer's style in this item: its own one, over the layer's */
    style: (layer: TextLayer) => {
      const own = overrides?.styles?.[layer.field];
      return own && knownStyle(own) ? own : layer.style;
    },
  };
}

/**
 * An instance drawn as styles, at every width: its frame (its auto layout and
 * look); each item — the item component's frame with the item's overrides, at
 * its size in the frame; each text layer of an item at its size and place in
 * it, in its style. A project's own corner radius (its theme) wins over a
 * component's corners, as over the site's other cards.
 */
export function instanceStyles(instance: ResolvedInstance, variables: DesignVariable[]) {
  const look = (value: FrameLook) => frameLookStyle(value, variables, { projectRadius: true });
  const { item } = instance;
  return {
    frame: { ...innerLayoutStyle(instance.layout), ...look(instance.look) } as CSSProperties,
    item: (entry: Pick<BlockEntry, "overrides">): CSSProperties => {
      if (!item) return {};
      const own = resolveItem(item, entry.overrides, instance.knownStyle);
      return { ...innerLayoutStyle(own.layout), ...look(own.look), ...innerChildStyle(own.size, undefined, gridFlow(instance.layout)) };
    },
    text: (layer: TextLayer, entry: Pick<BlockEntry, "overrides">): { style: CSSProperties; textStyle?: string } => {
      const own = item ? resolveItem(item, entry.overrides, instance.knownStyle) : null;
      return {
        style: {
          ...innerChildStyle(layer.size, layer.align, gridFlow(own?.layout)),
          ...(layer.opacity !== undefined && layer.opacity < 100 ? { opacity: Math.max(0, layer.opacity) / 100 } : {}),
        },
        textStyle: own ? own.style(layer) : layer.style,
      };
    },
  };
}

/**
 * The look an instance's box on the page gets: one drawn from its main
 * component draws its look on its frame (see instanceStyles) — its box only
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
export const hasOverrides = (block: Pick<Block, "type" | "layout" | "look">) =>
  DESIGNED_TYPES.has(block.type) && (isSet(block.layout) || isSet({ ...block.look, hidden: undefined }));

/** Does an item change anything of its component? */
export const itemHasOverrides = (entry: Pick<BlockEntry, "overrides">) => Boolean(entry.overrides && Object.values(entry.overrides).some((v) => isSet(v)));

/** An instance without its overrides — its look and auto layout its main component's again (hidden stays: that is the layer's). */
export function resetInstance(block: Pick<Block, "look">): Partial<Block> {
  return { layout: undefined, look: block.look?.hidden ? { hidden: true } : undefined };
}

/** Spacing bound on the main one that an override sets: pushed, the bound variable gives way to the value. */
function unbind(spacing: DesignComponent["spacing"], layout?: GridSettings) {
  if (!spacing || !layout) return spacing;
  return Object.fromEntries(Object.entries(spacing).filter(([key]) => (layout as Record<string, unknown>)[key] === undefined));
}

/** The main component with an instance's overrides pushed to it — every instance gets them. */
export function pushInstance(main: DesignComponent, block: Pick<Block, "layout" | "look">): DesignComponent {
  const { hidden: _hidden, ...look } = defined(block.look ?? {});
  void _hidden;
  return { ...main, ...look, layout: { ...main.layout, ...block.layout }, spacing: unbind(main.spacing, block.layout) };
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
    layers: component.layers.map((layer) => (layer.kind === "text" && overrides.styles?.[layer.field] ? { ...layer, style: overrides.styles[layer.field] } : layer)),
  };
}

// ── Uses ──────────────────────────────────────────────────────────────────────

/** Where each component is used inside others: the instance layers repeating it, by component. */
export function componentUses(components: readonly DesignComponent[]): Map<string, { component: DesignComponent; layer: InstanceLayer }[]> {
  const uses = new Map<string, { component: DesignComponent; layer: InstanceLayer }[]>();
  for (const component of components) {
    for (const layer of component.layers) {
      if (layer.kind === "instance") uses.set(layer.component, [...(uses.get(layer.component) ?? []), { component, layer }]);
    }
  }
  return uses;
}

/** Where each text style is used: the components' text layers in it, by style. */
export function textStyleUses(components: readonly DesignComponent[]): Map<string, { component: DesignComponent; layer: TextLayer }[]> {
  const uses = new Map<string, { component: DesignComponent; layer: TextLayer }[]>();
  for (const component of components) {
    for (const layer of component.layers) {
      if (layer.kind === "text" && layer.style) uses.set(layer.style, [...(uses.get(layer.style) ?? []), { component, layer }]);
    }
  }
  return uses;
}

// ── Context ───────────────────────────────────────────────────────────────────

/** The site's components — the editor's working copy while editing. */
export const DesignComponentsContext = createContext<DesignComponent[]>(STARTING_COMPONENTS);

export const useDesignComponents = () => useContext(DesignComponentsContext);

/** An instance, resolved with the site's components, variables and text styles (see resolveInstance). */
export function useInstance(block: Pick<Block, "type" | "component" | "layout" | "look">): ResolvedInstance | null {
  return resolveInstance(block, useDesignComponents(), useDesignVariables(), useTextStyles());
}
