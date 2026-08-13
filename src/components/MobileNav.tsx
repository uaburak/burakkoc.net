"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

// ── SVG Icons ─────────────────────────────────────────────────────────────────

function HomeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
      <path
        d="M3 8.5L10 3L17 8.5V16.5A1 1 0 0116 17.5H4A1 1 0 013 16.5V8.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ProjectsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
      <rect x="3" y="3" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="11" y="3" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="3" y="11" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="11" y="11" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="6" r="3.5" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M3.5 16.5C3.5 13.5 6.41 11.5 10 11.5C13.59 11.5 16.5 13.5 16.5 16.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ── Main Morphing Mobile Navigation ──────────────────────────────────────────

export function MobileNav() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on route change
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  // Close menu on click/touch outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isOpen]);

  if (pathname?.startsWith("/admin")) {
    return null;
  }

  const handleClose = () => {
    setIsOpen(false);
  };

  const navLinks = [
    { href: "/", label: "Home", icon: <HomeIcon /> },
    { href: "/projects", label: "Projects", icon: <ProjectsIcon /> },
    { href: "/cv", label: "CV", icon: <UserIcon /> },
  ];

  // CLOSED: 52px x 52px icon-only black button with 24px radius (matching drawer radius)
  // OPEN: calc(100vw - 24px) width, 152px height (fitted strictly to 3 items), 24px radius
  const targetWidth = !isOpen ? "52px" : "calc(100vw - 24px)";
  const targetHeight = !isOpen ? "52px" : "152px";
  const targetRadius = "24px";

  return (
    <div
      ref={menuRef}
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 xl:hidden pointer-events-auto"
    >
      <motion.div
        animate={{
          width: targetWidth,
          height: targetHeight,
          borderRadius: targetRadius,
        }}
        transition={{
          type: "spring",
          damping: 24,
          stiffness: 340,
          mass: 0.6,
        }}
        className="border border-[var(--border)] bg-[var(--bg-1)] backdrop-blur-xl text-[var(--text-title)] overflow-hidden relative"
        style={{ originX: 0.5, originY: 1 }}
      >
        {/* CLOSED STATE: Icon-Only White Floating Pill Button */}
        {!isOpen && (
          <motion.button
            type="button"
            onClick={() => setIsOpen(true)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="w-full h-full flex items-center justify-center text-[var(--text-title)] select-none cursor-pointer hover:bg-[var(--bg-4)] transition-colors"
            aria-label="Open Menu"
          >
            <div className="relative w-5 h-5 flex items-center justify-center">
              <svg width="18" height="18" viewBox="0 0 14 14" fill="none" className="text-[var(--text-title)]">
                <circle cx="3" cy="3" r="1.35" fill="currentColor" />
                <circle cx="11" cy="3" r="1.35" fill="currentColor" />
                <circle cx="3" cy="11" r="1.35" fill="currentColor" />
                <circle cx="11" cy="11" r="1.35" fill="currentColor" />
              </svg>
            </div>
          </motion.button>
        )}

        {/* OPEN STATE: Equal Padding & Full Radius Navigation Buttons */}
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, delay: 0.05 }}
            className="absolute inset-0 flex flex-col justify-center max-w-[500px] mx-auto w-full p-2.5"
          >
            <div className="flex flex-col gap-1.5">
              {navLinks.map((link) => {
                const isActive =
                  link.href === "/"
                    ? pathname === "/"
                    : pathname?.startsWith(link.href);

                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={handleClose}
                    className={`flex items-center justify-between px-4 py-2.5 rounded-full text-sm font-medium transition-all duration-150 ${
                      isActive
                        ? "bg-[var(--bg-4)] text-[var(--text-title)] font-semibold"
                        : "text-[var(--text-subtitle)] hover:text-[var(--text-title)] hover:bg-[var(--bg-3)]"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-[var(--text-subtitle)]">{link.icon}</span>
                      <span>{link.label}</span>
                    </div>
                    {isActive && (
                      <span className="w-2 h-2 rounded-full bg-[var(--text-title)]" />
                    )}
                  </Link>
                );
              })}
            </div>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
