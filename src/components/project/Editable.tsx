"use client";

import { useLayoutEffect, useRef, useState, type CSSProperties, type ElementType, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { renderRichText } from "./RichText";

/**
 * Text that becomes editable on double-click — the building block of the live
 * editor.
 *
 * Without `onChange` it renders plain (or rich) text and nothing else, so the
 * public page markup is unchanged. With `onChange` it shows the formatted text
 * (a single click selects the surrounding block; blue on hover once it is
 * selected), and a double-click swaps it to a contentEditable element holding the raw value
 * (with its **markers**), shown in red while it is being edited. Enter commits single-line fields, Escape reverts.
 * The same values can also be edited from the settings panel.
 */

/** Placeholder copy for empty fields — only visible while editing. */
export function Hint({ children }: { children: ReactNode }) {
  return <span className="italic opacity-30 select-none">{children}</span>;
}

// `plaintext-only` keeps pasted formatting and <div>/<br> soup out of the value.
// Firefox only gained it in 136; older engines fall back to `true` + manual paste.
const PLAINTEXT_ONLY =
  typeof document !== "undefined" &&
  (() => {
    try {
      const el = document.createElement("div");
      el.contentEditable = "plaintext-only";
      return el.contentEditable === "plaintext-only";
    } catch {
      return false;
    }
  })();

function placeCaret(el: HTMLElement, point: { x: number; y: number } | null) {
  const selection = window.getSelection();
  if (!selection) return;
  let range: Range | null = null;
  if (point) {
    const doc = document as Document & {
      caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
      caretRangeFromPoint?: (x: number, y: number) => Range | null;
    };
    const pos = doc.caretPositionFromPoint?.(point.x, point.y);
    if (pos && el.contains(pos.offsetNode)) {
      range = document.createRange();
      range.setStart(pos.offsetNode, pos.offset);
    } else {
      const r = doc.caretRangeFromPoint?.(point.x, point.y);
      if (r && el.contains(r.startContainer)) range = r;
    }
  }
  if (!range) {
    range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
  }
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

function readText(el: HTMLElement, multiline: boolean) {
  let text = el.innerText.replace(/ /g, " ");
  // Engines keep an extra trailing line break so the caret can sit on an
  // empty last line; it is not part of the value.
  if (text.endsWith("\n")) text = text.slice(0, -1);
  return multiline ? text : text.replace(/\n+/g, " ");
}

export interface EditableTextProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  /** Enter inserts a line break instead of committing */
  multiline?: boolean;
  /** Render **bold** / [links](…) when not being edited */
  rich?: boolean;
  as?: ElementType;
  className?: string;
  /** Start in edit mode (used right after inserting a list item) */
  autoEdit?: boolean;
  /** Single-line Enter handler — replaces the default commit */
  onEnter?: () => void;
  /** Backspace in an empty field */
  onBackspaceEmpty?: () => void;
  /** Custom rendering of a non-empty value while not being edited (bullets, icons…) */
  display?: (value: string) => ReactNode;
  /**
   * A text layer of its component's item (the live editor selects it and lays
   * it out — see ComponentDesign — without drawing a line around it): its
   * field, as `data-text-layer`.
   */
  layer?: string;
  /** The atom giving it its look (see DesignAtom), as `data-atom` — its typography comes from there */
  atom?: string;
  style?: CSSProperties;
}

export function EditableText({
  value = "",
  onChange,
  placeholder,
  multiline = false,
  rich = false,
  as: Tag = "span",
  className,
  autoEdit = false,
  onEnter,
  onBackspaceEmpty,
  display,
  layer,
  atom,
  style,
}: EditableTextProps) {
  const [editing, setEditing] = useState(autoEdit);
  const ref = useRef<HTMLElement>(null);
  const clickPoint = useRef<{ x: number; y: number } | null>(null);
  const startValue = useRef(value);

  // Entering edit mode: seed the raw text once, focus and put the caret where
  // the user clicked. The element is never re-seeded while editing, otherwise
  // every keystroke would reset the caret.
  useLayoutEffect(() => {
    if (!editing || !ref.current) return;
    const el = ref.current;
    startValue.current = value;
    el.textContent = value;
    el.focus({ preventScroll: true });
    placeCaret(el, clickPoint.current);
    clickPoint.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  const content = value ? (display ? display(value) : rich ? renderRichText(value) : value) : null;

  if (!onChange) {
    if (!value) return null;
    return <Tag data-atom={atom} className={className} style={style}>{content}</Tag>;
  }

  // The two modes are separate elements (distinct keys). The editing element's
  // text is written straight to the DOM, outside React; reusing that element
  // for the formatted view would leave the raw text next to the rendered one.
  if (!editing) {
    return (
      <Tag
        key="view"
        data-text-layer={layer}
        data-atom={atom}
        className={className}
        style={style}
        onDoubleClick={(e: React.MouseEvent) => {
          clickPoint.current = { x: e.clientX, y: e.clientY };
          setEditing(true);
        }}
      >
        {/*
          Inline wrapper: the hover tint follows the text itself, not the field's full-width box. It shows
          once a double-click edits it — in the live editor, inside the selected component (`data-live-selected`).
        */}
        <span className="transition-colors duration-150 [[data-live-selected]_&:hover]:text-[var(--edit-tone,var(--edit-accent))]">
          {content ?? <Hint>{placeholder}</Hint>}
        </span>
      </Tag>
    );
  }

  function commit() {
    if (ref.current) onChange?.(readText(ref.current, multiline));
  }

  function insertPlain(text: string) {
    document.execCommand("insertText", false, text);
  }

  return (
    <Tag
      key="edit"
      ref={ref}
      data-text-layer={layer}
      data-atom={atom}
      style={style}
      contentEditable={PLAINTEXT_ONLY ? "plaintext-only" : true}
      suppressContentEditableWarning
      spellCheck
      data-placeholder={placeholder}
      className={cn(
        className,
        multiline && "whitespace-pre-wrap",
        // Same box as the text itself — only the color says it is being edited.
        "cursor-text outline-none select-text text-[var(--edit-active)] caret-[var(--edit-active)]",
        "empty:before:content-[attr(data-placeholder)] empty:before:italic empty:before:opacity-30"
      )}
      onInput={commit}
      onBlur={() => {
        commit();
        setEditing(false);
      }}
      onPaste={(e: React.ClipboardEvent) => {
        if (PLAINTEXT_ONLY) return;
        e.preventDefault();
        insertPlain(e.clipboardData.getData("text/plain"));
      }}
      onKeyDown={(e: React.KeyboardEvent<HTMLElement>) => {
        if (e.key === "Escape") {
          e.preventDefault();
          onChange(startValue.current);
          if (ref.current) ref.current.textContent = startValue.current;
          ref.current?.blur();
          return;
        }
        if (e.key === "Enter" && !e.nativeEvent.isComposing) {
          if (multiline) {
            if (!PLAINTEXT_ONLY) {
              e.preventDefault();
              insertPlain("\n");
            }
            return;
          }
          e.preventDefault();
          commit();
          if (onEnter) onEnter();
          ref.current?.blur();
          return;
        }
        if (e.key === "Backspace" && onBackspaceEmpty && ref.current && readText(ref.current, multiline) === "") {
          e.preventDefault();
          onBackspaceEmpty();
        }
      }}
    />
  );
}
