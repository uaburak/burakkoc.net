"use client";

import { useMemo } from "react";
import type { DesignVariable } from "@/types/design";
import { useDesignVariables } from "@/components/project/designVariables";
import { byIdMap, libraryOf, type FigmaDocument, type FrameNode } from "./model";
import { MotionStyle, NodeView, RenderProvider } from "./NodeView";

/**
 * The project's page on the site: the file's page frame, drawn at its width
 * (narrower screens scale nothing — the frame's Fill children follow the
 * screen), its prototypes playing. Render it inside the design scope
 * (DesignSystemStyle puts the variables there).
 */
export function PageView({ doc, lang = "tr", variables }: { doc: FigmaDocument; lang?: "tr" | "en"; variables?: DesignVariable[] }) {
  const fromContext = useDesignVariables();
  const byId = useMemo(() => byIdMap(variables ?? fromContext), [variables, fromContext]);
  const page = doc.nodes.find((n): n is FrameNode => n.id === doc.pageId && (n.type === "frame" || n.type === "component"));
  // Instances find their main components on any page of the file (the Bileşenler page's).
  const library = useMemo(() => libraryOf(doc), [doc]);
  const ctx = useMemo(() => ({ nodes: library, byId, lang, play: true }), [library, byId, lang]);
  if (!page) return null;
  // The page frame at the top of the screen: its own place on the canvas doesn't matter here.
  const root: FrameNode = { ...page, x: 0, y: 0, rotation: undefined };
  return (
    <RenderProvider value={ctx}>
      <MotionStyle />
      <div className="relative w-full overflow-x-clip" style={{ maxWidth: page.width, margin: "0 auto" }}>
        <div style={{ position: "relative", width: "100%", minHeight: page.sizingV === "hug" ? undefined : page.height }}>
          <NodeView node={{ ...root, width: page.width, sizingH: "fill" }} parentLayout="vertical" />
        </div>
      </div>
    </RenderProvider>
  );
}
