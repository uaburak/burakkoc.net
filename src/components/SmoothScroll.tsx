"use client";
import { useEffect, useRef } from "react";
import type Lenis from "lenis";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { usePathname } from "next/navigation";
import siteConfig from "@/lib/siteConfig";

gsap.registerPlugin(ScrollTrigger);

export default function SmoothScroll({ children }: { children: React.ReactNode }) {
  const lenisRef = useRef<Lenis | null>(null);
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith("/admin");

  useEffect(() => {
    // Admin panelinde veya flag kapalıysa smooth scroll devre dışı
    if (isAdmin || !siteConfig.SMOOTH_SCROLL_ENABLED) return;

    let ticker: ((time: number) => void) | null = null;
    let cancelled = false;

    // Lenis yalnızca gerçekten kullanılacaksa indirilir (dinamik import).
    import("lenis").then(({ default: LenisCtor }) => {
      if (cancelled) return;

      // 1. Lenis başlat
      const lenis = new LenisCtor({
        duration: 1.2,
        easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smoothWheel: true,
        touchMultiplier: 2,
      });

      lenisRef.current = lenis;
      (window as any).__lenis = lenis;

      // 2. Lenis scroll olayını GSAP ScrollTrigger ile senkronize et
      lenis.on("scroll", ScrollTrigger.update);

      // 3. Lenis'i GSAP ticker'a ekle
      ticker = (time: number) => {
        lenis.raf(time * 1000);
      };
      gsap.ticker.add(ticker);

      // 4. GSAP iç lag düzeltmesini kapat (daha iyi senkron için)
      gsap.ticker.lagSmoothing(0);
    });

    return () => {
      cancelled = true;
      lenisRef.current?.destroy();
      lenisRef.current = null;
      if (ticker) gsap.ticker.remove(ticker);
    };
  }, [isAdmin]);

  return <>{children}</>;
}
