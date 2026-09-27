"use client";

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import {
  DndContext,
  MeasuringStrategy,
  closestCenter,
  pointerWithin,
  useDndContext,
  type CollisionDetection,
  type DroppableContainer,
  type Modifier,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS, getEventCoordinates, type Transform } from "@dnd-kit/utilities";
import { Block, PageItem, PageSection } from "@/types/project";
import { DragHandle, DragScrollFix, useEditorSensors, type DragActivation } from "@/components/project/Sortable";

/**
 * Page-level drag & drop for both editors: sections / dividers reorder among
 * themselves, blocks reorder inside a section and can be dropped into another
 * section. Cards and list items have their own nested groups (see Sortable.tsx).
 * There is no drag preview: the item itself moves (see DRAG_LIFT).
 *
 * Sections are too tall to drag around, so while a section or divider is being
 * dragged the whole page turns into a compact list (usePageReorder / ReorderRow)
 * and expands again on drop. The list is scrolled so the grabbed row's slot sits
 * right under the pointer (ReorderAligner), and the row is centred on the
 * pointer — otherwise a drop without moving could land somewhere else.
 */

type ItemData = { type: "item"; itemId: string; kind: PageItem["kind"] };
type BlockData = { type: "block"; blockId: string; sectionId: string };
type DndData = ItemData | BlockData;

const itemDndId = (id: string) => `item:${id}`;
const blockDndId = (id: string) => `block:${id}`;

function dataOf(container: { data: { current?: unknown } }): DndData | undefined {
  return container.data.current as DndData | undefined;
}

function sectionOfBlock(items: PageItem[], blockId: string): PageSection | undefined {
  return items.find((i): i is PageSection => i.kind === "section" && i.blocks.some((b) => b.id === blockId));
}

function moveBlockToSection(items: PageItem[], blockId: string, toSectionId: string, beforeBlockId: string | null): PageItem[] {
  const from = sectionOfBlock(items, blockId);
  if (!from || from.id === toSectionId) return items;
  const block = from.blocks.find((b) => b.id === blockId)!;
  return items.map((it) => {
    if (it.kind !== "section") return it;
    if (it.id === from.id) return { ...it, blocks: it.blocks.filter((b) => b.id !== blockId) };
    if (it.id === toSectionId) {
      const blocks = [...it.blocks];
      const at = beforeBlockId ? blocks.findIndex((b) => b.id === beforeBlockId) : -1;
      blocks.splice(at < 0 ? blocks.length : at, 0, block);
      return { ...it, blocks };
    }
    return it;
  });
}

/**
 * Sections take whatever is under the pointer; blocks are matched against the
 * blocks of the section under the pointer, so a gap between two blocks never
 * resolves to the section itself.
 */
const collisionDetection: CollisionDetection = (args) => {
  const pick = (pred: (d: DndData | undefined) => boolean): DroppableContainer[] =>
    args.droppableContainers.filter((c) => pred(dataOf(c)));

  if (dataOf(args.active)?.type === "item") {
    return closestCenter({ ...args, droppableContainers: pick((d) => d?.type === "item") });
  }

  const blocks = pick((d) => d?.type === "block");
  const sectionHit = pointerWithin({ ...args, droppableContainers: pick((d) => d?.type === "item" && d.kind === "section") })[0];
  if (sectionHit) {
    const sectionId = String(sectionHit.id).slice("item:".length);
    const inSection = blocks.filter((c) => {
      const d = dataOf(c);
      return d?.type === "block" && d.sectionId === sectionId;
    });
    return inSection.length ? closestCenter({ ...args, droppableContainers: inSection }) : [sectionHit];
  }
  return closestCenter({ ...args, droppableContainers: blocks });
};

const PageReorderContext = createContext(false);

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

/** How long a section label stays up after a drop (and after hover, in CSS). */
const LABEL_LINGER_MS = 2000;

/**
 * The page expands again on drop. Keep the dropped section or divider where it
 * was released: scroll so that its label (`anchorOffset` px from the element's
 * top) lands where the dragged row was let go, and let the page fill in around
 * it. `linger` selects a label to keep visible for 2s after the drop.
 * Returns a ref for the element.
 */
export function useKeepDropPosition(isDragging: boolean, anchorOffset = 0, linger?: string) {
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
    scroller.scrollTop += layoutTop(el) + anchorOffset - top;
    // The label was just (re)created hidden: keep it up for a moment, then fade.
    const label = linger ? el.querySelector<HTMLElement>(linger) : null;
    label?.animate(
      [
        { opacity: 1, visibility: "visible" },
        { opacity: 1, visibility: "visible", offset: LABEL_LINGER_MS / (LABEL_LINGER_MS + 150) },
        { opacity: 0, visibility: "hidden" },
      ],
      { duration: LABEL_LINGER_MS + 150 }
    );
  }, [reordering, dropTop, anchorOffset, linger]);
  return useCallback((el: HTMLElement | null) => { node.current = el; }, []);
}

/** Sections, dividers and blocks form one column: they only move up and down. */
const verticalOnly: Modifier = ({ transform }) => ({ ...transform, x: 0 });

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

export function ProjectDndProvider({ items, onItemsChange, activation, children }: {
  items: PageItem[];
  /** Functional update — always applied to the latest items */
  onItemsChange: (update: (items: PageItem[]) => PageItem[]) => void;
  /** How drags start (default: from DragActivationContext, else "hold") */
  activation?: DragActivation;
  children: ReactNode;
}) {
  const sensors = useEditorSensors(activation);
  const [reordering, setReordering] = useState(false);
  // Blocks move between sections while dragging (onDragOver): a cancel restores this.
  const itemsAtStart = useRef<PageItem[] | null>(null);
  const dropTop = useRef<number | null>(null);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      modifiers={[verticalOnly, centerRowOnPointer]}
      // The layout changes as the page collapses: keep measuring drop targets.
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      // ReorderAligner does this for the collapse (dnd-kit's own would undo it).
      autoScroll={{ layoutShiftCompensation: false }}
      // Set in the same update as the drag start, so the collapse is part of it.
      onDragStart={({ active: a }) => {
        itemsAtStart.current = items;
        setReordering(dataOf(a)?.type === "item");
      }}
      onDragCancel={({ active: a }) => {
        dropTop.current = a.rect.current.translated?.top ?? null;
        setReordering(false);
        const start = itemsAtStart.current;
        itemsAtStart.current = null;
        if (start) onItemsChange(() => start);
      }}
      onDragOver={({ active: a, over }) => {
        const d = dataOf(a);
        const o = over ? dataOf(over) : undefined;
        if (d?.type !== "block" || !o) return;
        const toSectionId = o.type === "block" ? o.sectionId : o.kind === "section" ? o.itemId : null;
        if (!toSectionId) return;
        onItemsChange((list) => moveBlockToSection(list, d.blockId, toSectionId, o.type === "block" ? o.blockId : null));
      }}
      onDragEnd={({ active: a, over }) => {
        dropTop.current = a.rect.current.translated?.top ?? null;
        setReordering(false);
        itemsAtStart.current = null;
        const d = dataOf(a);
        const o = over ? dataOf(over) : undefined;
        if (!d || !o || a.id === over?.id) return;
        if (d.type === "item" && o.type === "item") {
          onItemsChange((list) => {
            const from = list.findIndex((i) => i.id === d.itemId);
            const to = list.findIndex((i) => i.id === o.itemId);
            return from < 0 || to < 0 ? list : arrayMove(list, from, to);
          });
        } else if (d.type === "block" && o.type === "block") {
          onItemsChange((list) => {
            const section = sectionOfBlock(list, d.blockId);
            if (!section) return list;
            const from = section.blocks.findIndex((b) => b.id === d.blockId);
            const to = section.blocks.findIndex((b) => b.id === o.blockId);
            if (from < 0 || to < 0 || from === to) return list;
            return list.map((it) => (it === section ? { ...section, blocks: arrayMove(section.blocks, from, to) } : it));
          });
        }
      }}
    >
      <ReorderAligner reordering={reordering} />
      <DragScrollFix />
      <DropTopContext.Provider value={dropTop}>
        <PageReorderContext.Provider value={reordering}>
          <SortableContext items={items.map((i) => itemDndId(i.id))} strategy={verticalListSortingStrategy}>
            {children}
          </SortableContext>
        </PageReorderContext.Provider>
      </DropTopContext.Provider>
    </DndContext>
  );
}

/** Blocks of one section as a sortable list. */
export function SectionBlocks({ section, children }: { section: PageSection; children: ReactNode }) {
  return (
    <SortableContext items={section.blocks.map((b) => blockDndId(b.id))} strategy={verticalListSortingStrategy}>
      {children}
    </SortableContext>
  );
}

export function useSortablePageItem(item: PageItem) {
  return useSortable({ id: itemDndId(item.id), data: { type: "item", itemId: item.id, kind: item.kind } satisfies ItemData });
}

export function useSortableBlock(block: Block, sectionId: string) {
  return useSortable({ id: blockDndId(block.id), data: { type: "block", blockId: block.id, sectionId } satisfies BlockData });
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
