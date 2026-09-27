"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * A scroll container with the site's own scrollbars: the native ones are
 * hidden; thin rounded thumbs show while scrolling (or when the pointer comes
 * in) and fade out after a moment. A thumb can be dragged to scroll.
 *
 * `className` styles the outer box (give it a size); `viewportClassName` the
 * scrolling element inside it (padding, layout of the children).
 */

const THUMB_SIZE = 5;     // px thickness
const MIN_THUMB = 40;     // px
const HIDE_DELAY = 1200;  // ms before the thumbs fade out

type Thumb = { size: number; offset: number };

export function ScrollArea({ className, viewportClassName, inset = 24, edge = 4, children }: {
  className?: string;
  viewportClassName?: string;
  /** Room the thumbs keep from the start and end of their track (px) */
  inset?: number;
  /** Distance of the thumbs from the edge they run along (px) */
  edge?: number;
  children: ReactNode;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const [vertical, setVertical] = useState<Thumb | null>(null);
  const [horizontal, setHorizontal] = useState<Thumb | null>(null);
  const [visible, setVisible] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragging = useRef(false);

  /** Show the thumbs, and hide them again a moment later (not while one is dragged). */
  const flash = useCallback(() => {
    setVisible(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (!dragging.current) setVisible(false);
    }, HIDE_DELAY);
  }, []);

  /** Thumb sizes and positions from the viewport's scroll state. */
  const measure = useCallback(() => {
    const el = viewport.current;
    if (!el) return;
    const thumb = (content: number, view: number, position: number): Thumb | null => {
      const track = view - inset * 2;
      if (content <= view + 1 || track <= 0) return null;
      const size = Math.max(MIN_THUMB, (view / content) * track);
      const max = content - view;
      return { size, offset: inset + (max > 0 ? position / max : 0) * (track - size) };
    };
    setVertical(thumb(el.scrollHeight, el.clientHeight, el.scrollTop));
    setHorizontal(thumb(el.scrollWidth, el.clientWidth, el.scrollLeft));
  }, [inset]);

  // Measure whenever the viewport or one of its children changes size (children come and go too).
  useEffect(() => {
    const el = viewport.current;
    if (!el) return;
    const resize = new ResizeObserver(measure);
    const observeAll = () => {
      resize.disconnect();
      resize.observe(el);
      Array.from(el.children).forEach((child) => resize.observe(child));
    };
    observeAll();
    const children = new MutationObserver(observeAll);
    children.observe(el, { childList: true });
    return () => {
      resize.disconnect();
      children.disconnect();
    };
  }, [measure]);

  useEffect(() => {
    const el = viewport.current;
    if (!el) return;
    const onScroll = () => {
      measure();
      flash();
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [measure, flash]);

  useEffect(() => () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
  }, []);

  /** Dragging a thumb scrolls the viewport by the same share of its range. */
  const startDrag = (axis: "vertical" | "horizontal", e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const el = viewport.current;
    const thumb = axis === "vertical" ? vertical : horizontal;
    if (!el || !thumb) return;
    dragging.current = true;
    const v = axis === "vertical";
    const start = v ? e.clientY : e.clientX;
    const startScroll = v ? el.scrollTop : el.scrollLeft;
    const thumbRange = (v ? el.clientHeight : el.clientWidth) - inset * 2 - thumb.size;
    const scrollRange = v ? el.scrollHeight - el.clientHeight : el.scrollWidth - el.clientWidth;

    const onMove = (ev: MouseEvent) => {
      if (thumbRange <= 0) return;
      const next = startScroll + (((v ? ev.clientY : ev.clientX) - start) / thumbRange) * scrollRange;
      if (v) el.scrollTop = next;
      else el.scrollLeft = next;
    };
    const onUp = () => {
      dragging.current = false;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      flash();
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  const thumbStyle = { backgroundColor: "var(--border-hover)", opacity: visible ? 0.7 : 0, transition: "opacity 0.3s ease" };

  return (
    <div className={cn("relative", className)}>
      <div
        ref={viewport}
        className={cn("overflow-auto hide-native-scrollbar", viewportClassName)}
        onMouseEnter={flash}
      >
        {children}
      </div>

      {vertical && (
        <div className="pointer-events-none absolute top-0 right-0 z-10 w-4 h-full">
          <div
            onMouseDown={(e) => startDrag("vertical", e)}
            onMouseEnter={() => setVisible(true)}
            className="pointer-events-auto absolute rounded-full cursor-pointer"
            style={{ right: edge, top: vertical.offset, width: THUMB_SIZE, height: vertical.size, ...thumbStyle }}
          />
        </div>
      )}

      {horizontal && (
        <div className="pointer-events-none absolute bottom-0 left-0 z-10 h-4 w-full">
          <div
            onMouseDown={(e) => startDrag("horizontal", e)}
            onMouseEnter={() => setVisible(true)}
            className="pointer-events-auto absolute rounded-full cursor-pointer"
            style={{ bottom: edge, left: horizontal.offset, height: THUMB_SIZE, width: horizontal.size, ...thumbStyle }}
          />
        </div>
      )}
    </div>
  );
}
