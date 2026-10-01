"use client";

import { useMemo, useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import type { DesignVariable } from "@/types/design";
import { useDesignVariables } from "@/components/project/designVariables";
import type { CSSProperties } from "react";
import { byIdMap, libraryOf, numberOf, type FigmaDocument, type FrameNode } from "./model";
import { MotionStyle, NodeView, PAGE_CSS, PAGE_TOP_NARROW, RenderProvider } from "./NodeView";
import { revealPlan } from "./site";

gsap.registerPlugin(ScrollTrigger, SplitText);

/**
 * The project's page on the site: the file's page frame, drawn at its width
 * (narrower screens scale nothing — the frame's Fill children follow the
 * screen), its prototypes playing, its links and pictures working, its
 * layers coming in as they are scrolled to (the older pages' scroll effects:
 * see revealPlan). Render it inside the design scope (DesignSystemStyle puts
 * the variables there).
 */
export function PageView({ doc, lang = "tr", variables, effects = true }: { doc: FigmaDocument; lang?: "tr" | "en"; variables?: DesignVariable[]; /** The scroll effects (off: everything simply there) */ effects?: boolean }) {
  const fromContext = useDesignVariables();
  const byId = useMemo(() => byIdMap(variables ?? fromContext), [variables, fromContext]);
  const page = doc.nodes.find((n): n is FrameNode => n.id === doc.pageId && (n.type === "frame" || n.type === "component"));
  // Instances find their main components on any page of the file (the Bileşenler page's).
  const library = useMemo(() => libraryOf(doc), [doc]);
  const ctx = useMemo(() => ({ nodes: library, byId, lang, play: true, site: true }), [library, byId, lang]);
  const plan = useMemo(() => (page && effects ? revealPlan(page, library) : null), [page, library, effects]);
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const el = root.current;
      if (!el || !plan) return;
      const find = (id: string) => el.querySelector<HTMLElement>(`[data-node-id="${CSS.escape(id)}"]`);
      const splits: { revert: () => void }[] = [];
      // Texts: their lines slide up from under their own edge, one after the other, with the scroll.
      for (const id of plan.lines) {
        const text = find(id);
        if (!text || !text.textContent?.trim()) continue;
        splits.push(
          SplitText.create(text, {
            type: "lines",
            linesClass: "line-reveal",
            autoSplit: true,
            onSplit: (instance) =>
              gsap.from(instance.lines, {
                yPercent: 120,
                opacity: 0,
                stagger: 0.05,
                ease: "power2.out",
                scrollTrigger: { trigger: text, start: "top 95%", end: "top 40%", scrub: 1 },
              }),
          })
        );
      }
      // Everything else: it rises into place, as far as it has been scrolled to.
      for (const id of plan.blocks) {
        const block = find(id);
        if (!block) continue;
        gsap.from(block, {
          opacity: 0,
          y: 48,
          scale: 0.97,
          ease: "power2.out",
          scrollTrigger: { trigger: block, start: "top 90%", end: "top 40%", scrub: 1.2 },
        });
      }
      return () => {
        splits.forEach((split) => {
          try {
            split.revert();
          } catch {
            /* already gone */
          }
        });
      };
    },
    { scope: root, dependencies: [plan] }
  );

  if (!page) return null;
  // The page frame at the top of the screen: its own place on the canvas doesn't matter here.
  // (Its width follows the screen: kept proportions would make its height follow too.)
  const top: FrameNode = { ...page, x: 0, y: 0, rotation: undefined, lockAspect: undefined };
  // What a narrow screen takes off the room over the page's content (see PAGE_CSS).
  const lift = Math.max(0, numberOf(page.paddingTop, byId) - PAGE_TOP_NARROW);
  return (
    <RenderProvider value={ctx}>
      <MotionStyle />
      <style>{PAGE_CSS}</style>
      <div ref={root} data-canvas-page="" className="relative w-full overflow-x-clip" style={{ maxWidth: page.width, marginLeft: "auto", marginRight: "auto", "--page-lift": `${lift}px` } as CSSProperties}>
        <div style={{ position: "relative", width: "100%", minHeight: page.sizingV === "hug" ? undefined : page.height }}>
          <NodeView node={{ ...top, width: page.width, sizingH: "fill" }} parentLayout="vertical" />
        </div>
      </div>
    </RenderProvider>
  );
}
