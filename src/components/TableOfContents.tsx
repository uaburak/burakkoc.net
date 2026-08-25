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
  const isScrollingRef = useRef(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [dotStyle, setDotStyle] = useState<React.CSSProperties>({
    transform: "translate(0px, 0px)",
    opacity: 0,
  });

  // Calculate active section based on heading scroll position
  const updateActiveSection = useCallback(() => {
    if (isScrollingRef.current || items.length === 0) return;

    const scrollY = window.scrollY;
    const innerHeight = window.innerHeight;
    const scrollHeight = document.documentElement.scrollHeight;

    // 1. If at the bottom of the page, activate the last TOC item
    if (scrollHeight > innerHeight && innerHeight + scrollY >= scrollHeight - 60) {
      const lastId = items[items.length - 1].id;
      setActive((prev) => (prev !== lastId ? lastId : prev));
      return;
    }

    // 2. Find which heading is currently at or past the alignment line (180px threshold)
    const threshold = 180;
    let currentId = items[0]?.id ?? "";

    for (const item of items) {
      const el = document.getElementById(item.id);
      if (!el) continue;
      const target = el.querySelector("h1, h2, h3") || el;
      const rect = target.getBoundingClientRect();
      if (rect.top <= threshold) {
        currentId = item.id;
      } else {
        break;
      }
    }

    setActive((prev) => (prev !== currentId ? currentId : prev));
  }, [items]);

  useEffect(() => {
    updateActiveSection();

    const handleScroll = () => {
      updateActiveSection();
    };

    window.addEventListener("scroll", handleScroll, { passive: true });

    // Also register on Lenis scroll if available
    const lenis = (window as any).__lenis;
    if (lenis && typeof lenis.on === "function") {
      lenis.on("scroll", handleScroll);
    }

    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (lenis && typeof lenis.off === "function") {
        lenis.off("scroll", handleScroll);
      }
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [updateActiveSection]);

  // Sliding indicator dot positioning
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
      const dotHeight = 4; // 4px dot
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
    if (id === "overview") {
      setActive("overview");
      isScrollingRef.current = true;
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);

      const lenis = (window as any).__lenis;
      if (lenis && typeof lenis.scrollTo === "function") {
        lenis.scrollTo(0, {
          duration: 1.0,
          easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
          onComplete: () => {
            scrollTimeoutRef.current = setTimeout(() => {
              isScrollingRef.current = false;
            }, 100);
          },
        });
      } else {
        window.scrollTo({ top: 0, behavior: "smooth" });
        scrollTimeoutRef.current = setTimeout(() => {
          isScrollingRef.current = false;
        }, 800);
      }
      return;
    }

    const el = document.getElementById(id);
    if (!el) return;

    // Find the heading element inside the section to align directly to the heading text
    const target = el.querySelector("h1, h2, h3") || el;

    setActive(id);
    isScrollingRef.current = true;
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);

    const lenis = (window as any).__lenis;
    if (lenis && typeof lenis.scrollTo === "function") {
      lenis.scrollTo(target, {
        offset: -170, // Align exactly with the left sidebar back button text (160px top + 10px py)
        duration: 1.0,
        easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        onComplete: () => {
          scrollTimeoutRef.current = setTimeout(() => {
            isScrollingRef.current = false;
          }, 100);
        },
      });
    } else {
      const top = target.getBoundingClientRect().top + window.scrollY - 170;
      window.scrollTo({ top, behavior: "smooth" });
      scrollTimeoutRef.current = setTimeout(() => {
        isScrollingRef.current = false;
      }, 800);
    }
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
              title={label}
              className={cn(
                "w-full text-left text-sm leading-6 transition-colors duration-200 cursor-pointer rounded-sm font-normal truncate block",
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
