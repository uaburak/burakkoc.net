"use client";

import { useEffect, useState } from "react";
import type { BlockType, ComponentDesign, ComponentDesigns } from "@/types/project";
import type { AtomKind, DesignAtom, DesignVariable, VariableKind } from "@/types/design";
import {
  loadComponentDesigns,
  loadDesignAtoms,
  loadDesignVariables,
  saveComponentDesigns,
  saveDesignAtoms,
  saveDesignVariables,
} from "@/lib/firestore";
import { STARTING_VARIABLES, withStartingVariables } from "@/components/project/designVariables";
import { STARTING_ATOMS, newAtom, withStartingAtoms } from "@/components/project/designAtoms";
import { uid } from "@/components/admin/blockCatalog";

/**
 * The site's design system in the editor — its variables, atoms and main
 * components: loaded once, edited here (every page changes with them) and
 * saved with the project, only the parts that changed.
 */
export interface DesignSystem {
  /** The main components (see ComponentDesign) */
  designs: ComponentDesigns;
  /** Changes a type's main component — every instance, on every page */
  setDesign: (type: BlockType, design: ComponentDesign) => void;
  /** All of the variables, the starting ones included (see DesignVariable) */
  variables: DesignVariable[];
  /** One of the starting variables: it can only go back to its value, not be deleted */
  isStartingVariable: (id: string) => boolean;
  setVariable: (variable: DesignVariable) => void;
  /** Adds a variable of that kind; returns its id */
  addVariable: (kind: VariableKind) => string;
  /** Deletes an added variable — a starting one goes back to its value */
  removeVariable: (id: string) => void;
  /** All of the atoms, the starting ones included (see DesignAtom) */
  atoms: DesignAtom[];
  /** One of the starting atoms: it can only go back to its look, not be deleted */
  isStartingAtom: (id: string) => boolean;
  setAtom: (atom: DesignAtom) => void;
  /** Adds an atom of that kind; returns its id */
  addAtom: (kind: AtomKind) => string;
  /** Deletes an added atom (its texts get their own atom back) — a starting one goes back to its look */
  removeAtom: (id: string) => void;
  /** Writes the parts that changed since the last save */
  save: () => Promise<void>;
  /** Changes with every edit (and save): effects holding `save` depend on it */
  revision: number;
}

type Part = "components" | "variables" | "atoms";

/** `base`, or `base 2`, `base 3`… — the first name no other has. */
function freeName(base: string, taken: { name: string }[]) {
  const names = new Set(taken.map((t) => t.name));
  let name = base;
  for (let n = 2; names.has(name); n++) name = `${base} ${n}`;
  return name;
}

/** `entry` in the place of the one with its id — at the end when there is none. */
function upsert<T extends { id: string }>(list: T[], entry: T): T[] {
  return list.some((e) => e.id === entry.id) ? list.map((e) => (e.id === entry.id ? entry : e)) : [...list, entry];
}

const NEW_VARIABLE: Record<VariableKind, { name: string; value: string | number }> = {
  color: { name: "Yeni renk", value: "#000000" },
  number: { name: "Yeni sayı", value: 16 },
  weight: { name: "Yeni kalınlık", value: 400 },
};

export function useDesignSystem(): DesignSystem {
  const [designs, setDesigns] = useState<ComponentDesigns>({});
  // Only what is stored: the starting variables and atoms are added on top of them.
  const [storedVariables, setStoredVariables] = useState<DesignVariable[]>([]);
  const [storedAtoms, setStoredAtoms] = useState<DesignAtom[]>([]);
  const [changed, setChanged] = useState<ReadonlySet<Part>>(() => new Set());
  const [revision, setRevision] = useState(0);
  const touch = (part: Part) => {
    setChanged((prev) => (prev.has(part) ? prev : new Set([...prev, part])));
    setRevision((r) => r + 1);
  };

  useEffect(() => {
    loadComponentDesigns().then(setDesigns);
    loadDesignVariables().then(setStoredVariables);
    loadDesignAtoms().then(setStoredAtoms);
  }, []);

  const variables = withStartingVariables(storedVariables);
  const atoms = withStartingAtoms(storedAtoms);

  const setVariable = (variable: DesignVariable) => {
    setStoredVariables((list) => upsert(list, variable));
    touch("variables");
  };
  const setAtom = (atom: DesignAtom) => {
    setStoredAtoms((list) => upsert(list, atom));
    touch("atoms");
  };

  return {
    designs,
    setDesign: (type, design) => {
      setDesigns((all) => ({ ...all, [type]: design }));
      touch("components");
    },
    variables,
    isStartingVariable: (id) => STARTING_VARIABLES.some((v) => v.id === id),
    setVariable,
    addVariable: (kind) => {
      const id = uid();
      setVariable({ id, name: freeName(NEW_VARIABLE[kind].name, variables), kind, light: { value: NEW_VARIABLE[kind].value } });
      return id;
    },
    removeVariable: (id) => {
      setStoredVariables((list) => list.filter((v) => v.id !== id));
      touch("variables");
    },
    atoms,
    isStartingAtom: (id) => STARTING_ATOMS.some((a) => a.id === id),
    setAtom,
    addAtom: (kind) => {
      const id = uid();
      setAtom(newAtom(kind, id, freeName("Yeni metin", atoms)));
      return id;
    },
    removeAtom: (id) => {
      setStoredAtoms((list) => list.filter((a) => a.id !== id));
      touch("atoms");
    },
    save: async () => {
      const parts: [Part, () => Promise<void>][] = [
        ["components", () => saveComponentDesigns(designs)],
        ["variables", () => saveDesignVariables(storedVariables)],
        ["atoms", () => saveDesignAtoms(storedAtoms)],
      ];
      for (const [part, write] of parts) {
        if (!changed.has(part)) continue;
        await write();
        setChanged((prev) => new Set([...prev].filter((p) => p !== part)));
      }
      setRevision((r) => r + 1);
    },
    revision,
  };
}
