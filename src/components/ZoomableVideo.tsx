"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { IconButton } from "@/components/Button";

/**
 * A video file (mp4 / webm) that waits on the page: its first frame and a play button.
 * A click opens it in the site's lightbox, grown from where it sits, and plays it with
 * controls; closing (Escape, or a click outside) pauses it and shrinks it back.
 */
export function ZoomableVideo({ src, caption }: { src: string; caption?: string }) {
  const [isZoomed, setIsZoomed] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [originalRect, setOriginalRect] = useState<DOMRect | null>(null);
  const [targetRect, setTargetRect] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const [ratio, setRatio] = useState(16 / 9);

  const placeholderRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<HTMLVideoElement>(null);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // "#t=0.1" makes Safari paint the first frame instead of a blank box.
  const posterSrc = src.includes("#") ? src : `${src}#t=0.1`;

  const calculateTargetRect = useCallback(() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const isMobileScreen = vw < 640;
    const maxW = isMobileScreen ? vw - 16 : vw * 0.88;
    const maxH = isMobileScreen ? vh * 0.82 : vh * 0.85;
    let width = maxW;
    let height = maxW / ratio;
    if (height > maxH) {
      height = maxH;
      width = maxH * ratio;
    }
    return { left: (vw - width) / 2, top: (vh - height) / 2, width, height };
  }, [ratio]);

  const handleZoom = () => {
    if (isZoomed || !placeholderRef.current) return;
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    setOriginalRect(placeholderRef.current.getBoundingClientRect());
    setTargetRect(calculateTargetRect());
    setIsZoomed(true);

    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
      document.documentElement.style.setProperty("--scrollbar-width", `${scrollbarWidth}px`);
    }
    document.body.style.overflow = "hidden";
  };

  const handleClose = useCallback(() => {
    if (!isZoomed || !placeholderRef.current) return;
    if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    playerRef.current?.pause();
    setOriginalRect(placeholderRef.current.getBoundingClientRect());
    setIsExpanded(false);

    closeTimeoutRef.current = setTimeout(() => {
      setIsZoomed(false);
      setOriginalRect(null);
      setTargetRect(null);
      document.body.style.overflow = "";
      document.body.style.paddingRight = "";
      document.documentElement.style.removeProperty("--scrollbar-width");
      closeTimeoutRef.current = null;
    }, 400);
  }, [isZoomed]);

  useEffect(() => () => {
    if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
  }, []);

  useEffect(() => {
    if (!isZoomed || !targetRect) return;
    const raf = requestAnimationFrame(() => setIsExpanded(true));
    return () => cancelAnimationFrame(raf);
  }, [isZoomed, targetRect]);

  useEffect(() => {
    if (!isZoomed) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    const onResize = () => setTargetRect(calculateTargetRect());
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onResize);
    };
  }, [isZoomed, handleClose, calculateTargetRect]);

  const playIcon = (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="ml-0.5 text-[var(--text-title)]">
      <path d="M6.5 4.5L15.5 10L6.5 15.5V4.5Z" fill="currentColor" />
    </svg>
  );

  return (
    <>
      <div
        ref={placeholderRef}
        onClick={handleZoom}
        className="absolute inset-0 flex items-center justify-center cursor-zoom-in group"
        style={{ visibility: isZoomed ? "hidden" : "visible" }}
      >
        <video
          src={posterSrc}
          preload="metadata"
          muted
          playsInline
          onLoadedMetadata={(e) => {
            const v = e.currentTarget;
            if (v.videoWidth && v.videoHeight) setRatio(v.videoWidth / v.videoHeight);
          }}
          className="absolute inset-0 w-full h-full object-cover pointer-events-none select-none"
        />
        <div className="absolute inset-0 bg-black/10 group-hover:bg-black/20 transition-colors duration-300" />
        <IconButton size="lg" aria-label={caption ? `${caption} — oynat` : "Videoyu oynat"} className="relative z-10 pointer-events-none">
          {playIcon}
        </IconButton>
      </div>

      {isZoomed && originalRect && targetRect &&
        createPortal(
          <>
            <div
              className="fixed inset-0 z-[9998] cursor-zoom-out"
              style={{
                backgroundColor: "var(--bg-1)",
                opacity: isExpanded ? 0.85 : 0,
                transition: "opacity 0.4s cubic-bezier(0.2, 0.8, 0.2, 1)",
              }}
              onClick={handleClose}
            />
            <div
              data-lenis-prevent
              className="fixed z-[9999] overflow-hidden rounded-[24px] border border-[var(--border)] bg-black"
              style={{
                left: isExpanded ? targetRect.left : originalRect.left,
                top: isExpanded ? targetRect.top : originalRect.top,
                width: isExpanded ? targetRect.width : originalRect.width,
                height: isExpanded ? targetRect.height : originalRect.height,
                transition: "all 0.4s cubic-bezier(0.2, 0.8, 0.2, 1)",
              }}
            >
              <video ref={playerRef} src={src} autoPlay controls playsInline className="w-full h-full object-contain" />
            </div>
          </>,
          document.body
        )}
    </>
  );
}
