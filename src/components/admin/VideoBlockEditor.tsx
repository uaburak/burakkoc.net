"use client";

import { Block } from "@/types/project";
import { BadgesEditor } from "@/components/admin/BadgesEditor";

interface VideoBlockEditorProps {
  block: Block;
  onChange: (updates: Partial<Block>) => void;
}

function getYouTubeId(url: string): string | null {
  const match = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  );
  return match ? match[1] : null;
}

function getVimeoId(url: string): string | null {
  const match = url.match(/vimeo\.com\/(\d+)/);
  return match ? match[1] : null;
}

function buildEmbedUrl(src: string): string | null {
  const ytId = getYouTubeId(src);
  if (ytId) return `https://www.youtube.com/embed/${ytId}`;
  const vimeoId = getVimeoId(src);
  if (vimeoId) return `https://player.vimeo.com/video/${vimeoId}`;
  // raw mp4
  if (src.endsWith(".mp4") || src.endsWith(".webm")) return src;
  return null;
}

export function VideoBlockEditor({ block, onChange }: VideoBlockEditorProps) {
  return (
    <div className="flex flex-col gap-3">
      {/* URL */}
      <Field label="Video URL">
        <input
          type="url"
          value={block.src ?? ""}
          onChange={(e) => onChange({ src: e.target.value })}
          placeholder="YouTube, Vimeo veya .mp4 / .webm URL'si"
          className={inputClass}
        />
      </Field>

      {/* Caption */}
      <Field label="Açıklama">
        <input
          type="text"
          value={block.caption ?? ""}
          onChange={(e) => onChange({ caption: e.target.value })}
          placeholder="Videonun altına yazılacak metin"
          className={inputClass}
        />
      </Field>

      {/* Badges */}
      <BadgesEditor
        badges={block.badges ?? []}
        onChange={(badges) => onChange({ badges })}
      />
    </div>
  );
}

// ── Shared helpers ───────────────────────────────────────────────────────────

const inputClass =
  "w-full rounded-xl border border-[var(--border)] bg-[var(--bg-1)] px-4 py-2.5 text-sm text-[var(--text-p)] placeholder:text-[var(--text-subtitle)] focus:outline-none focus:border-[var(--border-hover)] transition-colors duration-150";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium uppercase tracking-widest text-[var(--text-subtitle)] select-none">
        {label}
      </label>
      {children}
    </div>
  );
}
