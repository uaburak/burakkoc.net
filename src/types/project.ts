import type { FrameLook, InstanceOverrides } from "@/types/design";

// ── Block Types (divider removed — it's now a top-level PageItem) ─────────────

export type BlockType =
  | "heading" | "subheading" | "text" | "image" | "video" | "code" | "figma" | "iframe" | "list"
  // Case-study blocks — rendered by components/project/CaseStudyBlocks.tsx
  | "info" | "stats" | "cards" | "steps" | "quote" | "gallery" | "compare" | "links" | "tags"
  | "callout" | "accordion" | "mockup" | "split" | "table" | "bars" | "persona" | "team" | "palette";

/** callout → note | insight | tip | warning · mockup → phone | browser | tablet · split → left | right (image side) */
export type BlockVariant =
  | "note" | "insight" | "tip" | "warning"
  | "phone" | "browser" | "tablet"
  | "left" | "right";

/** One table row. Rows are objects (not string[][]) because Firestore rejects nested arrays. */
export interface TableRow {
  id: string;
  cells: string[];
  cellsEn?: string[];
}

export type AspectRatio = "16/9" | "4/3" | "1/1" | "3/4" | "9/16";

// ── Entry (shared row type for case-study blocks) ────────────────────────────
//
// Each case-study block stores its rows in `Block.entries`. Which fields a row
// uses depends on the block type:
//   info    → label, value            (Rol · Ürün Tasarımcısı)
//   stats   → value, label            (%40 · Dönüşüm artışı)
//   cards   → eyebrow?, title, text
//   steps   → eyebrow?, title, text
//   gallery → src, alt, caption?
//   compare → src, alt, label         (entries[0] = önce, entries[1] = sonra)
//   links   → label, href, icon
//   tags    → label
//   accordion → title, text
//   mockup  → src, alt, label?        (label = browser address bar)
//   bars    → label, value (0–100), text?
//   persona → label, text             (group title + one item per line)
//   team    → src?, title, text, href?
//   palette → label, value (CSS color), text?

export type LinkIconType = "web" | "appstore" | "playstore" | "github" | "figma" | "behance" | "external";

export interface BlockEntry {
  id: string;
  label?: string;
  labelEn?: string;
  value?: string;
  valueEn?: string;
  eyebrow?: string;
  eyebrowEn?: string;
  title?: string;
  titleEn?: string;
  text?: string;
  textEn?: string;
  src?: string;
  alt?: string;
  altEn?: string;
  caption?: string;
  captionEn?: string;
  href?: string;
  icon?: LinkIconType;
  /**
   * An item of a component drawn from its main component is an instance of
   * the component it repeats (the Künye's Kart): what it changes of it.
   */
  overrides?: InstanceOverrides;
}

// ── List Block ───────────────────────────────────────────────────────────────

export type ListStyle = "bullet" | "numbered" | "check" | "dash";

export interface ListItem {
  id: string;
  text: string;
  textEn?: string;
  checked?: boolean; // only relevant for "check" style
}

// ── Badge System ─────────────────────────────────────────────────────────────

export type BadgeIconType = "link" | "search" | "play" | "external" | "gear" | "segmented";
export type BadgePosition = "top-right" | "top-left" | "bottom-right" | "bottom-left";

export interface SegmentedSecondTab {
  type: "image" | "video" | "code" | "text";
  src?: string;
  content?: string;
  language?: string;
  codePreview?: string;
  previewComponent?: string;
}

export interface BadgeItem {
  id: string;
  icon: BadgeIconType;
  position: BadgePosition;
  href?: string;        // for "link" and "external" badges
  tab1Label?: string;
  tab2Label?: string;
  tab2?: SegmentedSecondTab;
}

// ── Page structure: Bölüm › Blok › Bileşen ────────────────────────────────────
//
// A page is a list of sections (Bölüm). A section lays out its groups (Blok)
// on a grid; a group lays out its components (Bileşen) on a grid of its own.
// In code a component is a `Block` (heading, text, image…) and the box around
// components is a `Group` — the editor calls them Bileşen and Blok.

export type GridGap = "sm" | "md" | "lg";
export type GridAlign = "start" | "center" | "end";

/**
 * How a Blok or component is sized in its cell, as Figma's resizing: Fixed
 * (a size in px), Fill (the cell / the row's height) or Hug (its content).
 */
export type SizeMode = "fixed" | "fill" | "hug";

export interface Sizing {
  /** Fill its cell (default), hug its content, or `widthPx` */
  width?: SizeMode;
  /** Hug its content (default), fill its row's height, or `heightPx` */
  height?: SizeMode;
  widthPx?: number;
  heightPx?: number;
  /**
   * Its proportions kept (Figma's Constrain proportions): its width over its
   * height — the height follows the width, whatever its mode.
   */
  ratio?: number;
  /** Limits (px), whatever the mode */
  minWidthPx?: number;
  maxWidthPx?: number;
  minHeightPx?: number;
  maxHeightPx?: number;
}

/**
 * Where a Blok or component sits inside its cell: across (`x` — when it is
 * narrower than the cell: Hug / Fixed width) and down (`y` — when its row is
 * taller). Unset: where its frame's alignment puts it (the grid's `justify`
 * / `align`) — setting the frame's alignment clears it.
 */
export interface CellAlign {
  x?: GridAlign;
  y?: GridAlign;
}

/**
 * How a Bölüm / Blok lays out its children, as Figma's auto layout: stacked
 * (vertical), side by side (horizontal) — both in their list order — or on
 * the grid of `columns` / `rows`, each in its cell.
 */
export type LayoutFlow = "vertical" | "horizontal" | "grid";

/**
 * A Blok or component taken out of its frame's auto layout (Figma's absolute
 * position / Ignore auto layout): `x` / `y` px from the frame's top left. The
 * others lay out as if it weren't there; small screens keep it in the flow.
 */
export interface Absolute {
  x: number;
  y: number;
}

/**
 * A column or row of a grid, as in Figma's grid auto layout: Fixed (`px`),
 * Fill (a share of the free space — `fr`, 1 unless set) or Hug (as big as
 * its content).
 */
export interface GridTrack {
  size: SizeMode;
  px?: number;
  fr?: number;
}

/** How a section lays out its groups, or a group its components. */
export interface GridSettings {
  /** Default "grid" */
  flow?: LayoutFlow;
  /** Stacked / side by side: the free space shared out between the children (Figma's "Auto" gap) */
  spread?: boolean;
  /** Side by side: children that don't fit go on to the next line (Figma's wrap), `rowGap` between the lines */
  wrap?: boolean;
  /**
   * Column widths in twelfths, e.g. [4, 8] — children sit in the cell they
   * were put in (`row` / `col`), the others fill the free cells in order and
   * wrap to a new line. One full-width column when unset.
   */
  columns?: number[];
  /** Its columns (Figma's grid) — win over `columns`, which were twelfths */
  columnTracks?: GridTrack[];
  /** Its rows (Figma's grid): they stay even when empty — win over `rows` */
  rowTracks?: GridTrack[];
  /**
   * How many rows it has — they stay even when empty, so a child can be put
   * in any of their cells. More rows are added when the children need them;
   * unset: as many as the children need.
   */
  rows?: number;
  /** Space between the children (default "md", 16px) */
  gap?: GridGap;
  /** Space between the columns / the rows in px — each overrides `gap` */
  columnGap?: number;
  rowGap?: number;
  /** Space inside the box in px: left and right / top and bottom */
  paddingX?: number;
  paddingY?: number;
  /** …or side by side (px) — each overrides paddingX / paddingY */
  paddingTop?: number;
  paddingRight?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  /**
   * Where its content sits in it, as Figma's auto layout alignment box:
   * across (`justify` — children narrower than their cells: Hug / Fixed
   * width) and down (`align` — when it, or a child's row, is taller than
   * the content). Default "start" (top left).
   */
  justify?: GridAlign;
  align?: GridAlign;
}

// ── Block ─────────────────────────────────────────────────────────────────────

export interface Block {
  id: string;
  type: BlockType;
  /** Its name in the editor's layer tree (Katmanlar) — its type's name when unset */
  name?: string;
  // TR (default)
  content?: string;
  subheading?: string;
  language?: string;
  codePreview?: string;
  previewComponent?: string;
  src?: string;
  alt?: string;
  caption?: string;
  aspectRatio?: AspectRatio;
  badges?: BadgeItem[];
  figmaWorkspace?: string;
  figmaCover?: string;
  figmaWorkspaceCover?: string;
  // List fields
  listStyle?: ListStyle;
  listItems?: ListItem[];
  // Iframe fields
  iframeViews?: ("desktop" | "tablet" | "mobile")[];
  iframeTabletUrl?: string;
  iframeMobileUrl?: string;
  iframeCover?: string;
  // Case-study block fields
  entries?: BlockEntry[];
  /** Grid column count for stats / cards / gallery */
  columns?: 2 | 3 | 4;
  /** Quote attribution */
  author?: string;
  authorRole?: string;
  authorRoleEn?: string;
  /** Block title for callout, split, persona (name) and bars (question) */
  title?: string;
  titleEn?: string;
  variant?: BlockVariant;
  /** Table block */
  tableRows?: TableRow[];
  /** First table row is rendered as the header (default true) */
  tableHeader?: boolean;
  /** Video block: autoplay muted loop without controls (mp4 / webm only) */
  videoLoop?: boolean;
  /** How many columns of its group's grid it covers (default 1) */
  span?: number;
  /** The cell of its group's grid it was put in (1-based row and column); unset → the next free cell */
  row?: number;
  col?: number;
  /** Its size in that cell (Fill width, Hug height when unset) */
  size?: Sizing;
  /** Where it sits inside that cell */
  cellAlign?: CellAlign;
  /** Out of its Blok's auto layout (see Absolute) */
  absolute?: Absolute;
  /**
   * Its look: opacity, corners, fill, stroke, clip (see FrameLook) — for an
   * instance of a main component, what it changes of the main one's (Figma's
   * overrides; see DesignComponent).
   */
  look?: FrameLook;
  /** An instance of a main component: the values of its auto layout it changes (its overrides) */
  layout?: GridSettings;
  /**
   * An instance of a main component: the main component it is — swapped
   * (Figma's instance swap); its type's own one when unset (or gone).
   */
  component?: string;
  /** A text layer (a heading, a subtitle, a paragraph): its text style — its type's when unset (see pageTextStyle) */
  textStyle?: string;
  // EN
  contentEn?: string;
  subheadingEn?: string;
  altEn?: string;
  captionEn?: string;
}

// ── Section ───────────────────────────────────────────────────────────────────

/** "Blok" in the editor: a box on its section's grid, laying out components on its own grid. */
export interface Group {
  id: string;
  /** Its name in the editor's layer tree — "Blok 1", "Blok 2"… when unset */
  name?: string;
  /** How many columns of its section's grid it covers (default 1) */
  span?: number;
  /** The cell of its section's grid it was put in (1-based row and column); unset → the next free cell */
  row?: number;
  col?: number;
  /** Its size in that cell (Fill width, Hug height when unset) */
  size?: Sizing;
  /** Where it sits inside that cell */
  cellAlign?: CellAlign;
  /** Out of its section's auto layout (see Absolute) */
  absolute?: Absolute;
  grid?: GridSettings;
  /** Its look: opacity, corners, fill, stroke, clip (see FrameLook) */
  look?: FrameLook;
  /** Its components */
  blocks: Block[];
}

export interface Section {
  id: string;
  title?: string;
  /** Its name in the editor's layer tree — "01 Bölüm", "02 Bölüm"… when unset */
  name?: string;
  /** The size of its frame (Fill width — the page's column — and Hug height when unset) */
  size?: Sizing;
  grid?: GridSettings;
  /** Its frame's look: opacity, corners, fill, stroke, clip (see FrameLook) */
  look?: FrameLook;
  groups: Group[];
}

// ── Page Items (top-level structure) ─────────────────────────────────────────

/** A section item in the flat page list */
export interface PageSection extends Section {
  kind: "section";
}

/** A divider item in the flat page list — independent of sections */
export interface PageDivider {
  id: string;
  kind: "divider";
}

export type PageItem = PageSection | PageDivider;

/** The text fields of an item that show as a component's text layers (see BlockEntry, TextLayer). */
export type ItemTextField = "label" | "value" | "eyebrow" | "title" | "text" | "caption";

// ── Project ──────────────────────────────────────────────────────────────────

export interface ProjectTheme {
  /** Corner radius: "default" | "0px" | "8px" | "16px" | "24px" | "32px" | "9999px" */
  radius?: string;
  /** Primary accent color override (e.g. #2f6bff) */
  accentColor?: string;
  /** Page background color override */
  bgColor?: string;
  /** Cards and boxes background color override */
  cardBgColor?: string;
  /** Title and heading text color override */
  textColor?: string;
}

/**
 * The page's own frame — the box holding its sections and dividers, as a
 * Figma frame with a vertical auto layout: its size (W Fill — the page's
 * column — and H Hug unless set) and where its content sits in it.
 */
export interface PageFrame {
  size?: Sizing;
  /** Across: sections narrower than the frame (Hug / Fixed width) — default "start" */
  justify?: GridAlign;
  /** Down: when the frame is taller than its content (Fixed height) — default "start" */
  align?: GridAlign;
  /** Its look: opacity, corners, fill, stroke, clip (see FrameLook) */
  look?: FrameLook;
}

export interface ProjectData {
  slug: string;
  title: string;
  /** English title (optional) */
  titleEn?: string;
  category: string;
  year: string;
  /** Company associated with the project from CV experiences */
  company?: string;
  /** Cover / thumbnail image URL */
  coverImage?: string;
  description?: string;
  descriptionEn?: string;
  /** Flat ordered list of sections and dividers */
  items: PageItem[];
  /** Optional project-level theme customizations (radius, colors) */
  theme?: ProjectTheme;
  /** The frame holding its sections and dividers (see PageFrame) */
  frame?: PageFrame;
}
