"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Prism from "prismjs";
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-jsx";
import "prismjs/components/prism-tsx";
import "prismjs/components/prism-css";
import "prismjs/components/prism-json";
import "prismjs/components/prism-bash";
import "prismjs/components/prism-python";
import "prismjs/components/prism-sql";

interface CodeHighlightProps {
  code: string;
  language?: string;
  className?: string;
}

const SCROLLBAR_OFFSET = 24; // px offset from start and end
const SCROLLBAR_SIZE = 5;    // px thickness
const HIDE_DELAY = 1200;     // ms before auto-hide

export function CodeHighlight({ code, language = "javascript", className = "" }: CodeHighlightProps) {
  const codeRef = useRef<HTMLElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Scrollbar state
  const [hasVScroll, setHasVScroll] = useState(false);
  const [hasHScroll, setHasHScroll] = useState(false);
  const [vThumbHeight, setVThumbHeight] = useState(0);
  const [vThumbTop, setVThumbTop] = useState(0);
  const [hThumbWidth, setHThumbWidth] = useState(0);
  const [hThumbLeft, setHThumbLeft] = useState(0);
  const [visible, setVisible] = useState(false);

  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDraggingV = useRef(false);
  const isDraggingH = useRef(false);
  const dragStartY = useRef(0);
  const dragStartX = useRef(0);
  const dragStartScrollTop = useRef(0);
  const dragStartScrollLeft = useRef(0);

  useEffect(() => {
    if (codeRef.current) {
      Prism.highlightElement(codeRef.current);
    }
  }, [code, language]);

  const langMap: Record<string, string> = {
    js: "javascript",
    ts: "typescript",
    py: "python",
    rules: "javascript",
    sh: "bash",
    html: "jsx",
  };
  const normalizedLang = langMap[language.toLowerCase()] || language.toLowerCase();

  // Show scrollbar and schedule auto-hide
  const flashScrollbar = useCallback(() => {
    setVisible(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      if (!isDraggingV.current && !isDraggingH.current) {
        setVisible(false);
      }
    }, HIDE_DELAY);
  }, []);

  // Recalculate scrollbar dimensions
  const recalc = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;

    const { scrollHeight, clientHeight, scrollWidth, clientWidth, scrollTop, scrollLeft } = el;
    const trackH = clientHeight - SCROLLBAR_OFFSET * 2;
    const trackW = clientWidth - SCROLLBAR_OFFSET * 2;

    // Vertical
    const needsV = scrollHeight > clientHeight + 1;
    setHasVScroll(needsV);
    if (needsV && trackH > 0) {
      const ratio = clientHeight / scrollHeight;
      const thumbH = Math.max(40, ratio * trackH);
      const maxScroll = scrollHeight - clientHeight;
      const scrollRatio = maxScroll > 0 ? scrollTop / maxScroll : 0;
      const thumbTop = SCROLLBAR_OFFSET + scrollRatio * (trackH - thumbH);
      setVThumbHeight(thumbH);
      setVThumbTop(thumbTop);
    }

    // Horizontal
    const needsH = scrollWidth > clientWidth + 1;
    setHasHScroll(needsH);
    if (needsH && trackW > 0) {
      const ratio = clientWidth / scrollWidth;
      const thumbW = Math.max(40, ratio * trackW);
      const maxScroll = scrollWidth - clientWidth;
      const scrollRatio = maxScroll > 0 ? scrollLeft / maxScroll : 0;
      const thumbLeft = SCROLLBAR_OFFSET + scrollRatio * (trackW - thumbW);
      setHThumbWidth(thumbW);
      setHThumbLeft(thumbLeft);
    }
  }, []);

  // Observe content size changes
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    recalc();

    const ro = new ResizeObserver(() => recalc());
    ro.observe(el);
    // Also observe the <pre> child for content changes
    const pre = el.querySelector("pre");
    if (pre) ro.observe(pre);

    return () => ro.disconnect();
  }, [recalc, code]);

  // Handle scroll events
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onScroll = () => {
      recalc();
      flashScrollbar();
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [recalc, flashScrollbar]);

  // Vertical drag
  const onVMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    isDraggingV.current = true;
    dragStartY.current = e.clientY;
    dragStartScrollTop.current = containerRef.current?.scrollTop ?? 0;

    const el = containerRef.current;
    if (!el) return;

    const trackH = el.clientHeight - SCROLLBAR_OFFSET * 2;

    const onMouseMove = (ev: MouseEvent) => {
      const delta = ev.clientY - dragStartY.current;
      const scrollRange = el.scrollHeight - el.clientHeight;
      const thumbRange = trackH - vThumbHeight;
      if (thumbRange > 0) {
        el.scrollTop = dragStartScrollTop.current + (delta / thumbRange) * scrollRange;
      }
    };

    const onMouseUp = () => {
      isDraggingV.current = false;
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      flashScrollbar();
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }, [vThumbHeight, flashScrollbar]);

  // Horizontal drag
  const onHMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    isDraggingH.current = true;
    dragStartX.current = e.clientX;
    dragStartScrollLeft.current = containerRef.current?.scrollLeft ?? 0;

    const el = containerRef.current;
    if (!el) return;

    const trackW = el.clientWidth - SCROLLBAR_OFFSET * 2;

    const onMouseMove = (ev: MouseEvent) => {
      const delta = ev.clientX - dragStartX.current;
      const scrollRange = el.scrollWidth - el.clientWidth;
      const thumbRange = trackW - hThumbWidth;
      if (thumbRange > 0) {
        el.scrollLeft = dragStartScrollLeft.current + (delta / thumbRange) * scrollRange;
      }
    };

    const onMouseUp = () => {
      isDraggingH.current = false;
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      flashScrollbar();
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }, [hThumbWidth, flashScrollbar]);

  return (
    <div className={`relative w-full h-full ${className}`}>
      {/* Scrollable container with hidden native scrollbar */}
      <div
        ref={containerRef}
        className="w-full h-full overflow-auto hide-native-scrollbar"
        onMouseEnter={flashScrollbar}
      >
        <pre
          suppressHydrationWarning
          className="font-mono text-xs sm:text-sm leading-6 text-[var(--text-p)] whitespace-pre p-5 sm:p-6 m-0 min-w-full inline-block"
        >
          <code
            suppressHydrationWarning
            ref={codeRef}
            className={`language-${normalizedLang} inline-block min-w-full pb-2`}
          >
            {code}
          </code>
        </pre>
      </div>

      {/* Custom vertical scrollbar */}
      {hasVScroll && (
        <div
          className="absolute top-0 right-0 w-4 h-full pointer-events-none"
          style={{ zIndex: 10 }}
        >
          <div
            onMouseDown={onVMouseDown}
            className="absolute pointer-events-auto cursor-pointer"
            style={{
              right: 4,
              top: vThumbTop,
              width: SCROLLBAR_SIZE,
              height: vThumbHeight,
              borderRadius: 9999,
              backgroundColor: "var(--border-hover)",
              opacity: visible ? 0.7 : 0,
              transition: "opacity 0.3s ease",
            }}
            onMouseEnter={() => setVisible(true)}
          />
        </div>
      )}

      {/* Custom horizontal scrollbar */}
      {hasHScroll && (
        <div
          className="absolute bottom-0 left-0 h-4 w-full pointer-events-none"
          style={{ zIndex: 10 }}
        >
          <div
            onMouseDown={onHMouseDown}
            className="absolute pointer-events-auto cursor-pointer"
            style={{
              bottom: 4,
              left: hThumbLeft,
              height: SCROLLBAR_SIZE,
              width: hThumbWidth,
              borderRadius: 9999,
              backgroundColor: "var(--border-hover)",
              opacity: visible ? 0.7 : 0,
              transition: "opacity 0.3s ease",
            }}
            onMouseEnter={() => setVisible(true)}
          />
        </div>
      )}
    </div>
  );
}
