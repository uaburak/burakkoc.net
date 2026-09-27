"use client";

import { createContext, useContext } from "react";
import type { BlockType, ComponentDesigns, GridSettings, ItemTextField, Sizing, TextLayerDesign } from "@/types/project";
import type { DesignAtom } from "@/types/design";
import { useDesignAtoms } from "./designAtoms";

/**
 * The main components (see ComponentDesign): one design per type, shared by
 * every instance on every page. The renderers read it from
 * ComponentDesignContext; what isn't set keeps the type's built-in look.
 */

/**
 * The built-in look of each type's inside — exactly what it was before it
 * could be changed, so pages only change once a main component is edited.
 */
const BUILT_IN: ComponentDesigns = {
  // Proje Künyesi: two columns of cards 10px apart; a card: its label (Etiket) over its value (Değer), 12 / 16px in, 2px apart.
  info: {
    layout: { columnTracks: [{ size: "fill" }, { size: "fill" }], columnGap: 10, rowGap: 10 },
    item: { layout: { flow: "vertical", paddingX: 16, paddingY: 12, rowGap: 2 }, size: { height: "fill" } },
    texts: { label: { atom: "label" }, value: { atom: "value" } },
  },
};

/** Types whose inside is laid out by their main component (the others keep their built-in look for now). */
export const DESIGNED_TYPES: ReadonlySet<BlockType> = new Set<BlockType>(["info"]);

export interface ResolvedDesign {
  layout: GridSettings;
  item: { layout: GridSettings; size?: Sizing };
  texts: Partial<Record<ItemTextField, TextLayerDesign>>;
}

/**
 * A type's main component: what is set, over its built-in look. A text layer
 * whose atom is not among `atoms` (deleted) gets its built-in one back.
 */
export function resolveDesign(type: BlockType, designs: ComponentDesigns, atoms?: readonly DesignAtom[]): ResolvedDesign {
  const base = BUILT_IN[type] ?? {};
  const set = designs[type] ?? {};
  const fields = new Set([...Object.keys(base.texts ?? {}), ...Object.keys(set.texts ?? {})] as ItemTextField[]);
  const texts: ResolvedDesign["texts"] = {};
  for (const field of fields) {
    const layer = { ...base.texts?.[field], ...set.texts?.[field] };
    if (atoms && layer.atom && !atoms.some((a) => a.id === layer.atom)) layer.atom = base.texts?.[field]?.atom;
    texts[field] = layer;
  }
  return {
    layout: set.layout ?? base.layout ?? {},
    item: { layout: set.item?.layout ?? base.item?.layout ?? {}, size: set.item?.size ?? base.item?.size },
    texts,
  };
}

/** Where the site's atoms are used: each main component's text layers bound to one, by atom. */
export function atomUses(designs: ComponentDesigns, atoms: readonly DesignAtom[]): Map<string, { type: BlockType; field: ItemTextField }[]> {
  const uses = new Map<string, { type: BlockType; field: ItemTextField }[]>();
  for (const type of DESIGNED_TYPES) {
    const { texts } = resolveDesign(type, designs, atoms);
    for (const [field, layer] of Object.entries(texts) as [ItemTextField, TextLayerDesign][]) {
      if (layer.atom) uses.set(layer.atom, [...(uses.get(layer.atom) ?? []), { type, field }]);
    }
  }
  return uses;
}

/** The site's main components — the editor's working copy while editing. */
export const ComponentDesignContext = createContext<ComponentDesigns>({});

export function useComponentDesign(type: BlockType): ResolvedDesign {
  return resolveDesign(type, useContext(ComponentDesignContext), useDesignAtoms());
}
