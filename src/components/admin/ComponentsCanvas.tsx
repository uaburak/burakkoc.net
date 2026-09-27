"use client";

import { useEffect, useLayoutEffect, useRef, type CSSProperties } from "react";
import type { BlockEntry, BlockType } from "@/types/project";
import type { DesignComponent, InstanceLayer } from "@/types/design";
import { cn } from "@/lib/utils";
import { gridFlow } from "@/lib/projectLayout";
import { ProjectBlock } from "@/components/project/CoreBlocks";
import { componentLayout, componentLook } from "@/components/project/components";
import { useDesignVariables } from "@/components/project/designVariables";
import { frameLookStyle } from "@/components/project/frameLook";
import { innerChildStyle, innerLayoutStyle } from "@/components/project/LayoutGrid";
import { startingStyle, useTextStyles } from "@/components/project/textStyles";
import { FigmaIcon } from "@/components/admin/figmaIcons";
import { SizeBadge, LayerRow } from "@/components/admin/layerTree";

/**
 * The live editor's Bileşenler page — Figma's page of main components: every
 * one of the site's components as its main component, one under the other,
 * its name over it in purple. A page component (the Proje Künyesi) shows with
 * the items of its first instance on the project (or placeholders); one used
 * inside others (the Kart) with the texts of one of them. As in Figma, a click
 * selects a main component and the next one a layer inside it (Cmd / Ctrl:
 * the layer at once); editing it changes every instance, on every page.
 */

/** What is selected on the Bileşenler page: a main component, or one of its layers. */
export type MainSelection = { componentId: string; layerId?: string };

/** The instances a component repeats, one per item — the layer an item on the canvas is. */
const repeatLayer = (component: DesignComponent) => component.layers.find((layer): layer is InstanceLayer => layer.kind === "instance");

/** The elements on the canvas a selection is — a repeated layer is every one of its instances. */
export function mainSelector(selection: MainSelection, components: readonly DesignComponent[]): string {
  const root = `[data-main-component="${selection.componentId}"]`;
  if (!selection.layerId) return `${root} [data-main-frame]`;
  const component = components.find((c) => c.id === selection.componentId);
  return component && repeatLayer(component)?.id === selection.layerId ? `${root} [data-component]` : `${root} [data-main-layer="${selection.layerId}"]`;
}

/** The element whose auto layout a main component's frame is (its columns and rows are measured there). */
export function mainFrameSelector(component: DesignComponent) {
  const root = `[data-main-component="${component.id}"]`;
  return component.type ? `${root} [data-component-frame]` : `${root} [data-main-frame]`;
}

/**
 * A component used inside others, on its own: its frame (its auto layout and
 * look) holding its text layers, with an item's texts — its layers' names
 * when there is none.
 */
function ItemSample({ component, entry }: { component: DesignComponent; entry?: BlockEntry }) {
  const variables = useDesignVariables();
  const styles = useTextStyles();
  const byId = new Map(variables.map((v) => [v.id, v]));
  const layout = componentLayout(component, byId);
  const known = (id?: string) => Boolean(id) && styles.some((s) => s.id === id);
  const frame: CSSProperties = { ...innerLayoutStyle(layout), ...frameLookStyle(componentLook(component), variables, { projectRadius: true }) };
  return (
    <div data-main-frame="" style={frame}>
      {component.layers.map((layer) =>
        layer.kind === "text" ? (
          <span
            key={layer.id}
            data-main-layer={layer.id}
            data-text-style={known(layer.style) ? layer.style : startingStyle(layer.field)}
            className="block min-w-0 break-words"
            style={{ ...innerChildStyle(layer.size, layer.align, gridFlow(layout)), ...(layer.opacity !== undefined && layer.opacity < 100 ? { opacity: layer.opacity / 100 } : {}) }}
          >
            {entry?.[layer.field]?.trim() || layer.name}
          </span>
        ) : (
          <span key={layer.id} data-main-layer={layer.id} className="flex items-center gap-1 text-[12px] text-[var(--edit-component)]">
            <FigmaIcon name="16.instance" />
            {layer.name}
          </span>
        )
      )}
    </div>
  );
}

/** Outlines of the canvas's layers, as Figma's: hovered lighter, selected solid — a main component and its instances purple, a text blue. */
const OUTLINES = `
[data-components-canvas] :is([data-main-frame], [data-component], [data-main-layer]) { outline: 1px solid transparent; outline-offset: -1px; transition: outline-color .15s; }
[data-components-canvas] :is([data-main-frame], [data-component])[data-canvas-hover] { outline-color: color-mix(in srgb, var(--edit-component) 45%, transparent); }
[data-components-canvas] :is([data-main-frame], [data-component])[data-layer-hover] { outline-color: color-mix(in srgb, var(--edit-component) 70%, transparent); }
[data-components-canvas] :is([data-main-frame], [data-component])[data-selected-layer] { outline-color: var(--edit-component); }
[data-components-canvas] [data-main-layer][data-canvas-hover] { outline-color: color-mix(in srgb, var(--edit-accent) 45%, transparent); }
[data-components-canvas] [data-main-layer][data-layer-hover] { outline-color: color-mix(in srgb, var(--edit-accent) 70%, transparent); }
[data-components-canvas] [data-main-layer][data-selected-layer] { outline-color: var(--edit-accent); }
`;

/** What a press at `target` selects: the main component under it, or — inside the selected one, or `deep` — its layer there. */
function pickAt(target: Element, components: readonly DesignComponent[], selection: MainSelection | null, deep: boolean): { selection: MainSelection; el: HTMLElement } | null {
  const root = target.closest<HTMLElement>("[data-main-component]");
  const componentId = root?.dataset.mainComponent;
  const component = components.find((c) => c.id === componentId);
  if (!root || !component) return null;
  const frame = root.querySelector<HTMLElement>("[data-main-frame]");
  const layerEl = target.closest<HTMLElement>("[data-main-layer], [data-component]");
  const layerId = layerEl && root.contains(layerEl) ? layerEl.dataset.mainLayer ?? repeatLayer(component)?.id : undefined;
  const inside = selection?.componentId === component.id;
  if (layerEl && layerId && (inside || deep)) return { selection: { componentId: component.id, layerId }, el: layerEl };
  return frame ? { selection: { componentId: component.id }, el: frame } : null;
}

export function ComponentsCanvas({ components, sampleEntries, selection, onSelect }: {
  components: DesignComponent[];
  /** Items for a type's main component to show: its first instance's on the project, else placeholders */
  sampleEntries: (type: BlockType) => BlockEntry[];
  selection: MainSelection | null;
  onSelect: (next: MainSelection | null) => void;
}) {
  const canvas = useRef<HTMLDivElement>(null);
  const hovered = useRef<HTMLElement | null>(null);
  const showHover = (el: HTMLElement | null) => {
    if (hovered.current === el) return;
    hovered.current?.removeAttribute("data-canvas-hover");
    el?.setAttribute("data-canvas-hover", "");
    hovered.current = el;
  };

  // The selection carries `data-selected-layer`: its outline.
  useLayoutEffect(() => {
    const root = canvas.current;
    if (!root) return;
    root.querySelectorAll("[data-selected-layer]").forEach((el) => el.removeAttribute("data-selected-layer"));
    if (selection) root.querySelectorAll(mainSelector(selection, components)).forEach((el) => el.setAttribute("data-selected-layer", ""));
  });
  // Rows hovered when the page goes away leave no outline behind.
  useEffect(() => () => document.querySelectorAll("[data-layer-hover]").forEach((el) => el.removeAttribute("data-layer-hover")), []);

  /** The texts a component used inside others shows: an item of the first page component repeating it. */
  const itemEntry = (component: DesignComponent) => {
    const holder = components.find((c) => c.type && repeatLayer(c)?.component === component.id);
    return holder?.type ? sampleEntries(holder.type)[0] : undefined;
  };

  return (
    <div
      ref={canvas}
      data-components-canvas=""
      className="flex flex-col items-start gap-16"
      onPointerDownCapture={(e) => {
        if (e.button !== 0) return;
        const picked = pickAt(e.target as Element, components, selection, e.metaKey || e.ctrlKey);
        onSelect(picked?.selection ?? null);
      }}
      onPointerOver={(e) => showHover(pickAt(e.target as Element, components, selection, e.metaKey || e.ctrlKey)?.el ?? null)}
      onPointerLeave={() => showHover(null)}
      // Nothing on the canvas navigates or follows a link.
      onClickCapture={(e) => e.preventDefault()}
      // A click on a main component selected it (on press): it must not reach the canvas, which clears the selection.
      onClick={(e) => { if ((e.target as Element).closest("[data-main-component]")) e.stopPropagation(); }}
    >
      <style>{OUTLINES}</style>
      {components.map((component) => (
        <section key={component.id} data-main-component={component.id} className="flex flex-col gap-1.5" style={{ width: component.type ? 640 : 320 }}>
          <span className="flex items-center gap-1 text-[11px] font-medium leading-4 text-[var(--edit-component)] select-none">
            <FigmaIcon name="16.component" />
            {component.name}
          </span>
          {component.type ? (
            <div data-main-frame="" className="w-full">
              <ProjectBlock block={{ id: `main-${component.id}`, type: component.type, component: component.id, entries: sampleEntries(component.type) }} />
            </div>
          ) : (
            <ItemSample component={component} entry={itemEntry(component)} />
          )}
        </section>
      ))}
      {selection && <SizeBadge selector={`[data-components-canvas] ${mainSelector(selection, components)}`} tone={selection.layerId && !components.some((c) => c.id === selection.componentId && repeatLayer(c)?.id === selection.layerId) ? "var(--edit-accent)" : "var(--edit-component)"} />}
    </div>
  );
}

/**
 * The Bileşenler page in the layer tree: each main component (Figma's purple
 * mark) and, open, its layers — its texts, and the instances it repeats.
 * Click selects (the canvas follows), double-click renames, hover outlines it
 * on the canvas.
 */
export function ComponentLayers({ components, selection, open, onToggle, onSelect, onRename }: {
  components: DesignComponent[];
  selection: MainSelection | null;
  /** Components open in the tree */
  open: ReadonlySet<string>;
  onToggle: (id: string) => void;
  onSelect: (next: MainSelection) => void;
  /** A component's name (no layer), or a layer's (undefined: back to the default) */
  onRename: (componentId: string, layerId: string | undefined, name: string | undefined) => void;
}) {
  return (
    <div className="flex flex-col gap-px">
      {components.map((component) => {
        const root = `[data-main-component="${component.id}"]`;
        const isOpen = open.has(component.id);
        const selected = selection?.componentId === component.id;
        return (
          <div key={component.id} className={cn("relative flex flex-col rounded-[8px]", selected && "bg-[color-mix(in_srgb,var(--bg-4)_50%,transparent)]")}>
            <LayerRow
              depth={0}
              tone="var(--edit-component)"
              nameTone="var(--edit-component)"
              icon={<FigmaIcon name="16.component" />}
              name={component.name}
              selected={selected && !selection?.layerId}
              open={component.layers.length > 0 ? isOpen : undefined}
              onToggle={() => onToggle(component.id)}
              hover={`${root} [data-main-frame]`}
              onSelect={() => onSelect({ componentId: component.id })}
              onInspect={() => onSelect({ componentId: component.id })}
              onRename={(name) => onRename(component.id, undefined, name)}
            />
            {isOpen && component.layers.map((layer) => (
              <LayerRow
                key={layer.id}
                depth={1}
                tone={layer.kind === "text" ? "var(--edit-accent)" : "var(--edit-component)"}
                nameTone={layer.kind === "instance" ? "var(--edit-component)" : undefined}
                icon={<FigmaIcon name={layer.kind === "text" ? "16.text" : "16.instance"} />}
                name={layer.name}
                selected={selected && selection?.layerId === layer.id}
                hover={layer.kind === "instance" ? `${root} [data-component]` : `${root} [data-main-layer="${layer.id}"]`}
                onSelect={() => onSelect({ componentId: component.id, layerId: layer.id })}
                onInspect={() => onSelect({ componentId: component.id, layerId: layer.id })}
                onRename={(name) => onRename(component.id, layer.id, name)}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}
