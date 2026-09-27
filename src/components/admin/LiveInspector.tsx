"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { AspectRatio, Block, BlockEntry, BlockType, BlockVariant, GridAlign, GridSettings, GridTrack, Group as PageGroup, LayoutFlow, LinkIconType, ListItem, ListStyle, PageFrame, PageSection, ProjectData, SizeMode, Sizing } from "@/types/project";
import { cn } from "@/lib/utils";
import { BlockFields } from "@/components/admin/BlockFields";
import { CoverImageUpload } from "@/components/admin/FormEditor";
import { UploadZone } from "@/components/admin/ImageBlockEditor";
import type { ProjectMeta } from "@/components/admin/editorActions";
import { editorUid } from "@/components/project/editing";
import { BLOCK_DEFS, BLOCK_LABELS, blockTone } from "@/components/admin/blockCatalog";
import { gridGaps } from "@/components/project/LayoutGrid";
import type { ResolvedDesign } from "@/components/project/componentDesign";
import { moleculeLayout } from "@/components/project/designMolecules";
import { boundValue, canAlias, modeValue, resolvedValue, type ThemeMode } from "@/components/project/designVariables";
import { splitName } from "@/components/admin/VariablesPanel";
import { TYPOGRAPHY_KINDS } from "@/components/project/designAtoms";
import { AtomSample, atomMetrics } from "@/components/admin/AtomsPanel";
import { useTheme } from "@/context/ThemeContext";
import type { DesignAtom, DesignMolecule, DesignVariable, FrameLook, MoleculeSlot, Stroke, Paint, SpacingKey, StrokeAlign, Typography, VariableKind, VariableValue } from "@/types/design";
import { MAX_COLUMNS, MAX_ROWS, columnTracks, gridColumns, gridFlow, gridRows, layoutCells, rowTracks, withColumnCount, withRowCount, withTrack, type Cell } from "@/lib/projectLayout";

/**
 * The live editor's inspector ("Düzenle") — whatever was clicked on the page:
 * - the project (nothing selected): cover, company, address;
 * - a section (Bölüm): the grid its Bloks sit on, and its Bloks;
 * - a Blok (group): its width in the section, the grid its components sit
 *   on, and its components;
 * - a component (Bileşen): its layout options, its image, and the list of its items;
 * - an item inside a component (card, step, link, list item…): its fields.
 * Text can always be edited on the page too; this is the tidy way to reach
 * everything else (images, links, icons, values).
 *
 * Laid out like Figma's properties panel, in the layer tree's language (see
 * the primitives below). Only reads shared components — the block editor is
 * unaffected.
 */

type Lang = "tr" | "en";

// ── Primitives ────────────────────────────────────────────────────────────────
//
// Figma's properties panel, in the layer tree's language: full-width sections
// divided by thin rules; small grey (bg-4) fields, 28px tall, gently rounded;
// only icons carry a colour.

/**
 * A section of the panel: its title (actions on the right, e.g. "+") over its
 * controls, a rule under it. `muted`: empty — only its title, greyed, as
 * Figma's Fill / Stroke with nothing in them.
 */
function Group({ title, actions, muted = false, children }: { title: string; actions?: ReactNode; muted?: boolean; children?: ReactNode }) {
  return (
    <section className={cn("flex flex-col gap-2 px-4 border-b border-[var(--border)]", muted ? "py-3" : "pt-3 pb-4")}>
      <div className="flex items-center justify-between gap-2 h-6">
        <h3 className={cn("text-[12px] font-semibold leading-4 select-none", muted ? "text-[var(--text-subtitle)]" : "text-[var(--text-title)]")}>{title}</h3>
        {actions && <div className="flex items-center gap-0.5 -mr-1">{actions}</div>}
      </div>
      {children}
    </section>
  );
}

/** A labelled line: the label on the left, the control filling the rest. */
function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2 min-h-7">
      <span className="w-[72px] shrink-0 text-[12px] leading-4 text-[var(--text-subtitle)] select-none">{label}</span>
      <div className="flex flex-1 min-w-0 items-center">{children}</div>
    </div>
  );
}

/** The grey box every field sits in (`group/field`: marks at its end show on its hover, see Bindable). */
const FIELD =
  "group/field h-7 rounded-[6px] bg-[var(--bg-4)] border border-transparent hover:border-[var(--border-hover)] focus-within:border-[var(--text-subtitle)] transition-colors";

/** The chosen option of a segmented control: raised (white; a step lighter in the dark theme). */
const RAISED = "bg-[var(--bg-1)] [[data-theme=dark]_&]:bg-[var(--bg-5)] text-[var(--text-title)] shadow-[0_1px_2px_rgba(0,0,0,0.08)]";

/** Figma's segmented control: a grey track, the chosen option raised. Options may be icons (their label then names them). */
function Choice<T>({ value, options, onChange }: {
  value: T;
  options: { value: T; label: string; icon?: ReactNode }[];
  onChange: (value: T) => void;
}) {
  return (
    <div role="radiogroup" className="flex w-full h-7 gap-0.5 p-0.5 rounded-[6px] bg-[var(--bg-4)]">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.label}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={o.icon ? o.label : undefined}
            title={o.icon ? o.label : undefined}
            onClick={() => onChange(o.value)}
            className={cn(
              "flex flex-1 min-w-0 items-center justify-center px-1.5 rounded-[5px] text-[11px] font-medium truncate transition-colors cursor-pointer",
              active ? RAISED : "text-[var(--text-subtitle)] hover:text-[var(--text-title)]"
            )}
          >
            {o.icon ?? o.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Figma's number field: a grey box with a prefix — drag it sideways to scrub
 * the value — then the number: type it (Enter / leaving the field keeps it,
 * Esc drops it), ↑ / ↓ step it (with Shift by 10). An optional value (Min W…)
 * may be empty: its placeholder shows, emptying the field clears it
 * (`onClear`), stepping or scrubbing starts from `fallback`.
 */
function NumberField({ label, prefix, value, min, max, suffix, placeholder, fallback, onChange, onClear }: {
  label: string;
  prefix: ReactNode;
  value: number | null;
  min: number;
  max: number;
  suffix?: ReactNode;
  placeholder?: string;
  fallback?: number;
  onChange: (value: number) => void;
  onClear?: () => void;
}) {
  const base = value ?? fallback ?? min;
  const [draft, setDraft] = useState<string | null>(null);
  // Enter, Esc and leaving the field all end the typing — only the first one counts.
  const typing = useRef(false);
  const clamp = (n: number) => Math.min(max, Math.max(min, Math.round(n)));
  /** Keeps the typed number (undefined: Esc — the value stays). */
  const finish = (raw?: string) => {
    if (!typing.current) return;
    typing.current = false;
    const n = Number(raw?.replace(",", "."));
    if (raw !== undefined && !raw.trim() && value !== null) onClear?.();
    else if (raw?.trim() && Number.isFinite(n) && clamp(n) !== value) onChange(clamp(n));
    setDraft(null);
  };
  const scrub = (e: React.PointerEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    let last = value;
    const move = (ev: PointerEvent) => {
      const next = clamp(base + Math.round((ev.clientX - startX) / 6));
      if (next !== last) {
        last = next;
        onChange(next);
      }
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  return (
    <div className={cn("flex items-center gap-1.5 min-w-0 px-2", FIELD)}>
      <span
        onPointerDown={scrub}
        title={label}
        className="flex shrink-0 items-center text-[11px] leading-none text-[var(--text-subtitle)] tabular-nums cursor-ew-resize select-none"
      >
        {prefix}
      </span>
      <input
        aria-label={label}
        inputMode="numeric"
        value={draft ?? (value === null ? "" : String(value))}
        placeholder={placeholder}
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => {
          typing.current = true;
          setDraft(e.target.value);
        }}
        onBlur={(e) => finish(e.currentTarget.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") finish(e.currentTarget.value);
          if (e.key === "Escape") finish();
          if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault();
            // Steps from the value shown (the field then shows the value again).
            const next = clamp(base + (e.key === "ArrowUp" ? 1 : -1) * (e.shiftKey ? 10 : 1));
            if (next !== value) onChange(next);
            typing.current = false;
            setDraft(null);
          }
        }}
        className="min-w-0 flex-1 bg-transparent text-[12px] text-[var(--text-title)] placeholder:text-[var(--text-subtitle)] outline-none tabular-nums"
      />
      {suffix && <span className="shrink-0 text-[11px] text-[var(--text-subtitle)] tabular-nums select-none">{suffix}</span>}
    </div>
  );
}

/** A one-line text field in the grey box, with an optional prefix (icon, colour swatch) and suffix. */
function TextField({ label, value, onChange, placeholder, type = "text", prefix, suffix }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: "text" | "url";
  prefix?: ReactNode;
  suffix?: ReactNode;
}) {
  return (
    <div className={cn("flex w-full min-w-0 items-center gap-1.5 px-2", FIELD)}>
      {prefix}
      <input
        type={type}
        aria-label={label}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="min-w-0 flex-1 bg-transparent text-[12px] text-[var(--text-title)] placeholder:text-[var(--text-subtitle)] outline-none"
      />
      {suffix}
    </div>
  );
}

/** A dropdown in the grey box (the system's own menu), with an optional suffix before its chevron. */
function SelectField({ label, value, options, placeholder, suffix, onChange }: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  placeholder?: string;
  suffix?: ReactNode;
  onChange: (value: string) => void;
}) {
  return (
    <div className={cn("relative flex w-full min-w-0 items-center", FIELD)}>
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn("w-full h-full pl-2 appearance-none bg-transparent text-[12px] text-[var(--text-title)] outline-none cursor-pointer", suffix ? "pr-12" : "pr-6")}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      {suffix && <span className="absolute right-6 flex items-center">{suffix}</span>}
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden className="pointer-events-none absolute right-2 text-[var(--text-subtitle)]">
        <path d="M2.5 4l2.5 2.5L7.5 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

/** A square icon button (section actions), as in the layer tree. */
function SquareButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex items-center justify-center w-6 h-6 rounded-[6px] text-[var(--text-subtitle)] hover:text-[var(--text-title)] hover:bg-[var(--bg-4)] transition-colors cursor-pointer"
    >
      {children}
    </button>
  );
}

/** An icon button that stays pressed (Figma's wrap, per-side padding…); off when `disabled`. */
function ToggleButton({ label, pressed, disabled = false, onClick, children }: { label: string; pressed: boolean; disabled?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex shrink-0 items-center justify-center w-7 h-7 rounded-[6px] transition-colors cursor-pointer disabled:opacity-35 disabled:cursor-default",
        pressed
          ? "bg-[color-mix(in_srgb,var(--edit-accent)_14%,transparent)] text-[var(--edit-accent)]"
          : "text-[var(--text-subtitle)] hover:text-[var(--text-title)] hover:bg-[var(--bg-4)]"
      )}
    >
      {children}
    </button>
  );
}

const Glyphs = {
  /** Apply a variable (Figma's hexagon) */
  variable: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M7 1.75l4.55 2.625v5.25L7 12.25 2.45 9.625v-5.25L7 1.75z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
    </svg>
  ),
  /** Detach a variable (Figma's broken link) */
  detach: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M5.2 6.2L3.9 7.5a2.1 2.1 0 003 3l1.3-1.3M8.8 7.8l1.3-1.3a2.1 2.1 0 00-3-3L5.8 4.8" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
      <path d="M2 2l1.6 1.6M12 12l-1.6-1.6M5 1.5v1.3M1.5 5h1.3M9 12.5v-1.3M12.5 9h-1.3" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  ),
  /** Styles and variables (Figma's four dots) */
  styles: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <circle cx="4.25" cy="4.25" r="1.75" stroke="currentColor" strokeWidth="1.1" />
      <circle cx="9.75" cy="4.25" r="1.75" stroke="currentColor" strokeWidth="1.1" />
      <circle cx="4.25" cy="9.75" r="1.75" stroke="currentColor" strokeWidth="1.1" />
      <circle cx="9.75" cy="9.75" r="1.75" stroke="currentColor" strokeWidth="1.1" />
    </svg>
  ),
  /** Shown (a fill, a stroke) */
  eye: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M1.5 7S3.5 3.25 7 3.25 12.5 7 12.5 7 10.5 10.75 7 10.75 1.5 7 1.5 7z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
      <circle cx="7" cy="7" r="1.75" stroke="currentColor" strokeWidth="1.1" />
    </svg>
  ),
  /** Hidden (a fill, a stroke) */
  eyeOff: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M1.5 7s1.1-2.1 3.2-3.2M12.5 7s-.8 1.5-2.3 2.6M5.9 3.35A5 5 0 017 3.25C10.5 3.25 12.5 7 12.5 7M8.2 10.6a5 5 0 01-1.2.15C3.5 10.75 1.5 7 1.5 7" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
      <path d="M2.5 2.5l9 9" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  ),
  /** Remove (a fill, a stroke) */
  minus: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M3 7h8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  ),
  /** Opacity: a dotted square, Figma's */
  opacity: (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <rect x="1.5" y="1.5" width="9" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.1" />
      <path d="M4.5 10.5v-3h3v-3h3" stroke="currentColor" strokeWidth="1" opacity="0.6" />
    </svg>
  ),
  /** Corner radius: a rounded corner */
  radius: (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <path d="M2 10.5V6.5a4.5 4.5 0 014.5-4.5h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  ),
  /** A stroke's weight: lines getting thicker */
  strokeWeight: (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <rect x="1.5" y="2" width="9" height="3" rx="0.6" stroke="currentColor" strokeWidth="1" />
      <rect x="1.5" y="7" width="9" height="3" rx="0.6" stroke="currentColor" strokeWidth="1" />
    </svg>
  ),
  /** A molecule: atoms bound together */
  molecule: (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <circle cx="3" cy="8.5" r="1.8" stroke="currentColor" strokeWidth="1.1" />
      <circle cx="9" cy="8.5" r="1.8" stroke="currentColor" strokeWidth="1.1" />
      <circle cx="6" cy="3" r="1.8" stroke="currentColor" strokeWidth="1.1" />
      <path d="M4.8 8.5h2.4M3.9 6.9L5.1 4.6M8.1 6.9L6.9 4.6" stroke="currentColor" strokeWidth="1.1" />
    </svg>
  ),
  /** An atom: a nucleus and its orbit */
  atom: (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <ellipse cx="6" cy="6" rx="5" ry="2.2" stroke="currentColor" strokeWidth="1.1" transform="rotate(-30 6 6)" />
      <ellipse cx="6" cy="6" rx="5" ry="2.2" stroke="currentColor" strokeWidth="1.1" transform="rotate(30 6 6)" />
      <circle cx="6" cy="6" r="1.2" fill="currentColor" />
    </svg>
  ),
  /** Go to (the atom it uses) */
  goTo: (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <path d="M4 2.5h5.5V8M9.5 2.5L3 9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  /** Figma's instance mark: a diamond */
  instance: (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <path d="M6 1.5L10.5 6 6 10.5 1.5 6z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  ),
  /** Figma's component mark: four diamonds */
  mainComponent: (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden>
      <path d="M6 .8l1.7 1.7L6 4.2 4.3 2.5zM2.5 4.3L4.2 6 2.5 7.7.8 6zM9.5 4.3L11.2 6 9.5 7.7 7.8 6zM6 7.8l1.7 1.7L6 11.2 4.3 9.5z" />
    </svg>
  ),
  plus: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M7 2.5v9M2.5 7h9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  ),
  chevron: (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <path d="M4.5 3l3 3-3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  /** Column count */
  columns: (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <rect x="1.5" y="2" width="2.5" height="8" rx="0.8" stroke="currentColor" strokeWidth="1.1" />
      <rect x="4.75" y="2" width="2.5" height="8" rx="0.8" stroke="currentColor" strokeWidth="1.1" />
      <rect x="8" y="2" width="2.5" height="8" rx="0.8" stroke="currentColor" strokeWidth="1.1" />
    </svg>
  ),
  /** Row (position) */
  row: (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <rect x="1.5" y="4" width="9" height="4" rx="0.8" stroke="currentColor" strokeWidth="1.1" />
      <path d="M1.5 1.5h9M1.5 10.5h9" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" opacity="0.5" />
    </svg>
  ),
  /** Column (position) */
  column: (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <rect x="4" y="1.5" width="4" height="9" rx="0.8" stroke="currentColor" strokeWidth="1.1" />
      <path d="M1.5 1.5v9M10.5 1.5v9" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" opacity="0.5" />
    </svg>
  ),
  /** Width */
  width: (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <path d="M1.5 2.5v7M10.5 2.5v7M3 6h6M4.5 4.5L3 6l1.5 1.5M7.5 4.5L9 6 7.5 7.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  minWidth: (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <path d="M6 2v8M1.5 6h2.5M10.5 6H8M3 4.5L4.5 6 3 7.5M9 4.5L7.5 6 9 7.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  maxWidth: (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <path d="M1.5 2.5v7M10.5 2.5v7M3.5 6h5M5 4.5L3.5 6 5 7.5M7 4.5L8.5 6 7 7.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  minHeight: (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <path d="M2 6h8M6 1.5V4M6 10.5V8M4.5 3L6 4.5 7.5 3M4.5 9L6 7.5 7.5 9" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  maxHeight: (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <path d="M2.5 1.5h7M2.5 10.5h7M6 3.5v5M4.5 5L6 3.5 7.5 5M4.5 7L6 8.5 7.5 7" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  /** Gap between columns: ]·[ */
  gapX: (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <path d="M2 2h1.5v8H2M10 2H8.5v8H10M6 5v2" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  /** Stacked (Figma's vertical auto layout) */
  flowVertical: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <rect x="2" y="2" width="4" height="4" rx="1" stroke="currentColor" strokeWidth="1.2" />
      <rect x="2" y="8" width="4" height="4" rx="1" stroke="currentColor" strokeWidth="1.2" />
      <path d="M10 2.5v8.5M8 9l2 2 2-2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  /** Side by side (horizontal) */
  flowHorizontal: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <rect x="2" y="2" width="4" height="4" rx="1" stroke="currentColor" strokeWidth="1.2" />
      <rect x="8" y="2" width="4" height="4" rx="1" stroke="currentColor" strokeWidth="1.2" />
      <path d="M2.5 10h8.5M9 8l2 2-2 2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  /** Wrap: side by side, on to the next line (Figma's ↩) */
  wrap: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M2.5 3.5h7a2.5 2.5 0 010 5H4.5M6 6.5l-2 2 2 2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  /** Out of the auto layout (Figma's absolute position) */
  absolute: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <rect x="2" y="2" width="10" height="10" rx="2" stroke="currentColor" strokeWidth="1.1" strokeDasharray="2 1.6" />
      <path d="M7 4.5v5M4.5 7h5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  ),
  /** Padding for each side on its own */
  padSides: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <rect x="2" y="2" width="10" height="10" rx="2" stroke="currentColor" strokeWidth="1.2" />
      <path d="M5 5h4v4H5z" stroke="currentColor" strokeWidth="1.1" opacity="0.6" />
    </svg>
  ),
  /** On a grid */
  flowGrid: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <rect x="2" y="2" width="4" height="4" rx="1" stroke="currentColor" strokeWidth="1.2" />
      <rect x="8" y="2" width="4" height="4" rx="1" stroke="currentColor" strokeWidth="1.2" />
      <rect x="2" y="8" width="4" height="4" rx="1" stroke="currentColor" strokeWidth="1.2" />
      <rect x="8" y="8" width="4" height="4" rx="1" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  ),
  /** Gap between rows */
  gapY: (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <path d="M2 2v1.5h8V2M2 10V8.5h8V10M5 6h2" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  /** Padding left and right */
  padX: (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <rect x="1.5" y="1.5" width="9" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.1" />
      <path d="M4 4v4M8 4v4" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  ),
  /** Padding top and bottom */
  padY: (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <rect x="1.5" y="1.5" width="9" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.1" />
      <path d="M4 4h4M4 8h4" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  ),
  /** Row count */
  rows: (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <rect x="2" y="1.5" width="8" height="2.5" rx="0.8" stroke="currentColor" strokeWidth="1.1" />
      <rect x="2" y="4.75" width="8" height="2.5" rx="0.8" stroke="currentColor" strokeWidth="1.1" />
      <rect x="2" y="8" width="8" height="2.5" rx="0.8" stroke="currentColor" strokeWidth="1.1" />
    </svg>
  ),
  /** A Blok, as in the layer tree */
  group: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <rect x="2" y="2" width="4" height="4" rx="1" stroke="currentColor" strokeWidth="1.3" />
      <rect x="8" y="2" width="4" height="4" rx="1" stroke="currentColor" strokeWidth="1.3" />
      <rect x="2" y="8" width="4" height="4" rx="1" stroke="currentColor" strokeWidth="1.3" />
      <rect x="8" y="8" width="4" height="4" rx="1" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  ),
};

/** Figma's marks for the design system's kinds — for the inspector's header. */
export const DesignGlyphs = {
  instance: Glyphs.instance,
  mainComponent: Glyphs.mainComponent,
  atom: Glyphs.atom,
  variable: Glyphs.variable,
};

// ── Images ────────────────────────────────────────────────────────────────────

/** Preview + URL / upload + alt text for one image. */
function ImageSource({ src, alt, onSrc, onAlt, uploadId, projectSlug, compact = false }: {
  src?: string;
  alt?: string;
  onSrc: (src: string) => void;
  onAlt?: (alt: string) => void;
  uploadId: string;
  projectSlug: string;
  compact?: boolean;
}) {
  const [mode, setMode] = useState<"url" | "upload">("url");
  return (
    <div className="flex flex-col gap-2">
      {!compact && (
        <div className="relative w-full h-32 rounded-[6px] overflow-hidden bg-[var(--bg-4)]">
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="absolute inset-0 flex items-center justify-center text-[11px] text-[var(--text-subtitle)]">Görsel yok</span>
          )}
        </div>
      )}
      <Choice value={mode} options={[{ value: "url", label: "Bağlantı" }, { value: "upload", label: "Yükle" }]} onChange={setMode} />
      {mode === "url" ? (
        <TextField label="Görsel adresi" type="url" value={src ?? ""} onChange={onSrc} placeholder="https://…" />
      ) : (
        <UploadZone blockId={uploadId} projectSlug={projectSlug} currentSrc={src} onUploaded={(url) => onSrc(url)} />
      )}
      {onAlt && <TextField label="Alt metin" value={alt ?? ""} onChange={onAlt} placeholder="Alt metin — görseli kısaca tarif et" />}
    </div>
  );
}

// ── Options ───────────────────────────────────────────────────────────────────

const cols = (...values: (2 | 3 | 4)[]) => values.map((v) => ({ value: v, label: String(v) }));

const ASPECTS: { value: AspectRatio; label: string }[] = [
  { value: "16/9", label: "16:9" },
  { value: "4/3", label: "4:3" },
  { value: "1/1", label: "1:1" },
  { value: "3/4", label: "3:4" },
  { value: "9/16", label: "9:16" },
];

const LIST_STYLES: { value: ListStyle; label: string }[] = [
  { value: "bullet", label: "Madde" },
  { value: "numbered", label: "Sıralı" },
  { value: "check", label: "Onay" },
  { value: "dash", label: "Tire" },
];

const CALLOUT_VARIANTS: { value: BlockVariant; label: string }[] = [
  { value: "note", label: "Not" },
  { value: "insight", label: "İçgörü" },
  { value: "tip", label: "İpucu" },
  { value: "warning", label: "Dikkat" },
];

const MOCKUP_VARIANTS: { value: BlockVariant; label: string }[] = [
  { value: "phone", label: "Telefon" },
  { value: "browser", label: "Tarayıcı" },
  { value: "tablet", label: "Tablet" },
];

const SPLIT_SIDES: { value: BlockVariant; label: string }[] = [
  { value: "left", label: "Solda" },
  { value: "right", label: "Sağda" },
];

const LINK_ICONS: { value: LinkIconType; label: string }[] = [
  { value: "web", label: "Web sitesi" },
  { value: "appstore", label: "App Store" },
  { value: "playstore", label: "Google Play" },
  { value: "github", label: "GitHub" },
  { value: "figma", label: "Figma" },
  { value: "behance", label: "Behance" },
  { value: "external", label: "Diğer" },
];

/** Blocks whose own editor is the whole story (no inline text on the page). */
const OWN_EDITOR = new Set<Block["type"]>(["code", "figma", "iframe"]);

// ── Block inspector ───────────────────────────────────────────────────────────

/**
 * A component's properties, as a Figma instance's under its header: its
 * options (and, laid out by its main component, the molecule its items are
 * — `properties`), its image or video, its items.
 */
export function BlockInspector({ block, lang, projectSlug, properties, onChange, onSelectEntry }: {
  block: Block;
  lang: Lang;
  projectSlug: string;
  /** More property rows (the molecule its items are — see MoleculeProperty) */
  properties?: ReactNode;
  onChange: (patch: Partial<Block>) => void;
  /** Open an item's own settings (also right after adding one) */
  onSelectEntry: (entryId: string) => void;
}) {
  const en = lang === "en";
  const type = block.type;

  if (OWN_EDITOR.has(type)) {
    return (
      <div className="flex flex-col">
        <Group title="İçerik">
          <div className="flex flex-col gap-2.5">
            <BlockFields block={block} onChange={onChange} lang={lang} projectSlug={projectSlug} />
          </div>
        </Group>
      </div>
    );
  }

  // ── Layout options ──
  const options: ReactNode[] = [];
  if (type === "list") {
    options.push(
      <Row key="style" label="Stil">
        <Choice value={block.listStyle ?? "bullet"} options={LIST_STYLES} onChange={(listStyle) => onChange({ listStyle })} />
      </Row>
    );
  }
  if (type === "stats" || type === "palette") {
    options.push(
      <Row key="cols" label="Sütun">
        <Choice value={block.columns ?? (type === "stats" ? 3 : 4)} options={cols(2, 3, 4)} onChange={(columns) => onChange({ columns })} />
      </Row>
    );
  }
  if (type === "cards") {
    options.push(
      <Row key="cols" label="Sütun">
        <Choice value={block.columns ?? 2} options={cols(2, 3)} onChange={(columns) => onChange({ columns })} />
      </Row>
    );
  }
  if (type === "gallery") {
    options.push(
      <Row key="cols" label="Sütun">
        <Choice value={block.columns ?? 2} options={cols(2, 3, 4)} onChange={(columns) => onChange({ columns })} />
      </Row>
    );
  }
  if (type === "image" || type === "compare") {
    options.push(
      <Row key="ratio" label="Oran">
        <Choice value={block.aspectRatio ?? "16/9"} options={ASPECTS.slice(0, 3)} onChange={(aspectRatio) => onChange({ aspectRatio })} />
      </Row>
    );
  }
  if (type === "gallery" || type === "split") {
    options.push(
      <Row key="ratio" label="Oran">
        <Choice value={block.aspectRatio ?? "4/3"} options={ASPECTS} onChange={(aspectRatio) => onChange({ aspectRatio })} />
      </Row>
    );
  }
  if (type === "split") {
    options.push(
      <Row key="side" label="Görsel">
        <Choice value={block.variant ?? "left"} options={SPLIT_SIDES} onChange={(variant) => onChange({ variant })} />
      </Row>
    );
  }
  if (type === "callout") {
    options.push(
      <Row key="variant" label="Tür">
        <Choice value={block.variant ?? "note"} options={CALLOUT_VARIANTS} onChange={(variant) => onChange({ variant })} />
      </Row>
    );
  }
  if (type === "mockup") {
    options.push(
      <Row key="device" label="Cihaz">
        <Choice value={block.variant ?? "phone"} options={MOCKUP_VARIANTS} onChange={(variant) => onChange({ variant })} />
      </Row>
    );
  }
  if (type === "video") {
    options.push(
      <Row key="loop" label="Oynatma">
        <Choice
          value={Boolean(block.videoLoop)}
          options={[{ value: false, label: "Oynatıcı" }, { value: true, label: "Döngü" }]}
          onChange={(videoLoop) => onChange({ videoLoop })}
        />
      </Row>
    );
  }
  if (type === "table") {
    const rows = block.tableRows ?? [];
    const columnCount = Math.max(1, ...rows.map((r) => r.cells.length));
    const fit = (cells: string[], n: number) => [...cells.slice(0, n), ...Array<string>(Math.max(0, n - cells.length)).fill("")];
    const setColumns = (n: number) =>
      onChange({ tableRows: rows.map((r) => ({ ...r, cells: fit(r.cells, n), ...(r.cellsEn ? { cellsEn: fit(r.cellsEn, n) } : {}) })) });
    // More rows are added empty at the end; fewer drop the last ones.
    const setRows = (n: number) =>
      onChange({
        tableRows: n <= rows.length
          ? rows.slice(0, n)
          : [...rows, ...Array.from({ length: n - rows.length }, () => ({ id: editorUid("row"), cells: Array<string>(columnCount).fill("") }))],
      });
    options.push(
      <Row key="header" label="İlk satır">
        <Choice
          value={block.tableHeader !== false}
          options={[{ value: true, label: "Başlık" }, { value: false, label: "Normal" }]}
          onChange={(tableHeader) => onChange({ tableHeader })}
        />
      </Row>,
      <Row key="cols" label="Sütunlar">
        <NumberField label="Sütun sayısı" prefix={Glyphs.columns} value={columnCount} min={1} max={6} onChange={setColumns} />
      </Row>,
      <Row key="rows" label="Satırlar">
        <NumberField label="Satır sayısı" prefix={Glyphs.rows} value={rows.length} min={1} max={50} onChange={setRows} />
      </Row>
    );
  }

  // ── The block's own image / video ──
  const media: ReactNode[] = [];
  if (type === "image" || type === "split" || type === "persona") {
    media.push(
      <ImageSource
        key="src"
        src={block.src}
        alt={en ? block.altEn : block.alt}
        onSrc={(src) => onChange({ src })}
        onAlt={type === "persona" ? undefined : (alt) => onChange(en ? { altEn: alt } : { alt })}
        uploadId={block.id}
        projectSlug={projectSlug}
      />
    );
  }
  if (type === "video") {
    media.push(
      <TextField key="src" label="Video adresi" type="url" value={block.src ?? ""} onChange={(src) => onChange({ src })} placeholder="YouTube, Vimeo ya da .mp4 / .webm adresi" />
    );
  }

  const spec = specOf(block);

  return (
    <div className="flex flex-col">
      {(options.length > 0 || properties) && <Group title="Özellikler">{options}{properties}</Group>}
      {media.length > 0 && <Group title={type === "video" ? "Video" : "Görsel"}>{media}</Group>}
      {spec && (
        <Group
          title={plural(spec.noun)}
          actions={type !== "compare" && (
            <SquareButton
              label={`${spec.noun} ekle`}
              onClick={() => {
                const { patch, id } = addEntry(block);
                onChange(patch);
                onSelectEntry(id);
              }}
            >
              {Glyphs.plus}
            </SquareButton>
          )}
        >
          <ItemList block={block} lang={lang} onSelect={onSelectEntry} />
        </Group>
      )}
    </div>
  );
}

// ── Layout: sections and Bloks ────────────────────────────────────────────────

/** Figma's alignment glyph: three bars, lined up at the top / middle / bottom. */
function AlignBars({ vertical, faint = false }: { vertical: GridAlign; faint?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex gap-[2px] h-3",
        vertical === "start" ? "items-start" : vertical === "center" ? "items-center" : "items-end",
        faint ? "text-[var(--text-subtitle)] opacity-60" : "text-[var(--edit-accent)]"
      )}
    >
      {[8, 12, 6].map((h, i) => (
        <span key={i} className="w-[2px] rounded-full bg-current" style={{ height: h }} />
      ))}
    </span>
  );
}

const ALIGNS: GridAlign[] = ["start", "center", "end"];
const V_NAMES: Record<GridAlign, string> = { start: "Üst", center: "Orta", end: "Alt" };
const H_NAMES: Record<GridAlign, string> = { start: "sol", center: "orta", end: "sağ" };

/** Stacked content in the box: three lines, lined up left / centre / right (Figma's glyph for a vertical auto layout). */
function StackBars({ across, faint = false }: { across: GridAlign; faint?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex flex-col gap-[2px] w-3",
        across === "start" ? "items-start" : across === "center" ? "items-center" : "items-end",
        faint ? "text-[var(--text-subtitle)] opacity-60" : "text-[var(--edit-accent)]"
      )}
    >
      {[8, 12, 6].map((w, i) => (
        <span key={i} className="h-[2px] rounded-full bg-current" style={{ width: w }} />
      ))}
    </span>
  );
}

/** One child, when the free space is shared out (Figma's "Auto" gap): a single line across the flow. */
const JUSTIFY: Record<GridAlign, string> = { start: "justify-start", center: "justify-center", end: "justify-end" };
const ITEMS: Record<GridAlign, string> = { start: "items-start", center: "items-center", end: "items-end" };

function SpreadBar({ flow, at, faint = false }: { flow: "vertical" | "horizontal"; at: GridAlign; faint?: boolean }) {
  const tone = faint ? "bg-[var(--text-subtitle)] opacity-60" : "bg-[var(--edit-accent)]";
  return flow === "vertical" ? (
    <span aria-hidden className={cn("flex w-3", JUSTIFY[at])}>
      <span className={cn("w-2 h-[2px] rounded-full", tone)} />
    </span>
  ) : (
    <span aria-hidden className={cn("flex h-3", ITEMS[at])}>
      <span className={cn("w-[2px] h-2 rounded-full", tone)} />
    </span>
  );
}

/** With the free space shared out, only the position across the flow counts: its name ("Sola hizala"…). */
const LINE_NAMES: Record<"vertical" | "horizontal", Record<GridAlign, string>> = {
  vertical: { start: "Sola hizala", center: "Yatayda ortala", end: "Sağa hizala" },
  horizontal: { start: "Üste hizala", center: "Dikeyde ortala", end: "Alta hizala" },
};

/**
 * Figma's alignment box: a 3 × 3 grid — rows top / middle / bottom, columns
 * left / center / right — whatever the frame's grid. The chosen cell shows
 * the content's glyph (stacked: lines; side by side or on a grid: bars), the
 * others a dot — the glyph on hover. With the free space shared out
 * (`spread`), only the position across the flow counts: the whole line along
 * it shows, one mark per cell.
 */
function AlignGrid({ x, y, flow = "grid", spread = false, onChange, className }: {
  x: GridAlign;
  y: GridAlign;
  flow?: LayoutFlow;
  spread?: boolean;
  onChange: (value: { x: GridAlign; y: GridAlign }) => void;
  className?: string;
}) {
  const shared = spread && flow !== "grid";
  const line = flow === "vertical" ? "vertical" : "horizontal";
  // Shared out, hovering a cell previews its whole line (as Figma): the one under the pointer.
  const [hover, setHover] = useState<{ h: GridAlign; v: GridAlign } | null>(null);
  const glyph = (h: GridAlign, v: GridAlign, faint?: boolean) =>
    flow === "vertical" ? <StackBars across={h} faint={faint} /> : <AlignBars vertical={v} faint={faint} />;
  const inLine = (h: GridAlign, v: GridAlign, at: { h: GridAlign; v: GridAlign }) => (line === "vertical" ? h === at.h : v === at.v);
  return (
    <div
      role="radiogroup"
      aria-label="Hizalama"
      onPointerLeave={() => setHover(null)}
      className={cn("grid grid-cols-3 grid-rows-3 p-1 rounded-[6px] bg-[var(--bg-4)]", className)}
    >
      {ALIGNS.map((v) =>
        ALIGNS.map((h) => {
          // Shared out: the whole column (stacked) / row (side by side) at the chosen position across the flow.
          const active = shared ? inLine(h, v, { h: x, v: y }) : v === y && h === x;
          const name = shared ? LINE_NAMES[line][line === "vertical" ? h : v] : `${V_NAMES[v]} ${H_NAMES[h]}`;
          return (
            <button
              key={`${v}-${h}`}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={name}
              title={name}
              onClick={() => onChange({ x: h, y: v })}
              onPointerEnter={() => setHover({ h, v })}
              // The marks inside swap on hover — never let them take the press, or the click is lost.
              className="group/align flex items-center justify-center rounded-[4px] cursor-pointer [&_*]:pointer-events-none"
            >
              {active ? (
                shared ? <SpreadBar flow={line} at={line === "vertical" ? h : v} /> : glyph(h, v)
              ) : shared ? (
                hover && inLine(h, v, hover) ? (
                  <SpreadBar flow={line} at={line === "vertical" ? h : v} faint />
                ) : (
                  <span aria-hidden className="w-[3px] h-[3px] rounded-full bg-[var(--text-subtitle)] opacity-60" />
                )
              ) : (
                <>
                  <span aria-hidden className="w-[3px] h-[3px] rounded-full bg-[var(--text-subtitle)] opacity-60 group-hover/align:hidden" />
                  <span className="hidden group-hover/align:flex">{glyph(h, v, true)}</span>
                </>
              )}
            </button>
          );
        })
      )}
    </div>
  );
}

const FLOWS: { value: LayoutFlow; label: string; icon: ReactNode }[] = [
  { value: "vertical", label: "Dikey — alt alta", icon: Glyphs.flowVertical },
  { value: "horizontal", label: "Yatay — yan yana", icon: Glyphs.flowHorizontal },
  { value: "grid", label: "Izgara — sütun ve satırlar", icon: Glyphs.flowGrid },
];

const TRACK_MODES: { value: SizeMode; label: string }[] = [
  { value: "fixed", label: "Fixed" },
  { value: "fill", label: "Fill" },
  { value: "hug", label: "Hug" },
];

/**
 * The columns or rows of a grid as Figma shows them: a field each — its size
 * now in px; typing or scrubbing a number makes it Fixed — ending in its mode
 * (Fixed · Fill · Hug), as the W / H fields.
 */
function TrackFields({ label, axis, tracks, measured, onChange }: {
  label: string;
  axis: "column" | "row";
  tracks: GridTrack[];
  /** Their sizes on the canvas now (px) */
  measured: number[];
  onChange: (index: number, track: GridTrack) => void;
}) {
  const noun = axis === "column" ? "sütun" : "satır";
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[11px] leading-4 text-[var(--text-subtitle)] select-none">{label}</span>
      <div className="grid grid-cols-3 gap-2">
        {tracks.map((t, i) => {
          const now = Math.round(measured[i] ?? t.px ?? 0);
          const name = t.size === "fill" ? (t.fr && t.fr !== 1 ? `Fill ${t.fr}` : "Fill") : t.size === "hug" ? "Hug" : undefined;
          return (
            <NumberField
              key={i}
              label={`${i + 1}. ${noun}`}
              prefix={<span className="w-3 text-center">{i + 1}</span>}
              value={t.size === "fixed" ? Math.round(t.px ?? now) : null}
              placeholder={name}
              fallback={now}
              min={0}
              max={4000}
              onChange={(px) => onChange(i, { size: "fixed", px })}
              suffix={
                <FieldMenu
                  label={`${i + 1}. ${noun}: Fixed, Fill ya da Hug`}
                  items={TRACK_MODES.map((m) => ({
                    label: m.label,
                    hint: m.value === "fixed" ? `${now} px` : undefined,
                    checked: m.value === t.size,
                    onSelect: () => onChange(i, m.value === "fixed" ? { size: "fixed", px: now } : { size: m.value }),
                  }))}
                />
              }
            />
          );
        })}
      </div>
    </div>
  );
}

/** The sizes (px) a grid's columns and rows have on the canvas now, measured again whenever `revision` changes. */
function useRenderedTracks(selector: string, revision: string) {
  const [tracks, setTracks] = useState<{ columns: number[]; rows: number[] }>({ columns: [], rows: [] });
  useEffect(() => {
    const el = document.querySelector<HTMLElement>(`main ${selector}`);
    if (!el) return;
    const sizes = (template: string) => template.split(" ").map((v) => parseFloat(v)).filter((n) => Number.isFinite(n));
    const measure = () => {
      const style = getComputedStyle(el);
      const next = { columns: sizes(style.gridTemplateColumns), rows: sizes(style.gridTemplateRows) };
      setTracks((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
    };
    const resize = new ResizeObserver(measure);
    resize.observe(el);
    const first = window.setTimeout(measure, 0);
    return () => {
      resize.disconnect();
      window.clearTimeout(first);
    };
  }, [selector, revision]);
  return tracks;
}

/**
 * How a section lays out its Bloks — or a Blok its components, Figma's
 * "Auto layout": stacked, side by side or on a grid, and its W / H. On a grid: the column
 * and row counts, and each column's and row's size (Fixed · Fill · Hug, as
 * Figma's grid). Then the alignment box — where its content sits
 * in it — with the gap(s) beside it (stacked / side by side: one, or Auto —
 * the free space shared out), and the padding inside (px).
 */
/**
 * Spacing that can be bound to size variables (a molecule's frame): what is
 * bound, the variables it can be, and binding one — null unbinds it, keeping
 * the value it had.
 */
interface SpacingBinding {
  bound: Partial<Record<SpacingKey, string>>;
  variables: DesignVariable[];
  onBind: (key: SpacingKey, variableId: string | null) => void;
}

function GridFields({ grid, measure, size, heightModes, onSize, cells, onAlign, onChange, bind, clip }: {
  grid?: GridSettings;
  /** Finds its frame on the canvas, for its W / H and the sizes its columns and rows have now */
  measure: string;
  /** Its own size (W / H), right under the direction — as in Figma's Auto layout; none without `onSize` */
  size?: Sizing;
  heightModes?: SizeMode[];
  onSize?: (size: Sizing) => void;
  /** Its children's cells (layoutCells) */
  cells: Cell[];
  /** Where its content sits in it (the alignment box) */
  onAlign: (justify: GridAlign, align: GridAlign) => void;
  onChange: (grid: GridSettings) => void;
  /** Its gaps and padding can be bound to variables (see SpacingBinding) */
  bind?: SpacingBinding;
  /** Figma's Clip content, under the padding: whether it cuts off what reaches beyond it */
  clip?: { checked: boolean; onChange: (clip: boolean) => void };
}) {
  const columns = gridColumns(grid);
  const count = columns.length;
  // It can't have fewer rows than its children take up now.
  const minRows = Math.max(1, ...cells.map((c) => c.row));
  const rowList = rowTracks(grid);
  const measured = useRenderedTracks(measure, JSON.stringify(grid ?? {}));
  const gaps = gridGaps(grid);
  const setCount = (n: number) => onChange(n <= 1 ? { ...grid, columns: undefined } : withColumnCount(grid, n));
  const flow = gridFlow(grid);
  const across = flow === "horizontal";
  // Stacked / side by side: one gap, along the flow — the column gap side by side, the row gap stacked.
  const gap = across ? gaps.column : gaps.row;
  const setGap = (n: number) => onChange({ ...grid, spread: undefined, ...(across ? { columnGap: n } : { rowGap: n }) });
  const wrapping = across && Boolean(grid?.wrap);
  // Padding per side: on once any side has its own value.
  const sides = [grid?.paddingTop, grid?.paddingRight, grid?.paddingBottom, grid?.paddingLeft];
  const perSide = sides.some((v) => v !== undefined);
  const toggleSides = () =>
    onChange(
      perSide
        ? { ...grid, paddingX: grid?.paddingLeft ?? grid?.paddingX, paddingY: grid?.paddingTop ?? grid?.paddingY, paddingTop: undefined, paddingRight: undefined, paddingBottom: undefined, paddingLeft: undefined }
        : { ...grid, paddingTop: grid?.paddingY ?? 0, paddingBottom: grid?.paddingY ?? 0, paddingLeft: grid?.paddingX ?? 0, paddingRight: grid?.paddingX ?? 0 }
    );
  const side = (key: "paddingTop" | "paddingRight" | "paddingBottom" | "paddingLeft", pair: "paddingX" | "paddingY") => grid?.[key] ?? grid?.[pair] ?? 0;
  const bindById = new Map((bind?.variables ?? []).map((v) => [v.id, v]));
  /**
   * A gap or padding field — with `bind`, bindable to a size variable as in
   * Figma (see Bindable): the variable mark on hover, the variable's pill
   * once bound. `extra`: the field's own control at its end (Auto / fixed).
   */
  const spacing = (key: SpacingKey, field: Parameters<typeof NumberField>[0], extra?: ReactNode) => {
    if (!bind) return <NumberField {...field} suffix={extra} />;
    const boundId = bind.bound[key];
    return (
      <Bindable
        kind="number"
        value={boundId ? { alias: boundId } : { value: field.value ?? 0 }}
        targets={bind.variables}
        byId={bindById}
        mode="light"
        prefix={field.prefix}
        onChange={(value) => bind.onBind(key, "alias" in value ? value.alias : null)}
      >
        {(mark) => <NumberField {...field} suffix={<span className="flex items-center gap-1">{mark}{extra}</span>} />}
      </Bindable>
    );
  };

  return (
    <Group title="Yerleşim">
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <Choice value={flow} options={FLOWS} onChange={(next) => onChange({ ...grid, flow: next === "grid" ? undefined : next })} />
        </div>
        <ToggleButton label="Wrap: sığmayan alt satıra geçsin (yan yana)" pressed={wrapping} disabled={!across} onClick={() => onChange({ ...grid, wrap: !grid?.wrap || undefined })}>
          {Glyphs.wrap}
        </ToggleButton>
      </div>
      {onSize && <SizeFields size={size} measure={measure} heightModes={heightModes} onChange={onSize} />}
      {flow === "grid" && (
        <div className="grid grid-cols-2 gap-2">
          <NumberField label="Sütun sayısı" prefix={Glyphs.columns} value={count} min={1} max={MAX_COLUMNS} suffix="sütun" onChange={setCount} />
          <NumberField
            label="Satır sayısı"
            prefix={Glyphs.rows}
            value={Math.max(gridRows(grid), minRows)}
            min={minRows}
            max={Math.max(MAX_ROWS, minRows)}
            suffix="satır"
            onChange={(rows) => onChange(withRowCount(grid, rows))}
          />
        </div>
      )}
      {flow === "grid" && (count > 1 || rowList.length > 0) && (
        <>
          {count > 1 && (
            <TrackFields label="Sütunlar" axis="column" tracks={columnTracks(grid)} measured={measured.columns} onChange={(i, track) => onChange(withTrack(grid, "column", i, track))} />
          )}
          {rowList.length > 0 && (
            <TrackFields label="Satırlar" axis="row" tracks={rowList} measured={measured.rows} onChange={(i, track) => onChange(withTrack(grid, "row", i, track))} />
          )}
        </>
      )}
      {/* As in Figma's Auto layout: the box on the left, the gaps beside it; the padding under them (px). */}
      <div className="grid grid-cols-2 gap-2">
        <div className="row-span-2">
          <AlignGrid className="h-full min-h-16" x={grid?.justify ?? "start"} y={grid?.align ?? "start"} flow={flow} spread={grid?.spread} onChange={({ x, y }) => onAlign(x, y)} />
        </div>
        {flow === "grid" ? (
          <>
            {spacing("columnGap", { label: "Sütunlar arası boşluk", prefix: Glyphs.gapX, value: gaps.column, min: 0, max: 400, onChange: (columnGap) => onChange({ ...grid, columnGap }) })}
            {spacing("rowGap", { label: "Satırlar arası boşluk", prefix: Glyphs.gapY, value: gaps.row, min: 0, max: 400, onChange: (rowGap) => onChange({ ...grid, rowGap }) })}
          </>
        ) : (() => {
          // Auto / fixed: its own menu, past a line at its end — as in Figma.
          const autoItems: MenuItem[] = [
            { label: "Auto", hint: "boşluğu aralarına dağıt", checked: Boolean(grid?.spread), onSelect: () => onChange({ ...grid, spread: true }) },
            { label: "Sabit", hint: `${gap} px`, checked: !grid?.spread, onSelect: () => setGap(gap) },
          ];
          const field = {
            label: "Aradaki boşluk",
            prefix: across ? Glyphs.gapX : Glyphs.gapY,
            value: grid?.spread ? null : gap,
            placeholder: "Auto",
            fallback: gap,
            min: 0,
            max: 400,
            onChange: setGap,
          };
          return spacing(
            across ? "columnGap" : "rowGap",
            field,
            <span className="flex items-center h-4 pl-1 border-l border-[var(--border-hover)]">
              <FieldMenu label="Aradaki boşluk: Auto ya da sabit" items={autoItems} />
            </span>
          );
        })()}
        {/* Wrapping: the gap between the lines. */}
        {wrapping && spacing("rowGap", { label: "Satırlar arası boşluk", prefix: Glyphs.gapY, value: gaps.row, min: 0, max: 400, onChange: (rowGap) => onChange({ ...grid, rowGap }) })}
      </div>
      <div className="flex items-start gap-2">
        <div className="grid grid-cols-2 gap-2 flex-1 min-w-0">
          {perSide ? (
            <>
              {spacing("paddingLeft", { label: "Soldaki iç boşluk", prefix: "S", value: side("paddingLeft", "paddingX"), min: 0, max: 400, onChange: (paddingLeft) => onChange({ ...grid, paddingLeft }) })}
              {spacing("paddingTop", { label: "Üstteki iç boşluk", prefix: "Ü", value: side("paddingTop", "paddingY"), min: 0, max: 400, onChange: (paddingTop) => onChange({ ...grid, paddingTop }) })}
              {spacing("paddingRight", { label: "Sağdaki iç boşluk", prefix: "Sğ", value: side("paddingRight", "paddingX"), min: 0, max: 400, onChange: (paddingRight) => onChange({ ...grid, paddingRight }) })}
              {spacing("paddingBottom", { label: "Alttaki iç boşluk", prefix: "A", value: side("paddingBottom", "paddingY"), min: 0, max: 400, onChange: (paddingBottom) => onChange({ ...grid, paddingBottom }) })}
            </>
          ) : (
            <>
              {spacing("paddingX", { label: "Yatay iç boşluk", prefix: Glyphs.padX, value: grid?.paddingX ?? 0, min: 0, max: 400, onChange: (paddingX) => onChange({ ...grid, paddingX }) })}
              {spacing("paddingY", { label: "Dikey iç boşluk", prefix: Glyphs.padY, value: grid?.paddingY ?? 0, min: 0, max: 400, onChange: (paddingY) => onChange({ ...grid, paddingY }) })}
            </>
          )}
        </div>
        <ToggleButton label="İç boşluğu her kenar için ayrı ver" pressed={perSide} onClick={toggleSides}>
          {Glyphs.padSides}
        </ToggleButton>
      </div>
      {clip && <CheckRow label="İçeriği kırp" checked={clip.checked} onChange={clip.onChange} />}
    </Group>
  );
}

/** Figma's checkbox with its label (Clip content). */
function CheckRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 h-7 w-fit cursor-pointer select-none">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span
        aria-hidden
        className="flex items-center justify-center w-4 h-4 rounded-[4px] border border-[var(--border-hover)] text-[var(--bg-1)] peer-checked:bg-[var(--text-title)] peer-checked:border-[var(--text-title)] peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--edit-accent)] transition-colors"
      >
        {checked && (
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
            <path d="M2.5 6.5l2.3 2.2L9.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
      <span className="text-[12px] text-[var(--text-title)]">{label}</span>
    </label>
  );
}

// ── Size (Figma's W / H with Fixed · Fill · Hug) ──────────────────────────────

/** Figma's resizing modes: `label` in the menu, `name` at the end of the field (none for Fixed). */
const SIZE_MODES: Record<"width" | "height", { value: SizeMode; label: string; name: string }[]> = {
  width: [
    { value: "fixed", label: "Fixed width", name: "Fixed" },
    { value: "hug", label: "Hug Content", name: "Hug" },
    { value: "fill", label: "Fill Container", name: "Fill" },
  ],
  height: [
    { value: "fixed", label: "Fixed height", name: "Fixed" },
    { value: "hug", label: "Hug Content", name: "Hug" },
    { value: "fill", label: "Fill Container", name: "Fill" },
  ],
};

/**
 * An element's rendered size on the canvas (px), kept up to date — measured
 * again whenever `revision` changes (e.g. its size settings).
 */
function useRenderedSize(selector: string, revision: string) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = document.querySelector(`main ${selector}`);
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setSize((prev) => (prev.width === Math.round(r.width) && prev.height === Math.round(r.height) ? prev : { width: Math.round(r.width), height: Math.round(r.height) }));
    };
    const resize = new ResizeObserver(measure);
    resize.observe(el);
    // Once right away too (a page in the background gets no resize callbacks).
    const first = window.setTimeout(measure, 0);
    return () => {
      resize.disconnect();
      window.clearTimeout(first);
    };
  }, [selector, revision]);
  return size;
}

const MENU_WIDTH = 188;

/**
 * A popover fixed to the screen under what opened it — the panel's edges
 * never clip it. It lives inside `box` (with what opens it): a click outside
 * the box, or a scroll outside it, closes it.
 */
function usePopover(width: number) {
  const [at, setAt] = useState<{ top: number; left: number } | null>(null);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!at) return;
    const close = (e: Event) => {
      if (!box.current?.contains(e.target as Node)) setAt(null);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("scroll", close, true);
    };
  }, [at]);
  /** Opens it under `under` — its right edge with `under`'s, or its left edge with `side` "left" — or closes it. */
  const toggle = (under: Element, side: "left" | "right" = "right") => {
    const r = under.getBoundingClientRect();
    const left = side === "left" ? r.left : r.right - width;
    setAt((open) => (open ? null : { top: r.bottom + 6, left: Math.min(Math.max(8, left), window.innerWidth - width - 8) }));
  };
  return { at, box, toggle, close: () => setAt(null) };
}

/** A choice in a FieldMenu: `divided` puts a line above it. */
export type MenuItem = { label: string; hint?: string; checked?: boolean; disabled?: boolean; divided?: boolean; onSelect: () => void };

/**
 * A small menu at the end of a field: its trigger (`children` and a chevron)
 * opens a list of choices (see usePopover); it closes on a choice too.
 */
function FieldMenu({ label, items, children }: {
  label: string;
  items: MenuItem[];
  children?: ReactNode;
}) {
  const { at, box, toggle, close } = usePopover(MENU_WIDTH);
  return (
    <div ref={box} className="relative flex shrink-0 items-center">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={Boolean(at)}
        aria-label={label}
        title={label}
        onClick={(e) => toggle(e.currentTarget)}
        className="flex items-center gap-1 h-6 pl-1.5 pr-1 -mr-1 rounded-[4px] text-[12px] text-[var(--text-title)] hover:bg-[var(--bg-5)] transition-colors cursor-pointer"
      >
        {children}
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden className="text-[var(--text-subtitle)]">
          <path d="M2.5 4l2.5 2.5L7.5 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {at && <MenuList at={at} width={MENU_WIDTH} items={items} onClose={close} />}
    </div>
  );
}

/** A menu's list of choices (see usePopover): each ticked when chosen; a choice closes it. */
function MenuList({ at, width, items, onClose }: { at: { top: number; left: number }; width: number; items: MenuItem[]; onClose: () => void }) {
  return (
    <div
      role="menu"
      style={{ top: at.top, left: at.left, width, maxHeight: `calc(100vh - ${at.top + 8}px)` }}
      className="fixed z-50 p-1 overflow-y-auto overscroll-contain rounded-[8px] border border-[var(--border)] bg-[var(--bg-1)] shadow-[0_12px_32px_rgba(0,0,0,0.12)]"
    >
      {items.map((item) => (
        <div key={item.label} className={cn(item.divided && "mt-1 pt-1 border-t border-[var(--border)]")}>
          <button
            type="button"
            role="menuitemradio"
            aria-checked={Boolean(item.checked)}
            disabled={item.disabled}
            onClick={() => {
              item.onSelect();
              onClose();
            }}
            className="flex items-center gap-2 w-full h-8 px-2 rounded-[6px] text-left hover:bg-[var(--bg-4)] disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
          >
            <span className="w-3 shrink-0 text-[var(--text-title)]">
              {item.checked && (
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
                  <path d="M2.5 6.5l2.3 2.2L9.5 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </span>
            <span className="shrink-0 text-[12px] font-medium text-[var(--text-title)]">{item.label}</span>
            {item.hint && <span className="min-w-0 truncate text-[11px] text-[var(--text-subtitle)]">{item.hint}</span>}
          </button>
        </div>
      ))}
    </div>
  );
}

/**
 * The inspector's header, as Figma's: the selection's kind — its icon and
 * name, and under the chevron a menu (the layers holding it, where to go
 * from it) — and what can be done with it, as icons on the right.
 */
export function InspectorHeader({ icon, tone, title, menu = [], actions }: {
  icon?: ReactNode;
  /** The icon's colour (its level's, a component's purple…) */
  tone?: string;
  title: string;
  menu?: MenuItem[];
  actions?: ReactNode;
}) {
  const { at, box, toggle, close } = usePopover(220);
  return (
    <div className="shrink-0 flex items-center justify-between gap-2 h-12 pl-2.5 pr-2 border-b border-[var(--border)]">
      <div ref={box} className="relative flex min-w-0 items-center">
        <button
          type="button"
          aria-haspopup={menu.length > 0 ? "menu" : undefined}
          aria-expanded={menu.length > 0 ? Boolean(at) : undefined}
          disabled={menu.length === 0}
          onClick={(e) => toggle(e.currentTarget, "left")}
          className="flex min-w-0 items-center gap-1.5 h-8 px-1.5 rounded-[6px] enabled:hover:bg-[var(--bg-4)] enabled:cursor-pointer transition-colors"
        >
          {icon && <span className="flex shrink-0 items-center [&_svg]:w-3.5 [&_svg]:h-3.5" style={{ color: tone }}>{icon}</span>}
          <span className="min-w-0 truncate text-[13px] font-semibold leading-4 text-[var(--text-title)] select-none">{title}</span>
          {menu.length > 0 && (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden className="shrink-0 text-[var(--text-subtitle)]">
              <path d="M2.5 4l2.5 2.5L7.5 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>
        {at && <MenuList at={at} width={220} items={menu} onClose={close} />}
      </div>
      {actions && <div className="flex items-center gap-0.5 shrink-0">{actions}</div>}
    </div>
  );
}

/**
 * The mode of one axis, at the end of its field ("Fill ⌄") — Fixed shows no
 * word, the number says it all. Under the modes, as in Figma: add (or
 * remove) its min / max — only then do those fields show.
 */
function SizeModeMenu({ axis, mode, modes, min, max, onChange, onAddLimit, onRemoveLimit }: {
  axis: "width" | "height";
  mode: SizeMode;
  /** The modes it offers (all three unless set) */
  modes?: SizeMode[];
  min?: number;
  max?: number;
  onChange: (mode: SizeMode) => void;
  onAddLimit: (limit: "min" | "max") => void;
  onRemoveLimit: (limit: "min" | "max") => void;
}) {
  const current = SIZE_MODES[axis].find((m) => m.value === mode);
  const noun = axis === "width" ? "width" : "height";
  return (
    <FieldMenu
      label={`${axis === "width" ? "Genişlik" : "Yükseklik"}: ${current?.label}`}
      items={[
        ...SIZE_MODES[axis].filter((m) => !modes || modes.includes(m.value)).map((m) => ({ label: m.label, checked: m.value === mode, onSelect: () => onChange(m.value) })),
        min === undefined
          ? { label: `Add min ${noun}`, divided: true, onSelect: () => onAddLimit("min") }
          : { label: `Remove min ${noun}`, divided: true, onSelect: () => onRemoveLimit("min") },
        max === undefined
          ? { label: `Add max ${noun}`, onSelect: () => onAddLimit("max") }
          : { label: `Remove max ${noun}`, onSelect: () => onRemoveLimit("max") },
      ]}
    >
      {mode !== "fixed" && current?.name}
    </FieldMenu>
  );
}

/** A limit (Min W, Max H…), shown once added; its menu takes the current size or removes it. */
function LimitField({ label, placeholder, name, icon, value, current, onChange }: {
  label: string;
  placeholder: string;
  /** "min width"… */
  name: string;
  icon: ReactNode;
  value?: number;
  /** The size it has on the page now */
  current: number;
  onChange: (value: number | undefined) => void;
}) {
  return (
    <NumberField
      label={label}
      prefix={icon}
      value={value ?? null}
      placeholder={placeholder}
      fallback={current}
      min={1}
      max={4000}
      onChange={onChange}
      onClear={() => onChange(undefined)}
      suffix={
        <FieldMenu
          label={`${label} seçenekleri`}
          items={[
            { label: "Set to current", hint: `${current}`, onSelect: () => onChange(current) },
            { label: `Remove ${name}`, onSelect: () => onChange(undefined) },
          ]}
        />
      }
    />
  );
}

/**
 * Figma's W / H: each axis a number field — the size it has on the page now
 * (typing or scrubbing a number makes it Fixed) — ending in its mode: Fixed,
 * Fill (the cell / the row's height) or Hug (its content). `measure` finds
 * its element on the canvas.
 */
/** Figma's Layout section (a layer without auto layout): its W / H — and, for a frame, Clip content. */
export function SizeGroup({ clip, ...props }: SizeFieldsProps & { clip?: { checked: boolean; onChange: (clip: boolean) => void } }) {
  return (
    <Group title="Yerleşim">
      <SizeFields {...props} />
      {clip && <CheckRow label="İçeriği kırp" checked={clip.checked} onChange={clip.onChange} />}
    </Group>
  );
}

type SizeFieldsProps = {
  size?: Sizing;
  measure: string;
  /** The width / height modes it offers (all three unless set) — a section or the page has no frame around it to fill down */
  widthModes?: SizeMode[];
  heightModes?: SizeMode[];
  onChange: (size: Sizing) => void;
};

/** The W / H fields (see SizeGroup) — in a frame's Yerleşim, as in Figma's Auto layout. */
function SizeFields({ size, measure, widthModes, heightModes, onChange }: SizeFieldsProps) {
  const rendered = useRenderedSize(measure, JSON.stringify(size ?? {}));
  const width = size?.width ?? "fill";
  const height = size?.height ?? "hug";
  const shownWidth = width === "fixed" && size?.widthPx ? size.widthPx : rendered.width;
  const shownHeight = height === "fixed" && size?.heightPx ? size.heightPx : rendered.height;

  return (
    <div className="grid grid-cols-2 gap-2">
      <NumberField
        label="Genişlik"
        prefix="W"
        value={shownWidth}
        min={16}
        max={4000}
        onChange={(widthPx) => onChange({ ...size, width: "fixed", widthPx })}
        suffix={
          <SizeModeMenu
            axis="width"
            mode={width}
            modes={widthModes}
            min={size?.minWidthPx}
            max={size?.maxWidthPx}
            onChange={(mode) => onChange({ ...size, width: mode, ...(mode === "fixed" ? { widthPx: size?.widthPx ?? rendered.width } : {}) })}
            onAddLimit={(limit) => onChange({ ...size, [limit === "min" ? "minWidthPx" : "maxWidthPx"]: rendered.width })}
            onRemoveLimit={(limit) => onChange({ ...size, [limit === "min" ? "minWidthPx" : "maxWidthPx"]: undefined })}
          />
        }
      />
      <NumberField
        label="Yükseklik"
        prefix="H"
        value={shownHeight}
        min={16}
        max={4000}
        onChange={(heightPx) => onChange({ ...size, height: "fixed", heightPx })}
        suffix={
          <SizeModeMenu
            axis="height"
            mode={height}
            modes={heightModes}
            min={size?.minHeightPx}
            max={size?.maxHeightPx}
            onChange={(mode) => onChange({ ...size, height: mode, ...(mode === "fixed" ? { heightPx: size?.heightPx ?? rendered.height } : {}) })}
            onAddLimit={(limit) => onChange({ ...size, [limit === "min" ? "minHeightPx" : "maxHeightPx"]: rendered.height })}
            onRemoveLimit={(limit) => onChange({ ...size, [limit === "min" ? "minHeightPx" : "maxHeightPx"]: undefined })}
          />
        }
      />
      {/* Limits show once added (from the W / H menus): mins on one line, maxes on the next — width left, height right. */}
      {(size?.minWidthPx !== undefined || size?.minHeightPx !== undefined) && (
        <>
          {size?.minWidthPx !== undefined ? (
            <LimitField label="En az genişlik" placeholder="Min W" name="min width" icon={Glyphs.minWidth} value={size.minWidthPx} current={rendered.width} onChange={(minWidthPx) => onChange({ ...size, minWidthPx })} />
          ) : <span />}
          {size?.minHeightPx !== undefined ? (
            <LimitField label="En az yükseklik" placeholder="Min H" name="min height" icon={Glyphs.minHeight} value={size.minHeightPx} current={rendered.height} onChange={(minHeightPx) => onChange({ ...size, minHeightPx })} />
          ) : <span />}
        </>
      )}
      {(size?.maxWidthPx !== undefined || size?.maxHeightPx !== undefined) && (
        <>
          {size?.maxWidthPx !== undefined ? (
            <LimitField label="En çok genişlik" placeholder="Max W" name="max width" icon={Glyphs.maxWidth} value={size.maxWidthPx} current={rendered.width} onChange={(maxWidthPx) => onChange({ ...size, maxWidthPx })} />
          ) : <span />}
          {size?.maxHeightPx !== undefined ? (
            <LimitField label="En çok yükseklik" placeholder="Max H" name="max height" icon={Glyphs.maxHeight} value={size.maxHeightPx} current={rendered.height} onChange={(maxHeightPx) => onChange({ ...size, maxHeightPx })} />
          ) : <span />}
        </>
      )}
    </div>
  );
}

/** A child in a section's or Blok's list, as a layer row: its icon (in its colour), name and a preview. */
function ChildRow({ icon, tone, label, detail, onClick }: { icon: ReactNode; tone: string; label: string; detail?: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group/item flex items-center gap-2 w-[calc(100%+16px)] h-8 -mx-2 px-2 rounded-[6px] text-left hover:bg-[var(--bg-4)] transition-colors cursor-pointer"
    >
      <span className="flex items-center justify-center w-4 h-4 shrink-0 [&_svg]:w-3.5 [&_svg]:h-3.5" style={{ color: tone }}>{icon}</span>
      <span className="shrink-0 text-[12px] font-medium text-[var(--text-title)]">{label}</span>
      <span className="min-w-0 flex-1 truncate text-[11px] text-[var(--text-subtitle)]">{detail}</span>
      <span className="shrink-0 text-[var(--text-subtitle)] opacity-0 group-hover/item:opacity-100 transition-opacity">{Glyphs.chevron}</span>
    </button>
  );
}

/** A component's icon, from the catalog. */
const blockIcon = (type: BlockType) => BLOCK_DEFS.find((d) => d.type === type)?.icon;

/** Where `children` sit on their grid. */
const cellsOf = (children: { span?: number; row?: number; col?: number }[], grid?: GridSettings) =>
  layoutCells(children, gridColumns(grid).length, gridRows(grid));

/** Figma's Clip content, for a frame's look. */
const clipOf = (look: FrameLook | undefined, onChange: (look: FrameLook) => void) => ({
  checked: Boolean(look?.clip),
  onChange: (clip: boolean) => onChange({ ...look, clip: clip || undefined }),
});

/** A Bölüm, as Figma's frame: its Yerleşim — the auto layout its Bloks sit in, its W / H, Clip content — then its look. */
export function SectionInspector({ section, variables, onChange, onAlign }: {
  section: PageSection;
  variables: DesignVariable[];
  onChange: (patch: { grid?: GridSettings; size?: Sizing; look?: FrameLook }) => void;
  /** Where its content sits in it (the alignment box) */
  onAlign: (justify: GridAlign, align: GridAlign) => void;
}) {
  const setLook = (look: FrameLook) => onChange({ look });
  return (
    <div className="flex flex-col">
      <GridFields
        grid={section.grid}
        measure={`[data-section-id="${section.id}"] > [data-section-frame]`}
        size={section.size}
        heightModes={["fixed", "hug"]}
        onSize={(size) => onChange({ size })}
        cells={cellsOf(section.groups, section.grid)}
        onAlign={onAlign}
        onChange={(grid) => onChange({ grid })}
        clip={clipOf(section.look, setLook)}
      />
      <LookFields look={section.look} variables={variables} onChange={setLook} />
    </div>
  );
}

/** A Blok, as Figma's frame: its Yerleşim — the auto layout its components sit in, its W / H, Clip content — then its look. */
export function GroupInspector({ group, variables, onChange, onAlign }: {
  group: PageGroup;
  variables: DesignVariable[];
  onChange: (patch: { grid?: GridSettings; size?: Sizing; look?: FrameLook }) => void;
  /** Where its content sits in it (the alignment box) */
  onAlign: (justify: GridAlign, align: GridAlign) => void;
}) {
  const setLook = (look: FrameLook) => onChange({ look });
  return (
    <div className="flex flex-col">
      <GridFields
        grid={group.grid}
        measure={`[data-group-id="${group.id}"]`}
        size={group.size}
        onSize={(size) => onChange({ size })}
        cells={cellsOf(group.blocks, group.grid)}
        onAlign={onAlign}
        onChange={(grid) => onChange({ grid })}
        clip={clipOf(group.look, setLook)}
      />
      <LookFields look={group.look} variables={variables} onChange={setLook} />
    </div>
  );
}

// ── Main components and molecules (see ComponentDesign, DesignMolecule) ───────

/**
 * A molecule's frame: its Yerleşim — spacing bindable to variables, Clip
 * content — and its look (see LookFields); with `onSize`, an instance's
 * W / H in its component.
 */
function MoleculeFrameFields({ molecule, variables, measure, size, onSize, onChange }: {
  molecule: DesignMolecule;
  variables: DesignVariable[];
  /** Finds an instance on the canvas (see GridFields) */
  measure: string;
  size?: Sizing;
  onSize?: (size: Sizing) => void;
  onChange: (molecule: DesignMolecule) => void;
}) {
  const byId = new Map(variables.map((v) => [v.id, v]));
  const layout = moleculeLayout(molecule, byId);
  const sizes = variables.filter((v) => v.kind === "number");
  const setLayout = (next: GridSettings) => onChange({ ...molecule, layout: next });
  const setLook = (look: FrameLook) => onChange({ ...molecule, ...look });
  const bind = (key: SpacingKey, variableId: string | null) => {
    const spacing = { ...molecule.spacing };
    if (variableId) spacing[key] = variableId;
    else delete spacing[key];
    // Bound, a gap is a fixed one (not Auto); unbound, it keeps the value it had.
    const gap = key === "columnGap" || key === "rowGap";
    onChange({ ...molecule, spacing, layout: variableId ? { ...molecule.layout, ...(gap ? { spread: undefined } : {}) } : { ...molecule.layout, [key]: layout[key] } });
  };
  return (
    <>
      <GridFields
        grid={layout}
        measure={measure}
        size={size}
        onSize={onSize}
        cells={cellsOf(molecule.slots.map(() => ({})), layout)}
        onAlign={(justify, align) => setLayout({ ...layout, justify, align })}
        onChange={setLayout}
        bind={{ bound: molecule.spacing ?? {}, variables: sizes, onBind: bind }}
        clip={clipOf(molecule, setLook)}
      />
      <LookFields look={molecule} variables={variables} onChange={setLook} />
    </>
  );
}

/**
 * A component laid out by its main component, as Figma's instance of a
 * frame with auto layout: the main component's Yerleşim — how it lays out
 * its items — with this one's W / H.
 */
export function ComponentLayoutGroup({ block, design, onChange, onSize, onLook }: {
  block: Block;
  design: ResolvedDesign;
  /** Changes the main component's layout — every instance */
  onChange: (layout: GridSettings) => void;
  /** Changes this one's size */
  onSize: (size: Sizing) => void;
  /** Changes this one's look (its Clip content) */
  onLook: (look: FrameLook) => void;
}) {
  return (
    <GridFields
      grid={design.layout}
      measure={`[data-block-id="${block.id}"] [data-component-frame]`}
      size={block.size}
      onSize={onSize}
      cells={cellsOf(itemsOf(block).map(() => ({})), design.layout)}
      onAlign={(justify, align) => onChange({ ...design.layout, justify, align })}
      onChange={onChange}
      clip={clipOf(block.look, onLook)}
    />
  );
}

/**
 * The molecule a component's items are, as Figma's instance swap property —
 * a row of its properties: swapped from the menu, opened with the arrow.
 */
export function MoleculeProperty({ molecule, molecules, onMolecule, onOpenMolecule }: {
  molecule: DesignMolecule;
  /** The molecules its items can be */
  molecules: DesignMolecule[];
  onMolecule: (id: string) => void;
  onOpenMolecule: (id: string) => void;
}) {
  return (
    <Row label="Molekül">
      <div className="flex w-full min-w-0 items-center gap-1">
        <div className={cn("flex flex-1 min-w-0 items-center gap-2 px-2", FIELD)}>
          <span className="shrink-0 text-[var(--edit-molecule)]">{Glyphs.instance}</span>
          <span className="min-w-0 flex-1 truncate text-[12px] text-[var(--text-title)]">{molecule.name}</span>
          <FieldMenu
            label="Molekülü değiştir"
            items={molecules.map((m) => ({ label: m.name, hint: m.slots.map((slot) => slot.name).join(" + "), checked: m.id === molecule.id, onSelect: () => onMolecule(m.id) }))}
          />
        </div>
        <SquareButton label="Moleküle git" onClick={() => onOpenMolecule(molecule.id)}>{Glyphs.goTo}</SquareButton>
      </div>
    </Row>
  );
}

/**
 * An item of such a component — an instance of its molecule: the molecule's
 * frame and look (the same in all of its instances, everywhere) with the
 * item's W / H in the component (the same for all of its items).
 */
export function ItemLayoutGroup({ block, itemId, design, variables, onSize, onMolecule }: {
  block: Block;
  itemId: string;
  design: ResolvedDesign;
  variables: DesignVariable[];
  onSize: (size: Sizing) => void;
  onMolecule: (molecule: DesignMolecule) => void;
}) {
  return (
    <MoleculeFrameFields
      molecule={design.item.molecule}
      variables={variables}
      measure={`[data-block-id="${block.id}"] [data-entry-id="${itemId}"]`}
      size={design.item.size}
      onSize={onSize}
      onChange={onMolecule}
    />
  );
}

/** A slot's atom: its sample, name and size — swapped from the menu. */
function AtomPicker({ slot, atoms, byId, onChange }: {
  slot: MoleculeSlot;
  atoms: DesignAtom[];
  byId: Map<string, DesignVariable>;
  onChange: (atomId: string) => void;
}) {
  const atom = atoms.find((a) => a.id === slot.atom);
  return (
    <div className={cn("flex w-full min-w-0 items-center gap-2 px-2", FIELD)}>
      {atom && <AtomSample atomId={atom.id} />}
      <span className="min-w-0 flex-1 truncate text-[12px] text-[var(--text-title)]">{atom?.name ?? "Atomu yok"}</span>
      {atom && <span className="shrink-0 text-[11px] tabular-nums text-[var(--text-subtitle)]">{atomMetrics(atom, byId)}</span>}
      <FieldMenu
        label="Atomu değiştir"
        items={atoms.map((a) => ({ label: a.name, hint: atomMetrics(a, byId), checked: a.id === atom?.id, onSelect: () => onChange(a.id) }))}
      />
    </div>
  );
}

/**
 * A text layer of an item — a slot of its molecule — as Figma's text layer:
 * this item's text (its property), then the slot's Yerleşim (W / H), Görünüş
 * (opacity), Tipografi — the atom giving it its look, swapped from the menu,
 * opened with the arrow — and Dolgu: the atom's colour. All but the text
 * are the same in all of the molecule's instances.
 */
export function TextLayerInspector({ block, itemId, slot, atoms, variables, lang, onSlot, onAtom, onOpenAtom, onChange }: {
  block: Block;
  itemId: string;
  slot: MoleculeSlot;
  /** The site's atoms (the ones it can use) */
  atoms: DesignAtom[];
  /** The site's variables (for the atoms' sizes, the colours) */
  variables: DesignVariable[];
  lang: Lang;
  onSlot: (slot: MoleculeSlot) => void;
  /** Changes its atom (its colour) — every text using it */
  onAtom: (atom: DesignAtom) => void;
  /** Opens the atom in the inspector */
  onOpenAtom: (id: string) => void;
  onChange: (patch: Partial<Block>) => void;
}) {
  const { theme } = useTheme();
  const atom = atoms.find((a) => a.id === slot.atom);
  const byId = new Map(variables.map((v) => [v.id, v]));
  const spec = ENTRY_SPEC[block.type]?.fields.find((f) => f.key === slot.field);
  const entries = block.entries ?? [];
  const entry = entries.find((e) => e.id === itemId);
  const key = (lang === "en" && !spec?.shared ? `${slot.field}En` : slot.field) as keyof BlockEntry;
  return (
    <div className="flex flex-col">
      {spec && entry && (
        <Group title="İçerik">
          <AutoTextarea
            label={spec.label}
            value={(entry[key] as string | undefined) ?? ""}
            placeholder={spec.placeholder}
            onChange={(v) => onChange({ entries: entries.map((e) => (e.id === itemId ? { ...e, [key]: v } : e)) })}
          />
        </Group>
      )}
      <SizeGroup
        size={slot.size}
        measure={`[data-block-id="${block.id}"] [data-entry-id="${itemId}"] [data-text-layer="${slot.field}"]`}
        onChange={(size) => onSlot({ ...slot, size })}
      />
      <Group title="Görünüş">
        <div className="grid grid-cols-2 gap-2">
          <OpacityField value={slot.opacity} onChange={(opacity) => onSlot({ ...slot, opacity })} />
        </div>
      </Group>
      <Group title="Tipografi" actions={atom && <SquareButton label="Atoma git" onClick={() => onOpenAtom(atom.id)}>{Glyphs.goTo}</SquareButton>}>
        <AtomPicker slot={slot} atoms={atoms} byId={byId} onChange={(id) => onSlot({ ...slot, atom: id })} />
      </Group>
      {atom && (
        <PaintGroup
          title="Dolgu"
          paint={{ color: atom.color }}
          create={() => ({ color: atom.color })}
          colors={variables.filter((v) => v.kind === "color")}
          byId={byId}
          mode={theme}
          fixed
          onChange={(paint) => paint && onAtom({ ...atom, color: paint.color })}
        />
      )}
    </div>
  );
}

// ── Design variables (see DesignVariable) ─────────────────────────────────────

const KIND_LABEL: Record<VariableKind, string> = { color: "Renk", number: "Sayı (px)", weight: "Yazı kalınlığı" };
const WEIGHTS = [100, 200, 300, 400, 500, 600, 700, 800, 900].map((w) => ({ value: String(w), label: String(w) }));

/** A colour's swatch in a field. */
function Swatch({ color }: { color: string | number | null }) {
  return <span className="block w-3.5 h-3.5 shrink-0 rounded-[3px] border border-[var(--border-hover)]" style={{ backgroundColor: typeof color === "string" ? color : "transparent" }} />;
}

const PICKER_WIDTH = 240;

/**
 * Figma's variable picker: the variables a value can be bound to, grouped by
 * their names' paths and found by a search — each with its swatch (a colour)
 * or its value; the bound one ticked.
 */
function VariablePicker({ at, variables, byId, mode, selectedId, onPick }: {
  at: { top: number; left: number };
  variables: DesignVariable[];
  byId: Map<string, DesignVariable>;
  mode: ThemeMode;
  selectedId?: string;
  onPick: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLocaleLowerCase("tr");
  // Groups in the order they first appear.
  const groups = new Map<string, DesignVariable[]>();
  for (const v of variables) {
    if (q && !v.name.toLocaleLowerCase("tr").includes(q)) continue;
    const [group] = splitName(v.name);
    groups.set(group, [...(groups.get(group) ?? []), v]);
  }
  return (
    <div
      role="dialog"
      aria-label="Değişkenler"
      style={{ top: at.top, left: at.left, width: PICKER_WIDTH, maxHeight: `min(360px, calc(100vh - ${at.top + 8}px))` }}
      className="fixed z-50 flex flex-col rounded-[8px] border border-[var(--border)] bg-[var(--bg-1)] shadow-[0_12px_32px_rgba(0,0,0,0.12)]"
    >
      <div className="shrink-0 p-2 border-b border-[var(--border)]">
        <input
          autoFocus
          aria-label="Değişken ara"
          placeholder="Ara"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full h-7 px-2 rounded-[6px] bg-[var(--bg-4)] text-[12px] text-[var(--text-title)] placeholder:text-[var(--text-subtitle)] outline-none"
        />
      </div>
      <div className="min-h-0 overflow-y-auto overscroll-contain p-1">
        {[...groups].map(([group, list]) => (
          <div key={group || "—"}>
            {group && <p className="h-6 flex items-center px-2 text-[11px] font-medium text-[var(--text-subtitle)] select-none">{group}</p>}
            {list.map((v) => {
              const value = resolvedValue(v, mode, byId);
              return (
                <button
                  key={v.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={v.id === selectedId}
                  title={v.name}
                  onClick={() => onPick(v.id)}
                  className="flex items-center gap-2 w-full h-7 px-2 rounded-[6px] text-left hover:bg-[var(--bg-4)] transition-colors cursor-pointer"
                >
                  {v.kind === "color" ? <Swatch color={value} /> : <span className="w-3.5 shrink-0 text-center text-[11px] text-[var(--text-subtitle)]">{v.kind === "weight" ? "B" : "#"}</span>}
                  <span className="min-w-0 flex-1 truncate text-[12px] text-[var(--text-title)]">{splitName(v.name)[1] || v.name}</span>
                  {v.kind !== "color" && <span className="shrink-0 text-[11px] tabular-nums text-[var(--text-subtitle)]">{value ?? "—"}</span>}
                  <span className="w-3 shrink-0 text-[var(--text-title)]">
                    {v.id === selectedId && (
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
                        <path d="M2.5 6.5l2.3 2.2L9.5 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        ))}
        {groups.size === 0 && (
          <p className="px-2 py-3 text-[11px] text-[var(--text-subtitle)]">{variables.length ? "Eşleşen değişken yok." : "Bu türde değişken yok."}</p>
        )}
      </div>
    </div>
  );
}

/** A mark at a field's end, shown while the field is hovered (Figma's variable and detach marks) — and while its picker is open. */
function HoverMark({ label, open = false, onClick, children }: { label: string; open?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      data-open={open ? "" : undefined}
      onClick={onClick}
      className="flex shrink-0 items-center justify-center w-5 h-5 -mr-1 rounded-[4px] text-[var(--text-subtitle)] hover:text-[var(--text-title)] hover:bg-[var(--bg-5)] opacity-0 group-hover/field:opacity-100 focus-visible:opacity-100 data-[open]:opacity-100 transition-opacity cursor-pointer"
    >
      {children}
    </button>
  );
}

/**
 * A value that can be bound to a variable, as in Figma. Unbound: the field
 * itself (`children`, given the variable mark for its end — shown on hover,
 * it opens the picker). Bound: its prefix (a colour's swatch), then the
 * variable's name — a number's in a pill — which opens the picker to swap
 * it, and on hover the detach mark: unbound, it keeps the value it had.
 * The whole name and the value show on hover (its title).
 */
function Bindable({ kind, value, targets, byId, mode, prefix, onChange, children }: {
  kind: VariableKind;
  value: VariableValue;
  /** The variables it can be bound to */
  targets: DesignVariable[];
  byId: Map<string, DesignVariable>;
  /** The theme whose value a bound colour shows */
  mode: ThemeMode;
  /** Before a bound number's pill, as before its own value */
  prefix?: ReactNode;
  onChange: (value: VariableValue) => void;
  children: (mark: ReactNode) => ReactNode;
}) {
  const { at, box, toggle, close } = usePopover(PICKER_WIDTH);
  const bound = "alias" in value ? byId.get(value.alias) : undefined;
  const resolved = boundValue(value, mode, byId);
  const open = () => { if (box.current) toggle(box.current); };
  const picker = at && (
    <VariablePicker
      at={at}
      variables={targets}
      byId={byId}
      mode={mode}
      selectedId={bound?.id}
      onPick={(id) => {
        onChange({ alias: id });
        close();
      }}
    />
  );
  if (!("alias" in value)) {
    return (
      <div ref={box} className="relative flex w-full min-w-0 items-center">
        {children(<HoverMark label="Değişken uygula" open={Boolean(at)} onClick={open}>{Glyphs.variable}</HoverMark>)}
        {picker}
      </div>
    );
  }
  return (
    <div ref={box} title={bound ? `${bound.name} · ${resolved ?? "—"}` : undefined} className={cn("relative flex w-full min-w-0 items-center gap-1.5 px-2", FIELD)}>
      {kind === "color" ? <Swatch color={resolved} /> : prefix && <span className="flex shrink-0 items-center text-[11px] leading-none text-[var(--text-subtitle)]">{prefix}</span>}
      <button
        type="button"
        onClick={open}
        aria-label={`${bound?.name ?? "Bulunamayan değişken"} — değiştir`}
        className={cn(
          "min-w-0 truncate text-left text-[12px] text-[var(--text-title)] cursor-pointer",
          kind === "color" ? "flex-1" : "h-5 px-1.5 rounded-[4px] bg-[var(--bg-5)] hover:brightness-95 transition-[filter]"
        )}
      >
        {/* A colour's field has room for its whole name ("Arka plan/4"); a number's pill its own part, as Figma's. */}
        {bound ? (kind === "color" ? bound.name : splitName(bound.name)[1] || bound.name) : "Bulunamadı"}
      </button>
      {kind !== "color" && <span className="flex-1" />}
      <HoverMark label="Bağlantıyı kopar" onClick={() => onChange({ value: resolved ?? "" })}>{Glyphs.detach}</HoverMark>
      {picker}
    </div>
  );
}

/** A colour of its own: its swatch (the system's colour picker) and its value, typed. */
function ColorField({ label, value, suffix, onChange }: { label: string; value: string; suffix?: ReactNode; onChange: (value: string) => void }) {
  return (
    <TextField
      label={label}
      value={value}
      onChange={onChange}
      suffix={suffix}
      prefix={
        <label className="relative block w-3.5 h-3.5 shrink-0 rounded-[3px] border border-[var(--border-hover)] overflow-hidden cursor-pointer" style={{ backgroundColor: value || "transparent" }}>
          <input
            type="color"
            value={/^#[0-9a-f]{6}$/i.test(value) ? value : "#000000"}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 opacity-0 cursor-pointer"
            aria-label="Renk seç"
          />
        </label>
      }
    />
  );
}

/** A value of that kind that can be bound to a variable (see Bindable): a size, a weight or a colour. */
function BoundField({ label, kind, value, targets, byId, mode, prefix, onChange }: {
  label: string;
  kind: VariableKind;
  value: VariableValue;
  targets: DesignVariable[];
  byId: Map<string, DesignVariable>;
  mode: ThemeMode;
  /** A size's prefix ("px" unless set) */
  prefix?: ReactNode;
  onChange: (value: VariableValue) => void;
}) {
  const own = "alias" in value ? null : value.value;
  const sizePrefix = prefix ?? "px";
  return (
    <Bindable kind={kind} value={value} targets={targets} byId={byId} mode={mode} prefix={kind === "number" ? sizePrefix : prefix} onChange={onChange}>
      {(mark) =>
        kind === "number" ? (
          <NumberField label={label} prefix={sizePrefix} value={Number(own) || 0} min={0} max={2000} onChange={(n) => onChange({ value: n })} suffix={mark} />
        ) : kind === "weight" ? (
          <SelectField label={label} value={String(own)} options={WEIGHTS} suffix={mark} onChange={(w) => onChange({ value: Number(w) })} />
        ) : (
          <ColorField label={label} value={String(own ?? "")} suffix={mark} onChange={(v) => onChange({ value: v })} />
        )
      }
    </Bindable>
  );
}

/**
 * Figma's Fill / Stroke section: one paint — its colour a variable's (bound
 * from the header's styles mark, or the field's) or its own — shown or
 * hidden (the eye), removed (minus); "+" adds one when there is none. Under
 * it, `children` (a stroke's own settings).
 */
function PaintGroup<T extends Paint>({ title, paint, create, colors, byId, mode, fixed = false, onChange, children }: {
  title: string;
  paint?: T;
  /** A new one, for "+" */
  create: () => T;
  /** Always there (a text's colour): no eye, no minus */
  fixed?: boolean;
  /** The colour variables it can be bound to */
  colors: DesignVariable[];
  byId: Map<string, DesignVariable>;
  mode: ThemeMode;
  onChange: (paint: T | undefined) => void;
  children?: ReactNode;
}) {
  const { at, box, toggle, close } = usePopover(PICKER_WIDTH);
  return (
    <Group
      title={title}
      muted={!paint}
      actions={
        <div ref={box} className="flex items-center gap-0.5">
          {paint && <SquareButton label="Değişken uygula" onClick={() => { if (box.current) toggle(box.current); }}>{Glyphs.styles}</SquareButton>}
          {!paint && <SquareButton label={`${title} ekle`} onClick={() => onChange(create())}>{Glyphs.plus}</SquareButton>}
          {at && (
            <VariablePicker
              at={at}
              variables={colors}
              byId={byId}
              mode={mode}
              selectedId={paint && "alias" in paint.color ? paint.color.alias : undefined}
              onPick={(id) => {
                onChange({ ...(paint ?? create()), color: { alias: id } });
                close();
              }}
            />
          )}
        </div>
      }
    >
      {paint && (
        <>
          <div className="flex items-center gap-0.5">
            <div className={cn("flex-1 min-w-0 transition-opacity", paint.hidden && "opacity-50")}>
              <BoundField label={title} kind="color" value={paint.color} targets={colors} byId={byId} mode={mode} onChange={(color) => onChange({ ...paint, color })} />
            </div>
            {!fixed && (
              <>
                <SquareButton label={paint.hidden ? "Göster" : "Gizle"} onClick={() => onChange({ ...paint, hidden: paint.hidden ? undefined : true })}>
                  {paint.hidden ? Glyphs.eyeOff : Glyphs.eye}
                </SquareButton>
                <SquareButton label={`${title} kaldır`} onClick={() => onChange(undefined)}>{Glyphs.minus}</SquareButton>
              </>
            )}
          </div>
          {children}
        </>
      )}
    </Group>
  );
}

/** Where a stroke is drawn, as Figma names it. */
const STROKE_ALIGNS: { value: StrokeAlign; label: string }[] = [
  { value: "inside", label: "İçeride" },
  { value: "center", label: "Ortada" },
  { value: "outside", label: "Dışarıda" },
];

/** Figma's opacity field (%). */
function OpacityField({ value, onChange }: { value?: number; onChange: (opacity: number | undefined) => void }) {
  return (
    <NumberField label="Opaklık" prefix={Glyphs.opacity} value={value ?? 100} min={0} max={100} suffix="%" onChange={(n) => onChange(n >= 100 ? undefined : n)} />
  );
}

/**
 * A frame's look (see FrameLook), as Figma's Appearance (opacity, corner
 * radius), Fill and Stroke sections — every frame has them: the page, a
 * Bölüm, a Blok, a component, a molecule. Values bind to variables as
 * everywhere (see Bindable).
 */
export function LookFields({ look, variables, onChange }: {
  look?: FrameLook;
  variables: DesignVariable[];
  onChange: (look: FrameLook) => void;
}) {
  const { theme } = useTheme();
  const byId = new Map(variables.map((v) => [v.id, v]));
  const sizes = variables.filter((v) => v.kind === "number");
  const colors = variables.filter((v) => v.kind === "color");
  const value = look ?? {};
  const set = (patch: Partial<FrameLook>) => onChange({ ...value, ...patch });
  return (
    <>
      <Group title="Görünüş">
        <div className="grid grid-cols-2 gap-2">
          <OpacityField value={value.opacity} onChange={(opacity) => set({ opacity })} />
          <BoundField label="Köşe" kind="number" prefix={Glyphs.radius} value={value.radius ?? { value: 0 }} targets={sizes} byId={byId} mode={theme} onChange={(radius) => set({ radius })} />
        </div>
      </Group>
      <PaintGroup
        title="Dolgu"
        paint={value.fill}
        create={() => ({ color: { alias: "bg-4" } })}
        colors={colors}
        byId={byId}
        mode={theme}
        onChange={(fill) => set({ fill })}
      />
      <PaintGroup
        title="Kenar çizgisi"
        paint={value.stroke}
        create={(): Stroke => ({ color: { alias: "border" }, weight: { value: 1 }, align: "inside" })}
        colors={colors}
        byId={byId}
        mode={theme}
        onChange={(stroke) => set({ stroke })}
      >
        {value.stroke && (
          <div className="grid grid-cols-2 gap-2">
            <SelectField
              label="Kenar çizgisinin yeri"
              value={value.stroke.align}
              options={STROKE_ALIGNS}
              onChange={(align) => value.stroke && set({ stroke: { ...value.stroke, align: align as StrokeAlign } })}
            />
            <BoundField
              label="Kenar çizgisinin kalınlığı"
              kind="number"
              prefix={Glyphs.strokeWeight}
              value={value.stroke.weight}
              targets={sizes}
              byId={byId}
              mode={theme}
              onChange={(weight) => value.stroke && set({ stroke: { ...value.stroke, weight } })}
            />
          </div>
        )}
      </PaintGroup>
    </>
  );
}

/**
 * A variable: its name, and its value in each theme (a colour) or its one
 * value — its own, or another variable's (an alias, chosen from the menu at
 * the field's end).
 */
export function VariableInspector({ variable, variables, onChange }: {
  variable: DesignVariable;
  /** All of the site's variables (the ones it can point at) */
  variables: DesignVariable[];
  onChange: (variable: DesignVariable) => void;
}) {
  const byId = new Map(variables.map((v) => [v.id, v]));
  const targets = variables.filter((t) => canAlias(variable, t, byId));
  const valueField = (mode: ThemeMode) => (
    <BoundField
      label={variable.kind === "color" ? (mode === "dark" ? "Koyu değer" : "Açık değer") : variable.kind === "weight" ? "Kalınlık" : "Değer"}
      kind={variable.kind}
      value={modeValue(variable, mode)}
      targets={targets}
      byId={byId}
      mode={mode}
      onChange={(value) => onChange(mode === "dark" ? { ...variable, dark: value } : { ...variable, light: value })}
    />
  );

  return (
    <div className="flex flex-col">
      <Group title="Değişken">
        <Field label="Ad">
          <TextField label="Ad" value={variable.name} onChange={(name) => onChange({ ...variable, name })} placeholder="grup/ad" />
        </Field>
        <Row label="Tür">
          <span className="text-[12px] text-[var(--text-title)]">{KIND_LABEL[variable.kind]}</span>
        </Row>
        {variable.token && (
          <Row label="Token">
            <span className="text-[12px] font-mono text-[var(--text-subtitle)]">{variable.token}</span>
          </Row>
        )}
      </Group>
      <Group title="Değer">
        {variable.kind === "color" ? (
          <>
            <Field label="Açık tema">{valueField("light")}</Field>
            <Field label="Koyu tema">{valueField("dark")}</Field>
          </>
        ) : (
          <Field label="Değer">{valueField("light")}</Field>
        )}
      </Group>
    </div>
  );
}

// ── Atoms and molecules (see DesignAtom, DesignMolecule) ──────────────────────

const TYPOGRAPHY_FIELDS: { key: keyof Typography; label: string }[] = [
  { key: "fontSize", label: "Boyut" },
  { key: "fontWeight", label: "Kalınlık" },
  { key: "lineHeight", label: "Satır aralığı" },
  { key: "color", label: "Renk" },
];

/** Where an atom or a molecule is used — a click takes there. */
export interface DesignUse {
  key: string;
  icon: ReactNode;
  tone: string;
  label: string;
  detail?: string;
  onSelect: () => void;
}

function UsesGroup({ uses, empty }: { uses: DesignUse[]; empty: string }) {
  return (
    <Group title="Kullanıldığı yerler">
      {uses.map(({ key, ...use }) => <ChildRow key={key} {...use} onClick={use.onSelect} />)}
      {uses.length === 0 && <p className="text-[11px] text-[var(--text-subtitle)]">{empty}</p>}
    </Group>
  );
}

/** Where a component type is used, for a molecule's uses: its icon and colour. */
export const typeUse = (type: BlockType) => ({ icon: blockIcon(type), tone: blockTone(type), label: BLOCK_LABELS[type] });

/** A molecule in a use (a slot of it holds an atom). */
export const moleculeUse = (name: string) => ({ icon: Glyphs.molecule, tone: "var(--edit-molecule)", label: name });

/**
 * An atom: its name and its typography — each value its own or bound to a
 * variable (the menu at the field's end) — and where it is used.
 */
export function AtomInspector({ atom, variables, uses, onChange }: {
  atom: DesignAtom;
  /** All of the site's variables (the ones its values can be bound to) */
  variables: DesignVariable[];
  /** The molecules' slots holding it */
  uses: DesignUse[];
  onChange: (atom: DesignAtom) => void;
}) {
  const { theme } = useTheme();
  const byId = new Map(variables.map((v) => [v.id, v]));
  return (
    <div className="flex flex-col">
      <Group title="Metin stili">
        <Field label="Ad">
          <TextField label="Ad" value={atom.name} onChange={(name) => onChange({ ...atom, name })} placeholder="grup/ad" />
        </Field>
      </Group>
      <Group title="Tipografi">
        {TYPOGRAPHY_FIELDS.filter(({ key }) => key !== "color").map(({ key, label }) => (
          <Field key={key} label={label}>
            <BoundField
              label={label}
              kind={TYPOGRAPHY_KINDS[key]}
              value={atom[key] ?? { value: "" }}
              targets={variables.filter((v) => v.kind === TYPOGRAPHY_KINDS[key])}
              byId={byId}
              mode={theme}
              onChange={(value) => onChange({ ...atom, [key]: value })}
            />
          </Field>
        ))}
      </Group>
      {/* Its colour is a text's fill, as in Figma. */}
      <PaintGroup
        title="Dolgu"
        paint={{ color: atom.color ?? { value: "#000000" } }}
        create={() => ({ color: atom.color })}
        colors={variables.filter((v) => v.kind === "color")}
        byId={byId}
        mode={theme}
        fixed
        onChange={(paint) => paint && onChange({ ...atom, color: paint.color })}
      />
      <UsesGroup uses={uses} empty="Henüz hiçbir molekül bu atomu kullanmıyor." />
    </div>
  );
}

/**
 * A molecule: its name, its frame — layout, spacing, corners, background —
 * its atoms (a slot's atom swapped from the menu) and where it is used.
 */
export function MoleculeInspector({ molecule, variables, atoms, uses, onChange, onOpenAtom }: {
  molecule: DesignMolecule;
  variables: DesignVariable[];
  atoms: DesignAtom[];
  /** The components whose items it is */
  uses: DesignUse[];
  onChange: (molecule: DesignMolecule) => void;
  onOpenAtom: (id: string) => void;
}) {
  const byId = new Map(variables.map((v) => [v.id, v]));
  const setSlot = (slot: MoleculeSlot) => onChange({ ...molecule, slots: molecule.slots.map((s) => (s.field === slot.field ? slot : s)) });
  return (
    <div className="flex flex-col">
      <Group title="Molekül">
        <Field label="Ad">
          <TextField label="Ad" value={molecule.name} onChange={(name) => onChange({ ...molecule, name })} placeholder="grup/ad" />
        </Field>
      </Group>
      <Group title="Atomlar">
        {molecule.slots.map((slot) => (
          <Field key={slot.field} label={slot.name}>
            <div className="flex items-center gap-1">
              <AtomPicker slot={slot} atoms={atoms} byId={byId} onChange={(atom) => setSlot({ ...slot, atom })} />
              {slot.atom && <SquareButton label="Atoma git" onClick={() => onOpenAtom(slot.atom!)}>{Glyphs.goTo}</SquareButton>}
            </div>
          </Field>
        ))}
      </Group>
      <MoleculeFrameFields molecule={molecule} variables={variables} measure={`[data-molecule="${molecule.id}"]`} onChange={onChange} />
      <UsesGroup uses={uses} empty="Henüz hiçbir bileşen bu molekülü kullanmıyor." />
    </div>
  );
}

// ── Project inspector (nothing selected) ──────────────────────────────────────

/**
 * The page's frame (PageFrame) — the root layer, named after the project:
 * its header, sections and dividers, stacked. Its W / H and the alignment
 * box, as a Figma frame's Auto layout — with a word on why the box moves
 * nothing when it can't (as in Figma, Fill sections fill it across, and a
 * Hug height leaves no room down).
 */
export function PageFrameInspector({ project, variables, onChange }: { project: ProjectData; variables: DesignVariable[]; onChange: (frame: PageFrame) => void }) {
  const frame = project.frame;
  return (
    <div className="flex flex-col">
      <Group title="Yerleşim">
        <SizeFields size={frame?.size} measure="[data-page-frame]" heightModes={["fixed", "hug"]} onChange={(size) => onChange({ ...frame, size })} />
        <div className="grid grid-cols-2 gap-2">
          <AlignGrid
            className="h-16"
            x={frame?.justify ?? "start"}
            y={frame?.align ?? "start"}
            flow="vertical"
            onChange={({ x, y }) => onChange({ ...frame, justify: x, align: y })}
          />
        </div>
        <CheckRow label="İçeriği kırp" checked={Boolean(frame?.look?.clip)} onChange={(clip) => onChange({ ...frame, look: { ...frame?.look, clip: clip || undefined } })} />
      </Group>
      <LookFields look={frame?.look} variables={variables} onChange={(look) => onChange({ ...frame, look })} />
    </div>
  );
}

export function ProjectInspector({ project, slug, companies, onChange }: {
  project: ProjectData;
  lang: Lang;
  slug: string;
  companies: string[];
  onChange: (patch: Partial<ProjectMeta>) => void;
}) {
  return (
    <div className="flex flex-col">
      <Group title="Kapak görseli">
        <CoverImageUpload slug={slug} currentSrc={project.coverImage} onChange={(coverImage) => onChange({ coverImage })} />
      </Group>
      <Group title="Detaylar">
        <Row label="Şirket">
          <SelectField
            label="Şirket"
            value={project.company ?? ""}
            options={companies.map((c) => ({ value: c, label: c }))}
            placeholder="Seçilmedi"
            onChange={(company) => onChange({ company })}
          />
        </Row>
        <Row label="Adres">
          <span className="min-w-0 truncate text-[12px] text-[var(--text-subtitle)] tabular-nums">/projects/{slug}</span>
        </Row>
      </Group>
    </div>
  );
}

// ── Items inside a block ──────────────────────────────────────────────────────

type ItemFieldKey = "label" | "value" | "eyebrow" | "title" | "text" | "caption" | "href";

interface ItemField {
  key: ItemFieldKey;
  label: string;
  placeholder?: string;
  multiline?: boolean;
  /** Same value in every language (links, percentages, colours) */
  shared?: boolean;
  color?: boolean;
}

interface ItemSpec {
  /** What one item is called: "Kart", "Adım"… */
  noun: string;
  image?: boolean;
  icon?: boolean;
  fields: ItemField[];
}

const ENTRY_SPEC: Partial<Record<BlockType, ItemSpec>> = {
  info: { noun: "Satır", fields: [{ key: "label", label: "Etiket" }, { key: "value", label: "Değer" }] },
  stats: { noun: "Metrik", fields: [{ key: "value", label: "Değer", placeholder: "%40" }, { key: "label", label: "Açıklama" }] },
  cards: { noun: "Kart", fields: [{ key: "eyebrow", label: "Üst etiket", placeholder: "01, Sorun…" }, { key: "title", label: "Başlık" }, { key: "text", label: "Açıklama", multiline: true }] },
  steps: { noun: "Adım", fields: [{ key: "title", label: "Başlık" }, { key: "eyebrow", label: "Zaman", placeholder: "Hafta 1" }, { key: "text", label: "Açıklama", multiline: true }] },
  gallery: { noun: "Görsel", image: true, fields: [{ key: "caption", label: "Açıklama" }] },
  compare: { noun: "Görsel", image: true, fields: [{ key: "label", label: "Etiket", placeholder: "Önce / Sonra" }] },
  mockup: { noun: "Ekran", image: true, fields: [{ key: "label", label: "Adres çubuğu", placeholder: "Yalnızca tarayıcıda — burakkoc.net" }] },
  links: { noun: "Bağlantı", icon: true, fields: [{ key: "label", label: "Etiket" }, { key: "href", label: "Adres", placeholder: "https://…", shared: true }] },
  tags: { noun: "Etiket", fields: [{ key: "label", label: "Etiket" }] },
  accordion: { noun: "Madde", fields: [{ key: "title", label: "Başlık" }, { key: "text", label: "İçerik", multiline: true }] },
  bars: { noun: "Çubuk", fields: [{ key: "label", label: "Seçenek" }, { key: "value", label: "Yüzde", placeholder: "72", shared: true }, { key: "text", label: "Not" }] },
  persona: { noun: "Grup", fields: [{ key: "label", label: "Başlık" }, { key: "text", label: "Maddeler", placeholder: "Her satır bir madde", multiline: true }] },
  team: { noun: "Kişi", image: true, fields: [{ key: "title", label: "Ad Soyad" }, { key: "text", label: "Rol" }, { key: "href", label: "Profil", placeholder: "https://…", shared: true }] },
  palette: { noun: "Renk", fields: [{ key: "label", label: "Ad" }, { key: "value", label: "Renk", placeholder: "#1A1A1A", shared: true, color: true }, { key: "text", label: "Kullanım" }] },
};

const LIST_SPEC: ItemSpec = { noun: "Madde", fields: [] };

const isListBlock = (block: Block) => block.type === "list";

/** What one item of the component is called ("Satır", "Kart"…) — none when it has no items. */
export function itemNoun(block: Block): string | undefined {
  return specOf(block)?.noun;
}

function specOf(block: Block): ItemSpec | undefined {
  return isListBlock(block) ? LIST_SPEC : ENTRY_SPEC[block.type];
}

type Item = BlockEntry | ListItem;

function itemsOf(block: Block): Item[] {
  return isListBlock(block) ? block.listItems ?? [] : block.entries ?? [];
}

/** Does the block hold this item (it may have just been deleted)? */
export function hasItem(block: Block, itemId: string) {
  return itemsOf(block).some((i) => i.id === itemId);
}

/** "Adım 2" — how the panel names an item. */
export function itemName(block: Block, itemId: string) {
  const spec = specOf(block);
  const index = itemsOf(block).findIndex((i) => i.id === itemId);
  return `${spec?.noun ?? "Öğe"} ${index + 1}`;
}

/** Can the item move up (-1) / down (+1)? */
export function canMoveItem(block: Block, itemId: string, dir: -1 | 1) {
  const items = itemsOf(block);
  const to = items.findIndex((i) => i.id === itemId) + dir;
  return to >= 0 && to < items.length;
}

function withItems(block: Block, items: Item[]): Partial<Block> {
  return isListBlock(block) ? { listItems: items as ListItem[] } : { entries: items as BlockEntry[] };
}

export function moveItem(block: Block, itemId: string, dir: -1 | 1): Partial<Block> {
  const items = [...itemsOf(block)];
  const from = items.findIndex((i) => i.id === itemId);
  const to = from + dir;
  if (from < 0 || to < 0 || to >= items.length) return {};
  [items[from], items[to]] = [items[to], items[from]];
  return withItems(block, items);
}

export function duplicateItem(block: Block, itemId: string): { patch: Partial<Block>; id: string } {
  const items = [...itemsOf(block)];
  const from = items.findIndex((i) => i.id === itemId);
  const id = editorUid(isListBlock(block) ? "li" : "en");
  if (from >= 0) items.splice(from + 1, 0, { ...items[from], id });
  return { patch: withItems(block, items), id };
}

export function removeItem(block: Block, itemId: string): Partial<Block> {
  return withItems(block, itemsOf(block).filter((i) => i.id !== itemId));
}

/** A new empty item at the end of the component: the change, and its id. */
export function addEntry(block: Block): { patch: Partial<Block>; id: string } {
  if (isListBlock(block)) {
    const id = editorUid("li");
    return { patch: { listItems: [...(block.listItems ?? []), { id, text: "" }] }, id };
  }
  const id = editorUid("en");
  const entry: BlockEntry = { id };
  if (block.type === "links") entry.icon = "web";
  if (block.type === "bars") entry.value = "50";
  return { patch: { entries: [...(block.entries ?? []), entry] }, id };
}

/** Turkish plural by vowel harmony: Kart → Kartlar, Görsel → Görseller. */
function plural(noun: string) {
  const vowel = noun.toLocaleLowerCase("tr").match(/[aıoueiöü](?=[^aıoueiöü]*$)/)?.[0];
  return noun + (vowel && "aıou".includes(vowel) ? "lar" : "ler");
}

/** First words of an item, for the list. */
function itemPreview(block: Block, item: Item, lang: Lang) {
  const en = lang === "en";
  if (isListBlock(block)) {
    const li = item as ListItem;
    return (en ? li.textEn : undefined) || li.text;
  }
  const e = item as BlockEntry;
  const pick = (key: "title" | "label" | "caption" | "value" | "text") => (en ? e[`${key}En` as const] : undefined) || e[key];
  return pick("title") || pick("label") || pick("caption") || pick("value") || pick("text");
}

function ItemList({ block, lang, onSelect }: { block: Block; lang: Lang; onSelect: (id: string) => void }) {
  const spec = specOf(block);
  const items = itemsOf(block);
  if (!items.length) return <p className="text-[11px] text-[var(--text-subtitle)]">Henüz yok.</p>;
  return (
    <>
      {items.map((item, i) => {
        const preview = itemPreview(block, item, lang)?.replace(/\*\*|\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/\s+/g, " ").trim();
        const src = spec?.image ? (item as BlockEntry).src : undefined;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item.id)}
            className="group/item flex items-center gap-2 w-[calc(100%+16px)] h-8 -mx-2 px-2 rounded-[6px] text-left hover:bg-[var(--bg-4)] transition-colors cursor-pointer"
          >
            {spec?.image ? (
              <span className="relative w-5 h-5 shrink-0 rounded-[4px] overflow-hidden bg-[var(--bg-4)]">
                {src && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={src} alt="" className="w-full h-full object-cover" />
                )}
              </span>
            ) : (
              <span className="flex items-center justify-center w-5 h-5 shrink-0 rounded-[4px] bg-[var(--bg-4)] text-[10px] font-medium text-[var(--text-subtitle)] tabular-nums">{i + 1}</span>
            )}
            <span className={cn("min-w-0 flex-1 truncate text-[12px]", preview ? "text-[var(--text-title)]" : "text-[var(--text-subtitle)]")}>
              {preview || `${spec?.noun ?? "Öğe"} ${i + 1}`}
            </span>
            <span className="shrink-0 text-[var(--text-subtitle)] opacity-0 group-hover/item:opacity-100 transition-opacity">{Glyphs.chevron}</span>
          </button>
        );
      })}
    </>
  );
}

/** A labelled field inside an item's settings. */
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] leading-4 text-[var(--text-subtitle)] select-none">{label}</span>
      {children}
    </div>
  );
}

function AutoTextarea({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <textarea
      aria-label={label}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      rows={Math.min(8, Math.max(2, value.split("\n").length))}
      className="w-full resize-none rounded-[6px] border border-transparent bg-[var(--bg-4)] px-2 py-1.5 text-[12px] leading-[18px] text-[var(--text-title)] placeholder:text-[var(--text-subtitle)] hover:border-[var(--border-hover)] focus:outline-none focus:border-[var(--text-subtitle)] transition-colors"
    />
  );
}

/** Settings of one item (card, step, link, list item…) inside a block. */
export function ItemInspector({ block, itemId, lang, projectSlug, layout, onChange }: {
  block: Block;
  itemId: string;
  lang: Lang;
  projectSlug: string;
  /** Its frame, from its molecule (see ItemLayoutGroup) — after its properties, as in Figma */
  layout?: ReactNode;
  onChange: (patch: Partial<Block>) => void;
}) {
  const en = lang === "en";

  if (isListBlock(block)) {
    const items = block.listItems ?? [];
    const item = items.find((i) => i.id === itemId);
    if (!item) return null;
    const update = (patch: Partial<ListItem>) => onChange({ listItems: items.map((i) => (i.id === itemId ? { ...i, ...patch } : i)) });
    return (
      <div className="flex flex-col">
        <Group title="İçerik">
          <Field label="Metin">
            <AutoTextarea label="Metin" value={(en ? item.textEn : item.text) ?? ""} onChange={(v) => update(en ? { textEn: v } : { text: v })} />
          </Field>
          {block.listStyle === "check" && (
            <Row label="İşaretli">
              <Choice value={Boolean(item.checked)} options={[{ value: false, label: "Hayır" }, { value: true, label: "Evet" }]} onChange={(checked) => update({ checked })} />
            </Row>
          )}
        </Group>
      </div>
    );
  }

  const spec = ENTRY_SPEC[block.type];
  const entries = block.entries ?? [];
  const entry = entries.find((e) => e.id === itemId);
  if (!spec || !entry) return null;
  const update = (patch: Partial<BlockEntry>) => onChange({ entries: entries.map((e) => (e.id === itemId ? { ...e, ...patch } : e)) });
  const keyOf = (f: ItemField) => (en && !f.shared ? `${f.key}En` : f.key) as keyof BlockEntry;

  return (
    <div className="flex flex-col">
      {spec.image && (
        <Group title={block.type === "team" ? "Fotoğraf" : "Görsel"}>
          <ImageSource
            src={entry.src}
            alt={en ? entry.altEn : entry.alt}
            onSrc={(src) => update({ src })}
            onAlt={(alt) => update(en ? { altEn: alt } : { alt })}
            uploadId={`${block.id}-${entry.id}`}
            projectSlug={projectSlug}
          />
        </Group>
      )}
      <Group title="İçerik">
        {spec.fields.map((f) => {
          const value = (entry[keyOf(f)] as string | undefined) ?? "";
          const set = (v: string) => update({ [keyOf(f)]: v });
          return (
            <Field key={f.key} label={f.label}>
              {f.multiline ? (
                <AutoTextarea label={f.label} value={value} onChange={set} placeholder={f.placeholder} />
              ) : (
                <TextField
                  label={f.label}
                  type={f.key === "href" ? "url" : "text"}
                  value={value}
                  onChange={set}
                  placeholder={f.placeholder}
                  prefix={f.color ? (
                    <label className="relative block w-3.5 h-3.5 shrink-0 rounded-[3px] border border-[var(--border-hover)] overflow-hidden cursor-pointer" style={{ backgroundColor: value || "transparent" }}>
                      <input
                        type="color"
                        value={/^#[0-9a-f]{6}$/i.test(value) ? value : "#000000"}
                        onChange={(e) => set(e.target.value)}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                        aria-label={`${f.label} seç`}
                      />
                    </label>
                  ) : undefined}
                />
              )}
            </Field>
          );
        })}
      </Group>
      {spec.icon && (
        <Group title="İkon">
          <Row label="Tür">
            <SelectField
              label="İkon"
              value={entry.icon ?? "web"}
              options={LINK_ICONS}
              onChange={(icon) => update({ icon: (icon as LinkIconType) || "web" })}
            />
          </Row>
        </Group>
      )}
      {layout}
    </div>
  );
}
