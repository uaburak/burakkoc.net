import type { CSSProperties } from "react";
import type { ProjectTheme } from "@/types/project";

/**
 * Per-project theme (corner radius and colors), applied as CSS variables on the
 * page wrapper — both on the public page and in the live editor's canvas.
 *
 * Nothing is overridden unless a value is set: the radius rules in globals.css
 * only match inside `[data-project-radius]`, which is present only when a
 * radius is chosen.
 */

export function projectThemeAttrs(theme?: ProjectTheme): {
  style: CSSProperties;
  "data-project-radius"?: "";
} {
  const style: Record<string, string> = {};
  if (!theme) return { style };

  const radius = theme.radius && theme.radius !== "default" ? theme.radius : undefined;
  if (radius) {
    style["--project-radius"] = radius;
    const px = parseInt(radius, 10);
    // Inner elements (cards, rows) follow at ~60% so nesting stays visually consistent.
    style["--project-radius-sm"] = Number.isNaN(px) ? radius : `${Math.round(px * 0.6)}px`;
  }
  if (theme.accentColor) style["--project-accent"] = theme.accentColor;
  if (theme.bgColor) {
    style["--bg-1"] = theme.bgColor;
    style.backgroundColor = theme.bgColor;
  }
  if (theme.cardBgColor) {
    style["--bg-2"] = theme.cardBgColor;
    style["--bg-4"] = theme.cardBgColor;
  }
  if (theme.textColor) style["--text-title"] = theme.textColor;

  return radius ? { style: style as CSSProperties, "data-project-radius": "" } : { style: style as CSSProperties };
}
