"use client";

import { useRef, useState, type ReactNode } from "react";
import type { DesignComponent } from "@/types/design";
import { cn } from "@/lib/utils";
import { FigmaIcon } from "@/components/admin/figmaIcons";
import { FIELD, Field, FieldMenu, FieldRow, Glyphs, Group, Row, SquareButton, TextField, UsesGroup, type DesignUse } from "@/components/admin/LiveInspector";
import { sameValues, variantName, variantValue, type VariantProperty } from "@/components/project/components";

/**
 * The design panel for Figma's component sets (see DesignComponent): the set
 * — its name, its properties and their values (renamed across its variants),
 * its variants — and a variant's values of the set's properties.
 */

/**
 * A name typed and kept on Enter or leaving the field (Esc drops it) — a
 * property's or a value's, which rename them across the set: kept as a whole,
 * so a half-typed one never merges two values.
 */
function CommitField({ label, value, placeholder, chip = false, suffix, onCommit }: {
  label: string;
  value: string;
  placeholder?: string;
  /** A value's chip: as wide as its text */
  chip?: boolean;
  suffix?: ReactNode;
  onCommit: (value: string) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  // Enter, Esc and leaving the field all end the typing — only the first one counts.
  const typing = useRef(false);
  const finish = (keep: boolean, raw: string) => {
    if (!typing.current) return;
    typing.current = false;
    const next = raw.trim();
    if (keep && next && next !== value) onCommit(next);
    setDraft(null);
  };
  const input = (
    <input
      aria-label={label}
      value={draft ?? value}
      placeholder={placeholder}
      size={chip ? Math.max(3, (draft ?? value).length + 1) : undefined}
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => {
        typing.current = true;
        setDraft(e.target.value);
      }}
      onBlur={(e) => finish(true, e.currentTarget.value)}
      onKeyDown={(e) => {
        // Keys stay in the field: no Escape dropping the selection, no Backspace deleting it.
        e.stopPropagation();
        if (e.key === "Enter") finish(true, e.currentTarget.value);
        if (e.key === "Escape") finish(false, value);
      }}
      className={cn(
        "min-w-0 bg-transparent text-[var(--text-title)] placeholder:text-[var(--text-subtitle)] outline-none",
        chip ? "text-[11px] leading-4" : "flex-1 text-[11px]"
      )}
    />
  );
  if (chip) return <span className={cn("inline-flex items-center h-6 px-2", FIELD)}>{input}</span>;
  return (
    <div className={cn("flex w-full min-w-0 items-center gap-1.5 px-2", FIELD)}>
      {input}
      {suffix}
    </div>
  );
}

/** A variant in the set's list, as a layer row: its mark, its name ("Durum=Vurgulu") — a conflict marked. */
function VariantRow({ name, conflict, onClick }: { name: string; conflict: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={conflict ? "Başka bir varyantla aynı değerler" : undefined}
      className="group/item flex items-center gap-2 w-[calc(100%+16px)] h-8 -mx-2 px-2 rounded-[6px] text-left hover:bg-[var(--bg-4)] transition-colors cursor-pointer"
    >
      <span className="flex shrink-0 text-[var(--edit-component)]"><FigmaIcon name="16.component" /></span>
      <span className="min-w-0 flex-1 truncate text-[11px] text-[var(--text-title)]">{name}</span>
      {conflict && <span aria-hidden className="w-1.5 h-1.5 shrink-0 rounded-full bg-[#f24822]" />}
      <span className="shrink-0 text-[var(--text-subtitle)] opacity-0 group-hover/item:opacity-100 transition-opacity">{Glyphs.chevron}</span>
    </button>
  );
}

/**
 * A component set, as Figma's: its name (every variant's), its properties —
 * each renamed or taken off across its variants, its values renamed on every
 * variant with them, "+" adding one — its variants ("+" adds one: a copy of
 * the last, with a value of its own) and where they are used.
 */
export function ComponentSetInspector({ name, kind, variants, properties, placement, frame, uses, onRename, onAddProperty, onRenameProperty, onRemoveProperty, onRenameValue, onAddVariant, onSelectVariant }: {
  name: string;
  /** What it is, in words */
  kind: string;
  variants: DesignComponent[];
  properties: VariantProperty[];
  /** Where it sits on the Bileşenler page (see PositionGroup) */
  placement?: ReactNode;
  /** Its own frame's fields: how it lays out its variants, its look */
  frame?: ReactNode;
  uses: DesignUse[];
  onRename: (name: string) => void;
  onAddProperty: () => void;
  onRenameProperty: (from: string, to: string) => void;
  onRemoveProperty: (name: string) => void;
  onRenameValue: (property: string, from: string, to: string) => void;
  onAddVariant: () => void;
  onSelectVariant: (id: string) => void;
}) {
  return (
    <div className="flex flex-col">
      <Group title="Bileşen seti">
        <Field label="Ad">
          <TextField label="Ad" value={name} onChange={onRename} placeholder="grup/ad" />
        </Field>
        <Row label="Tür">
          <span className="min-w-0 text-[11px] leading-4 text-[var(--text-title)]">{kind}</span>
        </Row>
      </Group>
      {placement}
      <Group title="Özellikler" actions={<SquareButton label="Özellik ekle" onClick={onAddProperty}>{Glyphs.plus}</SquareButton>}>
        {properties.map((p) => (
          <div key={p.name} className="flex flex-col gap-1.5">
            <FieldRow
              wide
              icon={properties.length > 1 && <SquareButton label={`${p.name} özelliğini kaldır`} onClick={() => onRemoveProperty(p.name)}>{Glyphs.minus}</SquareButton>}
            >
              <CommitField label="Özelliğin adı" value={p.name} onCommit={(to) => onRenameProperty(p.name, to)} />
            </FieldRow>
            <div className="flex flex-wrap gap-1 pr-7">
              {p.values.map((value) => (
                <CommitField key={value} chip label={`${p.name}: ${value}`} value={value} onCommit={(to) => onRenameValue(p.name, value, to)} />
              ))}
            </div>
          </div>
        ))}
        {properties.length === 0 && <p className="text-[11px] leading-4 text-[var(--text-subtitle)]">Varyantları ayıracak bir özellik yok — &quot;+&quot; ile ekle.</p>}
      </Group>
      {frame}
      <Group title="Varyantlar" actions={<SquareButton label="Varyant ekle" onClick={onAddVariant}>{Glyphs.plus}</SquareButton>}>
        {variants.map((v) => (
          <VariantRow key={v.id} name={variantName(v)} conflict={variants.some((o) => o.id !== v.id && sameValues(o, v, properties))} onClick={() => onSelectVariant(v.id)} />
        ))}
      </Group>
      <UsesGroup uses={uses} empty="Henüz hiçbir yerde kullanılmıyor." />
    </div>
  );
}

/**
 * A variant of a set, as Figma's: the set it is in (the arrow selects it) and
 * its value of each of the set's properties — typed, or one the others have
 * picked from the menu. Two variants with the same values are marked, as in
 * Figma.
 */
export function VariantGroup({ setName, variant, properties, conflict, onValue, onSelectSet }: {
  setName: string;
  variant: DesignComponent;
  properties: VariantProperty[];
  /** Another variant has the same values */
  conflict: boolean;
  onValue: (property: string, value: string) => void;
  onSelectSet: () => void;
}) {
  return (
    <Group title="Varyant">
      <FieldRow wide icon={<SquareButton label="Bileşen setini seç" onClick={onSelectSet}>{Glyphs.goTo}</SquareButton>}>
        <div className={cn("flex w-full min-w-0 items-center gap-2 px-2", FIELD)}>
          <span className="flex shrink-0 text-[var(--edit-component)]"><FigmaIcon name="16.component" /></span>
          <span className="min-w-0 flex-1 truncate text-[11px] text-[var(--text-title)]">{setName}</span>
        </div>
      </FieldRow>
      {properties.map((p) => {
        const value = variantValue(variant, p.name);
        return (
          <Row key={p.name} label={p.name}>
            <CommitField
              label={p.name}
              value={value}
              placeholder="—"
              onCommit={(next) => onValue(p.name, next)}
              suffix={
                <FieldMenu
                  label={`${p.name}: setteki değerler`}
                  items={p.values.map((v) => ({ label: v, checked: v === value, onSelect: () => onValue(p.name, v) }))}
                />
              }
            />
          </Row>
        );
      })}
      {conflict && (
        <p className="text-[11px] leading-4 text-[#f24822]">Setteki başka bir varyantla aynı değerlere sahip — örnekler ikisini ayıramaz; bir değeri değiştir.</p>
      )}
    </Group>
  );
}
