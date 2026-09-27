"use client";

import { createContext, useContext, useEffect, type ElementType, type ReactNode, type PointerEvent as ReactPointerEvent, type KeyboardEvent as ReactKeyboardEvent } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useDndContext,
  useSensor,
  useSensors,
  type KeyboardSensorOptions,
  type PointerSensorOptions,
} from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";

/**
 * Drag & drop primitives shared by the live and the form editor.
 *
 * Two ways to start a drag:
 * - from an element marked `data-drag-handle` — immediately;
 * - from anywhere else — depending on DragActivation: "hold" (block editor)
 *   waits 220ms without moving; "press" (live editor) starts as soon as the
 *   pointer moves 4px while pressed.
 *
 * Either way plain clicks stay free: a click without moving still selects /
 * starts typing. Drags never start from form controls, buttons or the field
 * being typed in. Nested groups (cards inside a block inside a section) work because
 * dnd-kit lets the innermost draggable claim the pointer event first.
 */

const NO_DRAG = [
  "input", "textarea", "select", "option",
  "button:not([data-drag-handle])",
  '[contenteditable="true"]', '[contenteditable="plaintext-only"]',
  "[data-no-drag]",
].join(", ");

function targetOf(event: Event): Element | null {
  return event.target instanceof Element ? event.target : null;
}

function isPrimaryPress(event: PointerEvent) {
  return event.isPrimary && event.button === 0;
}

function onHandle(event: Event) {
  return Boolean(targetOf(event)?.closest("[data-drag-handle]"));
}

/**
 * One pointer sensor for both gestures — dnd-kit keys listeners by event name,
 * so two sensors on `onPointerDown` would overwrite each other. The hold delay
 * is bypassed when the press starts on a handle.
 */
class EditorPointerSensor extends PointerSensor {
  static activators = [{
    eventName: "onPointerDown" as const,
    handler: ({ nativeEvent }: ReactPointerEvent, { onActivation }: PointerSensorOptions) => {
      const target = targetOf(nativeEvent);
      if (!isPrimaryPress(nativeEvent) || !target) return false;
      // A handle always drags, even inside a no-drag toolbar.
      if (!target.closest("[data-drag-handle]") && target.closest(NO_DRAG)) return false;
      onActivation?.({ event: nativeEvent });
      return true;
    },
  }];
}

/** Keyboard dragging only from a handle — Space inside a text field must stay a space. */
class HandleKeyboardSensor extends KeyboardSensor {
  static activators = [{
    eventName: "onKeyDown" as const,
    handler: (event: ReactKeyboardEvent, options: KeyboardSensorOptions, context: Parameters<(typeof KeyboardSensor.activators)[number]["handler"]>[2]) => {
      if (!targetOf(event.nativeEvent)?.closest("[data-drag-handle]")) return false;
      return KeyboardSensor.activators[0].handler(event, options, context);
    },
  }];
}

export type DragActivation = "hold" | "press";

/** How drags start inside it (see above). Defaults to "hold". */
export const DragActivationContext = createContext<DragActivation>("hold");

const ACTIVATION = {
  hold: { delay: 220, tolerance: 6 },
  press: { distance: 4 },
} as const;

export function useEditorSensors(activation?: DragActivation) {
  const fromContext = useContext(DragActivationContext);
  return useSensors(
    useSensor(EditorPointerSensor, {
      activationConstraint: ACTIVATION[activation ?? fromContext],
      bypassActivationConstraint: ({ event }) => onHandle(event),
    }),
    useSensor(HandleKeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
}

/**
 * Look of whatever is being dragged — cards, blocks, sections, form rows: the
 * item itself follows the pointer, lifted above the page (no separate preview).
 */
export const DRAG_LIFT = "relative z-30 shadow-[0_18px_40px_rgba(0,0,0,0.18)] cursor-grabbing";

/**
 * dnd-kit should keep the dragged item under the pointer while its scroll
 * container scrolls (edge auto-scroll), but in the editors the item drifts with
 * the content instead. Each frame, nudge it — with the CSS `translate` property,
 * separate from the `transform` React sets — to where dnd-kit's own collision
 * model places it. Where dnd-kit gets it right the nudge is simply 0.
 * Render inside a DndContext.
 */
export function DragScrollFix() {
  const { active, activeNode } = useDndContext();
  useEffect(() => {
    if (!active || !activeNode) return;
    const el = activeNode;
    const apply = () => {
      const expected = active.rect.current.translated;
      if (!expected) return;
      const current = parseFloat(el.style.translate.split(" ")[1] ?? "0") || 0;
      const rendered = el.getBoundingClientRect().top - current;
      const next = Math.round(expected.top - rendered);
      if (next !== current) el.style.translate = next ? `0 ${next}px` : "";
    };
    // On every scroll (edge auto-scroll, wheel) and every frame (re-renders while moving).
    let frame = 0;
    const tick = () => {
      apply();
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    document.addEventListener("scroll", apply, { capture: true, passive: true });
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("scroll", apply, { capture: true });
      el.style.translate = "";
    };
  }, [active, activeNode]);
  return null;
}

// ── Sortable group (one flat list: cards, list items, form rows…) ─────────────

interface SortableGroupProps {
  ids: string[];
  onMove: (activeId: string, overId: string) => void;
  /** `grid` for multi-column layouts, `vertical` for stacks */
  strategy?: "grid" | "vertical";
  children: ReactNode;
}

export function SortableGroup({ ids, onMove, strategy = "vertical", children }: SortableGroupProps) {
  const sensors = useEditorSensors();
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={({ active, over }) => {
        if (over && active.id !== over.id) onMove(String(active.id), String(over.id));
      }}
    >
      <SortableContext items={ids} strategy={strategy === "grid" ? rectSortingStrategy : verticalListSortingStrategy}>
        {children}
      </SortableContext>
      <DragScrollFix />
    </DndContext>
  );
}

// ── Sortable item ─────────────────────────────────────────────────────────────

interface SortableItemProps {
  id: string;
  as?: ElementType;
  className?: string;
  children: ReactNode;
  /** Shows a remove button in the corner on hover */
  onRemove?: () => void;
  removeLabel?: string;
  /** Live-editor hover outline */
  outline?: boolean;
}

export function SortableItem({ id, as: Tag = "div", className, children, onRemove, removeLabel = "Sil", outline = true }: SortableItemProps) {
  const { setNodeRef, listeners, transform, transition, isDragging } = useSortable({ id });
  return (
    <Tag
      ref={setNodeRef}
      // The live editor finds the clicked item by it (and marks it `data-selected`).
      data-entry-id={id}
      {...listeners}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        className,
        "relative group/sortable touch-manipulation",
        // Live editor: 1px outside the card, in the colour of the component it belongs to.
        outline && "outline outline-1 outline-offset-1 outline-transparent hover:outline-[var(--edit-tone,var(--edit-accent))] data-[selected]:outline-[var(--edit-tone,var(--edit-accent))] transition-[outline-color]",
        // Items without their own corners (steps, rows) get a soft one for the outline.
        outline && !/\brounded/.test(className ?? "") && "rounded-[8px]",
        isDragging && cn(DRAG_LIFT, "outline-[var(--edit-tone,var(--edit-accent))]")
      )}
    >
      {children}
      {onRemove && (
        <button
          type="button"
          aria-label={removeLabel}
          title={removeLabel}
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="absolute -top-2.5 -right-2.5 z-30 flex items-center justify-center w-6 h-6 rounded-full border border-[var(--border)] bg-[var(--bg-1)] text-[var(--text-subtitle)] shadow-sm opacity-0 group-hover/sortable:opacity-100 focus-visible:opacity-100 hover:text-[var(--text-title)] hover:border-[var(--border-hover)] transition-opacity cursor-pointer"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
            <path d="M1.5 1.5l7 7M8.5 1.5l-7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      )}
    </Tag>
  );
}

/** Grip button that starts a drag immediately (and via keyboard). */
export function DragHandle({ label = "Sürükle", className, activatorRef }: {
  label?: string;
  className?: string;
  activatorRef?: (el: HTMLElement | null) => void;
}) {
  return (
    <button
      type="button"
      ref={activatorRef}
      data-drag-handle
      aria-label={label}
      title={label}
      className={cn("flex items-center justify-center w-6 h-6 rounded-md text-current cursor-grab active:cursor-grabbing touch-none", className)}
    >
      <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden>
        <circle cx="4" cy="2.5" r="1" /><circle cx="8" cy="2.5" r="1" />
        <circle cx="4" cy="6" r="1" /><circle cx="8" cy="6" r="1" />
        <circle cx="4" cy="9.5" r="1" /><circle cx="8" cy="9.5" r="1" />
      </svg>
    </button>
  );
}
