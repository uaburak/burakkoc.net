import type { FrameLook, VariableValue } from "@/types/design";
import type { Absolute, AspectRatio, Block, BlockEntry, GridSettings, GridTrack, PageSection, ProjectData, Sizing } from "@/types/project";
import { STARTING_TEXT_STYLES } from "@/components/project/textStyles";
import { TEMPLATE_OVERVIEW } from "@/lib/projectTemplate";
import { columnTracks, gridFlow, gridRows, layoutCells, rowTracks, sectionBlocks } from "@/lib/projectLayout";
import { GALLERY_RATIOS, IMAGE_RATIOS, startingLibrary } from "./library";
import {
  PATH_SEP,
  isFrameLike,
  libraryOf,
  makeInstance,
  nid,
  walk,
  type CounterAlign,
  type Embed,
  type FigmaDocument,
  type FrameNode,
  type LayoutMode,
  type NodeOverride,
  type Paint,
  type PrimaryAlign,
  type PropertyValues,
  type SceneNode,
  type ShapeNode,
  type StrokeStyle,
  type TextNode,
} from "./model";

/**
 * A page made before the Figma editor — sections of blocks (`items`), under
 * the project's title, description and cover — as the Figma file's page:
 * the same content, in the same order and look, built from the starting
 * library's components.
 *
 *  - A section is a frame (named after its heading), its blocks stacked in
 *    it; a divider, a line.
 *  - A block that is one thing (a heading, a paragraph, an image, a quote, a
 *    note…) is an instance of its component, its texts as the instance's
 *    text properties, its picture as the fill of the component's image layer.
 *  - A block that repeats items (a list, cards, metrics, steps, links…) is a
 *    frame laid out as its component, holding an instance of the item's
 *    component for each item — an instance can't add layers of its own.
 *  - What shapes and texts can't be — a video, a code sample, a Figma file,
 *    a page in an iframe, a before / after slider, device frames, an image
 *    with badges — is a frame the site's code draws (see Embed).
 *
 * The project's own fields (title, description, cover…) stay as they are:
 * the projects' list still reads them.
 */

/** The site's column: 720px between its 24px gutters. */
export const PAGE_COLUMN = 672;
/** The gutter a page keeps on a narrow screen. */
const PAGE_GUTTER = 24;
const PAGE_WIDTH = 1440;
/** The page frame's first section (the project's title, description and cover): no entry of its own in the contents. */
export const OVERVIEW_NAME = "Overview";
/** The component a section's heading is an instance of: what the contents list. */
export const HEADING_COMPONENT = "c-heading";

const v = (value: string | number): VariableValue => ({ value });
const a = (alias: string): VariableValue => ({ alias });
const fill = (color: string): Paint[] => [{ color: a(color) }];
const stroke = (color: string, sides?: StrokeStyle["sides"]): StrokeStyle[] => [{ color: a(color), weight: v(1), align: "inside", ...(sides ? { sides } : {}) }];
const picture = (url: string): Paint[] => [{ type: "image", color: a("bg-2"), image: { url, fit: "fill" } }];
const said = (s?: string | null): s is string => Boolean(s && s.trim());

/** Without what is unset (Firestore takes no `undefined`). */
const clean = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

// ── Nodes ─────────────────────────────────────────────────────────────────────

type Pad = [top: number, right: number, bottom: number, left: number];
interface Layout {
  mode?: LayoutMode;
  gap?: number;
  rowGap?: number;
  padding?: Pad;
  primary?: PrimaryAlign;
  counter?: CounterAlign;
  wrap?: boolean;
  columns?: number;
  /** A grid's columns and rows sized one by one (CSS) */
  tracks?: string[];
  rowTracks?: string[];
}

/** A frame with auto layout (stacked unless said), as wide as its frame lets it, as tall as its content. */
function frame(name: string, layout: Layout, children: SceneNode[], extra: Partial<FrameNode> = {}): FrameNode {
  const [t, r, b, l] = layout.padding ?? [0, 0, 0, 0];
  return {
    id: nid(),
    name,
    type: "frame",
    x: 0,
    y: 0,
    width: PAGE_COLUMN,
    height: 100,
    children,
    fills: [],
    strokes: [],
    clipsContent: false,
    layoutMode: layout.mode ?? "vertical",
    itemSpacing: v(layout.gap ?? 0),
    ...(layout.rowGap !== undefined ? { counterSpacing: v(layout.rowGap) } : {}),
    paddingTop: v(t),
    paddingRight: v(r),
    paddingBottom: v(b),
    paddingLeft: v(l),
    primaryAlign: layout.primary ?? "min",
    counterAlign: layout.counter ?? "min",
    ...(layout.wrap ? { layoutWrap: true } : {}),
    ...(layout.columns ? { gridColumns: layout.columns } : {}),
    ...(layout.tracks ? { gridTracks: layout.tracks } : {}),
    ...(layout.rowTracks ? { gridRows: layout.rowTracks.length, gridRowTracks: layout.rowTracks } : {}),
    sizingH: "fill",
    sizingV: "hug",
    ...extra,
  };
}

/** A text in one of the site's text styles, wrapping in its frame's width (hugging its words, when said). */
function text(name: string, characters: string, style: string, extra: Partial<TextNode> & { hug?: boolean } = {}): TextNode {
  const ts = STARTING_TEXT_STYLES.find((s) => s.id === style) ?? STARTING_TEXT_STYLES[0];
  const { hug, ...rest } = extra;
  return {
    id: nid(),
    name,
    type: "text",
    x: 0,
    y: 0,
    width: hug ? 100 : PAGE_COLUMN,
    height: 24,
    characters,
    fontSize: ts.fontSize,
    fontWeight: ts.fontWeight,
    lineHeight: ts.lineHeight,
    ...(ts.letterSpacing ? { letterSpacing: ts.letterSpacing } : {}),
    textAlign: "left",
    textAutoResize: hug ? "widthHeight" : "height",
    fills: [{ color: ts.color }],
    textStyle: ts.id,
    sizingH: hug ? "hug" : "fill",
    sizingV: "hug",
    ...rest,
  };
}

function shape(type: ShapeNode["type"], name: string, width: number, height: number, extra: Partial<ShapeNode> = {}): ShapeNode {
  return { id: nid(), name, type, x: 0, y: 0, width, height, fills: [], strokes: [], ...extra };
}

/** A frame the site's code draws (see Embed). */
const embedded = (name: string, embed: Embed, extra: Partial<FrameNode> = {}) => frame(name, {}, [], { embed, ...extra });

// ── The library ───────────────────────────────────────────────────────────────

interface Library {
  /** A component (or a frame) by id: the file's — the starting library's where the file has lost it */
  get(id: string): FrameNode | undefined;
  /** Is it in the file? (A starting component the file keeps in an older shape has no newer variants.) */
  has(id: string): boolean;
}

function libraryIndex(doc: FigmaDocument): Library {
  const index = new Map<string, FrameNode>();
  const own = new Set<string>();
  walk(startingLibrary().nodes, (n) => { if (isFrameLike(n) && n.type !== "instance") index.set(n.id, n); });
  walk(libraryOf(doc), (n) => {
    if (!isFrameLike(n) || n.type === "instance") return;
    index.set(n.id, n);
    own.add(n.id);
  });
  return { get: (id) => index.get(id), has: (id) => own.has(id) };
}

/** `id` when the file has that component, else `fallback` (a variant the file's older shape of the component lacks). */
const inFile = (lib: Library, id: string, fallback: string) => (lib.has(id) ? id : fallback);

/** An instance of a component, with its property values (and their English). */
function instance(lib: Library, mainId: string, name: string, props?: PropertyValues, propsEn?: Record<string, string | undefined>, extra: Partial<FrameNode> = {}): FrameNode {
  const main = lib.get(mainId);
  const base: FrameNode = main ? makeInstance(main, 0, 0) : { ...frame(name, {}, []), type: "instance", mainId };
  const en = Object.fromEntries(Object.entries(propsEn ?? {}).filter((e): e is [string, string] => said(e[1])));
  return {
    ...base,
    name,
    sizingH: main?.sizingH ?? "fill",
    sizingV: main?.sizingV ?? "hug",
    ...(props ? { props } : {}),
    ...(Object.keys(en).length ? { propsEn: en } : {}),
    ...extra,
  };
}

/** A frame laid out and looking as a component (its items' holder), holding `children` of its own. */
function holder(lib: Library, id: string, name: string, children: SceneNode[], extra: Partial<FrameNode> = {}): FrameNode {
  const main = lib.get(id);
  if (!main) return frame(name, {}, children, extra);
  const { properties, variant, reactions, mainId, props, propsEn, overrides, mainProp, visibleProp, ...look } = main;
  void properties; void variant; void reactions; void mainId; void props; void propsEn; void overrides; void mainProp; void visibleProp;
  return { ...look, id: nid(), name, type: "frame", x: 0, y: 0, children, ...extra };
}

/** The variant of a ratio set an aspect ratio is (the set's first, for one it hasn't — or one the file hasn't). */
function ratioVariant(lib: Library, id: string, ratios: readonly [string, string, number][], ratio: AspectRatio | undefined) {
  const label = ratio?.replace("/", ":");
  const found = ratios.find(([, l]) => l === label);
  return found?.[0] ? inFile(lib, `${id}-${found[0]}`, id) : id;
}

// ── Layout, size, look ────────────────────────────────────────────────────────

const GAP_PX = { sm: 8, md: 16, lg: 32 } as const;
const ALIGN = { start: "min", center: "center", end: "max" } as const;

/** A grid's column or row as CSS, as the site drew it: Fixed px, Fill a share of the free space, Hug its content. */
function trackCss(track: GridTrack, axis: "column" | "row") {
  if (track.size === "fixed") return `${Math.max(0, Math.round(track.px ?? 0))}px`;
  if (track.size === "hug") return axis === "column" ? "fit-content(100%)" : "auto";
  return `minmax(0,${track.fr ?? 1}fr)`;
}

/** A section's or a Blok's auto layout, as the frame's: its flow, gaps, padding and alignment — a grid's column and row sizes. */
function layoutOf(grid: GridSettings | undefined): Layout {
  const preset = GAP_PX[grid?.gap ?? "md"];
  const column = grid?.columnGap ?? preset;
  const row = grid?.rowGap ?? preset;
  const padding: Pad = [
    grid?.paddingTop ?? grid?.paddingY ?? 0,
    grid?.paddingRight ?? grid?.paddingX ?? 0,
    grid?.paddingBottom ?? grid?.paddingY ?? 0,
    grid?.paddingLeft ?? grid?.paddingX ?? 0,
  ];
  const justify = ALIGN[grid?.justify ?? "start"];
  const align = ALIGN[grid?.align ?? "start"];
  const flow = gridFlow(grid);
  if (flow === "horizontal") return { mode: "horizontal", gap: column, rowGap: row, padding, primary: grid?.spread ? "spaceBetween" : justify, counter: align, wrap: grid?.wrap };
  const tracks = flow === "grid" ? columnTracks(grid) : [];
  const rows = flow === "grid" ? rowTracks(grid) : [];
  // (A grid of one column is a stack.)
  if (tracks.length > 1 || rows.length > 1) {
    const even = tracks.every((t) => t.size === "fill" && (t.fr ?? 1) === (tracks[0].fr ?? 1));
    return {
      mode: "grid", gap: column, rowGap: row, padding, columns: tracks.length, counter: align,
      ...(even ? {} : { tracks: tracks.map((t) => trackCss(t, "column")) }),
      ...(rows.length ? { rowTracks: rows.map((t) => trackCss(t, "row")) } : {}),
    };
  }
  return { mode: "vertical", gap: row, padding, primary: flow === "vertical" && grid?.spread ? "spaceBetween" : align, counter: justify };
}

/** Out of its frame's auto layout (from md up, as the site's): at its place in it. */
const absoluteOf = (absolute: Absolute | undefined): Partial<SceneNode> => (absolute ? { absolute: true, x: Math.round(absolute.x), y: Math.round(absolute.y) } : {});

/** Its size in its frame, as the node's: Fill across and Hug down unless set. */
function sizingOf(size: Sizing | undefined): Partial<SceneNode> {
  const out: Partial<SceneNode> = {};
  const width = size?.width ?? "fill";
  const height = size?.height ?? "hug";
  if (width === "fixed" && size?.widthPx) { out.sizingH = undefined; out.width = Math.round(size.widthPx); }
  else out.sizingH = width === "hug" ? "hug" : "fill";
  if (height === "fixed" && size?.heightPx) { out.sizingV = undefined; out.height = Math.round(size.heightPx); }
  else out.sizingV = height === "fill" ? "fill" : "hug";
  if (size?.minWidthPx) out.minWidth = size.minWidthPx;
  if (size?.maxWidthPx) out.maxWidth = size.maxWidthPx;
  if (size?.minHeightPx) out.minHeight = size.minHeightPx;
  if (size?.maxHeightPx) out.maxHeight = size.maxHeightPx;
  return out;
}

/** A frame's look (its Appearance, Fill, Stroke), as the node's. */
function lookOf(look: FrameLook | undefined): Partial<FrameNode> {
  if (!look) return {};
  const out: Partial<FrameNode> = {};
  if (look.hidden) out.visible = false;
  if (look.opacity !== undefined && look.opacity < 100) out.opacity = look.opacity;
  if (look.blend) out.blendMode = look.blend;
  if (look.corners) out.corners = look.corners;
  else if (look.radius) out.cornerRadius = look.radius;
  if (look.fill) out.fills = [{ color: look.fill.color, ...(look.fill.hidden ? { visible: false } : {}) }];
  if (look.stroke) out.strokes = [{ color: look.stroke.color, weight: look.stroke.weight, align: look.stroke.align, ...(look.stroke.hidden ? { visible: false } : {}) }];
  if (look.clip) out.clipsContent = true;
  return out;
}

const hasLook = (look: FrameLook | undefined) => Boolean(look && Object.keys(lookOf(look)).length);

// ── Blocks ────────────────────────────────────────────────────────────────────

/** A name's initials, as the site's avatars: its first two words' letters ("Ayşe, 34" → A). */
function initialsOf(name?: string) {
  return (name ?? "")
    .split(/\s+/)
    .filter((w) => /^\p{L}/u.test(w))
    .slice(0, 2)
    .map((w) => w[0]?.toLocaleUpperCase("tr"))
    .join("") || "?";
}

function percentOf(raw?: string): number | null {
  if (!raw) return null;
  const n = parseFloat(raw.replace("%", "").replace(",", ".").trim());
  return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : null;
}

/** The entries with any of the fields filled — the ones the site shows. */
const shown = (block: Block, ...fields: (keyof BlockEntry)[]) =>
  (block.entries ?? []).filter((e) => fields.some((f) => typeof e[f] === "string" && said(e[f] as string)));

const CALLOUT_LABEL: Record<string, string> = { note: "Not", insight: "İçgörü", tip: "İpucu", warning: "Dikkat" };

/** A media frame, as the library's media components: the medium, its caption centred under it. */
const mediaFrame = (name: string, medium: SceneNode[], block: Block, padding: Pad = [48, 0, 36, 0]) =>
  frame(name, { gap: 24, padding, counter: "center" }, [
    ...medium,
    ...(said(block.caption) ? [text("Caption", block.caption, "caption", { textAlign: "center", ...(said(block.captionEn) ? { charactersEn: block.captionEn } : {}) })] : []),
  ]);

/** An avatar, as the library's: a ring with initials — or the person's picture. */
const avatar = (size: number, name: string | undefined, src: string | undefined) =>
  frame("Avatar", { mode: "horizontal", primary: "center", counter: "center" }, said(src) ? [] : [
    text("Initials", initialsOf(name), "small-strong", { hug: true, fontSize: v(Math.round(size * 0.36)), fontWeight: a("weight-medium"), lineHeight: v(Math.round(size * 0.36)), fills: fill("text-subtitle"), textStyle: undefined }),
  ], { width: size, height: size, sizingH: undefined, sizingV: undefined, fills: said(src) ? picture(src) : fill("bg-1"), strokes: stroke("border"), cornerRadius: a("radius-pill"), clipsContent: true });

/** A persona's group, as the site's: its title over its lines — one to a row, a dot before each. */
const personaGroup = (name: string, entry: BlockEntry) =>
  frame(name, { gap: 8, padding: [16, 16, 16, 16] }, [
    text("Title", entry.label ?? "", "small-strong", said(entry.labelEn) ? { charactersEn: entry.labelEn } : {}),
    frame("Items", { gap: 6 }, (entry.text ?? "").split("\n").map((l) => l.trim()).filter(Boolean).map((line, i) =>
      frame(`Item ${i + 1}`, { mode: "horizontal", gap: 8 }, [
        frame("Marker", { padding: [10, 0, 0, 0] }, [shape("ellipse", "Dot", 4, 4, { fills: fill("text-subtitle") })], { sizingH: "hug" }),
        text("Text", line, "small-light"),
      ])
    )),
  ], { fills: fill("bg-1"), cornerRadius: a("radius-inner"), sizingV: "fill" });

function blockNode(block: Block, lib: Library): SceneNode | null {
  const caption = { caption: said(block.caption), captionText: block.caption ?? "" };
  const captionEn = { captionText: block.captionEn };

  switch (block.type) {
    case "heading":
      // (The site draws no heading without its title — nor its subtitle.)
      if (!said(block.content)) return null;
      return instance(lib, HEADING_COMPONENT, "Heading", { title: block.content ?? "", subtitle: said(block.subheading), subtitleText: block.subheading ?? "" }, { title: block.contentEn, subtitleText: block.subheadingEn });
    case "subheading":
      return said(block.content) ? instance(lib, "c-subheading", "Subheading", { text: block.content }, { text: block.contentEn }) : null;
    case "text":
      return said(block.content) ? instance(lib, "c-text", "Paragraph", { text: block.content }, { text: block.contentEn }) : null;

    case "image":
      // With badges (links over it, a second tab): the site's code draws it whole.
      if (block.badges?.length) return embedded("Image", { kind: "image", src: block.src, alt: block.alt, caption: block.caption, captionEn: block.captionEn, aspectRatio: block.aspectRatio, badges: block.badges });
      return instance(lib, ratioVariant(lib, "c-image", IMAGE_RATIOS, block.aspectRatio), "Image", caption, captionEn, said(block.src) ? { overrides: { Image: { fills: picture(block.src) } } } : {});
    case "video":
      return embedded("Video", { kind: "video", src: block.src, caption: block.caption, captionEn: block.captionEn, videoLoop: block.videoLoop, badges: block.badges });
    case "code":
      return embedded("Code", { kind: "code", content: block.content, language: block.language, codePreview: block.codePreview, previewComponent: block.previewComponent, caption: block.caption, captionEn: block.captionEn, badges: block.badges });
    case "figma":
      return embedded("Figma", { kind: "figma", src: block.src, figmaWorkspace: block.figmaWorkspace, figmaCover: block.figmaCover, figmaWorkspaceCover: block.figmaWorkspaceCover, caption: block.caption, captionEn: block.captionEn });
    case "iframe":
      return embedded("iFrame", { kind: "iframe", src: block.src, iframeViews: block.iframeViews, iframeTabletUrl: block.iframeTabletUrl, iframeMobileUrl: block.iframeMobileUrl, iframeCover: block.iframeCover, caption: block.caption, captionEn: block.captionEn });
    case "compare":
      if (!block.entries?.some((e) => said(e.src))) return null;
      return embedded("Before / After", { kind: "compare", entries: block.entries.slice(0, 2), aspectRatio: block.aspectRatio, caption: block.caption, captionEn: block.captionEn });
    case "mockup": {
      const screens = shown(block, "src");
      return screens.length ? embedded("Device frame", { kind: "devices", entries: screens, variant: block.variant, caption: block.caption, captionEn: block.captionEn }) : null;
    }

    case "list": {
      const items = block.listItems ?? [];
      if (!items.length) return null;
      const style = block.listStyle ?? "bullet";
      return holder(lib, "c-list", "List", items.map((item, i) => {
        const marker = style === "numbered" ? "c-list-item-number" : style === "dash" ? "c-list-item-dash" : style === "check" ? (item.checked ? "c-list-item-checked" : "c-list-item-check") : "c-list-item";
        const main = inFile(lib, marker, "c-list-item");
        return instance(lib, main, `List item ${i + 1}`, { text: item.text, ...(style === "numbered" ? { number: `${i + 1}.` } : {}) }, { text: item.textEn });
      }));
    }
    case "info": {
      const entries = shown(block, "label", "value");
      if (!entries.length) return null;
      return holder(lib, "c-info", "Project info", entries.map((e, i) => instance(lib, "c-card", `Card ${i + 1}`, { label: e.label ?? "", value: e.value ?? "" }, { label: e.labelEn, value: e.valueEn }, { sizingV: "fill" })));
    }
    case "stats": {
      const entries = shown(block, "value", "label");
      if (!entries.length) return null;
      const columns = block.columns ?? 3;
      return holder(lib, "c-stats", "Metrics", entries.map((e, i) => instance(lib, "c-metric", `Metric ${i + 1}`, { value: e.value ?? "", label: e.label ?? "" }, { value: e.valueEn, label: e.labelEn }, { sizingV: "fill" })), { gridColumns: columns, ...(columns > 2 ? { narrow: "two" as const } : {}) });
    }
    case "cards": {
      const entries = shown(block, "title", "text");
      if (!entries.length) return null;
      return holder(lib, "c-cards", "Cards", entries.map((e, i) =>
        instance(lib, "c-feature-card", `Feature card ${i + 1}`, { eyebrow: said(e.eyebrow), eyebrowText: e.eyebrow ?? "", title: e.title ?? "", text: e.text ?? "" }, { eyebrowText: e.eyebrowEn, title: e.titleEn, text: e.textEn }, { sizingV: "fill" })
      ), { gridColumns: block.columns ?? 2, narrow: "stack-sm" });
    }
    case "steps": {
      const entries = shown(block, "title", "text");
      if (!entries.length) return null;
      return holder(lib, "c-steps", "Steps", entries.map((e, i) =>
        instance(lib, "c-step", `Step ${i + 1}`, { number: String(i + 1), title: e.title ?? "", showTime: said(e.eyebrow), time: e.eyebrow ?? "", text: e.text ?? "", line: i < entries.length - 1 }, { title: e.titleEn, time: e.eyebrowEn, text: e.textEn })
      ));
    }
    case "accordion": {
      const entries = shown(block, "title", "text");
      if (!entries.length) return null;
      return holder(lib, "c-accordion", "Accordion", entries.map((e, i) => instance(lib, "c-accordion-item-closed", `Accordion item ${i + 1}`, { title: e.title ?? "", text: e.text ?? "" }, { title: e.titleEn, text: e.textEn })));
    }
    case "links": {
      const entries = shown(block, "href");
      if (!entries.length) return null;
      return holder(lib, "c-links", "Links", entries.map((e, i) => instance(lib, "c-link", `Link ${i + 1}`, { label: e.label || e.href || "" }, { label: e.labelEn }, { sizingH: "hug", sizingV: undefined, height: 40, href: e.href })));
    }
    case "tags": {
      const entries = shown(block, "label");
      if (!entries.length) return null;
      return holder(lib, "c-tags", "Tags", entries.map((e, i) => instance(lib, "c-tag", `Tag ${i + 1}`, { label: e.label ?? "" }, { label: e.labelEn }, { sizingH: "hug", sizingV: undefined, height: 32 })));
    }
    case "team": {
      const entries = shown(block, "title");
      if (!entries.length) return null;
      return holder(lib, "c-team", "Team", entries.map((e, i) => {
        const overrides: Record<string, NodeOverride> | undefined = said(e.src) ? { Avatar: { fills: picture(e.src) }, [`Avatar›Initials`]: { visible: false } } : undefined;
        return instance(lib, "c-person", `Person ${i + 1}`, { name: e.title ?? "", role: e.text ?? "", initials: initialsOf(e.title), linkMark: said(e.href) }, { name: e.titleEn, role: e.textEn }, { sizingV: "fill", ...(overrides ? { overrides } : {}), ...(said(e.href) ? { href: e.href } : {}) });
      }), { narrow: "stack-sm" });
    }
    case "palette": {
      const entries = shown(block, "value");
      if (!entries.length) return null;
      return holder(lib, "c-palette", "Color palette", entries.map((e, i) =>
        instance(lib, "c-color", `Color ${i + 1}`, { name: e.label ?? "", code: e.value ?? "", usage: e.text ?? "" }, { name: e.labelEn, usage: e.textEn }, { sizingV: "fill", overrides: { Swatch: { fills: [{ color: v(e.value ?? "transparent") }] } } })
      ), { gridColumns: block.columns ?? 4, ...((block.columns ?? 4) > 2 ? { narrow: "two" as const } : {}) });
    }
    case "gallery": {
      const entries = shown(block, "src");
      if (!entries.length) return null;
      const main = ratioVariant(lib, "c-gallery-item", GALLERY_RATIOS, block.aspectRatio);
      const portrait = block.aspectRatio === "3/4" || block.aspectRatio === "9/16";
      return mediaFrame("Gallery", [
        frame("Images", { mode: "grid", columns: block.columns ?? 2, gap: 12, rowGap: 12 }, entries.map((e, i) =>
          instance(lib, main, `Gallery item ${i + 1}`, { caption: said(e.caption), captionText: e.caption ?? "" }, { captionText: e.captionEn }, { sizingV: "fill", overrides: { Image: { fills: picture(e.src!) } } })
        ), { narrow: portrait ? "two" : "stack-sm" }),
      ], block);
    }

    case "quote":
      if (!said(block.content)) return null;
      return instance(lib, "c-quote", "Quote", { quote: block.content, author: block.author ?? "", role: block.authorRole ?? "" }, { quote: block.contentEn, role: block.authorRoleEn },
        said(block.author) || said(block.authorRole) ? {} : { overrides: { Person: { visible: false } } });
    case "callout":
      if (!said(block.content) && !said(block.title)) return null;
      return instance(lib, "c-callout", "Callout", { title: block.title || CALLOUT_LABEL[block.variant ?? "note"] || CALLOUT_LABEL.note, text: block.content ?? "" }, { title: block.titleEn, text: block.contentEn });
    case "split":
      if (!said(block.src) && !said(block.title) && !said(block.content)) return null;
      return instance(lib, block.variant === "right" ? "c-split-right" : "c-split-left", "Image + Text", { title: block.title ?? "", text: block.content ?? "" }, { title: block.titleEn, text: block.contentEn }, { narrow: "stack-sm", ...(said(block.src) ? { overrides: { Image: { fills: picture(block.src) } } } : {}) });

    case "table": {
      const rows = block.tableRows ?? [];
      if (!rows.some((r) => r.cells.some((c) => said(c)))) return null;
      const columns = Math.max(1, ...rows.map((r) => r.cells.length));
      const headed = block.tableHeader !== false;
      return mediaFrame("Table", [
        frame("Table", {}, rows.map((r, i) => {
          const head = headed && i === 0;
          return frame(head ? "Header row" : `Row ${headed ? i : i + 1}`, { mode: "horizontal", gap: 16, padding: [12, 16, 12, 16] }, Array.from({ length: columns }, (_, c) =>
            text(`Cell ${c + 1}`, r.cells[c] ?? "", head ? "small-strong" : "small", { ...(said(r.cellsEn?.[c]) ? { charactersEn: r.cellsEn![c] } : {}), ...(!head && c === 0 ? { fills: fill("text-title") } : {}) })
          ), head ? { fills: fill("bg-4") } : i === (headed ? 1 : 0) ? {} : { strokes: stroke("border", { top: true, right: false, bottom: false, left: false }) });
        }), { strokes: stroke("border"), cornerRadius: a("radius-card"), clipsContent: true }),
      ], block, [16, 0, 16, 0]);
    }
    case "bars": {
      const entries = shown(block, "label", "value");
      if (!entries.length) return null;
      return mediaFrame("Survey results", [
        frame("Card", { gap: 16, padding: [20, 20, 20, 20] }, [
          ...(said(block.title) ? [text("Question", block.title, "strong", said(block.titleEn) ? { charactersEn: block.titleEn } : {})] : []),
          frame("Bars", { gap: 16 }, entries.map((e, i) => {
            const pct = percentOf(e.value);
            return frame(`Bar ${i + 1}`, { gap: 8 }, [
              frame("Row", { mode: "horizontal", primary: "spaceBetween", gap: 16 }, [
                text("Option", e.label ?? "", "small", { hug: true, ...(said(e.labelEn) ? { charactersEn: e.labelEn } : {}) }),
                text("Percent", pct === null ? "—" : `%${pct.toLocaleString("tr-TR", { maximumFractionDigits: 1 })}`, "small-strong", { hug: true }),
              ], { baselineAlign: true }),
              // The track: its fill and what is left of it share its width as the value says, at any width.
              frame("Track", { mode: "horizontal" }, [
                shape("rectangle", "Fill", 100, 8, { fills: fill("text-title"), cornerRadius: a("radius-pill"), sizingH: "fill", grow: pct ?? 0 }),
                shape("rectangle", "Rest", 100, 8, { sizingH: "fill", grow: 100 - (pct ?? 0) }),
              ], { height: 8, sizingV: undefined, fills: fill("bg-5"), cornerRadius: a("radius-pill"), clipsContent: true }),
              ...(said(e.text) ? [text("Note", e.text, "caption", said(e.textEn) ? { charactersEn: e.textEn } : {})] : []),
            ]);
          })),
        ], { fills: fill("bg-4"), cornerRadius: a("radius-card") }),
      ], block, [16, 0, 16, 0]);
    }
    case "persona": {
      const groups = shown(block, "label", "text");
      if (!said(block.title) && !groups.length) return null;
      return frame("Persona", { gap: 20, padding: [24, 24, 24, 24] }, [
        frame("Identity", { mode: "horizontal", counter: "center", gap: 16 }, [
          avatar(64, block.title, block.src),
          frame("Names", {}, [
            text("Name", block.title ?? "", "strong", said(block.titleEn) ? { charactersEn: block.titleEn } : {}),
            ...(said(block.subheading) ? [text("Description", block.subheading, "subtitle", said(block.subheadingEn) ? { charactersEn: block.subheadingEn } : {})] : []),
          ]),
        ]),
        ...(said(block.content) ? [text("Text", block.content, "text", said(block.contentEn) ? { charactersEn: block.contentEn } : {})] : []),
        ...(groups.length ? [frame("Groups", { mode: "grid", columns: 2, gap: 10, rowGap: 10 }, groups.map((g, i) => personaGroup(`Group ${i + 1}`, g)), { narrow: "stack-sm" })] : []),
      ], { fills: fill("bg-4"), cornerRadius: a("radius-panel") });
    }
  }
  return null;
}

/** A block in its Blok: the node it is, sized and shown as it was. */
function placed(block: Block, lib: Library): SceneNode | null {
  const node = blockNode(block, lib);
  if (!node) return null;
  const size = block.size ? sizingOf(block.size) : {};
  // (A link's pill and a tag hug their words: a block's Fill is its holder's.)
  const next = { ...node, ...size, ...absoluteOf(block.absolute) } as SceneNode;
  if (block.name && block.name.trim()) next.name = block.name.trim();
  if (block.look?.hidden) next.visible = false;
  if (block.look?.opacity !== undefined && block.look.opacity < 100) next.opacity = block.look.opacity;
  return next;
}

// ── Sections ──────────────────────────────────────────────────────────────────

const sum = (one: Pad | undefined, other: Pad | undefined): Pad => [0, 1, 2, 3].map((i) => (one?.[i] ?? 0) + (other?.[i] ?? 0)) as Pad;

/** What the page's column holds: as wide as it, never wider than the column (nor its least width wider). */
const inColumn = <T extends SceneNode>(node: T, column = PAGE_COLUMN): T => ({
  ...node,
  maxWidth: Math.min(node.maxWidth ?? column, column),
  ...(node.minWidth !== undefined ? { minWidth: Math.min(node.minWidth, column) } : {}),
});

type Placeable = { span?: number; row?: number; col?: number; absolute?: Absolute };

/**
 * A section's or a Blok's children, as the site laid them out: on a grid,
 * in reading order, each in the cell it was put in (and the columns it
 * covers) when any of them was put in one or covers more than one; stacked
 * or side by side, in their list order.
 */
function laidOut<T extends Placeable>(children: T[], grid: GridSettings | undefined, node: (child: T) => SceneNode | null): SceneNode[] {
  const layout = layoutOf(grid);
  if (layout.mode !== "grid") return children.map(node).filter((n): n is SceneNode => Boolean(n));
  const count = layout.columns ?? 1;
  const cells = layoutCells(children, count, gridRows(grid));
  const byHand = children.some((c, i) => !c.absolute && ((c.row && c.col) || cells[i].span > 1));
  return children
    .map((child, i) => ({ child, cell: cells[i] }))
    .sort((a, b) => a.cell.row - b.cell.row || a.cell.col - b.cell.col)
    .flatMap(({ child, cell }) => {
      const n = node(child);
      if (!n) return [];
      if (child.absolute || !byHand) return [n];
      return [{ ...n, gridCol: cell.col, gridRow: cell.row, ...(cell.span > 1 ? { gridSpan: cell.span } : {}) } as SceneNode];
    });
}

/** The room over a section (the site's 40px): inside the section's frame, so a height set on the section gets it on top. */
const OVER = 40;
const sectionSizing = (size: Sizing | undefined): Partial<SceneNode> => {
  const out = sizingOf(size);
  if (out.sizingV === undefined && out.height !== undefined) out.height += OVER;
  if (out.minHeight !== undefined) out.minHeight += OVER;
  if (out.maxHeight !== undefined) out.maxHeight += OVER;
  return out;
};

function sectionNode(section: PageSection, index: number, lib: Library): FrameNode | null {
  const groups = section.groups ?? [];
  const heading = sectionBlocks(section).find((b) => b.type === "heading" && said(b.content));
  const name = heading?.content?.trim() || section.name?.trim() || `Section ${String(index + 1).padStart(2, "0")}`;
  const over: Pad = [OVER, 0, 0, 0];
  // Hidden (its look's eye): the site leaves it out — its layer stays, hidden, taking no room.
  const shown: Partial<FrameNode> = section.look?.hidden ? { visible: false } : {};
  const look = section.look ? { ...section.look, hidden: undefined } : undefined;
  // On a phone the site stacks a section's and a Blok's children, each as wide as the column.
  const stack = { narrow: "stack" as const };
  const blocksOf = (group: (typeof groups)[number]) => laidOut(group.blocks ?? [], group.grid, (b) => placed(b, lib));
  const only = groups.length === 1 ? groups[0] : null;
  const plain = only && !hasLook(only.look) && !only.size && !only.absolute && !hasLook(look);
  if (plain) {
    // One Blok, nothing of its own to show: the section's frame holds its blocks itself.
    const layout = layoutOf(only.grid);
    const children = blocksOf(only);
    if (!children.length) return null;
    return frame(name, { ...layout, padding: sum(sum(layout.padding, layoutOf(section.grid).padding), over) }, children, { ...sectionSizing(section.size), ...shown, ...stack } as Partial<FrameNode>);
  }
  const bloks = laidOut(groups, section.grid, (group) => {
    const children = blocksOf(group);
    const i = groups.indexOf(group);
    return children.length ? frame(group.name?.trim() || `Block ${i + 1}`, layoutOf(group.grid), children, { ...sizingOf(group.size), ...lookOf(group.look), ...absoluteOf(group.absolute), ...stack } as Partial<FrameNode>) : null;
  });
  if (!bloks.length) return null;
  const inner = layoutOf(section.grid);
  if (!hasLook(look)) return frame(name, { ...inner, padding: sum(inner.padding, over) }, bloks, { ...sectionSizing(section.size), ...shown, ...stack } as Partial<FrameNode>);
  // Its own fill or stroke: around its content, under the room over it.
  const size = sizingOf(section.size);
  return frame(name, { padding: over }, [frame("Content", inner, bloks, { ...lookOf(look), ...stack, ...(size.sizingV === undefined ? { sizingV: undefined, height: size.height } : {}) })], { ...sectionSizing(section.size), ...shown } as Partial<FrameNode>);
}

// ── The overview ──────────────────────────────────────────────────────────────

/** The Overview's main component (in the starting library): the page's first section is an instance of it. */
export const OVERVIEW_COMPONENT = "c-overview";
/** Where its picture is, in it: the key an instance's picture is set by. */
export const OVERVIEW_IMAGE = `Cover${PATH_SEP}Image`;

/** What the overview says, part by part: a part not shown is none (no category and year, no description, no cover). */
export interface OverviewContent {
  title: string;
  titleEn?: string;
  /** "UX / UI Design · 2026" */
  subtitle: string;
  subtitleShown: boolean;
  description: string;
  descriptionEn?: string;
  descriptionShown: boolean;
  /** The cover's picture — the component's own (the template's example) when unset */
  cover?: string;
  coverShown: boolean;
}

/**
 * What a part shows when the project has nothing for it: the template's
 * example (TEMPLATE_OVERVIEW) — in sight on a new project's page, there to
 * be filled in; hidden on an older one's, which had none.
 */
export type Missing = "sample" | "hidden";

/** The project's fields as the overview's content (see Missing). */
export function overviewContent(project: ProjectData, missing: Missing): OverviewContent {
  const sample = missing === "sample";
  const own = [project.category, project.year].filter(said).join(" · ");
  const example = [said(project.category) ? project.category : TEMPLATE_OVERVIEW.category, said(project.year) ? project.year : String(new Date().getFullYear())].join(" · ");
  return {
    title: project.title || project.slug,
    titleEn: project.titleEn,
    subtitle: sample ? example : own || example,
    subtitleShown: sample || Boolean(own),
    description: said(project.description) ? project.description : TEMPLATE_OVERVIEW.description,
    descriptionEn: said(project.description) ? project.descriptionEn : undefined,
    descriptionShown: sample || said(project.description),
    cover: said(project.coverImage) ? project.coverImage : undefined,
    coverShown: sample || said(project.coverImage),
  };
}

/** The page's overview: an instance of the Overview component saying `content`, marked as the project's. */
function overviewInstance(lib: Library, content: OverviewContent): FrameNode {
  const node = instance(lib, OVERVIEW_COMPONENT, OVERVIEW_NAME, {
    title: content.title,
    subtitle: content.subtitleShown,
    subtitleText: content.subtitle,
    description: content.descriptionShown,
    descriptionText: content.description,
    cover: content.coverShown,
  }, { title: content.titleEn, descriptionText: content.descriptionShown ? content.descriptionEn : undefined });
  return {
    ...node,
    fixed: "overview",
    ...(said(content.cover) ? { overrides: { [OVERVIEW_IMAGE]: { fills: [...picture(content.cover), ...fill("bg-2")] } } } : {}),
  };
}

/** The page's overview for `doc` (its Overview component's, the starting library's where the file lacks it). */
export const overviewFor = (doc: FigmaDocument, content: OverviewContent) => overviewInstance(libraryIndex(doc), content);

// ── The page ──────────────────────────────────────────────────────────────────

/** Has the project a page made before the Figma editor — anything to make its page from? */
export function hasLegacyPage(project: Pick<ProjectData, "items" | "description" | "coverImage">) {
  return (project.items ?? []).some((item) => item.kind === "section" && sectionBlocks(item).length > 0) || said(project.description) || said(project.coverImage);
}

/** The file's page frame (the one the site shows), when it is there. */
export function pageFrameOf(doc: FigmaDocument): FrameNode | null {
  const page = doc.nodes.find((n) => n.id === doc.pageId);
  return page && isFrameLike(page) ? page : null;
}

/** Is the file's page still empty — nothing drawn on it yet? */
export const isEmptyPage = (doc: FigmaDocument) => (pageFrameOf(doc)?.children.length ?? 0) === 0;

/** What makes the page from an older one, as a number: kept on the file it made a page of (FigmaDocument.fromLegacy). */
export const LEGACY_VERSION = 1;

/** Is it the page's overview — the page frame's first layer, marked as the project's (or, made before the mark was kept, named so)? */
export const isOverviewNode = (node: SceneNode | undefined) => Boolean(node && (node.fixed === "overview" || node.name === OVERVIEW_NAME));

/**
 * Was the file's page made from the project's older page — or is it a page of
 * the project's own: either way, one with its overview (see overview.ts)?
 * Marked so — or, made before the mark was kept, known by its overview.
 */
export const isLegacyPage = (doc: FigmaDocument) => Boolean(doc.fromLegacy) || isOverviewNode(pageFrameOf(doc)?.children[0]);

/**
 * Does the project still wait for its page — an older page to make it from,
 * and a file whose page isn't made from it: none yet, an empty one, or one
 * holding what was tried out in the editor before the older pages could be
 * brought over? Until it is made (and saved), the site shows the older page.
 */
export const awaitsLegacyPage = (project: Pick<ProjectData, "items" | "description" | "coverImage" | "canvas">) =>
  hasLegacyPage(project) && !(project.canvas && isLegacyPage(project.canvas));

/** Does the site show the Figma file's page — a file with something on its page, the project's own page when it had one before? */
export const showsCanvas = (project: Pick<ProjectData, "items" | "description" | "coverImage" | "canvas">) =>
  Boolean(project.canvas && !isEmptyPage(project.canvas) && !awaitsLegacyPage(project));

/** How far beside the page what was on it before is put. */
const BESIDE = 200;

/**
 * The file with its page made from the project's older page (see above):
 * the page frame itself stays (its id, its place on the canvas), its layout
 * and content are replaced. What was tried out on the page before — layers
 * that are not an older page's — is kept: in a frame of its own beside the
 * page, on the canvas (the site shows the page frame only).
 */
export function withLegacyPage(doc: FigmaDocument, project: ProjectData): FigmaDocument {
  const lib = libraryIndex(doc);
  const before = pageFrameOf(doc);
  const kept: FrameNode | null = before && before.children.length > 0 && !isLegacyPage(doc)
    ? { ...before, id: nid(), name: `${before.name} (before import)`, x: before.x + Math.max(before.width, PAGE_WIDTH) + BESIDE }
    : null;
  const column = columnOf(project);
  // A section narrower than the column (Hug / Fixed W) sits where the page's frame put it: in a slot as wide as the column.
  const across = ALIGN[project.frame?.justify ?? "start"];
  const slot = (node: SceneNode): SceneNode =>
    node.sizingH === "fill" || node.absolute ? inColumn(node, column) : inColumn(frame(node.name, { counter: across }, [node], node.visible === false ? { visible: false } : {}), column);
  let sections = 0;
  const children: SceneNode[] = [
    inColumn(overviewInstance(lib, overviewContent(project, "hidden")), column),
    ...(project.items ?? []).flatMap((item): SceneNode[] => {
      if (item.kind === "divider") {
        return [inColumn(frame("Divider", { padding: [8, 0, 8, 0] }, [shape("rectangle", "Line", PAGE_COLUMN, 1, { fills: fill("border"), sizingH: "fill" })]), column)];
      }
      const node = sectionNode(item, sections++, lib);
      return node ? [slot(node)] : [];
    }),
  ];
  const page = sitePageFrame(pageFrameOf(doc), project, children);
  const known = doc.nodes.some((n) => n.id === page.id);
  const nodes = known ? doc.nodes.map((n) => (n.id === page.id ? page : n)) : [...doc.nodes, page];
  return clean({ ...doc, pageId: page.id, fromLegacy: LEGACY_VERSION, nodes: kept ? [...nodes, kept] : nodes });
}

/** The page's column: the site's, or narrower when the page's frame had a width of its own; always in the middle of the page. */
export function columnOf(project: Pick<ProjectData, "frame">) {
  const fixedWidth = project.frame?.size?.width === "fixed" && project.frame.size.widthPx ? Math.round(project.frame.size.widthPx) : null;
  return fixedWidth ? Math.min(PAGE_COLUMN, fixedWidth) : PAGE_COLUMN;
}

/** Put in the page's column (see columnOf). */
export const inPageColumn = <T extends SceneNode>(node: T, project: Pick<ProjectData, "frame">): T => inColumn(node, columnOf(project));

/** The page frame (`base`: its id and its place on the canvas kept) laid out as the site's page, holding `children`. */
export function sitePageFrame(base: FrameNode | null, project: ProjectData, children: SceneNode[]): FrameNode {
  // A page frame of a fixed height: at least as tall, its content where its alignment put it (down).
  const fixedHeight = project.frame?.size?.height === "fixed" && project.frame.size.heightPx ? Math.round(project.frame.size.heightPx) : null;
  return {
    ...(base ?? frame(project.title || project.slug, {}, [])),
    name: project.title || project.slug || "Page",
    type: "frame",
    width: PAGE_WIDTH,
    height: 1024,
    rotation: undefined,
    sizingH: undefined,
    sizingV: "hug",
    layoutMode: "vertical",
    itemSpacing: v(0),
    // The site's page: 160px over its content (a narrow screen keeps 40 of them: see PageView), the room under it the site's own;
    // its column in the middle, a gutter beside it on a narrow screen.
    paddingTop: v(160),
    paddingRight: v(PAGE_GUTTER),
    paddingBottom: v(0),
    paddingLeft: v(PAGE_GUTTER),
    primaryAlign: fixedHeight ? ALIGN[project.frame?.align ?? "start"] : "min",
    counterAlign: "center",
    ...(fixedHeight ? { minHeight: 160 + fixedHeight } : { minHeight: undefined }),
    fills: fill("bg-1"),
    strokes: [],
    clipsContent: false,
    children,
  };
}

/**
 * The file as the editor opens it, for a project with an older page: its
 * page made from that page while it still waits for it (see
 * awaitsLegacyPage); a page made before the mark was kept, marked — known by
 * its overview, not yet marked as the project's itself (a page of the
 * project's own has its overview marked from the start: it is no older one).
 */
export function withProjectPage(doc: FigmaDocument, project: ProjectData): FigmaDocument {
  if (awaitsLegacyPage({ ...project, canvas: doc })) return withLegacyPage(doc, project);
  const first = pageFrameOf(doc)?.children[0];
  return hasLegacyPage(project) && !doc.fromLegacy && first?.name === OVERVIEW_NAME && !first.fixed ? { ...doc, fromLegacy: LEGACY_VERSION } : doc;
}
