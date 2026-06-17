"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { Block } from "@/types/project";
import { BadgesEditor } from "@/components/admin/BadgesEditor";
import { uploadFile, blockStoragePath } from "@/lib/storage";
import { PillButton } from "@/components/Button";
import { Segmented } from "@/components/Segmented";
import { Input } from "@/components/Input";

interface ImageBlockEditorProps {
  block: Block;
  onChange: (updates: Partial<Block>) => void;
  projectSlug?: string;
}

// ── Upload zone — compact: click to pick, shows filename after upload ─────────

function UploadZone({
  blockId,
  projectSlug,
  currentSrc,
  onUploaded,
}: {
  blockId: string;
  projectSlug: string;
  currentSrc?: string;
  onUploaded: (url: string, filename: string) => void;
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
      // strip timestamp prefix (e.g. "1718000000000_banner.jpg" → "banner.jpg")
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
      const path = blockStoragePath(projectSlug, blockId, file);
      const url = await uploadFile(file, path, setProgress);
      setFilename(file.name);
      onUploaded(url, file.name);
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
  }, [blockId, projectSlug]);

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

// ── Aspect ratio options ──────────────────────────────────────────────────────
const ASPECT_RATIOS: { value: NonNullable<Block["aspectRatio"]>; label: string }[] = [
  { value: "16/9", label: "16 : 9" },
  { value: "4/3",  label: "4 : 3"  },
  { value: "1/1",  label: "1 : 1"  },
];

const SOURCE_MODES = ["URL", "Yükle"];

// ── Main component ────────────────────────────────────────────────────────────

export function ImageBlockEditor({ block, onChange, projectSlug = "unknown" }: ImageBlockEditorProps) {
  const [tab, setTab] = useState<"URL" | "Yükle">("URL");

  return (
    <div className="flex flex-col gap-[10px]">

      {/* Row 1: Segment control (URL | Yükle) + input/upload on same line */}
      <div className="flex items-center gap-[10px]">
        <Segmented
          options={SOURCE_MODES}
          value={tab}
          onChange={(v) => setTab(v as "URL" | "Yükle")}
          size="md"
        />
        {tab === "URL" ? (
          <Input
            type="url"
            value={block.src ?? ""}
            onChange={(e) => onChange({ src: e.target.value })}
            placeholder="Resim URL - https://..."
            size="md"
            className="flex-1"
          />
        ) : (
          <UploadZone
            blockId={block.id}
            projectSlug={projectSlug}
            currentSrc={block.src}
            onUploaded={(url) => onChange({ src: url })}
          />
        )}
      </div>

      {/* Alt metin */}
      <Input
        type="text"
        value={block.alt ?? ""}
        onChange={(e) => onChange({ alt: e.target.value })}
        placeholder="Alt Metin"
        size="md"
      />

      {/* Açıklama */}
      <Input
        type="text"
        value={block.caption ?? ""}
        onChange={(e) => onChange({ caption: e.target.value })}
        placeholder="Açıklama"
        size="md"
      />

      {/* Oran seçici (fit-width) + Badge Ekle — aynı satırda */}
      <BadgesEditor
        badges={block.badges ?? []}
        onChange={(badges) => onChange({ badges })}
        aspectRatioControl={
          <Segmented
            options={ASPECT_RATIOS.map((r) => r.label)}
            value={ASPECT_RATIOS.find((r) => r.value === (block.aspectRatio ?? "16/9"))?.label ?? "16 : 9"}
            onChange={(label) => {
              const ratio = ASPECT_RATIOS.find((r) => r.label === label);
              if (ratio) onChange({ aspectRatio: ratio.value });
            }}
            size="md"
          />
        }
      />
    </div>
  );
}
