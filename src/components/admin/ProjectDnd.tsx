"use client";

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import {
  DndContext,
  DragOverlay,
  MeasuringStrategy,
  closestCenter,
  useDndContext,
  useDraggable,
  useDroppable,
  type CollisionDetection,
  type DroppableContainer,
  type Modifier,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, horizontalListSortingStrategy, rectSortingStrategy, useSortable, verticalListSortingStrategy, type SortingStrategy } from "@dnd-kit/sortable";
import { CSS, getEventCoordinates, type Transform } from "@dnd-kit/utilities";
import { Block, BlockType, GridSettings, Group, PageItem, PageSection } from "@/types/project";
import { DragHandle, DragScrollFix, altDrag, useEditorSensors, type DragActivation } from "@/components/project/Sortable";
import { BLOCK_DEFS, BLOCK_LABELS, blockTone, cloneBlock, cloneGroup, cloneItem, makeBlock, uid } from "@/components/admin/blockCatalog";
import {
  findBlock,
  findGroup,
  findSection,
  gridColumns,
  gridFlow,
  gridRows,
  hasPlacedCells,
  layoutCells,
  mapGroup,
  mapSection,
  moveBlockToGroup,
  moveGroupToSection,
  placeBlock,
  placeBlockInSection,
  placeGroup,
  placedByHand,
  roomAt,
  swapCells,
} from "@/lib/projectLayout";

/**
 * Page-level drag & drop for both editors, on three levels:
 * - sections / dividers reorder among themselves;
 * - groups (Blok) reorder inside their section and can be dropped into any
 *   other section;
 * - components (Bileşen) reorder inside their group and can be dropped into
 *   any other group;
 * - on a grid of more than one column, a Blok or component can be dropped in
 *   any free cell (useCellDrop) — the others keep their cells; a component
 *   dropped in a free cell of a section gets a Blok of its own there. Once a
 *   grid is laid out by hand, dropping on another child swaps the two;
 * - a component from the catalog (Bileşenler, useNewBlockDrag) can be dropped
 *   before / after a component (the line shows where — useInsertion), in an
 *   empty Blok, in a free cell or in a section. It follows the pointer as a
 *   chip (DragOverlay), since the catalog panel clips its own content.
 * - with Alt (⌥) held at the drop, as in Figma, a copy stays where the dragged
 *   element was (leaveCopy) — on the page and in the layer tree.
 *
 * The layer tree (variant "tree") drags like Figma's: the dragged row stays
 * where it is (the tree doesn't apply the transform), nothing makes room, a
 * line shows where the row would land (useTreeDrop) — before / after a row of
 * its level, or at the start of a Blok / section — and the move happens on drop.
 * Cards and list items have their own nested groups (see Sortable.tsx).
 * There is no drag preview: the item itself moves (see DRAG_LIFT).
 *
 * Sections are too tall to drag around, so while a section or divider is being
 * dragged the whole page turns into a compact list (usePageReorder / ReorderRow)
 * and expands again on drop. The list is scrolled so the grabbed row's slot sits
 * right under the pointer (ReorderAligner), and the row is centred on the
 * pointer — otherwise a drop without moving could land somewhere else.
 */

type ItemData = { type: "item"; itemId: string; kind: PageItem["kind"] };
type GroupData = { type: "group"; groupId: string; sectionId: string };
type BlockData = { type: "block"; blockId: string; groupId: string };
/** A free cell of a section's grid (for Bloks and components) or a Blok's (for components). */
type CellData = { type: "cell"; level: "section" | "group"; containerId: string; row: number; col: number };
/** A component from the catalog, not on the page yet — `blockId` is the id it gets there. */
type NewData = { type: "new"; blockType: BlockType; blockId: string };
type DndData = ItemData | GroupData | BlockData | CellData | NewData;

/** Where a catalog component would go: before or after a component (side by side on a grid of more than one column). */
export type Insertion = { blockId: string; before: boolean; horizontal: boolean; blockType: BlockType };

/** Where a row of the layer tree would land: before / after another row of its level, or at the start of a Blok / section. */
export type TreeDrop = { id: string; place: "before" | "after" | "inside" };

/** `item` placed next to `targetId` (before / after), or first when there is no target. */
function spliceNear<T extends { id: string }>(children: T[], item: T, targetId: string | null, after: boolean): T[] {
  const rest = children.filter((c) => c.id !== item.id);
  const at = targetId ? rest.findIndex((c) => c.id === targetId) : -1;
  rest.splice(at < 0 ? 0 : at + (after ? 1 : 0), 0, item);
  return rest;
}

/**
 * A Blok moved next to another (or to the start of `sectionId`). Within a
 * section laid out by hand the two swap cells; into another section it takes
 * the next free cell there.
 */
function moveGroupInTree(list: PageItem[], groupId: string, sectionId: string, targetId: string | null, after: boolean): PageItem[] {
  const from = findGroup(list, groupId);
  if (!from) return list;
  const same = from.section.id === sectionId;
  if (same && targetId && placedByHand(from.section.grid, from.section.groups)) {
    return mapSection(list, sectionId, (s) => ({ ...s, groups: swapCells(s.groups, groupId, targetId, gridColumns(s.grid).length, gridRows(s.grid)) }));
  }
  const group = same ? from.group : { ...from.group, row: undefined, col: undefined };
  const removed = same ? list : mapSection(list, from.section.id, (s) => ({ ...s, groups: s.groups.filter((g) => g.id !== groupId) }));
  return mapSection(removed, sectionId, (s) => ({ ...s, groups: spliceNear(s.groups, group, targetId, after) }));
}

/** The same for a component: next to another, or to the start of `groupId`. */
function moveBlockInTree(list: PageItem[], blockId: string, groupId: string, targetId: string | null, after: boolean): PageItem[] {
  const from = findBlock(list, blockId);
  if (!from) return list;
  const same = from.group.id === groupId;
  if (same && targetId && placedByHand(from.group.grid, from.group.blocks)) {
    return mapGroup(list, groupId, (g) => ({ ...g, blocks: swapCells(g.blocks, blockId, targetId, gridColumns(g.grid).length, gridRows(g.grid)) }));
  }
  const block = same ? from.block : { ...from.block, row: undefined, col: undefined };
  const removed = same ? list : mapGroup(list, from.group.id, (g) => ({ ...g, blocks: g.blocks.filter((b) => b.id !== blockId) }));
  return mapGroup(removed, groupId, (g) => ({ ...g, blocks: spliceNear(g.blocks, block, targetId, after) }));
}

/**
 * The one place a tree drop stands for. A drop lands in a gap between two
 * siblings, and each gap has several names — "after 1" is "before 2", "inside
 * a Blok" is "before its first component". Always the same name for the same
 * gap, so the line doesn't flicker between the two as the pointer crosses the
 * boundary: "before" the sibling after the gap, "after" the last one, "inside"
 * only an empty container. The gaps on either side of the dragged row itself
 * move nothing — no line there.
 */
function canonicalDrop(items: PageItem[], d: DndData, drop: TreeDrop | null): TreeDrop | null {
  if (!drop) return null;
  const selfId = d.type === "item" ? d.itemId : d.type === "group" ? d.groupId : d.type === "block" ? d.blockId : null;
  let siblings: { id: string }[] | undefined;
  let slot: number;
  if (drop.place === "inside") {
    siblings = d.type === "group" ? findSection(items, drop.id)?.groups : d.type === "block" ? findGroup(items, drop.id)?.group.blocks : undefined;
    if (!siblings?.length) return drop;
    slot = 0;
  } else {
    siblings = d.type === "item" ? items : d.type === "group" ? findGroup(items, drop.id)?.section.groups : d.type === "block" ? findBlock(items, drop.id)?.group.blocks : undefined;
    if (!siblings) return drop;
    slot = siblings.findIndex((c) => c.id === drop.id) + (drop.place === "after" ? 1 : 0);
  }
  const self = siblings.findIndex((c) => c.id === selfId);
  if (self >= 0 && (slot === self || slot === self + 1)) return null;
  return slot < siblings.length ? { id: siblings[slot].id, place: "before" } : { id: siblings[siblings.length - 1].id, place: "after" };
}

/** A row of the layer tree dropped where its line was. */
function dropInTree(list: PageItem[], d: DndData, drop: TreeDrop): PageItem[] {
  const after = drop.place === "after";
  if (d.type === "item") {
    const item = list.find((i) => i.id === d.itemId);
    return item && drop.place !== "inside" ? spliceNear(list, item, drop.id, after) : list;
  }
  if (d.type === "group") {
    if (drop.place === "inside") return moveGroupInTree(list, d.groupId, drop.id, null, false);
    const to = findGroup(list, drop.id);
    return to ? moveGroupInTree(list, d.groupId, to.section.id, drop.id, after) : list;
  }
  if (d.type === "block") {
    if (drop.place === "inside") return moveBlockInTree(list, d.blockId, drop.id, null, false);
    const to = findBlock(list, drop.id);
    return to ? moveBlockInTree(list, d.blockId, to.group.id, drop.id, after) : list;
  }
  return list;
}

/**
 * Puts `copy` back where the original was among `before` (its siblings when
 * the drag started) in `children` (them now): before the next of them still
 * there — on a grid laid out by hand, in the original's cell, unless something
 * has taken it since (then in the next free one).
 */
function putBack<T extends { id: string; span?: number; row?: number; col?: number; absolute?: unknown }>(
  children: T[], before: T[], index: number, copy: T, grid?: GridSettings
): T[] {
  const next = before.slice(index + 1).find((s) => children.some((c) => c.id === s.id));
  const at = next ? children.findIndex((c) => c.id === next.id) : children.length;
  let placed = copy;
  if (grid && gridFlow(grid) === "grid" && !copy.absolute && (hasPlacedCells(children) || hasPlacedCells([copy]))) {
    const count = gridColumns(grid).length;
    const rows = gridRows(grid);
    const cell = layoutCells(before, count, rows)[index];
    const room = roomAt(layoutCells(children, count, rows), -1, cell.row, cell.col, count);
    placed = room > 0 ? { ...copy, row: cell.row, col: cell.col, span: Math.min(cell.span, room) } : { ...copy, row: undefined, col: undefined };
  }
  return [...children.slice(0, at), placed, ...children.slice(at)];
}

/**
 * An Alt-drag leaves a copy behind, as in Figma: the dragged element — still
 * selected — is where it was dropped (`moved`), a copy of it with fresh ids
 * where it was (`start`). A component dropped alone in a section's free cell
 * takes its Blok along: then a copy of the Blok stays.
 */
function leaveCopy(start: PageItem[], moved: PageItem[], d: DndData): PageItem[] {
  if (d.type === "item") {
    const index = start.findIndex((i) => i.id === d.itemId);
    return index < 0 ? moved : putBack(moved, start, index, cloneItem(start[index]));
  }
  if (d.type === "group") {
    const from = findGroup(start, d.groupId);
    if (!from) return moved;
    return mapSection(moved, from.section.id, (s) => ({ ...s, groups: putBack(s.groups, from.section.groups, from.index, cloneGroup(from.group), s.grid) }));
  }
  if (d.type === "block") {
    const from = findBlock(start, d.blockId);
    if (!from) return moved;
    const now = findGroup(moved, from.group.id);
    const stayed = now && now.section.id === from.section.id && now.group.row === from.group.row && now.group.col === from.group.col;
    if (stayed) {
      return mapGroup(moved, from.group.id, (g) => ({ ...g, blocks: putBack(g.blocks, from.group.blocks, from.index, cloneBlock(from.block), g.grid) }));
    }
    const groupIndex = from.section.groups.findIndex((g) => g.id === from.group.id);
    return mapSection(moved, from.section.id, (s) => ({ ...s, groups: putBack(s.groups, from.section.groups, groupIndex, cloneGroup(from.group), s.grid) }));
  }
  return moved;
}

const itemDndId = (id: string) => `item:${id}`;
const groupDndId = (id: string) => `group:${id}`;
const blockDndId = (id: string) => `block:${id}`;
const cellDndId = (d: Omit<CellData, "type">) => `cell:${d.level}:${d.containerId}:${d.row}:${d.col}`;

function dataOf(container: { data: { current?: unknown } }): DndData | undefined {
  return container.data.current as DndData | undefined;
}

type Rect = { left: number; top: number; width: number; height: number };
type Point = { x: number; y: number };

const contains = (r: Rect | undefined, p: Point) => Boolean(r && p.x >= r.left && p.x <= r.left + r.width && p.y >= r.top && p.y <= r.top + r.height);
/** Distance from a point to a rectangle (0 inside it). */
const distance = (r: Rect | undefined, p: Point) =>
  r ? Math.hypot(Math.max(r.left - p.x, 0, p.x - (r.left + r.width)), Math.max(r.top - p.y, 0, p.y - (r.top + r.height))) : Infinity;

/**
 * Each level is matched against its own kind inside the container under the
 * pointer — a group's components, a section's groups — so a gap between two
 * children never resolves to the container itself; an empty container takes
 * the drop. Between two containers (a gap, the section's padding) the nearest
 * one in the section takes it.
 */
const collisionDetection: CollisionDetection = (args) => {
  const pick = (pred: (d: DndData | undefined) => boolean): DroppableContainer[] =>
    args.droppableContainers.filter((c) => pred(dataOf(c)));
  const active = dataOf(args.active);
  const rectOf = (c: DroppableContainer) => args.droppableRects.get(c.id);
  const pointer = args.pointerCoordinates;
  // The dragged element's centre — a component grabbed by its toolbar starts with the pointer above it.
  const center = args.collisionRect && {
    x: args.collisionRect.left + args.collisionRect.width / 2,
    y: args.collisionRect.top + args.collisionRect.height / 2,
  };
  const sections = pick((d) => d?.type === "item" && d.kind === "section");
  const sectionAt = (p: Point | null | undefined) => (p ? sections.find((c) => contains(rectOf(c), p)) : undefined);
  const sectionId = (c: DroppableContainer | undefined) => {
    const d = c && dataOf(c);
    return d?.type === "item" ? d.itemId : undefined;
  };
  /** The children of one container, else the container itself (empty), else nothing. */
  const within = (container: DroppableContainer, children: DroppableContainer[]) =>
    children.length ? closestCenter({ ...args, droppableContainers: children }) : [{ id: container.id }];

  if (active?.type === "item") {
    // The row under the pointer, else the nearest — sections can be tall (the layer tree shows them open).
    const items = pick((d) => d?.type === "item");
    const under = pointer && items.find((c) => c.id !== args.active.id && contains(rectOf(c), pointer));
    return under ? [{ id: under.id }] : closestCenter({ ...args, droppableContainers: items });
  }

  const component = active?.type === "block" || active?.type === "new";

  // A free cell under the pointer takes the drop — a Blok only goes in a section's cells.
  if (pointer) {
    const cell = pick((d) => d?.type === "cell" && (component || d.level === "section")).find((c) => contains(rectOf(c), pointer));
    if (cell) return [{ id: cell.id }];
  }

  const groups = pick((d) => d?.type === "group");

  if (active?.type === "group") {
    const section = sectionAt(pointer) ?? sectionAt(center);
    if (section) {
      const id = sectionId(section);
      return within(section, groups.filter((c) => { const d = dataOf(c); return d?.type === "group" && d.sectionId === id; }));
    }
    return closestCenter({ ...args, droppableContainers: groups });
  }

  const blocks = pick((d) => d?.type === "block");
  const point = pointer ?? center;
  let group = (pointer && groups.find((c) => contains(rectOf(c), pointer))) || (center && groups.find((c) => contains(rectOf(c), center)));
  if (!group && point) {
    // In a gap or the section's padding: the section's nearest group.
    const id = sectionId(sectionAt(point));
    group = groups
      .filter((c) => { const d = dataOf(c); return d?.type === "group" && d.sectionId === id; })
      .sort((a, b) => distance(rectOf(a), point) - distance(rectOf(b), point))[0];
  }
  const g = group && dataOf(group);
  if (group && g?.type === "group") {
    return within(group, blocks.filter((c) => { const d = dataOf(c); return d?.type === "block" && d.groupId === g.groupId; }));
  }
  if (active?.type === "new") {
    // A section without Bloks takes it (it gets one); anywhere else is no drop.
    const section = sectionAt(pointer);
    return section ? [{ id: section.id }] : [];
  }
  return closestCenter({ ...args, droppableContainers: blocks });
};

const PageReorderContext = createContext(false);
const InsertionContext = createContext<Insertion | null>(null);
const TreeContext = createContext(false);
const TreeDropContext = createContext<TreeDrop | null>(null);

/** In the layer tree: where the dragged row would land, if next to / inside the row `id`. */
export function useTreeDrop(id: string): TreeDrop["place"] | null {
  const drop = useContext(TreeDropContext);
  return drop?.id === id ? drop.place : null;
}

/** While a catalog component is dragged over a component: which one, and on which side it would go. */
export function useInsertion() {
  return useContext(InsertionContext);
}

/** A catalog component dropped on the page: where it goes. */
function dropNewBlock(list: PageItem[], block: Block, o: DndData, insertion: Insertion | null): PageItem[] {
  if (o.type === "cell" && o.level === "group") {
    return placeBlock(mapGroup(list, o.containerId, (g) => ({ ...g, blocks: [...g.blocks, block] })), block.id, o.containerId, o.row, o.col);
  }
  if (o.type === "cell") {
    const groupId = uid();
    return placeGroup(mapSection(list, o.containerId, (s) => ({ ...s, groups: [...s.groups, { id: groupId, blocks: [block] }] })), groupId, o.containerId, o.row, o.col);
  }
  if (o.type === "block") {
    const at = findBlock(list, o.blockId);
    if (!at) return list;
    const index = at.index + (insertion?.blockId === o.blockId && insertion.before ? 0 : 1);
    return mapGroup(list, at.group.id, (g) => ({ ...g, blocks: [...g.blocks.slice(0, index), block, ...g.blocks.slice(index)] }));
  }
  if (o.type === "group") return mapGroup(list, o.groupId, (g) => ({ ...g, blocks: [...g.blocks, block] }));
  if (o.type === "item" && o.kind === "section") {
    return mapSection(list, o.itemId, (s) => {
      const last = s.groups[s.groups.length - 1];
      return last
        ? { ...s, groups: s.groups.map((g) => (g === last ? { ...g, blocks: [...g.blocks, block] } : g)) }
        : { ...s, groups: [{ id: uid(), blocks: [block] }] };
    });
  }
  return list;
}

/**
 * What dropping a section / divider, Blok or component `d` on the page (on
 * `o`) does to the list — none when it lands nowhere.
 */
function dropOnPage(d: DndData | undefined, o: DndData | undefined): ((list: PageItem[]) => PageItem[]) | null {
  if (!d || !o) return null;
  if (o.type === "cell") {
    const { level, containerId, row, col } = o;
    if (d.type === "block") {
      return (list) => (level === "group" ? placeBlock(list, d.blockId, containerId, row, col) : placeBlockInSection(list, d.blockId, containerId, row, col, uid()));
    }
    if (d.type === "group" && level === "section") return (list) => placeGroup(list, d.groupId, containerId, row, col);
    return null;
  }
  if (d.type === "item" && o.type === "item") {
    return (list) => {
      const from = list.findIndex((i) => i.id === d.itemId);
      const to = list.findIndex((i) => i.id === o.itemId);
      return from < 0 || to < 0 ? list : arrayMove(list, from, to);
    };
  }
  if (d.type === "group" && o.type === "group") {
    return (list) => {
      const from = findGroup(list, d.groupId);
      const to = findGroup(list, o.groupId);
      if (!from || !to || from.section.id !== to.section.id) return list;
      return mapSection(list, from.section.id, (s) => ({
        ...s,
        // Laid out by hand: the two swap cells; otherwise the order changes.
        groups: placedByHand(s.grid, s.groups) ? swapCells(s.groups, d.groupId, o.groupId, gridColumns(s.grid).length, gridRows(s.grid)) : arrayMove(s.groups, from.index, to.index),
      }));
    };
  }
  if (d.type === "block" && o.type === "block") {
    return (list) => {
      const from = findBlock(list, d.blockId);
      const to = findBlock(list, o.blockId);
      if (!from || !to || from.group.id !== to.group.id || from.index === to.index) return list;
      return mapGroup(list, from.group.id, (g) => ({
        ...g,
        blocks: placedByHand(g.grid, g.blocks) ? swapCells(g.blocks, d.blockId, o.blockId, gridColumns(g.grid).length, gridRows(g.grid)) : arrayMove(g.blocks, from.index, to.index),
      }));
    };
  }
  return null;
}

/** The chip that follows the pointer while a catalog component is dragged. */
function NewBlockChip({ type }: { type: BlockType }) {
  const def = BLOCK_DEFS.find((d) => d.type === type);
  return (
    <span
      className="inline-flex items-center gap-2 h-9 pl-2 pr-3 rounded-full border border-[var(--border)] bg-[var(--bg-1)] text-[13px] font-medium text-[var(--text-title)] shadow-[0_18px_40px_rgba(0,0,0,0.18)] cursor-grabbing whitespace-nowrap"
      style={{ color: blockTone(type) }}
    >
      {def?.icon}
      <span className="text-[var(--text-title)]">{BLOCK_LABELS[type]}</span>
    </span>
  );
}

/** True while a section or divider is dragged — the editors show a compact list then. */
export function usePageReorder() {
  return useContext(PageReorderContext);
}

/** Where (viewport top, px) the dragged row was released — see useKeepDropPosition. */
const DropTopContext = createContext<{ current: number | null }>({ current: null });

/** Top of an element as laid out, ignoring its drag transform / translate nudge. */
function layoutTop(el: HTMLElement) {
  const style = getComputedStyle(el);
  const transformY = style.transform && style.transform !== "none" ? new DOMMatrixReadOnly(style.transform).m42 : 0;
  const translateY = parseFloat(style.translate.split(" ")[1] ?? "0") || 0;
  return el.getBoundingClientRect().top - transformY - translateY;
}

/**
 * The page expands again on drop. Keep the dropped section or divider where it
 * was released: scroll so that its top lands where the dragged row was let go,
 * and let the page fill in around it. Returns a ref for the element.
 */
export function useKeepDropPosition(isDragging: boolean) {
  const reordering = usePageReorder();
  const dropTop = useContext(DropTopContext);
  const node = useRef<HTMLElement | null>(null);
  const dragged = useRef(false);
  useEffect(() => {
    if (isDragging) dragged.current = true;
  }, [isDragging]);
  useLayoutEffect(() => {
    if (reordering || !dragged.current) return;
    dragged.current = false;
    const el = node.current;
    const top = dropTop.current;
    const scroller = el && scrollParent(el);
    if (!el || top == null || !scroller) return;
    scroller.scrollTop += layoutTop(el) - top;
  }, [reordering, dropTop]);
  return useCallback((el: HTMLElement | null) => { node.current = el; }, []);
}

/** Sections and dividers form one column: they only move up and down (groups and components also go sideways). */
const verticalOnly: Modifier = ({ transform, active }) => (active && dataOf(active)?.type === "item" ? { ...transform, x: 0 } : transform);

/** Tallest compact row (ReorderRow); before the page has collapsed the node is still the full section. */
const REORDER_ROW_MAX = 40;

/** While reordering, the dragged row is centred on the pointer rather than kept at the section's offset. */
const centerRowOnPointer: Modifier = ({ transform, active, activatorEvent, draggingNodeRect }) => {
  if (!active || dataOf(active)?.type !== "item" || !activatorEvent || !draggingNodeRect) return transform;
  const initial = active.rect.current.initial;
  const pointer = getEventCoordinates(activatorEvent);
  if (!initial || !pointer) return transform;
  const height = Math.min(draggingNodeRect.height, REORDER_ROW_MAX);
  return { ...transform, y: transform.y + (pointer.y - initial.top) - height / 2 };
};

function scrollParent(el: HTMLElement): HTMLElement | null {
  for (let p = el.parentElement; p; p = p.parentElement) {
    if (/(auto|scroll)/.test(getComputedStyle(p).overflowY)) return p;
  }
  return null;
}

/**
 * Right after the page collapses, scrolls the compact list so the dragged row's
 * slot is centred where the pointer is (the editors pad the list while
 * reordering, so there is always room to scroll).
 */
function ReorderAligner({ reordering }: { reordering: boolean }) {
  const { activeNode, activatorEvent } = useDndContext();
  useLayoutEffect(() => {
    if (!reordering || !activeNode || !activatorEvent) return;
    const pointer = getEventCoordinates(activatorEvent);
    const scroller = scrollParent(activeNode);
    if (!pointer || !scroller) return;
    const rect = activeNode.getBoundingClientRect();
    const transform = getComputedStyle(activeNode).transform;
    const shiftY = transform && transform !== "none" ? new DOMMatrixReadOnly(transform).m42 : 0;
    const slotCenter = rect.top - shiftY + Math.min(rect.height, REORDER_ROW_MAX) / 2;
    scroller.scrollTop += slotCenter - pointer.y;
    // Only when the page collapses — not on every re-render during the drag.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reordering]);
  return null;
}

export function ProjectDndProvider({ items, onItemsChange, activation, variant = "page", children }: {
  items: PageItem[];
  /** Functional update — always applied to the latest items */
  onItemsChange: (update: (items: PageItem[]) => PageItem[]) => void;
  /** How drags start (default: from DragActivationContext, else "hold") */
  activation?: DragActivation;
  /**
   * "page": dragging a section or divider turns the page into the compact
   * list (usePageReorder), children make room as things move over them.
   * "tree" (the layer tree): no compact list, nothing moves — a line shows
   * where the row lands (useTreeDrop).
   */
  variant?: "page" | "tree";
  children: ReactNode;
}) {
  const sensors = useEditorSensors(activation);
  const [reordering, setReordering] = useState(false);
  // Groups and components move between containers while dragging (onDragOver): a cancel restores this.
  const itemsAtStart = useRef<PageItem[] | null>(null);
  const dropTop = useRef<number | null>(null);
  // A catalog component being dragged, and where it would go.
  const [newType, setNewType] = useState<BlockType | null>(null);
  const [insertion, setInsertion] = useState<Insertion | null>(null);
  const tree = variant === "tree";
  const [treeDrop, setTreeDrop] = useState<TreeDrop | null>(null);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      modifiers={tree ? [verticalOnly] : [verticalOnly, centerRowOnPointer]}
      // The layout changes as the page collapses: keep measuring drop targets.
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      // ReorderAligner does this for the collapse (dnd-kit's own would undo it).
      autoScroll={{ layoutShiftCompensation: false }}
      // Set in the same update as the drag start, so the collapse is part of it.
      onDragStart={({ active: a }) => {
        altDrag.begin();
        itemsAtStart.current = items;
        const d = dataOf(a);
        setReordering(!tree && d?.type === "item");
        setNewType(d?.type === "new" ? d.blockType : null);
      }}
      onDragMove={({ active: a, over, activatorEvent, delta }) => {
        const d = dataOf(a);
        if (tree) {
          // Between two rows (the 1px gap) nothing is under the pointer: keep the line where it was.
          if (!over) return;
          const o = dataOf(over);
          const start = activatorEvent && getEventCoordinates(activatorEvent);
          let next: TreeDrop | null = null;
          if (d && o && start && over.id !== a.id) {
            const y = start.y + delta.y;
            const side = y < over.rect.top + over.rect.height / 2 ? "before" : "after";
            if (d.type === "item" && o.type === "item") next = { id: o.itemId, place: side };
            else if (d.type === "group" && o.type === "group") next = { id: o.groupId, place: side };
            else if (d.type === "block" && o.type === "block") next = { id: o.blockId, place: side };
            else if (d.type === "group" && o.type === "item" && o.kind === "section") next = { id: o.itemId, place: "inside" };
            else if (d.type === "block" && o.type === "group") next = { id: o.groupId, place: "inside" };
          }
          if (d) next = canonicalDrop(items, d, next);
          setTreeDrop((prev) => (prev?.id === next?.id && prev?.place === next?.place ? prev : next));
          return;
        }
        if (d?.type !== "new") return;
        const o = over ? dataOf(over) : undefined;
        const start = activatorEvent && getEventCoordinates(activatorEvent);
        const at = o?.type === "block" ? findBlock(items, o.blockId) : null;
        // A grid laid out by hand fills its first free cell: no before / after there.
        if (!over || !start || o?.type !== "block" || !at || placedByHand(at.group.grid, at.group.blocks)) {
          setInsertion(null);
          return;
        }
        const point = { x: start.x + delta.x, y: start.y + delta.y };
        const flow = gridFlow(at.group.grid);
        const horizontal = flow === "horizontal" || (flow === "grid" && gridColumns(at.group.grid).length > 1);
        const before = horizontal ? point.x < over.rect.left + over.rect.width / 2 : point.y < over.rect.top + over.rect.height / 2;
        setInsertion((prev) => (prev?.blockId === o.blockId && prev.before === before ? prev : { blockId: o.blockId, before, horizontal, blockType: d.blockType }));
      }}
      onDragCancel={({ active: a }) => {
        altDrag.end();
        dropTop.current = a.rect.current.translated?.top ?? null;
        setTreeDrop(null);
        setNewType(null);
        setInsertion(null);
        setReordering(false);
        const start = itemsAtStart.current;
        itemsAtStart.current = null;
        if (start) onItemsChange(() => start);
      }}
      onDragOver={({ active: a, over }) => {
        // The tree moves nothing until the drop.
        if (tree) return;
        const d = dataOf(a);
        const o = over ? dataOf(over) : undefined;
        if (!d || !o) return;
        if (d.type === "block") {
          // Into another group: before the component under it, or at the end of an empty group.
          const toGroupId = o.type === "block" ? o.groupId : o.type === "group" ? o.groupId : null;
          if (toGroupId) onItemsChange((list) => moveBlockToGroup(list, d.blockId, toGroupId, o.type === "block" ? o.blockId : null));
        } else if (d.type === "group") {
          const toSectionId = o.type === "group" ? o.sectionId : o.type === "item" && o.kind === "section" ? o.itemId : null;
          if (toSectionId) onItemsChange((list) => moveGroupToSection(list, d.groupId, toSectionId, o.type === "group" ? o.groupId : null));
        }
      }}
      onDragEnd={({ active: a, over }) => {
        dropTop.current = a.rect.current.translated?.top ?? null;
        setReordering(false);
        const start = itemsAtStart.current;
        itemsAtStart.current = null;
        const copy = altDrag.end();
        const d = dataOf(a);
        const o = over ? dataOf(over) : undefined;
        const lastInsertion = insertion;
        const lastTreeDrop = treeDrop;
        setNewType(null);
        setInsertion(null);
        setTreeDrop(null);
        if (d?.type === "new") {
          if (!o) return;
          const block = makeBlock(d.blockType, { id: d.blockId });
          onItemsChange((list) => dropNewBlock(list, block, o, lastInsertion));
          return;
        }
        const drop = tree
          ? d && lastTreeDrop ? (list: PageItem[]) => dropInTree(list, d, lastTreeDrop) : null
          : a.id === over?.id ? null : dropOnPage(d, o);
        // With Alt held the dragged element still goes where it was dropped, and a copy stays where it was.
        if (copy && d && start) onItemsChange((list) => leaveCopy(start, drop ? drop(list) : list, d));
        else if (drop) onItemsChange(drop);
      }}
    >
      <ReorderAligner reordering={reordering} />
      {/* The tree's dragged row stays where it is: nothing to keep under the pointer. */}
      {!tree && <DragScrollFix />}
      <DropTopContext.Provider value={dropTop}>
        <PageReorderContext.Provider value={reordering}>
          <InsertionContext.Provider value={insertion}>
            <TreeContext.Provider value={tree}>
              <TreeDropContext.Provider value={treeDrop}>
                <SortableContext items={items.map((i) => itemDndId(i.id))} strategy={tree ? stayPut : verticalListSortingStrategy}>
                  {children}
                </SortableContext>
              </TreeDropContext.Provider>
            </TreeContext.Provider>
          </InsertionContext.Provider>
        </PageReorderContext.Provider>
      </DropTopContext.Provider>
      <DragOverlay dropAnimation={null}>{newType ? <NewBlockChip type={newType} /> : null}</DragOverlay>
    </DndContext>
  );
}

/** No room is made while dragging: on a grid laid out by hand children swap cells on drop. */
const stayPut: SortingStrategy = () => null;

/**
 * Stacked / side by side, children move along the flow; laid out in more
 * than one column they move in two dimensions; on a grid laid out by hand
 * they stay put.
 */
function strategyFor(grid: GridSettings | undefined, children: { row?: number; col?: number }[]): SortingStrategy {
  const flow = gridFlow(grid);
  if (flow === "vertical") return verticalListSortingStrategy;
  if (flow === "horizontal") return horizontalListSortingStrategy;
  return hasPlacedCells(children) ? stayPut : gridColumns(grid).length > 1 ? rectSortingStrategy : verticalListSortingStrategy;
}

/** The groups (Blok) of one section as a sortable list. */
export function SectionGroups({ section, children }: { section: PageSection; children: ReactNode }) {
  const tree = useContext(TreeContext);
  return (
    <SortableContext items={section.groups.map((g) => groupDndId(g.id))} strategy={tree ? stayPut : strategyFor(section.grid, section.groups)}>
      {children}
    </SortableContext>
  );
}

/** The components (Bileşen) of one group as a sortable list. */
export function GroupBlocks({ group, children }: { group: Group; children: ReactNode }) {
  const tree = useContext(TreeContext);
  return (
    <SortableContext items={group.blocks.map((b) => blockDndId(b.id))} strategy={tree ? stayPut : strategyFor(group.grid, group.blocks)}>
      {children}
    </SortableContext>
  );
}

export function useSortablePageItem(item: PageItem) {
  return useSortable({ id: itemDndId(item.id), data: { type: "item", itemId: item.id, kind: item.kind } satisfies ItemData });
}

/** A group, sortable within its section — and the drop target for components while empty. */
export function useSortableGroup(group: Group, sectionId: string) {
  return useSortable({ id: groupDndId(group.id), data: { type: "group", groupId: group.id, sectionId } satisfies GroupData });
}

/** A component, sortable within its group. */
export function useSortableBlock(block: Block, groupId: string) {
  return useSortable({ id: blockDndId(block.id), data: { type: "block", blockId: block.id, groupId } satisfies BlockData });
}

/** A catalog component (Bileşenler) as something to drag onto the page; `blockId` is the id it will get. */
export function useNewBlockDrag(blockType: BlockType, blockId: string) {
  return useDraggable({ id: `new:${blockType}`, data: { type: "new", blockType, blockId } satisfies NewData });
}

/** A free cell of a section's or Blok's grid as a drop target (see the collision detection). */
export function useCellDrop(cell: Omit<CellData, "type">) {
  return useDroppable({ id: cellDndId(cell), data: { type: "cell", ...cell } satisfies CellData });
}

/**
 * The drag going on: what is dragged — a section / divider ("item"), a Blok
 * ("group") or a component ("block") — and the Blok and section it is over.
 */
export function useActiveDrag(): { kind: "item" | "group" | "block" | "new"; overGroupId?: string; overSectionId?: string } | null {
  const { active, over } = useDndContext();
  const a = active ? dataOf(active) : undefined;
  if (!a || a.type === "cell") return null;
  const o = over ? dataOf(over) : undefined;
  return {
    kind: a.type,
    overGroupId: o?.type === "block" || o?.type === "group" ? o.groupId : o?.type === "cell" && o.level === "group" ? o.containerId : undefined,
    overSectionId: o?.type === "group" ? o.sectionId : o?.type === "item" ? o.itemId : o?.type === "cell" && o.level === "section" ? o.containerId : undefined,
  };
}

export function sortableStyle(transform: Transform | null, transition: string | undefined) {
  return { transform: CSS.Translate.toString(transform), transition };
}

// ── Compact page (while a section / divider is dragged) ──────────────────────

/** The box around the compact list of sections and dividers. */
export const REORDER_LIST =
  "flex flex-col gap-2 w-full p-[14px] rounded-[24px] outline-dashed outline-1 -outline-offset-1 outline-[var(--edit-accent)]";
/**
 * Scroll room above and below the compact list, so its dragged row can always
 * be brought under the pointer (see ReorderAligner).
 */
export const REORDER_ROOM = "py-[100vh]";

const ReorderIcon = {
  plus: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M7 2.5v9M2.5 7h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  trash: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M2 3.5h10M5.5 3.5V2h3v1.5M4 3.5l.5 8h5l.5-8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};

/**
 * One section or divider in the compact list: a grey row (a thin rule for a
 * divider), or — for the one being dragged — the blue section label.
 */
export function ReorderRow({ label, detail, divider = false, dragging, activatorRef }: {
  label: string;
  /** Secondary text, e.g. the section's heading */
  detail?: string;
  divider?: boolean;
  dragging: boolean;
  activatorRef?: (el: HTMLElement | null) => void;
}) {
  if (dragging) {
    return (
      <span className="flex w-fit items-center gap-0.5 h-9 p-1 pr-2 rounded-full bg-[var(--edit-accent)] text-white shadow-[0_18px_40px_rgba(0,0,0,0.18)] cursor-grabbing select-none">
        <DragHandle activatorRef={activatorRef} label={`${label} sürükleniyor`} className="w-7 h-7 rounded-full text-white" />
        <span className="px-2 text-[13px] font-medium leading-5 whitespace-nowrap">{label}</span>
        {!divider && <span className="flex items-center justify-center w-7 h-7">{ReorderIcon.plus}</span>}
        <span className="flex items-center justify-center w-7 h-7">{ReorderIcon.trash}</span>
      </span>
    );
  }
  if (divider) {
    return (
      <div className="flex items-center gap-3 w-full h-6 px-4 select-none">
        <div className="flex-1 h-px bg-[var(--border-hover)]" />
        <span className="text-[12px] text-[var(--text-subtitle)]">{label}</span>
        <div className="flex-1 h-px bg-[var(--border-hover)]" />
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 w-full h-9 px-4 rounded-full bg-[var(--bg-4)] text-[14px] leading-5 select-none cursor-grab">
      <span className="shrink-0 font-medium text-[var(--text-title)]">{label}</span>
      {detail && <span className="min-w-0 truncate text-[var(--text-subtitle)]">{detail}</span>}
    </div>
  );
}
