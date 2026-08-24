"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Segmented } from "@/components/Segmented";
import { BadgeItem } from "@/types/project";
import { CodeHighlight } from "@/components/CodeHighlight";
import { cn } from "@/lib/utils";

type ZoomableImageProps = React.ImgHTMLAttributes<HTMLImageElement> & {
  badges?: BadgeItem[];
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  getStartRect?: () => DOMRect | null;
};

function getEmbedUrl(src: string): string | null {
  const ytMatch = src.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;
  const vimeoMatch = src.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
  if (src.endsWith(".mp4") || src.endsWith(".webm")) return src;
  return null;
}

function ZoomTabContent({ tab2 }: { tab2: NonNullable<BadgeItem["tab2"]> }) {
  if (tab2.type === "image") {
    return tab2.src ? (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img src={tab2.src} alt="" className="w-full h-full object-cover select-none pointer-events-none" />
    ) : (
      <div className="absolute inset-0 flex items-center justify-center text-sm text-[var(--text-subtitle)] opacity-40 select-none">
        Görsel URL girilmedi
      </div>
    );
  }
  if (tab2.type === "video") {
    const url = tab2.src ? getEmbedUrl(tab2.src) : null;
    const isRaw = tab2.src?.endsWith(".mp4") || tab2.src?.endsWith(".webm");
    return url ? (
      isRaw ? (
        <video src={url} controls className="w-full h-full object-cover" />
      ) : (
        <iframe src={url} className="w-full h-full" allowFullScreen title="Video" />
      )
    ) : (
      <div className="absolute inset-0 flex items-center justify-center text-sm text-[var(--text-subtitle)] opacity-40 select-none">
        Video URL girilmedi
      </div>
    );
  }
  if (tab2.type === "code") {
    return (
      <div className="bg-[var(--bg-2)] w-full h-full overflow-auto">
        <CodeHighlight code={tab2.content?.trim() || "// kod girilmedi"} language={tab2.language || "javascript"} />
      </div>
    );
  }
  if (tab2.type === "text") {
    return (
      <div className="p-5 sm:p-6 overflow-auto w-full h-full bg-[var(--bg-2)]">
        <p className="text-base font-light leading-7 text-[var(--text-p)] whitespace-pre-wrap">
          {tab2.content?.trim() || "Metin girilmedi"}
        </p>
      </div>
    );
  }
  return null;
}

export function ZoomableImage({ src, alt, className, style, badges, activeTab, onTabChange, getStartRect, ...props }: ZoomableImageProps) {
  const [isZoomed, setIsZoomed] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [originalRect, setOriginalRect] = useState<DOMRect | null>(null);
  const [targetRect, setTargetRect] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const [originalBorderRadius, setOriginalBorderRadius] = useState<string>("0px");
  const [localActiveTab, setLocalActiveTab] = useState(activeTab || "");
  const [prevActiveTab, setPrevActiveTab] = useState(activeTab || "");

  const lastTapTimeRef = useRef<number>(0);
  const lastTapPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const originalImgRef = useRef<HTMLImageElement>(null);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const normalizedActiveTab = activeTab || "";
  if (normalizedActiveTab !== prevActiveTab) {
    setPrevActiveTab(normalizedActiveTab);
    setLocalActiveTab(normalizedActiveTab);
  }

  // Directly check window to avoid setting state in useEffect on mount
  const portalContainer = typeof window !== "undefined" ? document.body : null;

  // Segmented badge configurations
  const segBadge = badges?.find((b) => b.icon === "segmented");
  const tab1Label = segBadge?.tab1Label ?? "Project";
  const tab2Label = segBadge?.tab2Label ?? "Code";
  const tab2 = segBadge?.tab2;
  const isTab2 = segBadge && localActiveTab === tab2Label;

  // Calculate coordinates to center and fit the image within the viewport
  const calculateTargetRect = useCallback((naturalW: number, naturalH: number) => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const isMobile = vw < 640;
    const maxW = isMobile ? vw - 16 : vw * 0.85;
    const maxH = isMobile ? vh * 0.85 : vh * 0.85;
    const imageRatio = naturalW / naturalH;
    const targetRatio = maxW / maxH;

    let targetWidth = maxW;
    let targetHeight = maxH;

    if (imageRatio > targetRatio) {
      targetWidth = maxW;
      targetHeight = maxW / imageRatio;
    } else {
      targetHeight = maxH;
      targetWidth = maxH * imageRatio;
    }

    return {
      left: (vw - targetWidth) / 2,
      top: (vh - targetHeight) / 2,
      width: targetWidth,
      height: targetHeight,
    };
  }, []);

  const handleZoom = (e: React.MouseEvent<HTMLImageElement>) => {
    if (isZoomed) return;

    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }

    const img = e.currentTarget;
    const customRect = getStartRect?.();
    const rect = (customRect && customRect.width > 0 && customRect.height > 0)
      ? customRect
      : img.getBoundingClientRect();
    const computedStyle = window.getComputedStyle(img);
    const parentStyle = img.parentElement ? window.getComputedStyle(img.parentElement) : null;

    const borderRadius = customRect
      ? "16px"
      : (parentStyle?.overflow === "hidden" ? parentStyle.borderRadius : computedStyle.borderRadius);

    setOriginalRect(rect);
    setOriginalBorderRadius(borderRadius || "0px");
    setLocalActiveTab(activeTab || tab1Label);
    setIsFullscreen(false);

    const target = calculateTargetRect(img.naturalWidth || rect.width, img.naturalHeight || rect.height);
    setTargetRect(target);
    setIsZoomed(true);
  };

  const handleClose = useCallback(() => {
    if (!isZoomed || !originalImgRef.current) return;

    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
    }

    setIsFullscreen(false);

    const currentRect = originalImgRef.current.getBoundingClientRect();
    setOriginalRect(currentRect);

    setIsExpanded(false);

    closeTimeoutRef.current = setTimeout(() => {
      setIsZoomed(false);
      setOriginalRect(null);
      setTargetRect(null);
      onTabChange?.(localActiveTab);
      closeTimeoutRef.current = null;
    }, 400);
  }, [isZoomed, localActiveTab, onTabChange]);

  const toggleFullscreen = useCallback(() => {
    if (isTab2) return;
    setIsFullscreen((prev) => !prev);
  }, [isTab2]);

  // Touch handler for mobile double-tap toggle
  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (isTab2 || e.changedTouches.length !== 1) return;
    const touch = e.changedTouches[0];
    const now = Date.now();
    const timeDiff = now - lastTapTimeRef.current;
    const dx = Math.abs(touch.clientX - lastTapPosRef.current.x);
    const dy = Math.abs(touch.clientY - lastTapPosRef.current.y);

    if (timeDiff < 300 && dx < 35 && dy < 35) {
      // Double tap detected!
      lastTapTimeRef.current = 0;
      toggleFullscreen();
    } else {
      lastTapTimeRef.current = now;
      lastTapPosRef.current = { x: touch.clientX, y: touch.clientY };
    }
  };

  // Lock background scrolling while zoomed
  useEffect(() => {
    if (!isZoomed) return;

    const lenis = (window as any).__lenis;
    if (lenis && typeof lenis.stop === "function") {
      lenis.stop();
    }

    const preventScroll = (e: Event) => {
      const target = e.target as HTMLElement | null;
      if (target && target.closest("[data-lenis-prevent]")) {
        return;
      }
      e.preventDefault();
    };

    window.addEventListener("wheel", preventScroll, { passive: false });
    window.addEventListener("touchmove", preventScroll, { passive: false });

    return () => {
      if (lenis && typeof lenis.start === "function") {
        lenis.start();
      }
      window.removeEventListener("wheel", preventScroll);
      window.removeEventListener("touchmove", preventScroll);
    };
  }, [isZoomed]);

  // Clean up timeouts on unmount
  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
      }
    };
  }, []);

  // Trigger smooth expansion once portal mounts
  useEffect(() => {
    if (isZoomed && targetRect) {
      const raf = requestAnimationFrame(() => {
        setIsExpanded(true);
      });
      return () => cancelAnimationFrame(raf);
    }
  }, [isZoomed, targetRect]);

  // Close on Escape key press (or exit fullscreen first)
  useEffect(() => {
    if (!isZoomed) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (isFullscreen) {
          setIsFullscreen(false);
        } else {
          handleClose();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isZoomed, isFullscreen, handleClose]);

  // Handle browser resize during zoom
  useEffect(() => {
    if (!isZoomed || !originalImgRef.current) return;

    const handleResize = () => {
      const img = originalImgRef.current;
      if (img) {
        const target = calculateTargetRect(img.naturalWidth || img.clientWidth, img.naturalHeight || img.clientHeight);
        setTargetRect(target);
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [isZoomed, calculateTargetRect]);

  // Determine active lightbox rect
  const vw = typeof window !== "undefined" ? window.innerWidth : 0;
  const vh = typeof window !== "undefined" ? window.innerHeight : 0;
  const isMobile = vw < 640;

  const fullscreenPadding = isMobile ? 8 : 16;
  const activeLeft = isFullscreen ? fullscreenPadding : (targetRect?.left ?? 0);
  const activeTop = isFullscreen ? fullscreenPadding : (targetRect?.top ?? 0);
  const activeWidth = isFullscreen ? (vw - fullscreenPadding * 2) : (targetRect?.width ?? 0);
  const activeHeight = isFullscreen ? (vh - fullscreenPadding * 2) : (targetRect?.height ?? 0);

  return (
    <>
      {/* Original Image (Layout placeholder) */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={originalImgRef}
        src={src}
        alt={alt}
        className={`${className || ""} cursor-zoom-in`}
        style={{
          ...style,
          visibility: isZoomed ? "hidden" : "visible",
        }}
        onClick={handleZoom}
        {...props}
      />

      {/* Zoom Portal */}
      {isZoomed && portalContainer && originalRect && targetRect &&
        createPortal(
          <>
            {/* Backdrop with smooth fade in/out */}
            <div
              className="fixed inset-0 z-[9998] cursor-zoom-out"
              style={{
                backgroundColor: "var(--bg-1)",
                opacity: isExpanded ? 0.85 : 0,
                transition: "opacity 0.4s cubic-bezier(0.32, 0.72, 0, 1)",
              }}
              onClick={handleClose}
            />

            {/* Close Button at Top Right */}
            <button
              type="button"
              aria-label="Close lightbox"
              className="fixed top-5 right-5 z-[10000] p-2.5 rounded-full bg-[var(--bg-2)]/80 backdrop-blur-md border border-[var(--border)] text-[var(--text-title)] hover:bg-[var(--bg-3)] transition-all duration-200 cursor-pointer flex items-center justify-center opacity-100"
              style={{
                opacity: isExpanded ? 1 : 0,
                transition: "opacity 0.4s cubic-bezier(0.32, 0.72, 0, 1)",
              }}
              onClick={handleClose}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {segBadge && (
              <div
                className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999]"
                style={{
                  opacity: isExpanded ? 1 : 0,
                  transition: "opacity 0.4s cubic-bezier(0.32, 0.72, 0, 1)",
                  pointerEvents: isExpanded ? "auto" : "none",
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <Segmented
                  options={[tab1Label, tab2Label]}
                  value={localActiveTab}
                  onChange={(tab) => {
                    setLocalActiveTab(tab);
                    setIsFullscreen(false);
                  }}
                  size="md"
                />
              </div>
            )}

            {/* Lightbox Container */}
            <div
              data-lenis-prevent
              className={cn(
                "fixed z-[9999] select-text overscroll-contain",
                isTab2 ? "cursor-default" : "cursor-zoom-in"
              )}
              style={{
                left: isExpanded ? `${activeLeft}px` : `${originalRect.left}px`,
                top: isExpanded ? `${activeTop}px` : `${originalRect.top}px`,
                width: isExpanded ? `${activeWidth}px` : `${originalRect.width}px`,
                height: isExpanded ? `${activeHeight}px` : `${originalRect.height}px`,
                borderRadius: isExpanded ? (isFullscreen ? "20px" : "32px") : originalBorderRadius,
                border: "1px solid var(--border)",
                overflow: "hidden",
                transition: "all 0.4s cubic-bezier(0.32, 0.72, 0, 1)",
              }}
              onClick={isTab2 ? (e) => e.stopPropagation() : undefined}
              onDoubleClick={toggleFullscreen}
              onTouchEnd={handleTouchEnd}
            >
              {isTab2 && tab2 ? (
                <div className="w-full h-full bg-[var(--bg-2)] overflow-auto" onClick={(e) => e.stopPropagation()}>
                  <ZoomTabContent tab2={tab2} />
                </div>
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={src}
                  alt={alt}
                  className="w-full h-full object-contain select-none pointer-events-none"
                  style={{
                    transition: "transform 0.4s cubic-bezier(0.32, 0.72, 0, 1)",
                  }}
                />
              )}
            </div>
          </>,
          portalContainer
        )
      }
    </>
  );
}


