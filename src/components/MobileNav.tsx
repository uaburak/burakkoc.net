"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "@/context/ThemeContext";

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

function GridMenuIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 14 14" fill="none">
      <circle cx="3" cy="3" r="1.35" fill="currentColor" />
      <circle cx="11" cy="3" r="1.35" fill="currentColor" />
      <circle cx="3" cy="11" r="1.35" fill="currentColor" />
      <circle cx="11" cy="11" r="1.35" fill="currentColor" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path
        d="M3.5 3.5l9 9M12.5 3.5l-9 9"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SunMoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="4" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10 2v2M10 16v2M2 10h2M16 10h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

// ── Context ───────────────────────────────────────────────────────────────────

type MobileNavContextType = {
  isOpen: boolean;
  toggleMenu: () => void;
  closeMenu: () => void;
};

const MobileNavContext = createContext<MobileNavContextType>({
  isOpen: false,
  toggleMenu: () => {},
  closeMenu: () => {},
});

export const useMobileNav = () => useContext(MobileNavContext);

// ── Main Provider Component ───────────────────────────────────────────────────

export function MobileNavProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const { theme, toggle } = useTheme();

  // Close menu on route change
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  const toggleMenu = () => setIsOpen((prev) => !prev);
  const closeMenu = () => setIsOpen(false);

  const isAdminPage = pathname?.startsWith("/admin");

  const navLinks = [
    { href: "/", label: "Home", icon: <HomeIcon /> },
    { href: "/projects", label: "Projects", icon: <ProjectsIcon /> },
    { href: "/cv", label: "CV", icon: <UserIcon /> },
  ];

  return (
    <MobileNavContext.Provider value={{ isOpen, toggleMenu, closeMenu }}>
      <div className="w-full min-h-screen relative">

        {/* ── 1. Website Content (Shifts Left by exact menu width -260px for 0px gap) ── */}
        <motion.div
          animate={{
            x: isOpen && !isAdminPage ? "-260px" : "0px",
          }}
          transition={{
            type: "spring",
            damping: 28,
            stiffness: 260,
            mass: 0.7,
          }}
          style={
            isOpen && !isAdminPage
              ? ({ "--bg-1": "var(--bg-3)" } as React.CSSProperties)
              : undefined
          }
          className="w-full min-h-screen relative origin-left transition-colors duration-300"
          onClick={isOpen ? closeMenu : undefined}
        >
          {children}
        </motion.div>

        {/* ── 2. Menu Panel (Fixed on RIGHT edge `right-0`, bg-1 white background) ── */}
        <AnimatePresence>
          {isOpen && !isAdminPage && (
            <motion.aside
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{
                type: "spring",
                damping: 28,
                stiffness: 260,
                mass: 0.7,
              }}
              className="fixed top-0 right-0 bottom-0 z-40 w-[260px] h-full min-h-screen bg-[var(--bg-1)] border-l border-[var(--border)] p-6 flex flex-col justify-between xl:hidden"
            >
              {/* Navigation Links */}
              <div className="flex flex-col gap-6 pt-16">
                <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-subtitle)]">
                  Menu
                </span>

                <nav className="flex flex-col gap-2">
                  {navLinks.map((link) => {
                    const isActive =
                      link.href === "/"
                        ? pathname === "/"
                        : pathname?.startsWith(link.href);

                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        onClick={closeMenu}
                        className={`flex items-center justify-between px-3.5 py-3 rounded-2xl text-base font-medium transition-all duration-150 ${
                          isActive
                            ? "bg-[var(--bg-4)] text-[var(--text-title)] font-semibold"
                            : "text-[var(--text-subtitle)] hover:text-[var(--text-title)] hover:bg-[var(--bg-4)]/60"
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
                </nav>
              </div>

              {/* Theme Toggle Button */}
              <div className="pt-6 border-t border-[var(--border)] flex flex-col gap-3">
                <button
                  type="button"
                  onClick={toggle}
                  className="flex items-center justify-between w-full px-3.5 py-2.5 rounded-2xl text-sm font-medium text-[var(--text-subtitle)] hover:text-[var(--text-title)] hover:bg-[var(--bg-4)]/60 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <SunMoonIcon />
                    <span>Theme</span>
                  </div>
                  <span className="capitalize text-xs font-semibold px-2.5 py-1 rounded-full border border-[var(--border)] bg-[var(--bg-2)] text-[var(--text-title)]">
                    {theme}
                  </span>
                </button>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* ── 3. Non-Sticky Icon-Only Menu Button (44px, aligned with Title & Subtitle height) ── */}
        {!isAdminPage && (
          <button
            type="button"
            onClick={toggleMenu}
            className="absolute top-[50px] right-5 z-30 xl:hidden w-11 h-11 bg-transparent border-0 text-[var(--text-title)] flex items-center justify-center active:scale-95 transition-transform cursor-pointer hover:opacity-75"
            aria-label="Toggle Menu"
          >
            {isOpen ? <CloseIcon /> : <GridMenuIcon />}
          </button>
        )}

      </div>
    </MobileNavContext.Provider>
  );
}

export function MobileNav() {
  return null;
}
