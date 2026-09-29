"use client";

import { createContext, useContext, useEffect, useRef, useState, type CSSProperties, type ElementType, type ReactNode } from "react";
import type { Block, BlockEntry, BlockType, LayoutFlow, ListItem } from "@/types/project";
import type { CanvasNode, ComponentLayer, DesignComponent, DesignVariable, FrameLayer, FrameLook, InstanceLayer, PartLayer, ShapeLayer, StaticTextLayer, TextField, TextLayer } from "@/types/design";
import TextScrollingEffect from "@/components/TextScrollingEffect";
import ScrollReveal from "@/components/ScrollReveal";
import { ZoomableFigma } from "@/components/ZoomableFigma";
import { ZoomableIframe } from "@/components/ZoomableIframe";
import { cn } from "@/lib/utils";
import { gridFlow } from "@/lib/projectLayout";
import { EditableText } from "./Editable";
import { Entries } from "./Entries";
import { FillHeightContext } from "./fillHeight";
import { componentFrameProps, innerChildStyle } from "./LayoutGrid";
import { frameLookStyle } from "./frameLook";
import { useDesignVariables } from "./designVariables";
import { startingStyle, useTextStyles } from "./textStyles";
import { componentLayout, componentLook, mainComponent, resolveInstance, resolveItem, useDesignComponents, withColumns, type ResolvedInstance } from "./components";
import { useVariantPlay, type PlayProps } from "./interactions";
import { CodeMedia, ImageMedia, ListMarker, VideoMedia } from "./CoreBlocks";
import {
  Avatar,
  Bar,
  CALLOUT,
  CalloutIcon,
  Chevron,
  CompareSlider,
  DevicesRow,
  ExternalMark,
  ItemImage,
  LinkIcon,
  QuoteMark,
  SplitImage,
  StepLine,
  StepNumber,
  Swatch,
  TableView,
  calloutOf,
  formatPercent,
  isPortrait,
  parsePercent,
  personaItems,
  type PartProps,
} from "./CaseStudyBlocks";
import { isSafeHref } from "./RichText";
import type { BlockEditApi, BlockTextKey, EntryTextKey, Lang } from "./editing";

/**
 * Every layer of the page drawn as an instance of its main component (see
 * DesignComponent): its frame — auto layout and look, its overrides over the
 * main one's — and its layers, frames' layers included: texts (the
 * instance's texts, each in its text style), the parts the site's code draws
 * (an image, an avatar, a bar…) and the instances it repeats, one per item
 * (a Kart per row of the Künye), each with its own overrides.
 *
 * What a type does beyond its look — its texts' tags and placeholders, which
 * items show, links, an accordion opening — is its behavior (BEHAVIORS),
 * the code's. On the page only what has content shows (a frame with nothing
 * in it takes no room); in the editor everything does, empty texts as
 * placeholders to type in.
 */

type Item = BlockEntry | ListItem;

/**
 * On the Bileşenler page: typing in a main component's own texts (see
 * StaticTextLayer) — or a drawing's — in place, a double-click away; the one
 * just made (`autoEdit`) starts typed in.
 */
export const StaticTextEditContext = createContext<{ onChange: (layerId: string, text: string) => void; autoEdit?: string | null } | null>(null);

// ── Behaviors ─────────────────────────────────────────────────────────────────

interface TextBehavior {
  as?: ElementType;
  placeholder: string | ((block: Block, item?: Item) => string);
  rich?: boolean;
  multiline?: boolean;
  className?: string;
  /** How its value shows (a percentage, a list of lines) */
  display?: (value: string) => ReactNode;
  /** On the page: its value to show — a fallback for an empty one, a formatted one */
  publicValue?: (block: Block, item: Item | undefined, value: string | undefined) => string | undefined;
  /** Animated in on the page (TextScrollingEffect) */
  reveal?: boolean;
}

interface TypeBehavior {
  /** Its items: which list, and the fields one of which must be filled for an item to show on the page */
  items?: { source: "entries"; fields: (keyof BlockEntry)[] } | { source: "listItems" };
  /** Shown on the page at all */
  shown?: (block: Block, items: Item[]) => boolean;
  /** Its frame's element; its frames' by layer id */
  rootAs?: ElementType;
  frameAs?: Record<string, ElementType>;
  itemAs?: ElementType;
  itemClassName?: string;
  /** On the page: where an item links to */
  itemLink?: (item: Item) => string | undefined;
  /** An item's fill and stroke under the pointer */
  itemHover?: (item: Item, preview: boolean) => { fill?: string; stroke?: string } | undefined;
  strategy?: "grid" | "vertical";
  /** Its own texts' behavior, and its items' */
  texts?: Partial<Record<TextField, TextBehavior>>;
  itemTexts?: Partial<Record<TextField, TextBehavior>>;
  /** Scroll reveal on the page: the whole of it, or each item */
  reveal?: "block" | "items";
  /** Its items' columns are a property of the instance (Block.columns) */
  columns?: boolean;
  /** Its items' columns on a phone, from the instance (a gallery of portrait images: two) */
  smallColumns?: (block: Block) => number | undefined;
  /** An item that opens (an accordion's): its frame to press, and the one that opens */
  toggle?: { head: string; body: string };
  /** In the editor, with no items: a way to add the first */
  emptyEdit?: (edit: BlockEditApi, focus: (id: string) => void) => ReactNode;
}

const CAPTION: TextBehavior = { as: "p", placeholder: "Açıklama ekle (opsiyonel)", className: "w-full" };
const PARAGRAPH = (placeholder: string, as: ElementType = "p"): TextBehavior => ({ as, rich: true, multiline: true, className: "whitespace-pre-wrap", placeholder });
const filled = (...fields: (keyof BlockEntry)[]) => ({ source: "entries" as const, fields });
const hasItems = (_: Block, items: Item[]) => items.length > 0;
const safeHref = (item: Item) => {
  const href = (item as BlockEntry).href;
  return href && isSafeHref(href) ? href : undefined;
};

const BEHAVIORS: Record<BlockType, TypeBehavior> = {
  heading: {
    shown: (b) => Boolean(b.content),
    texts: {
      content: { as: "h2", placeholder: "Başlık", reveal: true, className: "w-full" },
      subheading: { as: "p", placeholder: "Alt başlık (opsiyonel)", reveal: true, className: "w-full" },
    },
  },
  subheading: { shown: (b) => Boolean(b.content), texts: { content: { as: "p", placeholder: "Alt başlık", reveal: true, className: "w-full" } } },
  text: { shown: (b) => Boolean(b.content), texts: { content: { ...PARAGRAPH("Paragraf metni… **kalın** ve [bağlantı](https://…) kullanabilirsin"), reveal: true } } },
  image: { reveal: "block", texts: { caption: CAPTION } },
  video: { reveal: "block", texts: { caption: CAPTION } },
  code: { reveal: "block", texts: { caption: CAPTION } },
  figma: {},
  iframe: {},
  list: {
    items: { source: "listItems" },
    shown: hasItems,
    reveal: "items",
    strategy: "vertical",
    itemTexts: { text: { placeholder: "Liste öğesi" } },
    emptyEdit: (edit, focus) => (
      // An empty list would be invisible on the canvas: offer the first item.
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); focus(edit.addListItem()); }}
        className="flex items-start gap-2.5 w-full px-4 py-2.5 rounded-[22px] border border-dashed border-[var(--border-hover)] text-base font-light leading-6 text-[var(--text-subtitle)] hover:text-[var(--text-title)] cursor-pointer"
      >
        <span className="flex-1 min-w-0 text-left">İlk maddeyi ekle</span>
      </button>
    ),
  },
  info: {
    items: filled("label", "value"),
    shown: hasItems,
    reveal: "block",
    rootAs: "dl",
    itemClassName: "min-w-0",
    itemTexts: { label: { as: "dt", placeholder: "Etiket" }, value: { as: "dd", placeholder: "Değer", rich: true, className: "break-words" } },
  },
  stats: {
    items: filled("value", "label"),
    shown: hasItems,
    reveal: "block",
    columns: true,
    itemClassName: "min-w-0",
    itemTexts: { value: { placeholder: "%00", className: "tabular-nums break-words" }, label: { placeholder: "Metrik açıklaması" } },
  },
  cards: {
    items: filled("title", "text"),
    shown: hasItems,
    reveal: "block",
    columns: true,
    itemClassName: "min-w-0",
    itemTexts: {
      eyebrow: { placeholder: "Üst etiket (opsiyonel)", className: "tabular-nums" },
      title: { placeholder: "Kart başlığı" },
      text: PARAGRAPH("Kısa açıklama…"),
    },
  },
  steps: {
    items: filled("title", "text"),
    shown: hasItems,
    reveal: "block",
    rootAs: "ol",
    itemAs: "li",
    strategy: "vertical",
    itemTexts: { title: { placeholder: "Adım başlığı" }, eyebrow: { placeholder: "Zaman (opsiyonel)" }, text: PARAGRAPH("Bu adımda ne yapıldı?") },
  },
  accordion: {
    items: filled("title", "text"),
    shown: hasItems,
    reveal: "block",
    strategy: "vertical",
    toggle: { head: "head", body: "body" },
    itemTexts: { title: { placeholder: "Başlık" }, text: PARAGRAPH("Açılınca görünecek içerik…") },
  },
  links: {
    items: filled("href"),
    shown: hasItems,
    reveal: "block",
    itemAs: "span",
    itemLink: safeHref,
    itemClassName: "transition-all duration-200 active:scale-[0.97]",
    itemHover: () => ({ fill: "var(--bg-4)", stroke: "var(--border-hover)" }),
    itemTexts: {
      label: {
        placeholder: (_, item) => (item as BlockEntry | undefined)?.href || "Bağlantı",
        publicValue: (_, item, value) => value || (item as BlockEntry | undefined)?.href,
      },
    },
  },
  tags: { items: filled("label"), shown: hasItems, reveal: "block", rootAs: "ul", itemAs: "li", itemTexts: { label: { placeholder: "Etiket" } } },
  team: {
    items: filled("title"),
    shown: hasItems,
    reveal: "block",
    itemLink: safeHref,
    itemClassName: "min-w-0 transition-colors duration-200",
    itemHover: (item, preview) => (!preview && safeHref(item) ? { fill: "var(--bg-5)" } : undefined),
    itemTexts: { title: { placeholder: "Ad Soyad", className: "truncate" }, text: { placeholder: "Rol", className: "truncate" } },
  },
  palette: {
    items: filled("value"),
    shown: hasItems,
    reveal: "block",
    columns: true,
    itemClassName: "min-w-0",
    itemTexts: {
      label: { placeholder: "Renk adı", className: "truncate" },
      value: { placeholder: "#1A1A1A", className: "tabular-nums truncate" },
      text: { placeholder: "Kullanım (opsiyonel)" },
    },
  },
  quote: {
    shown: (b) => Boolean(b.content),
    reveal: "block",
    rootAs: "figure",
    frameAs: { person: "figcaption" },
    texts: {
      content: PARAGRAPH("Alıntı ya da öne çıkan ifade…", "blockquote"),
      author: { placeholder: "Kişi (opsiyonel)" },
      authorRole: { placeholder: "Unvan / şirket (opsiyonel)" },
    },
  },
  callout: {
    shown: (b) => Boolean(b.content || b.title),
    reveal: "block",
    rootAs: "aside",
    texts: {
      title: { placeholder: (b) => CALLOUT[calloutOf(b)].label, publicValue: (b, _, value) => value || CALLOUT[calloutOf(b)].label },
      content: PARAGRAPH("Not metni…"),
    },
  },
  split: {
    shown: (b) => Boolean(b.src || b.title || b.content),
    reveal: "block",
    texts: { title: { as: "h3", placeholder: "Başlık" }, content: PARAGRAPH("Görseli destekleyen kısa metin…") },
  },
  persona: {
    items: filled("label", "text"),
    shown: (b, items) => Boolean(b.title) || items.length > 0,
    reveal: "block",
    itemClassName: "min-w-0",
    texts: {
      title: { placeholder: "Persona adı" },
      subheading: { placeholder: "Yaş · meslek · şehir" },
      content: PARAGRAPH("Kısa tanım ya da persona sözü (opsiyonel)"),
    },
    itemTexts: { label: { placeholder: "Grup başlığı" }, text: { as: "div", multiline: true, display: personaItems, placeholder: "Her satır bir madde" } },
  },
  gallery: {
    items: filled("src"),
    shown: hasItems,
    reveal: "block",
    columns: true,
    smallColumns: (b) => (isPortrait(b.aspectRatio) ? 2 : undefined),
    itemAs: "figure",
    itemClassName: "min-w-0",
    texts: { caption: CAPTION },
    itemTexts: { caption: { as: "figcaption", placeholder: "Görsel altı (opsiyonel)" } },
  },
  compare: { shown: (b) => Boolean(b.entries?.[0]?.src || b.entries?.[1]?.src), reveal: "block", texts: { caption: CAPTION } },
  mockup: { shown: (b) => (b.entries ?? []).some((e) => e.src?.trim()), reveal: "block", texts: { caption: CAPTION } },
  table: { shown: (b) => (b.tableRows ?? []).some((r) => r.cells.some((c) => c.trim() !== "")), reveal: "block", texts: { caption: CAPTION } },
  bars: {
    items: filled("label", "value"),
    shown: hasItems,
    reveal: "block",
    strategy: "vertical",
    texts: { title: { placeholder: "Soru / başlık (opsiyonel)" }, caption: CAPTION },
    itemTexts: {
      label: { placeholder: "Seçenek" },
      value: {
        placeholder: "%0",
        className: "tabular-nums",
        display: formatPercent,
        publicValue: (_, __, value) => (parsePercent(value) === null ? "—" : formatPercent(value ?? "")),
      },
      text: { placeholder: "Not (opsiyonel)" },
    },
  },
};

/** An instance's items: its list's, or its entries — on the page only those with one of its fields filled. */
function itemsOf(block: Block, behavior: TypeBehavior, preview: boolean): Item[] {
  const items = behavior.items;
  if (!items) return [];
  if (items.source === "listItems") return block.listItems ?? [];
  const entries = block.entries ?? [];
  if (preview) return entries;
  return entries.filter((e) => items.fields.some((f) => typeof e[f] === "string" && (e[f] as string).trim() !== ""));
}

// ── Drawing ───────────────────────────────────────────────────────────────────

interface Ctx {
  /** The instance (its texts in the language shown) */
  block: Block;
  edit?: BlockEditApi;
  /** Editing: everything shows, empty texts as placeholders */
  preview: boolean;
  animate: boolean;
  /** In a Fill / Fixed height cell (see FillHeightContext) */
  fill: boolean;
  lang: Lang;
  behavior: TypeBehavior;
  instance: ResolvedInstance;
  variables: DesignVariable[];
  items: Item[];
  /** The list item being typed in right after it was added */
  focus: string | null;
  setFocus: (id: string | null) => void;
  /** Its own texts typed in place (the Bileşenler page — see StaticTextEditContext) */
  staticEdit?: { onChange: (layerId: string, text: string) => void; autoEdit?: string | null } | null;
  /** Its prototype playing (see useVariantPlay): its frame's handlers and animation */
  play?: PlayProps;
}

/** What a layer draws from: the instance, or one of its items (in the component it repeats). */
interface Source {
  item?: Item;
  /** Drawn inside an instance it repeats: its layers are the repeated component's (their ids marked apart) */
  nested?: boolean;
  index: number;
  count: number;
  /** An item that opens: open or not */
  open?: boolean;
  toggle?: () => void;
}

/** A layer's id on the page: a repeated component's layers marked apart from the component holding them. */
const layerAttr = (id: string, source: Source) => (source.nested ? `item:${id}` : id);

const field = (from: object | undefined, key: TextField) => (from as Record<string, unknown> | undefined)?.[key] as string | undefined;

function textBehavior(ctx: Ctx, layer: TextLayer, source: Source) {
  return (source.item ? ctx.behavior.itemTexts : ctx.behavior.texts)?.[layer.field];
}

/** A text layer's value: its item's or its instance's — on the page, what its behavior shows. */
function textValue(ctx: Ctx, layer: TextLayer, source: Source) {
  const value = field(source.item ?? ctx.block, layer.field);
  const behavior = textBehavior(ctx, layer, source);
  return !ctx.preview && behavior?.publicValue ? behavior.publicValue(ctx.block, source.item, value) : value;
}

/** A text layer's style: its item's or its instance's own (an override), else its layer's. */
function textStyleOf(ctx: Ctx, layer: TextLayer, source: Source) {
  const known = ctx.instance.knownStyle;
  const own = source.item ? (source.item as BlockEntry).overrides?.styles?.[layer.field] : ctx.block.styles?.[layer.field];
  return own && known(own) ? own : layer.style && known(layer.style) ? layer.style : startingStyle(layer.field);
}

/** Does a layer show on the page — a text with its value, a part that draws, a frame with any of these, items when there are any? */
function isShown(ctx: Ctx, layer: ComponentLayer, source: Source): boolean {
  if (ctx.preview) return true;
  switch (layer.kind) {
    case "text":
      return Boolean(textValue(ctx, layer, source)?.trim());
    case "instance":
      return ctx.items.length > 0;
    case "frame":
      return layer.layers.some((child) => isShown(ctx, child, source));
    case "part":
      return partShown(ctx, layer, source);
    case "shape":
      return true;
    case "static-text":
      return Boolean(layer.text.trim()) || Boolean(ctx.staticEdit);
  }
}

function partShown(ctx: Ctx, layer: PartLayer, source: Source) {
  const entry = source.item as BlockEntry | undefined;
  if (layer.part === "external-mark") return Boolean(entry?.href && isSafeHref(entry.href));
  if (layer.part === "step-line") return source.index < source.count - 1;
  return true;
}

function TextView({ ctx, layer, source, flow }: { ctx: Ctx; layer: TextLayer; source: Source; flow: LayoutFlow }) {
  const behavior = textBehavior(ctx, layer, source);
  const { item } = source;
  const { edit } = ctx;
  const list = ctx.behavior.items?.source === "listItems" && item ? (item as ListItem) : null;
  const checked = Boolean(list && ctx.block.listStyle === "check" && list.checked);
  const setter = edit
    ? list
      ? (v: string) => edit.setListItemText(list.id, v)
      : item
        ? (v: string) => edit.setEntryText(item.id, layer.field as EntryTextKey, v)
        : (v: string) => edit.setText(layer.field as BlockTextKey, v)
    : undefined;
  const placeholder = typeof behavior?.placeholder === "function" ? behavior.placeholder(ctx.block, item) : behavior?.placeholder ?? layer.name;
  const reveal = Boolean(behavior?.reveal && ctx.animate);
  const size = innerChildStyle(layer.size, layer.align, flow);
  const style: CSSProperties = {
    // Revealed, its box is the reveal's (below).
    ...(reveal ? {} : size),
    ...(layer.textAlign ? { textAlign: layer.textAlign } : {}),
    ...(layer.opacity !== undefined && layer.opacity < 100 ? { opacity: Math.max(0, layer.opacity) / 100 } : {}),
    // A ticked list item, struck out.
    ...(checked && !edit ? { textDecoration: "line-through", opacity: 0.5 } : {}),
  };
  const node = (
    <EditableText
      as={behavior?.as}
      layer={item ? layer.field : undefined}
      layerId={layerAttr(layer.id, source)}
      textStyle={textStyleOf(ctx, layer, source)}
      rich={behavior?.rich}
      multiline={behavior?.multiline}
      display={behavior?.display}
      className={cn(behavior?.className, checked && edit && "line-through opacity-50")}
      style={style}
      value={textValue(ctx, layer, source)}
      onChange={setter}
      placeholder={placeholder}
      autoEdit={Boolean(list && ctx.focus === list.id)}
      onEnter={list && edit ? () => ctx.setFocus(edit.addListItem(list.id)) : undefined}
      onBackspaceEmpty={list && edit && ctx.items.length > 1 ? () => edit.removeListItem(list.id) : undefined}
    />
  );
  return reveal ? (
    <div style={size}>
      <TextScrollingEffect>{node}</TextScrollingEffect>
    </div>
  ) : (
    node
  );
}

function PartView({ ctx, layer, source, flow }: { ctx: Ctx; layer: PartLayer; source: Source; flow: LayoutFlow }) {
  // Hugging its content, a part is the size its code draws it at — and never gives way.
  const { width, flex, minWidth, ...rest } = innerChildStyle(layer.size, layer.align, flow);
  const style: CSSProperties = layer.size?.width === "hug" ? { ...rest, flex: flex === "0 1 auto" ? "none" : flex } : { ...rest, width, flex, minWidth };
  const layerId = layerAttr(layer.id, source);
  const props: PartProps = { block: ctx.block, entry: source.item as BlockEntry | undefined, index: source.index, count: source.count, preview: ctx.preview, edit: ctx.edit, style, layerId };
  const media = { block: ctx.block, edit: ctx.edit, fill: ctx.fill, style, layerId };
  const { block } = ctx;
  switch (layer.part) {
    case "media":
      return <ImageMedia {...media} />;
    case "video":
      return <VideoMedia {...media} />;
    case "code":
      return <CodeMedia {...media} />;
    case "figma":
      return (
        <div data-layer-id={layerId} style={style}>
          <ZoomableFigma src={block.src ?? ""} figmaWorkspace={block.figmaWorkspace} figmaCover={block.figmaCover}
            figmaWorkspaceCover={block.figmaWorkspaceCover} caption={block.caption} lang={ctx.lang} animate={ctx.animate} />
        </div>
      );
    case "iframe":
      return (
        <div data-layer-id={layerId} style={style}>
          <ZoomableIframe src={block.src} iframeTabletUrl={block.iframeTabletUrl} iframeMobileUrl={block.iframeMobileUrl}
            iframeViews={block.iframeViews} iframeCover={block.iframeCover} caption={block.caption} lang={ctx.lang} animate={ctx.animate} />
        </div>
      );
    case "list-marker": {
      const item = source.item as ListItem;
      const kind = block.listStyle ?? "bullet";
      const edit = ctx.edit;
      return (
        <span data-layer-id={layerId} className="flex shrink-0" style={style}>
          <ListMarker style={kind} index={source.index} checked={kind === "check" && Boolean(item?.checked)} onToggle={kind === "check" && edit ? () => edit.toggleListItem(item.id) : undefined} />
        </span>
      );
    }
    case "quote-mark":
      return <QuoteMark {...props} />;
    case "callout-icon":
      return <CalloutIcon {...props} />;
    case "step-number":
      return <StepNumber {...props} />;
    case "step-line":
      return <StepLine {...props} />;
    case "avatar":
      return <Avatar {...props} size={layer.size?.width === "fixed" && layer.size.widthPx ? layer.size.widthPx : source.item ? 44 : 64} />;
    case "link-icon":
      return <LinkIcon {...props} />;
    case "external-mark":
      return <ExternalMark {...props} />;
    case "item-image":
      return <ItemImage {...props} />;
    case "split-image":
      return <SplitImage {...props} />;
    case "compare":
      return <CompareSlider {...props} />;
    case "devices":
      return <DevicesRow {...props} />;
    case "table":
      return <TableView {...props} />;
    case "bar":
      return <Bar {...props} />;
    case "swatch":
      return <Swatch {...props} />;
    case "chevron":
      return <Chevron {...props} open={Boolean(source.open)} />;
  }
}

function LayerView({ ctx, layer, source, flow }: { ctx: Ctx; layer: ComponentLayer; source: Source; flow: LayoutFlow }) {
  switch (layer.kind) {
    case "text":
      return <TextView ctx={ctx} layer={layer} source={source} flow={flow} />;
    case "part":
      return <PartView ctx={ctx} layer={layer} source={source} flow={flow} />;
    case "frame":
      return <FrameView ctx={ctx} frame={layer} source={source} flow={flow} />;
    case "instance":
      // Instances are their frame's only layer: it draws them (see ItemsView).
      return null;
    case "shape":
      return <ShapeView ctx={ctx} layer={layer} source={source} flow={flow} />;
    case "static-text":
      return <StaticTextView ctx={ctx} layer={layer} source={source} flow={flow} />;
  }
}

/** A shape (Figma's rectangle, ellipse): its look at its size — an ellipse is round. */
function ShapeView({ ctx, layer, source, flow }: { ctx: Ctx; layer: ShapeLayer; source: Source; flow: LayoutFlow }) {
  const style: CSSProperties = {
    ...innerChildStyle(layer.size, layer.align, flow),
    ...frameLookStyle(layer, ctx.variables),
    ...(layer.shape === "ellipse" ? { borderRadius: "50%" } : {}),
  };
  return <div data-layer-id={layerAttr(layer.id, source)} style={style} />;
}

/** A text of its own words, in its text style — typed in place on the Bileşenler page (see StaticTextEditContext). */
function StaticTextView({ ctx, layer, source, flow }: { ctx: Ctx; layer: StaticTextLayer; source: Source; flow: LayoutFlow }) {
  // A repeated component's own texts are edited on it, not in the component repeating it.
  const edit = source.nested ? null : ctx.staticEdit;
  const style: CSSProperties = {
    ...innerChildStyle(layer.size, layer.align, flow),
    ...(layer.textAlign ? { textAlign: layer.textAlign } : {}),
    ...(layer.opacity !== undefined && layer.opacity < 100 ? { opacity: Math.max(0, layer.opacity) / 100 } : {}),
  };
  return (
    <EditableText
      as="p"
      layerId={layerAttr(layer.id, source)}
      textStyle={layer.style && ctx.instance.knownStyle(layer.style) ? layer.style : "text"}
      multiline
      className="whitespace-pre-wrap"
      style={style}
      value={layer.text}
      onChange={edit ? (text) => edit.onChange(layer.id, text) : undefined}
      placeholder="Metin"
      autoEdit={Boolean(edit?.autoEdit && edit.autoEdit === layer.id)}
    />
  );
}

/** A frame the component is, or one inside it. */
type FrameLike = Pick<FrameLayer, "layers" | "layout" | "spacing"> & FrameLook & Partial<Pick<FrameLayer, "id" | "size" | "align">>;

/** Its fill and stroke under the pointer (see TypeBehavior.itemHover), as custom properties the classes read. */
function withHover(style: CSSProperties, hover?: { fill?: string; stroke?: string }): { style: CSSProperties; className?: string } {
  if (!hover) return { style };
  const out = { ...style } as CSSProperties & Record<string, unknown>;
  const classes: string[] = [];
  if (hover.fill) {
    out["--fill"] = out.backgroundColor ?? "transparent";
    out["--fill-hover"] = hover.fill;
    delete out.backgroundColor;
    classes.push("[background-color:var(--fill)] hover:[background-color:var(--fill-hover)]");
  }
  if (hover.stroke && typeof out.boxShadow === "string") {
    out["--stroke"] = out.boxShadow;
    out["--stroke-hover"] = out.boxShadow.replace(/var\([^)]*\)|#[0-9a-f]+|rgba?\([^)]*\)$/i, hover.stroke);
    delete out.boxShadow;
    classes.push("[box-shadow:var(--stroke)] hover:[box-shadow:var(--stroke-hover)]");
  }
  return { style: out as CSSProperties, className: classes.join(" ") };
}

function FrameView({ ctx, frame, source, flow, root = false }: { ctx: Ctx; frame: FrameLike; source: Source; flow?: LayoutFlow; root?: boolean }) {
  const byId = new Map(ctx.variables.map((v) => [v.id, v]));
  const repeat = frame.layers.find((layer): layer is InstanceLayer => layer.kind === "instance");
  let layout = root ? ctx.instance.layout : componentLayout(frame, byId);
  // Its items' columns, set on the instance (the root's are in its resolved layout).
  if (repeat && !root && ctx.behavior.columns && ctx.block.columns) layout = withColumns(layout, ctx.block.columns);
  const small = repeat ? ctx.behavior.smallColumns?.(ctx.block) : undefined;
  if (small) layout = { ...layout, small: { ...layout.small, columns: small } };
  const look = root ? ctx.instance.look : componentLook(frame);
  const own = componentFrameProps(layout);
  const style: CSSProperties = {
    ...own.style,
    ...frameLookStyle(look, ctx.variables, { projectRadius: true }),
    ...(flow && !root ? innerChildStyle(frame.size, frame.align, flow) : {}),
  };
  const className = cn(own.className, root && ctx.fill && "md:flex-1 md:min-h-0");
  const Tag: ElementType = root ? ctx.behavior.rootAs ?? "div" : (frame.id && ctx.behavior.frameAs?.[frame.id]) || "div";
  // The instance's frame plays its prototype: its handlers, its animation (see useVariantPlay).
  const { style: playStyle, ...play } = (root && ctx.play) || {};
  if (playStyle) Object.assign(style, playStyle);
  const attributes: Record<string, unknown> = root ? { "data-component-frame": "", ...play } : { "data-layer-id": frame.id && layerAttr(frame.id, source) };

  if (repeat) return <ItemsView ctx={ctx} repeat={repeat} Tag={Tag} className={className} style={style} attributes={attributes} flow={gridFlow(layout)} />;

  const children = frame.layers
    .filter((layer) => isShown(ctx, layer, source))
    .map((layer) => <LayerView key={layer.id} ctx={ctx} layer={layer} source={source} flow={gridFlow(layout)} />);

  // An item that opens (an accordion's), on the page: its head is the button, its body the part that opens.
  const toggle = ctx.behavior.toggle;
  if (toggle && source.item && !ctx.preview && frame.id === toggle.head) {
    return (
      <button type="button" aria-expanded={Boolean(source.open)} onClick={source.toggle} className={cn(className, "w-full text-left cursor-pointer")} style={style} {...attributes}>
        {children}
      </button>
    );
  }
  if (toggle && source.item && !ctx.preview && frame.id === toggle.body) {
    // Its box is the opening region's; inside it, it fills it.
    const size = flow ? innerChildStyle(frame.size, frame.align, flow) : {};
    return (
      <div role="region" inert={!source.open} style={size} className={cn("grid transition-[grid-template-rows] duration-300 ease-out", source.open ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
        <div className="overflow-hidden">
          <Tag className={className} style={{ ...style, ...Object.fromEntries(Object.keys(size).map((key) => [key, undefined])), width: "100%" }} {...attributes}>
            {children}
          </Tag>
        </div>
      </div>
    );
  }
  return (
    <Tag className={className} style={style} {...attributes}>
      {children}
    </Tag>
  );
}

/** The instances a frame repeats, one per item: each the repeated component's frame with the item's overrides, its layers drawing from the item. */
function ItemsView({ ctx, Tag, className, style, attributes, flow }: {
  ctx: Ctx;
  repeat: InstanceLayer;
  Tag: ElementType;
  className?: string;
  style: CSSProperties;
  attributes: Record<string, unknown>;
  /** The frame's flow: the items' sizes are in it */
  flow: LayoutFlow;
}) {
  const item = ctx.instance.item;
  const { behavior, edit } = ctx;
  // Each item plays its prototype on the page (the variants of its component's set — see useVariantPlay).
  const variants = (item?.variants ?? []).map((v) => v.component);
  const playing = !ctx.preview && variants.some((v) => v.interactions?.length);
  const play = useVariantPlay(variants, playing);
  const initialOf = (it: Item) => (it as BlockEntry).component ?? item?.component.id;
  const delays = playing ? ctx.items.flatMap((it) => {
    const delayed = play.delayOf(play.shownOf(it.id, initialOf(it)));
    return delayed ? [{ key: it.id, delayed }] : [];
  }) : [];
  const delaysRef = useRef(delays);
  useEffect(() => {
    delaysRef.current = delays;
  });
  const delayKey = delays.map((d) => `${d.key}:${d.delayed.id}`).join();
  const { change } = play;
  useEffect(() => {
    const timers = delaysRef.current.map(({ key, delayed }) => window.setTimeout(() => change(key, delayed), delayed.delay ?? 800));
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [delayKey, change]);
  if (!item) return null;
  if (edit && ctx.items.length === 0 && behavior.emptyEdit) {
    return (
      <Tag className={className} style={style} {...attributes}>
        {behavior.emptyEdit(edit, (id) => ctx.setFocus(id))}
      </Tag>
    );
  }
  const list = behavior.items?.source === "listItems";
  // Each item is the variant it was set to (see BlockEntry.component), its overrides over it.
  const frameOf = (it: Item) => {
    const own = resolveItem(item, { ...(it as BlockEntry), component: play.shownOf(it.id, initialOf(it)) }, ctx.instance.knownStyle);
    const frame = componentFrameProps(own.layout);
    const hover = behavior.itemHover?.(it, ctx.preview);
    const styled = withHover(
      { ...frame.style, ...frameLookStyle(own.look, ctx.variables, { projectRadius: true }), ...innerChildStyle(own.size, undefined, flow) },
      hover
    );
    return { style: styled.style, className: cn(behavior.itemClassName, frame.className, styled.className), flow: gridFlow(own.layout), component: own.component };
  };
  // Each item's frame once per render (its class, its style and its body all read it).
  const frames = new Map(ctx.items.map((it) => [it.id, frameOf(it)]));
  const frameFor = (it: Item) => frames.get(it.id) ?? frameOf(it);
  return (
    <Entries
      items={ctx.items}
      onMove={edit ? (list ? edit.moveListItem : edit.moveEntry) : undefined}
      as={Tag}
      className={className}
      style={style}
      frame={attributes}
      component={item.component.id}
      itemAs={behavior.itemAs ?? "div"}
      itemClassName={(it) => frameFor(it).className}
      itemStyle={(it) => frameFor(it).style}
      itemProps={
        !ctx.preview && (behavior.itemLink || playing)
          ? (it) => {
              const href = behavior.itemLink?.(it);
              return { ...(href ? { as: "a", href, target: "_blank", rel: "noopener noreferrer" } : {}), ...play.propsOf(it.id, initialOf(it)) };
            }
          : undefined
      }
      strategy={behavior.strategy}
      wrap={ctx.animate && behavior.reveal === "items" ? (node) => <ScrollReveal className="w-full">{node}</ScrollReveal> : undefined}
      render={(it, index) => {
        const own = frameFor(it);
        return <ItemBody ctx={ctx} item={it} index={index} flow={own.flow} component={own.component} />;
      }}
    />
  );
}

/** An item's layers: its component's (the variant it is), drawing from the item — an item that opens keeps whether it is open. */
function ItemBody({ ctx, item, index, flow, component }: { ctx: Ctx; item: Item; index: number; flow: LayoutFlow; component: DesignComponent }) {
  const [open, setOpen] = useState(false);
  const source: Source = { item, nested: true, index, count: ctx.items.length, open, toggle: () => setOpen((o) => !o) };
  return (
    <>
      {component.layers
        .filter((layer) => isShown(ctx, layer, source))
        .map((layer) => <LayerView key={layer.id} ctx={ctx} layer={layer} source={source} flow={flow} />)}
    </>
  );
}

/**
 * A layer of the page: an instance of its main component, with the
 * instance's data — the public page's (`animate`: scroll reveals) or the
 * editor's (`edit`: everything editable in place).
 */
export function ProjectBlock({ block, animate = false, edit, lang = "tr", sample = false, interactive }: {
  block: Block;
  animate?: boolean;
  edit?: BlockEditApi;
  lang?: Lang;
  /** A main component on the Bileşenler page: everything shows, nothing is edited */
  sample?: boolean;
  /** Its prototype plays (see Interaction) — on the page it does, while it is edited or a sample it doesn't */
  interactive?: boolean;
}) {
  const components = useDesignComponents();
  const variables = useDesignVariables();
  // The variant its prototype turned it into (see useVariantPlay).
  const play = useVariantPlay(components, interactive ?? (!edit && !sample));
  const initial = block.component ?? mainComponent(block.type, components)?.id;
  const shown = play.shownOf("root", initial);
  const instance = resolveInstance(shown ? { ...block, component: shown } : block, components, variables, useTextStyles());
  const delayed = play.delayOf(shown);
  const { change } = play;
  useEffect(() => {
    if (!delayed) return;
    const timer = window.setTimeout(() => change("root", delayed), delayed.delay ?? 800);
    return () => window.clearTimeout(timer);
  }, [delayed, change]);
  const fill = useContext(FillHeightContext);
  const [focus, setFocus] = useState<string | null>(null);
  const staticEdit = useContext(StaticTextEditContext);
  if (!instance) return null;
  const behavior = BEHAVIORS[block.type];
  const preview = Boolean(edit) || sample;
  const items = itemsOf(block, behavior, preview);
  if (!preview && behavior.shown && !behavior.shown(block, items)) return null;
  const ctx: Ctx = { block, edit, preview, animate, fill, lang, behavior, instance, variables, items, focus, setFocus, staticEdit: sample ? staticEdit : null, play: play.propsOf("root", initial) };
  const root = <FrameView ctx={ctx} frame={instance.main} source={{ index: 0, count: 1 }} root />;
  return animate && behavior.reveal === "block" ? <ScrollReveal className={cn("w-full", fill && "md:flex md:flex-col")}>{root}</ScrollReveal> : root;
}

/**
 * A component a page component repeats (a Kart), on its own — its frame and
 * layers with one item's texts (its layers' names when there is none): the
 * Bileşenler page's main component.
 */
export function ItemComponentView({ component: start, type, entry, fill = false, interactive = false }: {
  component: DesignComponent;
  type?: BlockType;
  entry?: BlockEntry;
  /** Its frame fills the height of the box holding it (a drawing's Fixed height) */
  fill?: boolean;
  /** Its prototype plays (the prototype's preview) */
  interactive?: boolean;
}) {
  const components = useDesignComponents();
  // The variant its prototype turned it into (see useVariantPlay).
  const play = useVariantPlay(components, interactive);
  const shown = play.shownOf("root", start.id);
  const component = components.find((c) => c.id === shown) ?? start;
  const delayed = play.delayOf(shown);
  const { change } = play;
  useEffect(() => {
    if (!delayed) return;
    const timer = window.setTimeout(() => change("root", delayed), delayed.delay ?? 800);
    return () => window.clearTimeout(timer);
  }, [delayed, change]);
  const variables = useDesignVariables();
  const styles = useTextStyles();
  const staticEdit = useContext(StaticTextEditContext);
  const byId = new Map(variables.map((v) => [v.id, v]));
  const behavior = type ? BEHAVIORS[type] : {};
  const sample: BlockEntry = entry ?? { id: "sample" };
  const block: Block = { id: `sample-${component.id}`, type: type ?? "info", entries: [sample] };
  const instance: ResolvedInstance = {
    main: component,
    base: { layout: componentLayout(component, byId), look: componentLook(component) },
    layout: componentLayout(component, byId),
    look: componentLook(component),
    item: null,
    knownStyle: (id?: string) => Boolean(id) && styles.some((s) => s.id === id),
  };
  // Its texts show as they would in an item; those it has no text for, its layers' names.
  const names: BlockEntry = { ...sample };
  const walk = (layers: ComponentLayer[]) => layers.forEach((l) => (l.kind === "frame" ? walk(l.layers) : l.kind === "text" && !field(names, l.field) ? ((names as unknown as Record<string, unknown>)[l.field] = l.name) : null));
  walk(component.layers);
  const ctx: Ctx = { block, preview: false, animate: false, fill, lang: "tr", behavior: { itemTexts: behavior.itemTexts }, instance, variables, items: [names], focus: null, setFocus: () => {}, staticEdit, play: play.propsOf("root", start.id) };
  return <FrameView ctx={ctx} frame={component} source={{ item: names, index: 0, count: 2 }} root />;
}

/**
 * Something drawn on the Bileşenler page on its own (see CanvasNode): a
 * frame with its layers — drawn as a component would be — a shape or a text,
 * filling the box the canvas puts it in (its size there).
 */
export function CanvasNodeView({ node }: { node: CanvasNode }) {
  const { canvas: _canvas, ...layer } = node;
  void _canvas;
  const fixedHeight = layer.size?.height === "fixed";
  if (layer.kind === "frame") {
    const { kind: _kind, size: _size, align: _align, ...frame } = layer;
    void _kind;
    void _size;
    void _align;
    return <ItemComponentView component={frame} fill={fixedHeight} />;
  }
  // A shape or a text on its own: the only layer of a frame of its size.
  const own: ComponentLayer = { ...layer, size: { width: "fill", height: fixedHeight ? "fill" : "hug" } };
  return <ItemComponentView component={{ id: layer.id, name: layer.name, layout: { flow: "vertical" }, layers: [own] }} fill={fixedHeight} />;
}
