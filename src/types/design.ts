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
  /** Its collection in the Variables window (the default one when unset) */
  collection?: string;
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
  /** px — none when unset */
  letterSpacing?: VariableValue;
}

export interface TextStyle extends Typography {
  id: string;
  /** Its name: "Etiket" — "/" makes groups, as a variable's */
  name: string;
  /** What it is for (Figma's description) */
  description?: string;
  /** Below 640px (a phone): its size, line height and letter spacing there — the web's one breakpoint */
  small?: Partial<Pick<Typography, "fontSize" | "lineHeight" | "letterSpacing">>;
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

/** A text of an instance's own a component's layer shows (the item's are ItemTextField's). */
export type BlockTextField = "content" | "subheading" | "title" | "author" | "authorRole" | "caption";

/**
 * The text a text layer shows (its text property): in a component the page
 * holds, one of the instance's own (BlockTextField); in one it repeats (a
 * Kart), one of the item's (ItemTextField).
 */
export type TextField = ItemTextField | BlockTextField;

/** How a text lines up in its box, as Figma's text alignment. */
export type TextAlign = "left" | "center" | "right";

/** What every layer of a component has: its name, and its size and place in the frame holding it. */
interface LayerBase {
  id: string;
  /** Its name in the layers: "Etiket" */
  name: string;
  /** Its size in the frame's auto layout */
  size?: Sizing;
  /** Where it sits there when narrower */
  align?: CellAlign;
}

/** A text of a component: the instance's text it shows (its text property), in a text style. */
export interface TextLayer extends LayerBase {
  kind: "text";
  field: TextField;
  /** Its text style's id — its field's starting one when unset (or gone) */
  style?: string;
  /** Left when unset */
  textAlign?: TextAlign;
  /** 0–100 (%) — 100 when unset */
  opacity?: number;
}

/** Instances of another component, one per item of the instance holding them (the Künye's Kart's) — the only layer of its frame. */
export interface InstanceLayer extends LayerBase {
  kind: "instance";
  /** The component they are instances of */
  component: string;
}

/** A frame inside a component: its auto layout and look, holding layers of its own. */
export interface FrameLayer extends LayerBase, FrameLook {
  kind: "frame";
  layout: GridSettings;
  /** Spacing bound to size variables (their ids) */
  spacing?: Partial<Record<SpacingKey, string>>;
  layers: ComponentLayer[];
}

/**
 * A piece the site's code draws — an image, an avatar, a bar, an icon, a
 * table, a video player… — as a nested instance of a library component: it
 * sits in the auto layout like any layer, its inside isn't edited here.
 */
export type PartKind =
  | "media"
  | "video"
  | "code"
  | "figma"
  | "iframe"
  | "list-marker"
  | "quote-mark"
  | "callout-icon"
  | "step-number"
  | "step-line"
  | "avatar"
  | "link-icon"
  | "external-mark"
  | "item-image"
  | "split-image"
  | "compare"
  | "devices"
  | "table"
  | "bar"
  | "swatch"
  | "chevron";

export interface PartLayer extends LayerBase {
  kind: "part";
  part: PartKind;
}

/** A shape drawn in a frame, as Figma's rectangle and ellipse tools draw them: its look (fill, stroke, corners) at its size. */
export interface ShapeLayer extends LayerBase, FrameLook {
  kind: "shape";
  shape: "rectangle" | "ellipse";
}

/**
 * A text typed in, as Figma's text tool makes one: its own words, in a text
 * style — the same in every instance. Bound to one of an instance's texts
 * (Figma's text property), it becomes a TextLayer.
 */
export interface StaticTextLayer extends LayerBase {
  kind: "static-text";
  text: string;
  /** Its text style's id — the body text's when unset */
  style?: string;
  textAlign?: TextAlign;
  /** 0–100 (%) — 100 when unset */
  opacity?: number;
}

export type ComponentLayer = TextLayer | InstanceLayer | FrameLayer | PartLayer | ShapeLayer | StaticTextLayer;

// ── Prototyping (Figma's interactive components) ─────────────────────────────
//
// A variant of a component set can turn into another of its variants when
// something happens to an instance of it — a click, the pointer over it, a
// press, some time passing — animated as Figma's: at once, dissolving in, or
// Smart animate (each layer going from how it was to how it is, matched by
// its id — variants are copies of one another). On the site, every instance
// plays them; in the editor, the prototype's preview does.

/** What starts it: a click, the pointer over it (it goes back when the pointer leaves), a press (back on letting go), or a delay. */
export type InteractionTrigger = "click" | "hover" | "press" | "delay";
/** How the change animates, as Figma's: instant, dissolve, Smart animate. */
export type InteractionAnimation = "instant" | "dissolve" | "smart";
/** Its easing, as Figma's (the springs as their curves). */
export type InteractionEasing = "linear" | "ease-in" | "ease-out" | "ease-in-out" | "ease-in-back" | "ease-out-back" | "gentle" | "bouncy";

export interface Interaction {
  id: string;
  trigger: InteractionTrigger;
  /** After a delay: how long (ms) */
  delay?: number;
  /** The variant it changes to — one of its set's (Figma's "Change to") */
  target: string;
  animation: InteractionAnimation;
  easing: InteractionEasing;
  /** ms */
  duration: number;
}

// ── The Bileşenler page (Figma's canvas) ──────────────────────────────────────
//
// The page holding the main components is an endless canvas, as a Figma
// page: each main component (a set, as its first variant) sits where it was
// put (`DesignComponent.canvas`), and frames, shapes and texts can be drawn
// on it anywhere (CanvasNode) — then turned into components.

/** Where a layer sits on the canvas (px from its origin), and — a main component's — how wide it is drawn there. */
export interface CanvasPlace {
  x: number;
  y: number;
  /** A main component's width on the canvas (its instances' comes from where they are) — 640 for a page component, 320 for one used inside others, unless set */
  width?: number;
  /** …and its height there: Fixed — Hug (its content's) when unset */
  height?: number;
}

/** A frame, a shape or a text drawn on the canvas on its own, where it was drawn — its size its `size` (Fixed W / H as drawn). */
export type CanvasNode = (FrameLayer | ShapeLayer | StaticTextLayer) & { canvas: CanvasPlace };

/** A variant's value of one of its set's properties, as Figma's "Durum=Vurgulu". */
export interface VariantValue {
  property: string;
  value: string;
}

/**
 * A main component: its frame's look (FrameLook) is every instance's, unless one overrides it.
 *
 * As in Figma, components can be the variants of a component set: each one a
 * component of its own (its own frame, look and layers), all of them under
 * the set's name, told apart by their values of the set's properties
 * ("Durum=Vurgulu"). The set is its first variant — the component it grew
 * from; the others name it (`set`). An instance is one variant of it, and
 * picking another value of a property swaps it to that one.
 */
export interface DesignComponent extends FrameLook {
  id: string;
  /** Its name: "Kart" — "/" makes groups, as a variable's. A set's variants all have its name */
  name: string;
  /** A variant of a component set, not its first: the set's (its first variant's) id */
  set?: string;
  /** A variant: its values of the set's properties, in their order */
  variant?: VariantValue[];
  /** Where it sits on the Bileşenler page (a set: its first variant's is the set's) — in its column there when unset */
  canvas?: CanvasPlace;
  /**
   * A set's own frame (on its first variant), as Figma's component set: how
   * it lays out its variants (its auto layout — stacked 24px apart, 20px in,
   * unless set) and its look.
   */
  setFrame?: { layout?: GridSettings; look?: FrameLook };
  /** Its prototype: how it turns into another variant of its set, as Figma's interactive components */
  interactions?: Interaction[];
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
  styles?: Partial<Record<TextField, string>>;
}
