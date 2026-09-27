import type { GridSettings, ItemTextField, TextLayerDesign } from "@/types/project";

// ── Design variables (site-wide) ──────────────────────────────────────────────
//
// As Figma's variables: named values — colours, sizes, spacing, weights — the
// site's atoms and molecules are bound to. Colours have a light and a dark
// value (the site's themes); a value can also be another variable's (an
// alias), so a semantic one (card-title) can point at a base one (başlık/orta).
// Each variable is a CSS custom property on the page (see variablesCss): change
// it, and everything bound to it changes at once.

/** What a variable holds: a colour, a size in px (radius, gap, padding, font size, line height…) or a font weight. */
export type VariableKind = "color" | "number" | "weight";

/** A value of its own, or another variable's (by id). */
export type VariableValue = { value: string | number } | { alias: string };

export interface DesignVariable {
  id: string;
  /** Its name; "/" makes groups: "Metin/Başlık" */
  name: string;
  kind: VariableKind;
  /** Its value — in the light theme, for a colour */
  light: VariableValue;
  /** A colour's value in the dark theme (the light one when unset) */
  dark?: VariableValue;
  /** The site's own CSS token it drives (--bg-1, --text-title…): the starting variables */
  token?: string;
}

// ── Atoms (site-wide) ─────────────────────────────────────────────────────────
//
// As Atomic Design's atoms: the smallest pieces the site is built of — a
// heading, a text, a label, a value. An atom carries its own look (a text's
// typography); where it sits and how big its box is are up to what holds it
// (for now its component's item — see TextLayerDesign). Each of its values is
// its own or bound to a variable, as in Figma: change the variable, and every
// atom bound to it changes; change the atom, and every text using it changes,
// on every page. Each atom is a CSS rule on its texts (see atomsCss).

/** What an atom is — a piece of text, for now. */
export type AtomKind = "text";

/** A text atom's typography: each value its own, or a variable's (see VariableValue). */
export interface Typography {
  /** px — or a size variable */
  fontSize: VariableValue;
  /** 100–900 — or a weight variable */
  fontWeight: VariableValue;
  /** px — or a size variable */
  lineHeight: VariableValue;
  /** A colour variable (its light and dark values), or a colour of its own (the same in both themes) */
  color: VariableValue;
}

export interface DesignAtom extends Typography {
  id: string;
  /** Its name: "Etiket" — "/" makes groups, as a variable's */
  name: string;
  kind: AtomKind;
}

// ── Molecules (site-wide) ─────────────────────────────────────────────────────
//
// As Atomic Design's molecules: a few atoms working together — a card's label
// and value. A molecule is a frame — how it lays out its atoms (Figma's auto
// layout), its spacing, corners and background — holding its atoms, each in
// a slot: which atom, and how big and where in the frame. A component's items
// are its instances: change the Kart, and every component made of Kart's
// changes, on every page. How big an item is in its component stays with the
// component (ComponentDesign.item.size).

/** A place for an atom in a molecule: the item's text it shows, and the atom giving it its look. */
export interface MoleculeSlot extends TextLayerDesign {
  /** The item's text it shows */
  field: ItemTextField;
  /** Its name in the layers: "Etiket" */
  name: string;
}

/** The spacing of a frame that can be bound to a size variable. */
export type SpacingKey = "paddingX" | "paddingY" | "paddingTop" | "paddingRight" | "paddingBottom" | "paddingLeft" | "columnGap" | "rowGap";

export interface DesignMolecule {
  id: string;
  /** Its name: "Kart" — "/" makes groups, as a variable's */
  name: string;
  /** How it lays out its slots, with its spacing (px) */
  layout: GridSettings;
  /** Spacing bound to size variables (their ids) — their values win over the layout's */
  spacing?: Partial<Record<SpacingKey, string>>;
  /** Corner radius (px) — or a size variable */
  radius: VariableValue;
  /** Background — a colour variable, or a colour of its own */
  background: VariableValue;
  /** Its atoms, in their order in the frame */
  slots: MoleculeSlot[];
}
