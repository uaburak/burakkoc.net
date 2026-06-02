"use client";

import { useRef, useEffect } from "react";
import { Block } from "@/types/project";
import { BadgesEditor } from "@/components/admin/BadgesEditor";

interface CodeBlockEditorProps {
  block: Block;
  onChange: (updates: Partial<Block>) => void;
}

const LANGUAGES = ["tsx", "jsx", "ts", "js", "css", "html", "json", "bash", "python"];

export function CodeBlockEditor({ block, onChange }: CodeBlockEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLTextAreaElement>(null);

  function autoResize(ref: React.RefObject<HTMLTextAreaElement | null>) {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }

  useEffect(() => { autoResize(textareaRef); }, [block.content]);
  useEffect(() => { autoResize(previewRef); }, [block.codePreview]);

  return (
    <div className="flex flex-col gap-3">

      {/* Language picker */}
      <div className="flex items-center gap-2">
        <label className="text-xs font-medium uppercase tracking-widest text-[var(--text-subtitle)] select-none">
          Dil
        </label>
        <select
          value={block.language ?? "tsx"}
          onChange={(e) => onChange({ language: e.target.value })}
          className="rounded-lg border border-[var(--border)] bg-[var(--bg-2)] px-2.5 py-1.5 text-xs text-[var(--text-p)] focus:outline-none focus:border-[var(--border-hover)] cursor-pointer transition-colors duration-150"
        >
          {LANGUAGES.map((l) => (
            <option key={l} value={l}>{l}</option>
          ))}
        </select>
      </div>

      {/* Code textarea */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium uppercase tracking-widest text-[var(--text-subtitle)] select-none">
          Kod
        </label>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-2)] overflow-hidden">
          <div className="flex items-center gap-1.5 px-3 py-2 border-b border-[var(--border)]">
            <span className="w-2 h-2 rounded-full bg-[var(--border-hover)]" />
            <span className="w-2 h-2 rounded-full bg-[var(--border-hover)]" />
            <span className="w-2 h-2 rounded-full bg-[var(--border-hover)]" />
            <span className="ml-1.5 text-[10px] text-[var(--text-subtitle)] font-mono select-none">
              {block.language ?? "tsx"}
            </span>
          </div>
          <textarea
            ref={textareaRef}
            value={block.content ?? ""}
            onChange={(e) => {
              onChange({ content: e.target.value });
              autoResize(textareaRef);
            }}
            spellCheck={false}
            placeholder="// Kodunuzu buraya yazın…"
            rows={4}
            className="w-full resize-none overflow-hidden bg-transparent px-4 py-3 font-mono text-xs leading-6 text-[var(--text-p)] placeholder:text-[var(--text-subtitle)] focus:outline-none"
          />
        </div>
      </div>

      {/* Preview HTML input */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium uppercase tracking-widest text-[var(--text-subtitle)] select-none">
          Önizleme HTML{" "}
          <span className="normal-case tracking-normal">(opsiyonel — Preview sekmesinde görünür)</span>
        </label>
        <textarea
          ref={previewRef}
          value={block.codePreview ?? ""}
          onChange={(e) => {
            onChange({ codePreview: e.target.value });
            autoResize(previewRef);
          }}
          placeholder="<div>Canlı önizlemede görünecek HTML…</div>"
          rows={3}
          className="w-full resize-none overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-1)] px-4 py-3 font-mono text-xs leading-6 text-[var(--text-p)] placeholder:text-[var(--text-subtitle)] focus:outline-none focus:border-[var(--border-hover)] transition-colors duration-150"
        />
      </div>

      {/* Badges */}
      <BadgesEditor
        badges={block.badges ?? []}
        onChange={(badges) => onChange({ badges })}
      />
    </div>
  );
}
