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
  type DraggableNode,
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
 * dnd-kit lets the innermost draggable claim the pointer event first — unless
 * the press names the one to drag (setDragTarget).
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

const dragTargets = new WeakMap<Event, Element>();

/**
 * Names the one element a press may drag — the live editor's: the layer the
 * press selects, not the innermost one under the pointer. The draggables
 * inside it leave the press to it. Call it before the press reaches them
 * (in the capture phase).
 */
export function setDragTarget(event: Event, el: Element) {
  dragTargets.set(event, el);
}

/**
 * One pointer sensor for both gestures — dnd-kit keys listeners by event name,
 * so two sensors on `onPointerDown` would overwrite each other. The hold delay
 * is bypassed when the press starts on a handle.
 */
class EditorPointerSensor extends PointerSensor {
  static activators = [{
    eventName: "onPointerDown" as const,
    // dnd-kit passes the draggable as the third argument (PointerSensor's own type leaves it out).
    handler: ({ nativeEvent }: ReactPointerEvent, { onActivation }: PointerSensorOptions, context?: { active: DraggableNode }) => {
      const target = targetOf(nativeEvent);
      if (!isPrimaryPress(nativeEvent) || !target) return false;
      // A handle always drags, even inside a no-drag toolbar.
      if (!target.closest("[data-drag-handle]") && target.closest(NO_DRAG)) return false;
      const only = dragTargets.get(nativeEvent);
      if (only && context?.active.node.current !== only) return false;
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

// ── Alt-drag: the drop leaves a copy, as in Figma ─────────────────────────────

let altHeld = false;
let copyDragging = false;
let trackingAlt = false;

/** While a drag goes on with Alt (⌥) held, every cursor is the copy one (globals.css). */
function showCopyCursor() {
  document.documentElement.toggleAttribute("data-drag-copy", copyDragging && altHeld);
}

function trackAlt(e: KeyboardEvent | PointerEvent) {
  if (e.altKey === altHeld) return;
  altHeld = e.altKey;
  showCopyCursor();
}

/**
 * Alt, held or pressed during a drag, turns its drop into a copy: the editors
 * call `begin` when a drag starts and read `end()` at the drop (or cancel).
 */
export const altDrag = {
  begin() {
    if (!trackingAlt) {
      trackingAlt = true;
      for (const type of ["pointerdown", "pointermove", "keydown", "keyup"] as const) window.addEventListener(type, trackAlt, true);
      window.addEventListener("blur", () => { altHeld = false; showCopyCursor(); });
    }
    copyDragging = true;
    showCopyCursor();
  },
  /** Was Alt held at the drop? */
  end() {
    copyDragging = false;
    showCopyCursor();
    return altHeld;
  },
};

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
  /**
   * `copy`: dropped with Alt held — the dragged item goes to `overId` as usual,
   * and a copy of it stays where it was (dropped where it was: next to it).
   */
  onMove: (activeId: string, overId: string, copy: boolean) => void;
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
      onDragStart={altDrag.begin}
      onDragCancel={altDrag.end}
      onDragEnd={({ active, over }) => {
        const copy = altDrag.end();
        if (over && (active.id !== over.id || copy)) onMove(String(active.id), String(over.id), copy);
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
  /** Live-editor hover outline */
  outline?: boolean;
}

export function SortableItem({ id, as: Tag = "div", className, children, outline = true }: SortableItemProps) {
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
        "relative touch-manipulation",
        // Live editor: a line on the card's edge (as its component's frame), in the colour of the component it
        // belongs to — on hover once a click would select it (`data-canvas-hover`, see the live editor), and while selected.
        outline && "outline outline-1 -outline-offset-1 outline-transparent data-[canvas-hover]:outline-[var(--edit-tone,var(--edit-accent))] data-[selected]:outline-[var(--edit-tone,var(--edit-accent))] transition-[outline-color]",
        // Items without their own corners (steps, rows) get a soft one for the outline.
        outline && !/\brounded/.test(className ?? "") && "rounded-[8px]",
        isDragging && cn(DRAG_LIFT, "outline-[var(--edit-tone,var(--edit-accent))]")
      )}
    >
      {children}
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
