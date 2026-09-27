import type { BlockType, CellAlign, GridSettings, ItemTextField, Sizing } from "@/types/project";

// ── Design variables (site-wide) ──────────────────────────────────────────────
//
// As Figma's variables: named values — colours, sizes, spacing, weights — the
// site's text styles and components are bound to. Colours have a light and a dark
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

// ── Text styles (site-wide) ───────────────────────────────────────────────────
//
// As Figma's text styles: a text's typography — its size, weight, line height
// and colour — each value its own or bound to a variable, as in Figma: change
// the variable, and every style bound to it changes; change the style, and
// every text using it changes, on every page. A text layer of a component uses
// one (see TextLayer); where it sits and how big its box is are up to its
// component. Each style is a CSS rule on its texts (see textStylesCss).

/** A text style's typography: each value its own, or a variable's (see VariableValue). */
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

export interface TextStyle extends Typography {
  id: string;
  /** Its name: "Etiket" — "/" makes groups, as a variable's */
  name: string;
}

/** A fill, or a stroke's colour: a colour variable, or a colour of its own — `hidden` keeps it without drawing it (Figma's eye). */
export interface Paint {
  color: VariableValue;
  hidden?: boolean;
}

/** Where a stroke is drawn: inside the frame's edge, across it or outside it — it never changes the frame's size, as in Figma. */
export type StrokeAlign = "inside" | "center" | "outside";

export interface Stroke extends Paint {
  /** px — or a size variable */
  weight: VariableValue;
  align: StrokeAlign;
}

/**
 * How a frame is composited with what is under it, as Figma's blend modes:
 * `pass-through` (unset) lets its children blend with what is under it,
 * `normal` blends them within it first; the rest are CSS's mix-blend-mode.
 */
export type BlendMode =
  | "pass-through"
  | "normal"
  | "darken"
  | "multiply"
  | "color-burn"
  | "lighten"
  | "screen"
  | "color-dodge"
  | "overlay"
  | "soft-light"
  | "hard-light"
  | "difference"
  | "exclusion"
  | "hue"
  | "saturation"
  | "color"
  | "luminosity";

/** Each corner's radius — top left, top right, bottom right, bottom left (CSS's order). */
export type Corners = [VariableValue, VariableValue, VariableValue, VariableValue];

/**
 * A frame's look, as Figma's Appearance, Fill and Stroke sections — and its
 * Clip content. Any frame has one: the page's, a Bölüm's, a Blok's, a main
 * component's, an instance's (its overrides).
 */
export interface FrameLook {
  /** Not shown (Figma's eye in Appearance): on the page it takes no room; the layers keep it */
  hidden?: boolean;
  /** Pass through when unset */
  blend?: BlendMode;
  /** 0–100 (%) — 100 when unset */
  opacity?: number;
  /** Corner radius (px) — or a size variable */
  radius?: VariableValue;
  /** Each corner on its own (Figma's independent corners) — wins over `radius` */
  corners?: Corners;
  /** Its fill — none when unset */
  fill?: Paint;
  /** Its stroke — none when unset */
  stroke?: Stroke;
  /** What reaches beyond it is cut off (Figma's Clip content) */
  clip?: boolean;
}

/** The spacing of a frame that can be bound to a size variable. */
export type SpacingKey = "paddingX" | "paddingY" | "paddingTop" | "paddingRight" | "paddingBottom" | "paddingLeft" | "columnGap" | "rowGap";

// ── Components (site-wide) ────────────────────────────────────────────────────
//
// As Figma's components: a main component is a frame with auto layout — its
// flow, spacing, corners, fill and stroke — holding its layers; the page holds
// its instances. Change the main component, and every instance changes, on
// every page; change an instance, and only it changes (its overrides — see
// InstanceOverrides) until they are reset or pushed to the main component.
// A component's layers are its texts (each showing one of the instance's
// texts, in a text style) and, for a component the page holds, the instances
// of another component it repeats — one per item: the Proje Künyesi is a frame
// of Kart instances, one per row. Components the site's code draws (a heading,
// an image, a gallery…) have no main component to open, as a library's.

/** A text of a component: the instance's text it shows (its text property), in a text style. */
export interface TextLayer {
  kind: "text";
  id: string;
  /** Its name in the layers: "Etiket" */
  name: string;
  /** The instance's text it shows */
  field: ItemTextField;
  /** Its text style's id — its field's starting one when unset (or gone) */
  style?: string;
  /** Its size in the component's auto layout */
  size?: Sizing;
  /** Where it sits there when narrower */
  align?: CellAlign;
  /** 0–100 (%) — 100 when unset */
  opacity?: number;
}

/** Instances of another component, one per item of the instance holding them (the Künye's Kart's). */
export interface InstanceLayer {
  kind: "instance";
  id: string;
  /** Its name in the layers — its component's when unset */
  name: string;
  /** The component they are instances of */
  component: string;
  /** Each one's size in the component's auto layout */
  size?: Sizing;
}

export type ComponentLayer = TextLayer | InstanceLayer;

/** A main component: its frame's look (FrameLook) is every instance's, unless one overrides it. */
export interface DesignComponent extends FrameLook {
  id: string;
  /** Its name: "Kart" — "/" makes groups, as a variable's */
  name: string;
  /** The page component its instances are (Proje Künyesi → `info`) — none for one used inside others (Kart) */
  type?: BlockType;
  /** How it lays out its layers (its auto layout), with its spacing (px) */
  layout: GridSettings;
  /** Spacing bound to size variables (their ids) — their values win over the layout's */
  spacing?: Partial<Record<SpacingKey, string>>;
  /** Its layers, in their order in the frame */
  layers: ComponentLayer[];
}

/**
 * What an instance changes of its main component, as Figma's overrides — the
 * rest follows the main one. An item of a page component (a Kart of a Künye)
 * carries its own (BlockEntry.overrides); the instance on the page keeps its
 * look and layout on itself (Block.look, Block.layout).
 */
export interface InstanceOverrides {
  /** Its auto layout's values set here, over the main one's */
  layout?: GridSettings;
  /** Its look's values set here, over the main one's */
  look?: FrameLook;
  /** Its size in the frame holding it, over the one its layer gives it */
  size?: Sizing;
  /** A text's style, over its text layer's */
  styles?: Partial<Record<ItemTextField, string>>;
}
