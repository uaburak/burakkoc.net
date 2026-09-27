"use client";

import { useState, type ReactNode } from "react";
import type { AspectRatio, Block, BlockEntry, BlockType, BlockVariant, GridAlign, GridGap, GridSettings, Group as PageGroup, LinkIconType, ListItem, ListStyle, PageSection, ProjectData } from "@/types/project";
import { cn } from "@/lib/utils";
import { Input } from "@/components/Input";
import { Segmented } from "@/components/Segmented";
import { Select } from "@/components/Select";
import { BlockFields } from "@/components/admin/BlockFields";
import { CoverImageUpload } from "@/components/admin/FormEditor";
import { UploadZone } from "@/components/admin/ImageBlockEditor";
import type { ProjectMeta } from "@/components/admin/editorActions";
import { editorUid } from "@/components/project/editing";
import { BLOCK_LABELS, GROUP_TONE, SECTION_TONE, blockTone } from "@/components/admin/blockCatalog";
import { GRID_PRESETS, GRID_UNITS, MAX_COLUMNS, clampSpan, gridColumns, layoutName, withColumnCount, withColumnWidth } from "@/lib/projectLayout";

/**
 * The live editor's inspector ("Düzenle") — whatever was clicked on the page:
 * - the project (nothing selected): cover, company, address;
 * - a section (Bölüm): the grid its Bloks sit on, and its Bloks;
 * - a Blok (group): its width in the section, the grid its components sit
 *   on, and its components;
 * - a component (Bileşen): its layout options, its image, and the list of its items;
 * - an item inside a component (card, step, link, list item…): its fields.
 * Text can always be edited on the page too; this is the tidy way to reach
 * everything else (images, links, icons, values).
 *
 * Only reads shared components — the block editor is unaffected.
 */

type Lang = "tr" | "en";

// ── Primitives ────────────────────────────────────────────────────────────────

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-1.5">
      <h3 className="px-3 text-[12px] font-medium leading-4 text-[var(--text-subtitle)] select-none">{title}</h3>
      <div className="flex flex-col gap-1 p-1 rounded-[18px] bg-[var(--bg-4)]">{children}</div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 min-h-10 pl-3 pr-1">
      <span className="shrink-0 text-[13px] leading-5 text-[var(--text-p)] select-none">{label}</span>
      {children}
    </div>
  );
}

/** Segmented control over typed values. */
function Choice<T>({ value, options, onChange }: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <Segmented
      size="sm"
      options={options.map((o) => o.label)}
      value={options.find((o) => o.value === value)?.label ?? options[0].label}
      onChange={(label) => {
        const option = options.find((o) => o.label === label);
        if (option) onChange(option.value);
      }}
    />
  );
}

function Hint({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-2 px-3 text-[12px] leading-5 text-[var(--text-subtitle)]">
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden className="shrink-0 mt-[3px]">
        <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.2" />
        <path d="M7 6.5v3M7 4.5v.01" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
      <span>{children}</span>
    </p>
  );
}

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
  const [mode, setMode] = useState<"URL" | "Yükle">("URL");
  return (
    <div className="flex flex-col gap-1.5 p-1">
      {!compact && (
        <div className="relative w-full h-36 rounded-[14px] overflow-hidden bg-[var(--bg-1)] border border-[var(--border)]">
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="absolute inset-0 flex items-center justify-center text-[12px] text-[var(--text-subtitle)]">Görsel yok</span>
          )}
        </div>
      )}
      <div className="flex items-center gap-1.5">
        <Segmented size="sm" options={["URL", "Yükle"]} value={mode} onChange={(v) => setMode(v as "URL" | "Yükle")} />
        {mode === "URL" ? (
          <Input type="url" bgContext="block" size="sm" value={src ?? ""} onChange={(e) => onSrc(e.target.value)} placeholder="https://…" className="flex-1 min-w-0" />
        ) : (
          <UploadZone blockId={uploadId} projectSlug={projectSlug} currentSrc={src} onUploaded={(url) => onSrc(url)} />
        )}
      </div>
      {onAlt && (
        <Input type="text" bgContext="block" size="sm" value={alt ?? ""} onChange={(e) => onAlt(e.target.value)} placeholder="Alt metin — görseli kısaca tarif et" />
      )}
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

const GRID_ALIGNS: { value: GridAlign; label: string }[] = [
  { value: "start", label: "Üst" },
  { value: "center", label: "Orta" },
  { value: "end", label: "Alt" },
];

/** Blocks whose own editor is the whole story (no inline text on the page). */
const OWN_EDITOR = new Set<Block["type"]>(["code", "figma", "iframe"]);

// ── Block inspector ───────────────────────────────────────────────────────────

export function BlockInspector({ block, lang, projectSlug, placement, onChange, onSelectEntry }: {
  block: Block;
  lang: Lang;
  projectSlug: string;
  /** Its width in its Blok's grid (see PlacementGroup) */
  placement?: ReactNode;
  onChange: (patch: Partial<Block>) => void;
  /** Open an item's own settings (also right after adding one) */
  onSelectEntry: (entryId: string) => void;
}) {
  const en = lang === "en";
  const type = block.type;

  if (OWN_EDITOR.has(type)) {
    return (
      <div className="flex flex-col gap-4">
        {placement}
        <div className="flex flex-col gap-2.5 p-[12px] rounded-[18px] bg-[var(--bg-4)]">
          <BlockFields block={block} onChange={onChange} lang={lang} projectSlug={projectSlug} />
        </div>
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
    const addColumn = () =>
      onChange({ tableRows: rows.map((r) => ({ ...r, cells: [...r.cells, ""], ...(r.cellsEn ? { cellsEn: [...r.cellsEn, ""] } : {}) })) });
    const removeColumn = () =>
      onChange({
        tableRows: rows.map((r) => ({
          ...r,
          cells: r.cells.slice(0, columnCount - 1),
          ...(r.cellsEn ? { cellsEn: r.cellsEn.slice(0, columnCount - 1) } : {}),
        })),
      });
    options.push(
      <Row key="header" label="İlk satır">
        <Choice
          value={block.tableHeader !== false}
          options={[{ value: true, label: "Başlık" }, { value: false, label: "Normal" }]}
          onChange={(tableHeader) => onChange({ tableHeader })}
        />
      </Row>,
      <Row key="cols" label="Sütunlar">
        <div className="flex items-center gap-1">
          <StepButton label="Sütun kaldır" disabled={columnCount <= 1} onClick={removeColumn}>−</StepButton>
          <span className="w-6 text-center text-[13px] font-medium tabular-nums text-[var(--text-title)]">{columnCount}</span>
          <StepButton label="Sütun ekle" disabled={columnCount >= 6} onClick={addColumn}>+</StepButton>
        </div>
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
      <div key="src" className="p-1">
        <Input type="url" bgContext="block" size="sm" value={block.src ?? ""} onChange={(e) => onChange({ src: e.target.value })} placeholder="YouTube, Vimeo ya da .mp4 / .webm adresi" />
      </div>
    );
  }

  const spec = specOf(block);

  return (
    <div className="flex flex-col gap-4">
      <Hint>Metinleri sayfada çift tıklayarak düzenle. İçindeki bir öğeye tıklarsan onun ayarları açılır.</Hint>
      {placement}
      {options.length > 0 && <Group title="Görünüm">{options}</Group>}
      {media.length > 0 && <Group title={type === "video" ? "Video" : "Görsel"}>{media}</Group>}
      {spec && (
        <Group title={plural(spec.noun)}>
          <ItemList block={block} lang={lang} onSelect={onSelectEntry} />
          {type !== "compare" && (
            <button
              type="button"
              onClick={() => {
                const { patch, id } = addEntry(block);
                onChange(patch);
                onSelectEntry(id);
              }}
              className="flex items-center gap-2 h-10 px-3 rounded-[14px] text-[13px] text-[var(--text-subtitle)] hover:text-[var(--text-title)] hover:bg-[var(--bg-1)] transition-colors cursor-pointer"
            >
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden>
                <path d="M7 2.5v9M2.5 7h9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
              {spec.noun} ekle
            </button>
          )}
        </Group>
      )}
    </div>
  );
}

function StepButton({ label, disabled, onClick, children }: { label: string; disabled?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="flex items-center justify-center w-7 h-7 rounded-full bg-[var(--bg-1)] text-[15px] leading-none text-[var(--text-title)] hover:bg-[var(--bg-2)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
    >
      {children}
    </button>
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
  return group.blocks.map((b) => BLOCK_LABELS[b.type]).join(", ") || undefined;
}

/**
 * The grid a section lays its Bloks on — or a Blok its components: how many
 * columns, their widths (a preset or column by column), the gap and the
 * vertical alignment. `tone` is the level's colour.
 */
function GridFields({ grid, tone, onChange }: {
  grid?: GridSettings;
  tone: string;
  onChange: (grid: GridSettings) => void;
}) {
  const columns = gridColumns(grid);
  const count = columns.length;
  const presets = GRID_PRESETS[count];
  const current = layoutName(columns);
  const setCount = (n: number) => onChange(n <= 1 ? { ...grid, columns: undefined, align: undefined } : withColumnCount(grid, n));

  return (
    <Group title="Izgara">
      <Row label="Sütun">
        <div className="flex items-center gap-1">
          <StepButton label="Sütun azalt" disabled={count <= 1} onClick={() => setCount(count - 1)}>−</StepButton>
          <span className="w-6 text-center text-[13px] font-medium tabular-nums text-[var(--text-title)]">{count}</span>
          <StepButton label="Sütun ekle" disabled={count >= MAX_COLUMNS} onClick={() => setCount(count + 1)}>+</StepButton>
        </div>
      </Row>
      {count > 1 && presets && (
        <div className="flex flex-wrap gap-1.5 px-2 pb-1">
          {presets.map((preset) => {
            const active = layoutName(preset) === current;
            return (
              <button
                key={layoutName(preset)}
                type="button"
                title={`${preset.join(" · ")} / ${GRID_UNITS}`}
                onClick={() => onChange({ ...grid, columns: preset })}
                style={active ? { borderColor: tone } : undefined}
                className={cn(
                  "flex flex-col gap-1 w-[72px] p-1.5 rounded-[10px] border bg-[var(--bg-1)] cursor-pointer transition-colors",
                  active ? "" : "border-transparent hover:border-[var(--border-hover)]"
                )}
              >
                <span className="flex gap-0.5 h-3.5">
                  {preset.map((w, i) => (
                    <span key={i} className="basis-0 rounded-[3px] bg-[var(--bg-5)]" style={{ flexGrow: w, background: active ? tone : undefined }} />
                  ))}
                </span>
                <span className="text-[11px] leading-3 text-[var(--text-subtitle)] tabular-nums">{layoutName(preset)}</span>
              </button>
            );
          })}
        </div>
      )}
      {count > 1 && (
        <div className="flex flex-col gap-1 px-2 pb-1.5">
          {/* The columns to scale; each one's width can be nudged (its neighbour gives or takes). */}
          <div className="flex gap-1 h-6">
            {columns.map((w, i) => (
              <span
                key={i}
                className="flex items-center justify-center basis-0 min-w-0 rounded-[6px] text-[11px] font-medium text-white tabular-nums"
                style={{ flexGrow: w, background: tone }}
              >
                {w}
              </span>
            ))}
          </div>
          {columns.map((w, i) => (
            <div key={i} className="flex items-center justify-between gap-3 h-9 pl-1">
              <span className="text-[13px] text-[var(--text-p)] select-none">{i + 1}. sütun</span>
              <div className="flex items-center gap-1">
                <StepButton label={`${i + 1}. sütunu daralt`} disabled={w <= 1} onClick={() => onChange(withColumnWidth(grid, i, w - 1))}>−</StepButton>
                <span className="w-12 text-center text-[13px] tabular-nums text-[var(--text-title)]">
                  {w}<span className="text-[var(--text-subtitle)]">/{GRID_UNITS}</span>
                </span>
                <StepButton
                  label={`${i + 1}. sütunu genişlet`}
                  disabled={w >= GRID_UNITS - 1 || columns[i < count - 1 ? i + 1 : i - 1] <= 1}
                  onClick={() => onChange(withColumnWidth(grid, i, w + 1))}
                >
                  +
                </StepButton>
              </div>
            </div>
          ))}
        </div>
      )}
      <Row label="Boşluk">
        <Choice value={grid?.gap ?? "md"} options={GRID_GAPS} onChange={(gap) => onChange({ ...grid, gap })} />
      </Row>
      {count > 1 && (
        <Row label="Hizalama">
          <Choice value={grid?.align ?? "start"} options={GRID_ALIGNS} onChange={(align) => onChange({ ...grid, align })} />
        </Row>
      )}
    </Group>
  );
}

/**
 * How many columns of its parent's grid a Blok or component covers — only
 * when the parent has more than one column.
 */
export function PlacementGroup({ title, span, parent, onChange }: {
  title: string;
  span?: number;
  parent?: GridSettings;
  onChange: (span: number) => void;
}) {
  const count = gridColumns(parent).length;
  if (count < 2) return null;
  const options = Array.from({ length: count }, (_, i) => ({
    value: i + 1,
    label: i + 1 === count ? "Tam" : count <= 3 ? `${i + 1} sütun` : String(i + 1),
  }));
  return (
    <Group title={title}>
      <Row label="Genişlik">
        <Choice value={clampSpan(span, count)} options={options} onChange={onChange} />
      </Row>
    </Group>
  );
}

/** A child in a section's or Blok's list: its colour, name and a preview. */
function ChildRow({ tone, label, detail, onClick }: { tone: string; label: string; detail?: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group/item flex items-center gap-2.5 w-full h-10 pl-3 pr-3 rounded-[14px] text-left hover:bg-[var(--bg-1)] transition-colors cursor-pointer"
    >
      <span aria-hidden className="w-2 h-2 shrink-0 rounded-full" style={{ background: tone }} />
      <span className="shrink-0 text-[13px] font-medium text-[var(--text-title)]">{label}</span>
      <span className="min-w-0 flex-1 truncate text-[12px] text-[var(--text-subtitle)]">{detail}</span>
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden className="shrink-0 text-[var(--text-subtitle)] opacity-0 group-hover/item:opacity-100 transition-opacity">
        <path d="M4.5 3l3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

function AddRow({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 h-10 px-3 rounded-[14px] text-[13px] text-[var(--text-subtitle)] hover:text-[var(--text-title)] hover:bg-[var(--bg-1)] transition-colors cursor-pointer"
    >
      <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden>
        <path d="M7 2.5v9M2.5 7h9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
      {label}
    </button>
  );
}

/** A section: the grid its Bloks sit on, and its Bloks. */
export function SectionInspector({ section, onChange, onSelectGroup, onAddGroup }: {
  section: PageSection;
  onChange: (patch: { grid?: GridSettings }) => void;
  onSelectGroup: (groupId: string) => void;
  onAddGroup: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <Hint>Izgara, bölümdeki blokların yan yana nasıl dizileceğini belirler: bloklar sütunları sırayla doldurur, sığmayan alt satıra geçer.</Hint>
      <GridFields grid={section.grid} tone={SECTION_TONE} onChange={(grid) => onChange({ grid })} />
      <Group title="Bloklar">
        {section.groups.map((g, i) => (
          <ChildRow key={g.id} tone={GROUP_TONE} label={`Blok ${i + 1}`} detail={groupSummary(g) ?? "Boş"} onClick={() => onSelectGroup(g.id)} />
        ))}
        <AddRow label="Blok ekle" onClick={onAddGroup} />
      </Group>
    </div>
  );
}

/** A Blok: its width in the section, the grid its components sit on, and its components. */
export function GroupInspector({ group, section, lang, onChange, onSelectBlock, onAddBlock }: {
  group: PageGroup;
  section: PageSection;
  lang: Lang;
  onChange: (patch: { grid?: GridSettings; span?: number }) => void;
  onSelectBlock: (blockId: string) => void;
  onAddBlock: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <Hint>Izgara, bloktaki bileşenlerin yan yana nasıl dizileceğini belirler. Bir bileşene tıklarsan onun ayarları açılır.</Hint>
      <PlacementGroup title="Bölümdeki yeri" span={group.span} parent={section.grid} onChange={(span) => onChange({ span })} />
      <GridFields grid={group.grid} tone={GROUP_TONE} onChange={(grid) => onChange({ grid })} />
      <Group title="Bileşenler">
        {group.blocks.map((b) => (
          <ChildRow key={b.id} tone={blockTone(b.type)} label={BLOCK_LABELS[b.type]} detail={blockSummary(b, lang)} onClick={() => onSelectBlock(b.id)} />
        ))}
        {group.blocks.length === 0 && <p className="px-3 py-2 text-[12px] text-[var(--text-subtitle)]">Henüz bileşen yok.</p>}
        <AddRow label="Bileşen ekle" onClick={onAddBlock} />
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
    <div className="flex flex-col gap-4">
      <Hint>Başlık, kategori, yıl ve açıklama sayfanın en üstünde — çift tıklayıp düzenle. Bir bölüm ya da blok seçince ayarları burada görünür.</Hint>
      <Group title="Kapak görseli">
        <div className="p-1">
          <CoverImageUpload slug={slug} currentSrc={project.coverImage} onChange={(coverImage) => onChange({ coverImage })} />
        </div>
      </Group>
      <Group title="Detaylar">
        <Row label="Şirket">
          <Select
            size="sm"
            bgContext="block"
            options={companies}
            value={project.company ?? ""}
            onChange={(company) => onChange({ company })}
            placeholder="Seçilmedi"
            className="w-[180px]"
          />
        </Row>
        <Row label="Adres">
          <span className="min-w-0 truncate pr-2 text-[13px] text-[var(--text-subtitle)] tabular-nums">/projects/{slug}</span>
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
  if (!items.length) return <p className="px-3 py-2 text-[12px] text-[var(--text-subtitle)]">Henüz yok.</p>;
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
            className="group/item flex items-center gap-2.5 w-full h-10 pl-2 pr-3 rounded-[14px] text-left hover:bg-[var(--bg-1)] transition-colors cursor-pointer"
          >
            {spec?.image ? (
              <span className="relative w-7 h-7 shrink-0 rounded-[8px] overflow-hidden bg-[var(--bg-1)] border border-[var(--border)]">
                {src && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={src} alt="" className="w-full h-full object-cover" />
                )}
              </span>
            ) : (
              <span className="flex items-center justify-center w-6 h-6 shrink-0 rounded-full bg-[var(--bg-1)] text-[11px] font-medium text-[var(--text-subtitle)] tabular-nums">{i + 1}</span>
            )}
            <span className={cn("min-w-0 flex-1 truncate text-[13px]", preview ? "text-[var(--text-p)]" : "text-[var(--text-subtitle)]")}>
              {preview || `${spec?.noun ?? "Öğe"} ${i + 1}`}
            </span>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden className="shrink-0 text-[var(--text-subtitle)] opacity-0 group-hover/item:opacity-100 transition-opacity">
              <path d="M4.5 3l3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        );
      })}
    </>
  );
}

/** A labelled field inside an item's settings. */
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="px-3 text-[12px] leading-4 text-[var(--text-subtitle)] select-none">{label}</span>
      {children}
    </label>
  );
}

function AutoTextarea({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <textarea
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      rows={Math.min(8, Math.max(2, value.split("\n").length))}
      className="w-full resize-none rounded-[16px] border border-transparent bg-[var(--bg-1)] px-4 py-2.5 text-[13px] leading-5 text-[var(--text-p)] placeholder:text-[var(--text-subtitle)] hover:border-[var(--border-hover)] focus:outline-none focus:border-[var(--border-hover)] transition-colors"
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
      <div className="flex flex-col gap-4">
        <Group title="İçerik">
          <div className="flex flex-col gap-2.5 p-2">
            <Field label="Metin">
              <AutoTextarea value={(en ? item.textEn : item.text) ?? ""} onChange={(v) => update(en ? { textEn: v } : { text: v })} />
            </Field>
          </div>
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
    <div className="flex flex-col gap-4">
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
        <div className="flex flex-col gap-2.5 p-2">
          {spec.fields.map((f) => {
            const value = (entry[keyOf(f)] as string | undefined) ?? "";
            const set = (v: string) => update({ [keyOf(f)]: v });
            return (
              <Field key={f.key} label={f.label}>
                {f.multiline ? (
                  <AutoTextarea value={value} onChange={set} placeholder={f.placeholder} />
                ) : (
                  <Input
                    type={f.key === "href" ? "url" : "text"}
                    bgContext="block"
                    size="sm"
                    value={value}
                    onChange={(e) => set(e.target.value)}
                    placeholder={f.placeholder}
                    startContent={f.color ? (
                      <label className="relative block w-4 h-4 rounded-full border border-[var(--border-hover)] overflow-hidden cursor-pointer" style={{ backgroundColor: value || "transparent" }}>
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
        </div>
      </Group>
      {spec.icon && (
        <Group title="İkon">
          <Row label="Tür">
            <Select
              size="sm"
              bgContext="block"
              options={LINK_ICONS.map((o) => o.label)}
              value={LINK_ICONS.find((o) => o.value === (entry.icon ?? "web"))?.label ?? ""}
              onChange={(label) => update({ icon: LINK_ICONS.find((o) => o.label === label)?.value ?? "web" })}
              className="w-[160px]"
            />
          </Row>
        </Group>
      )}
    </div>
  );
}
