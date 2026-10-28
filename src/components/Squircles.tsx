"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { getSvgPath } from "figma-squircle";

/*
 * iOS-style corners across the site: Figma's corner smoothing at 100%. CSS draws only circular
 * corners in Safari, so every rounded box (12 px and up) is clipped to Figma's own squircle path,
 * redrawn whenever the box changes size. A 1 px border is redrawn on that path too, since the clip
 * cuts the CSS border at the corners.
 *
 * Left alone: pills (radius ≥ half the height), boxes with a shadow (the clip would cut it),
 * fixed layers (lightboxes, menus), percentage or elliptical radii, anything inside
 * [data-squircle-skip], and the admin.
 */

const MIN_RADIUS = 12;
const SVG_NS = "http://www.w3.org/2000/svg";

type Tracked = { outline: SVGSVGElement | null; recolor: (() => void) | null };

function radii(cs: CSSStyleDeclaration) {
  return [cs.borderTopLeftRadius, cs.borderTopRightRadius, cs.borderBottomRightRadius, cs.borderBottomLeftRadius];
}

function eligible(el: HTMLElement) {
  if (el.closest("[data-squircle-skip]")) return false;
  const cs = getComputedStyle(el);
  if (cs.position === "fixed" || cs.boxShadow !== "none") return false;
  const r = radii(cs);
  if (r.some((v) => v.includes("%") || v.trim().includes(" "))) return false;
  const max = Math.max(...r.map(parseFloat));
  return max >= MIN_RADIUS && max < 1000; // rounded-full computes to a huge radius: a pill
}

function visibleBorder(el: HTMLElement, cs: CSSStyleDeclaration) {
  const width = parseFloat(cs.borderTopWidth);
  if (!width || cs.borderTopStyle === "none" || cs.position === "static") return 0;
  if (el instanceof HTMLImageElement || el instanceof HTMLVideoElement || el instanceof HTMLIFrameElement) return 0;
  return /rgba\(.*,\s*0\)$/.test(cs.borderTopColor) || cs.borderTopColor === "transparent" ? 0 : width;
}

export default function Squircles() {
  const isAdmin = usePathname()?.startsWith("/admin") ?? false;

  useEffect(() => {
    if (isAdmin) return;
    const tracked = new Map<HTMLElement, Tracked>();
    const skipped = new WeakSet<HTMLElement>();

    const clear = (el: HTMLElement, t: Tracked) => {
      el.style.clipPath = "";
      t.outline?.remove();
      t.outline = null;
    };

    const draw = (el: HTMLElement) => {
      const t = tracked.get(el);
      if (!t) return;
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      const cs = getComputedStyle(el);
      const [tl, tr, br, bl] = radii(cs).map(parseFloat);
      if (!w || !h || Math.max(tl, tr, br, bl) * 2 >= Math.min(w, h) - 1) return clear(el, t);

      const d = getSvgPath({
        width: w,
        height: h,
        cornerSmoothing: 1,
        topLeftCornerRadius: tl,
        topRightCornerRadius: tr,
        bottomRightCornerRadius: br,
        bottomLeftCornerRadius: bl,
      });
      el.style.clipPath = `path('${d}')`;

      const border = visibleBorder(el, cs);
      if (!border) {
        t.outline?.remove();
        t.outline = null;
        return;
      }
      if (!t.outline) {
        // Twice the border's width, half of it clipped away: it reads as the border, inside the edge.
        t.outline = document.createElementNS(SVG_NS, "svg");
        t.outline.setAttribute("aria-hidden", "true");
        t.outline.setAttribute("data-squircle-outline", "");
        t.outline.style.cssText = "position:absolute;pointer-events:none;overflow:visible;z-index:30";
        const path = document.createElementNS(SVG_NS, "path");
        path.setAttribute("fill", "none");
        t.outline.appendChild(path);
        el.appendChild(t.outline);
        // Follows hover colours: CSS transitions the border, the outline picks up the new colour.
        t.recolor = () => {
          const p = t.outline?.firstElementChild;
          if (p) p.setAttribute("stroke", getComputedStyle(el).borderTopColor);
        };
        const later = () => requestAnimationFrame(() => t.recolor?.());
        el.addEventListener("pointerenter", later);
        el.addEventListener("pointerleave", later);
        el.addEventListener("transitionend", () => t.recolor?.());
      }
      Object.assign(t.outline.style, {
        left: `-${cs.borderLeftWidth}`,
        top: `-${cs.borderTopWidth}`,
        width: `${w}px`,
        height: `${h}px`,
      });
      const path = t.outline.firstElementChild!;
      path.setAttribute("d", d);
      path.setAttribute("stroke-width", String(border * 2));
      t.recolor?.();
    };

    const resize = new ResizeObserver((entries) => entries.forEach((e) => draw(e.target as HTMLElement)));

    const scan = () => {
      for (const [el, t] of tracked) {
        if (!el.isConnected) {
          resize.unobserve(el);
          clear(el, t);
          tracked.delete(el);
        }
      }
      document.querySelectorAll<HTMLElement>('[class*="rounded"]').forEach((el) => {
        if (tracked.has(el) || skipped.has(el)) return;
        if (!eligible(el)) return void skipped.add(el);
        tracked.set(el, { outline: null, recolor: null });
        resize.observe(el);
      });
    };

    let queued = 0;
    const queueScan = () => {
      if (!queued) queued = requestAnimationFrame(() => { queued = 0; scan(); });
    };
    const mutations = new MutationObserver(queueScan);
    mutations.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
    scan();

    return () => {
      cancelAnimationFrame(queued);
      mutations.disconnect();
      resize.disconnect();
      tracked.forEach((t, el) => clear(el, t));
    };
  }, [isAdmin]);

  return null;
}
