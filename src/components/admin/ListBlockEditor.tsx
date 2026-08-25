"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Block, ListStyle, ListItem } from "@/types/project";
import { Segmented } from "@/components/Segmented";

/* ── tiny uid ─────────────────────────────────────────────────────────────── */
let _c = 0;
function uid() { return `li-${Date.now().toString(36)}-${(++_c).toString(36)}`; }

/* ── style options ────────────────────────────────────────────────────────── */
const LIST_STYLES: { value: ListStyle; label: string }[] = [
  { value: "bullet",   label: "● Bullet" },
  { value: "numbered", label: "1. Numaralı" },
  { value: "check",    label: "☑ Checklist" },
  { value: "dash",     label: "— Dash" },
];

/* ── props ────────────────────────────────────────────────────────────────── */
interface ListBlockEditorProps {
  block: Block;
  onChange: (updates: Partial<Block>) => void;
}

/* ── component ────────────────────────────────────────────────────────────── */
export function ListBlockEditor({ block, onChange }: ListBlockEditorProps) {
  const items: ListItem[] = block.listItems ?? [];
  const style: ListStyle = block.listStyle ?? "bullet";
  const [focusIdx, setFocusIdx] = useState<number | null>(null);
  const rowRefs = useRef<Map<number, HTMLInputElement>>(new Map());

  /* focus management */
  useEffect(() => {
    if (focusIdx !== null) {
      const el = rowRefs.current.get(focusIdx);
      if (el) { el.focus(); el.selectionStart = el.value.length; }
      setFocusIdx(null);
    }
  }, [focusIdx, items.length]);

  /* helpers */
  const updateItems = useCallback((next: ListItem[]) => onChange({ listItems: next }), [onChange]);

  function updateItem(idx: number, patch: Partial<ListItem>) {
    const next = items.map((it, i) => (i === idx ? { ...it, ...patch } : it));
    updateItems(next);
  }

  function addItem(afterIdx?: number) {
    const newItem: ListItem = { id: uid(), text: "" };
    const next = [...items];
    const insertAt = afterIdx !== undefined ? afterIdx + 1 : next.length;
    next.splice(insertAt, 0, newItem);
    updateItems(next);
    setFocusIdx(insertAt);
  }

  function removeItem(idx: number) {
    if (items.length <= 1) return; // keep at least 1
    const next = items.filter((_, i) => i !== idx);
    updateItems(next);
    setFocusIdx(Math.max(0, idx - 1));
  }

  function moveItem(idx: number, dir: -1 | 1) {
    const target = idx + dir;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[idx], next[target]] = [next[target], next[idx]];
    updateItems(next);
    setFocusIdx(target);
  }

  /* handle Enter / Backspace on empty */
  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>, idx: number) {
    if (e.key === "Enter") {
      e.preventDefault();
      addItem(idx);
    }
    if (e.key === "Backspace" && items[idx].text === "" && items.length > 1) {
      e.preventDefault();
      removeItem(idx);
    }
    if (e.key === "ArrowUp" && e.altKey) {
      e.preventDefault();
      moveItem(idx, -1);
    }
    if (e.key === "ArrowDown" && e.altKey) {
      e.preventDefault();
      moveItem(idx, 1);
    }
  }

  /* prefix symbol */
  function prefix(idx: number) {
    switch (style) {
      case "bullet":   return "•";
      case "numbered": return `${idx + 1}.`;
      case "dash":     return "—";
      case "check":    return null; // rendered as checkbox
    }
  }

  /* ensure at least one empty row */
  if (items.length === 0) {
    addItem();
    return null;
  }

  return (
    <div className="flex flex-col gap-3">
      {/* style selector */}
      <div className="flex items-center gap-2">
        <Segmented
          options={LIST_STYLES.map((s) => s.label)}
          defaultValue={LIST_STYLES.find((s) => s.value === style)?.label ?? LIST_STYLES[0].label}
          onChange={(label) => {
            const found = LIST_STYLES.find((s) => s.label === label);
            if (found) onChange({ listStyle: found.value });
          }}
        />
      </div>

      {/* items */}
      <div className="flex flex-col gap-1">
        {items.map((item, idx) => (
          <div key={item.id} className="group flex items-center gap-2">
            {/* prefix / checkbox */}
            {style === "check" ? (
              <button
                type="button"
                onClick={() => updateItem(idx, { checked: !item.checked })}
                className="flex-shrink-0 w-[18px] h-[18px] rounded-[5px] border border-[var(--border)] bg-[var(--bg-1)] flex items-center justify-center transition-colors duration-150 cursor-pointer hover:border-[var(--border-hover)]"
                style={item.checked ? { background: "var(--text-title)", borderColor: "var(--text-title)" } : {}}
              >
                {item.checked && (
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M2 5.5L4 7.5L8 3" stroke="var(--bg-1)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
            ) : (
              <span className="flex-shrink-0 w-[24px] text-right text-xs font-medium text-[var(--text-subtitle)] select-none">
                {prefix(idx)}
              </span>
            )}

            {/* text input */}
            <input
              ref={(el) => { if (el) rowRefs.current.set(idx, el); else rowRefs.current.delete(idx); }}
              type="text"
              value={item.text}
              onChange={(e) => updateItem(idx, { text: e.target.value })}
              onKeyDown={(e) => handleKeyDown(e, idx)}
              placeholder="Liste öğesi…"
              className="flex-1 min-w-0 bg-transparent border-none outline-none text-sm font-light leading-7 text-[var(--text-p)] placeholder:text-[var(--text-subtitle)] focus:outline-none"
              style={style === "check" && item.checked ? { textDecoration: "line-through", opacity: 0.5 } : {}}
            />

            {/* delete button (visible on hover) */}
            <button
              type="button"
              onClick={() => removeItem(idx)}
              className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded text-[var(--text-subtitle)] opacity-0 group-hover:opacity-100 hover:text-[var(--text-title)] transition-all duration-150 cursor-pointer"
              title="Öğeyi sil"
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        ))}
      </div>

      {/* add button */}
      <button
        type="button"
        onClick={() => addItem()}
        className="self-start flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--text-subtitle)] hover:text-[var(--text-title)] hover:bg-[var(--bg-1)] border border-transparent hover:border-[var(--border)] transition-all duration-150 cursor-pointer"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M5 1v8M1 5h8" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
        </svg>
        Öğe Ekle
      </button>
    </div>
  );
}
