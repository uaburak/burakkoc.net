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
  const [targetRect, setTargetRect] = useState<{ left: number; top: number; width: number; height: number; maxW: number; maxH: number } | null>(null);
  const [originalBorderRadius, setOriginalBorderRadius] = useState<string>("0px");
  const [localActiveTab, setLocalActiveTab] = useState(activeTab || "");
  const [prevActiveTab, setPrevActiveTab] = useState(activeTab || "");

  // Inner zoom & pan state when in focus state
  const [innerScale, setInnerScale] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  const lastTapTimeRef = useRef<number>(0);
  const lastTapPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const singleTapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartRef = useRef<{ x: number; y: number; panX: number; panY: number }>({ x: 0, y: 0, panX: 0, panY: 0 });
  const pinchStartDistRef = useRef<number>(0);
  const pinchStartScaleRef = useRef<number>(1);
  const pinchCenterRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const hasMovedRef = useRef<boolean>(false);
  const isTouchHandledRef = useRef<boolean>(false);

  const normalizedActiveTab = activeTab || "";
  if (normalizedActiveTab !== prevActiveTab) {
    setPrevActiveTab(normalizedActiveTab);
    setLocalActiveTab(normalizedActiveTab);
  }

  const originalImgRef = useRef<HTMLImageElement>(null);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Directly check window to avoid setting state in useEffect on mount (prevents linter errors)
  const portalContainer = typeof window !== "undefined" ? document.body : null;

  // Segmented badge configurations
  const segBadge = badges?.find((b) => b.icon === "segmented");
  const tab1Label = segBadge?.tab1Label ?? "Project";
  const tab2Label = segBadge?.tab2Label ?? "Code";
  const tab2 = segBadge?.tab2;
  const isTab2 = segBadge && localActiveTab === tab2Label;

  // Calculate coordinates to center and fit the image within the viewport (limited to 85%)
  const calculateTargetRect = useCallback((naturalW: number, naturalH: number) => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const isMobile = vw < 640;
    const maxW = isMobile ? vw - 16 : vw * 0.80;
    const maxH = isMobile ? vh * 0.85 : vh * 0.80;
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
      maxW,
      maxH,
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

    // Detect if parent container has overflow: hidden and has border-radius
    const borderRadius = customRect
      ? "16px"
      : (parentStyle?.overflow === "hidden" ? parentStyle.borderRadius : computedStyle.borderRadius);

    setOriginalRect(rect);
    setOriginalBorderRadius(borderRadius || "0px");
    setLocalActiveTab(activeTab || tab1Label);
    setInnerScale(1);
    setPanOffset({ x: 0, y: 0 });

    const target = calculateTargetRect(img.naturalWidth || rect.width, img.naturalHeight || rect.height);
    setTargetRect(target);
    setIsZoomed(true);
  };

  const handleClose = useCallback(() => {
    if (!isZoomed || !originalImgRef.current) return;

    if (singleTapTimerRef.current) {
      clearTimeout(singleTapTimerRef.current);
      singleTapTimerRef.current = null;
    }

    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
    }

    // Reset inner zoom
    setInnerScale(1);
    setPanOffset({ x: 0, y: 0 });
    setIsDragging(false);

    // Recalculate original position in case it shifted slightly (e.g. dynamic layout shifts)
    const currentRect = originalImgRef.current.getBoundingClientRect();
    setOriginalRect(currentRect);

    setIsExpanded(false);

    // Unmount portal after the 400ms transition completes
    closeTimeoutRef.current = setTimeout(() => {
      setIsZoomed(false);
      setOriginalRect(null);
      setTargetRect(null);
      onTabChange?.(localActiveTab);
      closeTimeoutRef.current = null;
    }, 400);
  }, [isZoomed, localActiveTab, onTabChange]);

  // Double-tap and single-tap handler for focus state
  const handleContainerTap = useCallback((clientX: number, clientY: number, containerRect: DOMRect) => {
    const now = Date.now();
    const timeDiff = now - lastTapTimeRef.current;
    const dx = Math.abs(clientX - lastTapPosRef.current.x);
    const dy = Math.abs(clientY - lastTapPosRef.current.y);

    if (timeDiff < 300 && dx < 35 && dy < 35) {
      // Double tap detected!
      if (singleTapTimerRef.current) {
        clearTimeout(singleTapTimerRef.current);
        singleTapTimerRef.current = null;
      }
      lastTapTimeRef.current = 0;

      if (innerScale > 1.1) {
        // Zoom out smoothly back to 1x
        setInnerScale(1);
        setPanOffset({ x: 0, y: 0 });
      } else if (targetRect) {
        // Zoom in smoothly to 2.5x targeted at tap position
        const newScale = 2.5;
        const expandedW = targetRect.maxW;
        const expandedH = targetRect.maxH;

        const tapX = clientX - containerRect.left;
        const tapY = clientY - containerRect.top;
        const centerX = containerRect.width / 2;
        const centerY = containerRect.height / 2;
        const targetPanX = -(tapX - centerX) * 1.2;
        const targetPanY = -(tapY - centerY) * 1.2;

        const scaledW = expandedW * newScale;
        const scaledH = expandedH * newScale;
        const maxPanX = Math.max(0, (scaledW - expandedW) / 2);
        const maxPanY = Math.max(0, (scaledH - expandedH) / 2);

        const clampedX = Math.max(-maxPanX, Math.min(maxPanX, targetPanX));
        const clampedY = Math.max(-maxPanY, Math.min(maxPanY, targetPanY));

        setInnerScale(newScale);
        setPanOffset({ x: clampedX, y: clampedY });
      }
    } else {
      // First tap -> start single tap delay timer
      lastTapTimeRef.current = now;
      lastTapPosRef.current = { x: clientX, y: clientY };

      if (singleTapTimerRef.current) {
        clearTimeout(singleTapTimerRef.current);
      }
      singleTapTimerRef.current = setTimeout(() => {
        singleTapTimerRef.current = null;
        handleClose();
      }, 250);
    }
  }, [innerScale, targetRect, handleClose]);

  // Touch gesture handlers (supporting Pinch-to-Zoom & Pan)
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (isTab2) return;
    hasMovedRef.current = false;

    if (e.touches.length === 2) {
      // 2-finger pinch start
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      pinchStartDistRef.current = dist;
      pinchStartScaleRef.current = innerScale;
      pinchCenterRef.current = {
        x: (t1.clientX + t2.clientX) / 2,
        y: (t1.clientY + t2.clientY) / 2,
      };
      touchStartRef.current = {
        x: (t1.clientX + t2.clientX) / 2,
        y: (t1.clientY + t2.clientY) / 2,
        panX: panOffset.x,
        panY: panOffset.y,
      };
      setIsDragging(true);
    } else if (e.touches.length === 1 && innerScale > 1.05) {
      // 1-finger pan start
      const touch = e.touches[0];
      touchStartRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        panX: panOffset.x,
        panY: panOffset.y,
      };
      setIsDragging(true);
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

      // Allow elastic pinch between 0.8x and 4.5x
      const newScale = Math.max(0.8, Math.min(4.5, rawScale));
      setInnerScale(newScale);

      // Pan adjustment during pinch
      const currentCenterX = (t1.clientX + t2.clientX) / 2;
      const currentCenterY = (t1.clientY + t2.clientY) / 2;
      const dx = currentCenterX - touchStartRef.current.x;
      const dy = currentCenterY - touchStartRef.current.y;

      const expandedW = targetRect.maxW;
      const expandedH = targetRect.maxH;
      const scaledW = expandedW * newScale;
      const scaledH = expandedH * newScale;
      const maxPanX = Math.max(0, (scaledW - expandedW) / 2);
      const maxPanY = Math.max(0, (scaledH - expandedH) / 2);

      const newPanX = Math.max(-maxPanX, Math.min(maxPanX, touchStartRef.current.panX + dx));
      const newPanY = Math.max(-maxPanY, Math.min(maxPanY, touchStartRef.current.panY + dy));

      setPanOffset({ x: newPanX, y: newPanY });
    } else if (e.touches.length === 1 && innerScale > 1.05 && isDragging) {
      // 1-finger pan move
      const touch = e.touches[0];
      const dx = touch.clientX - touchStartRef.current.x;
      const dy = touch.clientY - touchStartRef.current.y;

      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
        hasMovedRef.current = true;
      }

      const scaleProg = Math.min(1, Math.max(0, (innerScale - 1) / 1.2));
      const curW = targetRect.width + (targetRect.maxW - targetRect.width) * scaleProg;
      const curH = targetRect.height + (targetRect.maxH - targetRect.height) * scaleProg;

      const scaledW = curW * innerScale;
      const scaledH = curH * innerScale;

      const maxPanX = Math.max(0, (scaledW - curW) / 2);
      const maxPanY = Math.max(0, (scaledH - curH) / 2);

      const newPanX = Math.max(-maxPanX, Math.min(maxPanX, touchStartRef.current.panX + dx));
      const newPanY = Math.max(-maxPanY, Math.min(maxPanY, touchStartRef.current.panY + dy));

      setPanOffset({ x: newPanX, y: newPanY });
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (isTab2) return;
    setIsDragging(false);
    pinchStartDistRef.current = 0;

    // Elastic bounce-back for pinch limits
    if (innerScale < 1.05) {
      setInnerScale(1);
      setPanOffset({ x: 0, y: 0 });
    } else if (innerScale > 4) {
      setInnerScale(4);
    }

    if (!hasMovedRef.current && e.changedTouches.length === 1) {
      isTouchHandledRef.current = true;
      setTimeout(() => {
        isTouchHandledRef.current = false;
      }, 400);

      const touch = e.changedTouches[0];
      const containerRect = e.currentTarget.getBoundingClientRect();
      handleContainerTap(touch.clientX, touch.clientY, containerRect);
    }
  };

  // Mouse handlers (desktop dragging & fallback)
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isTab2) return;
    hasMovedRef.current = false;
    if (innerScale > 1.05) {
      touchStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        panX: panOffset.x,
        panY: panOffset.y,
      };
      setIsDragging(true);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isTab2 || !isDragging || innerScale <= 1.05 || !targetRect) return;
    const dx = e.clientX - touchStartRef.current.x;
    const dy = e.clientY - touchStartRef.current.y;

    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
      hasMovedRef.current = true;
    }

    const scaleProg = Math.min(1, Math.max(0, (innerScale - 1) / 1.2));
    const curW = targetRect.width + (targetRect.maxW - targetRect.width) * scaleProg;
    const curH = targetRect.height + (targetRect.maxH - targetRect.height) * scaleProg;

    const scaledW = curW * innerScale;
    const scaledH = curH * innerScale;

    const maxPanX = Math.max(0, (scaledW - curW) / 2);
    const maxPanY = Math.max(0, (scaledH - curH) / 2);

    const newPanX = Math.max(-maxPanX, Math.min(maxPanX, touchStartRef.current.panX + dx));
    const newPanY = Math.max(-maxPanY, Math.min(maxPanY, touchStartRef.current.panY + dy));

    setPanOffset({ x: newPanX, y: newPanY });
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isTab2) return;
    setIsDragging(false);
  };

  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isTab2) return;
    e.stopPropagation();
    if (isTouchHandledRef.current) return;
    if (!hasMovedRef.current) {
      handleContainerTap(e.clientX, e.clientY, e.currentTarget.getBoundingClientRect());
    }
  };

  // Lock background scrolling while zoomed without modifying body layout/padding
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
      if (singleTapTimerRef.current) {
        clearTimeout(singleTapTimerRef.current);
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

  // Interpolated container frame dimensions based on scale (Apple Photos style smooth expansion)
  const scaleProgress = targetRect && targetRect.maxH > targetRect.height && !isTab2
    ? Math.min(1, Math.max(0, (innerScale - 1) / 1.2))
    : 0;

  const activeW = targetRect
    ? targetRect.width + (targetRect.maxW - targetRect.width) * scaleProgress
    : 0;
  const activeH = targetRect
    ? targetRect.height + (targetRect.maxH - targetRect.height) * scaleProgress
    : 0;
  const activeLeft = typeof window !== "undefined" ? (window.innerWidth - activeW) / 2 : (targetRect?.left ?? 0);
  const activeTop = typeof window !== "undefined" ? (window.innerHeight - activeH) / 2 : (targetRect?.top ?? 0);

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
            {/* Backdrop with smooth fade in/out (white in light mode, black in dark mode) */}
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
                    setInnerScale(1);
                    setPanOffset({ x: 0, y: 0 });
                  }}
                  size="md"
                />
              </div>
            )}

            {/* Cloned container and image performing the FLIP zoom animation */}
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
                left: isExpanded ? `${activeLeft}px` : `${originalRect.left}px`,
                top: isExpanded ? `${activeTop}px` : `${originalRect.top}px`,
                width: isExpanded ? `${activeW}px` : `${originalRect.width}px`,
                height: isExpanded ? `${activeH}px` : `${originalRect.height}px`,
                borderRadius: isExpanded ? "32px" : originalBorderRadius,
                border: "1px solid var(--border)",
                overflow: "hidden",
                transition: isDragging ? "none" : "all 0.35s cubic-bezier(0.32, 0.72, 0, 1)",
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
                  src={src}
                  alt={alt}
                  className="w-full h-full object-cover select-none pointer-events-none"
                  style={{
                    transform: `translate3d(${panOffset.x}px, ${panOffset.y}px, 0) scale(${innerScale})`,
                    transition: isDragging ? "none" : "transform 0.35s cubic-bezier(0.32, 0.72, 0, 1)",
                    transformOrigin: "center center",
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

