"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Segmented } from "@/components/Segmented";
import { BadgeItem } from "@/types/project";

type ZoomableImageProps = React.ImgHTMLAttributes<HTMLImageElement> & {
  badges?: BadgeItem[];
  activeTab?: string;
  onTabChange?: (tab: string) => void;
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
      <div className="bg-[var(--bg-2)] w-full h-full overflow-auto p-8 pt-8 pb-20">
        <div className="flex items-center gap-1.5 pb-4">
          <span className="w-2.5 h-2.5 rounded-full bg-[var(--border-hover)]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[var(--border-hover)]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[var(--border-hover)]" />
          {tab2.language && (
            <span className="ml-2 text-xs text-[var(--text-subtitle)] font-mono select-none">{tab2.language}</span>
          )}
        </div>
        <pre className="font-mono text-xs leading-6 text-[var(--text-p)] overflow-x-auto whitespace-pre">
          {tab2.content?.trim() || "// kod girilmedi"}
        </pre>
      </div>
    );
  }
  if (tab2.type === "text") {
    return (
      <div className="p-8 pt-8 pb-20 overflow-auto w-full h-full bg-[var(--bg-2)]">
        <p className="text-base font-light leading-7 text-[var(--text-p)] whitespace-pre-wrap">
          {tab2.content?.trim() || "Metin girilmedi"}
        </p>
      </div>
    );
  }
  return null;
}

export function ZoomableImage({ src, alt, className, style, badges, activeTab, onTabChange, ...props }: ZoomableImageProps) {
  const [isZoomed, setIsZoomed] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [originalRect, setOriginalRect] = useState<DOMRect | null>(null);
  const [targetRect, setTargetRect] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const [originalBorderRadius, setOriginalBorderRadius] = useState<string>("0px");
  const [localActiveTab, setLocalActiveTab] = useState(activeTab || "");
  const [prevActiveTab, setPrevActiveTab] = useState(activeTab || "");

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
    const maxW = vw * 0.80;
    const maxH = vh * 0.80;
    const imageRatio = naturalW / naturalH;
    const targetRatio = maxW / maxH;

    let targetWidth = maxW;
    let targetHeight = maxH;

    if (imageRatio > targetRatio) {
      // Image is wider than 85% viewport ratio limit
      targetWidth = maxW;
      targetHeight = maxW / imageRatio;
    } else {
      // Image is taller than 85% viewport ratio limit
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
    const rect = img.getBoundingClientRect();
    const computedStyle = window.getComputedStyle(img);
    const parentStyle = img.parentElement ? window.getComputedStyle(img.parentElement) : null;

    // Detect if parent container has overflow: hidden and has border-radius
    const borderRadius = parentStyle?.overflow === "hidden" ? parentStyle.borderRadius : computedStyle.borderRadius;

    setOriginalRect(rect);
    setOriginalBorderRadius(borderRadius || "0px");
    setLocalActiveTab(activeTab || tab1Label);

    const target = calculateTargetRect(img.naturalWidth || rect.width, img.naturalHeight || rect.height);
    setTargetRect(target);
    setIsZoomed(true);

    // Block page scrolling and prevent scrollbar shift/jitter
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
      document.documentElement.style.setProperty("--scrollbar-width", `${scrollbarWidth}px`);
    }
    document.body.style.overflow = "hidden";
  };

  const handleClose = useCallback(() => {
    if (!isZoomed || !originalImgRef.current) return;

    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
    }

    // Recalculate original position in case it shifted slightly (e.g. dynamic layout shifts)
    const currentRect = originalImgRef.current.getBoundingClientRect();
    setOriginalRect(currentRect);

    setIsExpanded(false);

    // Unmount portal and restore scroll after the 400ms transition completes
    closeTimeoutRef.current = setTimeout(() => {
      setIsZoomed(false);
      setOriginalRect(null);
      setTargetRect(null);
      document.body.style.overflow = "";
      document.body.style.paddingRight = "";
      document.documentElement.style.removeProperty("--scrollbar-width");
      onTabChange?.(localActiveTab);
      closeTimeoutRef.current = null;
    }, 400);
  }, [isZoomed, localActiveTab, onTabChange]);

  // Clean up timeout on unmount
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
            {/* Backdrop with smooth fade in/out (white in light mode, black in dark mode) */}
            <div
              className="fixed inset-0 z-[9998] cursor-zoom-out"
              style={{
                backgroundColor: "var(--bg-1)",
                opacity: isExpanded ? 0.75 : 0,
                transition: "opacity 0.4s cubic-bezier(0.2, 0.8, 0.2, 1)",
              }}
              onClick={handleClose}
            />

            {segBadge && (
              <div
                className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999]"
                style={{
                  opacity: isExpanded ? 1 : 0,
                  transition: "opacity 0.4s cubic-bezier(0.2, 0.8, 0.2, 1)",
                  pointerEvents: isExpanded ? "auto" : "none",
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <Segmented
                  options={[tab1Label, tab2Label]}
                  value={localActiveTab}
                  onChange={setLocalActiveTab}
                  size="md"
                />
              </div>
            )}

            {/* Cloned container and image performing the FLIP zoom animation */}
            <div
              data-lenis-prevent
              className="fixed z-[9999] cursor-zoom-out select-none"
              style={{
                left: isExpanded ? `${targetRect.left}px` : `${originalRect.left}px`,
                top: isExpanded ? `${targetRect.top}px` : `${originalRect.top}px`,
                width: isExpanded ? `${targetRect.width}px` : `${originalRect.width}px`,
                height: isExpanded ? `${targetRect.height}px` : `${originalRect.height}px`,
                borderRadius: isExpanded ? "32px" : originalBorderRadius,
                border: "1px solid var(--border)",
                overflow: "hidden",
                transition: "all 0.4s cubic-bezier(0.2, 0.8, 0.2, 1)",
              }}
              onClick={handleClose}
            >
              {isTab2 && tab2 ? (
                <ZoomTabContent tab2={tab2} />
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={src}
                  alt={alt}
                  className="w-full h-full object-cover select-none pointer-events-none"
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
