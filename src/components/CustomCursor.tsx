"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";

// ── Traffic icons (tek sefer DOM'a basılır, class ile gösterilir) ──────────────

const TRAFFIC_ICONS = {
  up:    '<svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M3 9L7 5l4 4" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  down:  '<svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M3 5l4 4 4-4" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  trash: '<svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M3.5 3.5l7 7M10.5 3.5l-7 7" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
} as const;

type TrafficIcon = keyof typeof TRAFFIC_ICONS;

const TEXT_TAGS = new Set([
  "P","H1","H2","H3","H4","H5","H6","SPAN","LABEL","LI","TD","TH","STRONG","EM","CODE",
]);

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * Özel imleç. Tüm durum geçişleri doğrudan DOM üzerinde (classList) yapılır —
 * mousemove/mouseover başına React render'ı tetiklenmez.
 */
export default function CustomCursor() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLDivElement>(null);
  const iconRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    const dot = dotRef.current;
    const icon = iconRef.current;
    if (!wrapper || !dot || !icon) return;

    gsap.set(wrapper, { x: -100, y: -100 });

    let iconTimer: ReturnType<typeof setTimeout> | null = null;
    let currentTraffic: string | null = null;
    let currentIcon: TrafficIcon | null = null;

    const clearIconTimer = () => {
      if (iconTimer) {
        clearTimeout(iconTimer);
        iconTimer = null;
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      wrapper.classList.add("visible");
      gsap.to(wrapper, {
        x: e.clientX,
        y: e.clientY,
        duration: 0.2,
        ease: "power3.out",
        overwrite: "auto",
      });
    };

    const onMouseLeave = () => wrapper.classList.remove("visible");
    const onMouseEnter = () => wrapper.classList.add("visible");

    const checkClickable = (target: HTMLElement): boolean =>
      target.tagName === "A" ||
      target.tagName === "BUTTON" ||
      target.getAttribute("role") === "button" ||
      target.closest('a, button, .cursor-pointer, .platform-box, [role="button"]') !== null;

    const checkText = (target: HTMLElement): boolean => {
      if (TEXT_TAGS.has(target.tagName)) return true;
      for (let i = 0; i < target.childNodes.length; i++) {
        const node = target.childNodes[i];
        if (node.nodeType === 3 && node.nodeValue?.trim()) return true;
      }
      return false;
    };

    const checkImage = (target: HTMLElement): boolean =>
      target.tagName === "IMG" || target.closest("img") !== null;

    const getTraffic = (target: HTMLElement) => {
      const el = target.closest<HTMLElement>("[data-traffic-color]");
      if (!el) return null;
      return {
        color: el.getAttribute("data-traffic-color") as string,
        icon: el.getAttribute("data-traffic-icon") as TrafficIcon | null,
      };
    };

    const setState = (state: "hovered" | "text" | "image-hovered" | null) => {
      dot.classList.toggle("hovered", state === "hovered");
      dot.classList.toggle("text", state === "text");
      dot.classList.toggle("image-hovered", state === "image-hovered");
    };

    const onMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      const traffic = getTraffic(target);

      if (traffic) {
        if (traffic.color !== currentTraffic || traffic.icon !== currentIcon) {
          currentTraffic = traffic.color;
          currentIcon = traffic.icon;
          clearIconTimer();

          dot.style.setProperty("--cursor-traffic-color", traffic.color);
          dot.classList.add("traffic");
          dot.classList.remove("icon-ready");
          setState(null);

          /* Kırmızı zeminde beyaz ikon; yeşil/sarı parlak olduğu için koyu ikon */
          icon.style.color =
            traffic.color === "#e20000" ? "rgba(255,255,255,0.9)" : "rgba(0,0,0,0.65)";
          icon.innerHTML = traffic.icon ? TRAFFIC_ICONS[traffic.icon] ?? "" : "";

          // Önce daire büyüsün, ikon sonra fade-in olsun
          iconTimer = setTimeout(() => dot.classList.add("icon-ready"), 80);
        }
        return;
      }

      // Traffic bölgesinden çıkıldı
      if (currentTraffic !== null) {
        clearIconTimer();
        currentTraffic = null;
        currentIcon = null;
        dot.classList.remove("traffic", "icon-ready");
        dot.style.removeProperty("--cursor-traffic-color");
        icon.innerHTML = "";
      }

      if (checkImage(target)) setState("image-hovered");
      else if (checkClickable(target)) setState("hovered");
      else if (checkText(target)) setState("text");
      else setState(null);
    };

    const onMouseDown = () => dot.classList.add("clicked");
    const onMouseUp   = () => dot.classList.remove("clicked");

    window.addEventListener("mousemove",    onMouseMove, { passive: true });
    document.addEventListener("mouseleave", onMouseLeave);
    document.addEventListener("mouseenter", onMouseEnter);
    window.addEventListener("mouseover",    onMouseOver, { passive: true });
    window.addEventListener("mousedown",    onMouseDown, { passive: true });
    window.addEventListener("mouseup",      onMouseUp,   { passive: true });

    return () => {
      clearIconTimer();
      gsap.killTweensOf(wrapper);
      window.removeEventListener("mousemove",    onMouseMove);
      document.removeEventListener("mouseleave", onMouseLeave);
      document.removeEventListener("mouseenter", onMouseEnter);
      window.removeEventListener("mouseover",    onMouseOver);
      window.removeEventListener("mousedown",    onMouseDown);
      window.removeEventListener("mouseup",      onMouseUp);
    };
  }, []);

  return (
    <div
      ref={wrapperRef}
      className="custom-cursor-wrapper"
      style={{ position: "fixed", top: 0, left: 0, pointerEvents: "none", zIndex: 999999 }}
    >
      <div ref={dotRef} className="custom-cursor-square">
        <span ref={iconRef} className="traffic-icon" />
      </div>
    </div>
  );
}
