"use client";

import { useRef, useState, type ReactNode } from "react";
import type { AspectRatio, Block, BlockEntry, BlockType, BlockVariant, CellAlign, CellFit, CellSizing, GridGap, GridSettings, Group as PageGroup, LinkIconType, ListItem, ListStyle, PageSection, ProjectData } from "@/types/project";
import { cn } from "@/lib/utils";
import { BlockFields } from "@/components/admin/BlockFields";
import { CoverImageUpload } from "@/components/admin/FormEditor";
import { UploadZone } from "@/components/admin/ImageBlockEditor";
import type { ProjectMeta } from "@/components/admin/editorActions";
import { editorUid } from "@/components/project/editing";
import { BLOCK_DEFS, BLOCK_LABELS, GROUP_TONE, blockTone } from "@/components/admin/blockCatalog";
import { GRID_PRESETS, GRID_UNITS, MAX_COLUMNS, MAX_PADDING, MAX_ROWS, MAX_WIDTH, MIN_WIDTH, canHug, cellSizing, cellWidth, freeCells, gridColumns, gridPadding, gridRows, hasPlacedCells, layoutCells, layoutName, roomAt, rowCount, withColumnCount, withColumnWidth, type Cell } from "@/lib/projectLayout";

/**
 * The live editor's inspector ("Düzenle") — whatever was clicked on the page:
 * - the project (nothing selected): cover, company, address;
 * - a section (Bölüm): the grid its Bloks sit on, and its Bloks;
 * - a Blok (group): its cell in the section and its size, the grid its
 *   components sit on, and its components;
 * - a component (Bileşen): its cell in its Blok and its size, its layout
 *   options, its image, and the list of its items;
 * - an item inside a component (card, step, link, list item…): its fields.
 * Text can always be edited on the page too; this is the tidy way to reach
 * everything else (images, links, icons, values).
 *
 * Laid out like Figma's properties panel, in the layer tree's language (see
 * the primitives below). Only reads shared components — the block editor is
 * unaffected.
 */

type Lang = "tr" | "en";

// ── Primitives ────────────────────────────────────────────────────────────────
//
// Figma's properties panel, in the layer tree's language: full-width sections
// divided by thin rules; small grey (bg-4) fields, 28px tall, gently rounded;
// only icons carry a colour.

/** A section of the panel: its title (actions on the right, e.g. "+") over its controls, a rule under it. */
function Group({ title, actions, children }: { title: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2 px-4 pt-3 pb-4 border-b border-[var(--border)]">
      <div className="flex items-center justify-between gap-2 h-6">
        <h3 className="text-[12px] font-semibold leading-4 text-[var(--text-title)] select-none">{title}</h3>
        {actions && <div className="flex items-center gap-0.5 -mr-1">{actions}</div>}
      </div>
      {children}
    </section>
  );
}

/** A labelled line: the label on the left, the control filling the rest. */
function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2 min-h-7">
      <span className="w-[72px] shrink-0 text-[12px] leading-4 text-[var(--text-subtitle)] select-none">{label}</span>
      <div className="flex flex-1 min-w-0 items-center">{children}</div>
    </div>
  );
}

/** The grey box every field sits in. */
const FIELD =
  "h-7 rounded-[6px] bg-[var(--bg-4)] border border-transparent hover:border-[var(--border-hover)] focus-within:border-[var(--text-subtitle)] transition-colors";

/** The chosen option of a segmented control: raised (white; a step lighter in the dark theme). */
const RAISED = "bg-[var(--bg-1)] [[data-theme=dark]_&]:bg-[var(--bg-5)] text-[var(--text-title)] shadow-[0_1px_2px_rgba(0,0,0,0.08)]";

/** Figma's segmented control: a grey track, the chosen option raised. Options may be icons (their label then names them). */
function Choice<T>({ value, options, onChange }: {
  value: T;
  options: { value: T; label: string; icon?: ReactNode }[];
  onChange: (value: T) => void;
}) {
  return (
    <div role="radiogroup" className="flex w-full h-7 gap-0.5 p-0.5 rounded-[6px] bg-[var(--bg-4)]">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.label}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={o.icon ? o.label : undefined}
            title={o.icon ? o.label : undefined}
            onClick={() => onChange(o.value)}
            className={cn(
              "flex flex-1 min-w-0 items-center justify-center px-1.5 rounded-[5px] text-[11px] font-medium truncate transition-colors cursor-pointer",
              active ? RAISED : "text-[var(--text-subtitle)] hover:text-[var(--text-title)]"
            )}
          >
            {o.icon ?? o.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Figma's number field: a grey box with a prefix — drag it sideways to scrub
 * the value — then the number: type it (Enter / leaving the field keeps it,
 * Esc drops it), ↑ / ↓ step it (with Shift by 10).
 */
function NumberField({ label, prefix, value, min, max, suffix, onChange }: {
  label: string;
  prefix: ReactNode;
  value: number;
  min: number;
  max: number;
  suffix?: ReactNode;
  onChange: (value: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  // Enter, Esc and leaving the field all end the typing — only the first one counts.
  const typing = useRef(false);
  const clamp = (n: number) => Math.min(max, Math.max(min, Math.round(n)));
  /** Keeps the typed number (undefined: Esc — the value stays). */
  const finish = (raw?: string) => {
    if (!typing.current) return;
    typing.current = false;
    const n = Number(raw?.replace(",", "."));
    if (raw?.trim() && Number.isFinite(n) && clamp(n) !== value) onChange(clamp(n));
    setDraft(null);
  };
  const scrub = (e: React.PointerEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    let last = value;
    const move = (ev: PointerEvent) => {
      const next = clamp(value + Math.round((ev.clientX - startX) / 6));
      if (next !== last) {
        last = next;
        onChange(next);
      }
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  return (
    <div className={cn("flex items-center gap-1.5 min-w-0 px-2", FIELD)}>
      <span
        onPointerDown={scrub}
        title={label}
        className="flex shrink-0 items-center text-[11px] leading-none text-[var(--text-subtitle)] tabular-nums cursor-ew-resize select-none"
      >
        {prefix}
      </span>
      <input
        aria-label={label}
        inputMode="numeric"
        value={draft ?? String(value)}
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => {
          typing.current = true;
          setDraft(e.target.value);
        }}
        onBlur={(e) => finish(e.currentTarget.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") finish(e.currentTarget.value);
          if (e.key === "Escape") finish();
          if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault();
            // Steps from the value shown (the field then shows the value again).
            const next = clamp(value + (e.key === "ArrowUp" ? 1 : -1) * (e.shiftKey ? 10 : 1));
            if (next !== value) onChange(next);
            typing.current = false;
            setDraft(null);
          }
        }}
        className="min-w-0 flex-1 bg-transparent text-[12px] text-[var(--text-title)] outline-none tabular-nums"
      />
      {suffix && <span className="shrink-0 text-[11px] text-[var(--text-subtitle)] tabular-nums select-none">{suffix}</span>}
    </div>
  );
}

/** A one-line text field in the grey box, with an optional prefix (icon, colour swatch). */
function TextField({ label, value, onChange, placeholder, type = "text", prefix }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: "text" | "url";
  prefix?: ReactNode;
}) {
  return (
    <div className={cn("flex w-full min-w-0 items-center gap-1.5 px-2", FIELD)}>
      {prefix}
      <input
        type={type}
        aria-label={label}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="min-w-0 flex-1 bg-transparent text-[12px] text-[var(--text-title)] placeholder:text-[var(--text-subtitle)] outline-none"
      />
    </div>
  );
}

/** A dropdown in the grey box (the system's own menu). */
function SelectField({ label, value, options, placeholder, onChange }: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className={cn("relative flex w-full min-w-0 items-center", FIELD)}>
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-full pl-2 pr-6 appearance-none bg-transparent text-[12px] text-[var(--text-title)] outline-none cursor-pointer"
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden className="pointer-events-none absolute right-2 text-[var(--text-subtitle)]">
        <path d="M2.5 4l2.5 2.5L7.5 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

/** A square icon button (section actions), as in the layer tree. */
function SquareButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex items-center justify-center w-6 h-6 rounded-[6px] text-[var(--text-subtitle)] hover:text-[var(--text-title)] hover:bg-[var(--bg-4)] transition-colors cursor-pointer"
    >
      {children}
    </button>
  );
}

/** A quiet note at the top of a panel. */
function Hint({ children }: { children: ReactNode }) {
  return <p className="px-4 py-3 text-[11px] leading-4 text-[var(--text-subtitle)] border-b border-[var(--border)]">{children}</p>;
}

const Glyphs = {
  plus: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M7 2.5v9M2.5 7h9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  ),
  chevron: (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <path d="M4.5 3l3 3-3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  /** Column count */
  columns: (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <rect x="1.5" y="2" width="2.5" height="8" rx="0.8" stroke="currentColor" strokeWidth="1.1" />
      <rect x="4.75" y="2" width="2.5" height="8" rx="0.8" stroke="currentColor" strokeWidth="1.1" />
      <rect x="8" y="2" width="2.5" height="8" rx="0.8" stroke="currentColor" strokeWidth="1.1" />
    </svg>
  ),
  /** Row (position) */
  row: (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <rect x="1.5" y="4" width="9" height="4" rx="0.8" stroke="currentColor" strokeWidth="1.1" />
      <path d="M1.5 1.5h9M1.5 10.5h9" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" opacity="0.5" />
    </svg>
  ),
  /** Column (position) */
  column: (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <rect x="4" y="1.5" width="4" height="9" rx="0.8" stroke="currentColor" strokeWidth="1.1" />
      <path d="M1.5 1.5v9M10.5 1.5v9" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" opacity="0.5" />
    </svg>
  ),
  /** Width */
  width: (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <path d="M1.5 2.5v7M10.5 2.5v7M3 6h6M4.5 4.5L3 6l1.5 1.5M7.5 4.5L9 6 7.5 7.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  /** Row count */
  rows: (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <rect x="2" y="1.5" width="8" height="2.5" rx="0.8" stroke="currentColor" strokeWidth="1.1" />
      <rect x="2" y="4.75" width="8" height="2.5" rx="0.8" stroke="currentColor" strokeWidth="1.1" />
      <rect x="2" y="8" width="8" height="2.5" rx="0.8" stroke="currentColor" strokeWidth="1.1" />
    </svg>
  ),
  alignLeft: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M2.5 2v10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <rect x="4.5" y="4" width="7" height="2.5" rx="0.8" stroke="currentColor" strokeWidth="1.1" />
      <rect x="4.5" y="7.5" width="4" height="2.5" rx="0.8" stroke="currentColor" strokeWidth="1.1" />
    </svg>
  ),
  alignCenter: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M7 2v10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <rect x="3" y="4" width="8" height="2.5" rx="0.8" stroke="currentColor" strokeWidth="1.1" />
      <rect x="4.75" y="7.5" width="4.5" height="2.5" rx="0.8" stroke="currentColor" strokeWidth="1.1" />
    </svg>
  ),
  alignRight: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M11.5 2v10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <rect x="2.5" y="4" width="7" height="2.5" rx="0.8" stroke="currentColor" strokeWidth="1.1" />
      <rect x="5.5" y="7.5" width="4" height="2.5" rx="0.8" stroke="currentColor" strokeWidth="1.1" />
    </svg>
  ),
  alignTop: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M2 2.5h10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <rect x="4" y="4.5" width="2.5" height="7" rx="0.8" stroke="currentColor" strokeWidth="1.1" />
      <rect x="7.5" y="4.5" width="2.5" height="4" rx="0.8" stroke="currentColor" strokeWidth="1.1" />
    </svg>
  ),
  alignMiddle: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M2 7h10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <rect x="4" y="3" width="2.5" height="8" rx="0.8" stroke="currentColor" strokeWidth="1.1" />
      <rect x="7.5" y="4.75" width="2.5" height="4.5" rx="0.8" stroke="currentColor" strokeWidth="1.1" />
    </svg>
  ),
  alignBottom: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M2 11.5h10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <rect x="4" y="2.5" width="2.5" height="7" rx="0.8" stroke="currentColor" strokeWidth="1.1" />
      <rect x="7.5" y="5.5" width="2.5" height="4" rx="0.8" stroke="currentColor" strokeWidth="1.1" />
    </svg>
  ),
  /** Padding */
  padding: (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <rect x="1.5" y="1.5" width="9" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.1" opacity="0.5" />
      <rect x="4" y="4" width="4" height="4" rx="0.8" stroke="currentColor" strokeWidth="1.1" />
    </svg>
  ),
  /** A Blok, as in the layer tree */
  group: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <rect x="2" y="2" width="4" height="4" rx="1" stroke="currentColor" strokeWidth="1.3" />
      <rect x="8" y="2" width="4" height="4" rx="1" stroke="currentColor" strokeWidth="1.3" />
      <rect x="2" y="8" width="4" height="4" rx="1" stroke="currentColor" strokeWidth="1.3" />
      <rect x="8" y="8" width="4" height="4" rx="1" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  ),
};

// ── Images ────────────────────────────────────────────────────────────────────

/** Preview + URL / upload + alt text for one image. */
function ImageSource({ src, alt, onSrc, onAlt, uploadId, projectSlug, compact = false }: {
  src?: string;
  alt?: string;
  onSrc: (src: string) => void;
  onAlt?: (alt: string) => void;
  uploadId: string;
  projectSlug: string;
  compact?: boolean;
}) {
  const [mode, setMode] = useState<"url" | "upload">("url");
  return (
    <div className="flex flex-col gap-2">
      {!compact && (
        <div className="relative w-full h-32 rounded-[6px] overflow-hidden bg-[var(--bg-4)]">
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="absolute inset-0 flex items-center justify-center text-[11px] text-[var(--text-subtitle)]">Görsel yok</span>
          )}
        </div>
      )}
      <Choice value={mode} options={[{ value: "url", label: "Bağlantı" }, { value: "upload", label: "Yükle" }]} onChange={setMode} />
      {mode === "url" ? (
        <TextField label="Görsel adresi" type="url" value={src ?? ""} onChange={onSrc} placeholder="https://…" />
      ) : (
        <UploadZone blockId={uploadId} projectSlug={projectSlug} currentSrc={src} onUploaded={(url) => onSrc(url)} />
      )}
      {onAlt && <TextField label="Alt metin" value={alt ?? ""} onChange={onAlt} placeholder="Alt metin — görseli kısaca tarif et" />}
    </div>
  );
}

// ── Options ───────────────────────────────────────────────────────────────────

const cols = (...values: (2 | 3 | 4)[]) => values.map((v) => ({ value: v, label: String(v) }));

const ASPECTS: { value: AspectRatio; label: string }[] = [
  { value: "16/9", label: "16:9" },
  { value: "4/3", label: "4:3" },
  { value: "1/1", label: "1:1" },
  { value: "3/4", label: "3:4" },
  { value: "9/16", label: "9:16" },
];

const LIST_STYLES: { value: ListStyle; label: string }[] = [
  { value: "bullet", label: "Madde" },
  { value: "numbered", label: "Sıralı" },
  { value: "check", label: "Onay" },
  { value: "dash", label: "Tire" },
];

const CALLOUT_VARIANTS: { value: BlockVariant; label: string }[] = [
  { value: "note", label: "Not" },
  { value: "insight", label: "İçgörü" },
  { value: "tip", label: "İpucu" },
  { value: "warning", label: "Dikkat" },
];

const MOCKUP_VARIANTS: { value: BlockVariant; label: string }[] = [
  { value: "phone", label: "Telefon" },
  { value: "browser", label: "Tarayıcı" },
  { value: "tablet", label: "Tablet" },
];

const SPLIT_SIDES: { value: BlockVariant; label: string }[] = [
  { value: "left", label: "Solda" },
  { value: "right", label: "Sağda" },
];

const LINK_ICONS: { value: LinkIconType; label: string }[] = [
  { value: "web", label: "Web sitesi" },
  { value: "appstore", label: "App Store" },
  { value: "playstore", label: "Google Play" },
  { value: "github", label: "GitHub" },
  { value: "figma", label: "Figma" },
  { value: "behance", label: "Behance" },
  { value: "external", label: "Diğer" },
];

const GRID_GAPS: { value: GridGap; label: string }[] = [
  { value: "sm", label: "Az" },
  { value: "md", label: "Orta" },
  { value: "lg", label: "Geniş" },
];

const SIZINGS: { value: CellSizing; label: string }[] = [
  { value: "fill", label: "Doldur" },
  { value: "hug", label: "İçerik" },
  { value: "fixed", label: "Sabit" },
];

/** Blocks whose own editor is the whole story (no inline text on the page). */
const OWN_EDITOR = new Set<Block["type"]>(["code", "figma", "iframe"]);

// ── Block inspector ───────────────────────────────────────────────────────────

export function BlockInspector({ block, lang, projectSlug, placement, onChange, onSelectEntry }: {
  block: Block;
  lang: Lang;
  projectSlug: string;
  /** Its cell in its Blok's grid, and its size (see PlacementGroups) */
  placement?: ReactNode;
  onChange: (patch: Partial<Block>) => void;
  /** Open an item's own settings (also right after adding one) */
  onSelectEntry: (entryId: string) => void;
}) {
  const en = lang === "en";
  const type = block.type;

  if (OWN_EDITOR.has(type)) {
    return (
      <div className="flex flex-col">
        {placement}
        <Group title="İçerik">
          <div className="flex flex-col gap-2.5">
            <BlockFields block={block} onChange={onChange} lang={lang} projectSlug={projectSlug} />
          </div>
        </Group>
      </div>
    );
  }

  // ── Layout options ──
  const options: ReactNode[] = [];
  if (type === "list") {
    options.push(
      <Row key="style" label="Stil">
        <Choice value={block.listStyle ?? "bullet"} options={LIST_STYLES} onChange={(listStyle) => onChange({ listStyle })} />
      </Row>
    );
  }
  if (type === "stats" || type === "palette") {
    options.push(
      <Row key="cols" label="Sütun">
        <Choice value={block.columns ?? (type === "stats" ? 3 : 4)} options={cols(2, 3, 4)} onChange={(columns) => onChange({ columns })} />
      </Row>
    );
  }
  if (type === "cards") {
    options.push(
      <Row key="cols" label="Sütun">
        <Choice value={block.columns ?? 2} options={cols(2, 3)} onChange={(columns) => onChange({ columns })} />
      </Row>
    );
  }
  if (type === "gallery") {
    options.push(
      <Row key="cols" label="Sütun">
        <Choice value={block.columns ?? 2} options={cols(2, 3, 4)} onChange={(columns) => onChange({ columns })} />
      </Row>
    );
  }
  if (type === "image" || type === "compare") {
    options.push(
      <Row key="ratio" label="Oran">
        <Choice value={block.aspectRatio ?? "16/9"} options={ASPECTS.slice(0, 3)} onChange={(aspectRatio) => onChange({ aspectRatio })} />
      </Row>
    );
  }
  if (type === "gallery" || type === "split") {
    options.push(
      <Row key="ratio" label="Oran">
        <Choice value={block.aspectRatio ?? "4/3"} options={ASPECTS} onChange={(aspectRatio) => onChange({ aspectRatio })} />
      </Row>
    );
  }
  if (type === "split") {
    options.push(
      <Row key="side" label="Görsel">
        <Choice value={block.variant ?? "left"} options={SPLIT_SIDES} onChange={(variant) => onChange({ variant })} />
      </Row>
    );
  }
  if (type === "callout") {
    options.push(
      <Row key="variant" label="Tür">
        <Choice value={block.variant ?? "note"} options={CALLOUT_VARIANTS} onChange={(variant) => onChange({ variant })} />
      </Row>
    );
  }
  if (type === "mockup") {
    options.push(
      <Row key="device" label="Cihaz">
        <Choice value={block.variant ?? "phone"} options={MOCKUP_VARIANTS} onChange={(variant) => onChange({ variant })} />
      </Row>
    );
  }
  if (type === "video") {
    options.push(
      <Row key="loop" label="Oynatma">
        <Choice
          value={Boolean(block.videoLoop)}
          options={[{ value: false, label: "Oynatıcı" }, { value: true, label: "Döngü" }]}
          onChange={(videoLoop) => onChange({ videoLoop })}
        />
      </Row>
    );
  }
  if (type === "table") {
    const rows = block.tableRows ?? [];
    const columnCount = Math.max(1, ...rows.map((r) => r.cells.length));
    const fit = (cells: string[], n: number) => [...cells.slice(0, n), ...Array<string>(Math.max(0, n - cells.length)).fill("")];
    const setColumns = (n: number) =>
      onChange({ tableRows: rows.map((r) => ({ ...r, cells: fit(r.cells, n), ...(r.cellsEn ? { cellsEn: fit(r.cellsEn, n) } : {}) })) });
    options.push(
      <Row key="header" label="İlk satır">
        <Choice
          value={block.tableHeader !== false}
          options={[{ value: true, label: "Başlık" }, { value: false, label: "Normal" }]}
          onChange={(tableHeader) => onChange({ tableHeader })}
        />
      </Row>,
      <Row key="cols" label="Sütunlar">
        <NumberField label="Sütun sayısı" prefix={Glyphs.columns} value={columnCount} min={1} max={6} onChange={setColumns} />
      </Row>
    );
  }

  // ── The block's own image / video ──
  const media: ReactNode[] = [];
  if (type === "image" || type === "split" || type === "persona") {
    media.push(
      <ImageSource
        key="src"
        src={block.src}
        alt={en ? block.altEn : block.alt}
        onSrc={(src) => onChange({ src })}
        onAlt={type === "persona" ? undefined : (alt) => onChange(en ? { altEn: alt } : { alt })}
        uploadId={block.id}
        projectSlug={projectSlug}
      />
    );
  }
  if (type === "video") {
    media.push(
      <TextField key="src" label="Video adresi" type="url" value={block.src ?? ""} onChange={(src) => onChange({ src })} placeholder="YouTube, Vimeo ya da .mp4 / .webm adresi" />
    );
  }

  const spec = specOf(block);

  return (
    <div className="flex flex-col">
      <Hint>Metinleri sayfada çift tıklayarak düzenle. İçindeki bir öğeye tıklarsan onun ayarları açılır.</Hint>
      {placement}
      {options.length > 0 && <Group title="Görünüm">{options}</Group>}
      {media.length > 0 && <Group title={type === "video" ? "Video" : "Görsel"}>{media}</Group>}
      {spec && (
        <Group
          title={plural(spec.noun)}
          actions={type !== "compare" && (
            <SquareButton
              label={`${spec.noun} ekle`}
              onClick={() => {
                const { patch, id } = addEntry(block);
                onChange(patch);
                onSelectEntry(id);
              }}
            >
              {Glyphs.plus}
            </SquareButton>
          )}
        >
          <ItemList block={block} lang={lang} onSelect={onSelectEntry} />
        </Group>
      )}
    </div>
  );
}

// ── Layout: sections and Bloks ────────────────────────────────────────────────

/** Plain text without the **bold** / [link](…) markers, on one line. */
export function plainText(raw?: string) {
  return raw?.replace(/\*\*|\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/\s+/g, " ").trim() || undefined;
}

/** Short preview of a component's content, for lists. */
export function blockSummary(block: Block, lang: Lang) {
  const en = lang === "en";
  const pick = (tr?: string, enValue?: string) => (en ? enValue : undefined) || tr;
  const entry = block.entries?.[0];
  return plainText(
    pick(block.content, block.contentEn) ||
      pick(block.title, block.titleEn) ||
      pick(block.caption, block.captionEn) ||
      pick(block.alt, block.altEn) ||
      pick(block.listItems?.[0]?.text, block.listItems?.[0]?.textEn) ||
      pick(entry?.title, entry?.titleEn) ||
      pick(entry?.label, entry?.labelEn) ||
      pick(entry?.text, entry?.textEn)
  );
}

/** "Başlık, Metin" — what a Blok holds. */
export function groupSummary(group: PageGroup) {
  return group.blocks.map((b) => b.name?.trim() || BLOCK_LABELS[b.type]).join(", ") || undefined;
}

/**
 * The grid a section lays its Bloks on — or a Blok its components, Figma's
 * "Auto layout": its columns and rows, the gap and padding, a preset layout
 * and each column's width (twelfths — its neighbour gives or takes). Which
 * cell each child sits in is the child's own (Konum).
 */
function GridFields({ grid, usedRows, onChange }: {
  grid?: GridSettings;
  /** How many rows its children take up now — it can't have fewer */
  usedRows: number;
  onChange: (grid: GridSettings) => void;
}) {
  const columns = gridColumns(grid);
  const count = columns.length;
  const minRows = Math.max(1, usedRows);
  const presets = GRID_PRESETS[count];
  const current = layoutName(columns);
  const setCount = (n: number) => onChange(n <= 1 ? { ...grid, columns: undefined } : withColumnCount(grid, n));

  return (
    <Group title="Izgara">
      <div className="grid grid-cols-2 gap-2">
        <NumberField label="Sütun sayısı" prefix={Glyphs.columns} value={count} min={1} max={MAX_COLUMNS} suffix="sütun" onChange={setCount} />
        <NumberField
          label="Satır sayısı"
          prefix={Glyphs.rows}
          value={Math.max(gridRows(grid), minRows)}
          min={minRows}
          max={Math.max(MAX_ROWS, minRows)}
          suffix="satır"
          onChange={(rows) => onChange({ ...grid, rows })}
        />
      </div>
      {count > 1 && presets && (
        <div className="flex flex-wrap gap-1.5">
          {presets.map((preset) => {
            const active = layoutName(preset) === current;
            return (
              <button
                key={layoutName(preset)}
                type="button"
                title={`${preset.join(" · ")} / ${GRID_UNITS}`}
                aria-pressed={active}
                onClick={() => onChange({ ...grid, columns: preset })}
                className={cn(
                  "flex gap-0.5 w-[52px] h-6 p-1 rounded-[6px] bg-[var(--bg-4)] border cursor-pointer transition-colors",
                  active ? "border-[var(--text-subtitle)]" : "border-transparent hover:border-[var(--border-hover)]"
                )}
              >
                {preset.map((w, i) => (
                  <span
                    key={i}
                    className={cn("basis-0 rounded-[2px]", active ? "bg-[var(--text-subtitle)]" : "bg-[var(--bg-5)]")}
                    style={{ flexGrow: w }}
                  />
                ))}
              </button>
            );
          })}
        </div>
      )}
      {count > 1 && (
        <div className="grid grid-cols-3 gap-2">
          {columns.map((w, i) => (
            <NumberField
              key={i}
              label={`${i + 1}. sütunun genişliği`}
              prefix={<span className="w-3 text-center">{i + 1}</span>}
              value={w}
              min={1}
              max={GRID_UNITS - 1}
              suffix={`/${GRID_UNITS}`}
              onChange={(width) => onChange(withColumnWidth(grid, i, width))}
            />
          ))}
        </div>
      )}
      <Row label="Boşluk">
        <Choice value={grid?.gap ?? "md"} options={GRID_GAPS} onChange={(gap) => onChange({ ...grid, gap })} />
      </Row>
      <Row label="İç boşluk">
        <NumberField
          label="İç boşluk"
          prefix={Glyphs.padding}
          value={gridPadding(grid)}
          min={0}
          max={MAX_PADDING}
          suffix="px"
          onChange={(padding) => onChange({ ...grid, padding: padding || undefined })}
        />
      </Row>
    </Group>
  );
}

/**
 * The parent's grid in small, column for column and row for row (4·8 looks
 * like 4·8, three rows are three rows): a dot in each free cell, the others
 * in grey, this one in its colour (`tone`). Click a free cell to move it
 * there, another child's to swap places with it.
 */
function CellPicker({ columns, rows, cells, index, labels, tone, onPlace, onSwap }: {
  columns: number[];
  /** How many rows it shows */
  rows: number;
  cells: Cell[];
  /** Which of `cells` is this one */
  index: number;
  labels: string[];
  tone: string;
  onPlace: (row: number, col: number) => void;
  /** Swap places with child `other` */
  onSwap: (other: number) => void;
}) {
  const place = (row: number, col: number) => `${row}. satır, ${col}. sütun`;
  return (
    <div
      role="group"
      aria-label="Izgaradaki yeri"
      className="grid gap-0.5 p-0.5 rounded-[6px] bg-[var(--bg-4)]"
      style={{ gridTemplateColumns: columns.map((w) => `minmax(0,${w}fr)`).join(" "), gridTemplateRows: `repeat(${rows}, 24px)` }}
    >
      {freeCells(cells, columns.length, rows).map((f) => (
        <button
          key={`free-${f.row}-${f.col}`}
          type="button"
          title={`${place(f.row, f.col)} — buraya taşı`}
          aria-label={`${place(f.row, f.col)}, boş — buraya taşı`}
          onClick={() => onPlace(f.row, f.col)}
          className="group/spot flex items-center justify-center rounded-[4px] cursor-pointer hover:bg-[var(--bg-5)] transition-colors"
          style={{ gridRow: f.row, gridColumn: f.col }}
        >
          <span className="w-[3px] h-[3px] rounded-full bg-[var(--text-subtitle)] opacity-50 group-hover/spot:opacity-100 transition-opacity" />
        </button>
      ))}
      {cells.map((c, i) => {
        const own = i === index;
        const where = { gridRow: c.row, gridColumn: `${c.col} / span ${c.span}` };
        return own ? (
          <span key={`child-${i}`} aria-current="true" title={`${labels[i]}: ${place(c.row, c.col)}`} className="flex items-center px-1" style={where}>
            <span className="w-full h-2 rounded-full" style={{ background: tone }} />
          </span>
        ) : (
          <button
            key={`child-${i}`}
            type="button"
            title={`${labels[i]} ile yer değiştir`}
            aria-label={`${place(c.row, c.col)}: ${labels[i]} — onunla yer değiştir`}
            onClick={() => onSwap(i)}
            className="group/spot flex items-center px-1 rounded-[4px] cursor-pointer hover:bg-[var(--bg-5)] transition-colors"
            style={where}
          >
            <span className="w-full h-2 rounded-full bg-[var(--text-subtitle)] opacity-30 group-hover/spot:opacity-60 transition-opacity" />
          </button>
        );
      })}
    </div>
  );
}

const ALIGNS_X: { value: CellAlign; label: string; icon: ReactNode }[] = [
  { value: "start", label: "Sola hizala", icon: Glyphs.alignLeft },
  { value: "center", label: "Yatayda ortala", icon: Glyphs.alignCenter },
  { value: "end", label: "Sağa hizala", icon: Glyphs.alignRight },
];

const ALIGNS_Y: { value: CellAlign; label: string; icon: ReactNode }[] = [
  { value: "start", label: "Üste hizala", icon: Glyphs.alignTop },
  { value: "center", label: "Dikeyde ortala", icon: Glyphs.alignMiddle },
  { value: "end", label: "Alta hizala", icon: Glyphs.alignBottom },
];

/**
 * Where a Blok or component sits on its parent's grid, Figma's "Position":
 * Konum — the parent's grid in small (CellPicker; click a cell to move it
 * there) and how many of its columns it covers. Then Boyut: its width —
 * filling its cell, hugging its content (only where it can, see canHug) or
 * fixed in px — and, when it can be narrower than its cell or shorter than
 * its row's neighbours, where in the cell it sits.
 */
export function PlacementGroups({ item, index, siblings, labels, parent, tone, onPlace, onSwap, onSpan, onFit }: {
  /** The Blok or component */
  item: CellFit & (Pick<Block, "type"> | Pick<PageGroup, "blocks">);
  /** Its place among `siblings` */
  index: number;
  siblings: { id: string; span?: number; row?: number; col?: number }[];
  /** Short names of the siblings, for the picker's tooltips */
  labels: string[];
  parent?: GridSettings;
  tone: string;
  onPlace: (row: number, col: number) => void;
  /** Swap cells with sibling `otherId` */
  onSwap: (otherId: string) => void;
  onSpan: (span: number) => void;
  onFit: (patch: CellFit) => void;
}) {
  if (index < 0) return null;
  const columns = gridColumns(parent);
  const count = columns.length;
  const rows = gridRows(parent);
  const cells = layoutCells(siblings, count, rows);
  const cell = cells[index];
  // By hand, it can grow up to the next taken cell; in order, up to a whole row.
  const maxSpan = hasPlacedCells(siblings) ? roomAt(cells, index, cell.row, cell.col, count) : count;
  const sizing = cellSizing(item);

  return (
    <>
      <Group title="Konum">
        <CellPicker
          columns={columns}
          // Its set rows — or, when none are set, the rows in use and one more for a new line.
          rows={rowCount(cells, rows, !rows)}
          cells={cells}
          index={index}
          labels={labels}
          tone={tone}
          onPlace={onPlace}
          onSwap={(other) => onSwap(siblings[other].id)}
        />
        {count > 1 && (
          <Row label="Kapladığı">
            <NumberField label="Kapladığı sütun" prefix={Glyphs.width} value={cell.span} min={1} max={Math.max(1, maxSpan)} suffix="sütun" onChange={onSpan} />
          </Row>
        )}
      </Group>
      <Group title="Boyut">
        <Row label="Genişlik">
          <Choice
            value={sizing}
            options={canHug(item) ? SIZINGS : SIZINGS.filter((o) => o.value !== "hug")}
            onChange={(next) => onFit(next === "fixed" ? { sizing: next, width: cellWidth(item) } : { sizing: next })}
          />
        </Row>
        {sizing === "fixed" && (
          <Row label="">
            <NumberField label="Genişlik (px)" prefix={Glyphs.width} value={cellWidth(item)} min={MIN_WIDTH} max={MAX_WIDTH} suffix="px" onChange={(width) => onFit({ width })} />
          </Row>
        )}
        {(sizing !== "fill" || count > 1) && (
          <Row label="Hizala">
            <div className="grid grid-flow-col auto-cols-fr gap-2 w-full">
              {/* Left / right only shows when it is narrower than its cell; top / bottom when a neighbour on its row is taller. */}
              {sizing !== "fill" && <Choice value={item.alignX ?? "start"} options={ALIGNS_X} onChange={(alignX) => onFit({ alignX })} />}
              {count > 1 && <Choice value={item.alignY ?? "start"} options={ALIGNS_Y} onChange={(alignY) => onFit({ alignY })} />}
            </div>
          </Row>
        )}
      </Group>
    </>
  );
}

/** A child in a section's or Blok's list, as a layer row: its icon (in its colour), name and a preview. */
function ChildRow({ icon, tone, label, detail, onClick }: { icon: ReactNode; tone: string; label: string; detail?: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group/item flex items-center gap-2 w-[calc(100%+16px)] h-8 -mx-2 px-2 rounded-[6px] text-left hover:bg-[var(--bg-4)] transition-colors cursor-pointer"
    >
      <span className="flex items-center justify-center w-4 h-4 shrink-0 [&_svg]:w-3.5 [&_svg]:h-3.5" style={{ color: tone }}>{icon}</span>
      <span className="shrink-0 text-[12px] font-medium text-[var(--text-title)]">{label}</span>
      <span className="min-w-0 flex-1 truncate text-[11px] text-[var(--text-subtitle)]">{detail}</span>
      <span className="shrink-0 text-[var(--text-subtitle)] opacity-0 group-hover/item:opacity-100 transition-opacity">{Glyphs.chevron}</span>
    </button>
  );
}

/** A component's icon, from the catalog. */
const blockIcon = (type: BlockType) => BLOCK_DEFS.find((d) => d.type === type)?.icon;

/** How many rows of their grid `children` take up now. */
const usedRows = (children: { span?: number; row?: number; col?: number }[], grid?: GridSettings) =>
  Math.max(0, ...layoutCells(children, gridColumns(grid).length, gridRows(grid)).map((c) => c.row));

/** A section: the grid its Bloks sit on, and its Bloks. */
export function SectionInspector({ section, onChange, onSelectGroup, onAddGroup }: {
  section: PageSection;
  onChange: (patch: { grid?: GridSettings }) => void;
  onSelectGroup: (groupId: string) => void;
  onAddGroup: () => void;
}) {
  return (
    <div className="flex flex-col">
      <Hint>Izgara bölümün sütun ve satırlarını belirler. Bir bloğu boş bir hücreye sürükleyebilir ya da bloğu seçip Konum bölümünden istediğin hücreye taşıyabilirsin.</Hint>
      <GridFields grid={section.grid} usedRows={usedRows(section.groups, section.grid)} onChange={(grid) => onChange({ grid })} />
      <Group title="Bloklar" actions={<SquareButton label="Blok ekle" onClick={onAddGroup}>{Glyphs.plus}</SquareButton>}>
        {section.groups.map((g, i) => (
          <ChildRow
            key={g.id}
            icon={Glyphs.group}
            tone={GROUP_TONE}
            label={g.name?.trim() || `Blok ${i + 1}`}
            detail={groupSummary(g) ?? "Boş"}
            onClick={() => onSelectGroup(g.id)}
          />
        ))}
        {section.groups.length === 0 && <p className="text-[11px] text-[var(--text-subtitle)]">Henüz blok yok.</p>}
      </Group>
    </div>
  );
}

/** A Blok: its place in the section, the grid its components sit on, and its components. */
export function GroupInspector({ group, section, lang, onChange, onPlace, onSwap, onSelectBlock, onAddBlock }: {
  group: PageGroup;
  section: PageSection;
  lang: Lang;
  onChange: (patch: CellFit & { grid?: GridSettings; span?: number }) => void;
  /** Put it in a free cell of the section's grid */
  onPlace: (row: number, col: number) => void;
  /** Swap cells with another Blok of the section */
  onSwap: (otherId: string) => void;
  onSelectBlock: (blockId: string) => void;
  onAddBlock: () => void;
}) {
  return (
    <div className="flex flex-col">
      <Hint>Konum bloğun bölümün ızgarasındaki yeri: bir hücreye tıkla, oraya geçsin. Izgara ise bloğun kendi bileşenlerinin dizildiği sütun ve satırlar.</Hint>
      <PlacementGroups
        item={group}
        index={section.groups.findIndex((g) => g.id === group.id)}
        siblings={section.groups}
        labels={section.groups.map((g, i) => g.name?.trim() || `Blok ${i + 1}`)}
        parent={section.grid}
        tone={GROUP_TONE}
        onPlace={onPlace}
        onSwap={onSwap}
        onSpan={(span) => onChange({ span })}
        onFit={onChange}
      />
      <GridFields grid={group.grid} usedRows={usedRows(group.blocks, group.grid)} onChange={(grid) => onChange({ grid })} />
      <Group title="Bileşenler" actions={<SquareButton label="Bileşen ekle" onClick={onAddBlock}>{Glyphs.plus}</SquareButton>}>
        {group.blocks.map((b) => (
          <ChildRow
            key={b.id}
            icon={blockIcon(b.type)}
            tone={blockTone(b.type)}
            label={b.name?.trim() || BLOCK_LABELS[b.type]}
            detail={blockSummary(b, lang)}
            onClick={() => onSelectBlock(b.id)}
          />
        ))}
        {group.blocks.length === 0 && <p className="text-[11px] text-[var(--text-subtitle)]">Henüz bileşen yok.</p>}
      </Group>
    </div>
  );
}

// ── Project inspector (nothing selected) ──────────────────────────────────────

export function ProjectInspector({ project, slug, companies, onChange }: {
  project: ProjectData;
  lang: Lang;
  slug: string;
  companies: string[];
  onChange: (patch: Partial<ProjectMeta>) => void;
}) {
  return (
    <div className="flex flex-col">
      <Hint>Başlık, kategori, yıl ve açıklama sayfanın en üstünde — çift tıklayıp düzenle. Bir bölüm ya da blok seçince ayarları burada görünür.</Hint>
      <Group title="Kapak görseli">
        <CoverImageUpload slug={slug} currentSrc={project.coverImage} onChange={(coverImage) => onChange({ coverImage })} />
      </Group>
      <Group title="Detaylar">
        <Row label="Şirket">
          <SelectField
            label="Şirket"
            value={project.company ?? ""}
            options={companies.map((c) => ({ value: c, label: c }))}
            placeholder="Seçilmedi"
            onChange={(company) => onChange({ company })}
          />
        </Row>
        <Row label="Adres">
          <span className="min-w-0 truncate text-[12px] text-[var(--text-subtitle)] tabular-nums">/projects/{slug}</span>
        </Row>
      </Group>
    </div>
  );
}

// ── Items inside a block ──────────────────────────────────────────────────────

type ItemFieldKey = "label" | "value" | "eyebrow" | "title" | "text" | "caption" | "href";

interface ItemField {
  key: ItemFieldKey;
  label: string;
  placeholder?: string;
  multiline?: boolean;
  /** Same value in every language (links, percentages, colours) */
  shared?: boolean;
  color?: boolean;
}

interface ItemSpec {
  /** What one item is called: "Kart", "Adım"… */
  noun: string;
  image?: boolean;
  icon?: boolean;
  fields: ItemField[];
}

const ENTRY_SPEC: Partial<Record<BlockType, ItemSpec>> = {
  info: { noun: "Satır", fields: [{ key: "label", label: "Etiket" }, { key: "value", label: "Değer" }] },
  stats: { noun: "Metrik", fields: [{ key: "value", label: "Değer", placeholder: "%40" }, { key: "label", label: "Açıklama" }] },
  cards: { noun: "Kart", fields: [{ key: "eyebrow", label: "Üst etiket", placeholder: "01, Sorun…" }, { key: "title", label: "Başlık" }, { key: "text", label: "Açıklama", multiline: true }] },
  steps: { noun: "Adım", fields: [{ key: "title", label: "Başlık" }, { key: "eyebrow", label: "Zaman", placeholder: "Hafta 1" }, { key: "text", label: "Açıklama", multiline: true }] },
  gallery: { noun: "Görsel", image: true, fields: [{ key: "caption", label: "Açıklama" }] },
  compare: { noun: "Görsel", image: true, fields: [{ key: "label", label: "Etiket", placeholder: "Önce / Sonra" }] },
  mockup: { noun: "Ekran", image: true, fields: [{ key: "label", label: "Adres çubuğu", placeholder: "Yalnızca tarayıcıda — burakkoc.net" }] },
  links: { noun: "Bağlantı", icon: true, fields: [{ key: "label", label: "Etiket" }, { key: "href", label: "Adres", placeholder: "https://…", shared: true }] },
  tags: { noun: "Etiket", fields: [{ key: "label", label: "Etiket" }] },
  accordion: { noun: "Madde", fields: [{ key: "title", label: "Başlık" }, { key: "text", label: "İçerik", multiline: true }] },
  bars: { noun: "Çubuk", fields: [{ key: "label", label: "Seçenek" }, { key: "value", label: "Yüzde", placeholder: "72", shared: true }, { key: "text", label: "Not" }] },
  persona: { noun: "Grup", fields: [{ key: "label", label: "Başlık" }, { key: "text", label: "Maddeler", placeholder: "Her satır bir madde", multiline: true }] },
  team: { noun: "Kişi", image: true, fields: [{ key: "title", label: "Ad Soyad" }, { key: "text", label: "Rol" }, { key: "href", label: "Profil", placeholder: "https://…", shared: true }] },
  palette: { noun: "Renk", fields: [{ key: "label", label: "Ad" }, { key: "value", label: "Renk", placeholder: "#1A1A1A", shared: true, color: true }, { key: "text", label: "Kullanım" }] },
};

const LIST_SPEC: ItemSpec = { noun: "Madde", fields: [] };

const isListBlock = (block: Block) => block.type === "list";

function specOf(block: Block): ItemSpec | undefined {
  return isListBlock(block) ? LIST_SPEC : ENTRY_SPEC[block.type];
}

type Item = BlockEntry | ListItem;

function itemsOf(block: Block): Item[] {
  return isListBlock(block) ? block.listItems ?? [] : block.entries ?? [];
}

/** Does the block hold this item (it may have just been deleted)? */
export function hasItem(block: Block, itemId: string) {
  return itemsOf(block).some((i) => i.id === itemId);
}

/** "Adım 2" — how the panel names an item. */
export function itemName(block: Block, itemId: string) {
  const spec = specOf(block);
  const index = itemsOf(block).findIndex((i) => i.id === itemId);
  return `${spec?.noun ?? "Öğe"} ${index + 1}`;
}

/** Can the item move up (-1) / down (+1)? */
export function canMoveItem(block: Block, itemId: string, dir: -1 | 1) {
  const items = itemsOf(block);
  const to = items.findIndex((i) => i.id === itemId) + dir;
  return to >= 0 && to < items.length;
}

function withItems(block: Block, items: Item[]): Partial<Block> {
  return isListBlock(block) ? { listItems: items as ListItem[] } : { entries: items as BlockEntry[] };
}

export function moveItem(block: Block, itemId: string, dir: -1 | 1): Partial<Block> {
  const items = [...itemsOf(block)];
  const from = items.findIndex((i) => i.id === itemId);
  const to = from + dir;
  if (from < 0 || to < 0 || to >= items.length) return {};
  [items[from], items[to]] = [items[to], items[from]];
  return withItems(block, items);
}

export function duplicateItem(block: Block, itemId: string): { patch: Partial<Block>; id: string } {
  const items = [...itemsOf(block)];
  const from = items.findIndex((i) => i.id === itemId);
  const id = editorUid(isListBlock(block) ? "li" : "en");
  if (from >= 0) items.splice(from + 1, 0, { ...items[from], id });
  return { patch: withItems(block, items), id };
}

export function removeItem(block: Block, itemId: string): Partial<Block> {
  return withItems(block, itemsOf(block).filter((i) => i.id !== itemId));
}

function addEntry(block: Block): { patch: Partial<Block>; id: string } {
  if (isListBlock(block)) {
    const id = editorUid("li");
    return { patch: { listItems: [...(block.listItems ?? []), { id, text: "" }] }, id };
  }
  const id = editorUid("en");
  const entry: BlockEntry = { id };
  if (block.type === "links") entry.icon = "web";
  if (block.type === "bars") entry.value = "50";
  return { patch: { entries: [...(block.entries ?? []), entry] }, id };
}

/** Turkish plural by vowel harmony: Kart → Kartlar, Görsel → Görseller. */
function plural(noun: string) {
  const vowel = noun.toLocaleLowerCase("tr").match(/[aıoueiöü](?=[^aıoueiöü]*$)/)?.[0];
  return noun + (vowel && "aıou".includes(vowel) ? "lar" : "ler");
}

/** First words of an item, for the list. */
function itemPreview(block: Block, item: Item, lang: Lang) {
  const en = lang === "en";
  if (isListBlock(block)) {
    const li = item as ListItem;
    return (en ? li.textEn : undefined) || li.text;
  }
  const e = item as BlockEntry;
  const pick = (key: "title" | "label" | "caption" | "value" | "text") => (en ? e[`${key}En` as const] : undefined) || e[key];
  return pick("title") || pick("label") || pick("caption") || pick("value") || pick("text");
}

function ItemList({ block, lang, onSelect }: { block: Block; lang: Lang; onSelect: (id: string) => void }) {
  const spec = specOf(block);
  const items = itemsOf(block);
  if (!items.length) return <p className="text-[11px] text-[var(--text-subtitle)]">Henüz yok.</p>;
  return (
    <>
      {items.map((item, i) => {
        const preview = itemPreview(block, item, lang)?.replace(/\*\*|\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/\s+/g, " ").trim();
        const src = spec?.image ? (item as BlockEntry).src : undefined;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item.id)}
            className="group/item flex items-center gap-2 w-[calc(100%+16px)] h-8 -mx-2 px-2 rounded-[6px] text-left hover:bg-[var(--bg-4)] transition-colors cursor-pointer"
          >
            {spec?.image ? (
              <span className="relative w-5 h-5 shrink-0 rounded-[4px] overflow-hidden bg-[var(--bg-4)]">
                {src && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={src} alt="" className="w-full h-full object-cover" />
                )}
              </span>
            ) : (
              <span className="flex items-center justify-center w-5 h-5 shrink-0 rounded-[4px] bg-[var(--bg-4)] text-[10px] font-medium text-[var(--text-subtitle)] tabular-nums">{i + 1}</span>
            )}
            <span className={cn("min-w-0 flex-1 truncate text-[12px]", preview ? "text-[var(--text-title)]" : "text-[var(--text-subtitle)]")}>
              {preview || `${spec?.noun ?? "Öğe"} ${i + 1}`}
            </span>
            <span className="shrink-0 text-[var(--text-subtitle)] opacity-0 group-hover/item:opacity-100 transition-opacity">{Glyphs.chevron}</span>
          </button>
        );
      })}
    </>
  );
}

/** A labelled field inside an item's settings. */
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] leading-4 text-[var(--text-subtitle)] select-none">{label}</span>
      {children}
    </div>
  );
}

function AutoTextarea({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <textarea
      aria-label={label}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      rows={Math.min(8, Math.max(2, value.split("\n").length))}
      className="w-full resize-none rounded-[6px] border border-transparent bg-[var(--bg-4)] px-2 py-1.5 text-[12px] leading-[18px] text-[var(--text-title)] placeholder:text-[var(--text-subtitle)] hover:border-[var(--border-hover)] focus:outline-none focus:border-[var(--text-subtitle)] transition-colors"
    />
  );
}

/** Settings of one item (card, step, link, list item…) inside a block. */
export function ItemInspector({ block, itemId, lang, projectSlug, onChange }: {
  block: Block;
  itemId: string;
  lang: Lang;
  projectSlug: string;
  onChange: (patch: Partial<Block>) => void;
}) {
  const en = lang === "en";

  if (isListBlock(block)) {
    const items = block.listItems ?? [];
    const item = items.find((i) => i.id === itemId);
    if (!item) return null;
    const update = (patch: Partial<ListItem>) => onChange({ listItems: items.map((i) => (i.id === itemId ? { ...i, ...patch } : i)) });
    return (
      <div className="flex flex-col">
        <Group title="İçerik">
          <Field label="Metin">
            <AutoTextarea label="Metin" value={(en ? item.textEn : item.text) ?? ""} onChange={(v) => update(en ? { textEn: v } : { text: v })} />
          </Field>
          {block.listStyle === "check" && (
            <Row label="İşaretli">
              <Choice value={Boolean(item.checked)} options={[{ value: false, label: "Hayır" }, { value: true, label: "Evet" }]} onChange={(checked) => update({ checked })} />
            </Row>
          )}
        </Group>
      </div>
    );
  }

  const spec = ENTRY_SPEC[block.type];
  const entries = block.entries ?? [];
  const entry = entries.find((e) => e.id === itemId);
  if (!spec || !entry) return null;
  const update = (patch: Partial<BlockEntry>) => onChange({ entries: entries.map((e) => (e.id === itemId ? { ...e, ...patch } : e)) });
  const keyOf = (f: ItemField) => (en && !f.shared ? `${f.key}En` : f.key) as keyof BlockEntry;

  return (
    <div className="flex flex-col">
      {spec.image && (
        <Group title={block.type === "team" ? "Fotoğraf" : "Görsel"}>
          <ImageSource
            src={entry.src}
            alt={en ? entry.altEn : entry.alt}
            onSrc={(src) => update({ src })}
            onAlt={(alt) => update(en ? { altEn: alt } : { alt })}
            uploadId={`${block.id}-${entry.id}`}
            projectSlug={projectSlug}
          />
        </Group>
      )}
      <Group title="İçerik">
        {spec.fields.map((f) => {
          const value = (entry[keyOf(f)] as string | undefined) ?? "";
          const set = (v: string) => update({ [keyOf(f)]: v });
          return (
            <Field key={f.key} label={f.label}>
              {f.multiline ? (
                <AutoTextarea label={f.label} value={value} onChange={set} placeholder={f.placeholder} />
              ) : (
                <TextField
                  label={f.label}
                  type={f.key === "href" ? "url" : "text"}
                  value={value}
                  onChange={set}
                  placeholder={f.placeholder}
                  prefix={f.color ? (
                    <label className="relative block w-3.5 h-3.5 shrink-0 rounded-[3px] border border-[var(--border-hover)] overflow-hidden cursor-pointer" style={{ backgroundColor: value || "transparent" }}>
                      <input
                        type="color"
                        value={/^#[0-9a-f]{6}$/i.test(value) ? value : "#000000"}
                        onChange={(e) => set(e.target.value)}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                        aria-label={`${f.label} seç`}
                      />
                    </label>
                  ) : undefined}
                />
              )}
            </Field>
          );
        })}
      </Group>
      {spec.icon && (
        <Group title="İkon">
          <Row label="Tür">
            <SelectField
              label="İkon"
              value={entry.icon ?? "web"}
              options={LINK_ICONS}
              onChange={(icon) => update({ icon: (icon as LinkIconType) || "web" })}
            />
          </Row>
        </Group>
      )}
    </div>
  );
}
