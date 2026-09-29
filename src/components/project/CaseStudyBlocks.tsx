"use client";

import { useRef, useState, type CSSProperties, type ReactNode } from "react";
import { AspectRatio, Block, BlockEntry, BlockType, LinkIconType } from "@/types/project";
import { ZoomableImage } from "@/components/ZoomableImage";
import { cn } from "@/lib/utils";
import { isSafeHref, renderRichText } from "./RichText";
import { EditableText } from "./Editable";
import { Entries } from "./Entries";
import type { BlockEditApi } from "./editing";

/**
 * The pieces the site's code draws inside the case-study components (see
 * PartLayer, ComponentView): an image at its aspect ratio, the Önce / Sonra
 * slider, device frames, a table, an avatar, a bar, a colour swatch, icons
 * and marks. Each takes its layer's size and place in its component's auto
 * layout (`style`) and marks itself with its layer (`data-layer-id`).
 */

export const CASE_STUDY_BLOCK_TYPES = [
  "info", "stats", "cards", "steps", "quote", "gallery", "compare", "links", "tags",
  "callout", "accordion", "mockup", "split", "table", "bars", "persona", "team", "palette",
] as const satisfies readonly BlockType[];

export type CaseStudyBlockType = (typeof CASE_STUDY_BLOCK_TYPES)[number];

export function isCaseStudyBlock(type: BlockType): type is CaseStudyBlockType {
  return (CASE_STUDY_BLOCK_TYPES as readonly BlockType[]).includes(type);
}

/** What a part gets: its instance (and item), and its layer's place in the component. */
export interface PartProps {
  block: Block;
  /** The item it belongs to — in a component the instance repeats */
  entry?: BlockEntry;
  /** Its item's place among them */
  index: number;
  count: number;
  /** Editing: placeholders, no links */
  preview: boolean;
  edit?: BlockEditApi;
  style: CSSProperties;
  layerId: string;
}

// ── Shared bits ───────────────────────────────────────────────────────────────

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

export function isPortrait(ratio: AspectRatio | undefined) {
  return ratio === "3/4" || ratio === "9/16";
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

// ── Images ────────────────────────────────────────────────────────────────────

/** A Galeri görseli's image: its box at the gallery's aspect ratio. */
export function ItemImage({ block, entry, preview, edit, style, layerId }: PartProps) {
  return (
    <div
      data-layer-id={layerId}
      className="relative w-full rounded-[24px] border border-[var(--border)] bg-[var(--bg-2)] overflow-hidden"
      style={{ ...style, ...aspectStyle(block.aspectRatio, "4/3") }}
    >
      {entry?.src ? (
        <BlockImage src={entry.src} alt={entry.alt} editing={Boolean(edit)} className="w-full h-full object-cover" />
      ) : (
        <MediaPlaceholder label={entry?.alt} preview={preview} />
      )}
    </div>
  );
}

/** The Görsel + Metin component's image — on the right from 640px up when the block says so. */
export function SplitImage({ block, preview, edit, style, layerId }: PartProps) {
  return (
    <div
      data-layer-id={layerId}
      className={cn("relative w-full rounded-[24px] border border-[var(--border)] bg-[var(--bg-2)] overflow-hidden", block.variant === "right" && "sm:order-2")}
      style={{ ...style, ...aspectStyle(block.aspectRatio, "4/3") }}
    >
      {block.src ? (
        <BlockImage src={block.src} alt={block.alt} editing={Boolean(edit)} className="w-full h-full object-cover" />
      ) : (
        <MediaPlaceholder label={block.alt} preview={preview} />
      )}
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

/** The Önce / Sonra component's slider: the two images, the handle and their labels, at the block's aspect ratio. */
export function CompareSlider({ block, preview, edit, style, layerId }: PartProps) {
  const [before, after] = [block.entries?.[0], block.entries?.[1]];
  const [pos, setPos] = useState(50);
  const frameRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

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
      <div
        ref={frameRef}
        data-layer-id={layerId}
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
        style={{ ...style, ...aspectStyle(block.aspectRatio, "16/9"), touchAction: "pan-y" }}
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

/** The Cihaz Çerçevesi component's devices: its screens side by side (phones, tablets) or stacked (browsers). */
export function DevicesRow({ block, preview, edit, style, layerId }: PartProps) {
  const entries = block.entries ?? [];
  const shown = preview ? entries : entries.filter((e) => e.src?.trim());
  const variant: MockupVariant = block.variant === "browser" || block.variant === "tablet" ? block.variant : "phone";
  return (
    <Entries
      items={shown}
      onMove={edit?.moveEntry}
      frame={{ "data-layer-id": layerId }}
      style={style}
      className={cn("flex w-full", variant === "browser" ? "flex-col gap-6" : "items-center justify-center gap-3 sm:gap-6 py-4 sm:py-2")}
      itemClassName={variant === "phone" ? "flex-1 min-w-0 max-w-[220px] rounded-[36px]" : variant === "tablet" ? "flex-1 min-w-0 max-w-[460px] rounded-[28px]" : "w-full rounded-[16px]"}
      strategy={variant === "browser" ? "vertical" : "grid"}
      render={(e) => <DeviceFrame variant={variant} entry={e} preview={preview} edit={edit} />}
    />
  );
}

// ── Table ─────────────────────────────────────────────────────────────────────

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

/** The Tablo component's table: its header row, its rows — ✓ / ✗ drawn as marks — scrolling sideways when narrow. */
export function TableView({ block, edit, style, layerId }: PartProps) {
  const rows = block.tableRows ?? [];

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
      <div data-layer-id={layerId} className="w-full overflow-x-auto rounded-[22px] border border-[var(--border)]" style={style}>
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
  );
}

// ── Marks and icons ───────────────────────────────────────────────────────────

/** The Alıntı component's opening quote mark. */
export function QuoteMark({ style, layerId }: PartProps) {
  return (
    <span data-layer-id={layerId} aria-hidden className="block h-5 text-[48px] font-medium leading-[0.9] text-[var(--text-subtitle)] select-none" style={style}>
      &ldquo;
    </span>
  );
}

export type CalloutVariant = "note" | "insight" | "tip" | "warning";

export const CALLOUT: Record<CalloutVariant, { label: string; icon: ReactNode }> = {
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

/** A callout's kind of the block (its variant), a note unless set. */
export const calloutOf = (block: Block): CalloutVariant => (block.variant && block.variant in CALLOUT ? (block.variant as CalloutVariant) : "note");

/** The Not Kutusu component's icon: its kind's, in the project's accent. */
export function CalloutIcon({ block, style, layerId }: PartProps) {
  return (
    <span data-layer-id={layerId} className="shrink-0 mt-0.5 text-[var(--project-accent,var(--text-title))]" style={style}>
      {CALLOUT[calloutOf(block)].icon}
    </span>
  );
}

/** An Adım's number, in its ring. */
export function StepNumber({ index, style, layerId }: PartProps) {
  return (
    <span
      data-layer-id={layerId}
      className="relative shrink-0 flex items-center justify-center w-8 h-8 rounded-full border border-[var(--border-hover)] bg-[var(--bg-2)] text-sm font-medium text-[var(--text-title)] tabular-nums"
      style={style}
    >
      {index + 1}
    </span>
  );
}

/** The line from an Adım's number down to the next one's — laid over the step, out of its auto layout (none after the last). */
export function StepLine({ index, count, layerId }: PartProps) {
  if (index >= count - 1) return null;
  return <span data-layer-id={layerId} aria-hidden className="absolute left-4 top-10 -bottom-6 w-px bg-[var(--border-hover)]" />;
}

function LinkGlyph({ icon }: { icon?: LinkIconType }) {
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

/** A Bağlantı's icon: its kind's (web, App Store, GitHub…). */
export function LinkIcon({ entry, style, layerId }: PartProps) {
  return (
    <span data-layer-id={layerId} className="flex shrink-0" style={style}>
      <LinkGlyph icon={entry?.icon} />
    </span>
  );
}

function AvatarCircle({ src, name, size }: { src?: string; name?: string; size: number }) {
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

/** An avatar at its layer's width: a Persona's (the block's image and name) or a Kişi's (its item's). */
export function Avatar({ block, entry, style, layerId, size }: PartProps & { size: number }) {
  const src = entry ? entry.src : block.src;
  const name = entry ? entry.title : block.title;
  return (
    <span data-layer-id={layerId} className="flex shrink-0" style={style}>
      <AvatarCircle src={src} name={name} size={size} />
    </span>
  );
}

/** A Kişi's link mark — only when it links somewhere. */
export function ExternalMark({ entry, style, layerId }: PartProps) {
  if (!entry?.href || !isSafeHref(entry.href)) return null;
  return (
    <span data-layer-id={layerId} className="flex shrink-0" style={style}>
      <ExternalGlyph />
    </span>
  );
}

/** A Madde's arrow — turned while it is open. */
export function Chevron({ style, layerId, open }: PartProps & { open: boolean }) {
  return (
    <svg data-layer-id={layerId} width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden style={style}
      className={cn("shrink-0 text-[var(--text-subtitle)] transition-transform duration-300", open && "rotate-180")}>
      <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Bars, swatches ────────────────────────────────────────────────────────────

export function parsePercent(raw?: string): number | null {
  if (!raw) return null;
  const n = parseFloat(raw.replace("%", "").replace(",", ".").trim());
  return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : null;
}

export function formatPercent(raw: string) {
  const pct = parsePercent(raw);
  return pct === null ? raw : `%${pct.toLocaleString("tr-TR", { maximumFractionDigits: 1 })}`;
}

/** A Çubuk's bar: its value's share of the track, in the project's accent. */
export function Bar({ entry, style, layerId }: PartProps) {
  const pct = parsePercent(entry?.value);
  return (
    <div data-layer-id={layerId} aria-hidden className="h-2 w-full rounded-full bg-[var(--progress-track)] overflow-hidden" style={style}>
      <div className="h-full rounded-full bg-[var(--project-accent,var(--text-title))] transition-[width] duration-300" style={{ width: `${pct ?? 0}%` }} />
    </div>
  );
}

/** A Renk's swatch: its colour, over a hairline. */
export function Swatch({ entry, style, layerId }: PartProps) {
  return <div data-layer-id={layerId} className="h-24 shadow-[inset_0_-1px_0_var(--border)]" style={{ ...style, backgroundColor: entry?.value || "transparent" }} />;
}

// ── Persona ───────────────────────────────────────────────────────────────────

export function personaItems(text: string): ReactNode {
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

