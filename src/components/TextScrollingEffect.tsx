"use client";
import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";

gsap.registerPlugin(ScrollTrigger, SplitText);

/**
 * TextScrollingEffect - Scroll-based line reveal animation
 *
 * Wraps content and applies GSAP SplitText line animation.
 * Lines slide up from below with opacity fade as user scrolls.
 *
 * @param children - Content to animate (can contain p, h1-h6, li, blockquote, etc.)
 * @param className - Optional additional classes
 */
export default function TextScrollingEffect({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (!containerRef.current) return;

      // Select all text elements within the container
      const textElements = containerRef.current.querySelectorAll(
        "p, h1, h2, h3, h4, h5, h6, li, blockquote"
      );

      textElements.forEach((text) => {
        SplitText.create(text, {
          type: "lines",
          linesClass: "line-reveal",
          autoSplit: true,
          onSplit: (instance) => {
            return gsap.from(instance.lines, {
              yPercent: 120,
              opacity: 0,
              stagger: 0.05,
              ease: "power2.out",
              scrollTrigger: {
                trigger: text,
                start: "top 85%",
                end: "top 40%",
                scrub: 1,
              },
            });
          },
        });
      });
    },
    { scope: containerRef }
  );

  return (
    <div ref={containerRef} className={className}>
      <style>{`
        .line-reveal {
          overflow: hidden;
          display: block;
        }
      `}</style>
      {children}
    </div>
  );
}
