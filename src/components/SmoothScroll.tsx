"use client";
import { useEffect, useRef } from "react";
import Lenis from "lenis";
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

    // 1. Lenis başlat
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      touchMultiplier: 2,
    });

    lenisRef.current = lenis;

    // 2. Lenis scroll olayını GSAP ScrollTrigger ile senkronize et
    lenis.on("scroll", ScrollTrigger.update);

    // 3. Lenis'i GSAP ticker'a ekle
    const ticker = (time: number) => {
      lenis.raf(time * 1000);
    };
    gsap.ticker.add(ticker);

    // 4. GSAP iç lag düzeltmesini kapat (daha iyi senkron için)
    gsap.ticker.lagSmoothing(0);

    return () => {
      lenis.destroy();
      gsap.ticker.remove(ticker);
    };
  }, [isAdmin]);

  return <>{children}</>;
}
