"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { DesignVariable, VariableKind } from "@/types/design";
import { cn } from "@/lib/utils";
import { byGroup, canAlias, modeValue, splitName, type ThemeMode } from "@/components/project/designVariables";
import { FigmaIcon } from "@/components/admin/figmaIcons";
import { BoundField, Glyphs, KIND_LABEL, MenuList, SquareButton, usePopover } from "@/components/admin/LiveInspector";

/**
 * Figma's "Local variables": the site's design variables (see DesignVariable)
 * in a window over the editor — their groups (the names' paths) on the left,
 * a table on the right: each variable's name, then its value in each theme
 * (a colour's light and dark; a size or a weight has one), each its own or
 * another variable's (an alias, from the mark at the field's end). Names are
 * typed in place; a new one is made from the bottom, a changed starting one
 * goes back to its value, an added one is deleted.
 */

/** Figma's number variable, for numbers and weights alike. */
const KIND_ICON: Record<VariableKind, ReactNode> = {
  color: <FigmaIcon name="16.variable" />,
  number: <FigmaIcon name="16.number" />,
  weight: <FigmaIcon name="16.number" />,
};

const ADD: { kind: VariableKind; label: string }[] = [
  { kind: "color", label: "Renk" },
  { kind: "number", label: "Sayı" },
  { kind: "weight", label: "Yazı kalınlığı" },
];

/** The table's columns: name, light, dark, actions. */
const COLUMNS = "grid grid-cols-[minmax(160px,1.2fr)_minmax(150px,1fr)_minmax(150px,1fr)_56px] items-center gap-3";

/** A variable's name, typed in place (Enter / leaving keeps it, Esc drops it). */
function NameCell({ variable, onRename }: { variable: DesignVariable; onRename: (name: string) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const [group, own] = splitName(variable.name);
  if (draft !== null) {
    const finish = (keep: boolean) => {
      if (keep && draft.trim() && draft.trim() !== variable.name) onRename(draft.trim());
      setDraft(null);
    };
    return (
      <input
        autoFocus
        aria-label="Değişkenin adı"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={(e) => e.currentTarget.select()}
        onBlur={() => finish(true)}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter") finish(true);
          if (e.key === "Escape") finish(false);
        }}
        className="w-full h-7 px-2 rounded-[6px] border border-[var(--edit-accent)] bg-[var(--bg-1)] text-[12px] text-[var(--text-title)] outline-none"
      />
    );
  }
  return (
    <button
      type="button"
      title={`${variable.name} — yeniden adlandırmak için çift tıkla`}
      onDoubleClick={() => setDraft(variable.name)}
      className="flex min-w-0 items-center gap-2 h-7 px-1 rounded-[6px] text-left cursor-default"
    >
      <span className="flex shrink-0 text-[var(--text-subtitle)]">{KIND_ICON[variable.kind]}</span>
      <span className="min-w-0 truncate text-[12px] text-[var(--text-title)]">{own || "Adsız"}</span>
      {group && <span className="shrink-0 text-[11px] text-[var(--text-subtitle)] opacity-0 group-hover/row:opacity-100 transition-opacity">{group}</span>}
    </button>
  );
}

export function VariablesModal({ variables, isStarting, onChange, onAdd, onRemove, onClose }: {
  variables: DesignVariable[];
  /** One of the starting variables: it can only go back to its value */
  isStarting: (id: string) => boolean;
  onChange: (variable: DesignVariable) => void;
  /** Adds one of that kind; returns its id */
  onAdd: (kind: VariableKind) => string;
  onRemove: (id: string) => void;
  onClose: () => void;
}) {
  const [group, setGroup] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const { at: addAt, box: addBox, toggle: toggleAdd, close: closeAdd } = usePopover(200);
  const [added, setAdded] = useState<string | null>(null);
  const byId = new Map(variables.map((v) => [v.id, v]));
  const groups = byGroup(variables);
  const q = query.trim().toLocaleLowerCase("tr");
  const shown = variables.filter((v) => (group === null || splitName(v.name)[0] === group) && (!q || v.name.toLocaleLowerCase("tr").includes(q)));

  // Esc closes it (a field being typed in handles its own first).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  // A new variable comes into view at the table's end.
  useEffect(() => {
    if (added) document.querySelector(`[data-variable-row="${added}"]`)?.scrollIntoView({ block: "nearest" });
  }, [added]);

  const cell = (variable: DesignVariable, mode: ThemeMode) => (
    <BoundField
      label={`${variable.name} — ${mode === "dark" ? "koyu" : "açık"}`}
      kind={variable.kind}
      value={modeValue(variable, mode)}
      targets={variables.filter((t) => canAlias(variable, t, byId))}
      byId={byId}
      mode={mode}
      onChange={(value) => onChange(mode === "dark" ? { ...variable, dark: value } : { ...variable, light: value })}
    />
  );

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/30"
      onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        role="dialog"
        aria-label="Yerel değişkenler"
        className="flex flex-col w-full max-w-[960px] h-[min(640px,calc(100vh-48px))] rounded-[13px] border border-[var(--border)] bg-[var(--bg-1)] shadow-[0_24px_64px_rgba(0,0,0,0.24)] overflow-hidden"
      >
        <header className="shrink-0 flex items-center gap-3 h-12 pl-4 pr-2 border-b border-[var(--border)]">
          <h2 className="text-[13px] font-semibold text-[var(--text-title)] select-none">Yerel değişkenler</h2>
          <span className="text-[11px] text-[var(--text-subtitle)] tabular-nums">{variables.length}</span>
          <input
            type="search"
            aria-label="Değişken ara"
            placeholder="Ara"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="ml-auto w-48 h-7 px-2 rounded-[6px] bg-[var(--bg-4)] text-[12px] text-[var(--text-title)] placeholder:text-[var(--text-subtitle)] outline-none"
          />
          <SquareButton label="Kapat" onClick={onClose}>{Glyphs.close}</SquareButton>
        </header>
        <div className="flex flex-1 min-h-0">
          {/* The groups, as Figma's collection sidebar. */}
          <nav aria-label="Gruplar" className="w-[200px] shrink-0 flex flex-col gap-px p-2 border-r border-[var(--border)] overflow-y-auto">
            {[[null, "Tüm değişkenler", variables.length] as const, ...[...groups].map(([name, list]) => [name, name || "Grupsuz", list.length] as const)].map(([key, label, count]) => (
              <button
                key={key ?? "*"}
                type="button"
                onClick={() => setGroup(key)}
                className={cn(
                  "flex items-center justify-between gap-2 h-8 px-2.5 rounded-[6px] text-left text-[12px] cursor-pointer transition-colors",
                  group === key ? "bg-[var(--bg-4)] font-medium text-[var(--text-title)]" : "text-[var(--text-p)] hover:bg-[color-mix(in_srgb,var(--bg-4)_60%,transparent)]"
                )}
              >
                <span className="min-w-0 truncate">{label}</span>
                <span className="shrink-0 text-[11px] text-[var(--text-subtitle)] tabular-nums">{count}</span>
              </button>
            ))}
          </nav>
          <div className="flex flex-col flex-1 min-w-0">
            <div className={cn(COLUMNS, "shrink-0 h-9 px-4 border-b border-[var(--border)] text-[11px] font-medium text-[var(--text-subtitle)] select-none")}>
              <span>Ad</span>
              <span>Açık tema</span>
              <span>Koyu tema</span>
              <span />
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto py-1">
              {[...byGroup(shown)].map(([name, list]) => (
                <div key={name || "—"} className="flex flex-col">
                  {group === null && name && (
                    <p className="h-8 flex items-center px-4 text-[11px] font-semibold text-[var(--text-subtitle)] select-none">{name}</p>
                  )}
                  {list.map((v) => (
                    <div key={v.id} data-variable-row={v.id} className={cn(COLUMNS, "group/row min-h-10 px-4 hover:bg-[color-mix(in_srgb,var(--bg-4)_40%,transparent)]")}>
                      <NameCell variable={v} onRename={(next) => onChange({ ...v, name: next })} />
                      {v.kind === "color" ? (
                        <>
                          {cell(v, "light")}
                          {cell(v, "dark")}
                        </>
                      ) : (
                        <>
                          {cell(v, "light")}
                          {/* One value, whatever the theme. */}
                          <span className="px-1 text-[11px] text-[var(--text-subtitle)] select-none" title={KIND_LABEL[v.kind]}>Aynı</span>
                        </>
                      )}
                      <span className="flex justify-end opacity-0 group-hover/row:opacity-100 focus-within:opacity-100 transition-opacity">
                        {isStarting(v.id) ? (
                          <SquareButton label="Sitenin değerine dön" onClick={() => onRemove(v.id)}>{Glyphs.reset}</SquareButton>
                        ) : (
                          <SquareButton label="Değişkeni sil" onClick={() => onRemove(v.id)}>{Glyphs.trash}</SquareButton>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
              {shown.length === 0 && <p className="px-4 py-6 text-[12px] text-[var(--text-subtitle)]">Eşleşen değişken yok.</p>}
            </div>
            <footer ref={addBox} className="relative shrink-0 flex items-center h-11 px-2 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={(e) => toggleAdd(e.currentTarget, "left", "above")}
                className="flex items-center gap-1.5 h-8 px-2 rounded-[6px] text-[12px] font-medium text-[var(--text-title)] hover:bg-[var(--bg-4)] transition-colors cursor-pointer"
              >
                <span className="flex">{Glyphs.plus}</span>
                Değişken oluştur
              </button>
              {addAt && (
                <MenuList
                  at={addAt}
                  width={200}
                  items={ADD.map((a) => ({
                    label: a.label,
                    onSelect: () => {
                      const id = onAdd(a.kind);
                      setGroup(null);
                      setQuery("");
                      setAdded(id);
                    },
                  }))}
                  onClose={closeAdd}
                />
              )}
            </footer>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
