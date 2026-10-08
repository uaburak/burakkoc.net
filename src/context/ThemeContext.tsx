"use client";

import { createContext, useCallback, useContext, useSyncExternalStore } from "react";

type Theme = "light" | "dark";

const ThemeContext = createContext<{
  theme: Theme;
  toggle: () => void;
}>({ theme: "light", toggle: () => {} });

/**
 * The theme is the document's `data-theme` (written before the first paint
 * by the layout's script, from localStorage): read from it — on the server,
 * and while hydrating, light — and written back to it.
 */
const THEME_EVENT = "theme-change";
const subscribe = (cb: () => void) => {
  window.addEventListener(THEME_EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(THEME_EVENT, cb);
    window.removeEventListener("storage", cb);
  };
};
const snapshot = (): Theme => (document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light");

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSyncExternalStore(subscribe, snapshot, () => "light" as Theme);

  const toggle = useCallback(() => {
    const next: Theme = snapshot() === "light" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("theme", next);
    } catch { /* the attribute holds it for this visit */ }
    window.dispatchEvent(new Event(THEME_EVENT));
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
