"use client";

import { useEffect, useRef, useState } from "react";
import { BlockType } from "@/types/project";
import { cn } from "@/lib/utils";

interface BlockTypeMenuProps {
  onSelect: (type: BlockType | "divider") => void;
  onClose: () => void;
}

const BLOCK_TYPES: { type: BlockType | "divider"; label: string; description: string; icon: React.ReactNode }[] = [
  {
    type: "text",
    label: "Metin",
    description: "Düz paragraf ya da başlık",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M2 4h12M2 8h8M2 12h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    type: "image",
    label: "Resim",
    description: "URL ile görsel ekle",
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
    description: "YouTube, Vimeo veya dosya URL'si",
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
    description: "Sözdizimi vurgulu kod + canlı önizleme",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M5 5L2 8l3 3M11 5l3 3-3 3M9 3l-2 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    type: "divider",
    label: "Bölücü",
    description: "İnce yatay çizgi",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M2 8h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
];

export function BlockTypeMenu({ onSelect, onClose }: BlockTypeMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  // Animate in
  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <>
      {/* Backdrop — click anywhere outside the card to close */}
      <div
        className="fixed inset-0 z-[9998]"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Card — already positioned by parent fixed wrapper */}
      <div
        ref={ref}
        className={cn(
          "relative z-[9999] w-64 rounded-2xl border border-[var(--border)] bg-[var(--bg-2)] shadow-xl overflow-hidden",
          "transition-all duration-200 origin-center",
          visible ? "opacity-100 scale-100" : "opacity-0 scale-95"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
          <span className="text-xs font-medium uppercase tracking-widest text-[var(--text-subtitle)] select-none">
            Blok Tipi Seç
          </span>
          <button
            onClick={onClose}
            className="w-5 h-5 flex items-center justify-center rounded text-[var(--text-subtitle)] hover:text-[var(--text-title)] transition-colors cursor-pointer"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <div className="p-1.5 flex flex-col gap-0.5">
          {BLOCK_TYPES.map(({ type, label, description, icon }) => (
            <button
              key={type}
              onClick={() => { onSelect(type); onClose(); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors duration-150 hover:bg-[var(--bg-4)] group cursor-pointer"
            >
              <span className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-lg border border-[var(--border)] bg-[var(--bg-3)] text-[var(--text-subtitle)] group-hover:text-[var(--text-title)] transition-colors duration-150">
                {icon}
              </span>
              <span className="flex flex-col gap-0.5 min-w-0">
                <span className="text-sm font-medium leading-4 text-[var(--text-title)]">{label}</span>
                <span className="text-xs leading-4 text-[var(--text-subtitle)] truncate">{description}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
