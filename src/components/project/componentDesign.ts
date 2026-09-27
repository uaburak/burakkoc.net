"use client";

import { createContext, useContext } from "react";
import type { BlockType, ComponentDesigns, GridSettings, ItemTextField, Sizing } from "@/types/project";
import type { DesignAtom, DesignMolecule, MoleculeSlot } from "@/types/design";
import { useDesignAtoms } from "./designAtoms";
import { STARTING_MOLECULES, useDesignMolecules } from "./designMolecules";

/**
 * The main components (see ComponentDesign): one design per type, shared by
 * every instance on every page — its frame, and the molecule its items are.
 * The renderers read it from ComponentDesignContext; what isn't set keeps the
 * type's built-in look.
 */

/**
 * The built-in look of each type's inside — exactly what it was before it
 * could be changed, so pages only change once a main component is edited.
 */
const BUILT_IN: ComponentDesigns = {
  // Proje Künyesi: two columns of Kart's 10px apart, each as tall as its row.
  info: {
    layout: { columnTracks: [{ size: "fill" }, { size: "fill" }], columnGap: 10, rowGap: 10 },
    item: { molecule: "card", size: { height: "fill" } },
  },
};

/** Types whose inside is laid out by their main component, their items a molecule's instances (the others keep their built-in look for now). */
export const DESIGNED_TYPES: ReadonlySet<BlockType> = new Set<BlockType>(["info"]);

/** The texts a type's items have (see BlockEntry). */
const ITEM_TEXTS: Partial<Record<BlockType, ItemTextField[]>> = { info: ["label", "value"] };

/** Can a type's items be that molecule — do its slots show only texts they have? */
export function fitsType(molecule: DesignMolecule, type: BlockType) {
  const texts = ITEM_TEXTS[type] ?? [];
  return molecule.slots.every((slot) => texts.includes(slot.field));
}

export interface ResolvedDesign {
  /** The component's frame: how it lays out its items */
  layout: GridSettings;
  /** Its items: the molecule they are, and their size in the component */
  item: { molecule: DesignMolecule; size?: Sizing };
}

/** The atom a slot showing that text starts with (a starting molecule's), for one whose atom is gone. */
function startingAtom(field: ItemTextField) {
  return STARTING_MOLECULES.flatMap((m) => m.slots).find((slot) => slot.field === field)?.atom ?? "text";
}

/**
 * A type's main component: what is set, over its built-in look. Its items'
 * molecule is the one set — its own one when that is gone — and a slot whose
 * atom is not among `atoms` (deleted) gets a starting one back.
 */
export function resolveDesign(type: BlockType, designs: ComponentDesigns, molecules: readonly DesignMolecule[], atoms?: readonly DesignAtom[]): ResolvedDesign {
  const base = BUILT_IN[type] ?? {};
  const set = designs[type] ?? {};
  const find = (id?: string) => (id ? molecules.find((m) => m.id === id) ?? STARTING_MOLECULES.find((m) => m.id === id) : undefined);
  const molecule = find(set.item?.molecule) ?? find(base.item?.molecule) ?? STARTING_MOLECULES[0];
  const known = (slot: MoleculeSlot) => !atoms || !slot.atom || atoms.some((a) => a.id === slot.atom);
  return {
    layout: set.layout ?? base.layout ?? {},
    item: {
      molecule: molecule.slots.every(known) ? molecule : { ...molecule, slots: molecule.slots.map((slot) => (known(slot) ? slot : { ...slot, atom: startingAtom(slot.field) })) },
      size: set.item?.size ?? base.item?.size,
    },
  };
}

/** Where the molecules are used: the types whose items are one, by molecule. */
export function moleculeUses(designs: ComponentDesigns, molecules: readonly DesignMolecule[]): Map<string, BlockType[]> {
  const uses = new Map<string, BlockType[]>();
  for (const type of DESIGNED_TYPES) {
    const { id } = resolveDesign(type, designs, molecules).item.molecule;
    uses.set(id, [...(uses.get(id) ?? []), type]);
  }
  return uses;
}

/** The site's main components — the editor's working copy while editing. */
export const ComponentDesignContext = createContext<ComponentDesigns>({});

export function useComponentDesign(type: BlockType): ResolvedDesign {
  return resolveDesign(type, useContext(ComponentDesignContext), useDesignMolecules(), useDesignAtoms());
}
