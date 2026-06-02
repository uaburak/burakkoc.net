"use client";

import { Block } from "@/types/project";
import { BadgesEditor } from "@/components/admin/BadgesEditor";

interface ImageBlockEditorProps {
  block: Block;
  onChange: (updates: Partial<Block>) => void;
}

const ASPECT_RATIOS: { value: Block["aspectRatio"]; label: string }[] = [
  { value: "16/9", label: "16 : 9" },
  { value: "4/3", label: "4 : 3" },
  { value: "1/1", label: "1 : 1" },
];

export function ImageBlockEditor({ block, onChange }: ImageBlockEditorProps) {
  const ratio = block.aspectRatio ?? "16/9";

  return (
    <div className="flex flex-col gap-3">
      {/* URL */}
      <Field label="Resim URL">
        <input
          type="url"
          value={block.src ?? ""}
          onChange={(e) => onChange({ src: e.target.value })}
          placeholder="https://…"
          className={inputClass}
        />
      </Field>

      {/* Alt text */}
      <Field label="Alt Metin">
        <input
          type="text"
          value={block.alt ?? ""}
          onChange={(e) => onChange({ alt: e.target.value })}
          placeholder="Ekran okuyucu açıklaması"
          className={inputClass}
        />
      </Field>

      {/* Caption */}
      <Field label="Açıklama">
        <input
          type="text"
          value={block.caption ?? ""}
          onChange={(e) => onChange({ caption: e.target.value })}
          placeholder="Görselin altına yazılacak metin"
          className={inputClass}
        />
      </Field>

      {/* Aspect ratio */}
      <Field label="Oran">
        <div className="flex gap-2">
          {ASPECT_RATIOS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => onChange({ aspectRatio: value })}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors duration-150 cursor-pointer ${
                ratio === value
                  ? "border-[var(--text-title)] bg-[var(--bg-4)] text-[var(--text-title)]"
                  : "border-[var(--border)] bg-transparent text-[var(--text-subtitle)] hover:text-[var(--text-p)]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
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
