// ── Block Types (divider removed — it's now a top-level PageItem) ─────────────

export type BlockType = "heading" | "subheading" | "text" | "image" | "video" | "code";

// ── Badge System ─────────────────────────────────────────────────────────────

export type BadgeIconType = "link" | "search" | "play" | "external" | "gear" | "segmented";
export type BadgePosition = "top-right" | "top-left" | "bottom-right" | "bottom-left";

export interface SegmentedSecondTab {
  type: "image" | "video" | "code" | "text";
  src?: string;
  content?: string;
  language?: string;
  codePreview?: string;
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

// ── Block ─────────────────────────────────────────────────────────────────────

export interface Block {
  id: string;
  type: BlockType;
  // TR (default)
  content?: string;
  language?: string;
  codePreview?: string;
  src?: string;
  alt?: string;
  caption?: string;
  aspectRatio?: "16/9" | "4/3" | "1/1";
  badges?: BadgeItem[];
  // EN
  contentEn?: string;
  altEn?: string;
  captionEn?: string;
}

// ── Section ───────────────────────────────────────────────────────────────────

export interface Section {
  id: string;
  title?: string;
  blocks: Block[];
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

export interface ProjectData {
  slug: string;
  title: string;
  /** English title (optional) */
  titleEn?: string;
  category: string;
  year: string;
  /** Cover / thumbnail image URL */
  coverImage?: string;
  /** Flat ordered list of sections and dividers */
  items: PageItem[];
}
