"use client";

import { createContext, useContext, type CSSProperties } from "react";
import type { BlockType, ComponentDesigns, GridSettings } from "@/types/project";
import type { DesignMolecule, DesignVariable, MoleculeSlot, MoleculeStroke, SpacingKey, VariableValue } from "@/types/design";
import { cssValue, resolvedValue } from "./designVariables";
import { innerLayoutStyle } from "./LayoutGrid";

/**
 * The site's molecules (see DesignMolecule): the starting ones — the frames
 * the site's cards already have, holding the starting atoms — and the ones
 * added in the editor (copies of another, to change).
 */

/** The Proje Künyesi's card as it was: its label (Etiket) over its value (Değer), 12 / 16px in, 2px apart, 22px corners, filled with the bg-4 grey. */
export const STARTING_MOLECULES: DesignMolecule[] = [
  {
    id: "card",
    name: "Kart",
    layout: { flow: "vertical", paddingX: 16, paddingY: 12, rowGap: 2 },
    radius: { alias: "radius-card" },
    fill: { color: { alias: "bg-4" } },
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
 * A stroke as a box shadow — inside, across or outside the edge, following
 * the corners — so, as in Figma, it never changes the frame's size (and the
 * editor's outlines stay free).
 */
function strokeShadow(stroke: MoleculeStroke | undefined, byId: Map<string, DesignVariable>): string | undefined {
  if (!stroke || stroke.hidden) return undefined;
  const color = cssValue(stroke.color, "color", byId);
  const weight = cssValue(stroke.weight, "number", byId);
  if (!color || !weight) return undefined;
  if (stroke.align === "outside") return `0 0 0 ${weight} ${color}`;
  if (stroke.align === "center") return `inset 0 0 0 calc(${weight} / 2) ${color}, 0 0 0 calc(${weight} / 2) ${color}`;
  return `inset 0 0 0 ${weight} ${color}`;
}

/** Its fill's colour as CSS — none when it has none, or it is hidden. */
export function fillCss(molecule: DesignMolecule, byId: Map<string, DesignVariable>): string | null {
  return molecule.fill && !molecule.fill.hidden ? cssValue(molecule.fill.color, "color", byId) : null;
}

/**
 * An instance's frame as styles: its layout (see innerLayoutStyle), corners,
 * fill and stroke. A project's own corner radius (its theme) wins over the
 * molecule's, as over the site's other cards.
 */
export function moleculeFrameStyle(molecule: DesignMolecule, variables: DesignVariable[]): CSSProperties {
  const byId = new Map(variables.map((v) => [v.id, v]));
  const radius = molecule.radius ? cssValue(molecule.radius, "number", byId) : null;
  return {
    ...innerLayoutStyle(moleculeLayout(molecule, byId)),
    borderRadius: radius ? `var(--project-radius-sm, ${radius})` : undefined,
    backgroundColor: fillCss(molecule, byId) ?? undefined,
    boxShadow: strokeShadow(molecule.stroke, byId),
  };
}

/** Components that laid out their items themselves before molecules — and the molecule taking that over. */
const LEGACY: Partial<Record<BlockType, string>> = { info: "card" };

/** A molecule as first stored: its fill was a `background` colour. */
type StoredMolecule = DesignMolecule & { background?: VariableValue };

/** A molecule stored before fills and strokes: its `background` becomes its fill. Null when it needs nothing. */
function upgradeMolecule(molecule: StoredMolecule): DesignMolecule | null {
  if (!("background" in molecule)) return null;
  const { background, ...rest } = molecule;
  return { ...rest, fill: rest.fill ?? (background ? { color: background } : undefined) };
}

/**
 * Designs stored before today's shapes, moved to them:
 * - Before molecules, a component laid out its items itself (its
 *   `item.layout` and `texts`). The molecule taking over gets what was set
 *   there — while it isn't stored itself — and the component keeps its own
 *   part.
 * - A molecule's `background` becomes its fill (see upgradeMolecule).
 * `migrated`: there was something to move (saving stores the move).
 */
export function migrateLegacyDesigns(designs: ComponentDesigns, stored: DesignMolecule[]): {
  designs: ComponentDesigns;
  molecules: DesignMolecule[];
  migrated: boolean;
} {
  let migrated = false;
  const next: ComponentDesigns = { ...designs };
  const molecules = stored.map((molecule) => {
    const upgraded = upgradeMolecule(molecule);
    if (upgraded) migrated = true;
    return upgraded ?? molecule;
  });
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
