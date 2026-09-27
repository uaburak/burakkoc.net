"use client";

import type { DesignVariable, TextStyle } from "@/types/design";
import { cn } from "@/lib/utils";
import { boundValue } from "@/components/project/designVariables";

/** "Ag" in a text style's look — its weight and colour, at one size so the lists stay even (Figma's style sample). */
export function TextStyleSample({ styleId, className }: { styleId: string; className?: string }) {
  return (
    // A design scope of its own: the site's variables and the style's rule reach it outside the canvas too.
    <span data-design-scope="" className={cn("flex items-center justify-center shrink-0 w-5 select-none", className)}>
      <span data-text-style={styleId} style={{ fontSize: 13, lineHeight: "16px" }}>Ag</span>
    </span>
  );
}

/** A text style's size over its line height, as Figma writes a text style's: "14 / 20". */
export function textStyleMetrics(style: TextStyle, byId: Map<string, DesignVariable>) {
  const size = style.fontSize ? boundValue(style.fontSize, "light", byId) : null;
  const line = style.lineHeight ? boundValue(style.lineHeight, "light", byId) : null;
  return `${size ?? "—"} / ${line ?? "—"}`;
}
