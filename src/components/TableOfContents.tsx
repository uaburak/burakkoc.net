"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";

export interface TocItem {
  id: string;
  label: string;
  level?: 1 | 2;
}

interface TableOfContentsProps {
  items: TocItem[];
}

export function TableOfContents({ items }: TableOfContentsProps) {
  const [active, setActive] = useState<string>(items[0]?.id ?? "");
  const containerRef = useRef<HTMLUListElement>(null);
  const [dotStyle, setDotStyle] = useState<React.CSSProperties>({
    transform: "translate(0px, 0px)",
    opacity: 0,
  });

  useEffect(() => {
    const observers: IntersectionObserver[] = [];

    items.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (!el) return;

      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) setActive(id);
        },
        { rootMargin: "-10% 0px -80% 0px", threshold: 0 }
      );

      observer.observe(el);
      observers.push(observer);
    });

    return () => observers.forEach((o) => o.disconnect());
  }, [items]);

  useEffect(() => {
    const handleScroll = () => {
      const scrollHeight = document.documentElement.scrollHeight;
      const innerHeight = window.innerHeight;
      const scrollY = window.scrollY;

      const isScrollable = scrollHeight > innerHeight;
      const isAtBottom = isScrollable && (innerHeight + scrollY >= scrollHeight - 30);

      if (isAtBottom && items.length > 0) {
        const lastId = items[items.length - 1].id;
        setActive((prev) => (prev !== lastId ? lastId : prev));
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => window.removeEventListener("scroll", handleScroll);
  }, [items]);

  useEffect(() => {
    if (!active || !containerRef.current) {
      setDotStyle((prev) => ({ ...prev, opacity: 0 }));
      return;
    }

    const activeEl = containerRef.current.querySelector(
      `[data-id="${active}"]`
    ) as HTMLElement;

    if (activeEl) {
      const activeTop = activeEl.offsetTop;
      const activeHeight = activeEl.offsetHeight;
      const dotHeight = 4; // w-1 h-1 is 4px
      const yOffset = activeTop + (activeHeight - dotHeight) / 2;

      // Determine level to set x offset: 5px for level 1, 17px for level 2
      const activeItem = items.find((item) => item.id === active);
      const level = activeItem?.level ?? 1;
      const xOffset = level === 2 ? 17 : 5;

      setDotStyle({
        transform: `translate(${xOffset}px, ${yOffset}px)`,
        opacity: 1,
      });
    } else {
      setDotStyle((prev) => ({ ...prev, opacity: 0 }));
    }
  }, [active, items]);

  const scrollTo = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  return (
    <nav aria-label="Table of contents" className="relative flex flex-col gap-1">
      <ul ref={containerRef} className="relative flex flex-col gap-0.5">
        {/* Sliding Dot */}
        <span
          className="absolute left-0 top-0 w-1 h-1 rounded-full bg-[var(--text-title)] transition-all duration-300 ease-out pointer-events-none"
          style={dotStyle}
        />

        {items.map(({ id, label, level = 1 }) => (
          <li key={id}>
            <button
              onClick={() => scrollTo(id)}
              data-id={id}
              className={cn(
                "w-full text-left text-sm leading-6 transition-colors duration-200 cursor-pointer rounded-sm font-normal",
                level === 2 ? "pl-7" : "pl-4",
                active === id
                  ? "text-[var(--text-title)]"
                  : "text-[var(--text-subtitle)] hover:text-[var(--text-p)]"
              )}
            >
              {label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}

