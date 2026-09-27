"use client";

import { createContext, useContext } from "react";
import type { AtomKind, DesignAtom, DesignVariable, Typography, VariableKind } from "@/types/design";
import { cssValue } from "./designVariables";

/**
 * The site's atoms (see DesignAtom): the starting ones — the typography the
 * site's texts already have, bound to the starting variables — and the ones
 * added in the editor. Each is a CSS rule on the texts using it
 * (`data-atom`), inside `[data-design-scope]`.
 */

const text = (id: string, name: string, fontSize: string, fontWeight: string, lineHeight: string, color: string): DesignAtom => ({
  id,
  name,
  kind: "text",
  fontSize: { alias: fontSize },
  fontWeight: { alias: fontWeight },
  lineHeight: { alias: lineHeight },
  color: { alias: color },
});

/** The typography the site's texts already have (CaseStudyBlocks), as the first atoms — so nothing changes until they are edited. */
export const STARTING_ATOMS: DesignAtom[] = [
  text("heading", "Başlık", "font-size-m", "weight-medium", "line-height-m", "text-title"),
  text("text", "Metin", "font-size-m", "weight-light", "line-height-l", "text-p"),
  text("label", "Etiket", "font-size-s", "weight-regular", "line-height-s", "text-subtitle"),
  text("value", "Değer", "font-size-m", "weight-regular", "line-height-m", "text-title"),
  text("caption", "Açıklama", "font-size-s", "weight-light", "line-height-s", "text-subtitle"),
];

/** The site's atoms: the starting ones — as stored, when changed — in their place, then the added ones. */
export function withStartingAtoms(stored: DesignAtom[]): DesignAtom[] {
  const byId = new Map(stored.map((a) => [a.id, a]));
  const starting = new Set(STARTING_ATOMS.map((a) => a.id));
  return [...STARTING_ATOMS.map((a) => byId.get(a.id) ?? a), ...stored.filter((a) => !starting.has(a.id))];
}

/** A new atom of that kind: the look of an ordinary text (the Metin atom's, bound to the same variables). */
export function newAtom(kind: AtomKind, id: string, name: string): DesignAtom {
  const base = STARTING_ATOMS.find((a) => a.id === "text")!;
  return { ...base, id, name, kind };
}

/** The kind of variable each typography value can be bound to. */
export const TYPOGRAPHY_KINDS: Record<keyof Typography, VariableKind> = {
  fontSize: "number",
  fontWeight: "weight",
  lineHeight: "number",
  color: "color",
};

const CSS_PROPERTY: Record<keyof Typography, string> = {
  fontSize: "font-size",
  fontWeight: "font-weight",
  lineHeight: "line-height",
  color: "color",
};

/**
 * The atoms as CSS: each one's typography on the texts using it. Its colour
 * gives way to the editor's own while a text is being typed in.
 */
export function atomsCss(atoms: DesignAtom[], variables: DesignVariable[]): string {
  const byId = new Map(variables.map((v) => [v.id, v]));
  return atoms
    .map((atom) => {
      const at = `[data-design-scope] [data-atom=${JSON.stringify(atom.id)}]`;
      const set = (key: keyof Typography) => {
        const value = atom[key] ? cssValue(atom[key], TYPOGRAPHY_KINDS[key], byId) : null;
        return value ? `${CSS_PROPERTY[key]}: ${value};` : "";
      };
      return `${at} { ${set("fontSize")} ${set("fontWeight")} ${set("lineHeight")} }\n${at}:not([contenteditable]) { ${set("color")} }`;
    })
    .join("\n");
}

/** The site's atoms — the editor's working copy while editing. */
export const DesignAtomsContext = createContext<DesignAtom[]>(STARTING_ATOMS);

export const useDesignAtoms = () => useContext(DesignAtomsContext);
