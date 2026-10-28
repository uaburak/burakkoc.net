"use client";
import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const FROM = { opacity: 0, y: 48, scale: 0.97, ease: "power2.out" } as const;

/**
 * ScrollReveal - Scrubbed scroll-based reveal animation
 *
 * The animation progress is directly tied to scroll position:
 * scroll halfway → animation plays halfway.
 *
 * When the content marks its parts with `data-reveal` (cards, tiles, phones), each part
 * reveals on its own as it reaches the viewport instead of the whole block at once; parts
 * side by side in one row start a few percent apart, left to right.
 *
 * @param children - Content to animate
 * @param className - Optional additional classes
 */
export default function ScrollReveal({
  children,
  className = "",
  disabled = false,
}: {
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (disabled || !ref.current) return;

      const parts = gsap.utils.toArray<HTMLElement>("[data-reveal]", ref.current);
      if (parts.length === 0) {
        gsap.from(ref.current, {
          ...FROM,
          scrollTrigger: {
            trigger: ref.current,
            start: "top 90%",   // element viewport'a %10 girince başla
            end: "clamp(top 40%)", // element %60'a gelince bitsin; sayfa sonundaysa en altta biter
            scrub: 1.2,         // scroll ile doğrudan bağlantılı (hafif lag)
          },
        });
        return;
      }

      // Rows are read before anything moves: parts whose tops line up share a row.
      let rowTop = Number.NaN;
      let col = 0;
      parts.forEach((part) => {
        const top = part.getBoundingClientRect().top;
        col = Math.abs(top - rowTop) < 4 ? col + 1 : 0;
        rowTop = top;
        const lag = Math.min(col, 4) * 4;
        gsap.from(part, {
          ...FROM,
          scrollTrigger: {
            trigger: part,
            start: `top ${90 - lag}%`,
            end: `clamp(top ${40 - lag}%)`,
            scrub: 1.2,
          },
        });
      });
    },
    { scope: ref, dependencies: [disabled] }
  );

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
