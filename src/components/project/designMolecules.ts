"use client";

import { createContext, useContext, type CSSProperties } from "react";
import type { BlockType, ComponentDesigns, GridSettings } from "@/types/project";
import type { DesignMolecule, DesignVariable, MoleculeSlot, SpacingKey } from "@/types/design";
import { cssValue, resolvedValue } from "./designVariables";
import { innerLayoutStyle } from "./LayoutGrid";

/**
 * The site's molecules (see DesignMolecule): the starting ones — the frames
 * the site's cards already have, holding the starting atoms — and the ones
 * added in the editor (copies of another, to change).
 */

/** The Proje Künyesi's card as it was: its label (Etiket) over its value (Değer), 12 / 16px in, 2px apart, 22px corners on the bg-4 grey. */
export const STARTING_MOLECULES: DesignMolecule[] = [
  {
    id: "card",
    name: "Kart",
    layout: { flow: "vertical", paddingX: 16, paddingY: 12, rowGap: 2 },
    radius: { alias: "radius-card" },
    background: { alias: "bg-4" },
    slots: [
      { field: "label", name: "Etiket", atom: "label" },
      { field: "value", name: "Değer", atom: "value" },
    ],
  },
];

/** The site's molecules: the starting ones — as stored, when changed — in their place, then the added ones. */
export function withStartingMolecules(stored: DesignMolecule[]): DesignMolecule[] {
  const byId = new Map(stored.map((m) => [m.id, m]));
  const starting = new Set(STARTING_MOLECULES.map((m) => m.id));
  return [...STARTING_MOLECULES.map((m) => byId.get(m.id) ?? m), ...stored.filter((m) => !starting.has(m.id))];
}

/** A copy of a molecule, under its own id and name — to change without changing the one it came from. */
export function copyMolecule(molecule: DesignMolecule, id: string, name: string): DesignMolecule {
  return { ...structuredClone(molecule), id, name };
}

/** Its layout with the spacing bound to variables at their values. */
export function moleculeLayout(molecule: DesignMolecule, byId: Map<string, DesignVariable>): GridSettings {
  const layout: GridSettings = { ...molecule.layout };
  for (const [key, id] of Object.entries(molecule.spacing ?? {}) as [SpacingKey, string][]) {
    const variable = byId.get(id);
    const value = variable ? Number(resolvedValue(variable, "light", byId)) : NaN;
    if (Number.isFinite(value)) layout[key] = value;
  }
  return layout;
}

/**
 * An instance's frame as styles: its layout (see innerLayoutStyle), corners
 * and background. A project's own corner radius (its theme) wins over the
 * molecule's, as over the site's other cards.
 */
export function moleculeFrameStyle(molecule: DesignMolecule, variables: DesignVariable[]): CSSProperties {
  const byId = new Map(variables.map((v) => [v.id, v]));
  const radius = molecule.radius ? cssValue(molecule.radius, "number", byId) : null;
  const background = molecule.background ? cssValue(molecule.background, "color", byId) : null;
  return {
    ...innerLayoutStyle(moleculeLayout(molecule, byId)),
    borderRadius: radius ? `var(--project-radius-sm, ${radius})` : undefined,
    backgroundColor: background ?? undefined,
  };
}

/** Components that laid out their items themselves before molecules — and the molecule taking that over. */
const LEGACY: Partial<Record<BlockType, string>> = { info: "card" };

/**
 * Before molecules, a component laid out its items itself (its
 * `item.layout` and `texts`). The molecule taking over gets what was set
 * there — while it isn't stored itself — and the component keeps its own
 * part. `migrated`: there was something to move (saving stores the move).
 */
export function migrateLegacyDesigns(designs: ComponentDesigns, stored: DesignMolecule[]): {
  designs: ComponentDesigns;
  molecules: DesignMolecule[];
  migrated: boolean;
} {
  let migrated = false;
  const next: ComponentDesigns = { ...designs };
  const molecules = [...stored];
  for (const [type, id] of Object.entries(LEGACY) as [BlockType, string][]) {
    const design = designs[type];
    if (!design?.item?.layout && !design?.texts) continue;
    migrated = true;
    const { texts, item, ...rest } = design;
    const { layout, ...own } = item ?? {};
    next[type] = { ...rest, ...(Object.keys(own).length > 0 ? { item: own } : {}) };
    const base = STARTING_MOLECULES.find((m) => m.id === id);
    if (!base || stored.some((m) => m.id === id)) continue;
    molecules.push({
      ...base,
      layout: layout ?? base.layout,
      slots: base.slots.map((slot) => ({ ...slot, ...texts?.[slot.field] })),
    });
  }
  return { designs: next, molecules, migrated };
}

/** The site's molecules — the editor's working copy while editing. */
export const DesignMoleculesContext = createContext<DesignMolecule[]>(STARTING_MOLECULES);

export const useDesignMolecules = () => useContext(DesignMoleculesContext);

/** Where the atoms are used: the molecules' slots holding one, by atom. */
export function atomUses(molecules: readonly DesignMolecule[]): Map<string, { molecule: DesignMolecule; slot: MoleculeSlot }[]> {
  const uses = new Map<string, { molecule: DesignMolecule; slot: MoleculeSlot }[]>();
  for (const molecule of molecules) {
    for (const slot of molecule.slots) {
      if (slot.atom) uses.set(slot.atom, [...(uses.get(slot.atom) ?? []), { molecule, slot }]);
    }
  }
  return uses;
}
