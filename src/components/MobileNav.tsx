"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/ThemeToggle";

export function MobileNav() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on route change
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  // Close menu when clicking outside
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

  // Don't render on admin routes
  if (pathname?.startsWith("/admin")) {
    return null;
  }

  const navLinks = [
    { href: "/", label: "Home" },
    { href: "/projects", label: "Projects" },
    { href: "/cv", label: "CV" },
  ];

  return (
    <div
      ref={menuRef}
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 xl:hidden pointer-events-auto"
    >
      {/* ── Floating Popup Menu Card ── */}
      {isOpen && (
        <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 w-[220px] rounded-2xl border border-[var(--border)] bg-[var(--bg-1)]/95 backdrop-blur-xl p-2 shadow-[0_16px_40px_rgba(0,0,0,0.2)] flex flex-col gap-1 transition-all duration-200 animate-in fade-in slide-in-from-bottom-2">
          {navLinks.map((link) => {
            const isActive =
              link.href === "/"
                ? pathname === "/"
                : pathname?.startsWith(link.href);

            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setIsOpen(false)}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors duration-150 ${
                  isActive
                    ? "bg-[var(--bg-4)] text-[var(--text-title)] font-semibold"
                    : "text-[var(--text-subtitle)] hover:text-[var(--text-p)] hover:bg-[var(--bg-3)]"
                }`}
              >
                <span>{link.label}</span>
                {isActive && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-title)]" />
                )}
              </Link>
            );
          })}

          <div className="h-px bg-[var(--border)] my-1" />

          <div className="flex items-center justify-between px-3.5 py-2">
            <span className="text-xs font-medium text-[var(--text-subtitle)]">
              Theme
            </span>
            <ThemeToggle />
          </div>
        </div>
      )}

      {/* ── Sticky Floating Menu Button ── */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="Toggle navigation menu"
        className="flex items-center gap-2 px-4 py-2.5 rounded-full border border-[var(--border)] bg-[var(--bg-1)]/90 backdrop-blur-md text-[var(--text-title)] shadow-[0_8px_32px_rgba(0,0,0,0.16)] text-sm font-medium transition-all duration-200 active:scale-95 hover:bg-[var(--bg-4)] cursor-pointer select-none"
      >
        {/* Animated icon (Grid/Bars -> Close X) */}
        <div className="relative w-4 h-4 flex items-center justify-center">
          {isOpen ? (
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              className="text-[var(--text-title)]"
            >
              <path
                d="M3 3l8 8M11 3l-8 8"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          ) : (
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              className="text-[var(--text-title)]"
            >
              <circle cx="3" cy="3" r="1.25" fill="currentColor" />
              <circle cx="11" cy="3" r="1.25" fill="currentColor" />
              <circle cx="3" cy="11" r="1.25" fill="currentColor" />
              <circle cx="11" cy="11" r="1.25" fill="currentColor" />
            </svg>
          )}
        </div>
        <span>Menu</span>
      </button>
    </div>
  );
}
