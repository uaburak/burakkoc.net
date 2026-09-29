"use client";

import type { CSSProperties } from "react";
import type { DesignVariable, FrameLook, Stroke } from "@/types/design";
import { boundValue, cssValue, useDesignVariables } from "./designVariables";

/**
 * A frame's look (see FrameLook) as styles — the page's, a Bölüm's, a Blok's,
 * a main component's, an instance's: Figma's Appearance, Fill, Stroke
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

/**
 * Its corners as CSS: each corner's own (independent corners), else its
 * radius — `projectRadius`: a project's own corner radius (its theme) wins
 * over the radius, as over the site's other surfaces (globals.css): a large
 * one's (30px and up) takes the theme's, a card's (16–29px) the theme's
 * smaller one; a pill's and corners given one by one stay.
 */
export function radiusCss(look: FrameLook, byId: Map<string, DesignVariable>, { projectRadius = false } = {}): string | null {
  if (look.corners) {
    const corners = look.corners.map((c) => cssValue(c, "number", byId) ?? "0px");
    return corners.every((c) => c === "0px" || c === "0") ? null : corners.join(" ");
  }
  const radius = look.radius ? cssValue(look.radius, "number", byId) : null;
  if (!radius || !projectRadius || !look.radius) return radius;
  const px = Number(boundValue(look.radius, "light", byId));
  if (px >= 30 && px < 100) return `var(--project-radius, ${radius})`;
  if (px >= 16 && px < 30) return `var(--project-radius-sm, ${radius})`;
  return radius;
}

/** Figma's blend modes as CSS: pass through blends nothing itself; normal keeps its children's blending inside it. */
function blendStyle(blend: FrameLook["blend"]): CSSProperties {
  if (!blend || blend === "pass-through") return {};
  if (blend === "normal") return { isolation: "isolate" };
  return { mixBlendMode: blend };
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
  const style: CSSProperties = {
    // Hidden: no room on the page (Figma's eye) — the layers keep it.
    display: look.hidden ? "none" : undefined,
    ...blendStyle(look.blend),
    opacity: look.opacity !== undefined && look.opacity < 100 ? Math.max(0, look.opacity) / 100 : undefined,
    borderRadius: radiusCss(look, byId, { projectRadius }) ?? undefined,
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
