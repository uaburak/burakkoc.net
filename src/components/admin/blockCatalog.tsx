"use client";

import { useEffect, useState } from "react";
import { Block, BlockType, Group, ListStyle, PageDivider, PageItem, PageSection } from "@/types/project";
import { createCaseStudyBlockDefaults } from "@/components/admin/CaseStudyBlockEditor";
import { cn } from "@/lib/utils";
import { FigmaIcon, type FigmaIconName } from "@/components/admin/figmaIcons";

/**
 * Component catalog shared by the form and the live editor: factories for
 * sections, groups (Blok) and components (Bileşen — `Block` in code), the
 * component types (label, description, icon, kind and its colour), the grouped
 * type picker and the add-component dialog.
 */

// ── Factories ─────────────────────────────────────────────────────────────────

export function uid() { return Math.random().toString(36).slice(2, 10); }

export function makeBlock(type: BlockType, extras?: Partial<Block>): Block {
  if (type === "list") {
    // Lists start with one empty item — an empty list shows nothing to type into.
    return { id: uid(), type, listItems: [{ id: uid(), text: "" }], ...extras };
  }
  return { id: uid(), type, ...createCaseStudyBlockDefaults(type), ...extras };
}

/** A Blok: a frame with a vertical auto layout — its components stacked, as Figma's new auto layout frames. */
export function makeGroup(blocks: Block[] = []): Group {
  return { id: uid(), grid: { flow: "vertical" }, blocks };
}

/** New sections are vertical auto layout frames too, with an empty Blok ready for components. */
export function makeSection(blocks: Block[] = []): PageSection {
  return { id: uid(), kind: "section", grid: { flow: "vertical" }, groups: [makeGroup(blocks)] };
}

export function makeDivider(): PageDivider {
  return { id: uid(), kind: "divider" };
}

/** Copy of a component with fresh ids for it and all its rows. */
export function cloneBlock(block: Block): Block {
  const copy: Block = structuredClone(block);
  copy.id = uid();
  copy.entries = copy.entries?.map((e) => ({ ...e, id: uid() }));
  copy.listItems = copy.listItems?.map((it) => ({ ...it, id: uid() }));
  copy.tableRows = copy.tableRows?.map((r) => ({ ...r, id: uid() }));
  return copy;
}

/** Copy of a group with fresh ids for it and its components. */
export function cloneGroup(group: Group): Group {
  return { ...structuredClone(group), id: uid(), blocks: group.blocks.map(cloneBlock) };
}

/** Copy of a section (fresh ids all the way down) or a divider. */
export function cloneItem(item: PageItem): PageItem {
  return item.kind === "section" ? { ...structuredClone(item), id: uid(), groups: item.groups.map(cloneGroup) } : { ...item, id: uid() };
}

// ── Block type registry (no divider — it's a top-level page item) ─────────────

export const BLOCK_DEFS: {
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
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <path d="M16 3a2 2 0 00-2 2v6a2 2 0 002 2 1 1 0 011 1v1a2 2 0 01-2 2 1 1 0 00-1 1v2a1 1 0 001 1 6 6 0 006-6V5a2 2 0 00-2-2zM5 3a2 2 0 00-2 2v6a2 2 0 002 2 1 1 0 011 1v1a2 2 0 01-2 2 1 1 0 00-1 1v2a1 1 0 001 1 6 6 0 006-6V5a2 2 0 00-2-2z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
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

/**
 * Kinds of components — the picker's sections. Every BLOCK_DEFS type appears
 * exactly once. Each kind has its colour in the live editor (`tone`, a CSS
 * custom property from globals.css); sections are blue, Bloks green.
 */
export const BLOCK_GROUPS: { label: string; tone: string; types: BlockType[] }[] = [
  { label: "Metin",        tone: "var(--edit-text)",     types: ["heading", "text", "list", "quote", "callout", "accordion"] },
  { label: "Medya",        tone: "var(--edit-media)",    types: ["image", "gallery", "mockup", "compare", "split", "video", "figma", "iframe", "code"] },
  { label: "Yapı & Veri",  tone: "var(--edit-data)",     types: ["info", "stats", "cards", "steps", "table", "bars", "tags", "links"] },
  { label: "Araştırma & Tasarım", tone: "var(--edit-research)", types: ["persona", "team", "palette"] },
];

/** Colours of the page's levels in the form editor. */
export const SECTION_TONE = "var(--edit-accent)";
export const GROUP_TONE = "var(--edit-group)";

// ── Layers, as Figma draws them (the live editor) ─────────────────────────────
//
// Frames (the page, a Bölüm, a Blok) and texts are Figma's blue; components
// and their instances — every layer the page holds — its purple.

export const FRAME_TONE = "var(--edit-accent)";
export const COMPONENT_TONE = "var(--edit-component)";

/**
 * What a component on the page is as a Figma layer: an instance of its main
 * component — every one of them (see DesignComponent).
 */
export type LayerKind = "instance";

export function layerKind(type: BlockType): LayerKind {
  void type;
  return "instance";
}

/** A layer's colour: an instance's purple. */
export const layerTone = (type: BlockType) => (layerKind(type) === "instance" ? COMPONENT_TONE : FRAME_TONE);

const LAYER_ICON: Record<LayerKind, FigmaIconName> = { instance: "16.instance" };

/** A layer's icon, as Figma's layer tree draws it (16px). */
export const layerIcon = (type: BlockType) => <FigmaIcon name={LAYER_ICON[layerKind(type)]} />;

/** The colour of a component's kind. */
export function blockTone(type: BlockType) {
  return BLOCK_GROUPS.find((g) => g.types.includes(type))?.tone ?? "var(--edit-text)";
}

/** The name of a component's kind ("Metin", "Medya"…). */
export function blockKind(type: BlockType) {
  return BLOCK_GROUPS.find((g) => g.types.includes(type))?.label ?? "Metin";
}

/** Grouped component type picker used by both add menus. `list` opens its style sub-menu. */
export function BlockTypeList({ onPick, onPickList }: {
  onPick: (type: BlockType) => void;
  onPickList: () => void;
}) {
  return (
    <div className="p-1.5 flex flex-col gap-0.5 max-h-[420px] overflow-y-auto">
      {BLOCK_GROUPS.map((group) => (
        <div key={group.label} className="flex flex-col gap-0.5">
          <span className="flex items-center gap-2 px-3 pt-2.5 pb-1 text-[11px] font-medium uppercase tracking-widest text-[var(--text-subtitle)] select-none">
            {/* The kind's colour — the same as its frames in the live editor. */}
            <span aria-hidden className="w-2 h-2 rounded-full" style={{ background: group.tone }} />
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

export function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function BackIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function XIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
      <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

// ── Labels ────────────────────────────────────────────────────────────────────

export const BLOCK_LABELS: Record<BlockType, string> = {
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

export const LIST_STYLE_OPTIONS: { value: ListStyle; label: string; symbol: string }[] = [
  { value: "bullet",   label: "Bullet",    symbol: "•" },
  { value: "numbered", label: "Numaralı",  symbol: "1." },
  { value: "check",    label: "Checklist", symbol: "☑" },
  { value: "dash",     label: "Dash",      symbol: "—" },
];

// ── Add-component dialog ──────────────────────────────────────────────────────────

/** List style sub-menu rows (used by both add menus). */
export function ListStylePicker({ onPick }: { onPick: (style: ListStyle) => void }) {
  return (
    <div className="p-1.5 flex flex-col gap-0.5">
      {LIST_STYLE_OPTIONS.map(({ value, label, symbol }) => (
        <button key={value} onClick={() => onPick(value)}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors duration-150 hover:bg-[var(--bg-4)] group cursor-pointer"
        >
          <span className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-lg border border-[var(--border)] bg-[var(--bg-3)] text-[var(--text-subtitle)] group-hover:text-[var(--text-title)] transition-colors duration-150 text-sm font-medium">{symbol}</span>
          <span className="text-sm font-medium text-[var(--text-title)]">{label}</span>
        </button>
      ))}
    </div>
  );
}

/** Centered modal: pick a component type (list → style sub-menu). */
export function BlockPickerDialog({ onPick, onClose }: {
  onPick: (type: BlockType, extras?: Partial<Block>) => void;
  onClose: () => void;
}) {
  const [visible, setVisible] = useState(false);
  const [showListPicker, setShowListPicker] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    function handleKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  function pick(type: BlockType, extras?: Partial<Block>) {
    onPick(type, extras);
    onClose();
  }

  return (
    <>
      <div className="fixed inset-0 z-[9998]" onClick={onClose} aria-hidden />
      <div style={{ position: "fixed", left: "50%", top: "50%", zIndex: 9999 }}
        className={cn("transition-all duration-200 origin-center", visible ? "opacity-100 scale-100" : "opacity-0 scale-95")}
      >
        <div style={{ transform: "translate(-50%, -50%)" }}
          className="w-72 rounded-2xl border border-[var(--border)] bg-[var(--bg-2)] shadow-xl overflow-hidden"
        >
          {!showListPicker ? (
            <>
              <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
                <span className="text-xs font-medium uppercase tracking-widest text-[var(--text-subtitle)] select-none">Bileşen Seç</span>
                <button onClick={onClose} aria-label="Kapat" className="flex items-center justify-center w-5 h-5 rounded text-[var(--text-subtitle)] hover:text-[var(--text-title)] transition-colors cursor-pointer"><XIcon /></button>
              </div>
              <BlockTypeList onPick={(type) => pick(type)} onPickList={() => setShowListPicker(true)} />
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 px-3 py-3 border-b border-[var(--border)]">
                <button onClick={() => setShowListPicker(false)} aria-label="Geri"
                  className="flex items-center justify-center w-6 h-6 rounded-lg border border-transparent text-[var(--text-subtitle)] hover:border-[var(--border-hover)] hover:text-[var(--text-title)] hover:bg-[var(--bg-4)] transition-colors cursor-pointer"
                ><BackIcon /></button>
                <span className="flex-1 text-xs font-medium uppercase tracking-widest text-[var(--text-subtitle)] select-none">Liste Tipi</span>
                <button onClick={onClose} aria-label="Kapat" className="flex items-center justify-center w-5 h-5 rounded text-[var(--text-subtitle)] hover:text-[var(--text-title)] transition-colors cursor-pointer"><XIcon /></button>
              </div>
              <ListStylePicker onPick={(style) => pick("list", { listStyle: style })} />
            </>
          )}
        </div>
      </div>
    </>
  );
}
