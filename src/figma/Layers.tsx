"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { fi } from "@/components/admin/figmaIcons";
import { isFrameLike, type SceneNode } from "./model";

/**
 * Figma's Layers list, as UI3 draws it: 32px rows — 12px in, the chevron
 * (16px, only on what holds layers), the layer's icon (16px), 8px, its name;
 * 24px further in per level. A selected layer sits in the light blue cell
 * (8px from the left edge, to the right edge, 5px corners) and everything
 * inside it is tinted lighter, in one block. Hovering tints the row and shows
 * the lock and the eye at its end. Click selects, ⌘-click adds or removes,
 * ⇧-click selects the run of rows up to it; double-click renames; ⌥-click
 * on a chevron opens or closes everything inside. A row dragged lands before
 * or after another, or inside a frame. Hovering a row outlines its node on
 * the canvas.
 */

export type TreePlace = "before" | "after" | "inside";

export function layerIcon(node: SceneNode): ReactNode {
  switch (node.type) {
    case "text": return fi("16.text");
    case "rectangle": return fi("16.rectangle");
    case "ellipse": return fi("16.ellipse");
    case "line": return fi("16.line");
    case "component": return fi("16.component");
    case "componentSet": return fi("16.component.set");
    case "instance": return fi("16.instance");
    default: {
      if (node.layoutMode === "vertical") return fi(node.counterAlign === "center" ? "16.autolayout.vertical.center" : node.counterAlign === "max" ? "16.autolayout.vertical.right" : "16.autolayout.vertical.left");
      if (node.layoutMode === "horizontal") {
        if (node.layoutWrap) return fi(node.counterAlign === "center" ? "16.autolayout.wrap.center" : node.counterAlign === "max" ? "16.autolayout.wrap.right" : "16.autolayout.wrap.left");
        return fi(node.counterAlign === "center" ? "16.autolayout.horizontal.center" : node.counterAlign === "max" ? "16.autolayout.horizontal.bottom" : "16.autolayout.horizontal.top");
      }
      return fi(node.fills?.length === 0 && !node.clipsContent ? "16.group" : "16.frame");
    }
  }
}

const isPurple = (node: SceneNode) => node.type === "component" || node.type === "componentSet" || node.type === "instance";

export function hoverNode(id: string | null) {
  document.querySelectorAll("[data-figma-canvas] [data-layer-hover]").forEach((el) => el.removeAttribute("data-layer-hover"));
  if (id) document.querySelector(`[data-figma-canvas] [data-node-id="${CSS.escape(id)}"]`)?.setAttribute("data-layer-hover", "");
}

const RENAME_EVENT = "layer-rename";

/** Starts renaming the row of `id` — once it is in the list. */
export function requestRename(id: string) {
  document.querySelector(`[data-tree-row="${CSS.escape(id)}"]`)?.dispatchEvent(new Event(RENAME_EVENT));
}

interface TreeDrag {
  id: string;
  started: boolean;
  target: { id: string; place: TreePlace } | null;
}

/** The cell's inset: Figma's rows are tinted from 8px in to the right edge. */
const CELL = { left: 8, right: 0 };

function Row({ node, depth, selected, insideSelected, open, hasKids, onToggle, onRename, onToggleHidden, onToggleLocked, target, dragging, onPointerDown, onContextMenu }: {
  node: SceneNode;
  depth: number;
  selected: boolean;
  insideSelected: boolean;
  open: boolean;
  hasKids: boolean;
  onToggle: (all: boolean) => void;
  onRename: (name: string) => void;
  onToggleHidden: () => void;
  onToggleLocked: () => void;
  target: TreePlace | null;
  dragging: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
  onContextMenu: (e: React.MouseEvent) => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const ended = useRef(false);
  const row = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = row.current;
    if (!el) return;
    const start = () => { ended.current = false; setRenaming(true); };
    el.addEventListener(RENAME_EVENT, start);
    return () => el.removeEventListener(RENAME_EVENT, start);
  }, []);
  const finish = (value?: string) => {
    if (ended.current) return;
    ended.current = true;
    if (value !== undefined && value.trim()) onRename(value.trim());
    setRenaming(false);
  };
  const purple = isPurple(node);
  const hidden = node.visible === false;
  const pinned = node.locked || hidden;
  return (
    <div
      ref={row}
      data-tree-row={node.id}
      data-tree-frame={isFrameLike(node) && node.type !== "instance" ? "" : undefined}
      onPointerDown={onPointerDown}
      onMouseEnter={() => hoverNode(node.id)}
      onMouseLeave={() => hoverNode(null)}
      onContextMenu={onContextMenu}
      onDoubleClick={(e) => { e.stopPropagation(); ended.current = false; setRenaming(true); }}
      className={cn("group/row relative h-8 select-none", dragging && "opacity-40")}
    >
      {/* The cell: selected, in the light blue; inside a selected layer, the lighter tint runs on (its block rounds as one); hovered, the grey. */}
      <div
        className={cn(
          "absolute top-0 bottom-0",
          selected ? cn("bg-[var(--f-bg-selected)]", open && hasKids ? "rounded-t-[5px]" : "rounded-[5px]") : insideSelected ? "" : "rounded-[5px] group-hover/row:bg-[var(--f-bg-hover)]",
          target === "inside" && "outline outline-2 -outline-offset-2 outline-[var(--f-border-selected)] rounded-[5px]"
        )}
        style={CELL}
      />
      {target && target !== "inside" && <span aria-hidden className={cn("pointer-events-none absolute right-0 z-10 h-[2px] rounded-full bg-[var(--f-border-selected)]", target === "before" ? "top-0" : "bottom-0")} style={{ left: 12 + depth * 24 }} />}
      <div className="relative flex items-center h-8 pr-2" style={{ paddingLeft: 12 + depth * 24 }}>
        <button
          type="button"
          aria-label={open ? "Daralt" : "Genişlet"}
          tabIndex={-1}
          onClick={(e) => { e.stopPropagation(); onToggle(e.altKey); }}
          onDoubleClick={(e) => e.stopPropagation()}
          className={cn("flex w-4 h-4 shrink-0 items-center justify-center text-[var(--f-icon-secondary)] cursor-pointer", !hasKids && "invisible")}
        >
          {fi(open ? "16.chevron.down" : "16.chevron.right")}
        </button>
        <span className={cn("flex w-4 h-4 shrink-0 items-center justify-center", purple ? "text-[var(--f-text-component)]" : "text-[var(--f-icon-secondary)]", hidden && "opacity-50")}>{layerIcon(node)}</span>
        {renaming ? (
          <input
            autoFocus
            aria-label="Katman adı"
            defaultValue={node.name}
            onFocus={(e) => e.currentTarget.select()}
            onBlur={(e) => finish(e.currentTarget.value)}
            onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Enter") finish(e.currentTarget.value); if (e.key === "Escape") finish(); }}
            onPointerDown={(e) => e.stopPropagation()}
            className="min-w-0 flex-1 ml-2 h-6 px-1 rounded-[3px] bg-[var(--f-bg)] border border-[var(--f-border-selected)] text-[11px] leading-4 text-[var(--f-text)] outline-none select-text"
          />
        ) : (
          <span className={cn("min-w-0 flex-1 ml-2 truncate text-[11px] font-[450] leading-4 tracking-[0.055px]", purple ? "text-[var(--f-text-component)]" : "text-[var(--f-text)]", hidden && "opacity-50")}>{node.name}</span>
        )}
        <div className={cn("flex shrink-0 items-center", !pinned && "opacity-0 group-hover/row:opacity-100")}>
          <button type="button" aria-label={node.locked ? "Kilidi aç" : "Kilitle"} tabIndex={-1} onClick={(e) => { e.stopPropagation(); onToggleLocked(); }} className={cn("flex w-6 h-6 items-center justify-center text-[var(--f-icon)] cursor-pointer", !node.locked && "opacity-0 group-hover/row:opacity-100")}>
            {fi(node.locked ? "16.lock.locked" : "16.lock.unlocked")}
          </button>
          <button type="button" aria-label={hidden ? "Göster" : "Gizle"} tabIndex={-1} onClick={(e) => { e.stopPropagation(); onToggleHidden(); }} className={cn("flex w-6 h-6 items-center justify-center text-[var(--f-icon)] cursor-pointer", !hidden && "opacity-0 group-hover/row:opacity-100")}>
            {fi(hidden ? "16.hidden" : "16.visible")}
          </button>
        </div>
      </div>
    </div>
  );
}

export function Layers({ nodes, selection, open, onToggle, onToggleMany, onSelect, onSelectMany, onRename, onToggleHidden, onToggleLocked, onMoveInTree, onContextMenu, filter }: {
  nodes: SceneNode[];
  selection: readonly string[];
  open: ReadonlySet<string>;
  onToggle: (id: string) => void;
  /** ⌥-click on a chevron: the layer and everything inside it opened or closed */
  onToggleMany: (ids: string[], open: boolean) => void;
  onSelect: (id: string, additive: boolean) => void;
  /** ⇧-click: the run of rows from the last selected one to the clicked one */
  onSelectMany: (ids: string[]) => void;
  onRename: (id: string, name: string) => void;
  onToggleHidden: (id: string) => void;
  onToggleLocked: (id: string) => void;
  onMoveInTree: (id: string, targetId: string, place: TreePlace) => void;
  onContextMenu: (id: string, e: React.MouseEvent) => void;
  /** Figma's Find: only the rows whose names hold it (and the frames holding them) */
  filter?: string;
}) {
  const [drag, setDrag] = useState<TreeDrag | null>(null);
  const dragRef = useRef<TreeDrag | null>(null);
  const start = useRef({ x: 0, y: 0 });
  useEffect(() => {
    dragRef.current = drag;
  }, [drag]);

  const onPointerDown = (e: React.PointerEvent, id: string) => {
    if (e.button !== 0 || (e.target as Element).closest("button, input")) return;
    start.current = { x: e.clientX, y: e.clientY };
    const d: TreeDrag = { id, started: false, target: null };
    dragRef.current = d;
    const move = (ev: PointerEvent) => {
      const current = dragRef.current;
      if (!current) return;
      if (!current.started && Math.hypot(ev.clientX - start.current.x, ev.clientY - start.current.y) < 4) return;
      const row = (document.elementFromPoint(ev.clientX, ev.clientY) as Element | null)?.closest<HTMLElement>("[data-tree-row]");
      let target: TreeDrag["target"] = null;
      if (row && row.dataset.treeRow && row.dataset.treeRow !== current.id) {
        const r = row.getBoundingClientRect();
        const t = (ev.clientY - r.top) / r.height;
        const frame = row.dataset.treeFrame === "";
        target = { id: row.dataset.treeRow, place: t < 0.3 ? "before" : t > 0.7 || !frame ? "after" : "inside" };
      }
      const next = { ...current, started: true, target };
      dragRef.current = next;
      setDrag(next);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      const current = dragRef.current;
      dragRef.current = null;
      setDrag(null);
      if (current?.started && current.target) onMoveInTree(current.id, current.target.id, current.target.place);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const q = filter?.trim().toLocaleLowerCase("tr");
  const matches = (node: SceneNode): boolean => !q || node.name.toLocaleLowerCase("tr").includes(q) || (isFrameLike(node) && node.children.some(matches));
  // The rows as shown, top to bottom — for ⇧-click's run.
  const visible: string[] = [];
  const rows = (list: SceneNode[], depth: number, insideSelected: boolean): ReactNode[] =>
    [...list].reverse().filter(matches).map((node) => {
      const frame = isFrameLike(node);
      const hasKids = frame && node.children.length > 0;
      const selected = selection.includes(node.id);
      const isOpen = hasKids && (q ? true : open.has(node.id));
      visible.push(node.id);
      return (
        <div key={node.id} className="relative">
          {/* The selected layer's block: the lighter tint under everything inside it, rounded as one. */}
          {selected && isOpen && <div aria-hidden className="absolute top-0 bottom-0 rounded-[5px] bg-[var(--f-bg-selected-secondary)]" style={CELL} />}
          <Row
            node={node}
            depth={depth}
            selected={selected}
            insideSelected={insideSelected && !selected}
            open={isOpen}
            hasKids={hasKids}
            onToggle={(all) => {
              if (!all) return onToggle(node.id);
              const ids: string[] = [];
              const walk = (n: SceneNode) => { if (isFrameLike(n) && n.children.length) { ids.push(n.id); n.children.forEach(walk); } };
              walk(node);
              onToggleMany(ids, !open.has(node.id));
            }}
            onRename={(name) => onRename(node.id, name)}
            onToggleHidden={() => onToggleHidden(node.id)}
            onToggleLocked={() => onToggleLocked(node.id)}
            target={drag?.target?.id === node.id ? drag.target.place : null}
            dragging={drag?.id === node.id && Boolean(drag.started)}
            onPointerDown={(e) => onPointerDown(e, node.id)}
            onContextMenu={(e) => onContextMenu(node.id, e)}
          />
          {frame && isOpen && <div className="relative">{rows(node.children, depth + 1, insideSelected || selected)}</div>}
        </div>
      );
    });
  const tree = rows(nodes, 0, false);

  return (
    <div
      className="flex flex-col"
      onPointerDownCapture={(e) => {
        const row = (e.target as Element).closest<HTMLElement>("[data-tree-row]");
        const id = row?.dataset.treeRow;
        if (!id || (e.target as Element).closest("button, input") || e.button !== 0) return;
        if (e.shiftKey && selection.length) {
          const from = visible.indexOf(selection[selection.length - 1]);
          const to = visible.indexOf(id);
          if (from >= 0 && to >= 0) return onSelectMany(visible.slice(Math.min(from, to), Math.max(from, to) + 1));
        }
        onSelect(id, e.metaKey || e.ctrlKey);
      }}
    >
      {tree}
      {nodes.length === 0 && <p className="px-4 py-4 text-[11px] text-center text-[var(--f-text-secondary)]">Kanvas boş — bir çerçeve çiz (F).</p>}
    </div>
  );
}
