"use client";

import { useEffect, useRef } from "react";
import { Block } from "@/types/project";

interface TextBlockEditorProps {
  block: Block;
  onChange: (updates: Partial<Block>) => void;
}

export function TextBlockEditor({ block, onChange }: TextBlockEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-grow textarea
  function autoResize() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }

  useEffect(() => {
    autoResize();
  }, [block.content]);

  return (
    <textarea
      ref={textareaRef}
      value={block.content ?? ""}
      onChange={(e) => {
        onChange({ content: e.target.value });
        autoResize();
      }}
      placeholder="Paragraf metnini buraya yazın…"
      rows={3}
      className="w-full resize-none overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-1)] px-4 py-3 text-sm font-light leading-7 text-[var(--text-p)] placeholder:text-[var(--text-subtitle)] focus:outline-none focus:border-[var(--border-hover)] transition-colors duration-150"
    />
  );
}
