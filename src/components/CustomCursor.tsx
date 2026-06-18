"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";

// ── Traffic icons ─────────────────────────────────────────────────────────────

function IconUp() {
  return (
    <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
      <path d="M3 9L7 5l4 4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconDown() {
  return (
    <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
      <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconTrash() {
  return (
    <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
      <path d="M3.5 3.5l7 7M10.5 3.5l-7 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

type TrafficIcon = "up" | "down" | "trash" | null;

// ── Component ─────────────────────────────────────────────────────────────────

export default function CustomCursor() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [isHovered,      setIsHovered]      = useState(false);
  const [isClicked,      setIsClicked]      = useState(false);
  const [isText,         setIsText]         = useState(false);
  const [isImageHovered, setIsImageHovered] = useState(false);
  const [isVisible,      setIsVisible]      = useState(false);
  const [mounted,        setMounted]        = useState(false);
  const [trafficColor,   setTrafficColor]   = useState<string | null>(null);
  const [trafficIcon,    setTrafficIcon]    = useState<TrafficIcon>(null);
  /** Slight delay so icon fades in after circle expands */
  const [iconReady,      setIconReady]      = useState(false);
  const iconTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted) return;

    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    gsap.set(wrapper, { x: -100, y: -100 });

    const onMouseMove = (e: MouseEvent) => {
      setIsVisible(true);
      gsap.to(wrapper, {
        x: e.clientX,
        y: e.clientY,
        duration: 0.2,
        ease: "power3.out",
        overwrite: "auto",
      });
    };

    const onMouseLeave = () => setIsVisible(false);
    const onMouseEnter = () => setIsVisible(true);

    const checkClickable = (target: HTMLElement | null): boolean => {
      if (!target) return false;
      return (
        target.tagName === "A" ||
        target.tagName === "BUTTON" ||
        target.classList.contains("cursor-pointer") ||
        target.classList.contains("platform-box") ||
        target.getAttribute("role") === "button" ||
        target.closest("a") !== null ||
        target.closest("button") !== null ||
        target.closest(".cursor-pointer") !== null ||
        target.closest(".platform-box") !== null ||
        target.closest('[role="button"]') !== null
      );
    };

    const checkText = (target: HTMLElement | null): boolean => {
      if (!target) return false;
      const textTags = ["P","H1","H2","H3","H4","H5","H6","SPAN","LABEL","LI","TD","TH","STRONG","EM","CODE"];
      if (textTags.includes(target.tagName)) return true;
      for (let i = 0; i < target.childNodes.length; i++) {
        const node = target.childNodes[i];
        if (node.nodeType === 3 && node.nodeValue?.trim()) return true;
      }
      return false;
    };

    const checkImage = (target: HTMLElement | null): boolean => {
      if (!target) return false;
      return (
        target.tagName === "IMG" ||
        target.closest("img") !== null
      );
    };

    const getTraffic = (target: HTMLElement | null): { color: string; icon: TrafficIcon } | null => {
      let el: HTMLElement | null = target;
      while (el) {
        const color = el.getAttribute("data-traffic-color");
        if (color) {
          const icon = (el.getAttribute("data-traffic-icon") as TrafficIcon) ?? null;
          return { color, icon };
        }
        el = el.parentElement;
      }
      return null;
    };

    const clearIconTimer = () => {
      if (iconTimerRef.current) {
        clearTimeout(iconTimerRef.current);
        iconTimerRef.current = null;
      }
    };

    const onMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const traffic = getTraffic(target);

      if (traffic) {
        clearIconTimer();
        setTrafficColor(traffic.color);
        setTrafficIcon(traffic.icon);
        setIconReady(false);
        setIsHovered(false);
        setIsText(false);
        setIsImageHovered(false);
        // Slight delay — let the circle expand first, then fade icon in
        iconTimerRef.current = setTimeout(() => setIconReady(true), 80);
        return;
      }

      // Left traffic zone
      clearIconTimer();
      setTrafficColor(null);
      setTrafficIcon(null);
      setIconReady(false);

      if (checkImage(target)) {
        setIsImageHovered(true);
        setIsHovered(false);
        setIsText(false);
      } else if (checkClickable(target)) {
        setIsHovered(true);
        setIsText(false);
        setIsImageHovered(false);
      } else if (checkText(target)) {
        setIsText(true);
        setIsHovered(false);
        setIsImageHovered(false);
      } else {
        setIsHovered(false);
        setIsText(false);
        setIsImageHovered(false);
      }
    };

    const onMouseDown = () => setIsClicked(true);
    const onMouseUp   = () => setIsClicked(false);

    window.addEventListener("mousemove",    onMouseMove);
    document.addEventListener("mouseleave", onMouseLeave);
    document.addEventListener("mouseenter", onMouseEnter);
    window.addEventListener("mouseover",    onMouseOver);
    window.addEventListener("mousedown",    onMouseDown);
    window.addEventListener("mouseup",      onMouseUp);

    return () => {
      clearIconTimer();
      window.removeEventListener("mousemove",    onMouseMove);
      document.removeEventListener("mouseleave", onMouseLeave);
      document.removeEventListener("mouseenter", onMouseEnter);
      window.removeEventListener("mouseover",    onMouseOver);
      window.removeEventListener("mousedown",    onMouseDown);
      window.removeEventListener("mouseup",      onMouseUp);
    };
  }, [mounted]);

  if (!mounted) return null;

  /* Red bg → white icon; green/yellow are bright → dark icon */
  const iconColor = trafficColor === "#e20000" ? "rgba(255,255,255,0.9)" : "rgba(0,0,0,0.65)";

  const classes = [
    "custom-cursor-square",
    trafficColor              ? "traffic"    : "",
    trafficColor && iconReady ? "icon-ready" : "",
    !trafficColor && isHovered ? "hovered"   : "",
    isClicked                 ? "clicked"    : "",
    !trafficColor && isText   ? "text"       : "",
    !trafficColor && isImageHovered ? "image-hovered" : "",
  ].filter(Boolean).join(" ");

  return (
    <div
      ref={wrapperRef}
      className={`custom-cursor-wrapper ${isVisible ? "visible" : ""}`}
      style={{ position: "fixed", top: 0, left: 0, pointerEvents: "none", zIndex: 999999 }}
    >
      <div
        className={classes}
        style={trafficColor ? ({ "--cursor-traffic-color": trafficColor } as React.CSSProperties) : undefined}
      >
        {trafficColor && trafficIcon && (
          <span className="traffic-icon" style={{ color: iconColor }}>
            {trafficIcon === "up"    && <IconUp />}
            {trafficIcon === "down"  && <IconDown />}
            {trafficIcon === "trash" && <IconTrash />}
          </span>
        )}
      </div>
    </div>
  );
}
