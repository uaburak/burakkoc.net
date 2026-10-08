"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Block, BlockType, ListStyle, PageItem, PageSection, PageDivider, ProjectData, Section } from "@/types/project";
import { TextBlockEditor }  from "@/components/admin/TextBlockEditor";
import { ImageBlockEditor } from "@/components/admin/ImageBlockEditor";
import { VideoBlockEditor } from "@/components/admin/VideoBlockEditor";
import { CodeBlockEditor }  from "@/components/admin/CodeBlockEditor";
import { FigmaBlockEditor }  from "@/components/admin/FigmaBlockEditor";
import { IframeBlockEditor } from "@/components/admin/IframeBlockEditor";
import { ListBlockEditor }   from "@/components/admin/ListBlockEditor";
import { CaseStudyBlockEditor, createCaseStudyBlockDefaults } from "@/components/admin/CaseStudyBlockEditor";
import { isCaseStudyBlock } from "@/components/project/CaseStudyBlocks";
import { createProjectTemplate } from "@/lib/projectTemplate";
import { ProjectPreview }   from "@/components/admin/ProjectPreview";
import { useEditorContext, EditorNavControls } from "@/components/admin/EditorNavControls";
import { saveProject, loadProject, getCVData } from "@/lib/firestore";
import { uploadFile, coverStoragePath } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { PillButton } from "@/components/Button";
import { JsonEditor } from "@/components/admin/JsonEditor";
import { Input } from "@/components/Input";
import { Segmented } from "@/components/Segmented";
import { Select } from "@/components/Select";
import { Spinner } from "@/components/icons";

// ── Helpers ───────────────────────────────────────────────────────────────────

function uid() { return Math.random().toString(36).slice(2, 10); }

function makeBlock(type: BlockType, extras?: Partial<Block>): Block {
  return { id: uid(), type, ...createCaseStudyBlockDefaults(type), ...extras };
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
  coverImage: "",
  description: "",
  descriptionEn: "",
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
    type: "quote",
    label: "Alıntı",
    description: "Kullanıcı sözü veya öne çıkan ifade",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M6.5 4.5H4.2A1.7 1.7 0 002.5 6.2V8.5h3.5V12H2.5m11-7.5h-2.3a1.7 1.7 0 00-1.7 1.7V8.5H13V12H9.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    type: "info",
    label: "Proje Künyesi",
    description: "Rol, süre, ekip gibi bilgiler",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="1.5" y="2.5" width="13" height="11" rx="2" stroke="currentColor" strokeWidth="1.4" />
        <path d="M4.5 6h2M9 6h2.5M4.5 10h2M9 10h2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    type: "stats",
    label: "Metrikler",
    description: "Sonuçları büyük rakamlarla göster",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M3 13.5V9M8 13.5V3M13 13.5V6.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    type: "cards",
    label: "Kartlar",
    description: "Özellik, sorun veya çözüm ızgarası",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="1.5" y="1.5" width="5.5" height="5.5" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
        <rect x="9" y="1.5" width="5.5" height="5.5" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
        <rect x="1.5" y="9" width="5.5" height="5.5" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
        <rect x="9" y="9" width="5.5" height="5.5" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
      </svg>
    ),
  },
  {
    type: "steps",
    label: "Süreç",
    description: "Numaralı adımlar / zaman çizelgesi",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="4" cy="3.5" r="1.75" stroke="currentColor" strokeWidth="1.3" />
        <circle cx="4" cy="12.5" r="1.75" stroke="currentColor" strokeWidth="1.3" />
        <path d="M4 5.25v5.5M8 3.5h6M8 12.5h6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    type: "tags",
    label: "Etiketler",
    description: "Araçlar, teknolojiler, platformlar",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M2 2.5v4.2c0 .4.16.78.44 1.06l5.8 5.8a1.5 1.5 0 002.12 0l3.08-3.08a1.5 1.5 0 000-2.12l-5.8-5.8A1.5 1.5 0 006.58 2H2.5a.5.5 0 00-.5.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
        <circle cx="5" cy="5" r="1" fill="currentColor" />
      </svg>
    ),
  },
  {
    type: "links",
    label: "Bağlantılar",
    description: "Mağaza, canlı site, GitHub…",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M6.5 9.5l3-3M5.5 7.5l-1.3 1.3a2.4 2.4 0 003.4 3.4l1.3-1.3M10.5 8.5l1.3-1.3a2.4 2.4 0 00-3.4-3.4L7.1 5.1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
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
    type: "gallery",
    label: "Galeri",
    description: "2–4 sütunlu görsel ızgarası",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="1.5" y="3" width="5.75" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
        <rect x="8.75" y="3" width="5.75" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
      </svg>
    ),
  },
  {
    type: "compare",
    label: "Önce / Sonra",
    description: "Sürüklenebilir karşılaştırma",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="1.5" y="2.5" width="13" height="11" rx="2" stroke="currentColor" strokeWidth="1.4" />
        <path d="M8 2.5v11M5.5 6.5L4 8l1.5 1.5M10.5 6.5L12 8l-1.5 1.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
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
  {
    type: "figma",
    label: "Figma",
    description: "Tasarım / Prototip embed",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M5.5 5.5a2 2 0 1 0 0-4h2.5v4H5.5zm0 5a2 2 0 1 0 0-4h2.5v4H5.5zm0 4.25a2 2 0 0 0 2-2V10.5H5.5a2 2 0 1 0 0 4.25zm5-9.25a2 2 0 1 0-2-2v4h2a2 2 0 1 0 0-4zm-2 6.75a2 2 0 0 0 2-2H8v2z" fill="currentColor" />
      </svg>
    ),
  },
  {
    type: "iframe",
    label: "iFrame",
    description: "Prototip / Canlı Önizleme embed",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="2" y="3" width="12" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M5 7h6M5 9.5h4" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    type: "list",
    label: "Liste",
    description: "Bullet, numaralı veya checklist",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="3" cy="4.5" r="1.25" fill="currentColor" />
        <path d="M6 4.5h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="3" cy="8" r="1.25" fill="currentColor" />
        <path d="M6 8h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="3" cy="11.5" r="1.25" fill="currentColor" />
        <path d="M6 11.5h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    type: "callout",
    label: "Not Kutusu",
    description: "İçgörü, ipucu veya uyarı",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="1.5" y="2.5" width="13" height="11" rx="2.5" stroke="currentColor" strokeWidth="1.4" />
        <path d="M5 6.5v3M8 6.5h3M8 9.5h2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    type: "accordion",
    label: "Açılır Detaylar",
    description: "Tıklayınca açılan başlıklar",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="1.5" y="2" width="13" height="4.5" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
        <rect x="1.5" y="9.5" width="13" height="4.5" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
        <path d="M10.5 3.75l1 1 1-1M10.5 11.25l1 1 1-1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    type: "mockup",
    label: "Cihaz Çerçevesi",
    description: "Telefon, tarayıcı veya tablet içinde ekran",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="4.5" y="1.5" width="7" height="13" rx="2" stroke="currentColor" strokeWidth="1.4" />
        <path d="M7 3.5h2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    type: "split",
    label: "Görsel + Metin",
    description: "Yan yana görsel ve açıklama",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="1.5" y="3" width="6.5" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
        <path d="M10 5h4.5M10 8h4.5M10 11h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    type: "table",
    label: "Tablo",
    description: "Karşılaştırma, rakip analizi (✓ / ✗)",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="1.5" y="2.5" width="13" height="11" rx="2" stroke="currentColor" strokeWidth="1.4" />
        <path d="M1.5 6h13M6 6v7.5" stroke="currentColor" strokeWidth="1.4" />
      </svg>
    ),
  },
  {
    type: "bars",
    label: "Anket Grafiği",
    description: "Yüzdeli çubuklar — test ve anket sonuçları",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M2 4h10M2 8h7M2 12h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    type: "persona",
    label: "Persona",
    description: "Kullanıcı profili, hedefler, zorluklar",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="5.5" r="2.75" stroke="currentColor" strokeWidth="1.4" />
        <path d="M2.75 14c.6-2.6 2.7-4.25 5.25-4.25S12.65 11.4 13.25 14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    type: "team",
    label: "Ekip",
    description: "Kişiler, roller ve profil bağlantıları",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="5.5" cy="5.5" r="2.25" stroke="currentColor" strokeWidth="1.3" />
        <circle cx="11" cy="6" r="1.75" stroke="currentColor" strokeWidth="1.3" />
        <path d="M1.5 13.5c.4-2.2 2-3.5 4-3.5s3.6 1.3 4 3.5M10.5 10c1.8-.2 3.4.9 3.9 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    type: "palette",
    label: "Renk Paleti",
    description: "Renk örnekleri ve kodları",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="5" cy="5.5" r="2.5" stroke="currentColor" strokeWidth="1.3" />
        <circle cx="11" cy="5.5" r="2.5" stroke="currentColor" strokeWidth="1.3" />
        <circle cx="8" cy="11" r="2.5" stroke="currentColor" strokeWidth="1.3" />
      </svg>
    ),
  },
];

/** Block menu sections — every BLOCK_DEFS type appears exactly once. */
const BLOCK_GROUPS: { label: string; types: BlockType[] }[] = [
  { label: "Metin",        types: ["heading", "text", "list", "quote", "callout", "accordion"] },
  { label: "Medya",        types: ["image", "gallery", "mockup", "compare", "split", "video", "figma", "iframe", "code"] },
  { label: "Yapı & Veri",  types: ["info", "stats", "cards", "steps", "table", "bars", "tags", "links"] },
  { label: "Araştırma & Tasarım", types: ["persona", "team", "palette"] },
];

/** Grouped block type picker used by both add menus. `list` opens its style sub-menu. */
function BlockTypeList({ onPick, onPickList }: { onPick: (type: BlockType) => void; onPickList: () => void }) {
  return (
    <div className="p-1.5 flex flex-col gap-0.5 max-h-[420px] overflow-y-auto">
      {BLOCK_GROUPS.map((group) => (
        <div key={group.label} className="flex flex-col gap-0.5">
          <span className="px-3 pt-2.5 pb-1 text-[11px] font-medium uppercase tracking-widest text-[var(--text-subtitle)] select-none">
            {group.label}
          </span>
          {group.types.map((t) => {
            const def = BLOCK_DEFS.find((d) => d.type === t);
            if (!def) return null;
            return (
              <button
                key={t}
                onClick={() => (t === "list" ? onPickList() : onPick(t))}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors duration-150 hover:bg-[var(--bg-4)] group cursor-pointer"
              >
                <span className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-lg border border-[var(--border)] bg-[var(--bg-3)] text-[var(--text-subtitle)] group-hover:text-[var(--text-title)] transition-colors duration-150">{def.icon}</span>
                <span className="flex flex-col gap-0.5 min-w-0">
                  <span className="text-sm font-medium leading-4 text-[var(--text-title)]">{def.label}</span>
                  <span className="text-xs leading-4 text-[var(--text-subtitle)] truncate">{def.description}</span>
                </span>
                {t === "list" && (
                  <span className="ml-auto text-[var(--text-subtitle)]">
                    <svg width="8" height="12" viewBox="0 0 8 12" fill="none"><path d="M1.5 1.5L6 6l-4.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </span>
                )}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

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
    figma:      "Figma",
    iframe:     "iFrame",
    list:       "Liste",
    info:       "Proje Künyesi",
    stats:      "Metrikler",
    cards:      "Kartlar",
    steps:      "Süreç",
    quote:      "Alıntı",
    gallery:    "Galeri",
    compare:    "Önce / Sonra",
    links:      "Bağlantılar",
    tags:       "Etiketler",
    callout:    "Not Kutusu",
    accordion:  "Açılır Detaylar",
    mockup:     "Cihaz Çerçevesi",
    split:      "Görsel + Metin",
    table:      "Tablo",
    bars:       "Anket Grafiği",
    persona:    "Persona",
    team:       "Ekip",
    palette:    "Renk Paleti",
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
  if (block.type === "subheading") {
    // Legacy support for separate subheading blocks:
    const value = lang === "en" ? (block.contentEn ?? "") : (block.content ?? "");
    const placeholder = lang === "en" ? "Subheading text…" : "Alt başlık metni…";
    return (
      <Input
        type="text"
        bgContext="block"
        value={value}
        onChange={(e) => onChange(lang === "en" ? { contentEn: e.target.value } : { content: e.target.value })}
        placeholder={placeholder}
        size="md"
        className="text-[var(--text-subtitle)]"
      />
    );
  }

  // Combined heading/subheading editor
  const headingVal = lang === "en" ? (block.contentEn ?? "") : (block.content ?? "");
  const subheadingVal = lang === "en" ? (block.subheadingEn ?? "") : (block.subheading ?? "");

  const headingPlaceholder = lang === "en" ? "Heading text…" : "Başlık metni…";
  const subheadingPlaceholder = lang === "en" ? "Subheading text (optional)…" : "Alt başlık metni (isteğe bağlı)…";

  return (
    <div className="flex flex-col gap-2 w-full">
      <Input
        type="text"
        bgContext="block"
        value={headingVal}
        onChange={(e) => onChange(lang === "en" ? { contentEn: e.target.value } : { content: e.target.value })}
        placeholder={headingPlaceholder}
        size="md"
        className="font-medium text-[var(--text-title)]"
      />
      <Input
        type="text"
        bgContext="block"
        value={subheadingVal}
        onChange={(e) => onChange(lang === "en" ? { subheadingEn: e.target.value } : { subheading: e.target.value })}
        placeholder={subheadingPlaceholder}
        size="md"
        className="text-[var(--text-subtitle)] text-sm"
      />
    </div>
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
      {block.type === "figma" && <FigmaBlockEditor block={viewBlock} onChange={handleChange} projectSlug={projectSlug} />}
      {block.type === "iframe" && <IframeBlockEditor block={viewBlock} onChange={handleChange} projectSlug={projectSlug} />}
      {block.type === "list"   && <ListBlockEditor   block={viewBlock} onChange={handleChange} />}
      {isCaseStudyBlock(block.type) && <CaseStudyBlockEditor block={block} onChange={onChange} lang={lang} projectSlug={projectSlug} />}
    </div>
  );
}

// ── Per-section Add Block Button ──────────────────────────────────────────────

function SectionAddBlockButton({ onAdd }: { onAdd: (type: BlockType, extras?: Partial<Block>) => void }) {
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(false);
  const [showListPicker, setShowListPicker] = useState(false);

  function openMenu() { setOpen(true); setShowListPicker(false); requestAnimationFrame(() => setVisible(true)); }
  function close() { setVisible(false); setShowListPicker(false); setTimeout(() => setOpen(false), 200); }

  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) { if (e.key === "Escape") close(); }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  const LIST_STYLE_OPTIONS: { value: ListStyle; label: string; symbol: string }[] = [
    { value: "bullet",   label: "Bullet",    symbol: "•" },
    { value: "numbered", label: "Numaralı",  symbol: "1." },
    { value: "check",    label: "Checklist", symbol: "☑" },
    { value: "dash",     label: "Dash",      symbol: "—" },
  ];

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
              {!showListPicker ? (
                /* ── Block type list ── */
                <>
                  <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
                    <span className="text-xs font-medium uppercase tracking-widest text-[var(--text-subtitle)] select-none">Blok Tipi Seç</span>
                    <button onClick={close} className="flex items-center justify-center w-5 h-5 rounded text-[var(--text-subtitle)] hover:text-[var(--text-title)] transition-colors cursor-pointer"><XIcon /></button>
                  </div>
                  <BlockTypeList onPick={(type) => { onAdd(type); close(); }} onPickList={() => setShowListPicker(true)} />
                </>
              ) : (
                /* ── List style sub-menu ── */
                <>
                  <div className="flex items-center gap-2 px-3 py-3 border-b border-[var(--border)]">
                    <button onClick={() => setShowListPicker(false)}
                      className="flex items-center justify-center w-6 h-6 rounded-lg border border-transparent text-[var(--text-subtitle)] hover:border-[var(--border-hover)] hover:text-[var(--text-title)] hover:bg-[var(--bg-4)] transition-colors cursor-pointer"
                    ><BackIcon /></button>
                    <span className="flex-1 text-xs font-medium uppercase tracking-widest text-[var(--text-subtitle)] select-none">Liste Tipi</span>
                    <button onClick={close} className="flex items-center justify-center w-5 h-5 rounded text-[var(--text-subtitle)] hover:text-[var(--text-title)] transition-colors cursor-pointer"><XIcon /></button>
                  </div>
                  <div className="p-1.5 flex flex-col gap-0.5">
                    {LIST_STYLE_OPTIONS.map(({ value, label, symbol }) => (
                      <button key={value} onClick={() => { onAdd("list", { listStyle: value }); close(); }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors duration-150 hover:bg-[var(--bg-4)] group cursor-pointer"
                      >
                        <span className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-lg border border-[var(--border)] bg-[var(--bg-3)] text-[var(--text-subtitle)] group-hover:text-[var(--text-title)] transition-colors duration-150 text-sm font-medium">{symbol}</span>
                        <span className="text-sm font-medium text-[var(--text-title)]">{label}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
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
  function addBlock(type: BlockType, extras?: Partial<Block>) {
    onChange({ blocks: [...section.blocks, makeBlock(type, extras)] });
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
              key={block.id || `block-${bi}`}
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

type AddStep = "root" | "block" | "listStyle";

function AddMenu({
  onAddSection, onAddBlock, onAddDivider, onClose,
}: {
  onAddSection: () => void;
  onAddBlock: (type: BlockType, extras?: Partial<Block>) => void;
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
            style={{ width: "300%", transform: step === "listStyle" ? "translateX(-66.666%)" : step === "block" ? "translateX(-33.333%)" : "translateX(0%)" }}
          >
            {/* ── Step 1: Root ── */}
            <div className="w-1/3 flex-shrink-0 flex flex-col">
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
            <div className="w-1/3 flex-shrink-0 flex flex-col">
              <div className="flex items-center gap-2 px-3 py-3 border-b border-[var(--border)]">
                <button onClick={() => setStep("root")}
                  className="flex items-center justify-center w-6 h-6 rounded-lg border border-transparent text-[var(--text-subtitle)] hover:border-[var(--border-hover)] hover:text-[var(--text-title)] hover:bg-[var(--bg-4)] transition-colors cursor-pointer"
                ><BackIcon /></button>
                <span className="flex-1 text-xs font-medium uppercase tracking-widest text-[var(--text-subtitle)] select-none">Blok Tipi</span>
                <button onClick={onClose} className="flex items-center justify-center w-5 h-5 rounded text-[var(--text-subtitle)] hover:text-[var(--text-title)] transition-colors cursor-pointer"><XIcon /></button>
              </div>
              <BlockTypeList onPick={(type) => { onAddBlock(type); onClose(); }} onPickList={() => setStep("listStyle")} />
            </div>

            {/* ── Step 3: List style ── */}
            <div className="w-1/3 flex-shrink-0 flex flex-col">
              <div className="flex items-center gap-2 px-3 py-3 border-b border-[var(--border)]">
                <button onClick={() => setStep("block")}
                  className="flex items-center justify-center w-6 h-6 rounded-lg border border-transparent text-[var(--text-subtitle)] hover:border-[var(--border-hover)] hover:text-[var(--text-title)] hover:bg-[var(--bg-4)] transition-colors cursor-pointer"
                ><BackIcon /></button>
                <span className="flex-1 text-xs font-medium uppercase tracking-widest text-[var(--text-subtitle)] select-none">Liste Tipi</span>
                <button onClick={onClose} className="flex items-center justify-center w-5 h-5 rounded text-[var(--text-subtitle)] hover:text-[var(--text-title)] transition-colors cursor-pointer"><XIcon /></button>
              </div>
              <div className="p-1.5 flex flex-col gap-0.5">
                {(["bullet", "numbered", "check", "dash"] as ListStyle[]).map((ls) => {
                  const labels: Record<ListStyle, [string, string]> = {
                    bullet:   ["•",  "Bullet"],
                    numbered: ["1.", "Numaralı"],
                    check:    ["☑",  "Checklist"],
                    dash:     ["—",  "Dash"],
                  };
                  const [sym, lbl] = labels[ls];
                  return (
                    <button key={ls} onClick={() => { onAddBlock("list", { listStyle: ls }); onClose(); }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors duration-150 hover:bg-[var(--bg-4)] group cursor-pointer"
                    >
                      <span className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-lg border border-[var(--border)] bg-[var(--bg-3)] text-[var(--text-subtitle)] group-hover:text-[var(--text-title)] transition-colors duration-150 text-sm font-medium">{sym}</span>
                      <span className="text-sm font-medium text-[var(--text-title)]">{lbl}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
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

function CoverImageUpload({
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

  const [companies, setCompanies] = useState<string[]>([]);

  useEffect(() => {
    getCVData()
      .then((cv) => {
        const list = Array.from(new Set(cv.experience.map((e) => e.company.trim()).filter(Boolean)));
        setCompanies(list);
      })
      .catch((err) => console.error("Failed to load CV companies for select:", err));
  }, []);

  const descRef = useRef<HTMLTextAreaElement>(null);
  const autoResizeDesc = useCallback(() => {
    const el = descRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  useEffect(() => {
    autoResizeDesc();
  }, [project.description, project.descriptionEn, editLang, autoResizeDesc]);

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
    (updates: Partial<Pick<ProjectData, "title" | "titleEn" | "category" | "year" | "company" | "slug" | "coverImage" | "description" | "descriptionEn">>) => {
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

  /** Fills an empty project with the case-study template; keeps meta the user already entered. */
  function loadTemplate() {
    const template = createProjectTemplate();
    setProject((p) => ({
      ...p,
      title: p.title || template.title,
      category: p.category || template.category,
      year: p.year || template.year,
      description: p.description || template.description,
      coverImage: p.coverImage || template.coverImage,
      items: template.items,
    }));
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

  /** Adds a block to the last section in items (creates a section if none exist or if last item is a divider) */
  function addBlockToLastSection(type: BlockType, extras?: Partial<Block>) {
    setProject((p) => {
      const items = [...p.items];
      const lastItem = items[items.length - 1];

      if (!lastItem || lastItem.kind === "divider") {
        const newSection: PageSection = { ...makeSection(), blocks: [makeBlock(type, extras)] };
        return { ...p, items: [...items, newSection] };
      }

      const lastSectionIdx = items.length - 1;
      const section = { ...(items[lastSectionIdx] as PageSection) };
      section.blocks = [...(section.blocks || []), makeBlock(type, extras)];
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

  if (loadingFromDB) {
    return (
      <div className="min-h-screen w-full bg-[var(--bg-1)] flex items-center justify-center">
        <Spinner className="w-6 h-6 text-[var(--text-subtitle)]" />
      </div>
    );
  }

  return (
    <div className="flex h-full">

      {/* ── LEFT PANEL ── */}
      <div className="flex flex-col w-1/2 border-r border-[var(--border)] overflow-y-auto">
        {/* Sticky header */}
        <div className="sticky top-0 z-30 flex items-center justify-between px-5 py-3 border-b border-[var(--border)] bg-[var(--bg-1)]/90 backdrop-blur-md">
          <div className="inline-flex items-center h-10 px-3.5 rounded-full border border-[var(--border)] bg-[var(--bg-1)] text-[var(--text-title)] text-sm font-medium select-none truncate max-w-[240px]">
            {project.title || "Başlıksız Proje"}
          </div>
          <div className="flex items-center gap-2">
            <EditorNavControls />
            <PillButton
              size="md"
              onClick={() => setShowAddMenu(true)}
              startIcon={<PlusIcon />}
            >
              Ekle
            </PillButton>
          </div>
        </div>

        {/* Editor scroll area */}
        <div className="flex flex-col gap-6 px-5 py-8">

          {/* ── Proje Bilgileri ── */}
          <section className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-2.5">
              {/* Single title field — follows active edit lang (TR/EN) */}
              <MetaField
                value={editLang === "en" ? (project.titleEn ?? "") : project.title}
                placeholder={editLang === "en" ? "Title (EN)" : "Başlık (TR)"}
                onChange={(v) => updateMeta(editLang === "en" ? { titleEn: v } : { title: v })}
              />
              <MetaField value={project.slug}         placeholder="Slug"            disabled />
              <MetaField value={project.category}     placeholder="Kategori"        onChange={(v) => updateMeta({ category: v })} />
              <MetaField value={project.year}         placeholder="Yıl"             onChange={(v) => updateMeta({ year: v })} />
            </div>

            {/* Şirket Select (CV Deneyimlerinden) */}
            <Select
              options={companies}
              value={project.company ?? ""}
              onChange={(val) => updateMeta({ company: val })}
              placeholder="Şirket Seçin (Opsiyonel)"
              size="md"
            />

            {/* Description textarea */}
            <textarea
              ref={descRef}
              value={editLang === "en" ? (project.descriptionEn ?? "") : (project.description ?? "")}
              placeholder={editLang === "en" ? "Description (EN)…" : "Açıklama (TR)…"}
              onChange={(e) => {
                updateMeta(editLang === "en" ? { descriptionEn: e.target.value } : { description: e.target.value });
                autoResizeDesc();
              }}
              rows={3}
              className="w-full resize-none overflow-hidden rounded-[18px] border border-[var(--border)] bg-[var(--bg-1)] hover:bg-[var(--bg-4)] hover:border-[var(--border-hover)] px-4 py-3 text-sm font-light leading-6 text-[var(--text-p)] placeholder:text-[var(--text-subtitle)] focus:outline-none focus:border-[var(--border-hover)] transition-all duration-150"
            />

            {/* Cover image upload — right after the meta fields */}
            <CoverImageUpload
              slug={slug}
              currentSrc={project.coverImage}
              onChange={(url) => updateMeta({ coverImage: url })}
            />
          </section>

          <div className="w-full h-px bg-[var(--border)]" />

          {/* ── İçerik ── */}
          <section className="flex flex-col gap-3">

            {project.items.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-8 rounded-2xl border border-dashed border-[var(--border)] text-center">
                <p className="text-sm text-[var(--text-subtitle)] opacity-50 select-none">Henüz içerik yok</p>
                <p className="text-xs text-[var(--text-subtitle)] opacity-40 select-none">Yukarıdaki Ekle butonunu kullanın ya da şablonla başlayın</p>
                <PillButton size="md" onClick={loadTemplate} className="mt-2">
                  Şablondan başla
                </PillButton>
              </div>
            )}

            <div className="flex flex-col gap-3">
              {project.items.map((item, idx) => {
                const itemKey = item.id || `item-${idx}`;
                if (item.kind === "divider") {
                  return (
                    <DividerPageCard
                      key={itemKey}
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
                    key={itemKey}
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

          {/* Editable JSON output */}
          <JsonEditor value={project} onChange={setProject} />
        </div>
      </div>

      {/* ── RIGHT PANEL — Live Preview ── */}
      <div className="flex flex-col w-1/2 overflow-y-auto bg-[var(--bg-1)]">
        <div className="sticky top-0 z-30 flex items-center justify-between px-5 py-3 border-b border-[var(--border)] bg-[var(--bg-1)]/90 backdrop-blur-md">
          <div className="inline-flex items-center h-10 px-3.5 rounded-full border border-[var(--border)] bg-[var(--bg-1)] text-[var(--text-title)] text-sm font-medium select-none">
            Canlı görünüm
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
