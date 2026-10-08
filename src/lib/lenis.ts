import type Lenis from "lenis";

/** The page's Lenis smooth scroll, while it runs (see SmoothScroll — off unless siteConfig turns it on): what the scroll-driven parts stop or follow. */
declare global {
  interface Window {
    __lenis?: Lenis;
  }
}

export {};
