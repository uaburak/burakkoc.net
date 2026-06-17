"use client";

import { useState, useCallback, useEffect } from "react";
import { Block, BlockType, PageItem, PageSection, PageDivider, ProjectData, Section } from "@/types/project";
import { TextBlockEditor }  from "@/components/admin/TextBlockEditor";
import { ImageBlockEditor } from "@/components/admin/ImageBlockEditor";
import { VideoBlockEditor } from "@/components/admin/VideoBlockEditor";
import { CodeBlockEditor }  from "@/components/admin/CodeBlockEditor";
import { ProjectPreview }   from "@/components/admin/ProjectPreview";
import { useEditorContext } from "@/components/admin/EditorNavControls";
import { saveProject, loadProject } from "@/lib/firestore";
import { cn } from "@/lib/utils";
import { PillButton } from "@/components/Button";
import { Input } from "@/components/Input";

// ── Helpers ───────────────────────────────────────────────────────────────────

function uid() { return Math.random().toString(36).slice(2, 10); }

function makeBlock(type: BlockType): Block {
  return { id: uid(), type };
}

function makeSection(): PageSection {
  return { id: uid(), kind: "section", blocks: [] };
}

function makeDivider(): PageDivider {
  return { id: uid(), kind: "divider" };
}

const EMPTY_PROJECT: ProjectData = {
  slug: "",
  title: "",
  titleEn: "",
  category: "",
  year: new Date().getFullYear().toString(),
  items: [],
};

const STORAGE_KEY = "admin_project_draft";

// ── Block type registry (no divider — it's a top-level page item) ─────────────

const BLOCK_DEFS: {
  type: BlockType;
  label: string;
  description: string;
  icon: React.ReactNode;
}[] = [
  {
    type: "heading",
    label: "Başlık",
    description: "Bölüm ana başlığı (h2)",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M2 4h12M2 8h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <text x="2" y="15" fontSize="7" fill="currentColor" fontWeight="700">H</text>
      </svg>
    ),
  },
  {
    type: "subheading",
    label: "Alt Başlık",
    description: "İkincil açıklama satırı",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M2 5h10M2 9h7M2 13h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    type: "text",
    label: "Metin",
    description: "Düz paragraf",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M2 4h12M2 8h8M2 12h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    type: "image",
    label: "Resim",
    description: "URL ile görsel",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="1.5" y="2.5" width="13" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="5.5" cy="6" r="1.5" stroke="currentColor" strokeWidth="1.25" />
        <path d="M1.5 11l3.5-3 2.5 2.5 2-2 4 4" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    type: "video",
    label: "Video",
    description: "YouTube, Vimeo veya dosya",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="1" y="3" width="10" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M11 6.5l4-2v7l-4-2V6.5z" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    type: "code",
    label: "Kod Bloğu",
    description: "Sözdizimi + önizleme",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M5 5L2 8l3 3M11 5l3 3-3 3M9 3l-2 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
];

// ── Icons ─────────────────────────────────────────────────────────────────────

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M2 3.5h10M5.5 3.5V2h3v1.5M4 3.5l.5 8h5l.5-8" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function ChevronUpIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M3 9L7 5l4 4" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function ChevronDownIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
function SaveIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M3 2h8l3 3v9a1 1 0 01-1 1H3a1 1 0 01-1-1V3a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.25" />
      <path d="M5 2v4h6V2M5 9h6" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M3 8l3.5 3.5L13 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function BackIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function XIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
      <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

// ── Shared styles — use shared Input component below ─────────────────────────

// ── Block sub-components ──────────────────────────────────────────────────────

function BlockLabel({ type }: { type: BlockType }) {
  const labels: Record<BlockType, string> = {
    heading:    "Başlık",
    subheading: "Alt Başlık",
    text:       "Metin",
    image:      "Görsel",
    video:      "Video",
    code:       "Kod Bloğu",
  };
  return <PillLabel>{labels[type]}</PillLabel>;
}

// ── Traffic light action dots ────────────────────────────────────────────────
/** Figma: pill container bg-[var(--bg-4)] + border, gap-2, p-[7px], rounded-full; dots 12×12 px */
function TrafficDots({
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
function PillLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center px-[6px] text-[16px] font-medium text-[var(--text-title)] select-none whitespace-nowrap">
      {children}
    </span>
  );
}

// ── Heading / Subheading editor ───────────────────────────────────────────────

function HeadingBlockEditor({ block, onChange, lang }: { block: Block; onChange: (u: Partial<Block>) => void; lang: "tr" | "en" }) {
  const isSubheading = block.type === "subheading";
  const value = lang === "en" ? (block.contentEn ?? "") : (block.content ?? "");
  const placeholder = lang === "en"
    ? (isSubheading ? "Subheading text…" : "Heading text…")
    : (isSubheading ? "Alt başlık metni…" : "Başlık metni…");
  return (
    <Input
      type="text"
      value={value}
      onChange={(e) => onChange(lang === "en" ? { contentEn: e.target.value } : { content: e.target.value })}
      placeholder={placeholder}
      size="md"
      className={cn(
        isSubheading ? "text-[var(--text-subtitle)]" : "font-medium text-[var(--text-title)]"
      )}
    />
  );
}

// ── Block Row ─────────────────────────────────────────────────────────────────

function BlockRow({
  block, onChange, onMoveUp, onMoveDown, onDelete, lang, projectSlug,
}: {
  block: Block;
  onChange: (u: Partial<Block>) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
  lang: "tr" | "en";
  projectSlug: string;
}) {
  function handleChange(u: Partial<Block>) {
    if (lang === "en") {
      const mapped: Partial<Block> = { ...u };
      if ("content" in u) { mapped.contentEn = u.content; delete mapped.content; }
      if ("alt"     in u) { mapped.altEn     = u.alt;     delete mapped.alt;     }
      if ("caption" in u) { mapped.captionEn = u.caption; delete mapped.caption; }
      onChange(mapped);
    } else {
      onChange(u);
    }
  }

  const viewBlock: Block = lang === "en"
    ? { ...block, content: block.contentEn ?? "", alt: block.altEn ?? "", caption: block.captionEn ?? "" }
    : block;

  return (
    <div className="flex flex-col gap-[10px] p-[12px] rounded-[18px] border border-[var(--border)] bg-[var(--bg-4)] transition-colors duration-150">
      {/* Header: label left, traffic dots right */}
      <div className="flex items-center justify-between">
        <BlockLabel type={block.type} />
        <TrafficDots onUp={onMoveUp} onDown={onMoveDown} onDelete={onDelete} />
      </div>
      {(block.type === "heading" || block.type === "subheading") && <HeadingBlockEditor block={block} onChange={onChange} lang={lang} />}
      {block.type === "text"  && <TextBlockEditor  block={viewBlock} onChange={handleChange} />}
      {block.type === "image" && <ImageBlockEditor block={viewBlock} onChange={handleChange} projectSlug={projectSlug} />}
      {block.type === "video" && <VideoBlockEditor block={viewBlock} onChange={handleChange} />}
      {block.type === "code"  && <CodeBlockEditor  block={viewBlock} onChange={handleChange} />}
    </div>
  );
}

// ── Per-section Add Block Button ──────────────────────────────────────────────

function SectionAddBlockButton({ onAdd }: { onAdd: (type: BlockType) => void }) {
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(false);

  function openMenu() { setOpen(true); requestAnimationFrame(() => setVisible(true)); }
  function close() { setVisible(false); setTimeout(() => setOpen(false), 200); }

  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) { if (e.key === "Escape") close(); }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  return (
    <>
      <PillButton
        size="md"
        onClick={openMenu}
        className="w-full justify-center border-dashed border-[var(--border-hover)] hover:border-[var(--text-subtitle)]"
        startIcon={<PlusIcon />}
      >
        Blok ekle
      </PillButton>
      {open && (
        <>
          <div className="fixed inset-0 z-[9998]" onClick={close} aria-hidden />
          <div style={{ position: "fixed", left: "25%", top: "50%", zIndex: 9999 }}
            className={cn("transition-all duration-200 origin-center", visible ? "opacity-100 scale-100" : "opacity-0 scale-95")}
          >
            <div style={{ transform: "translate(-50%, -50%)" }}
              className="w-72 rounded-2xl border border-[var(--border)] bg-[var(--bg-2)] shadow-xl overflow-hidden"
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
                <span className="text-xs font-medium uppercase tracking-widest text-[var(--text-subtitle)] select-none">Blok Tipi Seç</span>
                <button onClick={close} className="flex items-center justify-center w-5 h-5 rounded text-[var(--text-subtitle)] hover:text-[var(--text-title)] transition-colors cursor-pointer"><XIcon /></button>
              </div>
              <div className="p-1.5 flex flex-col gap-0.5 max-h-[360px] overflow-y-auto">
                {BLOCK_DEFS.map(({ type, label, description, icon }) => (
                  <button key={type} onClick={() => { onAdd(type); close(); }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors duration-150 hover:bg-[var(--bg-4)] group cursor-pointer"
                  >
                    <span className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-lg border border-[var(--border)] bg-[var(--bg-3)] text-[var(--text-subtitle)] group-hover:text-[var(--text-title)] transition-colors duration-150">{icon}</span>
                    <span className="flex flex-col gap-0.5 min-w-0">
                      <span className="text-sm font-medium leading-4 text-[var(--text-title)]">{label}</span>
                      <span className="text-xs leading-4 text-[var(--text-subtitle)] truncate">{description}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}

// ── Section Card ──────────────────────────────────────────────────────────────

function SectionCard({
  section, index, onChange, onMoveUp, onMoveDown, onDelete, lang, projectSlug,
}: {
  section: PageSection;
  index: number;
  onChange: (updates: Partial<Section>) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
  lang: "tr" | "en";
  projectSlug: string;
}) {
  function updateBlock(blockId: string, updates: Partial<Block>) {
    onChange({ blocks: section.blocks.map((b) => (b.id === blockId ? { ...b, ...updates } : b)) });
  }
  function addBlock(type: BlockType) {
    onChange({ blocks: [...section.blocks, makeBlock(type)] });
  }
  function deleteBlock(blockId: string) {
    onChange({ blocks: section.blocks.filter((b) => b.id !== blockId) });
  }
  function moveBlock(from: number, to: number) {
    if (to < 0 || to >= section.blocks.length) return;
    const arr = [...section.blocks];
    const [item] = arr.splice(from, 1);
    arr.splice(to, 0, item);
    onChange({ blocks: arr });
  }

  return (
    <div className="flex flex-col gap-[10px] p-[18px] rounded-[32px] border border-[var(--border)] bg-[var(--bg-2)] transition-colors duration-200">
      {/* Header: "01 Bölüm" pill left, traffic dots right */}
      <div className="flex items-center justify-between">
        <PillLabel>{String(index + 1).padStart(2, "0")} Bölüm</PillLabel>
        <TrafficDots onUp={onMoveUp} onDown={onMoveDown} onDelete={onDelete} />
      </div>

      {section.blocks.length > 0 ? (
        <div className="flex flex-col gap-3">
          {section.blocks.map((block, bi) => (
            <BlockRow
              key={block.id}
              block={block}
              onChange={(updates) => updateBlock(block.id, updates)}
              onMoveUp={() => moveBlock(bi, bi - 1)}
              onMoveDown={() => moveBlock(bi, bi + 1)}
              onDelete={() => deleteBlock(block.id)}
              lang={lang}
              projectSlug={projectSlug}
            />
          ))}
        </div>
      ) : (
        <p className="text-xs text-[var(--text-subtitle)] opacity-40 italic select-none text-center py-2">
          Henüz blok yok — Blok ekle ile başlayın
        </p>
      )}

      <SectionAddBlockButton onAdd={addBlock} />
    </div>
  );
}

// ── Divider Page Card (editor UI for section-level dividers) ──────────────────

function DividerPageCard({
  onMoveUp, onMoveDown, onDelete,
}: {
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center gap-3 px-5 py-3 rounded-2xl border border-dashed border-[var(--border)] hover:border-[var(--border-hover)] transition-colors duration-200">
      <div className="flex-1 h-px bg-[var(--border)]" />
      <span className="text-[10px] font-medium uppercase tracking-widest text-[var(--text-subtitle)] select-none shrink-0">Divider</span>
      <div className="flex-1 h-px bg-[var(--border)]" />
      <TrafficDots onUp={onMoveUp} onDown={onMoveDown} onDelete={onDelete} />
    </div>
  );
}

// ── Global Add Menu (two-level: Bölüm / Blok / Divider) ──────────────────────

type AddStep = "root" | "block";

function AddMenu({
  onAddSection, onAddBlock, onAddDivider, onClose,
}: {
  onAddSection: () => void;
  onAddBlock: (type: BlockType) => void;
  onAddDivider: () => void;
  onClose: () => void;
}) {
  const [step, setStep] = useState<AddStep>("root");
  const [visible, setVisible] = useState(false);

  useEffect(() => { requestAnimationFrame(() => setVisible(true)); }, []);
  useEffect(() => {
    function handleKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <>
      <div className="fixed inset-0 z-[9998]" onClick={onClose} aria-hidden />
      <div
        style={{ position: "fixed", left: "25%", top: "50%", transform: "translate(-50%, -50%)", zIndex: 9999 }}
        className={cn("transition-all duration-200 origin-center", visible ? "opacity-100 scale-100" : "opacity-0 scale-95")}
      >
        <div className="w-72 rounded-2xl border border-[var(--border)] bg-[var(--bg-2)] shadow-xl overflow-hidden">
          <div
            className="flex transition-transform duration-300 ease-in-out"
            style={{ width: "200%", transform: step === "block" ? "translateX(-50%)" : "translateX(0%)" }}
          >
            {/* ── Step 1: Root ── */}
            <div className="w-1/2 flex-shrink-0 flex flex-col">
              <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
                <span className="text-xs font-medium uppercase tracking-widest text-[var(--text-subtitle)] select-none">Ekle</span>
                <button onClick={onClose} className="flex items-center justify-center w-5 h-5 rounded text-[var(--text-subtitle)] hover:text-[var(--text-title)] transition-colors cursor-pointer"><XIcon /></button>
              </div>
              <div className="p-3 grid grid-cols-3 gap-2">
                {/* Bölüm */}
                <button
                  onClick={() => { onAddSection(); onClose(); }}
                  className="flex flex-col items-center gap-2 p-3 rounded-xl border border-[var(--border)] bg-[var(--bg-1)] hover:bg-[var(--bg-4)] hover:border-[var(--border-hover)] transition-all duration-150 cursor-pointer text-center group"
                >
                  <span className="flex items-center justify-center w-8 h-8 rounded-lg border border-[var(--border)] bg-[var(--bg-2)] text-[var(--text-subtitle)] group-hover:text-[var(--text-title)] transition-colors duration-150">
                    <svg width="15" height="15" viewBox="0 0 18 18" fill="none">
                      <rect x="1.5" y="1.5" width="15" height="15" rx="3" stroke="currentColor" strokeWidth="1.4" />
                      <path d="M5 6h8M5 9h5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                    </svg>
                  </span>
                  <span className="text-xs font-medium text-[var(--text-title)]">Bölüm</span>
                </button>

                {/* Blok */}
                <button
                  onClick={() => setStep("block")}
                  className="flex flex-col items-center gap-2 p-3 rounded-xl border border-[var(--border)] bg-[var(--bg-1)] hover:bg-[var(--bg-4)] hover:border-[var(--border-hover)] transition-all duration-150 cursor-pointer text-center group"
                >
                  <span className="flex items-center justify-center w-8 h-8 rounded-lg border border-[var(--border)] bg-[var(--bg-2)] text-[var(--text-subtitle)] group-hover:text-[var(--text-title)] transition-colors duration-150">
                    <svg width="15" height="15" viewBox="0 0 18 18" fill="none">
                      <rect x="1.5" y="3.5" width="15" height="11" rx="2.5" stroke="currentColor" strokeWidth="1.4" />
                      <path d="M9 7v4M7 9h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                    </svg>
                  </span>
                  <span className="text-xs font-medium text-[var(--text-title)]">Blok</span>
                </button>

                {/* Divider — top-level page item */}
                <button
                  onClick={() => { onAddDivider(); onClose(); }}
                  className="flex flex-col items-center gap-2 p-3 rounded-xl border border-[var(--border)] bg-[var(--bg-1)] hover:bg-[var(--bg-4)] hover:border-[var(--border-hover)] transition-all duration-150 cursor-pointer text-center group"
                >
                  <span className="flex items-center justify-center w-8 h-8 rounded-lg border border-[var(--border)] bg-[var(--bg-2)] text-[var(--text-subtitle)] group-hover:text-[var(--text-title)] transition-colors duration-150">
                    <svg width="15" height="15" viewBox="0 0 18 18" fill="none">
                      <path d="M2 9h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </span>
                  <span className="text-xs font-medium text-[var(--text-title)]">Divider</span>
                </button>
              </div>
            </div>

            {/* ── Step 2: Block types ── */}
            <div className="w-1/2 flex-shrink-0 flex flex-col">
              <div className="flex items-center gap-2 px-3 py-3 border-b border-[var(--border)]">
                <button onClick={() => setStep("root")}
                  className="flex items-center justify-center w-6 h-6 rounded-lg border border-transparent text-[var(--text-subtitle)] hover:border-[var(--border-hover)] hover:text-[var(--text-title)] hover:bg-[var(--bg-4)] transition-colors cursor-pointer"
                ><BackIcon /></button>
                <span className="flex-1 text-xs font-medium uppercase tracking-widest text-[var(--text-subtitle)] select-none">Blok Tipi</span>
                <button onClick={onClose} className="flex items-center justify-center w-5 h-5 rounded text-[var(--text-subtitle)] hover:text-[var(--text-title)] transition-colors cursor-pointer"><XIcon /></button>
              </div>
              <div className="p-1.5 flex flex-col gap-0.5 max-h-[340px] overflow-y-auto">
                {BLOCK_DEFS.map(({ type, label, description, icon }) => (
                  <button key={type} onClick={() => { onAddBlock(type); onClose(); }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors duration-150 hover:bg-[var(--bg-4)] group cursor-pointer"
                  >
                    <span className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-lg border border-[var(--border)] bg-[var(--bg-3)] text-[var(--text-subtitle)] group-hover:text-[var(--text-title)] transition-colors duration-150">{icon}</span>
                    <span className="flex flex-col gap-0.5 min-w-0">
                      <span className="text-sm font-medium leading-4 text-[var(--text-title)]">{label}</span>
                      <span className="text-xs leading-4 text-[var(--text-subtitle)] truncate">{description}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Meta Field ────────────────────────────────────────────────────────────────

function MetaField({ value, placeholder, onChange }: {
  value: string; placeholder: string; onChange: (v: string) => void;
}) {
  return (
    <Input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      size="md"
    />
  );
}

// ── Main Editor ───────────────────────────────────────────────────────────────

export function AdminEditorClient({ slug }: { slug: string }) {
  // Always start with the empty base so server and client render identically.
  // localStorage is read in useEffect (client-only) to avoid hydration mismatch.
  const [project, setProject] = useState<ProjectData>({ ...EMPTY_PROJECT, slug });

  // ── Pull shared state from EditorContext (set by EditorNavControls in the top nav) ──
  const { editLang, saveStatus, setSaveStatus, registerSave } = useEditorContext();

  const [showAddMenu, setShowAddMenu] = useState(false);
  const [loadingFromDB, setLoadingFromDB] = useState(true);
  /** Whether this project exists in Firestore (i.e. has been published at least once) */
  const [isPublished, setIsPublished] = useState(false);

  // ── Load from Firestore on mount — always enforce URL slug ──
  useEffect(() => {
    loadProject(slug)
      .then((data) => {
        if (data) {
          if (!Array.isArray(data.items)) data.items = [];
          // Ensure slug always matches the URL
          const normalized = { ...data, slug };
          setProject(normalized);
          setIsPublished(true);
          localStorage.setItem(`${STORAGE_KEY}_${slug}`, JSON.stringify(normalized));
        } else {
          // No Firestore data — try local cache as fallback
          try {
            const cached = localStorage.getItem(`${STORAGE_KEY}_${slug}`);
            if (cached) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const parsed = JSON.parse(cached) as any;
              if (!parsed.items && Array.isArray(parsed.sections)) {
                parsed.items = parsed.sections.map((s: any) => ({ ...s, kind: "section" }));
                delete parsed.sections;
              }
              if (!Array.isArray(parsed.items)) parsed.items = [];
              setProject({ ...parsed, slug });
            } else {
              setProject((p) => p.slug !== slug ? { ...p, slug } : p);
            }
          } catch {
            setProject((p) => p.slug !== slug ? { ...p, slug } : p);
          }
        }
      })
      .catch((err) => {
        console.warn("Firestore load failed, using local cache:", err);
        // Try local cache on error
        try {
          const cached = localStorage.getItem(`${STORAGE_KEY}_${slug}`);
          if (cached) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const parsed = JSON.parse(cached) as any;
            if (!parsed.items && Array.isArray(parsed.sections)) {
              parsed.items = parsed.sections.map((s: any) => ({ ...s, kind: "section" }));
              delete parsed.sections;
            }
            if (!Array.isArray(parsed.items)) parsed.items = [];
            setProject({ ...parsed, slug });
          }
        } catch { /* keep empty state */ }
      })
      .finally(() => setLoadingFromDB(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  // ── Mirror to localStorage for offline / fast-reload ──
  useEffect(() => {
    if (!loadingFromDB) {
      localStorage.setItem(`${STORAGE_KEY}_${slug}`, JSON.stringify(project));
    }
  }, [project, slug, loadingFromDB]);

  const updateMeta = useCallback(
    (updates: Partial<Pick<ProjectData, "title" | "titleEn" | "category" | "year" | "slug">>) => {
      setProject((p) => ({ ...p, ...updates }));
    }, []
  );

  function updateSection(sectionId: string, updates: Partial<Section>) {
    setProject((p) => ({
      ...p,
      items: p.items.map((item) =>
        item.kind === "section" && item.id === sectionId
          ? { ...item, ...updates }
          : item
      ),
    }));
  }

  function addSection() {
    setProject((p) => ({ ...p, items: [...p.items, makeSection()] }));
  }

  function addDivider() {
    setProject((p) => ({ ...p, items: [...p.items, makeDivider()] }));
  }

  function deleteItem(id: string) {
    setProject((p) => ({ ...p, items: p.items.filter((i) => i.id !== id) }));
  }

  function moveItem(from: number, to: number) {
    if (to < 0 || to >= project.items.length) return;
    setProject((p) => {
      const arr = [...p.items];
      const [item] = arr.splice(from, 1);
      arr.splice(to, 0, item);
      return { ...p, items: arr };
    });
  }

  /** Adds a block to the last section in items (creates a section if none exist) */
  function addBlockToLastSection(type: BlockType) {
    setProject((p) => {
      const lastSectionIdx = [...p.items].map((x, i) => ({ x, i })).reverse().find(({ x }) => x.kind === "section")?.i;
      if (lastSectionIdx === undefined) {
        const newSection: PageSection = { ...makeSection(), blocks: [makeBlock(type)] };
        return { ...p, items: [...p.items, newSection] };
      }
      const items = [...p.items];
      const section = { ...(items[lastSectionIdx] as PageSection) };
      section.blocks = [...section.blocks, makeBlock(type)];
      items[lastSectionIdx] = section;
      return { ...p, items };
    });
  }

  async function handleSave() {
    // Always use the URL slug as the canonical ID — guards against stale localStorage data
    const dataToSave = { ...project, slug };
    setSaveStatus("saving");
    try {
      await saveProject(dataToSave);
      // Keep state and cache in sync
      setProject(dataToSave);
      setIsPublished(true);
      localStorage.setItem(`${STORAGE_KEY}_${slug}`, JSON.stringify(dataToSave));
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2500);
    } catch (err) {
      console.error("Firestore save failed:", err);
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 3000);
    }
  }

  // Register save handler with the context so EditorNavControls can call it
  useEffect(() => {
    registerSave(handleSave);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project, slug]);

  const sectionCount = project.items.filter((i) => i.kind === "section").length;
  let sectionIndex = 0;

  return (
    <div className="flex h-full">

      {/* ── LEFT PANEL ── */}
      <div className="flex flex-col w-1/2 border-r border-[var(--border)] overflow-y-auto">
        {/* Sticky header */}
        <div className="sticky top-0 z-30 flex items-center justify-between px-5 py-3 border-b border-[var(--border)] bg-[var(--bg-1)]/90 backdrop-blur-md">
          <div className="flex flex-col">
            <span className="text-[10px] font-medium uppercase tracking-widest text-[var(--text-subtitle)] select-none">Editör</span>
            <span className="text-sm font-medium text-[var(--text-title)] leading-5 truncate max-w-[220px]">
              {project.title || "Başlıksız Proje"}
            </span>
          </div>
          <PillButton
            size="md"
            onClick={() => setShowAddMenu(true)}
            startIcon={<PlusIcon />}
          >
            Ekle
          </PillButton>
        </div>

        {/* Editor scroll area */}
        <div className="flex flex-col gap-6 px-5 py-8">

          {/* ── Proje Bilgileri ── */}
          <section className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-2.5">
              <MetaField value={project.title}        placeholder="Başlık (TR)"    onChange={(v) => updateMeta({ title: v })} />
              <MetaField value={project.titleEn ?? ""} placeholder="Title (EN)" onChange={(v) => updateMeta({ titleEn: v })} />
              <MetaField value={project.slug}         placeholder="Slug"            onChange={(v) => updateMeta({ slug: v })} />
              <MetaField value={project.category}     placeholder="Kategori"        onChange={(v) => updateMeta({ category: v })} />
              <MetaField value={project.year}         placeholder="Yıl"             onChange={(v) => updateMeta({ year: v })} />
            </div>
          </section>

          <div className="w-full h-px bg-[var(--border)]" />

          {/* ── İçerik ── */}
          <section className="flex flex-col gap-3">

            {project.items.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-8 rounded-2xl border border-dashed border-[var(--border)] text-center">
                <p className="text-sm text-[var(--text-subtitle)] opacity-50 select-none">Henüz içerik yok</p>
                <p className="text-xs text-[var(--text-subtitle)] opacity-40 select-none">Yukarıdaki Ekle butonunu kullanın</p>
              </div>
            )}

            <div className="flex flex-col gap-3">
              {project.items.map((item, idx) => {
                if (item.kind === "divider") {
                  return (
                    <DividerPageCard
                      key={item.id}
                      onMoveUp={() => moveItem(idx, idx - 1)}
                      onMoveDown={() => moveItem(idx, idx + 1)}
                      onDelete={() => deleteItem(item.id)}
                    />
                  );
                }
                // section
                const currentSectionIndex = sectionIndex++;
                return (
                  <SectionCard
                    key={item.id}
                    section={item}
                    index={currentSectionIndex}
                    onChange={(updates) => updateSection(item.id, updates)}
                    onMoveUp={() => moveItem(idx, idx - 1)}
                    onMoveDown={() => moveItem(idx, idx + 1)}
                    onDelete={() => deleteItem(item.id)}
                    lang={editLang}
                    projectSlug={slug}
                  />
                );
              })}
            </div>
          </section>

          {/* JSON output */}
          <details className="group">
            <summary className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-[var(--text-subtitle)] cursor-pointer select-none list-none hover:text-[var(--text-p)] transition-colors duration-150">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="transition-transform duration-200 group-open:rotate-90">
                <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              JSON Çıktısı
            </summary>
            <pre className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--bg-2)] p-4 font-mono text-xs leading-6 text-[var(--text-p)] overflow-x-auto whitespace-pre-wrap">
              {JSON.stringify(project, null, 2)}
            </pre>
          </details>
        </div>
      </div>

      {/* ── RIGHT PANEL — Live Preview ── */}
      <div className="flex flex-col w-1/2 overflow-y-auto bg-[var(--bg-1)]">
        <div className="sticky top-0 z-30 flex items-center justify-between px-5 py-3 border-b border-[var(--border)] bg-[var(--bg-1)]/90 backdrop-blur-md">
          <div className="flex flex-col">
            <span className="text-[10px] font-medium uppercase tracking-widest text-[var(--text-subtitle)] select-none">Önizleme</span>
            <span className="text-sm font-medium text-[var(--text-title)] leading-5">Canlı görünüm</span>
          </div>
          <div className="flex items-center gap-3">
            {isPublished && (
              <PillButton
                size="md"
                startIcon={
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M5 2H2a1 1 0 00-1 1v7a1 1 0 001 1h7a1 1 0 001-1V7" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
                    <path d="M8 1h3m0 0v3m0-3L5.5 6.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                }
                onClick={() => window.open(`/projects/${slug}`, "_blank")}
                title="Yayın sayfasını yeni sekmede aç"
              >
                Yayında Görüntüle
              </PillButton>
            )}
            <span className="flex items-center gap-1.5 text-xs text-[var(--text-subtitle)] select-none">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
              </span>
              Canlı
            </span>
          </div>
        </div>
        <ProjectPreview project={project} lang={editLang} />
      </div>

      {showAddMenu && (
        <AddMenu
          onAddSection={() => { addSection(); }}
          onAddBlock={addBlockToLastSection}
          onAddDivider={() => { addDivider(); }}
          onClose={() => setShowAddMenu(false)}
        />
      )}
    </div>
  );
}
