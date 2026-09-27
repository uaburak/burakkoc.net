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

/** How a section lays out its groups, or a group its components. */
export interface GridSettings {
  /**
   * Column widths in twelfths, e.g. [4, 8] — children fill the columns in
   * order and wrap to a new line. One full-width column when unset.
   */
  columns?: number[];
  /** Space between the children (default "md", 16px) */
  gap?: GridGap;
  /** Vertical alignment of children sharing a line (default "start") */
  align?: GridAlign;
}

// ── Block ─────────────────────────────────────────────────────────────────────

export interface Block {
  id: string;
  type: BlockType;
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
  /** How many columns of its section's grid it covers (default 1) */
  span?: number;
  grid?: GridSettings;
  /** Its components */
  blocks: Block[];
}

export interface Section {
  id: string;
  title?: string;
  grid?: GridSettings;
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
}
