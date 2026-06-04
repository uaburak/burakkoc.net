"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";

export default function CustomCursor() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isClicked, setIsClicked] = useState(false);
  const [isText, setIsText] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    // Set initial position out of screen
    gsap.set(wrapper, { x: -100, y: -100 });

    const onMouseMove = (e: MouseEvent) => {
      setIsVisible(true);
      
      gsap.to(wrapper, {
        x: e.clientX,
        y: e.clientY,
        duration: 0.2, // Smoother, elastic lag effect
        ease: "power3.out",
        overwrite: "auto",
      });
    };

    const onMouseLeave = () => {
      setIsVisible(false);
    };

    const onMouseEnter = () => {
      setIsVisible(true);
    };

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
      const textTags = ["P", "H1", "H2", "H3", "H4", "H5", "H6", "SPAN", "LABEL", "LI", "TD", "TH", "STRONG", "EM", "CODE"];
      if (textTags.includes(target.tagName)) return true;
      
      // Check for direct text content
      for (let i = 0; i < target.childNodes.length; i++) {
        const node = target.childNodes[i];
        if (node.nodeType === 3 && node.nodeValue?.trim()) { // 3 is Node.TEXT_NODE
          return true;
        }
      }
      return false;
    };

    const onMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (checkClickable(target)) {
        setIsHovered(true);
        setIsText(false);
      } else if (checkText(target)) {
        setIsText(true);
        setIsHovered(false);
      } else {
        setIsHovered(false);
        setIsText(false);
      }
    };

    const onMouseDown = () => {
      setIsClicked(true);
    };

    const onMouseUp = () => {
      setIsClicked(false);
    };

    window.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseleave", onMouseLeave);
    document.addEventListener("mouseenter", onMouseEnter);
    window.addEventListener("mouseover", onMouseOver);
    window.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mouseup", onMouseUp);

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseleave", onMouseLeave);
      document.removeEventListener("mouseenter", onMouseEnter);
      window.removeEventListener("mouseover", onMouseOver);
      window.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [mounted]);

  if (!mounted) return null;

  return (
    <div
      ref={wrapperRef}
      className={`custom-cursor-wrapper ${isVisible ? "visible" : ""}`}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        pointerEvents: "none",
        zIndex: 99999,
      }}
    >
      <div 
        className={`custom-cursor-square ${isHovered ? "hovered" : ""} ${isClicked ? "clicked" : ""} ${isText ? "text" : ""}`} 
      />
    </div>
  );
}

