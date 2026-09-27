"use client";

import { useId, useRef, useState, type CSSProperties, type ElementType, type ReactNode } from "react";
import { AspectRatio, Block, BlockEntry, BlockType, ItemTextField, LinkIconType } from "@/types/project";
import ScrollReveal from "@/components/ScrollReveal";
import { ZoomableImage } from "@/components/ZoomableImage";
import { cn } from "@/lib/utils";
import { isSafeHref, renderRichText } from "./RichText";
import { EditableText } from "./Editable";
import { SortableGroup, SortableItem } from "./Sortable";
import type { BlockEditApi, EntryTextKey } from "./editing";
import { gridFlow } from "@/lib/projectLayout";
import { innerChildStyle, innerLayoutStyle } from "./LayoutGrid";
import { useComponentDesign, type ResolvedDesign } from "./componentDesign";

/**
 * Case-study blocks: info, stats, cards, steps, quote, gallery, compare, links,
 * tags, callout, accordion, mockup, split, table, bars, persona, team, palette.
 *
 * With an `edit` API (live editor) every text is inline editable, entries can
 * be reordered by press-and-hold, removed and added; empty fields show
 * placeholders. Without it the blocks render exactly as on the public page.
 */

export const CASE_STUDY_BLOCK_TYPES = [
  "info", "stats", "cards", "steps", "quote", "gallery", "compare", "links", "tags",
  "callout", "accordion", "mockup", "split", "table", "bars", "persona", "team", "palette",
] as const satisfies readonly BlockType[];

export type CaseStudyBlockType = (typeof CASE_STUDY_BLOCK_TYPES)[number];

export function isCaseStudyBlock(type: BlockType): type is CaseStudyBlockType {
  return (CASE_STUDY_BLOCK_TYPES as readonly BlockType[]).includes(type);
}

// ── Shared bits ───────────────────────────────────────────────────────────────

interface RenderProps {
  block: Block;
  /** Editing: show empty entries and placeholders */
  preview: boolean;
  edit?: BlockEditApi;
}

const ASPECT_CSS: Record<AspectRatio, string> = {
  "16/9": "16 / 9",
  "4/3":  "4 / 3",
  "1/1":  "1 / 1",
  "3/4":  "3 / 4",
  "9/16": "9 / 16",
};

function aspectStyle(ratio: AspectRatio | undefined, fallback: AspectRatio): CSSProperties {
  return { aspectRatio: ASPECT_CSS[ratio ?? fallback] ?? ASPECT_CSS[fallback] };
}

function isPortrait(ratio: AspectRatio | undefined) {
  return ratio === "3/4" || ratio === "9/16";
}

/** Setter for one entry field, or undefined outside the editor (renders static text). */
function entrySetter(edit: BlockEditApi | undefined, entry: BlockEntry, key: EntryTextKey) {
  return edit ? (v: string) => edit.setEntryText(entry.id, key, v) : undefined;
}

function Caption({ block, edit }: { block: Block; edit?: BlockEditApi }) {
  return (
    <EditableText
      as="p"
      className="text-sm font-light leading-5 text-[var(--text-subtitle)] text-center w-full"
      value={block.caption}
      onChange={edit && ((v) => edit.setText("caption", v))}
      placeholder="Açıklama ekle (opsiyonel)"
    />
  );
}

/** `side` keeps the two compare placeholders in their own half so the labels don't overlap. */
function MediaPlaceholder({ label, preview, side }: { label?: string; preview: boolean; side?: "left" | "right" }) {
  return (
    <div
      className={cn(
        "absolute inset-y-0 flex items-center justify-center p-5 text-center text-sm font-light leading-5 text-[var(--text-subtitle)] select-none opacity-50",
        side === "left" ? "left-0 w-1/2" : side === "right" ? "right-0 w-1/2" : "inset-x-0"
      )}
    >
      {preview && label ? label : preview ? "Görsel ekle — ayarlardan" : "Görsel bulunamadı"}
    </div>
  );
}

/** Image inside a block: zoomable on the page, plain in the editor (a click selects the block). */
function BlockImage({ src, alt, editing, className }: { src: string; alt?: string; editing: boolean; className: string }) {
  if (editing) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt ?? ""} draggable={false} className={className} />;
  }
  return <ZoomableImage src={src} alt={alt ?? ""} className={className} />;
}

/** Keeps entries that have any of the given fields filled; while editing keeps all. */
function visibleEntries(block: Block, preview: boolean, ...fields: (keyof BlockEntry)[]) {
  const entries = block.entries ?? [];
  if (preview) return entries;
  return entries.filter((e) => fields.some((f) => typeof e[f] === "string" && (e[f] as string).trim() !== ""));
}

const GRID_SM_COLS: Record<2 | 3 | 4, string> = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-3",
  4: "sm:grid-cols-4",
};

/**
 * A block's entries. Static list on the page; in the editor a sortable group
 * (drag to move). Entries are added and removed from the inspector (or with
 * Delete once selected).
 */
function Entries({
  entries, edit, as: Tag = "div", className, style, designed = false, itemAs: ItemTag = "div", itemClassName, itemStyle, strategy = "grid", render,
}: {
  entries: BlockEntry[];
  edit?: BlockEditApi;
  as?: ElementType;
  className?: string;
  style?: CSSProperties;
  /** Laid out by its main component (see designFrame): the editor measures it as the component's frame (`data-component-frame`). */
  designed?: boolean;
  itemAs?: ElementType;
  itemClassName?: string | ((entry: BlockEntry, index: number) => string);
  itemStyle?: CSSProperties;
  strategy?: "grid" | "vertical";
  render: (entry: BlockEntry, index: number) => ReactNode;
}) {
  const cls = (e: BlockEntry, i: number) => (typeof itemClassName === "function" ? itemClassName(e, i) : itemClassName);

  if (!edit) {
    return (
      <Tag className={className} style={style} data-component-frame={designed ? "" : undefined}>
        {entries.map((e, i) => <ItemTag key={e.id} className={cls(e, i)} style={itemStyle}>{render(e, i)}</ItemTag>)}
      </Tag>
    );
  }

  return (
    <SortableGroup ids={entries.map((e) => e.id)} onMove={edit.moveEntry} strategy={strategy}>
      <Tag className={className} style={style} data-component-frame={designed ? "" : undefined}>
        {entries.map((e, i) => (
          <SortableItem key={e.id} id={e.id} as={ItemTag} className={cls(e, i)} style={itemStyle}>
            {render(e, i)}
          </SortableItem>
        ))}
      </Tag>
    </SortableGroup>
  );
}

/**
 * The layout of a component laid out by its main component (ComponentDesign),
 * at every width: its frame (how it lays out its items), each item's frame
 * and size, and a text layer's size and place in its item — as styles — and
 * the atom giving that text its look.
 */
function designFrame(design: ResolvedDesign) {
  return {
    frame: innerLayoutStyle(design.layout),
    item: { ...innerLayoutStyle(design.item.layout), ...innerChildStyle(design.item.size, undefined, gridFlow(design.layout)) },
    text: (field: ItemTextField) => innerChildStyle(design.texts[field]?.size, design.texts[field]?.align, gridFlow(design.item.layout)),
    atom: (field: ItemTextField) => design.texts[field]?.atom,
  };
}

// ── Info (proje künyesi) ──────────────────────────────────────────────────────

function InfoBlock({ block, preview, edit }: RenderProps) {
  const entries = visibleEntries(block, preview, "label", "value");
  const layout = designFrame(useComponentDesign("info"));
  if (!entries.length && !edit) return null;
  const label = layout.text("label");
  const value = layout.text("value");
  return (
    <Entries
      entries={entries}
      edit={edit}
      as="dl"
      designed
      style={layout.frame}
      itemClassName="rounded-[22px] bg-[var(--bg-4)] min-w-0"
      itemStyle={layout.item}
      render={(e) => (
        <>
          <EditableText as="dt" layer="label" atom={layout.atom("label")} style={label}
            value={e.label} onChange={entrySetter(edit, e, "label")} placeholder="Etiket" />
          <EditableText as="dd" layer="value" atom={layout.atom("value")} rich className="break-words" style={value}
            value={e.value} onChange={entrySetter(edit, e, "value")} placeholder="Değer" />
        </>
      )}
    />
  );
}

// ── Stats (metrikler) ─────────────────────────────────────────────────────────

function StatsBlock({ block, preview, edit }: RenderProps) {
  const entries = visibleEntries(block, preview, "value", "label");
  if (!entries.length && !edit) return null;
  const cols = block.columns ?? 3;
  return (
    <Entries
      entries={entries}
      edit={edit}
      className={cn("grid grid-cols-2 gap-2.5 w-full", cols !== 2 && GRID_SM_COLS[cols])}
      itemClassName="flex flex-col gap-1 px-5 py-5 rounded-[22px] bg-[var(--bg-4)] min-w-0"
      render={(e) => (
        <>
          <EditableText className="text-[28px] font-medium leading-9 tracking-[-0.02em] text-[var(--text-title)] tabular-nums break-words"
            value={e.value} onChange={entrySetter(edit, e, "value")} placeholder="%00" />
          <EditableText className="text-sm font-normal leading-5 text-[var(--text-subtitle)]"
            value={e.label} onChange={entrySetter(edit, e, "label")} placeholder="Metrik açıklaması" />
        </>
      )}
    />
  );
}

// ── Cards (özellik / sorun / çözüm kartları) ──────────────────────────────────

function CardsBlock({ block, preview, edit }: RenderProps) {
  const entries = visibleEntries(block, preview, "title", "text");
  if (!entries.length && !edit) return null;
  const cols = block.columns ?? 2;
  return (
    <Entries
      entries={entries}
      edit={edit}
      className={cn("grid grid-cols-1 gap-2.5 w-full", GRID_SM_COLS[cols])}
      itemClassName="flex flex-col gap-2 p-5 rounded-[22px] bg-[var(--bg-4)] min-w-0"
      render={(e) => (
        <>
          {(e.eyebrow || edit) && (
            <EditableText className="text-sm font-normal leading-5 text-[var(--text-subtitle)] tabular-nums"
              value={e.eyebrow} onChange={entrySetter(edit, e, "eyebrow")} placeholder="Üst etiket (opsiyonel)" />
          )}
          <EditableText className="text-base font-medium leading-6 text-[var(--text-title)]"
            value={e.title} onChange={entrySetter(edit, e, "title")} placeholder="Kart başlığı" />
          <EditableText as="p" rich multiline className="text-base font-light leading-6 text-[var(--text-p)] whitespace-pre-wrap"
            value={e.text} onChange={entrySetter(edit, e, "text")} placeholder="Kısa açıklama…" />
        </>
      )}
    />
  );
}

// ── Steps (süreç / zaman çizelgesi) ───────────────────────────────────────────

function StepsBlock({ block, preview, edit }: RenderProps) {
  const entries = visibleEntries(block, preview, "title", "text");
  if (!entries.length && !edit) return null;
  return (
    <Entries
      entries={entries}
      edit={edit}
      as="ol"
      className="flex flex-col w-full"
      itemAs="li"
      itemClassName="relative flex gap-4 pb-8 last:pb-0"
      strategy="vertical"
      render={(e, i) => (
        <>
          {i < entries.length - 1 && (
            <span aria-hidden className="absolute left-4 top-10 bottom-2 w-px bg-[var(--border-hover)]" />
          )}
          <span className="relative shrink-0 flex items-center justify-center w-8 h-8 rounded-full border border-[var(--border-hover)] bg-[var(--bg-2)] text-sm font-medium text-[var(--text-title)] tabular-nums">
            {i + 1}
          </span>
          <div className="flex flex-col gap-1 min-w-0 pt-1">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <EditableText className="text-base font-medium leading-6 text-[var(--text-title)]"
                value={e.title} onChange={entrySetter(edit, e, "title")} placeholder="Adım başlığı" />
              {(e.eyebrow || edit) && (
                <EditableText className="text-sm font-normal leading-5 text-[var(--text-subtitle)]"
                  value={e.eyebrow} onChange={entrySetter(edit, e, "eyebrow")} placeholder="Zaman (opsiyonel)" />
              )}
            </div>
            <EditableText as="p" rich multiline className="text-base font-light leading-7 text-[var(--text-p)] whitespace-pre-wrap"
              value={e.text} onChange={entrySetter(edit, e, "text")} placeholder="Bu adımda ne yapıldı?" />
          </div>
        </>
      )}
    />
  );
}

// ── Quote (alıntı / öne çıkan ifade) ──────────────────────────────────────────

function QuoteBlock({ block, preview, edit }: RenderProps) {
  if (!block.content && !preview) return null;
  return (
    <figure className="flex flex-col gap-5 w-full px-6 py-7 sm:px-8 sm:py-8 rounded-[32px] bg-[var(--bg-4)]">
      <span aria-hidden className="block h-5 text-[48px] font-medium leading-[0.9] text-[var(--text-subtitle)] select-none">
        &ldquo;
      </span>
      <EditableText as="blockquote" rich multiline
        className="text-[20px] sm:text-[22px] font-normal leading-8 sm:leading-9 tracking-[-0.01em] text-[var(--text-title)] whitespace-pre-wrap"
        value={block.content} onChange={edit && ((v) => edit.setText("content", v))} placeholder="Alıntı ya da öne çıkan ifade…" />
      {(block.author || block.authorRole || edit) && (
        <figcaption className="flex flex-col">
          <EditableText className="text-base font-medium leading-5 text-[var(--text-title)]"
            value={block.author} onChange={edit && ((v) => edit.setText("author", v))} placeholder="Kişi (opsiyonel)" />
          <EditableText className="text-base font-normal leading-6 text-[var(--text-subtitle)]"
            value={block.authorRole} onChange={edit && ((v) => edit.setText("authorRole", v))} placeholder="Unvan / şirket (opsiyonel)" />
        </figcaption>
      )}
    </figure>
  );
}

// ── Gallery (çoklu görsel) ────────────────────────────────────────────────────

function GalleryBlock({ block, preview, edit }: RenderProps) {
  const entries = visibleEntries(block, preview, "src");
  if (!entries.length && !edit) return null;
  const cols = block.columns ?? 2;
  const portrait = isPortrait(block.aspectRatio);
  return (
    <div className="flex flex-col gap-6 items-center pt-12 pb-9 w-full">
      <Entries
        entries={entries}
        edit={edit}
        className={cn("grid gap-3 w-full", portrait ? "grid-cols-2" : "grid-cols-1", GRID_SM_COLS[cols])}
        itemAs="figure"
        itemClassName="flex flex-col gap-3 min-w-0 rounded-[24px]"
        render={(e) => (
          <>
            <div
              className="relative w-full rounded-[24px] border border-[var(--border)] bg-[var(--bg-2)] overflow-hidden"
              style={aspectStyle(block.aspectRatio, "4/3")}
            >
              {e.src ? (
                <BlockImage src={e.src} alt={e.alt} editing={Boolean(edit)} className="w-full h-full object-cover" />
              ) : (
                <MediaPlaceholder label={e.alt} preview={preview} />
              )}
            </div>
            <EditableText as="figcaption" className="text-sm font-light leading-5 text-[var(--text-subtitle)] text-center"
              value={e.caption} onChange={entrySetter(edit, e, "caption")} placeholder="Görsel altı (opsiyonel)" />
          </>
        )}
      />
      <Caption block={block} edit={edit} />
    </div>
  );
}

// ── Compare (önce / sonra) ────────────────────────────────────────────────────

function CompareLabel({ entry, fallback, edit, side }: { entry?: BlockEntry; fallback: string; edit?: BlockEditApi; side: "left" | "right" }) {
  const cls = cn(
    "absolute top-[14px] inline-flex items-center h-8 px-3 rounded-full bg-[var(--bg-1)]/80 backdrop-blur-sm text-[13px] font-medium text-[var(--text-title)]",
    side === "left" ? "left-[14px]" : "right-[14px]",
    edit ? "pointer-events-auto" : "pointer-events-none"
  );
  if (!edit || !entry) return <span className={cls}>{entry?.label || fallback}</span>;
  // Stop the slider from grabbing presses on the label while it is being edited.
  return (
    <span className={cls} onPointerDown={(e) => e.stopPropagation()}>
      <EditableText value={entry.label} onChange={(v) => edit.setEntryText(entry.id, "label", v)} placeholder={fallback} />
    </span>
  );
}

function CompareBlock({ block, preview, edit }: RenderProps) {
  const [before, after] = [block.entries?.[0], block.entries?.[1]];
  const [pos, setPos] = useState(50);
  const frameRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  if (!preview && !before?.src && !after?.src) return null;

  function moveTo(clientX: number) {
    const rect = frameRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    setPos(Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100)));
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    const step = e.shiftKey ? 10 : 2;
    if (e.key === "ArrowLeft")  { e.preventDefault(); setPos((p) => Math.max(0, p - step)); }
    if (e.key === "ArrowRight") { e.preventDefault(); setPos((p) => Math.min(100, p + step)); }
    if (e.key === "Home") { e.preventDefault(); setPos(0); }
    if (e.key === "End")  { e.preventDefault(); setPos(100); }
  }

  const beforeLabel = before?.label || "Önce";
  const afterLabel = after?.label || "Sonra";

  return (
    <div className="flex flex-col gap-6 items-center pt-12 pb-9 w-full">
      <div
        ref={frameRef}
        role="slider"
        tabIndex={0}
        // The slider owns its pointer; in the editor the block is moved from its handle instead.
        data-no-drag={edit ? "" : undefined}
        aria-label={`${beforeLabel} / ${afterLabel}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pos)}
        onKeyDown={handleKeyDown}
        onPointerDown={(e) => {
          draggingRef.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          moveTo(e.clientX);
        }}
        onPointerMove={(e) => { if (draggingRef.current) moveTo(e.clientX); }}
        onPointerUp={() => { draggingRef.current = false; }}
        onPointerCancel={() => { draggingRef.current = false; }}
        className="relative w-full rounded-[32px] border border-[var(--border)] bg-[var(--bg-2)] overflow-hidden select-none cursor-ew-resize outline-none focus-visible:border-[var(--border-hover)]"
        style={{ ...aspectStyle(block.aspectRatio, "16/9"), touchAction: "pan-y" }}
      >
        {/* After — full frame */}
        {after?.src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={after.src} alt={after.alt ?? ""} draggable={false} className="absolute inset-0 w-full h-full object-cover pointer-events-none" />
        ) : (
          <MediaPlaceholder label={after?.alt || "Sonra görseli"} preview={preview} side="right" />
        )}

        {/* Before — clipped to the handle position */}
        <div className="absolute inset-0 bg-[var(--bg-4)]" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
          {before?.src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={before.src} alt={before.alt ?? ""} draggable={false} className="absolute inset-0 w-full h-full object-cover pointer-events-none" />
          ) : (
            <MediaPlaceholder label={before?.alt || "Önce görseli"} preview={preview} side="left" />
          )}
        </div>

        {/* Handle */}
        <div aria-hidden className="absolute top-0 bottom-0 w-px bg-[var(--bg-1)] pointer-events-none" style={{ left: `${pos}%` }}>
          <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center w-10 h-10 rounded-full border border-[var(--border)] bg-[var(--bg-1)] text-[var(--text-title)] shadow-[0_4px_16px_rgba(0,0,0,0.16)]">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M6 4L2 8l4 4M10 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </div>

        <CompareLabel entry={before} fallback="Önce" edit={edit} side="left" />
        <CompareLabel entry={after} fallback="Sonra" edit={edit} side="right" />
      </div>
      <Caption block={block} edit={edit} />
    </div>
  );
}

// ── Links (bağlantılar) ───────────────────────────────────────────────────────

function LinkIcon({ icon }: { icon?: LinkIconType }) {
  const common = { width: 16, height: 16, viewBox: "0 0 16 16", fill: "none", "aria-hidden": true } as const;
  switch (icon) {
    case "web":
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.3" />
          <path d="M2 8h12M8 2c1.7 1.8 2.5 3.8 2.5 6S9.7 12.2 8 14c-1.7-1.8-2.5-3.8-2.5-6S6.3 3.8 8 2z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
        </svg>
      );
    case "appstore":
      return (
        <svg {...common}>
          <rect x="1.75" y="1.75" width="12.5" height="12.5" rx="3.5" stroke="currentColor" strokeWidth="1.3" />
          <path d="M6.2 10.8L8.9 5.2M9.8 10.8L7.1 5.2M5 9.2h6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      );
    case "playstore":
      return (
        <svg {...common}>
          <path d="M3.5 2.5v11l9-5.5-9-5.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
        </svg>
      );
    case "github":
      return (
        <svg {...common}>
          <path d="M5.5 4.5L2 8l3.5 3.5M10.5 4.5L14 8l-3.5 3.5M9 3l-2 10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "figma":
      return (
        <svg {...common}>
          <path d="M5.5 5.5a2 2 0 1 0 0-4h2.5v4H5.5zm0 5a2 2 0 1 0 0-4h2.5v4H5.5zm0 4.25a2 2 0 0 0 2-2V10.5H5.5a2 2 0 1 0 0 4.25zm5-9.25a2 2 0 1 0-2-2v4h2a2 2 0 1 0 0-4zm-2 6.75a2 2 0 0 0 2-2H8v2z" fill="currentColor" />
        </svg>
      );
    case "behance":
      return (
        <svg {...common}>
          <path d="M2 4h3.2a1.8 1.8 0 010 3.6H2V4zm0 3.6h3.6a2 2 0 010 4H2V7.6zM9.5 9.2h4.5a2.25 2.25 0 10-.6 1.8M10 4.8h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <path d="M9 3h4v4M13 3L7 9M6 4H4a1 1 0 00-1 1v7a1 1 0 001 1h7a1 1 0 001-1v-2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
  }
}

const LINK_PILL = "inline-flex items-center gap-2 h-10 px-4 rounded-full border border-[var(--border)] bg-[var(--bg-2)] text-[14px] font-medium leading-5 text-[var(--text-title)] transition-all duration-200 hover:bg-[var(--bg-4)] hover:border-[var(--border-hover)] active:scale-[0.97]";

function LinksBlock({ block, preview, edit }: RenderProps) {
  const entries = visibleEntries(block, preview, "href");
  if (!entries.length && !edit) return null;
  if (!edit) {
    return (
      <div className="flex flex-wrap gap-2 w-full">
        {entries.map((e) => (
          <a key={e.id} href={e.href && isSafeHref(e.href) ? e.href : undefined} target="_blank" rel="noopener noreferrer" className={LINK_PILL}>
            <LinkIcon icon={e.icon} />
            {e.label || e.href}
          </a>
        ))}
      </div>
    );
  }
  // Editor: pills are not links (the address is set in the settings panel).
  return (
    <Entries
      entries={entries}
      edit={edit}
      className="flex flex-wrap gap-2 w-full"
      itemAs="span"
      itemClassName={cn(LINK_PILL, "rounded-full")}
      render={(e) => (
        <>
          <LinkIcon icon={e.icon} />
          <EditableText value={e.label} onChange={entrySetter(edit, e, "label")} placeholder={e.href || "Bağlantı"} />
        </>
      )}
    />
  );
}

// ── Tags (etiketler) ──────────────────────────────────────────────────────────

function TagsBlock({ block, preview, edit }: RenderProps) {
  const entries = visibleEntries(block, preview, "label");
  if (!entries.length && !edit) return null;
  return (
    <Entries
      entries={entries}
      edit={edit}
      as="ul"
      className="flex flex-wrap gap-2 w-full"
      itemAs="li"
      itemClassName="inline-flex items-center h-8 px-3.5 rounded-full bg-[var(--bg-4)] text-[13px] font-medium leading-5 text-[var(--text-p)]"
      render={(e) => <EditableText value={e.label} onChange={entrySetter(edit, e, "label")} placeholder="Etiket" />}
    />
  );
}

// ── Shared: avatar with initials fallback ─────────────────────────────────────

function Avatar({ src, name, size }: { src?: string; name?: string; size: number }) {
  const initials = (name ?? "")
    .split(/\s+/)
    .filter((w) => /^\p{L}/u.test(w)) // "Ayşe, 34" → A, not A3
    .slice(0, 2)
    .map((w) => w[0]?.toLocaleUpperCase("tr"))
    .join("");
  return (
    <span
      className="relative shrink-0 flex items-center justify-center rounded-full overflow-hidden border border-[var(--border)] bg-[var(--bg-1)] font-medium text-[var(--text-subtitle)] select-none"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={name ?? ""} draggable={false} className="absolute inset-0 w-full h-full object-cover" />
      ) : (
        initials || "?"
      )}
    </span>
  );
}

function ExternalGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden className="shrink-0 text-[var(--text-subtitle)]">
      <path d="M9 3h4v4M13 3L7 9M6 4H4a1 1 0 00-1 1v7a1 1 0 001 1h7a1 1 0 001-1v-2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Callout (not / içgörü / ipucu / dikkat) ───────────────────────────────────

type CalloutVariant = "note" | "insight" | "tip" | "warning";

const CALLOUT: Record<CalloutVariant, { label: string; icon: ReactNode }> = {
  note: {
    label: "Not",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
        <circle cx="10" cy="10" r="7.25" stroke="currentColor" strokeWidth="1.5" />
        <path d="M10 9v4.5M10 6.5v.01" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    ),
  },
  insight: {
    label: "İçgörü",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
        <path d="M7.5 14.5h5M8.25 17h3.5M10 3a5 5 0 00-3 9c.6.45 1 1.1 1 1.85v.15h4v-.15c0-.75.4-1.4 1-1.85A5 5 0 0010 3z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  tip: {
    label: "İpucu",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
        <path d="M10 2.75l1.6 4.15 4.15 1.6-4.15 1.6L10 14.25 8.4 10.1 4.25 8.5 8.4 6.9 10 2.75zM15.5 13.5l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6.6-1.4z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      </svg>
    ),
  },
  warning: {
    label: "Dikkat",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
        <path d="M8.7 3.75a1.5 1.5 0 012.6 0l6 10.5a1.5 1.5 0 01-1.3 2.25H4a1.5 1.5 0 01-1.3-2.25l6-10.5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M10 8v3.5M10 14v.01" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    ),
  },
};

function CalloutBlock({ block, preview, edit }: RenderProps) {
  if (!preview && !block.content && !block.title) return null;
  const variant: CalloutVariant = block.variant && block.variant in CALLOUT ? (block.variant as CalloutVariant) : "note";
  const meta = CALLOUT[variant];
  return (
    <aside className="flex gap-3.5 w-full p-5 rounded-[22px] bg-[var(--bg-4)]">
      <span className="shrink-0 mt-0.5 text-[var(--project-accent,var(--text-title))]">{meta.icon}</span>
      <div className="flex flex-col gap-1 min-w-0 flex-1">
        {edit ? (
          <EditableText className="text-base font-medium leading-6 text-[var(--text-title)]"
            value={block.title} onChange={(v) => edit.setText("title", v)} placeholder={meta.label} />
        ) : (
          <span className="text-base font-medium leading-6 text-[var(--text-title)]">{block.title || meta.label}</span>
        )}
        <EditableText as="p" rich multiline className="text-base font-light leading-7 text-[var(--text-p)] whitespace-pre-wrap"
          value={block.content} onChange={edit && ((v) => edit.setText("content", v))} placeholder="Not metni…" />
      </div>
    </aside>
  );
}

// ── Accordion (açılır detaylar) ───────────────────────────────────────────────

function AccordionBlock({ block, preview, edit }: RenderProps) {
  const entries = visibleEntries(block, preview, "title", "text");
  const [openId, setOpenId] = useState<string | null>(null);
  const baseId = useId();
  if (!entries.length && !edit) return null;

  // Editor: every item open so its content can be edited in place.
  if (edit) {
    return (
      <Entries
        entries={entries}
        edit={edit}
        className="flex flex-col gap-2.5 w-full"
        itemClassName="rounded-[22px] bg-[var(--bg-4)]"
        strategy="vertical"
        render={(e) => (
          <div className="flex flex-col gap-1 px-5 py-3.5">
            <EditableText className="text-base font-normal leading-6 text-[var(--text-title)]"
              value={e.title} onChange={entrySetter(edit, e, "title")} placeholder="Başlık" />
            <EditableText as="p" rich multiline className="text-base font-light leading-7 text-[var(--text-p)] whitespace-pre-wrap"
              value={e.text} onChange={entrySetter(edit, e, "text")} placeholder="Açılınca görünecek içerik…" />
          </div>
        )}
      />
    );
  }

  return (
    <div className="flex flex-col gap-2.5 w-full">
      {entries.map((e) => {
        const isOpen = openId === e.id;
        const panelId = `${baseId}-${e.id}`;
        return (
          <div key={e.id} className="rounded-[22px] bg-[var(--bg-4)]">
            <button
              type="button"
              aria-expanded={isOpen}
              aria-controls={panelId}
              onClick={() => setOpenId(isOpen ? null : e.id)}
              className="flex w-full items-center justify-between gap-4 px-5 py-3.5 text-left cursor-pointer"
            >
              <span className="text-base font-normal leading-6 text-[var(--text-title)]">{e.title}</span>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden
                className={cn("shrink-0 text-[var(--text-subtitle)] transition-transform duration-300", isOpen && "rotate-180")}>
                <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <div
              id={panelId}
              role="region"
              inert={!isOpen}
              className={cn("grid transition-[grid-template-rows] duration-300 ease-out", isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}
            >
              <div className="overflow-hidden">
                <p className="px-5 pb-4 text-base font-light leading-7 text-[var(--text-p)] whitespace-pre-wrap">
                  {e.text ? renderRichText(e.text) : null}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Mockup (cihaz çerçevesi) ──────────────────────────────────────────────────

type MockupVariant = "phone" | "browser" | "tablet";

function DeviceFrame({ variant, entry, preview, edit }: { variant: MockupVariant; entry: BlockEntry; preview: boolean; edit?: BlockEditApi }) {
  const screen = entry.src ? (
    <BlockImage src={entry.src} alt={entry.alt} editing={Boolean(edit)} className="w-full h-full object-cover object-top" />
  ) : (
    <MediaPlaceholder label={entry.alt} preview={preview} />
  );

  if (variant === "browser") {
    return (
      <div className="w-full rounded-[16px] border border-[var(--border-hover)] bg-[var(--bg-1)] overflow-hidden shadow-[0_12px_32px_rgba(0,0,0,0.08)]">
        <div className="flex items-center gap-3 h-9 px-3.5 border-b border-[var(--border)]">
          <div className="flex gap-1.5 w-[42px]">
            {[0, 1, 2].map((i) => <span key={i} className="w-2.5 h-2.5 rounded-full bg-[var(--bg-5)]" />)}
          </div>
          <div className="flex-1 flex justify-center min-w-0">
            <span className="max-w-[70%] truncate inline-flex items-center h-6 px-3 rounded-full bg-[var(--bg-4)] text-[12px] leading-4 text-[var(--text-subtitle)]">
              {edit ? (
                <EditableText value={entry.label} onChange={(v) => edit.setEntryText(entry.id, "label", v)} placeholder="burakkoc.net" />
              ) : (
                entry.label || "burakkoc.net"
              )}
            </span>
          </div>
          <div className="w-[42px]" />
        </div>
        <div className="relative w-full bg-[var(--bg-2)]" style={{ aspectRatio: "16 / 10" }}>{screen}</div>
      </div>
    );
  }

  const phone = variant === "phone";
  return (
    <div className={cn(
      // ring: keeps the dark frame's edge visible on the dark theme
      "relative w-full bg-[#0d0d0d] ring-1 ring-white/10 shadow-[0_16px_40px_rgba(0,0,0,0.18)]",
      phone ? "rounded-[36px] p-[7px]" : "rounded-[28px] p-[10px]"
    )}>
      <div
        className={cn("relative w-full overflow-hidden bg-[var(--bg-2)]", phone ? "rounded-[29px]" : "rounded-[18px]")}
        style={{ aspectRatio: phone ? "9 / 19.5" : "4 / 3" }}
      >
        {screen}
        {phone && (
          <span aria-hidden className="absolute top-2 left-1/2 -translate-x-1/2 w-[30%] h-[18px] rounded-full bg-[#0d0d0d] z-10 pointer-events-none" />
        )}
      </div>
    </div>
  );
}

function MockupBlock({ block, preview, edit }: RenderProps) {
  const entries = visibleEntries(block, preview, "src");
  if (!entries.length && !edit) return null;
  const variant: MockupVariant = block.variant === "browser" || block.variant === "tablet" ? block.variant : "phone";
  return (
    <div className="flex flex-col gap-6 items-center pt-12 pb-9 w-full">
      <div className="w-full rounded-[32px] border border-[var(--border)] bg-[var(--bg-4)] overflow-hidden p-4 sm:p-10">
        <Entries
          entries={entries}
          edit={edit}
          className={cn(
            "flex w-full",
            variant === "browser" ? "flex-col gap-6" : "items-center justify-center gap-3 sm:gap-6 py-4 sm:py-2"
          )}
          itemClassName={variant === "phone" ? "flex-1 min-w-0 max-w-[220px] rounded-[36px]" : variant === "tablet" ? "flex-1 min-w-0 max-w-[460px] rounded-[28px]" : "w-full rounded-[16px]"}
          strategy={variant === "browser" ? "vertical" : "grid"}
          render={(e) => <DeviceFrame variant={variant} entry={e} preview={preview} edit={edit} />}
        />
      </div>
      <Caption block={block} edit={edit} />
    </div>
  );
}

// ── Split (görsel + metin yan yana) ───────────────────────────────────────────

function SplitBlock({ block, preview, edit }: RenderProps) {
  if (!preview && !block.src && !block.title && !block.content) return null;
  const imageRight = block.variant === "right";
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8 items-center w-full py-6">
      <div
        className={cn("relative w-full rounded-[24px] border border-[var(--border)] bg-[var(--bg-2)] overflow-hidden", imageRight && "sm:order-2")}
        style={aspectStyle(block.aspectRatio, "4/3")}
      >
        {block.src ? (
          <BlockImage src={block.src} alt={block.alt} editing={Boolean(edit)} className="w-full h-full object-cover" />
        ) : (
          <MediaPlaceholder label={block.alt} preview={preview} />
        )}
      </div>
      <div className="flex flex-col gap-2 min-w-0">
        <EditableText as="h3" className="text-base font-medium leading-6 text-[var(--text-title)]"
          value={block.title} onChange={edit && ((v) => edit.setText("title", v))} placeholder="Başlık" />
        <EditableText as="p" rich multiline className="text-base font-light leading-7 text-[var(--text-p)] whitespace-pre-wrap"
          value={block.content} onChange={edit && ((v) => edit.setText("content", v))} placeholder="Görseli destekleyen kısa metin…" />
      </div>
    </div>
  );
}

// ── Table (karşılaştırma / rakip analizi) ─────────────────────────────────────

const CHECK_TOKENS = new Set(["✓", "✔", "✅"]);
const CROSS_TOKENS = new Set(["✗", "✕", "×", "❌"]);

function tableCellDisplay(value: string): ReactNode {
  const v = value.trim();
  if (CHECK_TOKENS.has(v)) {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" role="img" aria-label="Var" className="inline-block text-[var(--text-title)]">
        <path d="M3 8.5l3 3 7-7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (CROSS_TOKENS.has(v)) {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" role="img" aria-label="Yok" className="inline-block text-[var(--text-subtitle)] opacity-60">
        <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );
  }
  return renderRichText(value);
}

function TableBlock({ block, preview, edit }: RenderProps) {
  const rows = block.tableRows ?? [];
  const hasContent = rows.some((r) => r.cells.some((c) => c.trim() !== ""));
  if (!rows.length || (!preview && !hasContent)) return null;

  const colCount = Math.max(1, ...rows.map((r) => r.cells.length));
  const pad = (cells: string[]) => Array.from({ length: colCount }, (_, i) => cells[i] ?? "");
  const withHeader = block.tableHeader !== false;
  const head = withHeader ? rows[0] : undefined;
  const body = withHeader ? rows.slice(1) : rows;

  const cell = (rowId: string, col: number, value: string, placeholder: string) =>
    edit ? (
      <EditableText value={value} onChange={(v) => edit.setTableCell(rowId, col, v)} placeholder={placeholder} display={tableCellDisplay} />
    ) : (
      tableCellDisplay(value)
    );

  return (
    <div className="flex flex-col gap-6 items-center w-full py-4">
      <div className="w-full overflow-x-auto rounded-[22px] border border-[var(--border)]">
        <table className="w-full min-w-[480px] border-collapse text-left">
          {head && (
            <thead>
              <tr className="bg-[var(--bg-4)]">
                {pad(head.cells).map((c, i) => (
                  <th key={i} scope="col" className="px-4 py-3 text-sm font-medium leading-5 text-[var(--text-title)] align-bottom">
                    {cell(head.id, i, c, "Başlık")}
                  </th>
                ))}
              </tr>
            </thead>
          )}
          <tbody>
            {body.map((r) => (
              <tr key={r.id} className="border-t border-[var(--border)] first:border-t-0">
                {pad(r.cells).map((c, i) =>
                  i === 0 ? (
                    <th key={i} scope="row" className="px-4 py-3 text-sm font-normal leading-5 text-[var(--text-title)] align-top">
                      {cell(r.id, i, c, "—")}
                    </th>
                  ) : (
                    <td key={i} className="px-4 py-3 text-sm font-light leading-5 text-[var(--text-p)] align-top">
                      {cell(r.id, i, c, "—")}
                    </td>
                  )
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Caption block={block} edit={edit} />
    </div>
  );
}

// ── Bars (anket / test sonucu grafiği) ────────────────────────────────────────

function parsePercent(raw?: string): number | null {
  if (!raw) return null;
  const n = parseFloat(raw.replace("%", "").replace(",", ".").trim());
  return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : null;
}

function formatPercent(raw: string) {
  const pct = parsePercent(raw);
  return pct === null ? raw : `%${pct.toLocaleString("tr-TR", { maximumFractionDigits: 1 })}`;
}

function BarsBlock({ block, preview, edit }: RenderProps) {
  const entries = visibleEntries(block, preview, "label", "value");
  if (!entries.length && !edit) return null;
  return (
    <div className="flex flex-col gap-6 items-center w-full py-4">
      <div className="flex flex-col gap-4 w-full p-5 rounded-[22px] bg-[var(--bg-4)]">
        {(block.title || edit) && (
          <EditableText className="text-base font-medium leading-6 text-[var(--text-title)]"
            value={block.title} onChange={edit && ((v) => edit.setText("title", v))} placeholder="Soru / başlık (opsiyonel)" />
        )}
        <Entries
          entries={entries}
          edit={edit}
          className="flex flex-col gap-4 w-full"
          itemClassName="flex flex-col gap-2 rounded-[8px]"
          strategy="vertical"
          render={(e) => {
            const pct = parsePercent(e.value);
            return (
              <>
                <div className="flex items-baseline justify-between gap-4">
                  <EditableText className="text-sm font-normal leading-5 text-[var(--text-p)]"
                    value={e.label} onChange={entrySetter(edit, e, "label")} placeholder="Seçenek" />
                  {edit ? (
                    <EditableText className="text-sm font-medium leading-5 text-[var(--text-title)] tabular-nums"
                      value={e.value} onChange={entrySetter(edit, e, "value")} placeholder="%0" display={formatPercent} />
                  ) : (
                    <span className="text-sm font-medium leading-5 text-[var(--text-title)] tabular-nums">
                      {pct === null ? "—" : formatPercent(e.value ?? "")}
                    </span>
                  )}
                </div>
                <div aria-hidden className="h-2 w-full rounded-full bg-[var(--progress-track)] overflow-hidden">
                  <div className="h-full rounded-full bg-[var(--project-accent,var(--text-title))] transition-[width] duration-300" style={{ width: `${pct ?? 0}%` }} />
                </div>
                {(e.text || edit) && (
                  <EditableText className="text-sm font-light leading-5 text-[var(--text-subtitle)]"
                    value={e.text} onChange={entrySetter(edit, e, "text")} placeholder="Not (opsiyonel)" />
                )}
              </>
            );
          }}
        />
      </div>
      <Caption block={block} edit={edit} />
    </div>
  );
}

// ── Persona ───────────────────────────────────────────────────────────────────

function personaItems(text: string): ReactNode {
  const items = text.split("\n").map((l) => l.trim()).filter(Boolean);
  return (
    // Fit-content, so the live editor's hover tint only reacts over the lines themselves.
    <ul className="flex flex-col gap-1.5 w-fit">
      {items.map((line, i) => (
        <li key={i} className="flex gap-2">
          <span aria-hidden className="shrink-0 mt-[11px] w-1 h-1 rounded-full bg-[var(--text-subtitle)]" />
          <span className="min-w-0">{renderRichText(line)}</span>
        </li>
      ))}
    </ul>
  );
}

function PersonaBlock({ block, preview, edit }: RenderProps) {
  const groups = visibleEntries(block, preview, "label", "text");
  if (!preview && !block.title && !groups.length) return null;
  return (
    <div className="flex flex-col gap-5 w-full p-5 sm:p-6 rounded-[32px] bg-[var(--bg-4)]">
      <div className="flex items-center gap-4">
        <Avatar src={block.src} name={block.title} size={64} />
        <div className="flex flex-col min-w-0">
          <EditableText className="text-base font-medium leading-6 text-[var(--text-title)]"
            value={block.title} onChange={edit && ((v) => edit.setText("title", v))} placeholder="Persona adı" />
          <EditableText className="text-base font-normal leading-6 text-[var(--text-subtitle)]"
            value={block.subheading} onChange={edit && ((v) => edit.setText("subheading", v))} placeholder="Yaş · meslek · şehir" />
        </div>
      </div>
      <EditableText as="p" rich multiline className="text-base font-light leading-7 text-[var(--text-p)] whitespace-pre-wrap"
        value={block.content} onChange={edit && ((v) => edit.setText("content", v))} placeholder="Kısa tanım ya da persona sözü (opsiyonel)" />
      {(groups.length > 0 || edit) && (
        <Entries
          entries={groups}
          edit={edit}
          className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full"
          itemClassName="flex flex-col gap-2 p-4 rounded-[18px] bg-[var(--bg-1)] min-w-0"
          render={(g) => (
            <>
              <EditableText className="text-sm font-medium leading-5 text-[var(--text-title)]"
                value={g.label} onChange={entrySetter(edit, g, "label")} placeholder="Grup başlığı" />
              <EditableText as="div" multiline className="text-sm font-light leading-6 text-[var(--text-p)]"
                value={g.text} onChange={entrySetter(edit, g, "text")} placeholder="Her satır bir madde" display={personaItems} />
            </>
          )}
        />
      )}
    </div>
  );
}

// ── Team (ekip / katkıda bulunanlar) ──────────────────────────────────────────

function TeamBlock({ block, preview, edit }: RenderProps) {
  const entries = visibleEntries(block, preview, "title");
  if (!entries.length && !edit) return null;
  const cls = "flex items-center gap-3 p-3 pr-4 rounded-[22px] bg-[var(--bg-4)] min-w-0";

  if (edit) {
    return (
      <Entries
        entries={entries}
        edit={edit}
        className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full"
        itemClassName={cls}
        render={(e) => (
          <>
            <Avatar src={e.src} name={e.title} size={44} />
            <div className="flex flex-col min-w-0 flex-1">
              <EditableText className="text-base font-medium leading-6 text-[var(--text-title)] truncate"
                value={e.title} onChange={entrySetter(edit, e, "title")} placeholder="Ad Soyad" />
              <EditableText className="text-sm font-normal leading-5 text-[var(--text-subtitle)] truncate"
                value={e.text} onChange={entrySetter(edit, e, "text")} placeholder="Rol" />
            </div>
            {e.href && isSafeHref(e.href) && <ExternalGlyph />}
          </>
        )}
      />
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full">
      {entries.map((e) => {
        const inner = (
          <>
            <Avatar src={e.src} name={e.title} size={44} />
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-base font-medium leading-6 text-[var(--text-title)] truncate">{e.title}</span>
              <span className="text-sm font-normal leading-5 text-[var(--text-subtitle)] truncate">{e.text}</span>
            </div>
            {e.href && isSafeHref(e.href) && <ExternalGlyph />}
          </>
        );
        return e.href && isSafeHref(e.href) ? (
          <a key={e.id} href={e.href} target="_blank" rel="noopener noreferrer"
            className={cn(cls, "transition-colors duration-200 hover:bg-[var(--bg-5)]")}>
            {inner}
          </a>
        ) : (
          <div key={e.id} className={cls}>{inner}</div>
        );
      })}
    </div>
  );
}

// ── Palette (renk paleti) ─────────────────────────────────────────────────────

function PaletteBlock({ block, preview, edit }: RenderProps) {
  const entries = visibleEntries(block, preview, "value");
  if (!entries.length && !edit) return null;
  const cols = block.columns ?? 4;
  return (
    <Entries
      entries={entries}
      edit={edit}
      className={cn("grid grid-cols-2 gap-2.5 w-full", cols !== 2 && GRID_SM_COLS[cols])}
      itemClassName="flex flex-col rounded-[22px] bg-[var(--bg-4)] overflow-hidden min-w-0"
      render={(e) => (
        <>
          <div className="h-24 shadow-[inset_0_-1px_0_var(--border)]" style={{ backgroundColor: e.value || "transparent" }} />
          <div className="flex flex-col gap-0.5 px-4 py-3 min-w-0">
            <EditableText className="text-sm font-medium leading-5 text-[var(--text-title)] truncate"
              value={e.label} onChange={entrySetter(edit, e, "label")} placeholder="Renk adı" />
            <EditableText className="text-[13px] font-normal leading-5 text-[var(--text-subtitle)] tabular-nums truncate"
              value={e.value} onChange={entrySetter(edit, e, "value")} placeholder="#1A1A1A" />
            <EditableText className="text-[13px] font-light leading-5 text-[var(--text-subtitle)]"
              value={e.text} onChange={entrySetter(edit, e, "text")} placeholder="Kullanım (opsiyonel)" />
          </div>
        </>
      )}
    />
  );
}

// ── Entry point ───────────────────────────────────────────────────────────────

const RENDERERS: Record<CaseStudyBlockType, (props: RenderProps) => ReactNode> = {
  info: InfoBlock,
  stats: StatsBlock,
  cards: CardsBlock,
  steps: StepsBlock,
  quote: QuoteBlock,
  gallery: GalleryBlock,
  compare: CompareBlock,
  links: LinksBlock,
  tags: TagsBlock,
  callout: CalloutBlock,
  accordion: AccordionBlock,
  mockup: MockupBlock,
  split: SplitBlock,
  table: TableBlock,
  bars: BarsBlock,
  persona: PersonaBlock,
  team: TeamBlock,
  palette: PaletteBlock,
};

export function CaseStudyBlock({ block, animate = false, edit }: { block: Block; animate?: boolean; edit?: BlockEditApi }) {
  if (!isCaseStudyBlock(block.type)) return null;
  const Renderer = RENDERERS[block.type];
  const content = <Renderer block={block} preview={Boolean(edit)} edit={edit} />;
  return animate ? <ScrollReveal className="w-full">{content}</ScrollReveal> : content;
}
