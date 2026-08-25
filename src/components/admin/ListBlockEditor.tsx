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

  /* render startContent based on list style */
  function renderStartContent(item: ListItem, idx: number) {
    switch (style) {
      case "bullet":
        return <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-title)] shrink-0 ml-0.5" />;
      case "numbered":
        return <span className="text-xs font-medium text-[var(--text-subtitle)] tabular-nums ml-0.5 min-w-[16px]">{idx + 1}.</span>;
      case "dash":
        return <span className="text-xs font-medium text-[var(--text-subtitle)] ml-0.5">—</span>;
      case "check":
        return (
          <button
            type="button"
            onClick={() => updateItem(idx, { checked: !item.checked })}
            className="w-[18px] h-[18px] rounded-[5px] border border-[var(--border-hover)] bg-[var(--bg-2)] flex items-center justify-center transition-colors cursor-pointer hover:border-[var(--text-subtitle)] ml-0.5 flex-shrink-0"
            style={item.checked ? { background: "var(--text-title)", borderColor: "var(--text-title)" } : {}}
          >
            {item.checked && (
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M2 5.5L4 7.5L8 3" stroke="var(--bg-1)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>
        );
    }
  }

  /* ensure at least one empty row */
  if (items.length === 0) {
    addItem();
    return null;
  }

  return (
    <div className="flex flex-col gap-2.5 w-full">
      {/* items list */}
      <div className="flex flex-col gap-1.5 w-full">
        {items.map((item, idx) => (
          <Input
            key={item.id}
            ref={(el) => { if (el) rowRefs.current.set(idx, el); else rowRefs.current.delete(idx); }}
            type="text"
            bgContext="block"
            value={item.text}
            onChange={(e) => updateItem(idx, { text: e.target.value })}
            onKeyDown={(e) => handleKeyDown(e, idx)}
            placeholder="Liste öğesi…"
            size="md"
            className={style === "check" && item.checked ? "line-through opacity-50" : ""}
            startContent={renderStartContent(item, idx)}
            endContent={
              <button
                type="button"
                onClick={() => removeItem(idx)}
                title="Kaldır"
                className="w-5 h-5 flex items-center justify-center rounded-full text-[var(--text-subtitle)] hover:text-[var(--text-title)] hover:bg-[var(--bg-4)] transition-colors cursor-pointer flex-shrink-0"
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            }
          />
        ))}
      </div>

      {/* add button — right aligned and compact, exactly like Badge Ekle */}
      <div className="flex justify-end w-full">
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
    </div>
  );
}
