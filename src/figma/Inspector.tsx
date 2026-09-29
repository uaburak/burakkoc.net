"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { DesignVariable, InteractionAnimation, InteractionEasing, InteractionTrigger, TextStyle, VariableValue } from "@/types/design";
import { cn } from "@/lib/utils";
import { FigmaIcon, fi, type FigmaIconName } from "@/components/admin/figmaIcons";
import { ANIMATIONS, EASINGS, TRIGGERS } from "@/components/project/interactions";
import { boundValue, byGroup, splitName, type ThemeMode } from "@/components/project/designVariables";
import { PICKER_WIDTH, VariablePicker, usePopover, type MenuItem } from "@/components/admin/LiveInspector";
import { weightLabel } from "./css";
import { type ChevronItem } from "./ui";
import { BLEND_MODES, EFFECT_LABEL, LAYOUT_GRID_LABEL, PAINT_LABEL, allComponents, componentAround, findComponent, findNode, freePropertyName, getNode, isFrameLike, layerAt, newEffect, newLayoutGrid, nid, numberOf, propertiesOf, propertyValues, setOf, variantName, variantProperties, variantValue, variantsOf, walk, type ComponentProperty, type Effect, type EffectStyle, type ExportSetting, type FrameNode, type LayoutGrid, type NodeOverride, type Paint, type PropertyType, type Reaction, type SceneNode, type StrokeStyle, type TextNode } from "./model";
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
  /** A padding or gap field focused in the panel: the canvas highlights what it edits (null: none) */
  setLayoutFocus: (focus: { pads?: ("top" | "right" | "bottom" | "left")[]; gap?: boolean } | null) => void;
  /** A main component's (a set's) properties as edited — layers bound to a gone one come unbound */
  setComponentProperties: (holderId: string, properties: ComponentProperty[]) => void;
  /** A property's default, put on every layer bound to it */
  setPropertyValue: (holderId: string, propId: string, value: string | boolean) => void;
  /** A layer inside a main component bound to a property (undefined: detached) */
  bindProperty: (nodeId: string, kind: "visible" | "text" | "instance", propId: string | undefined) => void;
  /** An instance's own value of a property (its English words when `en`) */
  setInstanceProp: (instanceId: string, propId: string, value: string | boolean, en?: boolean) => void;
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
function BoundNumber({ label, prefix, value, variables, byId, mode, onChange, unit, min, max, fallback, suffix, placeholder, onFocusChange, variableMenu = false }: {
  label: string;
  onFocusChange?: (focused: boolean) => void;
  /** The variable is applied and detached from the field's own menu (its suffix): no hexagon, no detach button in the field */
  variableMenu?: boolean;
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
  const hex = <IconButton label="Apply variable" icon={fi("variable.small")} onClick={(e) => toggle(e.currentTarget)} className="opacity-0 group-hover/bound:opacity-100 focus:opacity-100" />;
  const picker = at && <VariablePicker at={at} variables={targets} byId={byId} mode={mode} selectedId={bound?.id} onPick={(id) => { onChange({ alias: id }); close(); }} />;
  if (bound) {
    return (
      <div ref={box} className="group/bound relative flex flex-1 min-w-0 items-center h-6 rounded-[5px] bg-[var(--f-bg-secondary)]">
        {typeof prefix === "string" ? <Prefix>{prefix}</Prefix> : prefix}
        {/* Figma's bound value: just the number in its chip (the variable's name as its tooltip); a click opens the picker. */}
        <button type="button" data-tip={bound.name} onClick={(e) => toggle(e.currentTarget)} className="flex shrink-0 items-center h-[18px] mr-1 px-1 rounded-[4px] bg-[var(--f-bg)] border border-[var(--f-border)] text-[11px] leading-4 text-[var(--f-text)] tabular-nums cursor-pointer">
          {String(boundValue(v, mode, byId) ?? "")}{unit ?? ""}
        </button>
        <span className="flex-1" />
        {!variableMenu && <IconButton label="Detach variable" icon={fi("detach.small")} onClick={() => onChange(own(Number(boundValue(v, mode, byId)) || 0))} />}
        {suffix}
        {picker}
      </div>
    );
  }
  return (
    <div ref={box} className="group/bound relative flex flex-1 min-w-0">
      <NumericInput label={label} prefix={prefix} value={"alias" in v ? 0 : Number(v.value) || 0} min={min} max={max} unit={unit} placeholder={placeholder} onChange={(n) => onChange(own(n))} suffix={<>{targets.length && !variableMenu ? hex : null}{suffix}</>} onFocusChange={onFocusChange} />
      {picker}
    </div>
  );
}

/** A paint (a fill's, a stroke's): its colour — a variable's pill when bound — its opacity, its eye, its minus. */
function PaintRow<T extends Paint>({ paint, variables, byId, mode, onChange, onRemove, pageColors, ops }: { paint: T; variables: DesignVariable[]; byId: Map<string, DesignVariable>; mode: ThemeMode; onChange: (paint: T) => void; onRemove: () => void; pageColors: string[]; ops?: EditorOps }) {
  const [picker, setPicker] = useState<{ top: number; right: number } | null>(null);
  const bound = "alias" in paint.color ? byId.get(paint.color.alias) : undefined;
  const resolved = String(boundValue(paint.color, mode, byId) ?? "#000000");
  // A variable's colour opens onto the variables (Libraries); a colour of its own onto the picker (Custom).
  const pickerNode = picker && (
    <ColorPicker
      initialTab={bound ? "libraries" : "custom"}
      color={resolved}
      opacity={paint.opacity ?? 100}
      anchor={picker}
      variables={variables}
      byId={byId}
      mode={mode}
      pageColors={pageColors}
      selectedId={bound?.id}
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
          {bound && !fancy && <IconButton label="Detach variable" icon={fi("detach.small")} onClick={() => onChange({ ...paint, color: own(resolved) })} />}
          <IconButton label={paint.visible === false ? "Show" : "Hide"} icon={fi(paint.visible === false ? "hidden.small" : "eye.small")} onClick={() => onChange({ ...paint, visible: paint.visible === false ? undefined : false })} />
          <IconButton label="Remove" icon={fi("minus.small")} onClick={onRemove} />
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
          <button type="button" data-picker-anchor="" onClick={(e) => setPicker(picker ? null : anchorOf(e.currentTarget))} className="flex flex-1 min-w-0 items-center h-6 rounded-[5px] bg-[var(--f-bg-secondary)] border border-transparent hover:border-[var(--f-border)] cursor-pointer">
            <Chit color={resolved} />
            <span className="truncate text-[11px] leading-4 text-[var(--f-text)]">{bound.name}</span>
          </button>
        ) : (
          <ColorInput
            label="Color"
            color={resolved}
            opacity={paint.opacity ?? 100}
            onColor={(hex) => onChange({ ...paint, color: own(hex) })}
            onOpacity={(opacity) => onChange({ ...paint, opacity: opacity >= 100 ? undefined : opacity })}
            chit={
              <button type="button" data-picker-anchor="" aria-label="Color picker" onClick={(e) => setPicker(picker ? null : anchorOf(e.currentTarget))} className="cursor-pointer">
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
const ALIGN_LABEL: Record<keyof typeof ALIGN_GLYPH, string> = {
  left: "Align left",
  hcenter: "Align horizontal centers",
  right: "Align right",
  top: "Align top",
  vcenter: "Align vertical centers",
  bottom: "Align bottom",
};
const FLOW_GLYPH = {
  freeform: fi("24.layout.freeform"),
  vertical: fi("24.layout.vertical"),
  horizontal: fi("24.layout.horizontal"),
  grid: fi("24.layout.grid"),
};

/** A group of icon buttons on the secondary background, as Figma's alignment and flow controls. */
function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string; icon: ReactNode; disabled?: boolean }[]; onChange: (value: T) => void }) {
  return (
    <div className="flex flex-1 min-w-0 items-center h-6 p-0.5 rounded-[5px] bg-[var(--f-bg-secondary)]">
      {options.map((o) => (
        <button key={o.value} type="button" aria-label={o.label} data-tip={o.label} aria-pressed={o.value === value} disabled={o.disabled} onClick={() => onChange(o.value)} className={cn("flex flex-1 items-center justify-center h-5 rounded-[3px] cursor-pointer disabled:opacity-40 disabled:cursor-default", o.value === value ? "bg-[var(--f-bg)] text-[var(--f-text)] shadow-[0_0_0.5px_rgba(0,0,0,0.3),0_1px_3px_rgba(0,0,0,0.15)]" : "text-[var(--f-icon-secondary)] hover:text-[var(--f-text)]")}>
          {o.icon}
        </button>
      ))}
    </div>
  );
}

// ── Sections ──────────────────────────────────────────────────────────────────

/** Figma's boxed group of buttons (the alignment, the flips): a field-height box on the secondary background, its buttons sharing it. */
function ButtonGroup({ children }: { children: ReactNode }) {
  return <div className="flex flex-1 min-w-0 items-center h-6 p-0.5 rounded-[5px] bg-[var(--f-bg-secondary)]">{children}</div>;
}

function GroupButton({ label, icon, active = false, onClick }: { label: string; icon: ReactNode; active?: boolean; onClick: () => void }) {
  return (
    <button type="button" aria-label={label} data-tip={label} aria-pressed={active} onClick={onClick} className={cn("flex flex-1 items-center justify-center h-5 rounded-[3px] cursor-pointer", active ? "bg-[var(--f-bg)] text-[var(--f-text-brand)] shadow-[0_0_0.5px_rgba(0,0,0,0.3),0_1px_3px_rgba(0,0,0,0.1)]" : "text-[var(--f-icon)] hover:bg-[var(--f-bg)]")}>
      {icon}
    </button>
  );
}

function PositionSection({ node, inAuto, ops, multi }: { node: SceneNode; inAuto: boolean; ops: EditorOps; multi: readonly string[] }) {
  const set = (patch: Partial<SceneNode>) => (multi.length > 1 ? ops.patchMany(multi, patch) : ops.patch(node.id, patch));
  return (
    <Section title="Position" icons={inAuto ? <IconButton label={node.absolute ? "Remove absolute position" : "Absolute position"} icon={fi("24.al.absolute-position")} active={Boolean(node.absolute)} onClick={() => ops.patch(node.id, { absolute: node.absolute ? undefined : true })} /> : undefined}>
      {/* Figma's alignment: two boxed groups — left / centre / right, top / middle / bottom; the distribute menu only with several layers selected. */}
      <PropRow icons={multi.length > 1 ? <IconButton label="Distribute" icon={fi("24.more")} onClick={(e) => ops.menu(e.currentTarget, [{ label: "Distribute horizontal spacing", onSelect: () => ops.distribute("h") }, { label: "Distribute vertical spacing", onSelect: () => ops.distribute("v") }, "-", { label: "Tidy up", onSelect: ops.tidy }])} /> : <span className="w-6" />}>
        <ButtonGroup>
          {(["left", "hcenter", "right"] as const).map((k) => <GroupButton key={k} label={ALIGN_LABEL[k]} icon={ALIGN_GLYPH[k]} onClick={() => ops.align(k)} />)}
        </ButtonGroup>
        <ButtonGroup>
          {(["top", "vcenter", "bottom"] as const).map((k) => <GroupButton key={k} label={ALIGN_LABEL[k]} icon={ALIGN_GLYPH[k]} onClick={() => ops.align(k)} />)}
        </ButtonGroup>
      </PropRow>
      <PropRow icons={<span className="w-6" />}>
        <NumericInput label="X" prefix="X" value={Math.round(node.x)} onChange={(x) => set({ x })} disabled={inAuto && !node.absolute} />
        <NumericInput label="Y" prefix="Y" value={Math.round(node.y)} onChange={(y) => set({ y })} disabled={inAuto && !node.absolute} />
      </PropRow>
      <PropRow icons={<span className="w-6" />}>
        <NumericInput label="Rotation" prefix={<Prefix>{fi("24.rotation")}</Prefix>} value={node.rotation ?? 0} min={-360} max={360} unit="°" onChange={(rotation) => set({ rotation: rotation || undefined })} />
        <ButtonGroup>
          <GroupButton label="Rotate 90°" icon={fi("24.rotate")} onClick={() => set({ rotation: ((node.rotation ?? 0) + 90) % 360 || undefined })} />
          <GroupButton label="Flip horizontal (⇧H)" icon={fi("24.flip.horizontal.small")} active={Boolean(node.flipH)} onClick={() => set({ flipH: node.flipH ? undefined : true })} />
          <GroupButton label="Flip vertical (⇧V)" icon={fi("24.flip.vertical")} active={Boolean(node.flipV)} onClick={() => set({ flipV: node.flipV ? undefined : true })} />
        </ButtonGroup>
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
      { label: isW ? `Fixed width (${size})` : `Fixed height (${size})`, icon: fi(isW ? "24.al.width-minmax" : "24.al.height-minmax", 16), checked: sizing === "fixed", onSelect: () => setSizing(axis, "fixed") },
      ...(canHug ? [{ label: "Hug contents", icon: fi(isW ? "24.al.width-hug" : "24.al.height-hug", 16), checked: sizing === "hug", onSelect: () => setSizing(axis, "hug") }] : []),
      ...(inAuto ? [{ label: "Fill container", icon: fi(isW ? "24.al.width-fill" : "24.al.height-fill", 16), checked: sizing === "fill", onSelect: () => setSizing(axis, "fill") }] : []),
      "-",
      { label: node[minKey] === undefined ? (isW ? "Add min width…" : "Add min height…") : (isW ? "Remove min width" : "Remove min height"), icon: fi(isW ? "al.width-min" : "al.height-min", 16), onSelect: () => { if (node[minKey] === undefined) { setLimits(true); ops.patch(node.id, { [minKey]: 0 }); } else ops.patch(node.id, { [minKey]: undefined }); } },
      { label: node[maxKey] === undefined ? (isW ? "Add max width…" : "Add max height…") : (isW ? "Remove max width" : "Remove max height"), icon: fi(isW ? "al.width-max" : "al.height-max", 16), onSelect: () => { if (node[maxKey] === undefined) { setLimits(true); ops.patch(node.id, { [maxKey]: size }); } else ops.patch(node.id, { [maxKey]: undefined }); } },
      "-",
      bound
        ? { label: "Detach variable", icon: fi("detach.small", 16), onSelect: () => ops.patch(node.id, isW ? { widthVar: undefined } : { heightVar: undefined }) }
        : { label: "Apply variable…", icon: fi("variable.small", 16), disabled: numberVars.length === 0, hint: numberVars.length ? undefined : "no number variables", items: numberVars.map((v) => ({ label: v.name, hint: String(numberOf({ alias: v.id }, byId)), onSelect: () => ops.patch(node.id, isW ? { widthVar: { alias: v.id }, sizingH: undefined } : { heightVar: { alias: v.id }, sizingV: undefined }) })) },
    ];
    return (
      <ChevronMenu hover label={isW ? "Width sizing" : "Height sizing"} items={items}>
        {sizing !== "fixed" && <span className="text-[11px] text-[var(--f-text)]">{sizing === "hug" ? "Hug" : "Fill"}</span>}
      </ChevronMenu>
    );
  };
  const limitMenu = (key: "minWidth" | "maxWidth" | "minHeight" | "maxHeight") => (
    <ChevronMenu label="Limit" items={[{ label: "Remove", onSelect: () => { ops.patch(node.id, { [key]: undefined }); if ([node.minWidth, node.maxWidth, node.minHeight, node.maxHeight].filter((v) => v !== undefined).length <= 1) setLimits(false); } }]} />
  );
  // A padding or gap field focused: the canvas shows the strip it edits (Figma's).
  const focusPads = (sides: ("top" | "right" | "bottom" | "left")[]) => (focused: boolean) => ops.setLayoutFocus(focused ? { pads: sides } : null);
  const focusGap = (focused: boolean) => ops.setLayoutFocus(focused ? { gap: true } : null);
  const advancedMenu = (el: HTMLElement) => frame && ops.menu(el, [
            { label: "Strokes included in layout", checked: Boolean(frame.strokesInLayout), onSelect: () => ops.patch(frame.id, { strokesInLayout: frame.strokesInLayout ? undefined : true }) },
            "-",
            { label: "Last on top", checked: !frame.firstOnTop, onSelect: () => ops.patch(frame.id, { firstOnTop: undefined }) },
            { label: "First on top", checked: Boolean(frame.firstOnTop), onSelect: () => ops.patch(frame.id, { firstOnTop: true }) },
            "-",
            { label: "Text baseline alignment", checked: Boolean(frame.baselineAlign), disabled: frame.layoutMode !== "horizontal", onSelect: () => ops.patch(frame.id, { baselineAlign: frame.baselineAlign ? undefined : true }) },
          ]);
  const gapLabel = frame?.layoutMode === "horizontal" ? "Horizontal gap" : "Vertical gap";
  const gapPrefix = <Prefix>{fi(frame?.layoutMode === "horizontal" ? "al.spacing-horizontal" : "al.spacing-vertical")}</Prefix>;
  // The gap's menu: fixed / auto, and its variable (applied or detached here — the field itself shows no hexagon).
  const gapBound = frame && "alias" in frame.itemSpacing ? byId.get(frame.itemSpacing.alias) : undefined;
  const gapMode = frame && <ChevronMenu label="Gap mode" items={[
    { label: "Fixed", checked: frame.primaryAlign !== "spaceBetween", onSelect: () => ops.patch(frame.id, { primaryAlign: frame.primaryAlign === "spaceBetween" ? "min" : frame.primaryAlign }) },
    { label: "Auto", checked: frame.primaryAlign === "spaceBetween", onSelect: () => ops.patch(frame.id, { primaryAlign: "spaceBetween" }) },
    "-",
    gapBound
      ? { label: "Detach variable", icon: fi("detach.small", 16), hint: gapBound.name, onSelect: () => ops.patch(frame.id, { itemSpacing: own(numberOf(frame.itemSpacing, byId)) }) }
      : { label: "Apply variable…", icon: fi("variable.small", 16), disabled: numberVars.length === 0, hint: numberVars.length ? undefined : "no number variables", items: numberVars.map((v) => ({ label: v.name, hint: String(numberOf({ alias: v.id }, byId)), onSelect: () => ops.patch(frame.id, { itemSpacing: { alias: v.id } }) })) },
  ]} />;
  const flow: "vertical" | "horizontal" | "wrap" | "grid" | "" = frame ? (frame.layoutMode === "none" ? "" : frame.layoutMode === "horizontal" && frame.layoutWrap ? "wrap" : frame.layoutMode) : "";
  const auto = Boolean(frame && frame.layoutMode !== "none");
  const hugAll = () => frame && ops.patch(frame.id, { sizingH: "hug", sizingV: "hug" });
  return (
    <Section
      title={auto ? "Auto layout" : "Layout"}
      icons={
        frame ? (
          auto ? (
            <IconButton label="Remove auto layout (⇧A)" icon={fi("24.autolayout-vertical")} active onClick={() => ops.setAutoLayout(frame.id, "none")} />
          ) : (
            <>
              <IconButton label="Resize to fit" icon={fi("24.resize-to-fit.small")} disabled={!frame.children.length} onClick={() => ops.fitToContent(frame.id)} />
              <IconButton label="Add auto layout (⇧A)" icon={fi("24.autolayout-add-vertical")} onClick={() => ops.setAutoLayout(frame.id, "vertical")} />
            </>
          )
        ) : (
          <IconButton label="Add auto layout (⇧A)" icon={fi("24.autolayout-add-vertical")} onClick={ops.addAutoLayout} />
        )
      }
    >
      {frame && (
        <PropRow icons={<IconButton label="Wrap" icon={fi("24.layout.wrap")} active={Boolean(frame.layoutWrap) || frame.layoutMode === "grid"} disabled={frame.layoutMode !== "horizontal" && frame.layoutMode !== "grid"} onClick={() => frame.layoutMode === "horizontal" && ops.patch(frame.id, { layoutWrap: frame.layoutWrap ? undefined : true })} />}>
          {/* Figma's flow control: Freeform (no auto layout), Vertical, Horizontal, Grid — wrapping is the button at the right. */}
          <Segmented
            value={flow === "wrap" ? "horizontal" : flow}
            options={[
              { value: "" as const, label: "Freeform", icon: FLOW_GLYPH.freeform },
              { value: "vertical" as const, label: "Vertical", icon: FLOW_GLYPH.vertical },
              { value: "horizontal" as const, label: "Horizontal", icon: FLOW_GLYPH.horizontal },
              { value: "grid" as const, label: "Grid", icon: FLOW_GLYPH.grid },
            ]}
            onChange={(v) => {
              if (!v) return ops.setAutoLayout(frame.id, "none");
              if (frame.layoutMode === "none") ops.setAutoLayout(frame.id, v);
              ops.patch(frame.id, { layoutMode: v, layoutWrap: undefined, ...(v === "grid" && !frame.gridColumns ? { gridColumns: 2 } : {}) });
            }}
          />
        </PropRow>
      )}
      <PropRow icons={auto ? <IconButton label="Resize to fit" icon={fi("24.resize-to-fit.small")} onClick={hugAll} /> : <IconButton label={node.lockAspect ? "Unconstrain proportions" : "Constrain proportions"} icon={fi("constrain-proportions")} active={Boolean(node.lockAspect)} onClick={() => ops.patch(node.id, { lockAspect: node.lockAspect ? undefined : true })} />}>
        {node.widthVar ? (
          <BoundNumber label="Width" prefix="W" value={node.widthVar} variables={variables} byId={byId} mode={mode} onChange={(v) => ops.patch(node.id, "alias" in v ? { widthVar: v } : { widthVar: undefined, width: Number(v.value) || 0 })} suffix={sizingMenu("H")} />
        ) : (
          <NumericInput label="Width" prefix="W" value={Math.round(node.width)} min={0} onChange={(width) => ops.patch(node.id, { width, ...(node.lockAspect && node.width ? { height: Math.round((width * node.height) / node.width) } : {}), sizingH: undefined, ...(text ? { textAutoResize: text.textAutoResize === "widthHeight" ? "height" : text.textAutoResize } : {}) } as Partial<SceneNode>)} suffix={sizingMenu("H")} />
        )}
        {node.heightVar ? (
          <BoundNumber label="Height" prefix="H" value={node.heightVar} variables={variables} byId={byId} mode={mode} onChange={(v) => ops.patch(node.id, "alias" in v ? { heightVar: v } : { heightVar: undefined, height: Number(v.value) || 0 })} suffix={sizingMenu("V")} />
        ) : (
          <NumericInput label="Height" prefix="H" value={Math.round(node.height)} min={0} onChange={(height) => ops.patch(node.id, { height, ...(node.lockAspect && node.height ? { width: Math.round((height * node.width) / node.height) } : {}), sizingV: undefined, ...(text ? { textAutoResize: "none" } : {}) } as Partial<SceneNode>)} suffix={sizingMenu("V")} />
        )}
      </PropRow>
      {hasLimits && (
        <>
          <PropRow icons={<span className="w-6" />}>
            <NumericInput label="Min width" prefix={<Prefix>{fi("al.width-min")}</Prefix>} value={node.minWidth ?? null} placeholder="Min W" fallback={0} min={0} onChange={(minWidth) => ops.patch(node.id, { minWidth })} onClear={() => ops.patch(node.id, { minWidth: undefined })} suffix={limitMenu("minWidth")} />
            <NumericInput label="Min height" prefix={<Prefix>{fi("al.height-min")}</Prefix>} value={node.minHeight ?? null} placeholder="Min H" fallback={0} min={0} onChange={(minHeight) => ops.patch(node.id, { minHeight })} onClear={() => ops.patch(node.id, { minHeight: undefined })} suffix={limitMenu("minHeight")} />
          </PropRow>
          <PropRow icons={<span className="w-6" />}>
            <NumericInput label="Max width" prefix={<Prefix>{fi("al.width-max")}</Prefix>} value={node.maxWidth ?? null} placeholder="Max W" fallback={Math.round(node.width)} min={0} onChange={(maxWidth) => ops.patch(node.id, { maxWidth })} onClear={() => ops.patch(node.id, { maxWidth: undefined })} suffix={limitMenu("maxWidth")} />
            <NumericInput label="Max height" prefix={<Prefix>{fi("al.height-max")}</Prefix>} value={node.maxHeight ?? null} placeholder="Max H" fallback={Math.round(node.height)} min={0} onChange={(maxHeight) => ops.patch(node.id, { maxHeight })} onClear={() => ops.patch(node.id, { maxHeight: undefined })} suffix={limitMenu("maxHeight")} />
          </PropRow>
        </>
      )}
      {frame && auto && (
        <>
          <PropRow icons={<IconButton label="Advanced layout" icon={fi("24.adjust.small")} active={Boolean(frame.strokesInLayout || frame.firstOnTop || frame.baselineAlign)} onClick={(e) => advancedMenu(e.currentTarget)} />}>
            {/* Figma's two equal columns, whatever the panel's width: the alignment box — the grid's box, in a grid — filling the first, the gap field(s) filling the second, in line with the W and H fields. */}
            <div className="flex flex-1 min-w-0">
              {frame.layoutMode === "grid" ? (
                <GridBox frame={frame} ops={ops} onSettings={advancedMenu} />
              ) : (
                <AlignGrid frame={frame} onChange={(primaryAlign, counterAlign) => ops.patch(frame.id, { primaryAlign, counterAlign })} />
              )}
            </div>
            <div className="flex flex-1 min-w-0 flex-col gap-2 self-start">
              {frame.layoutMode === "grid" ? (
                <>
                  <BoundNumber label="Column gap" prefix={<Prefix>{fi("al.spacing-horizontal")}</Prefix>} value={frame.itemSpacing} variables={variables} byId={byId} mode={mode} onChange={(itemSpacing) => ops.patch(frame.id, { itemSpacing })} />
                  <BoundNumber label="Row gap" prefix={<Prefix>{fi("al.spacing-vertical")}</Prefix>} value={frame.counterSpacing ?? frame.itemSpacing} variables={variables} byId={byId} mode={mode} onChange={(counterSpacing) => ops.patch(frame.id, { counterSpacing })} />
                </>
              ) : (
                <>
                  {frame.primaryAlign === "spaceBetween" ? (
                    // Space between: the gap reads "Auto" (Figma's); a number typed turns it fixed again.
                    <NumericInput label={gapLabel} onFocusChange={focusGap} prefix={gapPrefix} value={null} placeholder="Auto" fallback={numberOf(frame.itemSpacing, byId)} min={0} onChange={(gap) => ops.patch(frame.id, { itemSpacing: own(gap), primaryAlign: "min" })} suffix={gapMode} />
                  ) : (
                    <BoundNumber label={gapLabel} onFocusChange={focusGap} prefix={gapPrefix} value={frame.itemSpacing} variables={variables} byId={byId} mode={mode} onChange={(itemSpacing) => ops.patch(frame.id, { itemSpacing })} suffix={gapMode} variableMenu />
                  )}
                  {frame.layoutWrap && frame.layoutMode === "horizontal" && (
                    <BoundNumber label="Vertical gap" onFocusChange={focusGap} prefix={<Prefix>{fi("al.spacing-vertical")}</Prefix>} value={frame.counterSpacing ?? frame.itemSpacing} variables={variables} byId={byId} mode={mode} onChange={(counterSpacing) => ops.patch(frame.id, { counterSpacing })} suffix={<ChevronMenu label="Vertical gap mode" items={[{ label: "Same as horizontal gap", checked: !frame.counterSpacing, onSelect: () => ops.patch(frame.id, { counterSpacing: undefined }) }, { label: "Separate", checked: Boolean(frame.counterSpacing), onSelect: () => ops.patch(frame.id, { counterSpacing: frame.itemSpacing }) }]} />} />
                  )}
                </>
              )}
            </div>
          </PropRow>
          <PropRow icons={<IconButton label="Individual padding" icon={fi("al.padding-sides")} active={sides} onClick={() => setSides((s) => !s)} />}>
            {sides ? (
              <BoundNumber label="Left padding" onFocusChange={focusPads(["left"])} prefix={<Prefix>{fi("al.padding-left")}</Prefix>} value={frame.paddingLeft} variables={variables} byId={byId} mode={mode} onChange={(paddingLeft) => ops.patch(frame.id, { paddingLeft })} />
            ) : (
              // Two sides apart: Figma writes both ("4, 10"); a number typed sets them alike.
              numberOf(frame.paddingLeft, byId) !== numberOf(frame.paddingRight, byId) ? (
                <NumericInput label="Horizontal padding" onFocusChange={focusPads(["left", "right"])} prefix={<Prefix>{fi("al.padding-horizontal")}</Prefix>} value={null} placeholder={`${numberOf(frame.paddingLeft, byId)}, ${numberOf(frame.paddingRight, byId)}`} fallback={numberOf(frame.paddingLeft, byId)} min={0} onChange={(v) => ops.patch(frame.id, { paddingLeft: own(v), paddingRight: own(v) })} />
              ) : (
                <BoundNumber label="Horizontal padding" onFocusChange={focusPads(["left", "right"])} prefix={<Prefix>{fi("al.padding-horizontal")}</Prefix>} value={frame.paddingLeft} variables={variables} byId={byId} mode={mode} onChange={(v) => ops.patch(frame.id, { paddingLeft: v, paddingRight: v })} />
              )
            )}
            {sides ? (
              <BoundNumber label="Top padding" onFocusChange={focusPads(["top"])} prefix={<Prefix>{fi("al.padding-top")}</Prefix>} value={frame.paddingTop} variables={variables} byId={byId} mode={mode} onChange={(paddingTop) => ops.patch(frame.id, { paddingTop })} />
            ) : (
              numberOf(frame.paddingTop, byId) !== numberOf(frame.paddingBottom, byId) ? (
                <NumericInput label="Vertical padding" onFocusChange={focusPads(["top", "bottom"])} prefix={<Prefix>{fi("al.padding-vertical")}</Prefix>} value={null} placeholder={`${numberOf(frame.paddingTop, byId)}, ${numberOf(frame.paddingBottom, byId)}`} fallback={numberOf(frame.paddingTop, byId)} min={0} onChange={(v) => ops.patch(frame.id, { paddingTop: own(v), paddingBottom: own(v) })} />
              ) : (
                <BoundNumber label="Vertical padding" onFocusChange={focusPads(["top", "bottom"])} prefix={<Prefix>{fi("al.padding-vertical")}</Prefix>} value={frame.paddingTop} variables={variables} byId={byId} mode={mode} onChange={(v) => ops.patch(frame.id, { paddingTop: v, paddingBottom: v })} />
              )
            )}
          </PropRow>
          {sides && (
            <PropRow icons={<span className="w-6" />}>
              <BoundNumber label="Right padding" onFocusChange={focusPads(["right"])} prefix={<Prefix>{fi("al.padding-right")}</Prefix>} value={frame.paddingRight} variables={variables} byId={byId} mode={mode} onChange={(paddingRight) => ops.patch(frame.id, { paddingRight })} />
              <BoundNumber label="Bottom padding" onFocusChange={focusPads(["bottom"])} prefix={<Prefix>{fi("al.padding-bottom")}</Prefix>} value={frame.paddingBottom} variables={variables} byId={byId} mode={mode} onChange={(paddingBottom) => ops.patch(frame.id, { paddingBottom })} />
            </PropRow>
          )}
        </>
      )}
      {frame && (
        <div className="pl-4 pr-10 py-2">
          <Checkbox label="Clip content" checked={Boolean(frame.clipsContent)} onChange={(clipsContent) => ops.patch(frame.id, { clipsContent })} />
        </div>
      )}
    </Section>
  );
}

/** The alignment grid's cells named as Figma's ("Top left", "Center", "Bottom right"). */
function alignCellLabel(row: FrameNode["counterAlign"], col: FrameNode["counterAlign"]) {
  const v = row === "min" ? "Top" : row === "max" ? "Bottom" : "";
  const h = col === "min" ? "left" : col === "max" ? "right" : "";
  if (!v && !h) return "Center";
  if (!v) return h === "left" ? "Left" : "Right";
  return h ? `${v} ${h}` : `${v} center`;
}

function AlignGrid({ frame, onChange }: { frame: FrameNode; onChange: (primary: FrameNode["primaryAlign"], counter: FrameNode["counterAlign"]) => void }) {
  const horizontal = frame.layoutMode === "horizontal";
  const cells: FrameNode["counterAlign"][] = ["min", "center", "max"];
  const glyph = (counter: FrameNode["counterAlign"]): FigmaIconName => {
    const where = counter === "min" ? (horizontal ? "top" : "left") : counter === "center" ? "center" : horizontal ? "bottom" : "right";
    return `16.alg.${frame.layoutWrap && horizontal ? "wrap" : horizontal ? "horizontal" : "vertical"}.${where}` as FigmaIconName;
  };
  return (
    <div className="grid grid-cols-3 w-full min-w-0 h-[64px] px-1 py-2 rounded-[5px] bg-[var(--f-bg-secondary)] border border-transparent focus-within:border-[var(--f-border-selected)]">
      {cells.map((row) =>
        cells.map((col) => {
          const primary = horizontal ? col : row;
          const counter = horizontal ? row : col;
          // Space between ("Auto" gap): the three cells along the flow light up as bars, as Figma draws them.
          const spaced = frame.primaryAlign === "spaceBetween";
          const active = spaced ? frame.counterAlign === counter : frame.primaryAlign === primary && frame.counterAlign === counter;
          return (
            <button key={`${row}${col}`} type="button" aria-label={alignCellLabel(row, col)} aria-pressed={active} onClick={() => onChange(frame.primaryAlign === "spaceBetween" ? "spaceBetween" : primary, counter)} className={cn("flex items-center justify-center cursor-pointer", active ? "text-[var(--f-text-brand)]" : "text-[var(--f-icon-tertiary)] hover:text-[var(--f-icon)]")}>
              {active ? (spaced ? <span className={cn("rounded-full bg-current", horizontal ? "w-[2px]" : "h-[2px]")} style={horizontal ? { height: primary === "center" ? 6 : 12 } : { width: primary === "center" ? 6 : 12 }} /> : fi(glyph(counter))) : fi("16.autolayoutgrid.dot")}
            </button>
          );
        })
      )}
    </div>
  );
}

/**
 * A grid's box, as Figma's: "8 × 3" over a sketch of its cells; a click
 * opens the picker — columns × rows (rows "Auto" when unset), the 12 × 8
 * cells to sweep a size from, "Open grid settings".
 */
function GridBox({ frame, ops, onSettings }: { frame: FrameNode; ops: EditorOps; onSettings: (el: HTMLElement) => void }) {
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState<{ c: number; r: number } | null>(null);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); setOpen(false); } };
    document.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey, true);
    return () => { document.removeEventListener("pointerdown", onDown); window.removeEventListener("keydown", onKey, true); };
  }, [open]);
  const cols = Math.max(1, frame.gridColumns ?? 2);
  const rows = frame.gridRows;
  const set = (c: number, r?: number) => ops.patch(frame.id, { gridColumns: Math.max(1, Math.round(c)), gridRows: r && r > 0 ? Math.round(r) : undefined });
  const litC = hover?.c ?? cols;
  const litR = hover?.r ?? rows ?? 1;
  const sketchC = Math.min(cols, 12);
  const sketchR = Math.min(rows ?? 1, 8);
  return (
    <div ref={box} className="relative flex-1 min-w-0">
      <button type="button" aria-label="Grid size" aria-expanded={open} onClick={() => setOpen((o) => !o)} className={cn("relative flex w-full h-[64px] items-center justify-center overflow-hidden rounded-[5px] bg-[var(--f-bg-secondary)] border cursor-pointer", open ? "border-[var(--f-border-selected)]" : "border-transparent hover:border-[var(--f-border)]")}>
        <span aria-hidden className="absolute inset-1 grid gap-[2px]" style={{ gridTemplateColumns: `repeat(${sketchC}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${sketchR}, minmax(0, 1fr))` }}>
          {Array.from({ length: sketchC * sketchR }).map((_, i) => <span key={i} className="rounded-[2px] border border-[var(--f-border)]" />)}
        </span>
        <span className="relative px-1 rounded-[3px] text-[11px] leading-4 text-[var(--f-text)] bg-[var(--f-bg-secondary)]">{cols} × {rows ?? "Auto"}</span>
      </button>
      {open && (
        <div className="absolute left-0 top-[68px] z-40 flex w-[224px] flex-col gap-2 p-2 rounded-[13px] bg-[var(--f-bg)] shadow-[0_0_0.5px_rgba(0,0,0,0.3),0_10px_16px_rgba(0,0,0,0.2)]" onPointerDown={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-1">
            <NumericInput label="Columns" prefix={<Prefix>{fi("grid-column")}</Prefix>} value={cols} min={1} max={12} onChange={(c) => set(c, rows)} />
            <span className="shrink-0 px-0.5 text-[11px] text-[var(--f-text-secondary)]">×</span>
            <NumericInput label="Rows" prefix={<Prefix>{fi("grid-row")}</Prefix>} value={rows ?? null} placeholder="Auto" fallback={1} min={1} max={8} onChange={(r) => set(cols, r)} onClear={() => set(cols, undefined)} suffix={<ChevronMenu label="Rows mode" items={[{ label: "Auto", checked: !rows, onSelect: () => set(cols, undefined) }, { label: "Fixed", checked: Boolean(rows), onSelect: () => set(cols, rows ?? 1) }]} />} />
          </div>
          <div className="relative">
            <div className="grid grid-cols-12 gap-[3px]" onMouseLeave={() => setHover(null)}>
              {Array.from({ length: 96 }).map((_, i) => {
                const c = (i % 12) + 1;
                const r = Math.floor(i / 12) + 1;
                const lit = c <= litC && r <= litR;
                return <button key={i} type="button" aria-label={`${c} × ${r}`} onMouseEnter={() => setHover({ c, r })} onClick={() => { set(c, r); setOpen(false); }} className={cn("aspect-square rounded-[2px] cursor-pointer", lit ? "bg-[var(--f-bg-selected)] shadow-[inset_0_0_0_1px_var(--f-border-selected)]" : "bg-[var(--f-bg-secondary)] hover:bg-[var(--f-bg-hover)]")} />;
              })}
            </div>
            {hover && <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 -bottom-1 translate-y-full px-2 py-1 rounded-[5px] bg-[var(--f-bg-menu)] text-[11px] leading-4 text-white">{hover.c} × {hover.r}</span>}
          </div>
          <button type="button" onClick={(e) => { setOpen(false); onSettings(e.currentTarget); }} className="flex h-8 items-center justify-center rounded-[5px] border border-[var(--f-border)] text-[11px] text-[var(--f-text)] hover:bg-[var(--f-bg-hover)] cursor-pointer">Open grid settings</button>
        </div>
      )}
    </div>
  );
}

function AppearanceSection({ node, nodes, ops, variables, byId, mode }: { node: SceneNode; nodes: SceneNode[]; ops: EditorOps; variables: DesignVariable[]; byId: Map<string, DesignVariable>; mode: ThemeMode }) {
  const geo = node.type !== "text" ? node : null;
  const [independent, setIndependent] = useState(Boolean(geo?.corners));
  const rounded = geo && node.type !== "ellipse" && node.type !== "line";
  // Inside a main component: its visibility can follow a boolean property (Figma's "Apply boolean property").
  const holder = node.type === "component" || node.type === "componentSet" ? null : componentAround(nodes, node.id)?.holder ?? null;
  const booleans = holder?.properties?.filter((p) => p.type === "boolean") ?? [];
  const bound = node.visibleProp ? booleans.find((p) => p.id === node.visibleProp) : undefined;
  const createBoolean = () => {
    if (!holder) return;
    const id = nid("p");
    ops.setComponentProperties(holder.id, [...(holder.properties ?? []), { id, name: freePropertyName(holder, node.name), type: "boolean", value: node.visible !== false }]);
    ops.bindProperty(node.id, "visible", id);
  };
  return (
    <Section
      title="Appearance"
      pb={12}
      icons={
        <>
          <IconButton label="Blend mode" icon={fi(node.blendMode && node.blendMode !== "pass-through" ? "blendmode.active.small" : "blendmode.small")} active={Boolean(node.blendMode && node.blendMode !== "pass-through")} onClick={(e) => ops.menu(e.currentTarget, BLEND_MODES.map((b) => ({ label: b.label, checked: (node.blendMode ?? "pass-through") === b.value, onSelect: () => ops.patch(node.id, { blendMode: b.value === "pass-through" ? undefined : b.value }) })))} />
          {holder && (
            <IconButton label="Apply boolean property" icon={fi("24.boolean.small")} active={Boolean(bound)} onClick={(e) => ops.menu(e.currentTarget, [
              ...booleans.map((p) => ({ label: p.name, icon: fi("24.boolean.small", 16), checked: p.id === node.visibleProp, onSelect: () => ops.bindProperty(node.id, "visible", p.id) })),
              ...(booleans.length ? ["-" as const] : []),
              { label: "Create property", onSelect: createBoolean },
              ...(bound ? [{ label: "Detach property", onSelect: () => ops.bindProperty(node.id, "visible", undefined) }] : []),
            ])} />
          )}
          <IconButton label={node.visible === false ? "Show" : "Hide"} icon={fi(node.visible === false ? "hidden.small" : "eye.small")} onClick={() => (bound && holder ? ops.setPropertyValue(holder.id, bound.id, node.visible === false) : ops.patch(node.id, { visible: node.visible === false ? undefined : false }))} />
        </>
      }
    >
      {bound && (
        <div className="flex items-center gap-2 pl-4 pr-2 pb-1">
          <span className="flex flex-1 items-center gap-1 h-6 px-1 rounded-[5px] bg-[var(--f-bg-secondary)] text-[11px] text-[var(--f-text-component)]">{fi("24.boolean.small", 16)}<span className="truncate">{bound.name}</span></span>
          <IconButton label="Detach property" icon={fi("detach.small")} onClick={() => ops.bindProperty(node.id, "visible", undefined)} />
        </div>
      )}
      <PropRow icons={rounded ? <IconButton label="Individual corners" icon={fi("corners.independent")} active={independent} onClick={() => setIndependent((v) => !v)} /> : <span className="w-6" />}>
        <NumericInput label="Opacity" prefix={<Prefix>{fi("opacity")}</Prefix>} value={node.opacity ?? 100} min={0} max={100} unit="%" onChange={(opacity) => ops.patch(node.id, { opacity: opacity >= 100 ? undefined : opacity })} />
        {rounded ? (
          <BoundNumber label="Corner radius" prefix={<Prefix>{fi("corners")}</Prefix>} value={geo!.cornerRadius} variables={variables} byId={byId} mode={mode} min={0} onChange={(cornerRadius) => ops.patch(node.id, { cornerRadius, corners: undefined } as Partial<SceneNode>)} />
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
  const labels = ["Top left radius", "Top right radius", "Bottom right radius", "Bottom left radius"] as const;
  return (
    <BoundNumber
      label={labels[index]}
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
  // The styles button: the colour variables (Figma's Libraries), picked onto the first fill — a new one when there is none.
  const [libraries, setLibraries] = useState<{ top: number; right: number } | null>(null);
  const first = fills[0];
  const resolved = first ? String(boundValue(first.color, mode, byId) ?? "#000000") : "#d9d9d9";
  const putFirst = (paint: Paint) => setFills(first ? [{ ...first, ...paint }, ...fills.slice(1)] : [paint]);
  return (
    <Section title="Fill" muted={fills.length === 0} pb={fills.length ? 12 : 0} icons={<>
      <span data-picker-anchor="" className="relative flex">
        <IconButton label="Styles and variables" icon={fi("styles")} active={Boolean(libraries)} onClick={(e) => setLibraries(libraries ? null : anchorOf(e.currentTarget))} />
        {libraries && (
          <ColorPicker
            initialTab="libraries"
            color={resolved}
            opacity={first?.opacity ?? 100}
            anchor={libraries}
            variables={variables}
            byId={byId}
            mode={mode}
            pageColors={ops.pageColors}
            selectedId={first && "alias" in first.color ? first.color.alias : undefined}
            onChange={(hex, opacity) => putFirst({ color: own(hex), opacity: opacity >= 100 ? undefined : opacity })}
            onVariable={(color) => putFirst({ color })}
            onClose={() => setLibraries(null)}
          />
        )}
      </span>
      <IconButton label="Add fill" icon={fi("plus.small")} onClick={() => setFills([{ color: own(node.type === "text" ? "#000000" : "#d9d9d9") }, ...fills])} />
    </>}>
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
    <Section title="Stroke" muted={strokes.length === 0} pb={strokes.length ? 12 : 0} icons={<IconButton label="Add stroke" icon={fi("plus.small")} onClick={() => setStrokes([{ color: own("#000000"), weight: own(1), align: "inside" }, ...strokes])} />}>
      {strokes.map((stroke, i) => (
        <div key={i} className="flex flex-col">
          <PaintRow paint={stroke} variables={variables} byId={byId} mode={mode} pageColors={ops.pageColors} ops={ops} onChange={(s) => setStrokes(strokes.map((x, j) => (j === i ? s : x)))} onRemove={() => setStrokes(strokes.filter((_, j) => j !== i))} />
          <PropRow icons={<span className="w-6" />}>
            <Select label="Position" value={stroke.align} options={[{ value: "inside", label: "Inside" }, { value: "center", label: "Center" }, { value: "outside", label: "Outside" }]} onChange={(align) => setStrokes(strokes.map((x, j) => (j === i ? { ...x, align: align as StrokeStyle["align"] } : x)))} />
            <BoundNumber label="Stroke weight" prefix={<Prefix>{fi("stroke-weight")}</Prefix>} value={stroke.weight} variables={variables} byId={byId} mode={mode} min={0} onChange={(weight) => setStrokes(strokes.map((x, j) => (j === i ? { ...x, weight } : x)))} />
          </PropRow>
          {node.type !== "line" && (
            <PropRow icons={<span className="w-6" />}>
              <Select label="Stroke style" value={stroke.dashed ? "dashed" : "solid"} options={[{ value: "solid", label: "Solid" }, { value: "dashed", label: "Dashed" }]} onChange={(v) => setStrokes(strokes.map((x, j) => (j === i ? { ...x, dashed: v === "dashed" ? true : undefined } : x)))} />
              <div className="flex flex-1 items-center h-6 rounded-[5px] bg-[var(--f-bg-secondary)]">
                {(["top", "right", "bottom", "left"] as const).map((side) => {
                  const sides = stroke.sides ?? { top: true, right: true, bottom: true, left: true };
                  const toggle = () => { const next = { ...sides, [side]: !sides[side] }; const all = next.top && next.right && next.bottom && next.left; setStrokes(strokes.map((x, j) => (j === i ? { ...x, sides: all ? undefined : next } : x))); };
                  return <IconButton key={side} label={{ top: "Top", right: "Right", bottom: "Bottom", left: "Left" }[side]} icon={fi(`al.padding-${side}` as FigmaIconName)} active={sides[side]} onClick={toggle} className="flex-1" />;
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
      { label: "Create effect style", disabled: !effects.length, onSelect: () => ops.createEffectStyle(node.id) },
      ...(node.effectStyle ? [{ label: "Detach style", onSelect: () => ops.detachEffectStyle(node.id) }] : []),
    ]);
  return (
    <Section title="Effects" muted={effects.length === 0 && !style} pb={effects.length || style ? 12 : 0} icons={<><IconButton label="Effect styles" icon={fi("styles")} active={Boolean(style)} onClick={(e) => stylesMenu(e.currentTarget)} /><IconButton label="Add effect" icon={fi("plus.small")} onClick={(e) => add(e.currentTarget)} /></>}>
      {style && (
        <PropRow icons={<IconButton label="Detach style" icon={fi("detach.small")} onClick={() => ops.detachEffectStyle(node.id)} />}>
          <button type="button" onClick={(e) => stylesMenu(e.currentTarget)} className="flex flex-1 min-w-0 items-center gap-1 h-6 px-1 rounded-[5px] bg-[var(--f-bg-secondary)] text-left cursor-pointer">
            <span className="flex w-4 h-4 shrink-0 items-center justify-center overflow-hidden">{fi("24.effects.small", 16, "-m-1")}</span>
            <span className="truncate text-[11px] text-[var(--f-text)]">{style.name}</span>
          </button>
        </PropRow>
      )}
      {!style && effects.map((e, i) => (
        <PropRow key={i} icons={<><IconButton label={e.visible === false ? "Show" : "Hide"} icon={fi(e.visible === false ? "hidden.small" : "eye.small")} onClick={() => set(effects.map((x, j) => (j === i ? { ...x, visible: x.visible === false ? undefined : false } : x)))} /><IconButton label="Remove" icon={fi("minus.small")} onClick={() => { setEditing(null); set(effects.filter((_, j) => j !== i)); }} /></>}>
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
        <ChevronMenu label="Effect type" width={200} items={(Object.keys(EFFECT_LABEL) as Effect["type"][]).map((t) => ({ label: EFFECT_LABEL[t], checked: t === effect.type, onSelect: () => onChange(t === effect.type ? effect : { ...newEffect(t), visible: effect.visible }) }))}>
          <span className="flex items-center gap-2"><span className="flex w-4 h-4 items-center justify-center overflow-hidden"><EffectGlyph type={effect.type} /></span><span className="text-[13px] font-[550] leading-[22px]">{EFFECT_LABEL[effect.type]}</span></span>
        </ChevronMenu>
        <div className="flex items-center gap-2">
          <IconButton label="Close" icon={fi("close.small")} onClick={onClose} />
        </div>
      </div>
      <div className="flex flex-col py-2">
        {shadow ? (
          <>
            {row("Position", <><NumericInput label="X" prefix="X" value={shadow.x} onChange={(x) => onChange({ ...shadow, x })} /><NumericInput label="Y" prefix="Y" value={shadow.y} onChange={(y) => onChange({ ...shadow, y })} /></>)}
            {row("Blur", <NumericInput label="Blur" prefix={<Prefix>{fi("opacity")}</Prefix>} value={shadow.blur} min={0} onChange={(blur) => onChange({ ...shadow, blur })} />)}
            {row("Spread", <NumericInput label="Spread" prefix={<Prefix>{fi("24.spread.small")}</Prefix>} value={shadow.spread} onChange={(spread) => onChange({ ...shadow, spread })} />)}
            {row("Color", (
              <div className="relative flex flex-1">
                <ColorInput label="Shadow color" color={shadow.color} opacity={shadow.opacity} onColor={(color) => onChange({ ...shadow, color })} onOpacity={(opacity) => onChange({ ...shadow, opacity })} chit={<button type="button" data-picker-anchor="" aria-label="Color picker" onClick={(e) => setPicker(picker ? null : anchorOf(e.currentTarget))} className="cursor-pointer"><Chit color={shadow.color} /></button>} />
                {picker && <ColorPicker color={shadow.color} opacity={shadow.opacity} anchor={{ top: picker.top, right: left - 4 }} variables={[]} byId={new Map()} mode="light" pageColors={pageColors} onChange={(color, opacity) => onChange({ ...shadow, color, opacity })} onClose={() => setPicker(null)} />}
              </div>
            ))}
          </>
        ) : blur ? (
          row("Blur", <NumericInput label="Blur" prefix={<Prefix>{fi("opacity")}</Prefix>} value={blur.radius} min={0} onChange={(radius) => onChange({ ...blur, radius })} />)
        ) : null}
      </div>
    </div>
  );
}

function TextSection({ node, nodes, ops, variables, byId, mode, textStyles, lang, compositeId }: { node: TextNode; nodes: SceneNode[]; ops: EditorOps; variables: DesignVariable[]; byId: Map<string, DesignVariable>; mode: ThemeMode; textStyles: TextStyle[]; lang: "tr" | "en"; compositeId?: string }) {
  const weights = [300, 400, 500, 600, 700];
  const text = lang === "en" ? node.charactersEn ?? "" : node.characters;
  // Inside a main component: its words can come from a text property (Figma's "Apply text property") — typing then sets the property's default.
  const holder = compositeId ? null : componentAround(nodes, node.id)?.holder ?? null;
  const texts = holder?.properties?.filter((p) => p.type === "text") ?? [];
  const bound = node.charactersProp ? texts.find((p) => p.id === node.charactersProp) : undefined;
  const setText = (value: string) => {
    if (compositeId) return ops.override(compositeId, lang === "en" ? { charactersEn: value } : { characters: value });
    if (bound && holder && lang !== "en") return ops.setPropertyValue(holder.id, bound.id, value);
    ops.patch(node.id, (lang === "en" ? { charactersEn: value } : { characters: value }) as Partial<SceneNode>);
  };
  const createText = () => {
    if (!holder) return;
    const id = nid("p");
    ops.setComponentProperties(holder.id, [...(holder.properties ?? []), { id, name: freePropertyName(holder, node.name), type: "text", value: node.characters }]);
    ops.bindProperty(node.id, "text", id);
  };
  return (
    <Section title="Typography" pb={12} icons={!compositeId ? <>
      {holder && (
        <IconButton label="Apply text property" icon={fi("24.text")} active={Boolean(bound)} onClick={(e) => ops.menu(e.currentTarget, [
          ...texts.map((p) => ({ label: p.name, icon: fi("24.text", 16), checked: p.id === node.charactersProp, onSelect: () => ops.bindProperty(node.id, "text", p.id) })),
          ...(texts.length ? ["-" as const] : []),
          { label: "Create property", onSelect: createText },
          ...(bound ? [{ label: "Detach property", onSelect: () => ops.bindProperty(node.id, "text", undefined) }] : []),
        ])} />
      )}
      <IconButton label="Text styles" icon={fi("styles")} active={Boolean(node.textStyle)} onClick={(e) => ops.menu(e.currentTarget, [...textStyles.map((st) => ({ label: st.name, checked: st.id === node.textStyle, onSelect: () => ops.patch(node.id, { textStyle: st.id } as Partial<SceneNode>) })), ...(textStyles.length ? ["-" as const] : []), { label: "Create text style", onSelect: () => ops.createTextStyle(node.id) }, ...(node.textStyle ? [{ label: "Detach style", onSelect: () => ops.patch(node.id, { textStyle: undefined } as Partial<SceneNode>) }] : [])])} />
      <IconButton label="Type settings" icon={fi("24.adjust.small")} active={Boolean(node.textCase || node.textDecoration || (node.verticalAlign && node.verticalAlign !== "top"))} onClick={(e) => ops.menu(e.currentTarget, [
        { label: "As typed", checked: !node.textCase, onSelect: () => ops.patch(node.id, { textCase: undefined } as Partial<SceneNode>) },
        { label: "Uppercase", checked: node.textCase === "upper", onSelect: () => ops.patch(node.id, { textCase: "upper" } as Partial<SceneNode>) },
        { label: "Lowercase", checked: node.textCase === "lower", onSelect: () => ops.patch(node.id, { textCase: "lower" } as Partial<SceneNode>) },
        { label: "Title case", checked: node.textCase === "title", onSelect: () => ops.patch(node.id, { textCase: "title" } as Partial<SceneNode>) },
        "-",
        { label: "None", checked: !node.textDecoration, onSelect: () => ops.patch(node.id, { textDecoration: undefined } as Partial<SceneNode>) },
        { label: "Underline", checked: node.textDecoration === "underline", onSelect: () => ops.patch(node.id, { textDecoration: "underline" } as Partial<SceneNode>) },
        { label: "Strikethrough", checked: node.textDecoration === "strikethrough", onSelect: () => ops.patch(node.id, { textDecoration: "strikethrough" } as Partial<SceneNode>) },
        "-",
        { label: "Align top", checked: !node.verticalAlign || node.verticalAlign === "top", disabled: node.textAutoResize !== "none", onSelect: () => ops.patch(node.id, { verticalAlign: undefined } as Partial<SceneNode>) },
        { label: "Align middle", checked: node.verticalAlign === "middle", disabled: node.textAutoResize !== "none", onSelect: () => ops.patch(node.id, { verticalAlign: "middle" } as Partial<SceneNode>) },
        { label: "Align bottom", checked: node.verticalAlign === "bottom", disabled: node.textAutoResize !== "none", onSelect: () => ops.patch(node.id, { verticalAlign: "bottom" } as Partial<SceneNode>) },
      ])} />
    </> : undefined}>
      {bound && (
        <div className="flex items-center gap-2 pl-4 pr-2 pt-1">
          <span className="flex flex-1 items-center gap-1 h-6 px-1 rounded-[5px] bg-[var(--f-bg-secondary)] text-[11px] text-[var(--f-text-component)]">{fi("24.text", 16)}<span className="truncate">{bound.name}</span></span>
          <IconButton label="Detach property" icon={fi("detach.small")} onClick={() => ops.bindProperty(node.id, "text", undefined)} />
        </div>
      )}
      <div className="pl-4 pr-2 py-1">
        <textarea aria-label="Text" value={text} placeholder={lang === "en" ? node.characters : "Text"} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.stopPropagation()} rows={2} className="w-full resize-none rounded-[5px] border border-transparent bg-[var(--f-bg-secondary)] px-2 py-1 text-[11px] leading-4 text-[var(--f-text)] placeholder:text-[var(--f-text-secondary)] hover:border-[var(--f-border)] focus:outline-none focus:border-[var(--f-border-selected)]" />
      </div>
      {!compositeId && (
        <>
          <PropRow icons={<span className="w-6" />}>
            <Select label="Text style" value={node.textStyle ?? ""} options={[{ value: "", label: "Inter" }, ...textStyles.map((s) => ({ value: s.id, label: s.name }))]} onChange={(textStyle) => ops.patch(node.id, { textStyle: textStyle || undefined } as Partial<SceneNode>)} />
          </PropRow>
          <PropRow icons={<span className="w-6" />}>
            <Select label="Font weight" value={String(numberOf(node.fontWeight, byId, 400))} options={weights.map((w) => ({ value: String(w), label: weightLabel(w) }))} onChange={(w) => ops.patch(node.id, { fontWeight: own(Number(w)) } as Partial<SceneNode>)} />
            <BoundNumber label="Font size" prefix={<Prefix><span className="text-[10px]">Aa</span></Prefix>} value={node.fontSize} variables={variables} byId={byId} mode={mode} min={1} onChange={(fontSize) => ops.patch(node.id, { fontSize } as Partial<SceneNode>)} />
          </PropRow>
          <PropRow icons={<span className="w-6" />}>
            <NumericInput label="Line height" prefix={<Prefix>{fi("al.height-min")}</Prefix>} value={node.lineHeight ? numberOf(node.lineHeight, byId) : null} placeholder="Auto" fallback={Math.round(numberOf(node.fontSize, byId, 16) * 1.25)} min={0} onChange={(v) => ops.patch(node.id, { lineHeight: own(v) } as Partial<SceneNode>)} onClear={() => ops.patch(node.id, { lineHeight: undefined } as Partial<SceneNode>)} />
            <NumericInput label="Letter spacing" prefix={<Prefix>{fi("al.width-min")}</Prefix>} value={node.letterSpacing ? numberOf(node.letterSpacing, byId) : null} placeholder="0" fallback={0} min={-20} onChange={(v) => ops.patch(node.id, { letterSpacing: own(v) } as Partial<SceneNode>)} onClear={() => ops.patch(node.id, { letterSpacing: undefined } as Partial<SceneNode>)} />
          </PropRow>
          <PropRow icons={<span className="w-6" />}>
            <Segmented
              value={node.textAlign}
              options={[
                { value: "left" as const, label: "Align left", icon: fi("24.text.align-left") },
                { value: "center" as const, label: "Align center", icon: fi("24.text.align-center") },
                { value: "right" as const, label: "Align right", icon: fi("24.text.align-right") },
              ]}
              onChange={(textAlign) => ops.patch(node.id, { textAlign } as Partial<SceneNode>)}
            />
            <Segmented
              value={node.textAutoResize}
              options={[
                { value: "widthHeight" as const, label: "Auto width", icon: fi("24.text.resize-width") },
                { value: "height" as const, label: "Auto height", icon: fi("24.text.resize-height") },
                { value: "none" as const, label: "Fixed size", icon: fi("24.text.resize-fixed") },
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
    <Section title={set ? "Variant" : "Component"} icons={<IconButton label="Add variant" icon={fi("plus.small")} onClick={() => ops.addVariant(node.id)} />}>
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
        <p className="px-4 pt-1 text-[11px] leading-4 text-[var(--f-text-secondary)]">Main component: instances (⌘D, Assets) follow it. &quot;+&quot; adds a variant.</p>
      )}
    </Section>
  );
}

/** Figma's toggle: a boolean property's value. */
function Switch({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)} className={cn("relative w-7 h-4 shrink-0 rounded-full transition-colors cursor-pointer", checked ? "bg-[var(--f-bg-brand)]" : "bg-[var(--f-icon-tertiary)]")}>
      <span className={cn("absolute top-[2px] w-3 h-3 rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.25)] transition-[left]", checked ? "left-[14px]" : "left-[2px]")} />
    </button>
  );
}

/** A property's row on an instance, as Figma's: its name in the left column, its control at the right. */
function PropertyRow({ name, children }: { name: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2 h-8 pl-4 pr-2">
      <span className="w-[88px] shrink-0 truncate text-[11px] leading-4 text-[var(--f-text)]" title={name}>{name}</span>
      <div className="min-w-0 flex-1 flex items-center justify-end">{children}</div>
    </div>
  );
}

const propertyIcon = (type: PropertyType, size?: number) => fi(type === "boolean" ? "24.boolean.small" : type === "instanceSwap" ? "24.instance.swap.small" : "24.text", size);

/** The components an instance swap property can pick from: every component but the holder's own variants. */
function swapOptions(nodes: SceneNode[], holder: FrameNode | null) {
  const own = new Set(holder ? (holder.type === "componentSet" ? variantsOf(holder).map((v) => v.id) : [holder.id]) : []);
  return allComponents(nodes).filter(({ component }) => !own.has(component.id)).map(({ component, set }) => ({ value: component.id, label: set ? `${set.name} / ${variantName(component)}` : component.name }));
}

/**
 * A main component's (a set's) properties, as Figma's: the variant ones —
 * their names and values — and the boolean, text and instance swap ones;
 * "+" adds one, a row opens onto its name and default.
 */
function PropertiesSection({ holder, nodes, ops }: { holder: FrameNode; nodes: SceneNode[]; ops: EditorOps }) {
  const [editing, setEditing] = useState<string | null>(null);
  const isSet = holder.type === "componentSet";
  const variantProps = isSet ? variantProperties(holder) : [];
  const props = holder.properties ?? [];
  const options = swapOptions(nodes, holder);
  const add = (type: PropertyType) => {
    const id = nid("p");
    const base = type === "boolean" ? "Property" : type === "text" ? "Text" : "Instance";
    const value = type === "boolean" ? true : type === "text" ? "" : options[0]?.value ?? "";
    ops.setComponentProperties(holder.id, [...props, { id, name: freePropertyName(holder, base), type, value }]);
    setEditing(id);
  };
  const rename = (id: string, name: string) => name.trim() && ops.setComponentProperties(holder.id, props.map((p) => (p.id === id ? { ...p, name: name.trim() } : p)));
  const remove = (id: string) => ops.setComponentProperties(holder.id, props.filter((p) => p.id !== id));
  const preview = (p: ComponentProperty) => (p.type === "boolean" ? (p.value ? "True" : "False") : p.type === "instanceSwap" ? options.find((o) => o.value === p.value)?.label ?? "—" : String(p.value) || "—");
  return (
    <Section title="Properties" icons={<IconButton label="Add property" icon={fi("plus.small")} onClick={(e) => ops.menu(e.currentTarget, [
      { label: "Variant", icon: fi("24.create.variant.small", 16), onSelect: () => (isSet ? ops.addProperty(holder.id) : ops.addVariant(holder.id)) },
      { label: "Boolean", icon: fi("24.boolean.small", 16), onSelect: () => add("boolean") },
      { label: "Instance swap", icon: fi("24.instance.swap.small", 16), onSelect: () => add("instanceSwap") },
      { label: "Text", icon: fi("24.text", 16), onSelect: () => add("text") },
    ])} />}>
      {variantProps.map((p) => (
        <div key={p.name} className="flex flex-col">
          <PropRow icons={<IconButton label="Remove property" icon={fi("minus.small")} onClick={() => ops.removeProperty(holder.id, p.name)} />}>
            <TextInput label="Property name" prefix={<Prefix>{fi("24.create.variant.small", 16)}</Prefix>} value={p.name} onCommit={(to) => to.trim() && to.trim() !== p.name && ops.renameProperty(holder.id, p.name, to.trim())} />
          </PropRow>
          <div className="flex flex-wrap gap-1 pl-4 pr-2 pb-1">
            {p.values.map((v) => (
              <input key={v} aria-label={`${p.name} value`} defaultValue={v} onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== v && ops.renameValue(holder.id, p.name, v, e.target.value.trim())} className="h-5 px-1.5 rounded-[3px] bg-[var(--f-bg-secondary)] text-[11px] text-[var(--f-text)] outline-none border border-transparent focus:border-[var(--f-border-selected)]" style={{ width: `${Math.max(4, v.length + 2)}ch` }} />
            ))}
          </div>
        </div>
      ))}
      {props.map((p) => (
        <div key={p.id} className="flex flex-col">
          <div role="button" tabIndex={0} onClick={() => setEditing(editing === p.id ? null : p.id)} onKeyDown={(e) => { if (e.key === "Enter") setEditing(editing === p.id ? null : p.id); }} className={cn("group/prop flex items-center gap-2 h-8 pl-4 pr-2 cursor-pointer hover:bg-[var(--f-bg-hover)]", editing === p.id && "bg-[var(--f-bg-secondary)]")}>
            <span className="flex w-4 h-4 shrink-0 items-center justify-center text-[var(--f-icon-secondary)]">{propertyIcon(p.type, 16)}</span>
            <span className="min-w-0 flex-1 truncate text-[11px] leading-4 text-[var(--f-text)]">{p.name}<span className="text-[var(--f-text-secondary)]"> · {preview(p)}</span></span>
            <IconButton label="Remove property" icon={fi("minus.small")} onClick={(e) => { e.stopPropagation(); remove(p.id); }} className="opacity-0 group-hover/prop:opacity-100" />
          </div>
          {editing === p.id && (
            <div className="flex flex-col gap-1 pl-4 pr-2 py-1">
              <div className="flex items-center gap-2">
                <span className="w-[52px] shrink-0 text-[11px] text-[var(--f-text-secondary)]">Name</span>
                <TextInput label="Property name" value={p.name} onCommit={(name) => rename(p.id, name)} />
              </div>
              <div className="flex items-center gap-2 min-h-6">
                <span className="w-[52px] shrink-0 text-[11px] text-[var(--f-text-secondary)]">Value</span>
                {p.type === "boolean" && <Switch label="Default value" checked={Boolean(p.value)} onChange={(v) => ops.setPropertyValue(holder.id, p.id, v)} />}
                {p.type === "text" && <TextInput label="Default value" value={String(p.value)} onCommit={(v) => ops.setPropertyValue(holder.id, p.id, v)} />}
                {p.type === "instanceSwap" && <Select label="Default component" value={String(p.value)} options={options} onChange={(v) => ops.setPropertyValue(holder.id, p.id, v)} />}
              </div>
            </div>
          )}
        </div>
      ))}
      {isSet ? (
        <p className="px-4 pt-1 text-[11px] leading-4 text-[var(--f-text-secondary)]">{variantsOf(holder).length} {variantsOf(holder).length === 1 ? "variant" : "variants"}.</p>
      ) : props.length === 0 ? (
        <p className="px-4 pt-1 text-[11px] leading-4 text-[var(--f-text-secondary)]">No properties yet. &quot;+&quot; adds one; a layer binds to it from its own panel.</p>
      ) : null}
    </Section>
  );
}

function InstanceSection({ node, nodes, ops, lang }: { node: FrameNode; nodes: SceneNode[]; ops: EditorOps; lang: "tr" | "en" }) {
  const main = node.mainId ? findComponent(nodes, node.mainId) : null;
  const set = main ? setOf(nodes, main.id) : null;
  const variantProps = set ? variantProperties(set) : [];
  const props = main ? propertiesOf(nodes, main.id) : [];
  const values = main ? propertyValues(nodes, main, node) : {};
  const overridden = Boolean(node.overrides && Object.keys(node.overrides).length) || Boolean(node.props && Object.keys(node.props).length) || Boolean(node.propsEn && Object.keys(node.propsEn).length);
  // Inside a main component: which component it shows can follow an instance swap property.
  const around = componentAround(nodes, node.id);
  const holder = around?.holder ?? null;
  const swaps = holder?.properties?.filter((p) => p.type === "instanceSwap") ?? [];
  const boundSwap = node.mainProp ? swaps.find((p) => p.id === node.mainProp) : undefined;
  const createSwap = () => {
    if (!holder || !node.mainId) return;
    const id = nid("p");
    ops.setComponentProperties(holder.id, [...(holder.properties ?? []), { id, name: freePropertyName(holder, node.name), type: "instanceSwap", value: node.mainId }]);
    ops.bindProperty(node.id, "instance", id);
  };
  const swapItems = (p: ComponentProperty) => {
    const preferred = (p.preferred ?? []).map((id) => swapOptions(nodes, null).find((o) => o.value === id)).filter((o): o is { value: string; label: string } => Boolean(o));
    const all = swapOptions(nodes, null).filter((o) => !preferred.some((x) => x.value === o.value));
    return [...preferred, ...all];
  };
  return (
    <Section title="Instance" icons={<>
      {overridden && <IconButton label="Reset all changes" icon={fi("reset.instance.small")} onClick={ops.resetOverrides} />}
      {holder && (
        <IconButton label="Apply instance swap property" icon={fi("24.instance.swap.small")} active={Boolean(boundSwap)} onClick={(e) => ops.menu(e.currentTarget, [
          ...swaps.map((p) => ({ label: p.name, icon: fi("24.instance.swap.small", 16), checked: p.id === node.mainProp, onSelect: () => ops.bindProperty(node.id, "instance", p.id) })),
          ...(swaps.length ? ["-" as const] : []),
          { label: "Create property", onSelect: createSwap },
          ...(boundSwap ? [{ label: "Detach property", onSelect: () => ops.bindProperty(node.id, "instance", undefined) }] : []),
        ])} />
      )}
      <IconButton label="Go to main component" icon={fi("go.to.main.component.small")} onClick={ops.goToMain} />
      <IconButton label="Detach instance (⌥⌘B)" icon={fi("detach.small")} onClick={ops.detach} />
    </>}>
      <PropRow icons={<span className="w-6" />}>
        <div className="flex flex-1 items-center gap-1 h-6 px-1 rounded-[5px] bg-[var(--f-bg-secondary)] text-[11px] text-[var(--f-text-component)]">
          <FigmaIcon name="16.instance" />
          <span className="truncate">{main ? (set ? set.name : main.name) : "No main component"}</span>
        </div>
      </PropRow>
      {boundSwap && (
        <div className="flex items-center gap-2 pl-4 pr-2 pb-1">
          <span className="flex flex-1 items-center gap-1 h-6 px-1 rounded-[5px] bg-[var(--f-bg-secondary)] text-[11px] text-[var(--f-text-component)]">{fi("24.instance.swap.small", 16)}<span className="truncate">{boundSwap.name}</span></span>
          <IconButton label="Detach property" icon={fi("detach.small")} onClick={() => ops.bindProperty(node.id, "instance", undefined)} />
        </div>
      )}
      {variantProps.map((p) => (
        <PropertyRow key={p.name} name={p.name}>
          <Select label={p.name} value={main ? variantValue(main, p.name) : ""} options={p.values.map((v) => ({ value: v, label: v }))} onChange={(v) => ops.swapVariant(node.id, p.name, v)} />
        </PropertyRow>
      ))}
      {props.map((p) => (
        <PropertyRow key={p.id} name={p.name}>
          {p.type === "boolean" && <Switch label={p.name} checked={Boolean(values[p.id])} onChange={(v) => ops.setInstanceProp(node.id, p.id, v)} />}
          {p.type === "text" && (
            <TextInput label={p.name} value={lang === "en" ? node.propsEn?.[p.id] ?? "" : String(values[p.id] ?? "")} placeholder={lang === "en" ? String(values[p.id] ?? "") : undefined} onCommit={(v) => ops.setInstanceProp(node.id, p.id, v, lang === "en")} />
          )}
          {p.type === "instanceSwap" && <Select label={p.name} value={String(values[p.id] ?? "")} options={swapItems(p)} onChange={(v) => ops.setInstanceProp(node.id, p.id, v)} />}
        </PropertyRow>
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
    <Section title="Flows" muted={flows.length === 0}>
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
        <Section title="Interactions" muted>
          <p className="px-4 pt-1 text-[11px] leading-4 text-[var(--f-text-secondary)]">{node ? "Select a variant of a component set: interactions are set up there." : "Select a variant or an instance."}</p>
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
      <Section title="Interactions" muted={reactions.length === 0} icons={<IconButton label="Add interaction" icon={fi("plus.small")} onClick={() => { const r: Reaction = { id: nid("r"), trigger: "click", target: others[0]?.id ?? variant.id, animation: "smart", easing: "ease-out", duration: 300 }; set_([...reactions, r]); setOpenId(r.id); }} />}>
        {reactions.map((r) => {
          const patch = (p: Partial<Reaction>) => set_(reactions.map((x) => (x.id === r.id ? { ...x, ...p } : x)));
          const open = openId === r.id;
          return (
            <div key={r.id} className="flex flex-col">
              <div className="px-2 py-0.5">
                <div className={cn("group/reaction flex items-center gap-2 h-8 px-2 rounded-[5px] cursor-pointer hover:bg-[var(--f-bg-hover)]", open && "bg-[var(--f-bg-selected)]")} onClick={() => setOpenId(open ? null : r.id)}>
                  <div className="min-w-0 flex-1 flex flex-col leading-4">
                    <span className="truncate text-[11px] text-[var(--f-text)]">{TRIGGERS[r.trigger]}</span>
                    <span className="truncate text-[11px] text-[var(--f-text-secondary)]">Change to {nameOf(r.target)}</span>
                  </div>
                  <span className="hidden group-hover/reaction:flex" onClick={(e) => e.stopPropagation()}>
                    <IconButton label="Remove" icon={fi("minus.small")} onClick={() => set_(reactions.filter((x) => x.id !== r.id))} />
                  </span>
                </div>
              </div>
              {open && (
                <div className="flex flex-col pb-1">
                  <Labels a="Trigger" />
                  <PropRow icons={<span className="w-6" />}>
                    <Select label="Trigger" value={r.trigger} options={(Object.keys(TRIGGERS) as InteractionTrigger[]).map((t) => ({ value: t, label: TRIGGERS[t] }))} onChange={(trigger) => patch({ trigger: trigger as InteractionTrigger })} />
                    {r.trigger === "delay" ? <NumericInput label="Delay" prefix={<Prefix>ms</Prefix>} value={r.delay ?? 800} min={0} onChange={(delay) => patch({ delay })} /> : <span className="flex-1" />}
                  </PropRow>
                  <Labels a="Action" />
                  <PropRow icons={<span className="w-6" />}>
                    <Select label="Change to" value={r.target} options={variantsOf(set).map((v) => ({ value: v.id, label: `Change to ${variantName(v)}` }))} onChange={(target) => patch({ target })} />
                  </PropRow>
                  <Labels a="Animation" />
                  <PropRow icons={<span className="w-6" />}>
                    <Select label="Animation" value={r.animation} options={(Object.keys(ANIMATIONS) as InteractionAnimation[]).map((a) => ({ value: a, label: ANIMATIONS[a] }))} onChange={(animation) => patch({ animation: animation as InteractionAnimation })} />
                  </PropRow>
                  {r.animation !== "instant" && (
                    <PropRow icons={<span className="w-6" />}>
                      <Select label="Easing" value={r.easing} options={(Object.keys(EASINGS) as InteractionEasing[]).map((e) => ({ value: e, label: EASINGS[e].label }))} onChange={(easing) => patch({ easing: easing as InteractionEasing })} />
                      <NumericInput label="Duration" prefix={<Prefix>ms</Prefix>} value={r.duration} min={0} onChange={(duration) => patch({ duration })} />
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
    <Section title="Layout grid" muted={!grids.length} pb={grids.length ? 12 : 0} icons={<IconButton label="Add layout grid" icon={fi("plus.small")} onClick={(e) => ops.menu(e.currentTarget, (["columns", "rows", "grid"] as LayoutGrid["type"][]).map((t) => ({ label: LAYOUT_GRID_LABEL[t], onSelect: () => set([...grids, newLayoutGrid(t)]) })))} />}>
      {grids.map((g, i) => (
        <div key={i} className="flex flex-col">
          <PropRow icons={<><IconButton label={g.visible === false ? "Show" : "Hide"} icon={fi(g.visible === false ? "hidden.small" : "eye.small")} onClick={() => at(i, { visible: g.visible === false ? undefined : false })} /><IconButton label="Remove" icon={fi("minus.small")} onClick={() => set(grids.filter((_, j) => j !== i))} /></>}>
            <Select label="Layout grid type" value={g.type} options={(["columns", "rows", "grid"] as LayoutGrid["type"][]).map((t) => ({ value: t, label: LAYOUT_GRID_LABEL[t] }))} onChange={(type) => at(i, { type: type as LayoutGrid["type"] })} />
            {g.type === "grid" ? (
              <NumericInput label="Size" prefix={<Prefix>{fi("24.grid", 16)}</Prefix>} value={g.size} min={1} unit="px" onChange={(size) => at(i, { size })} />
            ) : (
              <NumericInput label="Count" prefix={<Prefix>{fi(g.type === "columns" ? "grid-column" : "grid-row")}</Prefix>} value={g.count} min={1} max={100} onChange={(count) => at(i, { count })} />
            )}
          </PropRow>
          {g.type !== "grid" && (
            <PropRow icons={<span className="w-6" />}>
              <NumericInput label="Gutter" prefix={<Prefix>{fi(g.type === "columns" ? "al.spacing-horizontal" : "al.spacing-vertical")}</Prefix>} value={g.gutter} min={0} onChange={(gutter) => at(i, { gutter })} />
              <NumericInput label="Margin" prefix={<Prefix>{fi("al.padding-horizontal")}</Prefix>} value={g.margin} min={0} onChange={(margin) => at(i, { margin })} />
            </PropRow>
          )}
          <PropRow icons={<span className="w-6" />}>
            <ColorInput label="Color" color={g.color} opacity={g.opacity} onColor={(color) => at(i, { color })} onOpacity={(opacity) => at(i, { opacity })} />
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
    <Section title="Export" muted={!settings.length} pb={settings.length ? 12 : 0} icons={<IconButton label="Add export setting" icon={fi("plus.small")} onClick={() => set([...settings, { scale: (settings.length ? Math.min(4, settings.length + 1) : 1) as ExportSetting["scale"], format: "png" }])} />}>
      {settings.map((st, i) => (
        <PropRow key={i} icons={<IconButton label="Remove" icon={fi("minus.small")} onClick={() => set(settings.filter((_, j) => j !== i))} />}>
          <Select label="Scale" value={String(st.scale)} options={[1, 2, 3, 4].map((n) => ({ value: String(n), label: `${n}x` }))} onChange={(v) => set(settings.map((x, j) => (j === i ? { ...x, scale: Number(v) as ExportSetting["scale"] } : x)))} />
          <Select label="Format" value={st.format} options={[{ value: "png", label: "PNG" }, { value: "jpg", label: "JPG" }, { value: "svg", label: "SVG" }]} onChange={(v) => set(settings.map((x, j) => (j === i ? { ...x, format: v as ExportSetting["format"] } : x)))} />
        </PropRow>
      ))}
      {settings.length > 0 && (
        <div className="px-4 pt-1">
          <button type="button" onClick={() => settings.forEach((st) => ops.exportNode(node.id, st))} className="flex w-full h-8 items-center justify-center rounded-[5px] border border-[var(--f-border)] text-[11px] font-[450] text-[var(--f-text)] hover:bg-[var(--f-bg-hover)] cursor-pointer">
            Export {node.name}
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
    <Section title="Selection colors" pb={12}>
      {[...colors].map(([key, c]) => (
        <PropRow key={key} icons={<span className="w-6" />}>
          {c.variable ? (
            <div className="flex flex-1 min-w-0 items-center h-6 rounded-[5px] bg-[var(--f-bg-secondary)]">
              <Chit color={String(boundValue(c.variable.light, mode, byId) ?? "#000")} />
              <span className="truncate text-[11px] text-[var(--f-text)]">{splitName(c.variable.name)[1] || c.variable.name}</span>
            </div>
          ) : (
            <ColorInput label="Selection color" color={key} opacity={c.opacity} onColor={(hex) => ops.replaceColor(key, hex)} onOpacity={(opacity) => ops.replaceColor(key, key, opacity)} />
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
      <ColorInput label="Canvas color" color={background} opacity={100} onColor={ops.setBackground} chit={<button type="button" data-picker-anchor="" aria-label="Color picker" onClick={(e) => setPicker(picker ? null : anchorOf(e.currentTarget))} className="cursor-pointer"><Chit color={background} /></button>} />
      {picker && <ColorPicker color={background} opacity={100} anchor={picker} variables={variables} byId={byId} mode={mode} pageColors={ops.pageColors} onChange={(hex) => ops.setBackground(hex)} onClose={() => setPicker(null)} />}
    </div>
  );
}

const KIND: Record<SceneNode["type"], string> = { frame: "Frame", rectangle: "Rectangle", ellipse: "Ellipse", line: "Line", text: "Text", component: "Component", componentSet: "Component set", instance: "Instance" };

export function Inspector({ nodes, pageNodes = nodes, selection, tab, ops: baseOps, variables, byId, mode, textStyles, lang, background, header }: {
  /** Every page's nodes (where main components are found) */
  nodes: SceneNode[];
  /** The open page's own — its flows */
  pageNodes?: SceneNode[];
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
    // A layer inside an instance (a nested one's too), as drawn: its overrides on it.
    node = layerAt(nodes, composite)?.node ?? null;
  } else if (first) {
    const found = findNode(nodes, first);
    node = found?.node ?? null;
    parent = found?.parent ?? null;
  }
  const flows = pageNodes.filter((n) => isFrameLike(n) && n.type !== "componentSet").map((n) => ({ id: n.id, name: n.name }));

  if (!node) {
    if (tab === "prototype") return <PrototypeSection node={null} nodes={nodes} ops={ops} flows={flows} />;
    const byGroups = [...byGroup(textStyles)];
    const pageFrame = getNode(nodes, ops.pageId);
    return (
      <div className="flex flex-col">
        <Section title="Page" icons={<IconButton label="Open variables" icon={fi("variable.small")} onClick={ops.openVariables} />}>
          <PropRow icons={<IconButton label="Show" icon={fi("eye.small")} />}>
            <PageColor background={background} ops={ops} variables={variables} byId={byId} mode={mode} />
          </PropRow>
        </Section>
        <Section title="Local styles" icons={<IconButton label="Create style" icon={fi("plus.small")} onClick={(e) => ops.menu(e.currentTarget, [{ label: "Create text style", onSelect: () => ops.createTextStyle(null) }, { label: "Create color style", onSelect: () => ops.createColorStyle("#000000") }, { label: "Create effect style", hint: "select a layer", disabled: true }])} />} pb={12}>
          <Labels a="Text styles" />
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
          <Labels a="Color styles" className="pt-2" />
          {variables.filter((v) => v.kind === "color").slice(0, 12).map((v) => (
            <button key={v.id} type="button" onClick={ops.openVariables} className="flex items-center gap-2 h-8 pl-4 pr-2 text-left hover:bg-[var(--f-bg-hover)] cursor-pointer">
              <span className="flex w-6 shrink-0 items-center justify-center"><span className="w-4 h-4 rounded-full border border-[var(--f-border-translucent)]" style={{ background: String(boundValue(v.light, mode, byId) ?? "#000") }} /></span>
              <span className="min-w-0 flex-1 truncate text-[11px] text-[var(--f-text)]">{v.name}</span>
            </button>
          ))}
          <button type="button" onClick={ops.openVariables} className="flex items-center gap-2 h-8 pl-4 pr-2 text-left text-[11px] text-[var(--f-text-secondary)] hover:text-[var(--f-text)] cursor-pointer">All variables ({variables.length})…</button>
          {ops.effectStyles.length > 0 && <Labels a="Effect styles" className="pt-2" />}
          {ops.effectStyles.map((st) => (
            <div key={st.id} className="group/es flex items-center gap-2 h-8 pl-4 pr-2 hover:bg-[var(--f-bg-hover)]">
              <span className="flex w-6 shrink-0 items-center justify-center text-[var(--f-icon-secondary)]">{fi("24.effects.small", 16)}</span>
              <span className="min-w-0 flex-1 truncate text-[11px] text-[var(--f-text)]">{st.name}</span>
              <IconButton label="Delete style" icon={fi("minus.small")} onClick={() => ops.removeEffectStyle(st.id)} className="opacity-0 group-hover/es:opacity-100" />
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
  const title = multi ? `${selection.length} layers` : KIND[node.type];
  const headerMenu = multi || composite ? [] : header(node);

  return (
    <div className="flex flex-col">
      {/* The layer header, as Figma's: the kind with its menu (the layers holding it); at the right, create component and "…". */}
      <div className="flex items-center justify-between h-12 pl-4 pr-2 py-1 border-b border-[var(--f-border)]">
        <ChevronMenu label="Layer" items={headerMenu.map((m) => ({ label: m.label, hint: m.hint, onSelect: m.onSelect }))} width={200} className={cn(headerMenu.length === 0 && "pointer-events-none")}>
          <span className={cn("truncate text-[13px] font-[550] leading-[22px] tracking-[-0.0325px]", purple ? "text-[var(--f-text-component)]" : "text-[var(--f-text)]")}>{title}</span>
        </ChevronMenu>
        <div className="flex items-center gap-2">
          {!composite && !multi && node.type === "frame" && <IconButton label="Create component (⌥⌘K)" icon={fi("component.small")} onClick={ops.createComponent} />}
          <IconButton label="More" icon={<span className="text-[var(--f-icon)]">{fi("24.more")}</span>} onClick={(e) => ops.more(e.currentTarget)} />
        </div>
      </div>
      {tab === "prototype" ? (
        <PrototypeSection node={node} nodes={nodes} ops={ops} flows={flows} />
      ) : composite ? (
        <>
          <Section title="Instance layer">
            <p className="px-4 pt-1 text-[11px] leading-4 text-[var(--f-text-secondary)]">Layer of the main component: changes apply to this instance only.</p>
            <div className="pl-4 pr-2 py-2"><Checkbox label="Visible" checked={node.visible !== false} onChange={(v) => ops.override(composite, { visible: v ? undefined : false })} /></div>
          </Section>
          {node.type === "text" && <TextSection node={node} nodes={nodes} ops={ops} variables={variables} byId={byId} mode={mode} textStyles={textStyles} lang={lang} compositeId={composite} />}
          <FillSection node={node} ops={ops} variables={variables} byId={byId} mode={mode} compositeId={composite} />
          {node.type !== "text" && <StrokeSection node={node} ops={ops} variables={variables} byId={byId} mode={mode} compositeId={composite} />}
        </>
      ) : (
        <>
          {node.type === "instance" && <InstanceSection node={node} nodes={nodes} ops={ops} lang={lang} />}
          {node.type === "component" && <ComponentSection node={node} nodes={nodes} ops={ops} />}
          {node.type === "component" && !setOf(nodes, node.id) && <PropertiesSection holder={node} nodes={nodes} ops={ops} />}
          {node.type === "componentSet" && <PropertiesSection holder={node} nodes={nodes} ops={ops} />}
          <PositionSection node={node} inAuto={inAuto} ops={ops} multi={selection} />
          <LayoutSection node={node} parent={parent} ops={ops} variables={variables} byId={byId} mode={mode} />
          <AppearanceSection node={node} nodes={nodes} ops={ops} variables={variables} byId={byId} mode={mode} />
          {node.type === "text" && <TextSection node={node} nodes={nodes} ops={ops} variables={variables} byId={byId} mode={mode} textStyles={textStyles} lang={lang} />}
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
