"use client";

import { useEffect, useRef, type ReactNode } from "react";
import type { DesignVariable, TextStyle, VariableKind } from "@/types/design";
import { useTheme } from "@/context/ThemeContext";
import type { ProjectData, ProjectTheme } from "@/types/project";
import { cn } from "@/lib/utils";
import { byGroup, resolvedValue, splitName } from "@/components/project/designVariables";
import { ACCENT_PRESETS, RADIUS_OPTIONS, cleanTheme } from "@/components/admin/ProjectThemeFields";
import { FigmaIcon } from "@/components/admin/figmaIcons";
import { TextStyleSample, textStyleMetrics } from "@/components/admin/textStyleSample";
import { ColorField, Glyphs, Group, InspectorHeader, ProjectInspector, Row, SelectField, SquareButton, Swatch, TextStyleFields, type DesignUse } from "@/components/admin/LiveInspector";
import type { ProjectMeta } from "@/components/admin/editorActions";

const THEME_COLORS: { key: Exclude<keyof ProjectTheme, "radius">; label: string }[] = [
  { key: "accentColor", label: "Vurgu" },
  { key: "bgColor", label: "Sayfa" },
  { key: "cardBgColor", label: "Kart" },
  { key: "textColor", label: "Başlık" },
];

/**
 * The project's theme, as the page's settings in Figma's panel: its corners
 * and its colours — each a field with its swatch (the colour picker), empty
 * for the site's own; the accent with the site's presets under it.
 */
export function ThemeFields({ theme, onChange }: { theme?: ProjectTheme; onChange: (theme: ProjectTheme | undefined) => void }) {
  const current = theme ?? {};
  const set = (key: keyof ProjectTheme, value: string | undefined) => onChange(cleanTheme({ ...current, [key]: value || undefined }));
  return (
    <>
      <Row label="Köşeler">
        <SelectField
          label="Köşe yuvarlaklığı"
          value={current.radius ?? ""}
          options={RADIUS_OPTIONS.filter((o) => o.value).map((o) => ({ value: o.value!, label: o.value === "9999px" ? "Hap" : `${o.label} px` }))}
          placeholder="Sitenin"
          onChange={(radius) => set("radius", radius)}
        />
      </Row>
      {THEME_COLORS.map(({ key, label }) => (
        <Row
          key={key}
          label={label}
          icon={current[key] && <SquareButton label={`${label}: sitenin rengine dön`} onClick={() => set(key, undefined)}>{Glyphs.minus}</SquareButton>}
        >
          <ColorField label={`${label} rengi`} value={current[key] ?? ""} placeholder="Sitenin" onChange={(v) => set(key, v)} />
        </Row>
      ))}
      <div className="flex flex-wrap gap-1.5 pl-[80px]">
        {ACCENT_PRESETS.map((color) => (
          <button
            key={color}
            type="button"
            title={color}
            aria-label={`Vurgu: ${color}`}
            onClick={() => set("accentColor", color)}
            className={cn(
              "w-4 h-4 rounded-[4px] border border-[var(--border-hover)] cursor-pointer transition-transform hover:scale-110",
              current.accentColor?.toLowerCase() === color && "ring-2 ring-[var(--edit-accent)] ring-offset-1 ring-offset-[var(--bg-1)]"
            )}
            style={{ backgroundColor: color }}
          />
        ))}
      </div>
      <p className="text-[11px] leading-4 text-[var(--text-subtitle)]">Boş olanlar sitenin kendi rengi. Arka planlar ve başlık rengi iki temada da aynı kalır.</p>
    </>
  );
}

/**
 * The design panel with nothing selected, as Figma's: what the page is made
 * with — its theme (Figma's page colour), the site's local variables (opened
 * in their window, see VariablesModal) and its text styles (each edited in a
 * popover, see TextStylePopover) — and the project's own settings.
 */
export function PageDesignPanel({ project, slug, companies, variables, textStyles, onMeta, onOpenVariables, onAddTextStyle, onEditTextStyle }: {
  project: ProjectData;
  slug: string;
  companies: string[];
  variables: DesignVariable[];
  textStyles: TextStyle[];
  onMeta: (patch: Partial<ProjectMeta>) => void;
  onOpenVariables: () => void;
  onAddTextStyle: () => void;
  /** Opens a text style's popover next to `under` */
  onEditTextStyle: (id: string, under: Element) => void;
}) {
  const byId = new Map(variables.map((v) => [v.id, v]));
  return (
    <div className="flex flex-col">
      <Group
        title="Tema"
        actions={project.theme && <SquareButton label="Varsayılana dön" onClick={() => onMeta({ theme: undefined })}>{Glyphs.reset}</SquareButton>}
      >
        <ThemeFields theme={project.theme} onChange={(theme) => onMeta({ theme })} />
      </Group>
      <Group title="Yerel değişkenler">
        <button
          type="button"
          onClick={onOpenVariables}
          className="flex items-center gap-2 w-[calc(100%+16px)] h-8 -mx-2 px-2 rounded-[6px] text-left hover:bg-[var(--bg-4)] transition-colors cursor-pointer"
        >
          <FigmaIcon name="16.variable" className="shrink-0 text-[var(--text-subtitle)]" />
          <span className="min-w-0 flex-1 truncate text-[11px] text-[var(--text-title)]">Değişkenleri aç</span>
          <span className="shrink-0 text-[11px] text-[var(--text-subtitle)] tabular-nums">{variables.length}</span>
        </button>
      </Group>
      <Group title="Metin stilleri" actions={<SquareButton label="Metin stili oluştur" onClick={onAddTextStyle}>{Glyphs.plus}</SquareButton>}>
        <TextStyleRows textStyles={textStyles} byId={byId} onEdit={onEditTextStyle} />
      </Group>
      <ProjectInspector project={project} lang="tr" slug={slug} companies={companies} onChange={onMeta} />
    </div>
  );
}

/** The text styles, by group: each its sample, name and size — a click edits it (see TextStylePopover). */
function TextStyleRows({ textStyles, byId, onEdit }: { textStyles: TextStyle[]; byId: Map<string, DesignVariable>; onEdit: (id: string, under: Element) => void }) {
  return (
    <>
      {[...byGroup(textStyles)].map(([group, list]) => (
        <div key={group || "—"} className="flex flex-col">
          {group && <p className="h-6 flex items-center text-[11px] text-[var(--text-subtitle)] select-none">{group}</p>}
          {list.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={(e) => onEdit(s.id, e.currentTarget)}
              className="group/style flex items-center gap-2 w-[calc(100%+16px)] h-8 -mx-2 px-2 rounded-[6px] text-left hover:bg-[var(--bg-4)] transition-colors cursor-pointer"
            >
              <TextStyleSample styleId={s.id} className="-ml-0.5" />
              <span className="min-w-0 flex-1 truncate text-[11px] text-[var(--text-title)]">{splitName(s.name)[1] || "Adsız"}</span>
              <span className="shrink-0 text-[11px] tabular-nums text-[var(--text-subtitle)]">{textStyleMetrics(s, byId)}</span>
            </button>
          ))}
        </div>
      ))}
    </>
  );
}

/** The rail's Metin stilleri panel: the site's text styles — a click edits one beside the panel. */
export function TextStylesPanel({ textStyles, variables, onEdit }: { textStyles: TextStyle[]; variables: DesignVariable[]; onEdit: (id: string, under: Element) => void }) {
  const byId = new Map(variables.map((v) => [v.id, v]));
  return (
    <div className="flex flex-col px-4 py-3">
      <TextStyleRows textStyles={textStyles} byId={byId} onEdit={onEdit} />
    </div>
  );
}

/** Figma's kinds of variables, to make one of. */
const NEW_KINDS: { kind: VariableKind; label: string }[] = [
  { kind: "color", label: "Renk" },
  { kind: "number", label: "Sayı" },
  { kind: "weight", label: "Kalınlık" },
];

/**
 * The rail's Değişkenler panel: the site's variables by group — a colour's
 * swatch, a number's value — each opening Figma's variables table (see
 * VariablesModal), where they are edited; "+" makes one there.
 */
export function VariablesPanel({ variables, onOpen, onAdd }: { variables: DesignVariable[]; onOpen: () => void; onAdd: (kind: VariableKind) => void }) {
  const { theme } = useTheme();
  const byId = new Map(variables.map((v) => [v.id, v]));
  return (
    <div className="flex flex-col px-4 py-3 gap-3">
      <div className="grid grid-cols-3 gap-1">
        {NEW_KINDS.map((k) => (
          <button
            key={k.kind}
            type="button"
            onClick={() => onAdd(k.kind)}
            className="flex items-center justify-center gap-1 h-6 rounded-[5px] bg-[var(--bg-4)] text-[11px] font-medium text-[var(--text-title)] hover:bg-[var(--bg-5)] transition-colors cursor-pointer"
          >
            {Glyphs.plus}
            {k.label}
          </button>
        ))}
      </div>
      {[...byGroup(variables)].map(([group, list]) => (
        <div key={group || "—"} className="flex flex-col">
          {group && <p className="h-6 flex items-center text-[11px] text-[var(--text-subtitle)] select-none">{group}</p>}
          {list.map((v) => {
            const value = resolvedValue(v, theme, byId);
            return (
              <button
                key={v.id}
                type="button"
                title={v.name}
                onClick={onOpen}
                className="flex items-center gap-2 w-[calc(100%+16px)] h-8 -mx-2 px-2 rounded-[6px] text-left hover:bg-[var(--bg-4)] transition-colors cursor-pointer"
              >
                {v.kind === "color" ? <Swatch color={value} /> : <FigmaIcon name="16.number" className="-m-px shrink-0 text-[var(--text-subtitle)]" />}
                <span className="min-w-0 flex-1 truncate text-[11px] text-[var(--text-title)]">{splitName(v.name)[1] || v.name}</span>
                <span className="shrink-0 max-w-[40%] truncate text-[11px] tabular-nums text-[var(--text-subtitle)]">{v.kind === "color" ? String(value ?? "—") : (value ?? "—")}</span>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

const POPOVER_WIDTH = 280;

/**
 * Figma's "Edit text style" popover, beside the design panel at the row that
 * opened it: the style's name, typography, colour and uses (TextStyleFields).
 * Every text in it changes as it is edited. A click outside or Esc closes it.
 */
export function TextStylePopover({ style, variables, uses, anchor, actions, onChange, onClose }: {
  style: TextStyle;
  variables: DesignVariable[];
  uses: DesignUse[];
  /** The row (or field) that opened it */
  anchor: { top: number; left: number };
  /** Its header's actions (delete, back to the starting look) */
  actions?: ReactNode;
  onChange: (style: TextStyle) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const target = e.target instanceof Element ? e.target : null;
      // Its own menus and pickers are fixed outside it, but part of it.
      if (!target || (!ref.current?.contains(target) && !target.closest("[role=menu], [role=dialog]"))) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);
  const top = Math.max(8, Math.min(anchor.top - 12, window.innerHeight - 520));
  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Metin stilini düzenle"
      style={{ top, left: Math.max(8, anchor.left - POPOVER_WIDTH - 8), width: POPOVER_WIDTH, maxHeight: `calc(100vh - ${top + 8}px)` }}
      className={cn("fixed z-50 flex flex-col rounded-[13px] border border-[var(--border)] bg-[var(--bg-1)] shadow-[0_12px_40px_rgba(0,0,0,0.16)] overflow-hidden")}
    >
      <InspectorHeader
        icon={<FigmaIcon name="16.text" />}
        title={style.name}
        actions={
          <>
            {actions}
            <SquareButton label="Kapat" onClick={onClose}>{Glyphs.close}</SquareButton>
          </>
        }
      />
      <div className="min-h-0 overflow-y-auto overscroll-contain">
        <TextStyleFields style={style} variables={variables} uses={uses} onChange={onChange} />
      </div>
    </div>
  );
}
