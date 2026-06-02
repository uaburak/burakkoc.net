"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

interface SegmentedProps {
  options: string[];
  defaultValue?: string;
  onChange?: (value: string) => void;
  className?: string;
}

export function Segmented({ options, defaultValue, onChange, className }: SegmentedProps) {
  const [active, setActive] = useState(defaultValue ?? options[0]);
  const containerRef = useRef<HTMLDivElement>(null);
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 3, width: 0 });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const activeEl = container.querySelector<HTMLButtonElement>(
      `[data-value="${active}"]`
    );
    if (!activeEl) return;
    const containerRect = container.getBoundingClientRect();
    const elRect = activeEl.getBoundingClientRect();
    setIndicatorStyle({
      left: elRect.left - containerRect.left,
      width: elRect.width,
    });
  }, [active]);

  const handleSelect = (value: string) => {
    setActive(value);
    onChange?.(value);
  };

  return (
    <div
      ref={containerRef}
      role="tablist"
      className={cn(
        "relative flex items-center p-1 rounded-full border border-[var(--border)] bg-[var(--bg-2)] overflow-hidden",
        className
      )}
    >
      {/* Sliding indicator */}
      <span
        aria-hidden
        className="absolute top-[3px] bottom-[3px] rounded-full bg-[var(--bg-4)] transition-all duration-200 ease-in-out pointer-events-none"
        style={{ left: indicatorStyle.left, width: indicatorStyle.width }}
      />

      {options.map((opt) => (
        <button
          key={opt}
          role="tab"
          data-value={opt}
          aria-selected={active === opt}
          onClick={() => handleSelect(opt)}
          className={cn(
            "relative z-10 flex items-center px-3 py-[6px] rounded-full text-sm font-[500] leading-5 whitespace-nowrap cursor-pointer transition-colors duration-200",
            active === opt
              ? "text-[var(--text-p)]"
              : "text-[var(--text-subtitle)]"
          )}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}
