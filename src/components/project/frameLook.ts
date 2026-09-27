"use client";

import type { CSSProperties } from "react";
import type { DesignVariable, FrameLook, Stroke } from "@/types/design";
import { cssValue, useDesignVariables } from "./designVariables";

/**
 * A frame's look (see FrameLook) as styles — the page's, a Bölüm's, a Blok's,
 * a component's, a molecule's instances': Figma's Appearance, Fill, Stroke
 * and Clip content.
 */

/**
 * A stroke as a box shadow — inside, across or outside the edge, following
 * the corners — so, as in Figma, it never changes the frame's size (and the
 * editor's outlines stay free).
 */
function strokeShadow(stroke: Stroke | undefined, byId: Map<string, DesignVariable>): string | undefined {
  if (!stroke || stroke.hidden) return undefined;
  const color = cssValue(stroke.color, "color", byId);
  const weight = cssValue(stroke.weight, "number", byId);
  if (!color || !weight) return undefined;
  if (stroke.align === "outside") return `0 0 0 ${weight} ${color}`;
  if (stroke.align === "center") return `inset 0 0 0 calc(${weight} / 2) ${color}, 0 0 0 calc(${weight} / 2) ${color}`;
  return `inset 0 0 0 ${weight} ${color}`;
}

/** Its fill's colour as CSS — none when it has none, or it is hidden. */
export function fillCss(look: FrameLook, byId: Map<string, DesignVariable>): string | null {
  return look.fill && !look.fill.hidden ? cssValue(look.fill.color, "color", byId) : null;
}

/**
 * A frame's look as styles — only what is set, so it can go after the
 * frame's own (size, layout) without undoing them. `projectRadius`: a
 * project's own corner radius (its theme) wins over its corners, as over the
 * site's other cards.
 */
export function frameLookStyle(look: FrameLook | undefined, variables: DesignVariable[], { projectRadius = false } = {}): CSSProperties {
  if (!look) return {};
  const byId = new Map(variables.map((v) => [v.id, v]));
  const radius = look.radius ? cssValue(look.radius, "number", byId) : null;
  const style: CSSProperties = {
    opacity: look.opacity !== undefined && look.opacity < 100 ? Math.max(0, look.opacity) / 100 : undefined,
    borderRadius: radius ? (projectRadius ? `var(--project-radius-sm, ${radius})` : radius) : undefined,
    backgroundColor: fillCss(look, byId) ?? undefined,
    boxShadow: strokeShadow(look.stroke, byId),
    overflow: look.clip ? "hidden" : undefined,
  };
  return Object.fromEntries(Object.entries(style).filter(([, v]) => v !== undefined)) as CSSProperties;
}

/** A frame's look as styles, with the site's variables (see frameLookStyle). */
export function useFrameLook(look: FrameLook | undefined): CSSProperties {
  return frameLookStyle(look, useDesignVariables());
}
