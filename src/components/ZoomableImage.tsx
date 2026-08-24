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
  const [originalRect, setOriginalRect] = useState<DOMRect | null>(null);
  const [targetRect, setTargetRect] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const [originalBorderRadius, setOriginalBorderRadius] = useState<string>("0px");
  const [localActiveTab, setLocalActiveTab] = useState(activeTab || "");
  const [prevActiveTab, setPrevActiveTab] = useState(activeTab || "");

  // Inner scale for UI indicator/cursor
  const [innerScale, setInnerScale] = useState(1);

  // High performance direct DOM refs for 60/120fps hardware accelerated pinch & pan
  const innerScaleRef = useRef<number>(1);
  const panOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const isDraggingRef = useRef<boolean>(false);
  const touchStartRef = useRef<{ x: number; y: number; panX: number; panY: number }>({ x: 0, y: 0, panX: 0, panY: 0 });
  const pinchStartDistRef = useRef<number>(0);
  const pinchStartScaleRef = useRef<number>(1);
  const hasMovedRef = useRef<boolean>(false);
  const rafPendingRef = useRef<boolean>(false);

  const originalImgRef = useRef<HTMLImageElement>(null);
  const zoomedImgRef = useRef<HTMLImageElement>(null);
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

  // Calculate coordinates to center and fit the image within the viewport without cropping
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
      // Image is wider than viewport ratio limit
      targetWidth = maxW;
      targetHeight = maxW / imageRatio;
    } else {
      // Image is taller than viewport ratio limit
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

  // Update image DOM transform using rAF for ultra-smooth 60/120fps response
  const updateZoomedImageTransform = useCallback((scale: number, panX: number, panY: number, animate: boolean = false) => {
    innerScaleRef.current = scale;
    panOffsetRef.current = { x: panX, y: panY };
    if (zoomedImgRef.current) {
      zoomedImgRef.current.style.transition = animate ? "transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)" : "none";
      zoomedImgRef.current.style.transform = `translate3d(${panX}px, ${panY}px, 0) scale(${scale})`;
    }
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

    // Detect if parent container has overflow: hidden and has border-radius
    const borderRadius = customRect
      ? "16px"
      : (parentStyle?.overflow === "hidden" ? parentStyle.borderRadius : computedStyle.borderRadius);

    setOriginalRect(rect);
    setOriginalBorderRadius(borderRadius || "0px");
    setLocalActiveTab(activeTab || tab1Label);

    innerScaleRef.current = 1;
    panOffsetRef.current = { x: 0, y: 0 };
    setInnerScale(1);

    const target = calculateTargetRect(img.naturalWidth || rect.width, img.naturalHeight || rect.height);
    setTargetRect(target);
    setIsZoomed(true);
  };

  const handleClose = useCallback(() => {
    if (!isZoomed || !originalImgRef.current) return;

    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
    }

    // Reset inner zoom transform
    updateZoomedImageTransform(1, 0, 0, true);
    setInnerScale(1);
    isDraggingRef.current = false;

    // Recalculate original position
    const currentRect = originalImgRef.current.getBoundingClientRect();
    setOriginalRect(currentRect);

    setIsExpanded(false);

    // Unmount portal after 400ms transition completes
    closeTimeoutRef.current = setTimeout(() => {
      setIsZoomed(false);
      setOriginalRect(null);
      setTargetRect(null);
      onTabChange?.(localActiveTab);
      closeTimeoutRef.current = null;
    }, 400);
  }, [isZoomed, localActiveTab, onTabChange, updateZoomedImageTransform]);

  // High performance touch gesture handlers for 2-finger pinch & 1-finger pan
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (isTab2) return;
    hasMovedRef.current = false;

    if (e.touches.length === 2) {
      // 2-finger pinch start
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      pinchStartDistRef.current = dist;
      pinchStartScaleRef.current = innerScaleRef.current;

      touchStartRef.current = {
        x: (t1.clientX + t2.clientX) / 2,
        y: (t1.clientY + t2.clientY) / 2,
        panX: panOffsetRef.current.x,
        panY: panOffsetRef.current.y,
      };
      isDraggingRef.current = true;
    } else if (e.touches.length === 1 && innerScaleRef.current > 1.05) {
      // 1-finger pan start
      const touch = e.touches[0];
      touchStartRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        panX: panOffsetRef.current.x,
        panY: panOffsetRef.current.y,
      };
      isDraggingRef.current = true;
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (isTab2 || !targetRect) return;

    if (e.touches.length === 2 && pinchStartDistRef.current > 0) {
      // 2-finger pinch move
      hasMovedRef.current = true;
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      const scaleFactor = dist / pinchStartDistRef.current;
      const rawScale = pinchStartScaleRef.current * scaleFactor;

      // Allow elastic pinch scaling between 0.8x and 4.5x
      const newScale = Math.max(0.8, Math.min(4.5, rawScale));

      // Pan adjustment
      const currentCenterX = (t1.clientX + t2.clientX) / 2;
      const currentCenterY = (t1.clientY + t2.clientY) / 2;
      const dx = currentCenterX - touchStartRef.current.x;
      const dy = currentCenterY - touchStartRef.current.y;

      const scaledW = targetRect.width * newScale;
      const scaledH = targetRect.height * newScale;
      const maxPanX = Math.max(0, (scaledW - targetRect.width) / 2);
      const maxPanY = Math.max(0, (scaledH - targetRect.height) / 2);

      const newPanX = Math.max(-maxPanX, Math.min(maxPanX, touchStartRef.current.panX + dx));
      const newPanY = Math.max(-maxPanY, Math.min(maxPanY, touchStartRef.current.panY + dy));

      if (!rafPendingRef.current) {
        rafPendingRef.current = true;
        requestAnimationFrame(() => {
          updateZoomedImageTransform(newScale, newPanX, newPanY, false);
          rafPendingRef.current = false;
        });
      }
    } else if (e.touches.length === 1 && innerScaleRef.current > 1.05 && isDraggingRef.current) {
      // 1-finger pan move
      const touch = e.touches[0];
      const dx = touch.clientX - touchStartRef.current.x;
      const dy = touch.clientY - touchStartRef.current.y;

      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
        hasMovedRef.current = true;
      }

      const currentScale = innerScaleRef.current;
      const scaledW = targetRect.width * currentScale;
      const scaledH = targetRect.height * currentScale;

      const maxPanX = Math.max(0, (scaledW - targetRect.width) / 2);
      const maxPanY = Math.max(0, (scaledH - targetRect.height) / 2);

      const newPanX = Math.max(-maxPanX, Math.min(maxPanX, touchStartRef.current.panX + dx));
      const newPanY = Math.max(-maxPanY, Math.min(maxPanY, touchStartRef.current.panY + dy));

      if (!rafPendingRef.current) {
        rafPendingRef.current = true;
        requestAnimationFrame(() => {
          updateZoomedImageTransform(currentScale, newPanX, newPanY, false);
          rafPendingRef.current = false;
        });
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (isTab2) return;
    isDraggingRef.current = false;
    pinchStartDistRef.current = 0;

    const currentScale = innerScaleRef.current;

    // Elastic bounce-back for pinch limits
    if (currentScale < 1.05) {
      updateZoomedImageTransform(1, 0, 0, true);
      setInnerScale(1);
    } else if (currentScale > 4) {
      if (targetRect) {
        const scaledW = targetRect.width * 4;
        const scaledH = targetRect.height * 4;
        const maxPanX = Math.max(0, (scaledW - targetRect.width) / 2);
        const maxPanY = Math.max(0, (scaledH - targetRect.height) / 2);
        const clampedX = Math.max(-maxPanX, Math.min(maxPanX, panOffsetRef.current.x));
        const clampedY = Math.max(-maxPanY, Math.min(maxPanY, panOffsetRef.current.y));
        updateZoomedImageTransform(4, clampedX, clampedY, true);
        setInnerScale(4);
      }
    } else {
      setInnerScale(currentScale);
    }

    // Tap to close modal immediately when not dragged
    if (!hasMovedRef.current && e.changedTouches.length === 1 && currentScale <= 1.05) {
      handleClose();
    }
  };

  // Mouse handlers for desktop dragging when zoomed
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isTab2) return;
    hasMovedRef.current = false;
    if (innerScaleRef.current > 1.05) {
      touchStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        panX: panOffsetRef.current.x,
        panY: panOffsetRef.current.y,
      };
      isDraggingRef.current = true;
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isTab2 || !isDraggingRef.current || innerScaleRef.current <= 1.05 || !targetRect) return;
    const dx = e.clientX - touchStartRef.current.x;
    const dy = e.clientY - touchStartRef.current.y;

    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
      hasMovedRef.current = true;
    }

    const currentScale = innerScaleRef.current;
    const scaledW = targetRect.width * currentScale;
    const scaledH = targetRect.height * currentScale;

    const maxPanX = Math.max(0, (scaledW - targetRect.width) / 2);
    const maxPanY = Math.max(0, (scaledH - targetRect.height) / 2);

    const newPanX = Math.max(-maxPanX, Math.min(maxPanX, touchStartRef.current.panX + dx));
    const newPanY = Math.max(-maxPanY, Math.min(maxPanY, touchStartRef.current.panY + dy));

    if (!rafPendingRef.current) {
      rafPendingRef.current = true;
      requestAnimationFrame(() => {
        updateZoomedImageTransform(currentScale, newPanX, newPanY, false);
        rafPendingRef.current = false;
      });
    }
  };

  const handleMouseUp = () => {
    if (isTab2) return;
    isDraggingRef.current = false;
  };

  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isTab2) return;
    e.stopPropagation();
    if (!hasMovedRef.current && innerScaleRef.current <= 1.05) {
      handleClose();
    }
  };

  // Lock background scrolling while zoomed
  useEffect(() => {
    if (!isZoomed) return;

    // Pause Lenis smooth scroll so background page cannot scroll at all
    const lenis = (window as any).__lenis;
    if (lenis && typeof lenis.stop === "function") {
      lenis.stop();
    }

    const preventScroll = (e: Event) => {
      const target = e.target as HTMLElement | null;
      if (target && target.closest("[data-lenis-prevent]")) {
        return; // Allow wheel/touchpad scrolling inside zoomed container!
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

  // Close on Escape key press
  useEffect(() => {
    if (!isZoomed) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isZoomed, handleClose]);

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
                opacity: isExpanded ? 0.75 : 0,
                transition: "opacity 0.4s cubic-bezier(0.32, 0.72, 0, 1)",
              }}
              onClick={handleClose}
            />

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
                    updateZoomedImageTransform(1, 0, 0, true);
                    setInnerScale(1);
                  }}
                  size="md"
                />
              </div>
            )}

            {/* Container displaying the natural uncropped aspect ratio fit */}
            <div
              data-lenis-prevent
              className={cn(
                "fixed z-[9999] select-text overscroll-contain touch-none",
                isTab2
                  ? "cursor-default"
                  : innerScale > 1.05
                  ? "cursor-grab active:cursor-grabbing"
                  : "cursor-zoom-out"
              )}
              style={{
                left: isExpanded ? `${targetRect.left}px` : `${originalRect.left}px`,
                top: isExpanded ? `${targetRect.top}px` : `${originalRect.top}px`,
                width: isExpanded ? `${targetRect.width}px` : `${originalRect.width}px`,
                height: isExpanded ? `${targetRect.height}px` : `${originalRect.height}px`,
                borderRadius: isExpanded ? "32px" : originalBorderRadius,
                border: "1px solid var(--border)",
                overflow: "hidden",
                transition: "left 0.4s cubic-bezier(0.32, 0.72, 0, 1), top 0.4s cubic-bezier(0.32, 0.72, 0, 1), width 0.4s cubic-bezier(0.32, 0.72, 0, 1), height 0.4s cubic-bezier(0.32, 0.72, 0, 1), border-radius 0.4s cubic-bezier(0.32, 0.72, 0, 1)",
              }}
              onClick={handleContainerClick}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
            >
              {isTab2 && tab2 ? (
                <div className="w-full h-full bg-[var(--bg-2)] overflow-auto" onClick={(e) => e.stopPropagation()}>
                  <ZoomTabContent tab2={tab2} />
                </div>
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  ref={zoomedImgRef}
                  src={src}
                  alt={alt}
                  className="w-full h-full object-contain select-none pointer-events-none"
                  style={{
                    transform: "translate3d(0px, 0px, 0) scale(1)",
                    transformOrigin: "center center",
                    willChange: "transform",
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


