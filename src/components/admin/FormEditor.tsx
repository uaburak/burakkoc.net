"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Block, BlockType, GridAlign, GridGap, GridSettings, Group, PageDivider, PageSection, ProjectData } from "@/types/project";
import { uploadFile, coverStoragePath } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { PillButton } from "@/components/Button";
import { Input } from "@/components/Input";
import { Segmented } from "@/components/Segmented";
import { Select } from "@/components/Select";
import { JsonEditor } from "@/components/admin/JsonEditor";
import { ProjectThemeFields } from "@/components/admin/ProjectThemeFields";
import { BlockFields } from "@/components/admin/BlockFields";
import { BLOCK_LABELS, BlockPickerDialog, GROUP_TONE, PlusIcon, blockTone } from "@/components/admin/blockCatalog";
import {
  GroupBlocks,
  REORDER_LIST,
  REORDER_ROOM,
  ReorderRow,
  SectionGroups,
  sortableStyle,
  usePageReorder,
  useKeepDropPosition,
  useSortableBlock,
  useSortableGroup,
  useSortablePageItem,
} from "@/components/admin/ProjectDnd";
import { localizeBlock } from "@/components/project/editing";
import { GRID_PRESETS, MAX_COLUMNS, clampSpan, gridColumns, layoutName, sectionBlocks, withColumnCount } from "@/lib/projectLayout";
import type { EditorActions, ProjectMeta } from "@/components/admin/editorActions";
import { DRAG_LIFT, DragHandle } from "@/components/project/Sortable";

/**
 * Block editor ("Blok Düzenleyici"): the project as a stack of form cards —
 * sections (Bölüm) holding Bloks (groups) holding components (Bileşen), each
 * section and Blok with its grid. Every card can be dragged by its grip or by
 * pressing and holding it; the traffic dots still move up / down / delete.
 */

// ── Traffic light action dots ────────────────────────────────────────────────
/** Figma: pill container bg-[var(--bg-4)] + border, gap-2, p-[7px], rounded-full; dots 12×12 px */
export function TrafficDots({
  onUp, onDown, onDelete,
}: {
  onUp: () => void;
  onDown: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onUp}
        title="Yukarı taşı"
        data-traffic-color="#00e288"
        data-traffic-icon="up"
        className="w-3 h-3 rounded-full transition-opacity duration-150 cursor-pointer flex-shrink-0 hover:opacity-75"
        style={{ background: "#00e288" }}
      />
      <button
        type="button"
        onClick={onDown}
        title="Aşağı taşı"
        data-traffic-color="#e2d300"
        data-traffic-icon="down"
        className="w-3 h-3 rounded-full transition-opacity duration-150 cursor-pointer flex-shrink-0 hover:opacity-75"
        style={{ background: "#e2d300" }}
      />
      <button
        type="button"
        onClick={onDelete}
        title="Sil"
        data-traffic-color="#e20000"
        data-traffic-icon="trash"
        className="w-3 h-3 rounded-full transition-opacity duration-150 cursor-pointer flex-shrink-0 hover:opacity-75"
        style={{ background: "#e20000" }}
      />
    </div>
  );
}

// ── Pill label ───────────────────────────────────────────────────────────────
/** 40px tall — h-10 (40px) inline-flex items-center */
export function PillLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center px-[6px] text-[16px] font-medium text-[var(--text-title)] select-none whitespace-nowrap">
      {children}
    </span>
  );
}

// ── Meta Field ────────────────────────────────────────────────────────────────

function MetaField({ value, placeholder, onChange, disabled }: {
  value: string; placeholder: string; onChange?: (v: string) => void; disabled?: boolean;
}) {
  return (
    <Input
      type="text"
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      placeholder={placeholder}
      size="md"
      disabled={disabled}
    />
  );
}

// ── Cover Image Upload ─────────────────────────────────────────────────────────
// Mirrors the ImageBlockEditor layout exactly:
// Segmented (URL | Yükle) + input/upload zone on the same row.

const COVER_SOURCE_MODES = ["URL", "Yükle"];

function CoverUploadZone({
  slug,
  currentSrc,
  onUploaded,
}: {
  slug: string;
  currentSrc?: string;
  onUploaded: (url: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filename, setFilename] = useState<string | null>(null);

  // Extract filename from existing src on mount
  useEffect(() => {
    if (currentSrc && !filename) {
      const parts = currentSrc.split("/");
      const raw = parts[parts.length - 1].split("?")[0];
      const match = raw.match(/^\d+_(.+)$/);
      setFilename(match ? match[1] : raw);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleFile(file: File) {
    if (!file.type.startsWith("image/")) {
      setError("Sadece resim dosyaları yüklenebilir.");
      return;
    }
    setError(null);
    setProgress(0);
    try {
      const path = coverStoragePath(slug, file);
      const url = await uploadFile(file, path, setProgress);
      setFilename(file.name);
      onUploaded(url);
    } catch (e) {
      setError("Yükleme başarısız oldu.");
      console.error(e);
    } finally {
      setProgress(null);
    }
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  return (
    <div className="flex items-center gap-2 flex-1 min-w-0">
      <PillButton
        size="md"
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        startIcon={
          progress !== null ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="animate-spin">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeDasharray="30 70" strokeLinecap="round"/>
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <polyline points="17 8 12 3 7 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <line x1="12" y1="3" x2="12" y2="15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          )
        }
      >
        {progress !== null ? `${progress}%` : "Dosya Seç"}
      </PillButton>

      {/* File name chip */}
      {filename && progress === null && (
        <span className="text-[13px] text-[var(--text-subtitle)] truncate min-w-0 flex-1 select-none">
          {filename}
        </span>
      )}

      {error && <span className="text-[12px] text-red-500 select-none truncate">{error}</span>}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}

export function CoverImageUpload({
  slug,
  currentSrc,
  onChange,
}: {
  slug: string;
  currentSrc?: string;
  onChange: (url: string) => void;
}) {
  const [tab, setTab] = useState<"URL" | "Yükle">("URL");

  return (
    <div className="flex items-center gap-[10px]">
      <Segmented
        options={COVER_SOURCE_MODES}
        value={tab}
        onChange={(v) => setTab(v as "URL" | "Yükle")}
        size="md"
      />
      {tab === "URL" ? (
        <Input
          type="url"
          value={currentSrc ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Kapak resmi URL — https://…"
          size="md"
          className="flex-1"
        />
      ) : (
        <CoverUploadZone
          slug={slug}
          currentSrc={currentSrc}
          onUploaded={onChange}
        />
      )}
    </div>
  );
}


// ── Project meta ──────────────────────────────────────────────────────────────

/** Title, slug, category, year, company, description and cover — shared with the live editor's panel. */
export function ProjectMetaFields({ project, lang, slug, companies, onChange }: {
  project: ProjectData;
  lang: "tr" | "en";
  slug: string;
  companies: string[];
  onChange: (updates: Partial<ProjectMeta>) => void;
}) {
  const descRef = useRef<HTMLTextAreaElement>(null);
  const autoResizeDesc = useCallback(() => {
    const el = descRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  useEffect(() => {
    autoResizeDesc();
  }, [project.description, project.descriptionEn, lang, autoResizeDesc]);

  return (
    <section className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2.5">
        {/* Single title field — follows active edit lang (TR/EN) */}
        <MetaField
          value={lang === "en" ? (project.titleEn ?? "") : project.title}
          placeholder={lang === "en" ? "Title (EN)" : "Başlık (TR)"}
          onChange={(v) => onChange(lang === "en" ? { titleEn: v } : { title: v })}
        />
        <MetaField value={project.slug}     placeholder="Slug"     disabled />
        <MetaField value={project.category} placeholder="Kategori" onChange={(v) => onChange({ category: v })} />
        <MetaField value={project.year}     placeholder="Yıl"      onChange={(v) => onChange({ year: v })} />
      </div>

      {/* Şirket Select (CV Deneyimlerinden) */}
      <Select
        options={companies}
        value={project.company ?? ""}
        onChange={(val) => onChange({ company: val })}
        placeholder="Şirket Seçin (Opsiyonel)"
        size="md"
      />

      <textarea
        ref={descRef}
        value={lang === "en" ? (project.descriptionEn ?? "") : (project.description ?? "")}
        placeholder={lang === "en" ? "Description (EN)…" : "Açıklama (TR)…"}
        onChange={(e) => {
          onChange(lang === "en" ? { descriptionEn: e.target.value } : { description: e.target.value });
          autoResizeDesc();
        }}
        rows={3}
        className="w-full resize-none overflow-hidden rounded-[18px] border border-[var(--border)] bg-[var(--bg-1)] hover:bg-[var(--bg-4)] hover:border-[var(--border-hover)] px-4 py-3 text-sm font-light leading-6 text-[var(--text-p)] placeholder:text-[var(--text-subtitle)] focus:outline-none focus:border-[var(--border-hover)] transition-all duration-150"
      />

      <CoverImageUpload slug={slug} currentSrc={project.coverImage} onChange={(url) => onChange({ coverImage: url })} />

    </section>
  );
}

// ── Grid settings (sections and Bloks) ───────────────────────────────────────

const GAP_LABELS: Record<GridGap, string> = { sm: "Az", md: "Orta", lg: "Geniş" };
const ALIGN_LABELS: Record<GridAlign, string> = { start: "Üst", center: "Orta", end: "Alt" };
const keyOf = <K extends string>(labels: Record<K, string>, label: string) =>
  (Object.keys(labels) as K[]).find((k) => labels[k] === label);

/** One line of grid settings: columns, a preset layout, gap and alignment. */
function GridBar({ grid, onChange }: { grid?: GridSettings; onChange: (grid: GridSettings) => void }) {
  const columns = gridColumns(grid);
  const count = columns.length;
  const presets = GRID_PRESETS[count] ?? [];
  const current = layoutName(columns);
  const counts = Array.from({ length: MAX_COLUMNS }, (_, i) => String(i + 1));
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="px-1 text-[13px] text-[var(--text-subtitle)] select-none">Sütun</span>
      <Select
        size="sm"
        bgContext="block"
        options={counts}
        value={String(count)}
        onChange={(v) => onChange(Number(v) <= 1 ? { ...grid, columns: undefined, align: undefined } : withColumnCount(grid, Number(v)))}
        className="w-[72px]"
      />
      {count > 1 && presets.length > 0 && (
        <Segmented
          size="sm"
          options={presets.map(layoutName)}
          value={presets.some((p) => layoutName(p) === current) ? current : ""}
          onChange={(label) => {
            const preset = presets.find((p) => layoutName(p) === label);
            if (preset) onChange({ ...grid, columns: preset });
          }}
        />
      )}
      <Segmented
        size="sm"
        options={Object.values(GAP_LABELS)}
        value={GAP_LABELS[grid?.gap ?? "md"]}
        onChange={(label) => onChange({ ...grid, gap: keyOf(GAP_LABELS, label) })}
      />
      {count > 1 && (
        <Segmented
          size="sm"
          options={Object.values(ALIGN_LABELS)}
          value={ALIGN_LABELS[grid?.align ?? "start"]}
          onChange={(label) => onChange({ ...grid, align: keyOf(ALIGN_LABELS, label) })}
        />
      )}
    </div>
  );
}

/** How many of its parent's columns a Blok / component covers (only with 2+ columns). */
function SpanSelect({ span, parent, onChange }: { span?: number; parent?: GridSettings; onChange: (span: number) => void }) {
  const count = gridColumns(parent).length;
  if (count < 2) return null;
  const options = Array.from({ length: count }, (_, i) => (i + 1 === count ? "Tam genişlik" : `${i + 1} sütun`));
  return (
    <Select
      size="sm"
      bgContext="block"
      options={options}
      value={options[clampSpan(span, count) - 1]}
      onChange={(label) => onChange(options.indexOf(label) + 1)}
      className="w-[128px]"
    />
  );
}

/** Coloured dot of a level — the same colours as the live editor's frames. */
function ToneDot({ tone }: { tone: string }) {
  return <span aria-hidden className="w-2 h-2 shrink-0 rounded-full" style={{ background: tone }} />;
}

// ── Component row ─────────────────────────────────────────────────────────────

function BlockRow({ block, group, lang, slug, actions }: {
  block: Block;
  group: Group;
  lang: "tr" | "en";
  slug: string;
  actions: EditorActions;
}) {
  const { setNodeRef, setActivatorNodeRef, listeners, transform, transition, isDragging } = useSortableBlock(block, group.id);
  return (
    <div
      ref={setNodeRef}
      style={sortableStyle(transform, transition)}
      {...listeners}
      className={cn(
        "flex flex-col gap-[10px] p-[12px] rounded-[18px] border border-[var(--border)] bg-[var(--bg-4)] transition-colors duration-150",
        isDragging && DRAG_LIFT
      )}
    >
      {/* Header: grip + label left, width + traffic dots right */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-0.5">
          <DragHandle activatorRef={setActivatorNodeRef} label="Bileşeni sürükle" className="text-[var(--text-subtitle)] hover:text-[var(--text-title)]" />
          <ToneDot tone={blockTone(block.type)} />
          <PillLabel>{BLOCK_LABELS[block.type]}</PillLabel>
        </div>
        <div className="flex items-center gap-3">
          <SpanSelect span={block.span} parent={group.grid} onChange={(span) => actions.updateBlock(block.id, { span })} />
          <TrafficDots
            onUp={() => actions.moveBlockBy(block.id, -1)}
            onDown={() => actions.moveBlockBy(block.id, 1)}
            onDelete={() => actions.deleteBlock(block.id)}
          />
        </div>
      </div>
      <BlockFields block={block} onChange={(u) => actions.updateBlock(block.id, u)} lang={lang} projectSlug={slug} />
    </div>
  );
}

// ── Add component button ──────────────────────────────────────────────────────

function AddBlockButton({ onAdd }: { onAdd: (type: BlockType, extras?: Partial<Block>) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <PillButton
        size="md"
        onClick={() => setOpen(true)}
        className="w-full justify-center border-dashed border-[var(--border-hover)] hover:border-[var(--text-subtitle)]"
        startIcon={<PlusIcon />}
      >
        Bileşen ekle
      </PillButton>
      {open && <BlockPickerDialog onPick={onAdd} onClose={() => setOpen(false)} />}
    </>
  );
}

// ── Blok card ─────────────────────────────────────────────────────────────────

function GroupCard({ group, index, section, lang, slug, actions }: {
  group: Group;
  index: number;
  section: PageSection;
  lang: "tr" | "en";
  slug: string;
  actions: EditorActions;
}) {
  const { setNodeRef, setActivatorNodeRef, listeners, transform, transition, isDragging } = useSortableGroup(group, section.id);
  return (
    <div
      ref={setNodeRef}
      style={sortableStyle(transform, transition)}
      {...listeners}
      className={cn(
        "flex flex-col gap-[10px] p-[12px] rounded-[24px] border border-dashed border-[color-mix(in_srgb,var(--edit-group)_45%,transparent)] bg-[var(--bg-1)] transition-colors duration-150",
        isDragging && cn(DRAG_LIFT, "border-solid border-[var(--edit-group)]")
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-0.5">
          <DragHandle activatorRef={setActivatorNodeRef} label="Bloğu sürükle" className="text-[var(--text-subtitle)] hover:text-[var(--text-title)]" />
          <ToneDot tone={GROUP_TONE} />
          <PillLabel>Blok {index + 1}</PillLabel>
        </div>
        <div className="flex items-center gap-3">
          <SpanSelect span={group.span} parent={section.grid} onChange={(span) => actions.updateGroup(group.id, { span })} />
          <TrafficDots
            onUp={() => actions.moveGroupBy(group.id, -1)}
            onDown={() => actions.moveGroupBy(group.id, 1)}
            onDelete={() => actions.deleteGroup(group.id)}
          />
        </div>
      </div>
      <GridBar grid={group.grid} onChange={(grid) => actions.updateGroup(group.id, { grid })} />

      <GroupBlocks group={group}>
        {group.blocks.length > 0 ? (
          <div className="flex flex-col gap-3">
            {group.blocks.map((block) => (
              <BlockRow key={block.id} block={block} group={group} lang={lang} slug={slug} actions={actions} />
            ))}
          </div>
        ) : (
          <p className="text-xs text-[var(--text-subtitle)] opacity-60 italic select-none text-center py-2">
            Henüz bileşen yok — Bileşen ekle ile başlayın ya da buraya bir bileşen sürükleyin
          </p>
        )}
      </GroupBlocks>

      <AddBlockButton onAdd={(type, extras) => actions.addBlock(group.id, type, extras)} />
    </div>
  );
}

// ── Section card ──────────────────────────────────────────────────────────────

function SectionCard({ section, index, lang, slug, actions }: {
  section: PageSection;
  index: number;
  lang: "tr" | "en";
  slug: string;
  actions: EditorActions;
}) {
  const { setNodeRef, setActivatorNodeRef, listeners, transform, transition, isDragging } = useSortablePageItem(section);
  const reordering = usePageReorder();
  const dropRef = useKeepDropPosition(isDragging);
  const ref = (el: HTMLElement | null) => { setNodeRef(el); dropRef(el); };

  if (reordering) {
    const heading = sectionBlocks(section).find((b) => b.type === "heading");
    return (
      <div ref={ref} style={sortableStyle(transform, transition)} {...listeners} className={cn("relative w-full", isDragging && "z-30")}>
        <ReorderRow
          label={`${String(index + 1).padStart(2, "0")} Bölüm`}
          detail={heading ? localizeBlock(heading, lang).content : undefined}
          dragging={isDragging}
          activatorRef={setActivatorNodeRef}
        />
      </div>
    );
  }

  return (
    <div
      ref={ref}
      style={sortableStyle(transform, transition)}
      {...listeners}
      className={cn(
        "flex flex-col gap-[10px] p-[18px] rounded-[32px] border border-[var(--border)] bg-[var(--bg-2)] transition-colors duration-200",
        isDragging && cn(DRAG_LIFT, "border-[var(--edit-accent)]")
      )}
    >
      {/* Header: grip + "01 Bölüm" left, traffic dots right */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-0.5">
          <DragHandle activatorRef={setActivatorNodeRef} label="Bölümü sürükle" className="text-[var(--text-subtitle)] hover:text-[var(--text-title)]" />
          <ToneDot tone="var(--edit-accent)" />
          <PillLabel>{String(index + 1).padStart(2, "0")} Bölüm</PillLabel>
        </div>
        <TrafficDots
          onUp={() => actions.moveItemBy(section.id, -1)}
          onDown={() => actions.moveItemBy(section.id, 1)}
          onDelete={() => actions.deleteItem(section.id)}
        />
      </div>
      <GridBar grid={section.grid} onChange={(grid) => actions.updateSection(section.id, { grid })} />

      <SectionGroups section={section}>
        {section.groups.length > 0 ? (
          <div className="flex flex-col gap-3">
            {section.groups.map((group, i) => (
              <GroupCard key={group.id} group={group} index={i} section={section} lang={lang} slug={slug} actions={actions} />
            ))}
          </div>
        ) : (
          <p className="text-xs text-[var(--text-subtitle)] opacity-40 italic select-none text-center py-2">
            Henüz blok yok — Blok ekle ile başlayın ya da buraya bir blok sürükleyin
          </p>
        )}
      </SectionGroups>

      <PillButton
        size="md"
        onClick={() => actions.addGroup(section.id)}
        className="w-full justify-center border-dashed border-[var(--border-hover)] hover:border-[var(--text-subtitle)]"
        startIcon={<PlusIcon />}
      >
        Blok ekle
      </PillButton>
    </div>
  );
}

// ── Divider card ──────────────────────────────────────────────────────────────

function DividerPageCard({ divider, actions }: { divider: PageDivider; actions: EditorActions }) {
  const { setNodeRef, setActivatorNodeRef, listeners, transform, transition, isDragging } = useSortablePageItem(divider);
  const reordering = usePageReorder();
  const dropRef = useKeepDropPosition(isDragging);
  const ref = (el: HTMLElement | null) => { setNodeRef(el); dropRef(el); };

  if (reordering) {
    return (
      <div ref={ref} style={sortableStyle(transform, transition)} {...listeners} className={cn("relative w-full", isDragging && "z-30")}>
        <ReorderRow label="Ayırıcı" divider dragging={isDragging} activatorRef={setActivatorNodeRef} />
      </div>
    );
  }

  return (
    <div
      ref={ref}
      style={sortableStyle(transform, transition)}
      {...listeners}
      className={cn(
        "flex items-center gap-3 pl-2 pr-5 py-3 rounded-2xl border border-dashed border-[var(--border)] hover:border-[var(--border-hover)] transition-colors duration-200",
        isDragging && cn(DRAG_LIFT, "bg-[var(--bg-1)] border-[var(--edit-accent)]")
      )}
    >
      <DragHandle activatorRef={setActivatorNodeRef} label="Ayırıcıyı sürükle" className="text-[var(--text-subtitle)] hover:text-[var(--text-title)]" />
      <div className="flex-1 h-px bg-[var(--border)]" />
      <span className="text-[10px] font-medium uppercase tracking-widest text-[var(--text-subtitle)] select-none shrink-0">Divider</span>
      <div className="flex-1 h-px bg-[var(--border)]" />
      <TrafficDots
        onUp={() => actions.moveItemBy(divider.id, -1)}
        onDown={() => actions.moveItemBy(divider.id, 1)}
        onDelete={() => actions.deleteItem(divider.id)}
      />
    </div>
  );
}

// ── Form editor ───────────────────────────────────────────────────────────────

export function FormEditor({ project, lang, slug, companies, actions, onLoadTemplate, onJsonChange }: {
  project: ProjectData;
  lang: "tr" | "en";
  slug: string;
  companies: string[];
  actions: EditorActions;
  onLoadTemplate: () => void;
  onJsonChange: (project: ProjectData) => void;
}) {
  let sectionIndex = 0;
  const reordering = usePageReorder();
  return (
    <div className="h-full overflow-y-auto">
      <div className={cn("flex flex-col gap-6 w-full max-w-[760px] mx-auto px-5 py-8", reordering && REORDER_ROOM)}>
        {/* While a section is dragged the page is just the compact list of sections. */}
        {!reordering && (
          <>
            <ProjectMetaFields project={project} lang={lang} slug={slug} companies={companies} onChange={actions.updateMeta} />
            <ProjectThemeFields theme={project.theme} onChange={(theme) => actions.updateMeta({ theme })} />
            <div className="w-full h-px bg-[var(--border)]" />
          </>
        )}

        <section className="flex flex-col gap-3">
          {project.items.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-8 rounded-2xl border border-dashed border-[var(--border)] text-center">
              <p className="text-sm text-[var(--text-subtitle)] opacity-50 select-none">Henüz içerik yok</p>
              <p className="text-xs text-[var(--text-subtitle)] opacity-40 select-none">Yukarıdaki Ekle butonunu kullanın ya da şablonla başlayın</p>
              <PillButton size="md" onClick={onLoadTemplate} className="mt-2">
                Şablondan başla
              </PillButton>
            </div>
          )}

          <div className={reordering ? REORDER_LIST : "flex flex-col gap-3"}>
            {project.items.map((item) =>
              item.kind === "divider" ? (
                <DividerPageCard key={item.id} divider={item} actions={actions} />
              ) : (
                <SectionCard key={item.id} section={item} index={sectionIndex++} lang={lang} slug={slug} actions={actions} />
              )
            )}
          </div>
        </section>

        {/* Editable JSON output */}
        {!reordering && <JsonEditor value={project} onChange={onJsonChange} />}
      </div>
    </div>
  );
}
