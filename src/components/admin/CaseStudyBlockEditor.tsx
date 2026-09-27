"use client";

import { useEffect, useRef, useState } from "react";
import { AspectRatio, Block, BlockEntry, BlockType, BlockVariant, LinkIconType, TableRow } from "@/types/project";
import type { CaseStudyBlockType } from "@/components/project/CaseStudyBlocks";
import { Input } from "@/components/Input";
import { PillButton } from "@/components/Button";
import { Segmented } from "@/components/Segmented";
import { Select } from "@/components/Select";
import { UploadZone } from "@/components/admin/ImageBlockEditor";
import { SortableGroup, SortableItem } from "@/components/project/Sortable";
import { arrayMove } from "@dnd-kit/sortable";

/**
 * Editors for the case-study blocks. Most blocks are a list of `entries`
 * whose editable fields are configured per type below; callout, split and
 * table have only block-level fields, persona has both.
 *
 * Receives the raw block and handles TR/EN itself: localized fields are
 * written to their `…En` twin when `lang === "en"`.
 */

let _c = 0;
function uid() { return `en-${Date.now().toString(36)}-${(++_c).toString(36)}`; }

type EntryField = "label" | "value" | "eyebrow" | "title" | "text" | "src" | "alt" | "caption" | "href";
type LocalizedField = Exclude<EntryField, "src" | "href">;

const LOCALIZED: ReadonlySet<EntryField> = new Set(["label", "value", "eyebrow", "title", "text", "alt", "caption"]);

interface FieldDef {
  key: EntryField;
  placeholder: string;
  multiline?: boolean;
  /** Share a row with the next field (two short inputs side by side) */
  half?: boolean;
  /** Same value in every language (colors, percentages) */
  shared?: boolean;
}

const IMAGE_FIELD: FieldDef = { key: "src", placeholder: "Görsel URL — https://…" };

const ENTRY_FIELDS: Record<CaseStudyBlockType, FieldDef[]> = {
  info:      [{ key: "label", placeholder: "Etiket — Rol, Süre, Ekip…", half: true }, { key: "value", placeholder: "Değer", half: true }],
  stats:     [{ key: "value", placeholder: "Değer — %40, 2×, 650 → 2", half: true }, { key: "label", placeholder: "Açıklama", half: true }],
  cards:     [{ key: "eyebrow", placeholder: "Üst etiket (opsiyonel) — 01, Sorun…" }, { key: "title", placeholder: "Başlık" }, { key: "text", placeholder: "Açıklama…", multiline: true }],
  steps:     [{ key: "title", placeholder: "Adım başlığı", half: true }, { key: "eyebrow", placeholder: "Zaman (opsiyonel) — Hafta 1", half: true }, { key: "text", placeholder: "Bu adımda ne yapıldı?", multiline: true }],
  gallery:   [IMAGE_FIELD, { key: "alt", placeholder: "Alt metin" }, { key: "caption", placeholder: "Görsel altı açıklama (opsiyonel)" }],
  compare:   [{ key: "label", placeholder: "Etiket — Önce / Sonra" }, IMAGE_FIELD, { key: "alt", placeholder: "Alt metin" }],
  links:     [{ key: "label", placeholder: "Etiket — App Store, Canlı Site…", half: true }, { key: "href", placeholder: "https://…", half: true }],
  tags:      [{ key: "label", placeholder: "Etiket — Figma, SwiftUI…" }],
  accordion: [{ key: "title", placeholder: "Başlık — örn. Araştırma detayları" }, { key: "text", placeholder: "Açılınca görünecek içerik…", multiline: true }],
  mockup:    [IMAGE_FIELD, { key: "alt", placeholder: "Alt metin" }, { key: "label", placeholder: "Adres çubuğu (yalnızca tarayıcı) — burakkoc.net" }],
  bars:      [{ key: "label", placeholder: "Seçenek / görev", half: true }, { key: "value", placeholder: "Yüzde — 72", half: true, shared: true }, { key: "text", placeholder: "Not (opsiyonel)" }],
  persona:   [{ key: "label", placeholder: "Grup başlığı — Hedefler, Zorluklar…" }, { key: "text", placeholder: "Her satır bir madde", multiline: true }],
  team:      [IMAGE_FIELD, { key: "title", placeholder: "Ad Soyad", half: true }, { key: "text", placeholder: "Rol", half: true }, { key: "href", placeholder: "Profil bağlantısı (opsiyonel) — https://…" }],
  palette:   [{ key: "label", placeholder: "Renk adı — Primary", half: true }, { key: "value", placeholder: "#1A1A1A", half: true, shared: true }, { key: "text", placeholder: "Kullanım / token (opsiyonel)" }],
  // Block-level only
  quote: [], callout: [], split: [], table: [],
};

const ENTRY_NOUN: Record<CaseStudyBlockType, string> = {
  info: "Satır", stats: "Metrik", cards: "Kart", steps: "Adım", gallery: "Görsel", compare: "Görsel",
  links: "Bağlantı", tags: "Etiket", accordion: "Madde", mockup: "Ekran", bars: "Çubuk", persona: "Grup",
  team: "Kişi", palette: "Renk", quote: "", callout: "", split: "", table: "",
};

const LINK_ICONS: { value: LinkIconType; label: string }[] = [
  { value: "web",       label: "Web sitesi" },
  { value: "appstore",  label: "App Store" },
  { value: "playstore", label: "Google Play" },
  { value: "github",    label: "GitHub" },
  { value: "figma",     label: "Figma" },
  { value: "behance",   label: "Behance" },
  { value: "external",  label: "Diğer" },
];

const ASPECTS: { value: AspectRatio; label: string }[] = [
  { value: "16/9", label: "16:9" },
  { value: "4/3",  label: "4:3" },
  { value: "1/1",  label: "1:1" },
  { value: "3/4",  label: "3:4" },
  { value: "9/16", label: "9:16" },
];

const CALLOUT_VARIANTS: { value: BlockVariant; label: string }[] = [
  { value: "note",    label: "Not" },
  { value: "insight", label: "İçgörü" },
  { value: "tip",     label: "İpucu" },
  { value: "warning", label: "Dikkat" },
];

const MOCKUP_VARIANTS: { value: BlockVariant; label: string }[] = [
  { value: "phone",   label: "Telefon" },
  { value: "browser", label: "Tarayıcı" },
  { value: "tablet",  label: "Tablet" },
];

const SPLIT_SIDES: { value: BlockVariant; label: string }[] = [
  { value: "left",  label: "Görsel solda" },
  { value: "right", label: "Görsel sağda" },
];

function emptyRow(cols: number): TableRow {
  return { id: uid(), cells: Array.from({ length: cols }, () => "") };
}

/** Initial content for a freshly added case-study block. */
export function createCaseStudyBlockDefaults(type: BlockType): Partial<Block> {
  const rows = (n: number, seed: Partial<BlockEntry>[] = []) =>
    Array.from({ length: n }, (_, i) => ({ id: uid(), ...(seed[i] ?? {}) }));
  switch (type) {
    case "info":      return { entries: rows(4, [{ label: "Rol" }, { label: "Süre" }, { label: "Ekip" }, { label: "Platform" }]) };
    case "stats":     return { entries: rows(3), columns: 3 };
    case "cards":     return { entries: rows(2), columns: 2 };
    case "steps":     return { entries: rows(3) };
    case "gallery":   return { entries: rows(2), columns: 2, aspectRatio: "4/3" };
    case "compare":   return { entries: rows(2, [{ label: "Önce" }, { label: "Sonra" }]), aspectRatio: "16/9" };
    case "links":     return { entries: rows(1, [{ icon: "web" }]) };
    case "tags":      return { entries: rows(3) };
    case "callout":   return { variant: "insight" };
    case "accordion": return { entries: rows(2) };
    case "mockup":    return { variant: "phone", entries: rows(2) };
    case "split":     return { variant: "left", aspectRatio: "4/3" };
    case "table":     return { tableHeader: true, tableRows: [emptyRow(3), emptyRow(3), emptyRow(3)] };
    case "bars":      return { entries: rows(3) };
    case "persona":   return { entries: rows(2, [{ label: "Hedefler" }, { label: "Zorluklar" }]) };
    case "team":      return { entries: rows(2) };
    case "palette":   return { entries: rows(4), columns: 4 };
    default:          return {};
  }
}

// ── Small building blocks ─────────────────────────────────────────────────────

function EntryDots({ onUp, onDown, onDelete, canDelete = true }: {
  onUp: () => void; onDown: () => void; onDelete: () => void; canDelete?: boolean;
}) {
  const dot = "w-3 h-3 rounded-full transition-opacity duration-150 cursor-pointer flex-shrink-0 hover:opacity-75";
  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={onUp} title="Yukarı taşı" className={dot} style={{ background: "#00e288" }} />
      <button type="button" onClick={onDown} title="Aşağı taşı" className={dot} style={{ background: "#e2d300" }} />
      {canDelete && <button type="button" onClick={onDelete} title="Sil" className={dot} style={{ background: "#e20000" }} />}
    </div>
  );
}

function AutoTextarea({ value, onChange, placeholder }: {
  value: string; onChange: (v: string) => void; placeholder: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={2}
      className="w-full resize-none overflow-hidden rounded-[20px] border border-transparent bg-[var(--bg-1)] hover:border-[var(--border-hover)] px-4 py-2.5 text-sm font-light leading-6 text-[var(--text-p)] placeholder:text-[var(--text-subtitle)] focus:outline-none focus:border-[var(--border-hover)] transition-all duration-150"
    />
  );
}

function ImageField({ value, onChange, placeholder, uploadId, projectSlug }: {
  value: string; onChange: (v: string) => void; placeholder: string; uploadId: string; projectSlug: string;
}) {
  const [tab, setTab] = useState<"URL" | "Yükle">("URL");
  return (
    <div className="flex items-center gap-[10px]">
      <Segmented options={["URL", "Yükle"]} value={tab} onChange={(v) => setTab(v as "URL" | "Yükle")} size="md" />
      {tab === "URL" ? (
        <Input type="url" bgContext="block" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} size="md" className="flex-1" />
      ) : (
        <UploadZone blockId={uploadId} projectSlug={projectSlug} currentSrc={value} onUploaded={(url) => onChange(url)} />
      )}
    </div>
  );
}

function LabeledSegmented<T extends string | number | boolean>({ label, options, value, onChange }: {
  label: string; options: { value: T; label: string }[]; value: T; onChange: (v: T) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[13px] text-[var(--text-subtitle)] select-none">{label}</span>
      <Segmented
        options={options.map((o) => o.label)}
        value={options.find((o) => o.value === value)?.label ?? options[0].label}
        onChange={(l) => { const o = options.find((x) => x.label === l); if (o) onChange(o.value); }}
        size="md"
      />
    </div>
  );
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <PillButton
      size="md"
      bgContext="block"
      onClick={onClick}
      startIcon={
        <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
          <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      }
    >
      {label}
    </PillButton>
  );
}

// ── Table editor ──────────────────────────────────────────────────────────────

function TableEditor({ block, onChange, en }: { block: Block; onChange: (u: Partial<Block>) => void; en: boolean }) {
  const rows = block.tableRows ?? [];
  const colCount = Math.max(1, ...rows.map((r) => r.cells.length));
  const cellsOf = (r: TableRow) => (en ? r.cellsEn ?? r.cells : r.cells);

  function setRows(next: TableRow[]) { onChange({ tableRows: next }); }

  function setCell(ri: number, ci: number, v: string) {
    setRows(rows.map((r, i) => {
      if (i !== ri) return r;
      const base = Array.from({ length: colCount }, (_, k) => cellsOf(r)[k] ?? "");
      base[ci] = v;
      return en ? { ...r, cellsEn: base } : { ...r, cells: base };
    }));
  }

  // Structural edits apply to both languages so TR and EN stay the same shape.
  function addColumn() {
    setRows(rows.map((r) => ({ ...r, cells: [...r.cells, ""], ...(r.cellsEn ? { cellsEn: [...r.cellsEn, ""] } : {}) })));
  }
  function removeColumn(ci: number) {
    if (colCount <= 1) return;
    setRows(rows.map((r) => ({
      ...r,
      cells: r.cells.filter((_, k) => k !== ci),
      ...(r.cellsEn ? { cellsEn: r.cellsEn.filter((_, k) => k !== ci) } : {}),
    })));
  }
  function moveRow(ri: number, dir: -1 | 1) {
    const to = ri + dir;
    if (to < 0 || to >= rows.length) return;
    const next = [...rows];
    [next[ri], next[to]] = [next[to], next[ri]];
    setRows(next);
  }

  return (
    <div className="flex flex-col gap-2.5 w-full">
      <LabeledSegmented<boolean> label="İlk satır" value={block.tableHeader !== false} onChange={(v) => onChange({ tableHeader: v })}
        options={[{ value: true, label: "Başlık" }, { value: false, label: "Normal" }]} />
      <p className="px-1 text-[12px] leading-5 text-[var(--text-subtitle)] select-none">
        Hücreye ✓ ya da ✗ yazarsan ikon olarak gösterilir. İlk sütun satır başlığıdır.
      </p>
      <div className="flex flex-col gap-1.5 w-full overflow-x-auto">
        {rows.map((r, ri) => (
          <div key={r.id} className="flex items-center gap-1.5">
            <div className="grid flex-1 gap-1.5" style={{ gridTemplateColumns: `repeat(${colCount}, minmax(96px, 1fr))` }}>
              {Array.from({ length: colCount }, (_, ci) => (
                <Input
                  key={ci}
                  type="text"
                  bgContext="block"
                  size="md"
                  value={cellsOf(r)[ci] ?? ""}
                  onChange={(e) => setCell(ri, ci, e.target.value)}
                  placeholder={ri === 0 && block.tableHeader !== false ? `Sütun ${ci + 1}` : "—"}
                  className={ri === 0 && block.tableHeader !== false ? "font-medium" : ""}
                />
              ))}
            </div>
            <EntryDots onUp={() => moveRow(ri, -1)} onDown={() => moveRow(ri, 1)} onDelete={() => setRows(rows.filter((_, i) => i !== ri))} />
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2 w-full">
        {colCount > 1 && (
          <PillButton size="md" bgContext="block" onClick={() => removeColumn(colCount - 1)}>Son sütunu sil</PillButton>
        )}
        <AddButton label="Sütun Ekle" onClick={addColumn} />
        <AddButton label="Satır Ekle" onClick={() => setRows([...rows, emptyRow(colCount)])} />
      </div>
    </div>
  );
}

// ── Main editor ───────────────────────────────────────────────────────────────

interface CaseStudyBlockEditorProps {
  block: Block;
  onChange: (updates: Partial<Block>) => void;
  lang: "tr" | "en";
  projectSlug: string;
}

type BlockTextKey = "content" | "caption" | "authorRole" | "title" | "subheading" | "alt";

export function CaseStudyBlockEditor({ block, onChange, lang, projectSlug }: CaseStudyBlockEditorProps) {
  const type = block.type as CaseStudyBlockType;
  const en = lang === "en";

  // Block-level localized text
  const blockText = (key: BlockTextKey) => (en ? block[`${key}En` as const] : block[key]) ?? "";
  const setBlockText = (key: BlockTextKey, v: string) => onChange({ [en ? `${key}En` : key]: v });
  const blockInput = (key: BlockTextKey, placeholder: string) => (
    <Input type="text" bgContext="block" size="md" value={blockText(key)}
      onChange={(e) => setBlockText(key, e.target.value)} placeholder={placeholder} />
  );
  const blockImage = (placeholder: string) => (
    <ImageField value={block.src ?? ""} onChange={(v) => onChange({ src: v })} placeholder={placeholder}
      uploadId={block.id} projectSlug={projectSlug} />
  );

  // ── Block-level-only types ──
  if (type === "quote") {
    return (
      <div className="flex flex-col gap-2">
        <AutoTextarea value={blockText("content")} onChange={(v) => setBlockText("content", v)} placeholder="Alıntı ya da öne çıkan ifade…" />
        <div className="grid grid-cols-2 gap-2">
          <Input type="text" bgContext="block" size="md" value={block.author ?? ""} onChange={(e) => onChange({ author: e.target.value })} placeholder="Kişi (opsiyonel)" />
          {blockInput("authorRole", "Unvan / şirket (opsiyonel)")}
        </div>
      </div>
    );
  }

  if (type === "callout") {
    return (
      <div className="flex flex-col gap-2">
        <LabeledSegmented label="Tür" value={block.variant ?? "note"} onChange={(v) => onChange({ variant: v })} options={CALLOUT_VARIANTS} />
        {blockInput("title", "Başlık (opsiyonel — boşsa türün adı yazar)")}
        <AutoTextarea value={blockText("content")} onChange={(v) => setBlockText("content", v)} placeholder="Not metni…" />
      </div>
    );
  }

  if (type === "split") {
    return (
      <div className="flex flex-col gap-2">
        <LabeledSegmented label="Yerleşim" value={block.variant ?? "left"} onChange={(v) => onChange({ variant: v })} options={SPLIT_SIDES} />
        <LabeledSegmented label="Oran" value={block.aspectRatio ?? "4/3"} onChange={(v) => onChange({ aspectRatio: v })} options={ASPECTS} />
        {blockImage("Görsel URL — https://…")}
        {blockInput("alt", "Alt metin")}
        {blockInput("title", "Başlık")}
        <AutoTextarea value={blockText("content")} onChange={(v) => setBlockText("content", v)} placeholder="Görseli destekleyen kısa metin…" />
      </div>
    );
  }

  if (type === "table") {
    return (
      <div className="flex flex-col gap-2">
        <TableEditor block={block} onChange={onChange} en={en} />
        {blockInput("caption", "Tablo açıklaması (opsiyonel)")}
      </div>
    );
  }

  // ── Entry-based types ──
  const fields = ENTRY_FIELDS[type] ?? [];
  const entries = block.entries ?? [];
  const fixedCount = type === "compare";
  const isLocalized = (f: FieldDef) => en && LOCALIZED.has(f.key) && !f.shared;

  const read = (e: BlockEntry, f: FieldDef) =>
    ((isLocalized(f) ? e[`${f.key as LocalizedField}En` as const] : e[f.key]) ?? "") as string;

  function setEntries(next: BlockEntry[]) { onChange({ entries: next }); }
  function updateEntry(idx: number, patch: Partial<BlockEntry>) {
    setEntries(entries.map((e, i) => (i === idx ? { ...e, ...patch } : e)));
  }
  function writeField(idx: number, f: FieldDef, v: string) {
    updateEntry(idx, { [isLocalized(f) ? `${f.key}En` : f.key]: v });
  }
  function moveEntry(idx: number, dir: -1 | 1) {
    const to = idx + dir;
    if (to < 0 || to >= entries.length) return;
    const next = [...entries];
    [next[idx], next[to]] = [next[to], next[idx]];
    setEntries(next);
  }
  function addEntry() {
    setEntries([...entries, { id: uid(), ...(type === "links" ? { icon: "web" as const } : {}) }]);
  }

  function renderField(entry: BlockEntry, idx: number, f: FieldDef) {
    const value = read(entry, f);
    if (f.key === "src") {
      return (
        <ImageField key={f.key} value={value} onChange={(v) => writeField(idx, f, v)} placeholder={f.placeholder}
          uploadId={`${block.id}-${entry.id}`} projectSlug={projectSlug} />
      );
    }
    if (f.multiline) {
      return <AutoTextarea key={f.key} value={value} onChange={(v) => writeField(idx, f, v)} placeholder={f.placeholder} />;
    }
    return (
      <Input key={f.key} type={f.key === "href" ? "url" : "text"} bgContext="block" size="md" value={value}
        onChange={(e) => writeField(idx, f, e.target.value)} placeholder={f.placeholder}
        startContent={type === "palette" && f.key === "value" ? (
          <span className="w-4 h-4 rounded-full border border-[var(--border-hover)]" style={{ backgroundColor: value || "transparent" }} />
        ) : undefined}
      />
    );
  }

  /** Groups `half` fields in pairs so short inputs sit side by side. */
  function renderFields(entry: BlockEntry, idx: number) {
    const out: React.ReactNode[] = [];
    for (let i = 0; i < fields.length; i++) {
      const f = fields[i];
      if (f.half && fields[i + 1]?.half) {
        out.push(
          <div key={`${f.key}-pair`} className="grid grid-cols-2 gap-2">
            {renderField(entry, idx, f)}
            {renderField(entry, idx, fields[i + 1])}
          </div>
        );
        i++;
      } else {
        out.push(renderField(entry, idx, f));
      }
    }
    return out;
  }

  const singleLine = type === "tags";
  const columnOptions = (values: (2 | 3 | 4)[]) => values.map((v) => ({ value: v, label: String(v) }));

  return (
    <div className="flex flex-col gap-2.5 w-full">
      {/* Block-level settings */}
      {type === "stats" && (
        <LabeledSegmented label="Sütun" value={block.columns ?? 3} onChange={(v) => onChange({ columns: v })} options={columnOptions([2, 3, 4])} />
      )}
      {type === "cards" && (
        <LabeledSegmented label="Sütun" value={block.columns ?? 2} onChange={(v) => onChange({ columns: v })} options={columnOptions([2, 3])} />
      )}
      {type === "palette" && (
        <LabeledSegmented label="Sütun" value={block.columns ?? 4} onChange={(v) => onChange({ columns: v })} options={columnOptions([2, 3, 4])} />
      )}
      {type === "gallery" && (
        <>
          <LabeledSegmented label="Sütun" value={block.columns ?? 2} onChange={(v) => onChange({ columns: v })} options={columnOptions([2, 3, 4])} />
          <LabeledSegmented label="Oran" value={block.aspectRatio ?? "4/3"} onChange={(v) => onChange({ aspectRatio: v })} options={ASPECTS} />
        </>
      )}
      {type === "compare" && (
        <LabeledSegmented label="Oran" value={block.aspectRatio ?? "16/9"} onChange={(v) => onChange({ aspectRatio: v })} options={ASPECTS.slice(0, 3)} />
      )}
      {type === "mockup" && (
        <LabeledSegmented label="Cihaz" value={block.variant ?? "phone"} onChange={(v) => onChange({ variant: v })} options={MOCKUP_VARIANTS} />
      )}
      {type === "bars" && blockInput("title", "Soru / başlık (opsiyonel) — Görevi tamamlayanlar")}
      {type === "persona" && (
        <div className="flex flex-col gap-2 p-2.5 rounded-[22px] border border-dashed border-[var(--border-hover)]">
          <span className="px-1.5 text-[13px] font-medium text-[var(--text-subtitle)] select-none">Kimlik</span>
          {blockImage("Fotoğraf / avatar URL (opsiyonel)")}
          <div className="grid grid-cols-2 gap-2">
            {blockInput("title", "Ad — Ayşe, 34")}
            {blockInput("subheading", "Yaş · meslek · şehir")}
          </div>
          <AutoTextarea value={blockText("content")} onChange={(v) => setBlockText("content", v)} placeholder="Kısa tanım ya da persona sözü (opsiyonel)…" />
        </div>
      )}

      {/* Entries — drag by pressing and holding a row's header (inputs stay typeable) */}
      <SortableGroup ids={entries.map((e) => e.id)} onMove={(activeId, overId) => {
        const from = entries.findIndex((e) => e.id === activeId);
        const to = entries.findIndex((e) => e.id === overId);
        if (from >= 0 && to >= 0) setEntries(arrayMove(entries, from, to));
      }}>
      <div className="flex flex-col gap-1.5 w-full">
        {entries.map((entry, idx) => {
          const dots = (
            <EntryDots
              onUp={() => moveEntry(idx, -1)}
              onDown={() => moveEntry(idx, 1)}
              onDelete={() => setEntries(entries.filter((_, i) => i !== idx))}
              canDelete={!fixedCount}
            />
          );
          if (singleLine) {
            return (
              <SortableItem key={entry.id} id={entry.id} outline={false} className="rounded-full">
                <Input type="text" bgContext="block" size="md" value={read(entry, fields[0])}
                  onChange={(e) => writeField(idx, fields[0], e.target.value)} placeholder={fields[0].placeholder}
                  endContent={dots} />
              </SortableItem>
            );
          }
          return (
            <SortableItem key={entry.id} id={entry.id} outline={false} className="flex flex-col gap-2 p-2.5 rounded-[22px] border border-dashed border-[var(--border-hover)] bg-[var(--bg-4)]">
              <div className="flex items-center justify-between px-1.5">
                <span className="text-[13px] font-medium text-[var(--text-subtitle)] select-none">
                  {type === "compare" ? (idx === 0 ? "Önce" : "Sonra") : `${ENTRY_NOUN[type]} ${idx + 1}`}
                </span>
                {dots}
              </div>
              {renderFields(entry, idx)}
              {type === "links" && (
                <Select
                  options={LINK_ICONS.map((o) => o.label)}
                  value={LINK_ICONS.find((o) => o.value === (entry.icon ?? "web"))?.label ?? ""}
                  onChange={(l) => updateEntry(idx, { icon: LINK_ICONS.find((o) => o.label === l)?.value ?? "web" })}
                  placeholder="İkon"
                  size="md"
                />
              )}
            </SortableItem>
          );
        })}
      </div>
      </SortableGroup>

      {/* Caption for media / data blocks */}
      {(type === "gallery" || type === "compare" || type === "mockup" || type === "bars") &&
        blockInput("caption", "Blok açıklaması (opsiyonel)")}

      {!fixedCount && (
        <div className="flex justify-end w-full">
          <AddButton label={`${ENTRY_NOUN[type]} Ekle`} onClick={addEntry} />
        </div>
      )}
    </div>
  );
}
