"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Block, ListStyle, ListItem } from "@/types/project";
import { Input } from "@/components/Input";
import { PillButton } from "@/components/Button";

/* ── tiny uid ─────────────────────────────────────────────────────────────── */
let _c = 0;
function uid() { return `li-${Date.now().toString(36)}-${(++_c).toString(36)}`; }

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
    <div className="flex flex-col gap-2">
      {/* items */}
      <div className="flex flex-col gap-1.5">
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

            {/* text input — uses Input component (same as heading) */}
            <Input
              ref={(el) => { if (el) rowRefs.current.set(idx, el); else rowRefs.current.delete(idx); }}
              type="text"
              bgContext="block"
              value={item.text}
              onChange={(e) => updateItem(idx, { text: e.target.value })}
              onKeyDown={(e) => handleKeyDown(e, idx)}
              placeholder="Liste öğesi…"
              size="md"
              className={style === "check" && item.checked ? "line-through opacity-50" : ""}
            />

            {/* delete — red traffic dot (same as block/badge delete) */}
            <button
              type="button"
              onClick={() => removeItem(idx)}
              title="Kaldır"
              data-traffic-color="#e20000"
              data-traffic-icon="trash"
              className="w-3 h-3 rounded-full transition-opacity duration-150 cursor-pointer flex-shrink-0 hover:opacity-75 opacity-0 group-hover:opacity-100"
              style={{ background: "#e20000" }}
            />
          </div>
        ))}
      </div>

      {/* add button — PillButton (same as Badge Ekle) */}
      <PillButton
        size="md"
        bgContext="block"
        onClick={() => addItem()}
        startIcon={
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
            <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
        }
      >
        Öğe Ekle
      </PillButton>
    </div>
  );
}
