"use client";

import { useState, type ReactNode } from "react";
import type { DesignVariable, InteractionAnimation, InteractionEasing, InteractionTrigger, TextStyle, VariableValue } from "@/types/design";
import { cn } from "@/lib/utils";
import { FigmaIcon, fi, type FigmaIconName } from "@/components/admin/figmaIcons";
import { ANIMATIONS, EASINGS, TRIGGERS } from "@/components/project/interactions";
import { boundValue, byGroup, splitName, type ThemeMode } from "@/components/project/designVariables";
import { PICKER_WIDTH, VariablePicker, usePopover, type MenuItem } from "@/components/admin/LiveInspector";
import { weightLabel } from "./css";
import { type ChevronItem } from "./ui";
import { BLEND_MODES, EFFECT_LABEL, LAYOUT_GRID_LABEL, PAINT_LABEL, PATH_SEP, findComponent, findNode, getNode, isFrameLike, newEffect, newLayoutGrid, nid, numberOf, setOf, variantName, variantProperties, variantValue, variantsOf, walk, type Effect, type EffectStyle, type ExportSetting, type FrameNode, type LayoutGrid, type NodeOverride, type Paint, type Reaction, type SceneNode, type StrokeStyle, type TextNode } from "./model";
import { ColorPicker } from "./ColorPicker";
import type { MenuEntry } from "@/components/admin/ContextMenu";
import { Checkbox, ChevronMenu, Chit, ColorInput, IconButton, NumericInput, Prefix, PropRow, Section, Select, TextInput, hexDigits } from "./ui";

/**
 * Figma's Design panel (its labels on) for whatever is selected — Position,
 * Layout, Appearance, Fill, Stroke, Effects; a text's Typography; a
 * component's variants, an instance's properties and overrides — and its
 * Prototype panel. With nothing selected: the page, the styles.
 */

export interface EditorOps {
  patch: (id: string, patch: Partial<SceneNode>) => void;
  patchMany: (ids: readonly string[], patch: Partial<SceneNode>) => void;
  override: (compositeId: string, patch: NodeOverride) => void;
  align: (kind: "left" | "hcenter" | "right" | "top" | "vcenter" | "bottom") => void;
  setAutoLayout: (id: string, mode: FrameNode["layoutMode"]) => void;
  createComponent: () => void;
  detach: () => void;
  resetOverrides: () => void;
  goToMain: () => void;
  addVariant: (id: string) => void;
  combineAsVariants: () => void;
  setVariantValue: (variantId: string, property: string, value: string) => void;
  renameProperty: (setId: string, from: string, to: string) => void;
  renameValue: (setId: string, property: string, from: string, to: string) => void;
  addProperty: (setId: string) => void;
  removeProperty: (setId: string, name: string) => void;
  swapVariant: (instanceId: string, property: string, value: string) => void;
  setReactions: (variantId: string, reactions: Reaction[]) => void;
  preview: (id?: string) => void;
  openVariables: () => void;
  setBackground: (color: string) => void;
  /** The header's "…" menu */
  more: (el: HTMLElement) => void;
  /** A menu under a button (Figma's dark one) */
  menu: (el: HTMLElement, entries: MenuEntry[]) => void;
  /** Every fill and stroke of `from` in the selection turned to `to` (Selection colors) */
  replaceColor: (from: string, to: string, opacity?: number) => void;
  /** The colours on this page, for the picker */
  pageColors: string[];
  /** A frame without auto layout sized to what is in it */
  fitToContent: (id: string) => void;
  /** The selection's gaps made even along an axis; tidy: laid out as a grid */
  distribute: (axis: "h" | "v") => void;
  tidy: () => void;
  effectStyles: EffectStyle[];
  createEffectStyle: (nodeId: string) => void;
  applyEffectStyle: (nodeId: string, styleId: string) => void;
  detachEffectStyle: (nodeId: string) => void;
  removeEffectStyle: (styleId: string) => void;
  /** A text style from a text layer's typography (or a blank one) */
  createTextStyle: (nodeId: string | null) => void;
  /** A colour variable from a colour */
  createColorStyle: (hex: string) => void;
  exportNode: (id: string, setting: ExportSetting) => void;
  /** A file put in the site's storage: its URL */
  upload: (file: File) => Promise<string>;
  /** The frame that is the project's page */
  pageId: string;
  /** ⇧A: a frame's auto layout on, or the selection wrapped in a new auto layout frame */
  addAutoLayout: () => void;
}

/** Where a picker beside the panel opens: at the row's top, to the panel's left. */
function anchorOf(el: Element) {
  const panel = el.closest("[data-design-panel]")?.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  return { top: r.top, right: (panel?.left ?? r.left) - 4 };
}

const own = (value: string | number): VariableValue => ({ value });

/** A small label over a row's fields, as Figma's labels ("Alignment", "Dimensions"). */
function Label({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("block text-[11px] font-[450] leading-4 tracking-[0.055px] text-[var(--f-text-secondary)] select-none", className)}>{children}</span>;
}

/** Two labels over two fields. */
function Labels({ a, b, className }: { a: ReactNode; b?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-center gap-2 pl-4 pr-2 pt-1", className)}>
      <div className="flex flex-1 min-w-0 items-center gap-2">
        <Label className="flex-1">{a}</Label>
        {b !== undefined && <Label className="flex-1">{b}</Label>}
      </div>
      <span className="w-6 shrink-0" />
    </div>
  );
}

/** A number that may be a variable's: the field, or the variable's pill, the hexagon opening the picker. */
function BoundNumber({ label, prefix, value, variables, byId, mode, onChange, unit, min, max, fallback, suffix, placeholder }: {
  label: string;
  prefix: ReactNode;
  value: VariableValue | undefined;
  variables: DesignVariable[];
  byId: Map<string, DesignVariable>;
  mode: ThemeMode;
  onChange: (value: VariableValue) => void;
  unit?: string;
  min?: number;
  max?: number;
  fallback?: number;
  /** After the field's variable button (a sizing menu) */
  suffix?: ReactNode;
  placeholder?: string;
}) {
  const { at, box, toggle, close } = usePopover(PICKER_WIDTH);
  const v = value ?? own(fallback ?? 0);
  const bound = "alias" in v ? byId.get(v.alias) : undefined;
  const targets = variables.filter((x) => x.kind === "number");
  const hex = <IconButton label="Değişkene bağla" icon={fi("variable.small")} onClick={(e) => toggle(e.currentTarget)} className="opacity-0 group-hover/bound:opacity-100 focus:opacity-100" />;
  const picker = at && <VariablePicker at={at} variables={targets} byId={byId} mode={mode} selectedId={bound?.id} onPick={(id) => { onChange({ alias: id }); close(); }} />;
  if (bound) {
    return (
      <div ref={box} className="group/bound relative flex flex-1 min-w-0 items-center h-6 rounded-[5px] bg-[var(--f-bg-secondary)]">
        {typeof prefix === "string" ? <Prefix>{prefix}</Prefix> : prefix}
        <button type="button" onClick={(e) => toggle(e.currentTarget)} className="flex min-w-0 flex-1 items-center gap-1 h-5 mr-1 px-1.5 rounded-[3px] bg-[var(--f-bg)] border border-[var(--f-border)] text-[11px] leading-4 text-[var(--f-text)] cursor-pointer">
          <FigmaIcon name="16.variable" className="shrink-0 text-[var(--f-icon-secondary)]" />
          <span className="truncate">{splitName(bound.name)[1] || bound.name}</span>
        </button>
        <IconButton label="Bağı kopar" icon={fi("detach.small")} onClick={() => onChange(own(Number(boundValue(v, mode, byId)) || 0))} />
        {suffix}
        {picker}
      </div>
    );
  }
  return (
    <div ref={box} className="group/bound relative flex flex-1 min-w-0">
      <NumericInput label={label} prefix={prefix} value={"alias" in v ? 0 : Number(v.value) || 0} min={min} max={max} unit={unit} placeholder={placeholder} onChange={(n) => onChange(own(n))} suffix={<>{targets.length ? hex : null}{suffix}</>} />
      {picker}
    </div>
  );
}

/** A paint (a fill's, a stroke's): its colour — a variable's pill when bound — its opacity, its eye, its minus. */
function PaintRow<T extends Paint>({ paint, variables, byId, mode, onChange, onRemove, pageColors, ops }: { paint: T; variables: DesignVariable[]; byId: Map<string, DesignVariable>; mode: ThemeMode; onChange: (paint: T) => void; onRemove: () => void; pageColors: string[]; ops?: EditorOps }) {
  const [picker, setPicker] = useState<{ top: number; right: number } | null>(null);
  const bound = "alias" in paint.color ? byId.get(paint.color.alias) : undefined;
  const resolved = String(boundValue(paint.color, mode, byId) ?? "#000000");
  const pickerNode = picker && (
    <ColorPicker
      color={resolved}
      opacity={paint.opacity ?? 100}
      anchor={picker}
      variables={variables}
      byId={byId}
      mode={mode}
      pageColors={pageColors}
      onChange={(hex, opacity) => onChange({ ...paint, color: own(hex), opacity: opacity >= 100 ? undefined : opacity })}
      onVariable={(color) => onChange({ ...paint, color })}
      onCreateVariable={ops?.createColorStyle}
      paint={paint}
      onPaint={(p) => onChange({ ...paint, ...p })}
      onUpload={ops?.upload}
      onClose={() => setPicker(null)}
    />
  );
  const fancy = paint.type === "gradient" || paint.type === "image";
  const preview = paint.type === "gradient" && paint.gradient ? `linear-gradient(${paint.gradient.angle}deg, ${paint.gradient.stops.map((st) => `${st.color} ${st.position}%`).join(", ")})` : paint.type === "image" && paint.image?.url ? `url("${paint.image.url}") center / cover` : undefined;
  return (
    <PropRow
      icons={
        <>
          <IconButton label={paint.visible === false ? "Göster" : "Gizle"} icon={fi(paint.visible === false ? "hidden.small" : "eye.small")} onClick={() => onChange({ ...paint, visible: paint.visible === false ? undefined : false })} />
          <IconButton label="Kaldır" icon={fi("minus.small")} onClick={onRemove} />
        </>
      }
    >
      <div className="relative flex flex-1 min-w-0 items-center">
        {fancy ? (
          <button type="button" data-picker-anchor="" onClick={(e) => setPicker(picker ? null : anchorOf(e.currentTarget))} className="flex flex-1 min-w-0 items-center h-6 rounded-[5px] bg-[var(--f-bg-secondary)] cursor-pointer">
            <span className="flex w-6 h-6 shrink-0 items-center justify-center"><span className="w-4 h-4 rounded-[3px] border border-[var(--f-border-translucent)]" style={{ background: preview ?? "var(--f-bg-hover)" }} /></span>
            <span className="truncate text-[11px] leading-4 text-[var(--f-text)]">{PAINT_LABEL[paint.type!]}</span>
          </button>
        ) : bound ? (
          <div className="flex flex-1 min-w-0 items-center h-6 rounded-[5px] bg-[var(--f-bg-secondary)]">
            <button type="button" data-picker-anchor="" onClick={(e) => setPicker(anchorOf(e.currentTarget))} className="flex min-w-0 flex-1 items-center h-6 cursor-pointer">
              <Chit color={resolved} />
              <span className="truncate text-[11px] leading-4 text-[var(--f-text)]">{splitName(bound.name)[1] || bound.name}</span>
            </button>
            <IconButton label="Bağı kopar" icon={fi("detach.small")} onClick={() => onChange({ ...paint, color: own(resolved) })} />
          </div>
        ) : (
          <ColorInput
            label="Renk"
            color={resolved}
            opacity={paint.opacity ?? 100}
            onColor={(hex) => onChange({ ...paint, color: own(hex) })}
            onOpacity={(opacity) => onChange({ ...paint, opacity: opacity >= 100 ? undefined : opacity })}
            chit={
              <button type="button" data-picker-anchor="" aria-label="Renk seçici" onClick={(e) => setPicker(picker ? null : anchorOf(e.currentTarget))} className="cursor-pointer">
                <Chit color={resolved} />
              </button>
            }
          />
        )}
        {pickerNode}
      </div>
    </PropRow>
  );
}

const ALIGN_GLYPH = {
  left: fi("24.layout-align-left"),
  hcenter: fi("24.layout-align-horizontal-center"),
  right: fi("24.layout-align-right"),
  top: fi("24.layout-align-top"),
  vcenter: fi("24.layout-align-vertical-center"),
  bottom: fi("24.layout-align-bottom"),
};
const FLOW_GLYPH = {
  vertical: fi("24.autolayout-vertical"),
  horizontal: fi("24.autolayout-horizontal"),
  wrap: fi("24.autolayout-wrap"),
  grid: fi("24.grid"),
};

/** A group of icon buttons on the secondary background, as Figma's alignment and flow controls. */
function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string; icon: ReactNode; disabled?: boolean }[]; onChange: (value: T) => void }) {
  return (
    <div className="flex flex-1 min-w-0 items-center h-6 p-0.5 rounded-[5px] bg-[var(--f-bg-secondary)]">
      {options.map((o) => (
        <button key={o.value} type="button" aria-label={o.label} title={o.label} aria-pressed={o.value === value} disabled={o.disabled} onClick={() => onChange(o.value)} className={cn("flex flex-1 items-center justify-center h-5 rounded-[3px] cursor-pointer disabled:opacity-40 disabled:cursor-default", o.value === value ? "bg-[var(--f-bg)] text-[var(--f-text)] shadow-[0_0_0.5px_rgba(0,0,0,0.3),0_1px_3px_rgba(0,0,0,0.15)]" : "text-[var(--f-icon-secondary)] hover:text-[var(--f-text)]")}>
          {o.icon}
        </button>
      ))}
    </div>
  );
}

// ── Sections ──────────────────────────────────────────────────────────────────

function PositionSection({ node, inAuto, ops, multi }: { node: SceneNode; inAuto: boolean; ops: EditorOps; multi: readonly string[] }) {
  const set = (patch: Partial<SceneNode>) => (multi.length > 1 ? ops.patchMany(multi, patch) : ops.patch(node.id, patch));
  return (
    <Section title="Konum" icons={inAuto ? <IconButton label={node.absolute ? "Auto layout'a geri koy" : "Auto layout'tan bağımsız konumlandır"} icon={fi("24.al.absolute-position")} active={Boolean(node.absolute)} onClick={() => ops.patch(node.id, { absolute: node.absolute ? undefined : true })} /> : undefined}>
      <PropRow icons={<IconButton label="Dağıt" icon={fi("24.layout-distribute-horizontal-spacing")} disabled={multi.length < 2} onClick={(e) => ops.menu(e.currentTarget, [{ label: "Yatay aralıkları eşitle", onSelect: () => ops.distribute("h") }, { label: "Dikey aralıkları eşitle", onSelect: () => ops.distribute("v") }, "-", { label: "Düzenle (ızgara)", onSelect: ops.tidy }])} />}>
        <div className="flex flex-1 items-center justify-between">
          {(["left", "hcenter", "right", "top", "vcenter", "bottom"] as const).map((k) => (
            <IconButton key={k} label={k} icon={ALIGN_GLYPH[k]} onClick={() => ops.align(k)} />
          ))}
        </div>
      </PropRow>
      <PropRow icons={<span className="w-6" />}>
        <NumericInput label="X" prefix="X" value={Math.round(node.x)} onChange={(x) => set({ x })} disabled={inAuto && !node.absolute} />
        <NumericInput label="Y" prefix="Y" value={Math.round(node.y)} onChange={(y) => set({ y })} disabled={inAuto && !node.absolute} />
      </PropRow>
      <PropRow icons={<span className="w-6" />}>
        <NumericInput label="Döndürme" prefix={<Prefix>{fi("24.rotation")}</Prefix>} value={node.rotation ?? 0} min={-360} max={360} unit="°" onChange={(rotation) => set({ rotation: rotation || undefined })} />
        <div className="flex flex-1 items-center h-6 rounded-[5px] bg-[var(--f-bg-secondary)]">
          <IconButton label="Yatay çevir (⇧H)" icon={fi("24.flip.horizontal.small")} active={Boolean(node.flipH)} onClick={() => set({ flipH: node.flipH ? undefined : true })} className="flex-1" />
          <IconButton label="Dikey çevir (⇧V)" icon={fi("24.flip.vertical")} active={Boolean(node.flipV)} onClick={() => set({ flipV: node.flipV ? undefined : true })} className="flex-1" />
          <IconButton label="90° döndür" icon={fi("24.rotate")} onClick={() => set({ rotation: ((node.rotation ?? 0) + 90) % 360 || undefined })} className="flex-1" />
        </div>
      </PropRow>
    </Section>
  );
}

function LayoutSection({ node, parent, ops, variables, byId, mode }: { node: SceneNode; parent: FrameNode | null; ops: EditorOps; variables: DesignVariable[]; byId: Map<string, DesignVariable>; mode: ThemeMode }) {
  const frame = isFrameLike(node) ? node : null;
  const inAuto = Boolean(parent && parent.layoutMode !== "none");
  const [sides, setSides] = useState(false);
  const text = node.type === "text" ? node : null;
  const hSizing = node.sizingH ?? (text && text.textAutoResize === "widthHeight" ? "hug" : "fixed");
  const vSizing = node.sizingV ?? (text && text.textAutoResize !== "none" ? "hug" : "fixed");
  const canHug = Boolean(frame && frame.layoutMode !== "none") || Boolean(text);
  const setSizing = (axis: "H" | "V", value: "fixed" | "hug" | "fill") => {
    if (text) {
      const h = axis === "H" ? value : hSizing;
      const v = axis === "V" ? value : vSizing;
      const auto: TextNode["textAutoResize"] = h === "hug" ? "widthHeight" : v === "hug" ? "height" : "none";
      ops.patch(node.id, { textAutoResize: auto, sizingH: h === "fill" ? "fill" : undefined, sizingV: v === "fill" ? "fill" : undefined } as Partial<SceneNode>);
      return;
    }
    ops.patch(node.id, axis === "H" ? { sizingH: value === "fixed" ? undefined : value } : { sizingV: value === "fixed" ? undefined : value });
  };
  const numberVars = variables.filter((v) => v.kind === "number");
  const [limits, setLimits] = useState(false);
  const hasLimits = limits || [node.minWidth, node.maxWidth, node.minHeight, node.maxHeight].some((v) => v !== undefined);
  const sizingMenu = (axis: "H" | "V") => {
    const isW = axis === "H";
    const sizing = isW ? hSizing : vSizing;
    const size = Math.round(isW ? node.width : node.height);
    const bound = isW ? node.widthVar : node.heightVar;
    const minKey = isW ? "minWidth" : "minHeight";
    const maxKey = isW ? "maxWidth" : "maxHeight";
    const items: ChevronItem[] = [
      { label: isW ? `Sabit genişlik (${size})` : `Sabit yükseklik (${size})`, icon: fi(isW ? "24.al.width-minmax" : "24.al.height-minmax", 16), checked: sizing === "fixed", onSelect: () => setSizing(axis, "fixed") },
      ...(canHug ? [{ label: "İçeriği sar", icon: fi(isW ? "24.al.width-hug" : "24.al.height-hug", 16), checked: sizing === "hug", onSelect: () => setSizing(axis, "hug") }] : []),
      ...(inAuto ? [{ label: "Kabı doldur", icon: fi(isW ? "24.al.width-fill" : "24.al.height-fill", 16), checked: sizing === "fill", onSelect: () => setSizing(axis, "fill") }] : []),
      "-",
      { label: node[minKey] === undefined ? (isW ? "Min genişlik ekle…" : "Min yükseklik ekle…") : (isW ? "Min genişliği kaldır" : "Min yüksekliği kaldır"), icon: fi(isW ? "al.width-min" : "al.height-min", 16), onSelect: () => { if (node[minKey] === undefined) { setLimits(true); ops.patch(node.id, { [minKey]: 0 }); } else ops.patch(node.id, { [minKey]: undefined }); } },
      { label: node[maxKey] === undefined ? (isW ? "Maks genişlik ekle…" : "Maks yükseklik ekle…") : (isW ? "Maks genişliği kaldır" : "Maks yüksekliği kaldır"), icon: fi(isW ? "al.width-max" : "al.height-max", 16), onSelect: () => { if (node[maxKey] === undefined) { setLimits(true); ops.patch(node.id, { [maxKey]: size }); } else ops.patch(node.id, { [maxKey]: undefined }); } },
      "-",
      bound
        ? { label: "Değişkeni ayır", icon: fi("detach.small", 16), onSelect: () => ops.patch(node.id, isW ? { widthVar: undefined } : { heightVar: undefined }) }
        : { label: "Değişken uygula…", icon: fi("variable.small", 16), disabled: numberVars.length === 0, hint: numberVars.length ? undefined : "sayı değişkeni yok", items: numberVars.map((v) => ({ label: v.name, hint: String(numberOf({ alias: v.id }, byId)), onSelect: () => ops.patch(node.id, isW ? { widthVar: { alias: v.id }, sizingH: undefined } : { heightVar: { alias: v.id }, sizingV: undefined }) })) },
    ];
    return (
      <ChevronMenu label={isW ? "Genişlik: boyutlanma" : "Yükseklik: boyutlanma"} items={items}>
        {sizing !== "fixed" && <span className="text-[11px] text-[var(--f-text-secondary)]">{sizing === "hug" ? "Sar" : "Doldur"}</span>}
      </ChevronMenu>
    );
  };
  const limitMenu = (key: "minWidth" | "maxWidth" | "minHeight" | "maxHeight") => (
    <ChevronMenu label="Sınır" items={[{ label: "Kaldır", onSelect: () => { ops.patch(node.id, { [key]: undefined }); if ([node.minWidth, node.maxWidth, node.minHeight, node.maxHeight].filter((v) => v !== undefined).length <= 1) setLimits(false); } }]} />
  );
  const flow: "vertical" | "horizontal" | "wrap" | "grid" | "" = frame ? (frame.layoutMode === "none" ? "" : frame.layoutMode === "horizontal" && frame.layoutWrap ? "wrap" : frame.layoutMode) : "";
  const auto = Boolean(frame && frame.layoutMode !== "none");
  const hugAll = () => frame && ops.patch(frame.id, { sizingH: "hug", sizingV: "hug" });
  return (
    <Section
      title={auto ? "Auto layout" : "Yerleşim"}
      icons={
        frame ? (
          auto ? (
            <IconButton label="Auto layout'u kaldır (⇧A)" icon={fi("24.autolayout-vertical")} active onClick={() => ops.setAutoLayout(frame.id, "none")} />
          ) : (
            <>
              <IconButton label="İçeriğe sığdır" icon={fi("24.resize-to-fit.small")} disabled={!frame.children.length} onClick={() => ops.fitToContent(frame.id)} />
              <IconButton label="Auto layout ekle (⇧A)" icon={fi("24.autolayout-add-vertical")} onClick={() => ops.setAutoLayout(frame.id, "vertical")} />
            </>
          )
        ) : (
          <IconButton label="Auto layout'a sar (⇧A)" icon={fi("24.autolayout-add-vertical")} onClick={ops.addAutoLayout} />
        )
      }
    >
      {frame && (
        <PropRow icons={<IconButton label="Sar (wrap)" icon={fi("al.layout-wrap")} active={Boolean(frame.layoutWrap)} disabled={frame.layoutMode !== "horizontal"} onClick={() => ops.patch(frame.id, { layoutWrap: frame.layoutWrap ? undefined : true })} />}>
          <Segmented
            value={flow}
            options={[
              { value: "vertical" as const, label: "Dikey", icon: FLOW_GLYPH.vertical },
              { value: "horizontal" as const, label: "Yatay", icon: FLOW_GLYPH.horizontal },
              { value: "wrap" as const, label: "Sar", icon: FLOW_GLYPH.wrap },
              { value: "grid" as const, label: "Izgara", icon: FLOW_GLYPH.grid },
            ]}
            onChange={(v) => {
              if (!v) return;
              if (frame.layoutMode === "none") ops.setAutoLayout(frame.id, v === "wrap" ? "horizontal" : v);
              ops.patch(frame.id, { layoutMode: v === "wrap" ? "horizontal" : v, layoutWrap: v === "wrap" ? true : undefined, ...(v === "grid" && !frame.gridColumns ? { gridColumns: 2 } : {}) });
            }}
          />
        </PropRow>
      )}
      <PropRow icons={auto ? <IconButton label="İçeriğe sığdır" icon={fi("24.resize-to-fit.small")} onClick={hugAll} /> : <IconButton label={node.lockAspect ? "Oranı serbest bırak" : "Oranı koru"} icon={fi("constrain-proportions")} active={Boolean(node.lockAspect)} onClick={() => ops.patch(node.id, { lockAspect: node.lockAspect ? undefined : true })} />}>
        {node.widthVar ? (
          <BoundNumber label="Genişlik" prefix="W" value={node.widthVar} variables={variables} byId={byId} mode={mode} onChange={(v) => ops.patch(node.id, "alias" in v ? { widthVar: v } : { widthVar: undefined, width: Number(v.value) || 0 })} suffix={sizingMenu("H")} />
        ) : (
          <NumericInput label="Genişlik" prefix="W" value={Math.round(node.width)} min={0} onChange={(width) => ops.patch(node.id, { width, ...(node.lockAspect && node.width ? { height: Math.round((width * node.height) / node.width) } : {}), sizingH: undefined, ...(text ? { textAutoResize: text.textAutoResize === "widthHeight" ? "height" : text.textAutoResize } : {}) } as Partial<SceneNode>)} suffix={sizingMenu("H")} />
        )}
        {node.heightVar ? (
          <BoundNumber label="Yükseklik" prefix="H" value={node.heightVar} variables={variables} byId={byId} mode={mode} onChange={(v) => ops.patch(node.id, "alias" in v ? { heightVar: v } : { heightVar: undefined, height: Number(v.value) || 0 })} suffix={sizingMenu("V")} />
        ) : (
          <NumericInput label="Yükseklik" prefix="H" value={Math.round(node.height)} min={0} onChange={(height) => ops.patch(node.id, { height, ...(node.lockAspect && node.height ? { width: Math.round((height * node.width) / node.height) } : {}), sizingV: undefined, ...(text ? { textAutoResize: "none" } : {}) } as Partial<SceneNode>)} suffix={sizingMenu("V")} />
        )}
      </PropRow>
      {hasLimits && (
        <>
          <PropRow icons={<span className="w-6" />}>
            <NumericInput label="Min genişlik" prefix={<Prefix>{fi("al.width-min")}</Prefix>} value={node.minWidth ?? null} placeholder="Min W" fallback={0} min={0} onChange={(minWidth) => ops.patch(node.id, { minWidth })} onClear={() => ops.patch(node.id, { minWidth: undefined })} suffix={limitMenu("minWidth")} />
            <NumericInput label="Min yükseklik" prefix={<Prefix>{fi("al.height-min")}</Prefix>} value={node.minHeight ?? null} placeholder="Min H" fallback={0} min={0} onChange={(minHeight) => ops.patch(node.id, { minHeight })} onClear={() => ops.patch(node.id, { minHeight: undefined })} suffix={limitMenu("minHeight")} />
          </PropRow>
          <PropRow icons={<span className="w-6" />}>
            <NumericInput label="Maks genişlik" prefix={<Prefix>{fi("al.width-max")}</Prefix>} value={node.maxWidth ?? null} placeholder="Maks W" fallback={Math.round(node.width)} min={0} onChange={(maxWidth) => ops.patch(node.id, { maxWidth })} onClear={() => ops.patch(node.id, { maxWidth: undefined })} suffix={limitMenu("maxWidth")} />
            <NumericInput label="Maks yükseklik" prefix={<Prefix>{fi("al.height-max")}</Prefix>} value={node.maxHeight ?? null} placeholder="Maks H" fallback={Math.round(node.height)} min={0} onChange={(maxHeight) => ops.patch(node.id, { maxHeight })} onClear={() => ops.patch(node.id, { maxHeight: undefined })} suffix={limitMenu("maxHeight")} />
          </PropRow>
        </>
      )}
      {frame && frame.layoutMode === "grid" && (
        <PropRow icons={<span className="w-6" />}>
          <NumericInput label="Sütunlar" prefix={<Prefix>{fi("grid-column")}</Prefix>} value={frame.gridColumns ?? 2} min={1} max={24} onChange={(gridColumns) => ops.patch(frame.id, { gridColumns })} />
          <NumericInput label="Satırlar" prefix={<Prefix>{fi("grid-row")}</Prefix>} value={frame.gridRows ?? null} placeholder="Auto" fallback={1} min={1} max={99} onChange={(gridRows) => ops.patch(frame.id, { gridRows })} onClear={() => ops.patch(frame.id, { gridRows: undefined })} />
        </PropRow>
      )}
      {frame && auto && (
        <>
          <PropRow icons={<IconButton label="Gelişmiş yerleşim ayarları" icon={fi("24.adjust.small")} active={Boolean(frame.strokesInLayout || frame.firstOnTop || frame.baselineAlign)} onClick={(e) => ops.menu(e.currentTarget, [
            { label: "Kenar çizgileri yerleşime dahil", checked: Boolean(frame.strokesInLayout), onSelect: () => ops.patch(frame.id, { strokesInLayout: frame.strokesInLayout ? undefined : true }) },
            "-",
            { label: "Katman sırası: son üstte", checked: !frame.firstOnTop, onSelect: () => ops.patch(frame.id, { firstOnTop: undefined }) },
            { label: "Katman sırası: ilk üstte", checked: Boolean(frame.firstOnTop), onSelect: () => ops.patch(frame.id, { firstOnTop: true }) },
            "-",
            { label: "Metin taban çizgisine hizala", checked: Boolean(frame.baselineAlign), disabled: frame.layoutMode !== "horizontal", onSelect: () => ops.patch(frame.id, { baselineAlign: frame.baselineAlign ? undefined : true }) },
          ])} />}>
            <AlignGrid frame={frame} onChange={(primaryAlign, counterAlign) => ops.patch(frame.id, { primaryAlign, counterAlign })} />
            <div className="flex flex-1 flex-col gap-2 self-start">
              <BoundNumber label="Boşluk" prefix={<Prefix>{fi(frame.layoutMode === "horizontal" ? "al.spacing-horizontal" : "al.spacing-vertical")}</Prefix>} value={frame.itemSpacing} variables={variables} byId={byId} mode={mode} onChange={(itemSpacing) => ops.patch(frame.id, { itemSpacing })} suffix={<ChevronMenu label="Boşluk modu" items={[{ label: "Sabit", checked: frame.primaryAlign !== "spaceBetween", onSelect: () => ops.patch(frame.id, { primaryAlign: frame.primaryAlign === "spaceBetween" ? "min" : frame.primaryAlign }) }, { label: "Auto (eşit dağıt)", checked: frame.primaryAlign === "spaceBetween", onSelect: () => ops.patch(frame.id, { primaryAlign: "spaceBetween" }) }]} />} />
              {frame.layoutWrap && frame.layoutMode === "horizontal" && (
                <BoundNumber label="Satır boşluğu" prefix={<Prefix>{fi("al.spacing-vertical")}</Prefix>} value={frame.counterSpacing ?? frame.itemSpacing} variables={variables} byId={byId} mode={mode} onChange={(counterSpacing) => ops.patch(frame.id, { counterSpacing })} suffix={<ChevronMenu label="Satır boşluğu modu" items={[{ label: "Boşlukla aynı", checked: !frame.counterSpacing, onSelect: () => ops.patch(frame.id, { counterSpacing: undefined }) }, { label: "Ayrı", checked: Boolean(frame.counterSpacing), onSelect: () => ops.patch(frame.id, { counterSpacing: frame.itemSpacing }) }]} />} />
              )}
            </div>
          </PropRow>
          <PropRow icons={<IconButton label="Her kenar ayrı" icon={fi("al.padding-sides")} active={sides} onClick={() => setSides((s) => !s)} />}>
            {sides ? (
              <BoundNumber label="Sol" prefix={<Prefix>{fi("al.padding-left")}</Prefix>} value={frame.paddingLeft} variables={variables} byId={byId} mode={mode} onChange={(paddingLeft) => ops.patch(frame.id, { paddingLeft })} />
            ) : (
              <BoundNumber label="Yatay iç boşluk" prefix={<Prefix>{fi("al.padding-horizontal")}</Prefix>} value={frame.paddingLeft} variables={variables} byId={byId} mode={mode} onChange={(v) => ops.patch(frame.id, { paddingLeft: v, paddingRight: v })} />
            )}
            {sides ? (
              <BoundNumber label="Üst" prefix={<Prefix>{fi("al.padding-top")}</Prefix>} value={frame.paddingTop} variables={variables} byId={byId} mode={mode} onChange={(paddingTop) => ops.patch(frame.id, { paddingTop })} />
            ) : (
              <BoundNumber label="Dikey iç boşluk" prefix={<Prefix>{fi("al.padding-vertical")}</Prefix>} value={frame.paddingTop} variables={variables} byId={byId} mode={mode} onChange={(v) => ops.patch(frame.id, { paddingTop: v, paddingBottom: v })} />
            )}
          </PropRow>
          {sides && (
            <PropRow icons={<span className="w-6" />}>
              <BoundNumber label="Sağ" prefix={<Prefix>{fi("al.padding-right")}</Prefix>} value={frame.paddingRight} variables={variables} byId={byId} mode={mode} onChange={(paddingRight) => ops.patch(frame.id, { paddingRight })} />
              <BoundNumber label="Alt" prefix={<Prefix>{fi("al.padding-bottom")}</Prefix>} value={frame.paddingBottom} variables={variables} byId={byId} mode={mode} onChange={(paddingBottom) => ops.patch(frame.id, { paddingBottom })} />
            </PropRow>
          )}
        </>
      )}
      {frame && (
        <div className="pl-4 pr-10 py-2">
          <Checkbox label="İçeriği kırp" checked={Boolean(frame.clipsContent)} onChange={(clipsContent) => ops.patch(frame.id, { clipsContent })} />
        </div>
      )}
    </Section>
  );
}

function AlignGrid({ frame, onChange }: { frame: FrameNode; onChange: (primary: FrameNode["primaryAlign"], counter: FrameNode["counterAlign"]) => void }) {
  const horizontal = frame.layoutMode === "horizontal";
  const cells: FrameNode["counterAlign"][] = ["min", "center", "max"];
  const glyph = (counter: FrameNode["counterAlign"]): FigmaIconName => {
    const where = counter === "min" ? (horizontal ? "top" : "left") : counter === "center" ? "center" : horizontal ? "bottom" : "right";
    return `16.alg.${frame.layoutWrap && horizontal ? "wrap" : horizontal ? "horizontal" : "vertical"}.${where}` as FigmaIconName;
  };
  return (
    <div className="grid grid-cols-3 w-[72px] h-[72px] shrink-0 p-1 rounded-[5px] bg-[var(--f-bg-secondary)]">
      {cells.map((row) =>
        cells.map((col) => {
          const primary = horizontal ? col : row;
          const counter = horizontal ? row : col;
          const active = (frame.primaryAlign === primary || (frame.primaryAlign === "spaceBetween" && primary === "center")) && frame.counterAlign === counter;
          return (
            <button key={`${row}${col}`} type="button" aria-label={`${row} ${col}`} aria-pressed={active} onClick={() => onChange(frame.primaryAlign === "spaceBetween" ? "spaceBetween" : primary, counter)} className={cn("flex items-center justify-center cursor-pointer", active ? "text-[var(--f-text-brand)]" : "text-[var(--f-icon-tertiary)] hover:text-[var(--f-icon)]")}>
              {active ? fi(glyph(counter)) : fi("16.autolayoutgrid.dot")}
            </button>
          );
        })
      )}
    </div>
  );
}

function AppearanceSection({ node, ops, variables, byId, mode }: { node: SceneNode; ops: EditorOps; variables: DesignVariable[]; byId: Map<string, DesignVariable>; mode: ThemeMode }) {
  const geo = node.type !== "text" ? node : null;
  const [independent, setIndependent] = useState(Boolean(geo?.corners));
  const rounded = geo && node.type !== "ellipse" && node.type !== "line";
  return (
    <Section
      title="Görünüş"
      pb={12}
      icons={
        <>
          <IconButton label="Karışım modu" icon={fi(node.blendMode && node.blendMode !== "pass-through" ? "blendmode.active.small" : "blendmode.small")} active={Boolean(node.blendMode && node.blendMode !== "pass-through")} onClick={(e) => ops.menu(e.currentTarget, BLEND_MODES.map((b) => ({ label: b.label, checked: (node.blendMode ?? "pass-through") === b.value, onSelect: () => ops.patch(node.id, { blendMode: b.value === "pass-through" ? undefined : b.value }) })))} />
          <IconButton label={node.visible === false ? "Göster" : "Gizle"} icon={fi(node.visible === false ? "hidden.small" : "eye.small")} onClick={() => ops.patch(node.id, { visible: node.visible === false ? undefined : false })} />
        </>
      }
    >
      <PropRow icons={rounded ? <IconButton label="Her köşe ayrı" icon={fi("corners.independent")} active={independent} onClick={() => setIndependent((v) => !v)} /> : <span className="w-6" />}>
        <NumericInput label="Opaklık" prefix={<Prefix>{fi("opacity")}</Prefix>} value={node.opacity ?? 100} min={0} max={100} unit="%" onChange={(opacity) => ops.patch(node.id, { opacity: opacity >= 100 ? undefined : opacity })} />
        {rounded ? (
          <BoundNumber label="Köşe yuvarlaklığı" prefix={<Prefix>{fi("corners")}</Prefix>} value={geo!.cornerRadius} variables={variables} byId={byId} mode={mode} min={0} onChange={(cornerRadius) => ops.patch(node.id, { cornerRadius, corners: undefined } as Partial<SceneNode>)} />
        ) : (
          <span className="flex-1" />
        )}
      </PropRow>
      {rounded && independent && (
        <>
          <PropRow icons={<span className="w-6" />}>
            {([0, 1] as const).map((i) => <CornerField key={i} geo={geo!} index={i} node={node} ops={ops} variables={variables} byId={byId} mode={mode} />)}
          </PropRow>
          <PropRow icons={<span className="w-6" />}>
            {([3, 2] as const).map((i) => <CornerField key={i} geo={geo!} index={i} node={node} ops={ops} variables={variables} byId={byId} mode={mode} />)}
          </PropRow>
        </>
      )}
    </Section>
  );
}

function CornerField({ geo, index, node, ops, variables, byId, mode }: { geo: FrameNode | (SceneNode & { type: "rectangle" | "ellipse" | "line" }); index: 0 | 1 | 2 | 3; node: SceneNode; ops: EditorOps; variables: DesignVariable[]; byId: Map<string, DesignVariable>; mode: ThemeMode }) {
  const base = geo.cornerRadius ?? own(0);
  const corners = geo.corners ?? [base, base, base, base];
  const icons = ["radius.top.left", "radius.top.right", "radius.bottom.right", "radius.bottom.left"] as const;
  return (
    <BoundNumber
      label={icons[index]}
      prefix={<Prefix>{fi(icons[index])}</Prefix>}
      value={corners[index]}
      variables={variables}
      byId={byId}
      mode={mode}
      min={0}
      onChange={(v) => {
        const next = [...corners] as [VariableValue, VariableValue, VariableValue, VariableValue];
        next[index] = v;
        ops.patch(node.id, { corners: next } as Partial<SceneNode>);
      }}
    />
  );
}

function FillSection({ node, ops, variables, byId, mode, compositeId }: { node: SceneNode; ops: EditorOps; variables: DesignVariable[]; byId: Map<string, DesignVariable>; mode: ThemeMode; compositeId?: string }) {
  const fills = node.fills ?? [];
  const setFills = (next: Paint[]) => (compositeId ? ops.override(compositeId, { fills: next }) : ops.patch(node.id, { fills: next } as Partial<SceneNode>));
  return (
    <Section title="Dolgu" muted={fills.length === 0} pb={fills.length ? 12 : 0} icons={<><IconButton label="Stiller ve değişkenler" icon={fi("styles")} onClick={ops.openVariables} /><IconButton label="Dolgu ekle" icon={fi("plus.small")} onClick={() => setFills([{ color: own(node.type === "text" ? "#000000" : "#d9d9d9") }, ...fills])} /></>}>
      {fills.map((paint, i) => (
        <PaintRow key={i} paint={paint} variables={variables} byId={byId} mode={mode} pageColors={ops.pageColors} ops={ops} onChange={(p) => setFills(fills.map((f, j) => (j === i ? p : f)))} onRemove={() => setFills(fills.filter((_, j) => j !== i))} />
      ))}
    </Section>
  );
}

function StrokeSection({ node, ops, variables, byId, mode, compositeId }: { node: FrameNode | (SceneNode & { type: "rectangle" | "ellipse" | "line" }); ops: EditorOps; variables: DesignVariable[]; byId: Map<string, DesignVariable>; mode: ThemeMode; compositeId?: string }) {
  const strokes = node.strokes ?? [];
  const setStrokes = (next: StrokeStyle[]) => (compositeId ? ops.override(compositeId, { strokes: next }) : ops.patch(node.id, { strokes: next } as Partial<SceneNode>));
  return (
    <Section title="Kenar çizgisi" muted={strokes.length === 0} pb={strokes.length ? 12 : 0} icons={<IconButton label="Kenar çizgisi ekle" icon={fi("plus.small")} onClick={() => setStrokes([{ color: own("#000000"), weight: own(1), align: "inside" }, ...strokes])} />}>
      {strokes.map((stroke, i) => (
        <div key={i} className="flex flex-col">
          <PaintRow paint={stroke} variables={variables} byId={byId} mode={mode} pageColors={ops.pageColors} ops={ops} onChange={(s) => setStrokes(strokes.map((x, j) => (j === i ? s : x)))} onRemove={() => setStrokes(strokes.filter((_, j) => j !== i))} />
          <PropRow icons={<span className="w-6" />}>
            <Select label="Konum" value={stroke.align} options={[{ value: "inside", label: "İçeride" }, { value: "center", label: "Ortada" }, { value: "outside", label: "Dışarıda" }]} onChange={(align) => setStrokes(strokes.map((x, j) => (j === i ? { ...x, align: align as StrokeStyle["align"] } : x)))} />
            <BoundNumber label="Kalınlık" prefix={<Prefix>{fi("stroke-weight")}</Prefix>} value={stroke.weight} variables={variables} byId={byId} mode={mode} min={0} onChange={(weight) => setStrokes(strokes.map((x, j) => (j === i ? { ...x, weight } : x)))} />
          </PropRow>
          {node.type !== "line" && (
            <PropRow icons={<span className="w-6" />}>
              <Select label="Çizgi stili" value={stroke.dashed ? "dashed" : "solid"} options={[{ value: "solid", label: "Düz" }, { value: "dashed", label: "Kesikli" }]} onChange={(v) => setStrokes(strokes.map((x, j) => (j === i ? { ...x, dashed: v === "dashed" ? true : undefined } : x)))} />
              <div className="flex flex-1 items-center h-6 rounded-[5px] bg-[var(--f-bg-secondary)]">
                {(["top", "right", "bottom", "left"] as const).map((side) => {
                  const sides = stroke.sides ?? { top: true, right: true, bottom: true, left: true };
                  const toggle = () => { const next = { ...sides, [side]: !sides[side] }; const all = next.top && next.right && next.bottom && next.left; setStrokes(strokes.map((x, j) => (j === i ? { ...x, sides: all ? undefined : next } : x))); };
                  return <IconButton key={side} label={{ top: "Üst kenar", right: "Sağ kenar", bottom: "Alt kenar", left: "Sol kenar" }[side]} icon={fi(`al.padding-${side}` as FigmaIconName)} active={sides[side]} onClick={toggle} className="flex-1" />;
                })}
              </div>
            </PropRow>
          )}
        </div>
      ))}
    </Section>
  );
}

function EffectsSection({ node, ops, pageColors }: { node: FrameNode | (SceneNode & { type: "rectangle" | "ellipse" | "line" }); ops: EditorOps; pageColors: string[] }) {
  const effects = node.effects ?? [];
  const [editing, setEditing] = useState<{ index: number; anchor: { top: number; right: number } } | null>(null);
  const set = (next: Effect[]) => ops.patch(node.id, { effects: next } as Partial<SceneNode>);
  const add = (el: HTMLElement) =>
    ops.menu(el, (["innerShadow", "dropShadow", "layerBlur", "backgroundBlur"] as Effect["type"][]).map((type) => ({ label: EFFECT_LABEL[type], onSelect: () => set([...effects, newEffect(type)]) })));
  const current = editing ? effects[editing.index] : null;
  const style = node.effectStyle ? ops.effectStyles.find((st) => st.id === node.effectStyle) : null;
  const stylesMenu = (el: HTMLElement) =>
    ops.menu(el, [
      ...ops.effectStyles.map((st) => ({ label: st.name, checked: st.id === node.effectStyle, onSelect: () => ops.applyEffectStyle(node.id, st.id) })),
      ...(ops.effectStyles.length ? ["-" as const] : []),
      { label: "Efekt stili oluştur", disabled: !effects.length, onSelect: () => ops.createEffectStyle(node.id) },
      ...(node.effectStyle ? [{ label: "Stilden ayır", onSelect: () => ops.detachEffectStyle(node.id) }] : []),
    ]);
  return (
    <Section title="Efektler" muted={effects.length === 0 && !style} pb={effects.length || style ? 12 : 0} icons={<><IconButton label="Efekt stilleri" icon={fi("styles")} active={Boolean(style)} onClick={(e) => stylesMenu(e.currentTarget)} /><IconButton label="Efekt ekle" icon={fi("plus.small")} onClick={(e) => add(e.currentTarget)} /></>}>
      {style && (
        <PropRow icons={<IconButton label="Stilden ayır" icon={fi("detach.small")} onClick={() => ops.detachEffectStyle(node.id)} />}>
          <button type="button" onClick={(e) => stylesMenu(e.currentTarget)} className="flex flex-1 min-w-0 items-center gap-1 h-6 px-1 rounded-[5px] bg-[var(--f-bg-secondary)] text-left cursor-pointer">
            <span className="flex w-4 h-4 shrink-0 items-center justify-center overflow-hidden">{fi("24.effects.small", 16, "-m-1")}</span>
            <span className="truncate text-[11px] text-[var(--f-text)]">{style.name}</span>
          </button>
        </PropRow>
      )}
      {!style && effects.map((e, i) => (
        <PropRow key={i} icons={<><IconButton label={e.visible === false ? "Göster" : "Gizle"} icon={fi(e.visible === false ? "hidden.small" : "eye.small")} onClick={() => set(effects.map((x, j) => (j === i ? { ...x, visible: x.visible === false ? undefined : false } : x)))} /><IconButton label="Kaldır" icon={fi("minus.small")} onClick={() => { setEditing(null); set(effects.filter((_, j) => j !== i)); }} /></>}>
          <button type="button" data-picker-anchor="" onClick={(ev) => setEditing(editing?.index === i ? null : { index: i, anchor: anchorOf(ev.currentTarget) })} className={cn("flex flex-1 min-w-0 items-center gap-1 h-6 px-1 rounded-[5px] text-left cursor-pointer", editing?.index === i ? "bg-[var(--f-bg-selected)] text-[var(--f-text-brand)]" : "bg-[var(--f-bg-secondary)] text-[var(--f-text)]")}>
            <span className="flex w-4 h-4 shrink-0 items-center justify-center overflow-hidden"><EffectGlyph type={e.type} /></span>
            <span className="truncate text-[11px]">{EFFECT_LABEL[e.type]}</span>
          </button>
        </PropRow>
      ))}
      {editing && current && (
        <EffectPopover effect={current} anchor={editing.anchor} pageColors={pageColors} onChange={(next) => set(effects.map((x, j) => (j === editing.index ? next : x)))} onClose={() => setEditing(null)} />
      )}
    </Section>
  );
}

function EffectGlyph({ type }: { type: Effect["type"] }) {
  return fi(type === "dropShadow" ? "24.drop.shadow.mid.small" : type === "innerShadow" ? "24.inner.shadow.top.left.small" : type === "layerBlur" ? "24.layer.blur.small" : "24.background.blur.small", 16, "-m-1");
}

/** Figma's effect window beside the panel: the effect's kind under a chevron, its values in labelled rows. */
function EffectPopover({ effect, anchor, pageColors, onChange, onClose }: { effect: Effect; anchor: { top: number; right: number }; pageColors: string[]; onChange: (effect: Effect) => void; onClose: () => void }) {
  const [picker, setPicker] = useState<{ top: number; right: number } | null>(null);
  const top = Math.max(8, Math.min(anchor.top - 12, window.innerHeight - 360));
  const left = Math.max(8, anchor.right - 320 - 8);
  const shadow = effect.type === "dropShadow" || effect.type === "innerShadow" ? effect : null;
  const blur = effect.type === "layerBlur" || effect.type === "backgroundBlur" ? effect : null;
  const row = (label: string, field: ReactNode) => (
    <div className="flex items-center gap-2 h-8 px-4">
      <span className="w-[100px] shrink-0 text-[11px] text-[var(--f-text-secondary)]">{label}</span>
      <div className="flex flex-1 min-w-0 items-center gap-2">{field}</div>
    </div>
  );
  return (
    <div role="dialog" aria-label={EFFECT_LABEL[effect.type]} className="fixed z-40 flex w-[320px] flex-col rounded-[13px] bg-[var(--f-bg)] shadow-[0_0_0.5px_rgba(0,0,0,0.3),0_10px_16px_rgba(0,0,0,0.2)] text-[11px] leading-4 text-[var(--f-text)]" style={{ top, left }} onPointerDown={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-between h-12 pl-4 pr-2 border-b border-[var(--f-border)]">
        <ChevronMenu label="Efekt türü" width={200} items={(Object.keys(EFFECT_LABEL) as Effect["type"][]).map((t) => ({ label: EFFECT_LABEL[t], checked: t === effect.type, onSelect: () => onChange(t === effect.type ? effect : { ...newEffect(t), visible: effect.visible }) }))}>
          <span className="flex items-center gap-2"><span className="flex w-4 h-4 items-center justify-center overflow-hidden"><EffectGlyph type={effect.type} /></span><span className="text-[13px] font-[550] leading-[22px]">{EFFECT_LABEL[effect.type]}</span></span>
        </ChevronMenu>
        <div className="flex items-center gap-2">
          <IconButton label="Kapat" icon={fi("close.small")} onClick={onClose} />
        </div>
      </div>
      <div className="flex flex-col py-2">
        {shadow ? (
          <>
            {row("Konum", <><NumericInput label="X" prefix="X" value={shadow.x} onChange={(x) => onChange({ ...shadow, x })} /><NumericInput label="Y" prefix="Y" value={shadow.y} onChange={(y) => onChange({ ...shadow, y })} /></>)}
            {row("Bulanıklık", <NumericInput label="Bulanıklık" prefix={<Prefix>{fi("opacity")}</Prefix>} value={shadow.blur} min={0} onChange={(blur) => onChange({ ...shadow, blur })} />)}
            {row("Yayılma", <NumericInput label="Yayılma" prefix={<Prefix>{fi("24.spread.small")}</Prefix>} value={shadow.spread} onChange={(spread) => onChange({ ...shadow, spread })} />)}
            {row("Renk", (
              <div className="relative flex flex-1">
                <ColorInput label="Gölge rengi" color={shadow.color} opacity={shadow.opacity} onColor={(color) => onChange({ ...shadow, color })} onOpacity={(opacity) => onChange({ ...shadow, opacity })} chit={<button type="button" data-picker-anchor="" aria-label="Renk seçici" onClick={(e) => setPicker(picker ? null : anchorOf(e.currentTarget))} className="cursor-pointer"><Chit color={shadow.color} /></button>} />
                {picker && <ColorPicker color={shadow.color} opacity={shadow.opacity} anchor={{ top: picker.top, right: left - 4 }} variables={[]} byId={new Map()} mode="light" pageColors={pageColors} onChange={(color, opacity) => onChange({ ...shadow, color, opacity })} onClose={() => setPicker(null)} />}
              </div>
            ))}
          </>
        ) : blur ? (
          row("Bulanıklık", <NumericInput label="Bulanıklık" prefix={<Prefix>{fi("opacity")}</Prefix>} value={blur.radius} min={0} onChange={(radius) => onChange({ ...blur, radius })} />)
        ) : null}
      </div>
    </div>
  );
}

function TextSection({ node, ops, variables, byId, mode, textStyles, lang, compositeId }: { node: TextNode; ops: EditorOps; variables: DesignVariable[]; byId: Map<string, DesignVariable>; mode: ThemeMode; textStyles: TextStyle[]; lang: "tr" | "en"; compositeId?: string }) {
  const weights = [300, 400, 500, 600, 700];
  const text = lang === "en" ? node.charactersEn ?? "" : node.characters;
  const setText = (value: string) => (compositeId ? ops.override(compositeId, lang === "en" ? { charactersEn: value } : { characters: value }) : ops.patch(node.id, (lang === "en" ? { charactersEn: value } : { characters: value }) as Partial<SceneNode>));
  return (
    <Section title="Tipografi" pb={12} icons={!compositeId ? <>
      <IconButton label="Metin stilleri" icon={fi("styles")} active={Boolean(node.textStyle)} onClick={(e) => ops.menu(e.currentTarget, [...textStyles.map((st) => ({ label: st.name, checked: st.id === node.textStyle, onSelect: () => ops.patch(node.id, { textStyle: st.id } as Partial<SceneNode>) })), ...(textStyles.length ? ["-" as const] : []), { label: "Metin stili oluştur", onSelect: () => ops.createTextStyle(node.id) }, ...(node.textStyle ? [{ label: "Stilden ayır", onSelect: () => ops.patch(node.id, { textStyle: undefined } as Partial<SceneNode>) }] : [])])} />
      <IconButton label="Yazı ayarları" icon={fi("24.adjust.small")} active={Boolean(node.textCase || node.textDecoration || (node.verticalAlign && node.verticalAlign !== "top"))} onClick={(e) => ops.menu(e.currentTarget, [
        { label: "Harf durumu: olduğu gibi", checked: !node.textCase, onSelect: () => ops.patch(node.id, { textCase: undefined } as Partial<SceneNode>) },
        { label: "BÜYÜK HARF", checked: node.textCase === "upper", onSelect: () => ops.patch(node.id, { textCase: "upper" } as Partial<SceneNode>) },
        { label: "küçük harf", checked: node.textCase === "lower", onSelect: () => ops.patch(node.id, { textCase: "lower" } as Partial<SceneNode>) },
        { label: "İlk Harfler Büyük", checked: node.textCase === "title", onSelect: () => ops.patch(node.id, { textCase: "title" } as Partial<SceneNode>) },
        "-",
        { label: "Süsleme yok", checked: !node.textDecoration, onSelect: () => ops.patch(node.id, { textDecoration: undefined } as Partial<SceneNode>) },
        { label: "Altı çizili", checked: node.textDecoration === "underline", onSelect: () => ops.patch(node.id, { textDecoration: "underline" } as Partial<SceneNode>) },
        { label: "Üstü çizili", checked: node.textDecoration === "strikethrough", onSelect: () => ops.patch(node.id, { textDecoration: "strikethrough" } as Partial<SceneNode>) },
        "-",
        { label: "Dikey: üst", checked: !node.verticalAlign || node.verticalAlign === "top", disabled: node.textAutoResize !== "none", onSelect: () => ops.patch(node.id, { verticalAlign: undefined } as Partial<SceneNode>) },
        { label: "Dikey: orta", checked: node.verticalAlign === "middle", disabled: node.textAutoResize !== "none", onSelect: () => ops.patch(node.id, { verticalAlign: "middle" } as Partial<SceneNode>) },
        { label: "Dikey: alt", checked: node.verticalAlign === "bottom", disabled: node.textAutoResize !== "none", onSelect: () => ops.patch(node.id, { verticalAlign: "bottom" } as Partial<SceneNode>) },
      ])} />
    </> : undefined}>
      <div className="pl-4 pr-2 py-1">
        <textarea aria-label="Metin" value={text} placeholder={lang === "en" ? node.characters : "Metin"} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.stopPropagation()} rows={2} className="w-full resize-none rounded-[5px] border border-transparent bg-[var(--f-bg-secondary)] px-2 py-1 text-[11px] leading-4 text-[var(--f-text)] placeholder:text-[var(--f-text-secondary)] hover:border-[var(--f-border)] focus:outline-none focus:border-[var(--f-border-selected)]" />
      </div>
      {!compositeId && (
        <>
          <PropRow icons={<span className="w-6" />}>
            <Select label="Metin stili" value={node.textStyle ?? ""} options={[{ value: "", label: "Inter" }, ...textStyles.map((s) => ({ value: s.id, label: s.name }))]} onChange={(textStyle) => ops.patch(node.id, { textStyle: textStyle || undefined } as Partial<SceneNode>)} />
          </PropRow>
          <PropRow icons={<span className="w-6" />}>
            <Select label="Kalınlık" value={String(numberOf(node.fontWeight, byId, 400))} options={weights.map((w) => ({ value: String(w), label: weightLabel(w) }))} onChange={(w) => ops.patch(node.id, { fontWeight: own(Number(w)) } as Partial<SceneNode>)} />
            <BoundNumber label="Yazı boyutu" prefix={<Prefix><span className="text-[10px]">Aa</span></Prefix>} value={node.fontSize} variables={variables} byId={byId} mode={mode} min={1} onChange={(fontSize) => ops.patch(node.id, { fontSize } as Partial<SceneNode>)} />
          </PropRow>
          <PropRow icons={<span className="w-6" />}>
            <NumericInput label="Satır yüksekliği" prefix={<Prefix>{fi("al.height-min")}</Prefix>} value={node.lineHeight ? numberOf(node.lineHeight, byId) : null} placeholder="Auto" fallback={Math.round(numberOf(node.fontSize, byId, 16) * 1.25)} min={0} onChange={(v) => ops.patch(node.id, { lineHeight: own(v) } as Partial<SceneNode>)} onClear={() => ops.patch(node.id, { lineHeight: undefined } as Partial<SceneNode>)} />
            <NumericInput label="Harf aralığı" prefix={<Prefix>{fi("al.width-min")}</Prefix>} value={node.letterSpacing ? numberOf(node.letterSpacing, byId) : null} placeholder="0" fallback={0} min={-20} onChange={(v) => ops.patch(node.id, { letterSpacing: own(v) } as Partial<SceneNode>)} onClear={() => ops.patch(node.id, { letterSpacing: undefined } as Partial<SceneNode>)} />
          </PropRow>
          <PropRow icons={<span className="w-6" />}>
            <Segmented
              value={node.textAlign}
              options={[
                { value: "left" as const, label: "Sola", icon: fi("24.text.align-left") },
                { value: "center" as const, label: "Ortaya", icon: fi("24.text.align-center") },
                { value: "right" as const, label: "Sağa", icon: fi("24.text.align-right") },
              ]}
              onChange={(textAlign) => ops.patch(node.id, { textAlign } as Partial<SceneNode>)}
            />
            <Segmented
              value={node.textAutoResize}
              options={[
                { value: "widthHeight" as const, label: "Genişlik + yükseklik", icon: fi("24.text.resize-width") },
                { value: "height" as const, label: "Yükseklik", icon: fi("24.text.resize-height") },
                { value: "none" as const, label: "Sabit", icon: fi("24.text.resize-fixed") },
              ]}
              onChange={(v) => ops.patch(node.id, { textAutoResize: v } as Partial<SceneNode>)}
            />
          </PropRow>
        </>
      )}
    </Section>
  );
}

function ComponentSection({ node, nodes, ops }: { node: FrameNode; nodes: SceneNode[]; ops: EditorOps }) {
  const set = setOf(nodes, node.id);
  const props = set ? variantProperties(set) : [];
  return (
    <Section title={set ? "Varyant" : "Bileşen"} icons={<IconButton label="Varyant ekle" icon={fi("plus.small")} onClick={() => ops.addVariant(node.id)} />}>
      {set ? (
        props.map((p) => (
          <div key={p.name}>
            <Labels a={p.name} />
            <PropRow icons={<span className="w-6" />}>
              <TextInput label={p.name} value={variantValue(node, p.name)} onCommit={(v) => ops.setVariantValue(node.id, p.name, v)} />
            </PropRow>
          </div>
        ))
      ) : (
        <p className="px-4 pt-1 text-[11px] leading-4 text-[var(--f-text-secondary)]">Ana bileşen: örnekleri (⌘D, Varlıklar) onu izler. &quot;+&quot; bir varyant ekler.</p>
      )}
    </Section>
  );
}

function ComponentSetSection({ set, ops }: { set: FrameNode; ops: EditorOps }) {
  const props = variantProperties(set);
  return (
    <Section title="Özellikler" icons={<IconButton label="Özellik ekle" icon={fi("plus.small")} onClick={() => ops.addProperty(set.id)} />}>
      {props.map((p) => (
        <div key={p.name} className="flex flex-col">
          <PropRow icons={<IconButton label="Özelliği kaldır" icon={fi("minus.small")} onClick={() => ops.removeProperty(set.id, p.name)} />}>
            <TextInput label="Özellik adı" value={p.name} onCommit={(to) => to.trim() && to.trim() !== p.name && ops.renameProperty(set.id, p.name, to.trim())} />
          </PropRow>
          <div className="flex flex-wrap gap-1 pl-4 pr-2 pb-1">
            {p.values.map((v) => (
              <input key={v} aria-label={`${p.name} değeri`} defaultValue={v} onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== v && ops.renameValue(set.id, p.name, v, e.target.value.trim())} className="h-5 px-1.5 rounded-[3px] bg-[var(--f-bg-secondary)] text-[11px] text-[var(--f-text)] outline-none border border-transparent focus:border-[var(--f-border-selected)]" style={{ width: `${Math.max(4, v.length + 2)}ch` }} />
            ))}
          </div>
        </div>
      ))}
      <p className="px-4 pt-1 text-[11px] leading-4 text-[var(--f-text-secondary)]">{variantsOf(set).length} varyant.</p>
    </Section>
  );
}

function InstanceSection({ node, nodes, ops }: { node: FrameNode; nodes: SceneNode[]; ops: EditorOps }) {
  const main = node.mainId ? findComponent(nodes, node.mainId) : null;
  const set = main ? setOf(nodes, main.id) : null;
  const props = set ? variantProperties(set) : [];
  const overridden = Boolean(node.overrides && Object.keys(node.overrides).length);
  return (
    <Section title="Örnek" icons={<>{overridden && <IconButton label="Değişiklikleri sıfırla" icon={fi("reset.instance.small")} onClick={ops.resetOverrides} />}<IconButton label="Ana bileşene git" icon={fi("go.to.main.component.small")} onClick={ops.goToMain} /><IconButton label="Örneği ayır (⌥⌘B)" icon={fi("detach.small")} onClick={ops.detach} /></>}>
      <PropRow icons={<span className="w-6" />}>
        <div className="flex flex-1 items-center gap-1 h-6 px-1 rounded-[5px] bg-[var(--f-bg-secondary)] text-[11px] text-[var(--f-text-component)]">
          <FigmaIcon name="16.instance" />
          <span className="truncate">{main ? (set ? set.name : main.name) : "Ana bileşen yok"}</span>
        </div>
      </PropRow>
      {props.map((p) => (
        <div key={p.name}>
          <Labels a={p.name} />
          <PropRow icons={<span className="w-6" />}>
            <Select label={p.name} value={main ? variantValue(main, p.name) : ""} options={p.values.map((v) => ({ value: v, label: v }))} onChange={(v) => ops.swapVariant(node.id, p.name, v)} />
          </PropRow>
        </div>
      ))}
    </Section>
  );
}

// ── Prototype ─────────────────────────────────────────────────────────────────

function PrototypeSection({ node, nodes, ops, flows }: { node: SceneNode | null; nodes: SceneNode[]; ops: EditorOps; flows: { id: string; name: string }[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const variant = node?.type === "component" ? node : node?.type === "instance" && node.mainId ? findComponent(nodes, node.mainId) : null;
  const set = variant ? setOf(nodes, variant.id) : null;
  const flowsGroup = (
    <Section title="Akışlar" muted={flows.length === 0}>
      {flows.map((f) => (
        <div key={f.id} className="px-2 py-0.5">
          <button type="button" onClick={() => ops.preview(f.id)} className="flex items-center gap-2 w-full h-6 px-2 rounded-[5px] text-left hover:bg-[var(--f-bg-hover)] cursor-pointer">
            <span className="flex w-4 shrink-0 justify-center text-[var(--f-icon)]">{fi("24.play.small", 16)}</span>
            <span className="min-w-0 flex-1 truncate text-[11px] text-[var(--f-text)]">{f.name}</span>
          </button>
        </div>
      ))}
    </Section>
  );
  if (!variant || !set) {
    return (
      <>
        <Section title="Etkileşimler" muted>
          <p className="px-4 pt-1 text-[11px] leading-4 text-[var(--f-text-secondary)]">{node ? "Bir bileşen setinin varyantını seç: etkileşimler orada kurulur." : "Bir varyant ya da örnek seç."}</p>
        </Section>
        {flowsGroup}
      </>
    );
  }
  const reactions = variant.reactions ?? [];
  const others = variantsOf(set).filter((v) => v.id !== variant.id);
  const set_ = (next: Reaction[]) => ops.setReactions(variant.id, next);
  const nameOf = (id: string) => { const v = getNode(nodes, id); return v && v.type === "component" ? variantName(v) : "—"; };
  return (
    <>
      <Section title="Etkileşimler" muted={reactions.length === 0} icons={<IconButton label="Etkileşim ekle" icon={fi("plus.small")} onClick={() => { const r: Reaction = { id: nid("r"), trigger: "click", target: others[0]?.id ?? variant.id, animation: "smart", easing: "ease-out", duration: 300 }; set_([...reactions, r]); setOpenId(r.id); }} />}>
        {reactions.map((r) => {
          const patch = (p: Partial<Reaction>) => set_(reactions.map((x) => (x.id === r.id ? { ...x, ...p } : x)));
          const open = openId === r.id;
          return (
            <div key={r.id} className="flex flex-col">
              <div className="px-2 py-0.5">
                <div className={cn("group/reaction flex items-center gap-2 h-8 px-2 rounded-[5px] cursor-pointer hover:bg-[var(--f-bg-hover)]", open && "bg-[var(--f-bg-selected)]")} onClick={() => setOpenId(open ? null : r.id)}>
                  <div className="min-w-0 flex-1 flex flex-col leading-4">
                    <span className="truncate text-[11px] text-[var(--f-text)]">{TRIGGERS[r.trigger]}</span>
                    <span className="truncate text-[11px] text-[var(--f-text-secondary)]">Şuna geç: {nameOf(r.target)}</span>
                  </div>
                  <span className="hidden group-hover/reaction:flex" onClick={(e) => e.stopPropagation()}>
                    <IconButton label="Kaldır" icon={fi("minus.small")} onClick={() => set_(reactions.filter((x) => x.id !== r.id))} />
                  </span>
                </div>
              </div>
              {open && (
                <div className="flex flex-col pb-1">
                  <Labels a="Tetikleyici" />
                  <PropRow icons={<span className="w-6" />}>
                    <Select label="Tetikleyici" value={r.trigger} options={(Object.keys(TRIGGERS) as InteractionTrigger[]).map((t) => ({ value: t, label: TRIGGERS[t] }))} onChange={(trigger) => patch({ trigger: trigger as InteractionTrigger })} />
                    {r.trigger === "delay" ? <NumericInput label="Gecikme" prefix={<Prefix>ms</Prefix>} value={r.delay ?? 800} min={0} onChange={(delay) => patch({ delay })} /> : <span className="flex-1" />}
                  </PropRow>
                  <Labels a="Eylem" />
                  <PropRow icons={<span className="w-6" />}>
                    <Select label="Hedef varyant" value={r.target} options={variantsOf(set).map((v) => ({ value: v.id, label: `Şuna geç: ${variantName(v)}` }))} onChange={(target) => patch({ target })} />
                  </PropRow>
                  <Labels a="Animasyon" />
                  <PropRow icons={<span className="w-6" />}>
                    <Select label="Animasyon" value={r.animation} options={(Object.keys(ANIMATIONS) as InteractionAnimation[]).map((a) => ({ value: a, label: ANIMATIONS[a] }))} onChange={(animation) => patch({ animation: animation as InteractionAnimation })} />
                  </PropRow>
                  {r.animation !== "instant" && (
                    <PropRow icons={<span className="w-6" />}>
                      <Select label="Eğri" value={r.easing} options={(Object.keys(EASINGS) as InteractionEasing[]).map((e) => ({ value: e, label: EASINGS[e].label }))} onChange={(easing) => patch({ easing: easing as InteractionEasing })} />
                      <NumericInput label="Süre" prefix={<Prefix>ms</Prefix>} value={r.duration} min={0} onChange={(duration) => patch({ duration })} />
                    </PropRow>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </Section>
      {flowsGroup}
    </>
  );
}

/** Figma's Layout guide: a frame's layout grids — columns, rows or a square grid, each with its counts, gutter, margin and colour. */
function LayoutGuideSection({ frame, ops }: { frame: FrameNode; ops: EditorOps }) {
  const grids = frame.layoutGrids ?? [];
  const set = (next: LayoutGrid[]) => ops.patch(frame.id, { layoutGrids: next.length ? next : undefined });
  const at = (i: number, patch: Partial<LayoutGrid>) => set(grids.map((g, j) => (j === i ? { ...g, ...patch } : g)));
  return (
    <Section title="Yerleşim kılavuzu" muted={!grids.length} pb={grids.length ? 12 : 0} icons={<IconButton label="Kılavuz ekle" icon={fi("plus.small")} onClick={(e) => ops.menu(e.currentTarget, (["columns", "rows", "grid"] as LayoutGrid["type"][]).map((t) => ({ label: LAYOUT_GRID_LABEL[t], onSelect: () => set([...grids, newLayoutGrid(t)]) })))} />}>
      {grids.map((g, i) => (
        <div key={i} className="flex flex-col">
          <PropRow icons={<><IconButton label={g.visible === false ? "Göster" : "Gizle"} icon={fi(g.visible === false ? "hidden.small" : "eye.small")} onClick={() => at(i, { visible: g.visible === false ? undefined : false })} /><IconButton label="Kaldır" icon={fi("minus.small")} onClick={() => set(grids.filter((_, j) => j !== i))} /></>}>
            <Select label="Kılavuz türü" value={g.type} options={(["columns", "rows", "grid"] as LayoutGrid["type"][]).map((t) => ({ value: t, label: LAYOUT_GRID_LABEL[t] }))} onChange={(type) => at(i, { type: type as LayoutGrid["type"] })} />
            {g.type === "grid" ? (
              <NumericInput label="Hücre" prefix={<Prefix>{fi("24.grid", 16)}</Prefix>} value={g.size} min={1} unit="px" onChange={(size) => at(i, { size })} />
            ) : (
              <NumericInput label="Sayı" prefix={<Prefix>{fi(g.type === "columns" ? "grid-column" : "grid-row")}</Prefix>} value={g.count} min={1} max={100} onChange={(count) => at(i, { count })} />
            )}
          </PropRow>
          {g.type !== "grid" && (
            <PropRow icons={<span className="w-6" />}>
              <NumericInput label="Aralık" prefix={<Prefix>{fi(g.type === "columns" ? "al.spacing-horizontal" : "al.spacing-vertical")}</Prefix>} value={g.gutter} min={0} onChange={(gutter) => at(i, { gutter })} />
              <NumericInput label="Kenar boşluğu" prefix={<Prefix>{fi("al.padding-horizontal")}</Prefix>} value={g.margin} min={0} onChange={(margin) => at(i, { margin })} />
            </PropRow>
          )}
          <PropRow icons={<span className="w-6" />}>
            <ColorInput label="Kılavuz rengi" color={g.color} opacity={g.opacity} onColor={(color) => at(i, { color })} onOpacity={(opacity) => at(i, { opacity })} />
          </PropRow>
        </div>
      ))}
    </Section>
  );
}

/** Figma's Export: the layer's export settings (scale, format) and the button that saves them. */
function ExportSection({ node, ops }: { node: SceneNode; ops: EditorOps }) {
  const settings = node.exports ?? [];
  const set = (next: ExportSetting[]) => ops.patch(node.id, { exports: next.length ? next : undefined });
  return (
    <Section title="Dışa aktar" muted={!settings.length} pb={settings.length ? 12 : 0} icons={<IconButton label="Dışa aktarma ekle" icon={fi("plus.small")} onClick={() => set([...settings, { scale: (settings.length ? Math.min(4, settings.length + 1) : 1) as ExportSetting["scale"], format: "png" }])} />}>
      {settings.map((st, i) => (
        <PropRow key={i} icons={<IconButton label="Kaldır" icon={fi("minus.small")} onClick={() => set(settings.filter((_, j) => j !== i))} />}>
          <Select label="Ölçek" value={String(st.scale)} options={[1, 2, 3, 4].map((n) => ({ value: String(n), label: `${n}x` }))} onChange={(v) => set(settings.map((x, j) => (j === i ? { ...x, scale: Number(v) as ExportSetting["scale"] } : x)))} />
          <Select label="Biçim" value={st.format} options={[{ value: "png", label: "PNG" }, { value: "jpg", label: "JPG" }, { value: "svg", label: "SVG" }]} onChange={(v) => set(settings.map((x, j) => (j === i ? { ...x, format: v as ExportSetting["format"] } : x)))} />
        </PropRow>
      ))}
      {settings.length > 0 && (
        <div className="px-4 pt-1">
          <button type="button" onClick={() => settings.forEach((st) => ops.exportNode(node.id, st))} className="flex w-full h-8 items-center justify-center rounded-[5px] border border-[var(--f-border)] text-[11px] font-[450] text-[var(--f-text)] hover:bg-[var(--f-bg-hover)] cursor-pointer">
            {node.name} dışa aktar
          </button>
        </div>
      )}
    </Section>
  );
}

/** Figma's Selection colors: every colour of its own in the selection, each once — changed here, it changes everywhere in it. */
function SelectionColors({ nodes, selection, ops, byId, mode }: { nodes: SceneNode[]; selection: readonly string[]; ops: EditorOps; byId: Map<string, DesignVariable>; mode: ThemeMode }) {
  const found = selection.filter((id) => !id.includes("/")).map((id) => getNode(nodes, id)).filter((n): n is SceneNode => Boolean(n));
  const colors = new Map<string, { opacity: number; variable?: DesignVariable }>();
  walk(found, (n) => {
    for (const p of [...(n.fills ?? []), ...(n.type !== "text" ? n.strokes ?? [] : [])]) {
      if (p.visible === false) continue;
      const key = "alias" in p.color ? `var:${p.color.alias}` : String(p.color.value).toLowerCase();
      if (!colors.has(key)) colors.set(key, { opacity: p.opacity ?? 100, variable: "alias" in p.color ? byId.get(p.color.alias) : undefined });
    }
  });
  if (colors.size < 2) return null;
  return (
    <Section title="Seçim renkleri" pb={12}>
      {[...colors].map(([key, c]) => (
        <PropRow key={key} icons={<span className="w-6" />}>
          {c.variable ? (
            <div className="flex flex-1 min-w-0 items-center h-6 rounded-[5px] bg-[var(--f-bg-secondary)]">
              <Chit color={String(boundValue(c.variable.light, mode, byId) ?? "#000")} />
              <span className="truncate text-[11px] text-[var(--f-text)]">{splitName(c.variable.name)[1] || c.variable.name}</span>
            </div>
          ) : (
            <ColorInput label="Seçim rengi" color={key} opacity={c.opacity} onColor={(hex) => ops.replaceColor(key, hex)} onOpacity={(opacity) => ops.replaceColor(key, key, opacity)} />
          )}
        </PropRow>
      ))}
    </Section>
  );
}

// ── The panel ─────────────────────────────────────────────────────────────────

function PageColor({ background, ops, variables, byId, mode }: { background: string; ops: EditorOps; variables: DesignVariable[]; byId: Map<string, DesignVariable>; mode: ThemeMode }) {
  const [picker, setPicker] = useState<{ top: number; right: number } | null>(null);
  return (
    <div className="relative flex flex-1">
      <ColorInput label="Kanvas rengi" color={background} opacity={100} onColor={ops.setBackground} chit={<button type="button" data-picker-anchor="" aria-label="Renk seçici" onClick={(e) => setPicker(picker ? null : anchorOf(e.currentTarget))} className="cursor-pointer"><Chit color={background} /></button>} />
      {picker && <ColorPicker color={background} opacity={100} anchor={picker} variables={variables} byId={byId} mode={mode} pageColors={ops.pageColors} onChange={(hex) => ops.setBackground(hex)} onClose={() => setPicker(null)} />}
    </div>
  );
}

const KIND: Record<SceneNode["type"], string> = { frame: "Çerçeve", rectangle: "Dikdörtgen", ellipse: "Elips", line: "Çizgi", text: "Metin", component: "Bileşen", componentSet: "Bileşen seti", instance: "Örnek" };

export function Inspector({ nodes, selection, tab, ops: baseOps, variables, byId, mode, textStyles, lang, background, header }: {
  nodes: SceneNode[];
  selection: readonly string[];
  tab: "design" | "prototype";
  ops: EditorOps;
  variables: DesignVariable[];
  byId: Map<string, DesignVariable>;
  mode: ThemeMode;
  textStyles: TextStyle[];
  lang: "tr" | "en";
  background: string;
  header: (node: SceneNode) => MenuItem[];
}) {
  const first = selection[0];
  const composite = first?.includes("/") ? first : null;
  // Several layers selected: the panel shows the first, but what is changed in it goes to all of them (as Figma's).
  const ownIds = selection.filter((id) => !id.includes("/"));
  const ops: EditorOps = selection.length > 1 ? { ...baseOps, patch: (_id, p) => baseOps.patchMany(ownIds, p) } : baseOps;
  let node: SceneNode | null = null;
  let parent: FrameNode | null = null;
  if (composite) {
    const [instanceId, rest] = composite.split("/");
    const path = rest.split(PATH_SEP);
    const instance = getNode(nodes, instanceId);
    const main = instance && instance.type === "instance" && instance.mainId ? findComponent(nodes, instance.mainId) : null;
    let list: SceneNode[] = main?.children ?? [];
    for (const name of path) {
      const child = list.find((c) => c.name === name) ?? null;
      node = child;
      list = child && isFrameLike(child) ? child.children : [];
    }
    if (node && instance && instance.type === "instance") {
      const o = instance.overrides?.[path.join(PATH_SEP)];
      if (o) node = { ...node, ...(o.fills ? { fills: o.fills } : {}), ...(o.strokes ? { strokes: o.strokes } : {}), ...(o.characters !== undefined ? { characters: o.characters } : {}), ...(o.charactersEn !== undefined ? { charactersEn: o.charactersEn } : {}), ...(o.visible !== undefined ? { visible: o.visible } : {}) } as SceneNode;
    }
  } else if (first) {
    const found = findNode(nodes, first);
    node = found?.node ?? null;
    parent = found?.parent ?? null;
  }
  const flows = nodes.filter((n) => isFrameLike(n) && n.type !== "componentSet").map((n) => ({ id: n.id, name: n.name }));

  if (!node) {
    if (tab === "prototype") return <PrototypeSection node={null} nodes={nodes} ops={ops} flows={flows} />;
    const byGroups = [...byGroup(textStyles)];
    const pageFrame = getNode(nodes, ops.pageId);
    return (
      <div className="flex flex-col">
        <Section title="Sayfa" icons={<IconButton label="Değişken modu" icon={fi("variable.small")} onClick={ops.openVariables} />}>
          <PropRow icons={<IconButton label="Göster" icon={fi("eye.small")} />}>
            <PageColor background={background} ops={ops} variables={variables} byId={byId} mode={mode} />
          </PropRow>
        </Section>
        <Section title="Stiller" icons={<IconButton label="Stil oluştur" icon={fi("plus.small")} onClick={(e) => ops.menu(e.currentTarget, [{ label: "Metin stili oluştur", onSelect: () => ops.createTextStyle(null) }, { label: "Renk stili oluştur", onSelect: () => ops.createColorStyle("#000000") }, { label: "Efekt stili oluştur", hint: "bir katman seç", disabled: true }])} />} pb={12}>
          <Labels a="Metin stilleri" />
          {byGroups.map(([group, list]) =>
            list.map((s) => (
              <div key={s.id} className="flex items-center gap-2 h-8 pl-4 pr-2 hover:bg-[var(--f-bg-hover)]">
                <span className="w-6 shrink-0 text-center text-[13px] font-[550] text-[var(--f-text)]">Ag</span>
                <span className="min-w-0 flex-1 truncate text-[11px] text-[var(--f-text)]">
                  {(group ? `${group} / ` : "") + (splitName(s.name)[1] || s.name)}
                  <span className="text-[var(--f-text-secondary)]"> · {numberOf(s.fontSize, byId, 16)}/{s.lineHeight ? numberOf(s.lineHeight, byId) : "Auto"}</span>
                </span>
              </div>
            ))
          )}
          <Labels a="Renk stilleri" className="pt-2" />
          {variables.filter((v) => v.kind === "color").slice(0, 12).map((v) => (
            <button key={v.id} type="button" onClick={ops.openVariables} className="flex items-center gap-2 h-8 pl-4 pr-2 text-left hover:bg-[var(--f-bg-hover)] cursor-pointer">
              <span className="flex w-6 shrink-0 items-center justify-center"><span className="w-4 h-4 rounded-full border border-[var(--f-border-translucent)]" style={{ background: String(boundValue(v.light, mode, byId) ?? "#000") }} /></span>
              <span className="min-w-0 flex-1 truncate text-[11px] text-[var(--f-text)]">{v.name}</span>
            </button>
          ))}
          <button type="button" onClick={ops.openVariables} className="flex items-center gap-2 h-8 pl-4 pr-2 text-left text-[11px] text-[var(--f-text-secondary)] hover:text-[var(--f-text)] cursor-pointer">Tüm değişkenler ({variables.length})…</button>
          {ops.effectStyles.length > 0 && <Labels a="Efekt stilleri" className="pt-2" />}
          {ops.effectStyles.map((st) => (
            <div key={st.id} className="group/es flex items-center gap-2 h-8 pl-4 pr-2 hover:bg-[var(--f-bg-hover)]">
              <span className="flex w-6 shrink-0 items-center justify-center text-[var(--f-icon-secondary)]">{fi("24.effects.small", 16)}</span>
              <span className="min-w-0 flex-1 truncate text-[11px] text-[var(--f-text)]">{st.name}</span>
              <IconButton label="Stili sil" icon={fi("minus.small")} onClick={() => ops.removeEffectStyle(st.id)} className="opacity-0 group-hover/es:opacity-100" />
            </div>
          ))}
        </Section>
        {pageFrame && <ExportSection node={pageFrame} ops={ops} />}
      </div>
    );
  }

  const multi = selection.length > 1;
  const inAuto = Boolean(parent && parent.layoutMode !== "none");
  const purple = node.type === "component" || node.type === "componentSet" || node.type === "instance" || Boolean(composite);
  const title = multi ? `${selection.length} katman` : KIND[node.type];
  const headerMenu = multi || composite ? [] : header(node);

  return (
    <div className="flex flex-col">
      {/* The layer header, as Figma's: the kind with its menu (the layers holding it); at the right, create component and "…". */}
      <div className="flex items-center justify-between h-12 pl-4 pr-2 py-1 border-b border-[var(--f-border)]">
        <ChevronMenu label="Katman" items={headerMenu.map((m) => ({ label: m.label, hint: m.hint, onSelect: m.onSelect }))} width={200} className={cn(headerMenu.length === 0 && "pointer-events-none")}>
          <span className={cn("truncate text-[13px] font-[550] leading-[22px] tracking-[-0.0325px]", purple ? "text-[var(--f-text-component)]" : "text-[var(--f-text)]")}>{title}</span>
        </ChevronMenu>
        <div className="flex items-center gap-2">
          {!composite && !multi && node.type === "frame" && <IconButton label="Bileşen oluştur (⌥⌘K)" icon={fi("component.small")} onClick={ops.createComponent} />}
          <IconButton label="Daha fazla" icon={<span className="text-[var(--f-icon)]">{fi("24.more")}</span>} onClick={(e) => ops.more(e.currentTarget)} />
        </div>
      </div>
      {tab === "prototype" ? (
        <PrototypeSection node={node} nodes={nodes} ops={ops} flows={flows} />
      ) : composite ? (
        <>
          <Section title="Örneğin katmanı">
            <p className="px-4 pt-1 text-[11px] leading-4 text-[var(--f-text-secondary)]">Ana bileşenin katmanı: değişiklikler yalnızca bu örneğe işler.</p>
            <div className="pl-4 pr-2 py-2"><Checkbox label="Görünür" checked={node.visible !== false} onChange={(v) => ops.override(composite, { visible: v ? undefined : false })} /></div>
          </Section>
          {node.type === "text" && <TextSection node={node} ops={ops} variables={variables} byId={byId} mode={mode} textStyles={textStyles} lang={lang} compositeId={composite} />}
          <FillSection node={node} ops={ops} variables={variables} byId={byId} mode={mode} compositeId={composite} />
          {node.type !== "text" && <StrokeSection node={node} ops={ops} variables={variables} byId={byId} mode={mode} compositeId={composite} />}
        </>
      ) : (
        <>
          {node.type === "instance" && <InstanceSection node={node} nodes={nodes} ops={ops} />}
          {node.type === "component" && <ComponentSection node={node} nodes={nodes} ops={ops} />}
          {node.type === "componentSet" && <ComponentSetSection set={node} ops={ops} />}
          <PositionSection node={node} inAuto={inAuto} ops={ops} multi={selection} />
          <LayoutSection node={node} parent={parent} ops={ops} variables={variables} byId={byId} mode={mode} />
          <AppearanceSection node={node} ops={ops} variables={variables} byId={byId} mode={mode} />
          {node.type === "text" && <TextSection node={node} ops={ops} variables={variables} byId={byId} mode={mode} textStyles={textStyles} lang={lang} />}
          {node.type !== "line" && <FillSection node={node} ops={ops} variables={variables} byId={byId} mode={mode} />}
          {node.type !== "text" && <StrokeSection node={node} ops={ops} variables={variables} byId={byId} mode={mode} />}
          {node.type !== "text" && <EffectsSection node={node} ops={ops} pageColors={ops.pageColors} />}
          <SelectionColors nodes={nodes} selection={selection} ops={ops} byId={byId} mode={mode} />
          {isFrameLike(node) && node.type !== "instance" && <LayoutGuideSection frame={node} ops={ops} />}
          <ExportSection node={node} ops={ops} />
        </>
      )}
    </div>
  );
}

export { hexDigits };
